import { describe, expect, it } from "vitest";

import { API_ACTIONS, getApiAction, searchApiActions } from "../src/actions.js";

describe("Transitous API action catalog", () => {
  it("covers all 21 operations in the pinned MOTIS OpenAPI surface", () => {
    expect(API_ACTIONS).toHaveLength(21);
    expect(new Set(API_ACTIONS.map((action) => action.id)).size).toBe(21);
    expect(new Set(API_ACTIONS.map((action) => `${action.method} ${action.path}`)).size).toBe(21);
    expect(API_ACTIONS.filter((action) => action.method === "POST")).toHaveLength(3);
  });

  it("contains stable, experimental, health, rental, map, and debug operations", () => {
    expect(getApiAction("plan")?.path).toBe("/api/v6/plan");
    expect(getApiAction("one_to_many_intermodal_post")?.experimental).toBe(true);
    expect(getApiAction("rentals")?.path).toBe("/api/v1/rentals");
    expect(getApiAction("map_trips")?.path).toBe("/api/v6/map/trips");
    expect(getApiAction("health")?.path).toBe("/api/v1/health");
    expect(getApiAction("debug_transfers")?.path).toBe("/api/debug/transfers");
  });

  it("searches the catalog in English and German", () => {
    expect(searchApiActions("bike sharing vehicles", 5).map((action) => action.id)).toContain("rentals");
    expect(searchApiActions("Abfahrten Haltestelle", 5).map((action) => action.id)).toContain("stoptimes");
    expect(searchApiActions("", 21)).toHaveLength(21);
  });
});
