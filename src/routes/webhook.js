'use strict'

const { verifySignature } = require('../plugins/hmac')
const { enqueue } = require('../queue')

/**
 * Per-provider configuration (loaded from environment variables).
 *
 * Add a new provider by:
 *   1. Setting WEBHOOK_SECRET_<PROVIDER> in your environment.
 *   2. Optionally setting WEBHOOK_HEADER_<PROVIDER> (defaults to X-Hub-Signature-256).
 *   3. Optionally setting WEBHOOK_MODE_<PROVIDER> to "queue" (defaults to "immediate").
 */
function getProviderConfig (provider) {
  const key = provider.toUpperCase().replace(/-/g, '_')
  const secret = process.env[`WEBHOOK_SECRET_${key}`]
  const header = process.env[`WEBHOOK_HEADER_${key}`] || 'x-hub-signature-256'
  const mode = process.env[`WEBHOOK_MODE_${key}`] || 'immediate'
  return { secret, header: header.toLowerCase(), mode }
}

/**
 * Default immediate handler – override in application code.
 * Logs the event; replace with real business logic.
 */
async function handleImmediate (request, provider, body) {
  request.log.info({ provider, body }, 'webhook received (immediate)')
}

/**
 * @param {import('fastify').FastifyInstance} fastify
 */
async function webhookRoutes (fastify) {
  /**
   * POST /webhooks/:provider
   *
   * Receives a webhook payload, verifies the HMAC signature, then either
   * processes it immediately or enqueues it for background processing.
   *
   * Query param:  ?mode=queue   override per-request (optional)
   */
  fastify.post('/webhooks/:provider', {
    config: { rawBody: true }
  }, async (request, reply) => {
    const { provider } = request.params
    const { secret, header, mode } = getProviderConfig(provider)

    if (!secret) {
      request.log.warn({ provider }, 'no HMAC secret configured for provider')
      return reply.code(400).send({ error: 'Unknown provider' })
    }

    const rawBody = request.rawBody
    const signature = request.headers[header]

    const valid = verifySignature({ secret, payload: rawBody, signature })
    if (!valid) {
      request.log.warn({ provider, header }, 'HMAC signature verification failed')
      return reply.code(401).send({ error: 'Invalid signature' })
    }

    const effectiveMode = request.query.mode || mode

    if (effectiveMode === 'queue') {
      await enqueue({
        provider,
        headers: request.headers,
        body: request.body,
        receivedAt: new Date().toISOString()
      })
      return reply.code(202).send({ status: 'queued' })
    }

    await handleImmediate(request, provider, request.body)
    return reply.code(200).send({ status: 'ok' })
  })
}

module.exports = webhookRoutes
