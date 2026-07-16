import { describe, expect, it, vi } from "vitest";

import { TransitousApiError, TransitousClient } from "../src/client.js";

const USER_AGENT = "transitous-mcp-test/1.0.0 (mailto:test@example.com)";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("TransitousClient", () => {
  it("searches and caches stop locations with the required User-Agent", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([
      { type: "STOP", name: "Berlin Hbf", id: "de:11000:900003201", lat: 52.525, lon: 13.369, modes: ["RAIL"] },
    ]));
    const client = new TransitousClient({ baseUrl: "https://example.test", fetchImpl, userAgent: USER_AGENT });

    const first = await client.searchLocations({ query: "Berlin Hbf", language: "de", limit: 5 });
    const second = await client.searchLocations({ query: "Berlin Hbf", language: "de", limit: 5 });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][0]).toContain("/api/v1/geocode?text=Berlin+Hbf&type=STOP");
    expect(new Headers(fetchImpl.mock.calls[0][1]?.headers).get("User-Agent")).toBe(USER_AGENT);
    expect(first).toMatchObject({ count: 1, cache: "miss", attribution: { service: "Transitous" } });
    expect(second).toMatchObject({ count: 1, cache: "hit" });
  });

  it("resolves stops and normalizes a complex connection", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([{ type: "STOP", name: "Berlin Hbf", id: "origin", lat: 52.5, lon: 13.3 }]))
      .mockResolvedValueOnce(jsonResponse([{ type: "STOP", name: "München Hbf", id: "destination", lat: 48.1, lon: 11.5 }]))
      .mockResolvedValueOnce(jsonResponse({
        itineraries: [{
          id: "route-1", duration: 14400, startTime: "2026-07-16T08:00:00+02:00",
          endTime: "2026-07-16T12:00:00+02:00", transfers: 1,
          legs: [{
            mode: "HIGHSPEED_RAIL", displayName: "ICE 100", agencyName: "DB Fernverkehr AG",
            from: { name: "Berlin Hbf", track: "1" }, to: { name: "München Hbf", track: "22" },
            startTime: "2026-07-16T08:05:00+02:00", scheduledStartTime: "2026-07-16T08:00:00+02:00",
            endTime: "2026-07-16T12:00:00+02:00", scheduledEndTime: "2026-07-16T11:58:00+02:00", realTime: true,
          }],
        }],
      }));
    const client = new TransitousClient({ baseUrl: "https://example.test", fetchImpl, userAgent: USER_AGENT });

    const result = await client.searchConnections({ from: "Berlin", to: "München", limit: 3 }) as any;

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[2][0]).toContain("/api/v6/plan?fromPlace=origin&toPlace=destination");
    expect(fetchImpl.mock.calls[2][0]).toContain("numItineraries=3&maxItineraries=3");
    expect(result.itineraries[0]).toMatchObject({ transfers: 1, hasRealtimeData: true });
    expect(result.itineraries[0].legs[0]).toMatchObject({ service: "ICE 100", departureDelaySeconds: 300, arrivalDelaySeconds: 120 });
    expect(result.attribution.usagePolicyUrl).toBe("https://transitous.org/api/");
  });

  it("rejects a User-Agent without version and contact", async () => {
    const client = new TransitousClient({ userAgent: "my-app" });
    await expect(client.searchLocations({ query: "Berlin" })).rejects.toThrow("application name, version, and contact");
  });

  it("preserves upstream status and response body", async () => {
    const client = new TransitousClient({
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: "busy" }, 503)),
      userAgent: USER_AGENT,
    });
    const error = await client.searchLocations({ query: "Berlin" }).catch((caught) => caught);
    expect(error).toBeInstanceOf(TransitousApiError);
    expect(error).toMatchObject({ status: 503, responseBody: { error: "busy" } });
  });

  it("executes an allowlisted GET action with encoded query parameters", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([{ id: "stop-1" }]));
    const client = new TransitousClient({ baseUrl: "https://example.test", fetchImpl, userAgent: USER_AGENT });

    const result = await client.executeApiAction({
      actionId: "geocode",
      query: { text: "Berlin Hbf", type: ["STOP", "ADDRESS"], numResults: 3 },
    }) as any;

    expect(fetchImpl.mock.calls[0][0]).toBe(
      "https://example.test/api/v1/geocode?text=Berlin+Hbf&type=STOP%2CADDRESS&numResults=3",
    );
    expect(fetchImpl.mock.calls[0][1]?.method).toBe("GET");
    expect(result).toMatchObject({
      action: { actionId: "geocode", method: "GET" },
      responseTruncated: false,
      data: [{ id: "stop-1" }],
      attribution: { service: "Transitous" },
    });
  });

  it("executes a computational POST action with its documented JSON body", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([{ duration: 120 }]));
    const client = new TransitousClient({ baseUrl: "https://example.test", fetchImpl, userAgent: USER_AGENT });
    const body = {
      one: "52.5;13.4",
      many: ["52.6;13.5"],
      mode: "WALK",
      max: 1800,
      maxMatchingDistance: 25,
      arriveBy: false,
    };

    await client.executeApiAction({
      actionId: "one_to_many_post",
      body,
      acknowledgeHeavyRequest: true,
    });

    expect(fetchImpl.mock.calls[0][0]).toBe("https://example.test/api/v1/one-to-many");
    expect(fetchImpl.mock.calls[0][1]?.method).toBe("POST");
    expect(fetchImpl.mock.calls[0][1]?.body).toBe(JSON.stringify(body));
    expect(new Headers(fetchImpl.mock.calls[0][1]?.headers).get("Content-Type")).toBe("application/json");
  });

  it("requires an explicit policy acknowledgement for resource-intensive actions", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const client = new TransitousClient({ fetchImpl, userAgent: USER_AGENT });
    await expect(
      client.executeApiAction({ actionId: "plan", query: { fromPlace: "a", toPlace: "b" } }),
    ).rejects.toThrow("acknowledgeHeavyRequest=true");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects undocumented parameters before contacting Transitous", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const client = new TransitousClient({ fetchImpl, userAgent: USER_AGENT });
    await expect(
      client.executeApiAction({ actionId: "health", query: { unexpected: true } }),
    ).rejects.toThrow("Unsupported query parameter");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("truncates oversized generic responses without returning an oversized MCP payload", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ value: "x".repeat(2_000) }));
    const client = new TransitousClient({ fetchImpl, userAgent: USER_AGENT });
    const result = await client.executeApiAction({ actionId: "health", maxResponseBytes: 1_000 }) as any;
    expect(result).toMatchObject({ responseTruncated: true, maxResponseBytes: 1_000 });
    expect(result.data).toBeUndefined();
    expect(result.dataPreview.length).toBeLessThanOrEqual(1_000);
    expect(result.responseBytes).toBeGreaterThan(1_000);
  });
});
