# Security

For an internet-facing deployment, set a long random `MCP_API_KEY` and use HTTPS.
The server accepts the key as `Authorization: Bearer <key>` or `X-API-Key`.

`MCP_ALLOWED_ORIGINS` is only defense-in-depth. An Origin header can be absent or
spoofed by non-browser clients, so domain filtering is not a replacement for a
secret or OAuth. This initial version supports a static bearer token; OAuth is
not implemented yet.

Never commit `.env` files or access tokens. Rotate the key if it is exposed.
