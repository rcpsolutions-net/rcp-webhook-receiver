# rcp-webhook-receiver — AI Agent Context

Load [CLAUDE.md](./CLAUDE.md) for constraints and architecture before making changes.

## Quick reference

| Path | Role |
|---|---|
| `src/server.ts` | Fastify app factory |
| `src/routes/webhook.ts` | Main inbound webhook handler |
| `src/plugins/botTrap.ts` | Rejects probe requests |
| `src/models/incomingWebhooks.ts` | MongoDB model for received payloads |

## Related services

| Service | Role |
|---|---|
| `rcp-gs-sync` | Consumes `incoming_webhooks` via change stream; owns sync logic and GreenShades patterns |

## Commands

```bash
npm run build   # tsc compile
npm run dev     # ts-node-dev watch mode
npm start       # node dist/src/server.js
```
