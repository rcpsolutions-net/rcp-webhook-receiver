'use strict'

const { verifySignature } = require('../plugins/hmac')
const { enqueue } = require('../queue')


function getProviderConfig (provider) {
  const key = provider.toUpperCase().replace(/-/g, '_');

  const secret = process.env[`WEBHOOK_SECRET_${key}`]
  const header = process.env[`WEBHOOK_HEADER_${key}`] || 'x-hub-signature-256'
  const mode = process.env[`WEBHOOK_MODE_${key}`] || 'immediate'

  return { secret, header: header.toLowerCase(), mode }
}


async function handleImmediate (request, provider, body) {
  request.log.info({ provider, body }, 'webhook received (immediate)')
}


async function webhookRoutes (fastify) {
  
  fastify.post('/3PS/incoming/webhook/:provider', {
    config: {
      rawBody: true,
      rateLimit: {
        max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
        timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10)
      }
    }
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
    else {
      console.log(rawBody.toString('utf8')); // Log the raw body for debugging
      console.log(`--- incoming webhook HMAC signature verification succeeded for provider: ${provider}`); // Log success
    }

    const effectiveMode = (request.query.mode === 'immediate' || request.query.mode === 'queue')
      ? request.query.mode
      : mode

    if (effectiveMode === 'queue') {
      await enqueue({
        provider,
        headers: request.headers,
        body: request.body,
        receivedAt: new Date().toISOString()
      })
      return reply.code(202).send({ status: 'queued' })
    }

    await handleImmediate(request, provider, request.body);

    return reply.code(200).send({ status: 'ok' })
  })
}

module.exports = webhookRoutes
