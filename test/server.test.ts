import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TransitousClient } from "../src/client.js";
import { createMcpServer } from "../src/server.js";

const openClients: Client[] = [];
const openServers: ReturnType<typeof createMcpServer>[] = [];

afterEach(async () => {
  await Promise.all(openClients.splice(0).map((client) => client.close()));
  await Promise.all(openServers.splice(0).map((server) => server.close()));
});

describe("Transitous MCP server", () => {
  it("handshakes and exposes two annotated read-only tools with policy warnings", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer();
    const client = new Client({ name: "test-client", version: "1.0.0" });
    openServers.push(server);
    openClients.push(client);
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      "search_locations",
      "search_connections",
      "search_api_actions",
      "execute_api_action",
    ]);
    expect(tools.every((tool) => Boolean(tool.title))).toBe(true);
    expect(tools.every((tool) => tool.description?.includes("Usage warning"))).toBe(true);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
    expect(tools.every((tool) => tool.annotations?.destructiveHint === false)).toBe(true);
    expect(tools.every((tool) => tool.annotations?.openWorldHint === true)).toBe(true);
  });

  it("returns policy information in successful tool output", async () => {
    const transitous = new TransitousClient({ userAgent: "test/1.0 (mailto:test@example.com)" });
    vi.spyOn(transitous, "searchLocations").mockResolvedValue({
      locations: [],
      attribution: { usagePolicyUrl: "https://transitous.org/api/" },
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer(transitous);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    openServers.push(server);
    openClients.push(client);
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({ name: "search_locations", arguments: { query: "Berlin" } });
    expect(result.isError).not.toBe(true);
    expect(JSON.stringify(result.content)).toContain("https://transitous.org/api/");
  });

  it("discovers the full API catalog through MCP", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createMcpServer();
    const client = new Client({ name: "test-client", version: "1.0.0" });
    openServers.push(server);
    openClients.push(client);
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const result = await client.callTool({
      name: "search_api_actions",
      arguments: { query: "Abfahrten Haltestelle", limit: 5 },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const value = JSON.parse(text);
    expect(value.totalAvailableActions).toBe(21);
    expect(value.actions.map((action: { actionId: string }) => action.actionId)).toContain("stoptimes");
    expect(value.attribution.usagePolicyUrl).toBe("https://transitous.org/api/");
  });
});
