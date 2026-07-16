import { timingSafeEqual } from "node:crypto";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type Express, type Request } from "express";

import { TRANSITOUS_POLICY } from "./policy.js";
import { createMcpServer } from "./server.js";

function splitList(value: string | undefined): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

function allowedOrigin(origin: string | undefined): boolean {
  const allowed = splitList(process.env.MCP_ALLOWED_ORIGINS);
  return !origin || allowed.length === 0 || allowed.includes(origin);
}

function safeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function authenticated(request: Request): boolean {
  const expected = process.env.MCP_API_KEY;
  if (!expected) return true;
  const authorization = request.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const apiKey = request.get("x-api-key") ?? "";
  return safeEqual(bearer, expected) || safeEqual(apiKey, expected);
}

export function createHttpApp(): Express {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));

  const requestCounts = new Map<string, { count: number; resetAt: number }>();
  const requestsPerMinute = Number.parseInt(process.env.MCP_REQUESTS_PER_MINUTE ?? "60", 10);

  app.get("/health", (_request, response) => {
    response.json({
      status: "ok",
      service: "transitous-mcp",
      authentication: process.env.MCP_API_KEY ? "bearer-token" : "disabled",
      usagePolicy: TRANSITOUS_POLICY.usagePolicyUrl,
    });
  });

  app.options("/mcp", (request, response) => {
    const origin = request.get("origin");
    if (!allowedOrigin(origin)) return response.status(403).json({ error: "Origin not allowed" });
    if (origin) response.set("Access-Control-Allow-Origin", origin).set("Vary", "Origin");
    return response
      .set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, MCP-Protocol-Version")
      .set("Access-Control-Allow-Methods", "POST, OPTIONS")
      .status(204)
      .end();
  });

  app.post("/mcp", async (request, response) => {
    const origin = request.get("origin");
    if (!allowedOrigin(origin)) {
      response.status(403).json({ error: "Origin not allowed" });
      return;
    }
    if (!authenticated(request)) {
      response.set("WWW-Authenticate", "Bearer").status(401).json({ error: "Unauthorized" });
      return;
    }

    const now = Date.now();
    const key = request.ip ?? "unknown";
    const current = requestCounts.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + 60_000 } : current;
    bucket.count += 1;
    requestCounts.set(key, bucket);
    if (bucket.count > requestsPerMinute) {
      response.set("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000))).status(429).json({ error: "Too many requests" });
      return;
    }
    if (origin) response.set("Access-Control-Allow-Origin", origin).set("Vary", "Origin");

    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    response.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } catch (error) {
      if (!response.headersSent) {
        response.status(500).json({ error: error instanceof Error ? error.message : "MCP request failed" });
      }
    }
  });

  app.get("/mcp", (_request, response) => response.status(405).set("Allow", "POST, OPTIONS").end());
  app.delete("/mcp", (_request, response) => response.status(405).set("Allow", "POST, OPTIONS").end());

  return app;
}
