# Transitous MCP Server

[![CI](https://github.com/Movm/transitous-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Movm/transitous-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)

A self-hostable Model Context Protocol server covering the complete public
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
minutes and routing/generic API responses for 60 seconds, and limits uncached
upstream calls to 20 per minute by default. Resource-intensive actions require
an explicit policy acknowledgement. These protections do not grant permission
beyond the Transitous policy or the individual data-source licences.

Transitous and its feeds may be incomplete, delayed, or incorrect. Do not rely
on results as the sole source for critical travel decisions; verify important
journeys with the relevant operator.

## Tools

- `search_locations` — resolve station/stop names to Transitous stop IDs.
- `search_connections` — find A-to-B journeys with legs, transfers, available
  realtime status, delays, tracks, wheelchair routing, and bicycle requirements.
- `search_api_actions` — search or list the complete allowlisted API catalog and
  its accepted query/body fields.
- `execute_api_action` — execute any operation from that catalog, including
  computational POST endpoints. Arbitrary URLs are not accepted.

All tools are read-only from the user's perspective. The upstream POST endpoints
perform routing computations; they do not create or mutate Transitous data.
Reservations and ticket sales are not part of the upstream API. The generic
`plan` action can request experimental fare data with `withFares=true` when the
underlying feeds provide it.

### Complete API coverage

The catalog covers all 21 GET/POST operations in the pinned MOTIS 2.10.2 OpenAPI
surface used by this release:

| Area | Actions |
| --- | --- |
| Journey routing | `plan`, `refresh_itinerary_get`, `refresh_itinerary_post` |
| Reachability | `one_to_many_get`, `one_to_many_post`, `one_to_many_intermodal_get`, `one_to_many_intermodal_post`, `one_to_all` |
| Places | `geocode`, `reverse_geocode` |
| Timetable | `trip`, `stoptimes` |
| Map | `map_initial`, `map_trips`, `map_stops`, `map_levels`, `map_routes_experimental`, `map_route_details_experimental` |
| Rentals | `rentals` |
| Operations/debug | `health`, `debug_transfers` |

The exact accepted parameters are returned by `search_api_actions` and validated
before any upstream request. Parameter semantics follow the
[MOTIS OpenAPI document](https://github.com/motis-project/motis/blob/v2.10.2/openapi.yaml).
Experimental endpoints are clearly marked and may change upstream.

Large map and routing responses are limited to 250 kB by default and report when
they were truncated. `maxResponseBytes` can be raised to 1 MB, but narrowing the
geographic/time query is preferred. Actions marked `resourceIntensive` only run
with `acknowledgeHeavyRequest=true` after reviewing the Transitous policy.

Example generic action input for departures:

```json
{
  "actionId": "stoptimes",
  "query": {
    "stopId": "STOP_ID_FROM_SEARCH_LOCATIONS",
    "n": 10,
    "language": ["de"],
    "withAlerts": true
  }
}
```

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

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, test
expectations, and pull-request checklist. Security issues belong in a private
[GitHub security advisory](https://github.com/Movm/transitous-mcp/security/advisories/new),
not a public issue.

## License

The MCP server code is MIT licensed. Transit data is provided by separate
sources with their own licences and attribution requirements. The MIT licence
does not apply to, replace, or override those data-source terms.
