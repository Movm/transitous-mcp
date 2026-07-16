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
    expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({ "User-Agent": USER_AGENT });
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
});
