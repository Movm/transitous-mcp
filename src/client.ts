import { RequestRateLimiter, TtlCache } from "./cache.js";
import { actionForTool, getApiAction, type ApiAction } from "./actions.js";
import { policyEnvelope } from "./policy.js";

const DEFAULT_BASE_URL = "https://api.transitous.org";

export const TRANSIT_MODES = [
  "TRANSIT",
  "TRAM",
  "SUBWAY",
  "FERRY",
  "BUS",
  "COACH",
  "RAIL",
  "HIGHSPEED_RAIL",
  "LONG_DISTANCE",
  "NIGHT_RAIL",
  "REGIONAL_FAST_RAIL",
  "REGIONAL_RAIL",
  "SUBURBAN",
  "FUNICULAR",
  "AERIAL_LIFT",
] as const;

export type TransitMode = (typeof TRANSIT_MODES)[number];

export interface LocationSearchInput {
  query: string;
  language?: string;
  limit?: number;
}

export interface ConnectionSearchInput {
  from: string;
  to: string;
  time?: string;
  arriveBy?: boolean;
  language?: string;
  limit?: number;
  maxTransfers?: number;
  transitModes?: TransitMode[];
  wheelchair?: boolean;
  requireBikeTransport?: boolean;
}

export type ApiQueryValue = string | number | boolean | Array<string | number | boolean>;

export interface ExecuteApiActionInput {
  actionId: string;
  query?: Record<string, ApiQueryValue>;
  body?: Record<string, unknown>;
  acknowledgeHeavyRequest?: boolean;
  maxResponseBytes?: number;
}

interface TransitousMatch {
  type?: string;
  name?: string;
  id?: string;
  lat?: number;
  lon?: number;
  country?: string;
  tz?: string;
  areas?: Array<{ name?: string }>;
  modes?: string[];
  score?: number;
}

interface TransitousPlace {
  name?: string;
  stopId?: string;
  lat?: number;
  lon?: number;
  arrival?: string;
  departure?: string;
  scheduledArrival?: string;
  scheduledDeparture?: string;
  track?: string;
  scheduledTrack?: string;
  cancelled?: boolean;
}

interface TransitousLeg {
  mode?: string;
  from?: TransitousPlace;
  to?: TransitousPlace;
  duration?: number;
  startTime?: string;
  endTime?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  realTime?: boolean;
  scheduled?: boolean;
  distance?: number;
  headsign?: string;
  routeShortName?: string;
  routeLongName?: string;
  displayName?: string;
  agencyName?: string;
  tripId?: string;
  cancelled?: boolean;
  intermediateStops?: TransitousPlace[];
  bikesAllowed?: boolean;
  wheelchairAccessible?: string;
}

interface TransitousItinerary {
  id?: string;
  duration?: number;
  startTime?: string;
  endTime?: string;
  transfers?: number;
  legs?: TransitousLeg[];
}

interface TransitousPlanResponse {
  itineraries?: TransitousItinerary[];
  direct?: TransitousItinerary[];
  previousPageCursor?: string;
  nextPageCursor?: string;
}

export class TransitousApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly responseBody: unknown,
  ) {
    super(`Transitous API request failed with status ${status}`);
    this.name = "TransitousApiError";
  }
}

function validateUserAgent(userAgent: string | undefined): string {
  const value = userAgent?.trim();
  const hasVersion = Boolean(value && /\S+\/\d/.test(value));
  const hasContact = Boolean(value && /(https?:\/\/|mailto:|[^\s]+@[^\s]+)/i.test(value));
  if (!value || !hasVersion || !hasContact) {
    throw new Error(
      "TRANSITOUS_USER_AGENT must include an application name, version, and contact, for example: " +
        "transitous-mcp/0.2.0 (https://github.com/user/transitous-mcp; mailto:you@example.com)",
    );
  }
  return value;
}

function normalizeLocation(match: TransitousMatch) {
  return {
    name: match.name,
    id: match.id,
    type: match.type,
    latitude: match.lat,
    longitude: match.lon,
    country: match.country,
    timeZone: match.tz,
    areas: match.areas?.map((area) => area.name).filter(Boolean) ?? [],
    modes: match.modes ?? [],
    score: match.score,
  };
}

function secondsBetween(actual: string | undefined, scheduled: string | undefined): number | undefined {
  if (!actual || !scheduled) return undefined;
  const delay = Math.round((Date.parse(actual) - Date.parse(scheduled)) / 1000);
  return Number.isFinite(delay) ? delay : undefined;
}

function normalizePlace(place: TransitousPlace | undefined) {
  if (!place) return undefined;
  return {
    name: place.name,
    stopId: place.stopId,
    latitude: place.lat,
    longitude: place.lon,
    arrival: place.arrival,
    departure: place.departure,
    scheduledArrival: place.scheduledArrival,
    scheduledDeparture: place.scheduledDeparture,
    track: place.track,
    scheduledTrack: place.scheduledTrack,
    cancelled: place.cancelled,
  };
}

function normalizeItinerary(itinerary: TransitousItinerary) {
  return {
    id: itinerary.id,
    departure: itinerary.startTime,
    arrival: itinerary.endTime,
    durationSeconds: itinerary.duration,
    transfers: itinerary.transfers,
    hasRealtimeData: itinerary.legs?.some((leg) => leg.realTime === true) ?? false,
    cancelled: itinerary.legs?.some((leg) => leg.cancelled === true) ?? false,
    legs: (itinerary.legs ?? []).map((leg) => ({
      mode: leg.mode,
      service: leg.displayName ?? leg.routeShortName ?? leg.routeLongName,
      headsign: leg.headsign,
      agency: leg.agencyName,
      tripId: leg.tripId,
      from: normalizePlace(leg.from),
      to: normalizePlace(leg.to),
      departure: leg.startTime,
      arrival: leg.endTime,
      scheduledDeparture: leg.scheduledStartTime,
      scheduledArrival: leg.scheduledEndTime,
      departureDelaySeconds: secondsBetween(leg.startTime, leg.scheduledStartTime),
      arrivalDelaySeconds: secondsBetween(leg.endTime, leg.scheduledEndTime),
      durationSeconds: leg.duration,
      distanceMeters: leg.distance,
      realtime: leg.realTime,
      scheduled: leg.scheduled,
      cancelled: leg.cancelled,
      bikesAllowed: leg.bikesAllowed,
      wheelchairAccessible: leg.wheelchairAccessible,
      intermediateStopCount: leg.intermediateStops?.length ?? 0,
    })),
  };
}

export class TransitousClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string | undefined;
  private readonly locationsCache = new TtlCache<unknown>(15 * 60_000);
  private readonly stopMatchCache = new TtlCache<TransitousMatch[]>(15 * 60_000);
  private readonly connectionsCache = new TtlCache<unknown>(60_000);
  private readonly actionsCache = new TtlCache<unknown>(60_000);
  private readonly limiter: RequestRateLimiter;

  constructor(options: {
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    userAgent?: string;
    requestsPerMinute?: number;
  } = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.TRANSITOUS_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.userAgent = options.userAgent ?? process.env.TRANSITOUS_USER_AGENT;
    this.limiter = new RequestRateLimiter(
      options.requestsPerMinute ?? Number.parseInt(process.env.TRANSITOUS_REQUESTS_PER_MINUTE ?? "20", 10),
    );
  }

  async searchLocations(input: LocationSearchInput, signal?: AbortSignal): Promise<unknown> {
    const params = new URLSearchParams({
      text: input.query,
      type: "STOP",
      language: input.language ?? "de",
      numResults: String(input.limit ?? 5),
    });
    const key = params.toString();
    const cached = this.locationsCache.get(key);
    if (cached) return { ...cached as object, cache: "hit" };

    const matches = await this.request<TransitousMatch[]>(`/api/v1/geocode?${key}`, signal);
    const result = {
      query: input.query,
      count: matches.length,
      locations: matches.map(normalizeLocation),
      cache: "miss",
      ...policyEnvelope(),
    };
    this.locationsCache.set(key, result);
    return result;
  }

  async searchConnections(input: ConnectionSearchInput, signal?: AbortSignal): Promise<unknown> {
    const cacheKey = JSON.stringify(input);
    const cached = this.connectionsCache.get(cacheKey);
    if (cached) return { ...cached as object, cache: "hit" };

    const [fromMatches, toMatches] = await Promise.all([
      this.resolveStop(input.from, input.language ?? "de", signal),
      this.resolveStop(input.to, input.language ?? "de", signal),
    ]);
    const from = fromMatches[0];
    const to = toMatches[0];
    if (!from?.id) throw new Error(`No Transitous stop found for origin: ${input.from}`);
    if (!to?.id) throw new Error(`No Transitous stop found for destination: ${input.to}`);

    const limit = input.limit ?? 3;
    const params = new URLSearchParams({
      fromPlace: from.id,
      toPlace: to.id,
      arriveBy: String(input.arriveBy ?? false),
      language: input.language ?? "de",
      numItineraries: String(limit),
      maxItineraries: String(limit),
      timetableView: "true",
      detailedLegs: "false",
      detailedTransfers: "false",
      withFares: "false",
      directModes: "",
    });
    if (input.time) params.set("time", input.time);
    if (input.maxTransfers !== undefined) params.set("maxTransfers", String(input.maxTransfers));
    if (input.transitModes?.length) params.set("transitModes", input.transitModes.join(","));
    if (input.wheelchair) {
      params.set("pedestrianProfile", "WHEELCHAIR");
      params.set("useRoutedTransfers", "true");
    }
    if (input.requireBikeTransport) params.set("requireBikeTransport", "true");

    const plan = await this.request<TransitousPlanResponse>(`/api/v6/plan?${params.toString()}`, signal);
    const rawItineraries = plan.itineraries ?? [];
    const result = {
      query: {
        ...input,
        resolvedOrigin: normalizeLocation(from),
        resolvedDestination: normalizeLocation(to),
      },
      count: Math.min(rawItineraries.length, limit),
      itineraries: rawItineraries.slice(0, limit).map(normalizeItinerary),
      direct: (plan.direct ?? []).slice(0, limit).map(normalizeItinerary),
      moreResultsAvailable: rawItineraries.length > limit || Boolean(plan.nextPageCursor),
      cache: "miss",
      caveats: [
        "Fares and ticket booking are not included.",
        "Realtime availability depends on the source feed.",
        "For important journeys, verify the result with the transport operator.",
      ],
      ...policyEnvelope(),
    };
    this.connectionsCache.set(cacheKey, result);
    return result;
  }

  async executeApiAction(input: ExecuteApiActionInput, signal?: AbortSignal): Promise<unknown> {
    const action = getApiAction(input.actionId);
    if (!action) {
      throw new Error(`Unknown Transitous action: ${input.actionId}. Use search_api_actions to find an action ID.`);
    }
    if (action.resourceIntensive && !input.acknowledgeHeavyRequest) {
      throw new Error(
        `Action ${action.id} can be resource-intensive. Read ${"https://transitous.org/api/"} and retry with ` +
          "acknowledgeHeavyRequest=true only when the request complies with the Transitous usage policy.",
      );
    }

    const query = input.query ?? {};
    this.validateQuery(action, query);
    const body = input.body;
    this.validateBody(action, body);

    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(query)) {
      params.set(name, Array.isArray(value) ? value.map(String).join(",") : String(value));
    }
    const path = params.size > 0 ? `${action.path}?${params.toString()}` : action.path;
    const maxResponseBytes = input.maxResponseBytes ?? 250_000;
    const cacheKey = JSON.stringify({ actionId: action.id, query, body, maxResponseBytes });
    const cached = this.actionsCache.get(cacheKey);
    if (cached) return { ...cached as object, cache: "hit" };

    const init: RequestInit = { method: action.method };
    if (action.method === "POST") {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(body);
    }
    const data = await this.request<unknown>(path, signal, init);
    const serialized = JSON.stringify(data);
    const responseBytes = Buffer.byteLength(serialized ?? "", "utf8");
    const truncated = responseBytes > maxResponseBytes;
    const responseData = truncated
      ? {
          dataPreview: Buffer.from(serialized ?? "", "utf8").subarray(0, maxResponseBytes).toString("utf8"),
          responseTruncated: true,
          responseBytes,
          maxResponseBytes,
          truncationNotice:
            "The upstream response exceeded the MCP safety limit. Narrow the API query or increase maxResponseBytes up to 1000000.",
        }
      : { data, responseTruncated: false, responseBytes };
    const result = {
      action: actionForTool(action),
      request: { method: action.method, path: action.path, query },
      ...responseData,
      cache: "miss",
      ...policyEnvelope(),
    };
    this.actionsCache.set(cacheKey, result);
    return result;
  }

  private async resolveStop(query: string, language: string, signal?: AbortSignal): Promise<TransitousMatch[]> {
    const params = new URLSearchParams({ text: query, type: "STOP", language, numResults: "5" });
    const key = params.toString();
    const cached = this.stopMatchCache.get(key);
    if (cached) return cached;
    const matches = await this.request<TransitousMatch[]>(`/api/v1/geocode?${key}`, signal);
    this.stopMatchCache.set(key, matches);
    return matches;
  }

  private validateQuery(action: ApiAction, query: Record<string, ApiQueryValue>): void {
    const unknown = Object.keys(query).filter((name) => !action.queryParameters.includes(name));
    if (unknown.length > 0) {
      throw new Error(
        `Unsupported query parameter(s) for ${action.id}: ${unknown.join(", ")}. ` +
          `Accepted: ${action.queryParameters.join(", ") || "none"}.`,
      );
    }
    const missing = action.requiredQueryParameters.filter((name) => query[name] === undefined || query[name] === "");
    if (missing.length > 0) {
      throw new Error(`Missing required query parameter(s) for ${action.id}: ${missing.join(", ")}.`);
    }
  }

  private validateBody(action: ApiAction, body: Record<string, unknown> | undefined): void {
    if (action.method === "GET" && body !== undefined) {
      throw new Error(`Action ${action.id} uses GET and does not accept a JSON body.`);
    }
    if (action.method === "POST" && body === undefined) {
      throw new Error(`Action ${action.id} requires a JSON body.`);
    }
    if (!body) return;
    const accepted = action.bodyProperties ?? [];
    const unknown = Object.keys(body).filter((name) => !accepted.includes(name));
    if (unknown.length > 0) {
      throw new Error(
        `Unsupported body properties for ${action.id}: ${unknown.join(", ")}. Accepted: ${accepted.join(", ")}.`,
      );
    }
    const missing = (action.requiredBodyProperties ?? []).filter((name) => body[name] === undefined);
    if (missing.length > 0) {
      throw new Error(`Missing required body properties for ${action.id}: ${missing.join(", ")}.`);
    }
  }

  private async request<T>(path: string, signal?: AbortSignal, init: RequestInit = {}): Promise<T> {
    const userAgent = validateUserAgent(this.userAgent);
    this.limiter.take();
    const timeout = AbortSignal.timeout(20_000);
    const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("User-Agent", userAgent);
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      signal: combinedSignal,
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!response.ok) throw new TransitousApiError(response.status, body);
    return body as T;
  }
}
