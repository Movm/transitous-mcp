# Contributing

Thanks for improving Transitous MCP. Please keep changes small, documented, and
respectful of the volunteer-operated Transitous service.

## Setup

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm check
pnpm test
pnpm build
```

Use a descriptive `TRANSITOUS_USER_AGENT` for live API tests. Unit tests must use
mocks unless a live request is explicitly necessary. Never add load tests against
the public Transitous instance.

## Pull requests

- Add or update tests for behavior changes.
- Keep every MCP tool annotated and its input schema bounded.
- Update the action catalog when the pinned MOTIS OpenAPI surface changes.
- Preserve usage-policy and data-source attribution.
- Run `pnpm check`, `pnpm test`, `pnpm build`, and `docker build .`.
- Do not commit `.env`, API keys, bearer tokens, or generated output.

Report vulnerabilities through a private GitHub security advisory rather than a
public issue.
