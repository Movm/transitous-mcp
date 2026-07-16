import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  actionForTool,
  API_ACTIONS,
  MOTIS_OPENAPI_URL,
  searchApiActions,
  TRANSITOUS_API_DOCS_URL,
} from "./actions.js";
import { TransitousApiError, TransitousClient, TRANSIT_MODES } from "./client.js";
import { TRANSITOUS_POLICY } from "./policy.js";

const isoDateTime = z
  .string()
  .datetime({ offset: true })
  .describe("ISO 8601 timestamp with UTC offset, for example 2026-07-16T09:30:00+02:00");
const language = z.string().min(2).max(12).default("de").describe("Language tag such as de, en, or fr");
const apiQueryValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number(), z.boolean()])).max(500),
]);

function toolResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

async function safeCall(operation: () => Promise<unknown>) {
  try {
    return toolResult(await operation());
  } catch (error) {
    const message = error instanceof TransitousApiError
      ? `${error.message}. Upstream response: ${JSON.stringify(error.responseBody).slice(0, 2_000)}`
      : error instanceof Error
        ? error.message
        : "Unknown Transitous API error";
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: message + `\nUsage policy: ${TRANSITOUS_POLICY.usagePolicyUrl}`,
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
    { name: "transitous-mcp", version: "0.2.0" },
    {
      instructions:
        "Search public transport using Transitous. The common station and journey searches have dedicated tools. " +
        "For every other Transitous/MOTIS capability, discover the exact action and accepted parameters with " +
        "search_api_actions, then call execute_api_action. Resolve ambiguous places with search_locations first. " +
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

  server.registerTool(
    "search_api_actions",
    {
      title: "Discover Transitous API actions",
      description:
        "Search or list the complete allowlisted Transitous/MOTIS API action catalog. Returns action IDs, methods, " +
        "paths, accepted query/body fields, and resource-intensity flags for use with execute_api_action. Read-only. " +
        `API documentation: ${TRANSITOUS_API_DOCS_URL} OpenAPI: ${MOTIS_OPENAPI_URL} ` +
        `Usage warning: ${TRANSITOUS_POLICY.notice}`,
      inputSchema: {
        query: z
          .string()
          .max(200)
          .default("")
          .describe("Natural-language capability search; use an empty string to list the catalog"),
        limit: z.number().int().min(1).max(API_ACTIONS.length).default(10).describe("Maximum matching actions"),
      },
      annotations,
    },
    async ({ query, limit }) =>
      safeCall(async () => ({
        query,
        totalAvailableActions: API_ACTIONS.length,
        actions: searchApiActions(query, limit).map(actionForTool),
        ...{ attribution: TRANSITOUS_POLICY },
      })),
  );

  server.registerTool(
    "execute_api_action",
    {
      title: "Execute a Transitous API action",
      description:
        "Execute one read-only operation from the allowlisted Transitous/MOTIS action catalog. Supports every " +
        "documented GET and computational POST operation; arbitrary URLs and undocumented parameters are rejected. " +
        "Use search_api_actions to obtain the action ID and parameter fields. Large responses may be truncated. " +
        `API documentation: ${TRANSITOUS_API_DOCS_URL} OpenAPI: ${MOTIS_OPENAPI_URL} ` +
        `Usage warning: ${TRANSITOUS_POLICY.notice}`,
      inputSchema: {
        actionId: z.string().min(1).max(64).describe("Allowlisted action ID returned by search_api_actions"),
        query: z
          .record(z.string(), apiQueryValue)
          .optional()
          .describe("Documented query parameters; arrays are encoded as comma-separated values"),
        body: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("JSON object for POST actions; omit for GET actions"),
        acknowledgeHeavyRequest: z
          .boolean()
          .default(false)
          .describe("Required for actions marked resourceIntensive after reviewing the Transitous usage policy"),
        maxResponseBytes: z
          .number()
          .int()
          .min(1_000)
          .max(1_000_000)
          .default(250_000)
          .describe("Maximum response bytes returned through MCP; narrow large map queries when possible"),
      },
      annotations,
    },
    async (input, extra) => safeCall(() => client.executeApiAction(input, extra.signal)),
  );

  return server;
}
