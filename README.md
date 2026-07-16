# Transitous MCP Server

A small, self-hostable Model Context Protocol server for public-transport stop
search and real A-to-B journey planning through the
[Transitous](https://transitous.org/) MOTIS API. It works over Streamable HTTP
for ChatGPT, Claude, Grünerator, and other MCP clients, or locally over stdio.

## Important: Transitous usage policy

Before deploying this server, read the [Transitous API usage policy](https://transitous.org/api/).

> [!WARNING]
> **Nutzungsrichtlinie:** Die öffentliche Transitous-API wird ehrenamtlich und
> nach Best-Effort betrieben. Sie ist für freie/Open-Source-Anwendungen und
> gemeinnützige Aktivitäten gedacht, nicht standardmäßig für kommerzielle
> Nutzung. Vor vielen oder rechenintensiven Anfragen muss Transitous kontaktiert
> werden. Jede Anfrage braucht einen User-Agent mit App-Name, Version und
> Kontaktmöglichkeit. Quellenangaben und deren Lizenzen müssen sichtbar bleiben.

Transitous is a volunteer-run, best-effort service intended for free/open-source
and non-profit use. You must:

- send a meaningful User-Agent containing the application name, version, and contact;
- cache results and avoid unnecessary or resource-intensive requests;
- contact Transitous before heavy, unusual, or commercial use;
- visibly link to [Transitous data sources](https://transitous.org/sources/) and
  preserve source-specific attribution, including
  [OpenStreetMap attribution](https://www.openstreetmap.org/copyright).

This server enforces a descriptive User-Agent, caches stop searches for 15
minutes and connections for 60 seconds, and limits uncached upstream calls to 20
per minute by default. These protections do not grant permission beyond the
Transitous policy or the individual data-source licences.

Transitous and its feeds may be incomplete, delayed, or incorrect. Do not rely
on results as the sole source for critical travel decisions; verify important
journeys with the relevant operator.

## Tools

- `search_locations` — resolve station/stop names to Transitous stop IDs.
- `search_connections` — find A-to-B journeys with legs, transfers, available
  realtime status, delays, tracks, wheelchair routing, and bicycle requirements.

Both tools are read-only. Fares, reservations, and ticket sales are not included.

## Run locally

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
cp .env.example .env
pnpm build
TRANSITOUS_USER_AGENT='my-app/1.0.0 (mailto:me@example.com)' pnpm start
```

The default transport is stdio. Configure your local MCP client to run:

```json
{
  "mcpServers": {
    "transitous": {
      "command": "node",
      "args": ["/absolute/path/to/transitous-mcp/dist/index.js"],
      "env": {
        "TRANSITOUS_USER_AGENT": "my-app/1.0.0 (mailto:me@example.com)"
      }
    }
  }
}
```

## Remote HTTP / Coolify

Deploy the repository with its `Dockerfile`, expose port `3000`, and set:

```env
MCP_TRANSPORT=http
PORT=3000
TRANSITOUS_USER_AGENT=your-app/1.0.0 (https://your.example/contact; mailto:you@example.com)
MCP_API_KEY=generate-a-long-random-secret
MCP_ALLOWED_ORIGINS=https://chatgpt.com,https://claude.ai
```

Endpoints:

- MCP: `https://your-domain.example/mcp`
- Health: `https://your-domain.example/health`

Send the private key using either header:

```http
Authorization: Bearer YOUR_SECRET
```

or:

```http
X-API-Key: YOUR_SECRET
```

Domain/Origin filtering alone is not authentication. For a public internet
deployment, use HTTPS and set `MCP_API_KEY`. This version supports a static
Bearer token; OAuth can be added later for per-user authorization.

## Configuration

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `TRANSITOUS_USER_AGENT` | For tool calls | none | App name/version/contact required by Transitous |
| `MCP_TRANSPORT` | No | `stdio` | Set `http` for remote deployment |
| `PORT` | No | `3000` | HTTP port |
| `MCP_API_KEY` | Recommended for HTTP | none | Protects the MCP endpoint |
| `MCP_ALLOWED_ORIGINS` | No | any | Comma-separated browser origins |
| `TRANSITOUS_BASE_URL` | No | `https://api.transitous.org` | Upstream base URL |
| `TRANSITOUS_REQUESTS_PER_MINUTE` | No | `20` | Per-process uncached upstream safety limit |
| `MCP_REQUESTS_PER_MINUTE` | No | `60` | Per-IP inbound HTTP limit |

## Development

```bash
pnpm check
pnpm test
pnpm build
```

## License

The MCP server code is MIT licensed. Transit data is provided by separate
sources with their own licences and attribution requirements. The MIT licence
does not apply to, replace, or override those data-source terms.
