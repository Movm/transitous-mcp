#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createHttpApp } from "./http.js";
import { TRANSITOUS_POLICY } from "./policy.js";
import { createMcpServer } from "./server.js";

function logPolicyWarning(): void {
  console.error(`[transitous-mcp] IMPORTANT USAGE POLICY: ${TRANSITOUS_POLICY.notice}`);
  console.error(`[transitous-mcp] Policy: ${TRANSITOUS_POLICY.usagePolicyUrl}`);
  console.error(`[transitous-mcp] Data sources: ${TRANSITOUS_POLICY.sourcesUrl}`);
}

async function startStdio(): Promise<void> {
  logPolicyWarning();
  await createMcpServer().connect(new StdioServerTransport());
}

async function startHttp(): Promise<void> {
  logPolicyWarning();
  if (!process.env.TRANSITOUS_USER_AGENT) {
    console.error("[transitous-mcp] TRANSITOUS_USER_AGENT is missing; tool calls will fail until it is configured.");
  }
  if (!process.env.MCP_API_KEY) {
    console.error("[transitous-mcp] SECURITY WARNING: MCP_API_KEY is unset; /mcp is publicly accessible.");
  }
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  await new Promise<void>((resolve, reject) => {
    const httpServer = createHttpApp().listen(port, "0.0.0.0", () => {
      console.error(`[transitous-mcp] Listening on http://0.0.0.0:${port}/mcp`);
    });
    httpServer.once("error", reject);
    const shutdown = () => httpServer.close(() => resolve());
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
  });
}

if (process.env.MCP_TRANSPORT === "http") await startHttp();
else await startStdio();
