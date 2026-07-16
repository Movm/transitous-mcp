import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { TransitousClient, TRANSIT_MODES } from "./client.js";
import { TRANSITOUS_POLICY } from "./policy.js";

const isoDateTime = z
  .string()
  .datetime({ offset: true })
  .describe("ISO 8601 timestamp with UTC offset, for example 2026-07-16T09:30:00+02:00");
const language = z.string().min(2).max(12).default("de").describe("Language tag such as de, en, or fr");

function toolResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

async function safeCall(operation: () => Promise<unknown>) {
  try {
    return toolResult(await operation());
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text:
            (error instanceof Error ? error.message : "Unknown Transitous API error") +
            `\nUsage policy: ${TRANSITOUS_POLICY.usagePolicyUrl}`,
        },
      ],
    };
  }
}

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export function createMcpServer(client = new TransitousClient()): McpServer {
  const server = new McpServer(
    { name: "transitous-mcp", version: "0.1.0" },
    {
      instructions:
        "Search public transport using Transitous. Resolve ambiguous places with search_locations first. " +
        `Always preserve Transitous attribution and usage-policy notices from tool results. ${TRANSITOUS_POLICY.notice}`,
    },
  );

  server.registerTool(
    "search_locations",
    {
      title: "Search public transport stops",
      description:
        "Find Transitous stop IDs and coordinates for a station or stop name. Read-only. " +
        `Usage warning: ${TRANSITOUS_POLICY.notice} Policy: ${TRANSITOUS_POLICY.usagePolicyUrl}`,
      inputSchema: {
        query: z.string().min(2).max(200).describe("Station or stop name, optionally including city or country"),
        language,
        limit: z.number().int().min(1).max(10).default(5).describe("Maximum number of matches"),
      },
      annotations,
    },
    async (input, extra) => safeCall(() => client.searchLocations(input, extra.signal)),
  );

  server.registerTool(
    "search_connections",
    {
      title: "Search A to B public transport connections",
      description:
        "Plan public transport journeys between two station names using Transitous/MOTIS. Returns legs, transfers, " +
        "times, available realtime status, tracks, and accessibility fields. It does not sell tickets or guarantee accuracy. " +
        `Usage warning: ${TRANSITOUS_POLICY.notice} Policy: ${TRANSITOUS_POLICY.usagePolicyUrl}`,
      inputSchema: {
        from: z.string().min(2).max(200).describe("Origin station or stop, preferably with city/country"),
        to: z.string().min(2).max(200).describe("Destination station or stop, preferably with city/country"),
        time: isoDateTime.optional().describe("Departure time, or arrival deadline when arriveBy is true; defaults to now"),
        arriveBy: z.boolean().default(false).describe("Treat time as the latest desired arrival instead of departure"),
        language,
        limit: z.number().int().min(1).max(5).default(3).describe("Maximum number of itineraries returned"),
        maxTransfers: z.number().int().min(0).max(12).optional().describe("Optional maximum number of transfers"),
        transitModes: z
          .array(z.enum(TRANSIT_MODES))
          .min(1)
          .optional()
          .describe("Allowed transit modes; omit to allow all public transport"),
        wheelchair: z.boolean().default(false).describe("Use wheelchair pedestrian routing for transfers"),
        requireBikeTransport: z
          .boolean()
          .default(false)
          .describe("Only use transit legs that permit bicycle transport when the feed provides this information"),
      },
      annotations,
    },
    async (input, extra) => safeCall(() => client.searchConnections(input, extra.signal)),
  );

  return server;
}
