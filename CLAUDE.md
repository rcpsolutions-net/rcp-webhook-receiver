# rcp-webhook-receiver — AI Agent Context

Read this file before making any changes to this codebase.

---

## What this service does

Fastify-based HTTP service that receives inbound webhooks from GreenShades (and other third parties), validates them, and saves them to MongoDB's `incoming_webhooks` collection. It is the entry point for all GreenShades event data — `rcp-gs-sync` picks up from there via change stream.

**Tech stack:** Node.js · TypeScript · Fastify · MongoDB/Mongoose · `@fastify/rate-limit`

---

## RCP System Context

- **RCP has 80,000+ employees (associates).** High-volume pay runs can trigger hundreds of webhook payloads in short bursts.
- **GreenShades** is RCP's payroll system. This service is the inbound gateway; all downstream sync logic lives in `rcp-gs-sync` (see `rcp-gs-sync/CLAUDE.md` for established patterns).
- **Never use `forEach` with async callbacks** — `forEach` does not await, so errors are silently swallowed. Use `await Promise.allSettled(array.map(async () => ...))` instead.

---

## Project Structure

```
src/
  server.ts        # Fastify app factory (registers plugins, routes)
  routes/
    webhook.ts     # POST /webhook — validates + saves to incoming_webhooks
  plugins/
    botTrap.ts     # Rejects non-webhook probes
    mongoose.ts    # MongoDB connection plugin
  models/
    incomingWebhooks.ts
  types/           # TypeScript type extensions (rawBody on FastifyRequest)
```

---

## Key Constraints

- **Idempotency:** Webhooks may be replayed by GreenShades. The `incoming_webhooks` schema should handle duplicate payloads gracefully.
- **Rate limiting:** `@fastify/rate-limit` is configured via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW` env vars. Do not remove it.
- **Raw body preservation:** The content-type parser saves `request.rawBody` as a Buffer for signature verification. Do not refactor this away.
- **Bot trap:** The `botTrap` plugin is intentional — do not remove it.

---

## What NOT to do

- Do not add synchronous per-employee processing in the webhook handler — this service only receives and stores. Heavy work belongs in `rcp-gs-sync`.
- Do not remove the raw body parser — it is needed for HMAC signature verification.
- Do not disable rate limiting.
