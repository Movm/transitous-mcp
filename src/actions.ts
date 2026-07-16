export const MOTIS_OPENAPI_URL =
  "https://github.com/motis-project/motis/blob/v2.10.2/openapi.yaml";
export const TRANSITOUS_API_DOCS_URL = "https://transitous.org/api/";

export interface ApiAction {
  id: string;
  method: "GET" | "POST";
  path: string;
  summary: string;
  keywords: string[];
  queryParameters: string[];
  requiredQueryParameters: string[];
  bodyProperties?: string[];
  requiredBodyProperties?: string[];
  experimental?: boolean;
  resourceIntensive?: boolean;
}

const planParameters = [
  "fromPlace", "toPlace", "radius", "via", "viaMinimumStay", "time", "maxTransfers",
  "maxTravelTime", "minTransferTime", "additionalTransferTime", "transferTimeFactor",
  "maxMatchingDistance", "pedestrianProfile", "pedestrianSpeed", "cyclingSpeed", "elevationCosts",
  "useRoutedTransfers", "detailedTransfers", "detailedLegs", "joinInterlinedLegs", "transitModes",
  "directModes", "preTransitModes", "postTransitModes", "directRentalFormFactors",
  "preTransitRentalFormFactors", "postTransitRentalFormFactors", "directRentalPropulsionTypes",
  "preTransitRentalPropulsionTypes", "postTransitRentalPropulsionTypes", "directRentalProviders",
  "directRentalProviderGroups", "preTransitRentalProviders", "preTransitRentalProviderGroups",
  "postTransitRentalProviders", "postTransitRentalProviderGroups", "ignoreDirectRentalReturnConstraints",
  "ignorePreTransitRentalReturnConstraints", "ignorePostTransitRentalReturnConstraints", "numItineraries",
  "maxItineraries", "pageCursor", "timetableView", "arriveBy", "searchWindow",
  "requireBikeTransport", "requireCarTransport", "maxPreTransitTime", "maxPostTransitTime",
  "maxDirectTime", "fastestDirectFactor", "timeout", "passengers", "luggage", "slowDirect",
  "fastestSlowDirectFactor", "withFares", "numLegAlternatives", "withScheduledSkippedStops",
  "language", "algorithm",
];

const intermodalParameters = [
  "one", "many", "time", "maxTravelTime", "maxMatchingDistance", "arriveBy", "maxTransfers",
  "minTransferTime", "additionalTransferTime", "transferTimeFactor", "useRoutedTransfers",
  "pedestrianProfile", "pedestrianSpeed", "cyclingSpeed", "elevationCosts", "transitModes",
  "preTransitModes", "postTransitModes", "directMode", "maxPreTransitTime", "maxPostTransitTime",
  "maxDirectTime", "withDistance", "requireBikeTransport", "requireCarTransport",
];

const refreshParameters = [
  "itineraryId", "requireDisplayNameMatch", "joinInterlinedLegs", "detailedTransfers", "detailedLegs",
  "withFares", "withScheduledSkippedStops", "numLegAlternatives", "transitModes", "pedestrianProfile",
  "useRoutedTransfers", "requireBikeTransport", "requireCarTransport", "language",
];

const refreshBodyProperties = [
  "id", "requireDisplayNameMatch", "joinInterlinedLegs", "detailedTransfers", "detailedLegs",
  "withFares", "withScheduledSkippedStops", "numLegAlternatives", "transitModes", "pedestrianProfile",
  "useRoutedTransfers", "requireBikeTransport", "requireCarTransport", "language",
];

export const API_ACTIONS: readonly ApiAction[] = [
  {
    id: "plan",
    method: "GET",
    path: "/api/v6/plan",
    summary: "Compute public-transport and intermodal journeys between two places.",
    keywords: ["route", "journey", "connection", "verbindung", "reise", "fahrplan", "routing"],
    queryParameters: planParameters,
    requiredQueryParameters: ["fromPlace", "toPlace"],
    resourceIntensive: true,
  },
  {
    id: "one_to_many_get",
    method: "GET",
    path: "/api/v1/one-to-many",
    summary: "Compute street-routing durations from one coordinate to many coordinates, or vice versa.",
    keywords: ["matrix", "street", "walk", "bike", "car", "one to many", "erreichbarkeit"],
    queryParameters: ["one", "many", "mode", "max", "maxMatchingDistance", "elevationCosts", "arriveBy", "withDistance"],
    requiredQueryParameters: ["one", "many", "mode", "max", "maxMatchingDistance", "arriveBy"],
    resourceIntensive: true,
  },
  {
    id: "one_to_many_post",
    method: "POST",
    path: "/api/v1/one-to-many",
    summary: "Compute street-routing durations for many coordinates using a JSON request body.",
    keywords: ["matrix", "street", "batch", "walk", "bike", "car", "one to many"],
    queryParameters: [],
    requiredQueryParameters: [],
    bodyProperties: ["one", "many", "mode", "max", "maxMatchingDistance", "elevationCosts", "arriveBy", "withDistance"],
    requiredBodyProperties: ["one", "many", "mode", "max", "maxMatchingDistance", "arriveBy"],
    resourceIntensive: true,
  },
  {
    id: "one_to_many_intermodal_get",
    method: "GET",
    path: "/api/experimental/one-to-many-intermodal",
    summary: "Compute experimental intermodal public-transport durations from one place to many places.",
    keywords: ["matrix", "intermodal", "transit", "one to many", "erreichbarkeit"],
    queryParameters: intermodalParameters,
    requiredQueryParameters: ["one", "many"],
    experimental: true,
    resourceIntensive: true,
  },
  {
    id: "one_to_many_intermodal_post",
    method: "POST",
    path: "/api/experimental/one-to-many-intermodal",
    summary: "Compute experimental intermodal one-to-many durations using a JSON request body.",
    keywords: ["matrix", "intermodal", "transit", "batch", "one to many"],
    queryParameters: [],
    requiredQueryParameters: [],
    bodyProperties: intermodalParameters,
    requiredBodyProperties: ["one", "many"],
    experimental: true,
    resourceIntensive: true,
  },
  {
    id: "one_to_all",
    method: "GET",
    path: "/api/v6/one-to-all",
    summary: "Find all timetable places reachable from one place within routing constraints.",
    keywords: ["reachability", "isochrone", "one to all", "erreichbar", "transit"],
    queryParameters: [
      "one", "time", "maxTravelTime", "arriveBy", "maxTransfers", "minTransferTime",
      "additionalTransferTime", "transferTimeFactor", "maxMatchingDistance", "useRoutedTransfers",
      "pedestrianProfile", "pedestrianSpeed", "cyclingSpeed", "elevationCosts", "transitModes",
      "preTransitModes", "postTransitModes", "requireBikeTransport", "requireCarTransport",
      "maxPreTransitTime", "maxPostTransitTime",
    ],
    requiredQueryParameters: ["one"],
    resourceIntensive: true,
  },
  {
    id: "reverse_geocode",
    method: "GET",
    path: "/api/v1/reverse-geocode",
    summary: "Resolve coordinates to nearby addresses, places, and stops.",
    keywords: ["reverse geocode", "coordinates", "nearby", "adresse", "haltestelle"],
    queryParameters: ["place", "type", "numResults"],
    requiredQueryParameters: ["place"],
  },
  {
    id: "geocode",
    method: "GET",
    path: "/api/v1/geocode",
    summary: "Resolve text to addresses, places, coordinates, and public-transport stops.",
    keywords: ["geocode", "search", "address", "station", "ort", "haltestelle"],
    queryParameters: ["text", "language", "type", "mode", "place", "placeBias", "numResults"],
    requiredQueryParameters: ["text"],
  },
  {
    id: "trip",
    method: "GET",
    path: "/api/v6/trip",
    summary: "Fetch the complete itinerary for a Transitous trip ID.",
    keywords: ["trip", "vehicle run", "train", "fahrt", "zuglauf", "intermediate stops"],
    queryParameters: ["tripId", "withScheduledSkippedStops", "detailedLegs", "joinInterlinedLegs", "language"],
    requiredQueryParameters: ["tripId"],
  },
  {
    id: "refresh_itinerary_get",
    method: "GET",
    path: "/api/v6/refresh-itinerary",
    summary: "Reconstruct and refresh an itinerary from its opaque itinerary ID.",
    keywords: ["refresh", "itinerary", "realtime", "journey", "aktualisieren"],
    queryParameters: refreshParameters,
    requiredQueryParameters: ["itineraryId"],
    resourceIntensive: true,
  },
  {
    id: "refresh_itinerary_post",
    method: "POST",
    path: "/api/v6/refresh-itinerary",
    summary: "Reconstruct and refresh an itinerary from its protobuf-JSON identifier.",
    keywords: ["refresh", "itinerary", "realtime", "journey", "json"],
    queryParameters: [],
    requiredQueryParameters: [],
    bodyProperties: refreshBodyProperties,
    requiredBodyProperties: ["id"],
    resourceIntensive: true,
  },
  {
    id: "stoptimes",
    method: "GET",
    path: "/api/v6/stoptimes",
    summary: "Get upcoming departures or arrivals for a stop or an area around coordinates.",
    keywords: ["departures", "arrivals", "station board", "abfahrt", "ankunft", "haltestelle"],
    queryParameters: [
      "stopId", "center", "time", "arriveBy", "direction", "window", "mode", "n", "radius",
      "exactRadius", "fetchStops", "pageCursor", "withScheduledSkippedStops", "language", "withAlerts",
    ],
    requiredQueryParameters: [],
  },
  {
    id: "map_trips",
    method: "GET",
    path: "/api/v6/map/trips",
    summary: "Get public-transport trips and vehicle positions for a map viewport and time range.",
    keywords: ["map", "trips", "vehicles", "positions", "karte", "fahrzeuge"],
    queryParameters: ["zoom", "min", "max", "startTime", "endTime", "precision", "language"],
    requiredQueryParameters: ["zoom", "min", "max", "startTime", "endTime"],
    resourceIntensive: true,
  },
  {
    id: "map_initial",
    method: "GET",
    path: "/api/v1/map/initial",
    summary: "Get Transitous' suggested initial map location.",
    keywords: ["map", "initial", "viewport", "karte", "start"],
    queryParameters: [],
    requiredQueryParameters: [],
  },
  {
    id: "map_stops",
    method: "GET",
    path: "/api/v6/map/stops",
    summary: "Get stops within a map bounding box.",
    keywords: ["map", "stops", "stations", "bbox", "karte", "haltestellen"],
    queryParameters: ["min", "max", "grouped", "modes", "language"],
    requiredQueryParameters: ["min", "max"],
  },
  {
    id: "map_levels",
    method: "GET",
    path: "/api/v1/map/levels",
    summary: "Get available OSM levels within a map bounding box.",
    keywords: ["map", "levels", "floors", "osm", "karte", "ebenen"],
    queryParameters: ["min", "max"],
    requiredQueryParameters: ["min", "max"],
  },
  {
    id: "map_routes_experimental",
    method: "GET",
    path: "/api/experimental/map/routes",
    summary: "Get experimental route shapes and stops within a map bounding box.",
    keywords: ["map", "routes", "shapes", "polyline", "linien", "karte"],
    queryParameters: ["zoom", "min", "max", "language"],
    requiredQueryParameters: ["zoom", "min", "max"],
    experimental: true,
    resourceIntensive: true,
  },
  {
    id: "map_route_details_experimental",
    method: "GET",
    path: "/api/experimental/map/route-details",
    summary: "Get full experimental details, stops, and shapes for one internal route index.",
    keywords: ["map", "route details", "shapes", "stops", "linie", "details"],
    queryParameters: ["routeIdx", "language"],
    requiredQueryParameters: ["routeIdx"],
    experimental: true,
  },
  {
    id: "rentals",
    method: "GET",
    path: "/api/v1/rentals",
    summary: "Get rental providers, stations, vehicles, and geofencing zones.",
    keywords: ["rental", "bike share", "car share", "vehicles", "leihfahrzeug", "sharing"],
    queryParameters: [
      "min", "max", "point", "radius", "providerGroups", "providers", "withProviders",
      "withStations", "withVehicles", "withZones",
    ],
    requiredQueryParameters: [],
  },
  {
    id: "health",
    method: "GET",
    path: "/api/v1/health",
    summary: "Get Transitous feed-update health information.",
    keywords: ["health", "status", "feeds", "updates", "zustand"],
    queryParameters: [],
    requiredQueryParameters: [],
  },
  {
    id: "debug_transfers",
    method: "GET",
    path: "/api/debug/transfers",
    summary: "Inspect all computed transfers for a timetable location.",
    keywords: ["debug", "transfers", "walk", "wheelchair", "car", "umstieg"],
    queryParameters: ["id"],
    requiredQueryParameters: ["id"],
  },
] as const;

export function getApiAction(actionId: string): ApiAction | undefined {
  return API_ACTIONS.find((action) => action.id === actionId);
}

export function searchApiActions(query: string, limit: number): ApiAction[] {
  const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return API_ACTIONS.slice(0, limit);

  return API_ACTIONS.map((action) => {
    const id = action.id.toLocaleLowerCase();
    const summary = action.summary.toLocaleLowerCase();
    const haystack = `${id} ${action.method.toLocaleLowerCase()} ${action.path.toLocaleLowerCase()} ${summary} ${action.keywords.join(" ").toLocaleLowerCase()}`;
    const score = terms.reduce((total, term) => {
      if (id === term) return total + 10;
      if (id.includes(term)) return total + 6;
      if (summary.includes(term)) return total + 4;
      return haystack.includes(term) ? total + 2 : total;
    }, 0);
    return { action, score };
  })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.action.id.localeCompare(b.action.id))
    .slice(0, limit)
    .map(({ action }) => action);
}

export function actionForTool(action: ApiAction) {
  return {
    actionId: action.id,
    method: action.method,
    path: action.path,
    summary: action.summary,
    requiredQueryParameters: action.requiredQueryParameters,
    acceptedQueryParameters: action.queryParameters,
    requiredBodyProperties: action.requiredBodyProperties ?? [],
    acceptedBodyProperties: action.bodyProperties ?? [],
    experimental: action.experimental ?? false,
    resourceIntensive: action.resourceIntensive ?? false,
    parameterDocumentation: MOTIS_OPENAPI_URL,
  };
}
