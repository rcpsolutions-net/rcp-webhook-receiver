'use strict'

const { verifySignature } = require('../plugins/hmac')
const { enqueue } = require('../queue')


function getProviderConfig (provider) {
  const key = provider.toUpperCase().replace(/-/g, '_');

  const secret = process.env[`WEBHOOK_SECRET_${key}`]
  const header = process.env[`WEBHOOK_HEADER_${key}`] || 'x-gs-signature'
  const timestamp = process.env[`WEBHOOK_HEADER_TIMESTAMP_${key}`] || 'x-gs-timestamp'
  const mode = process.env[`WEBHOOK_MODE_${key}`] || 'immediate'

  return { secret, header: header.toLowerCase(), timestamp: timestamp.toLowerCase(), mode }
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
    const { secret, header, timestamp, mode } = getProviderConfig(provider)

    console.log(provider, secret, header, timestamp, mode); // Log provider config for debugging

    if (!secret) {
      request.log.warn({ provider }, 'no HMAC secret configured for provider')
      return reply.code(400).send({ error: 'Unknown provider' })
    }
  
    if (!timestamp) {
      request.log.warn({ provider }, 'missing required timestamp header for HMAC verification')
      return reply.code(400).send({ error: 'Missing timestamp header' })
    }
    const rawBody = timestamp + '\n' + request.rawBody;

    const signature = request.headers[header]

    const valid = verifySignature({ secret, payload: rawBody, signature })
    if (!valid) {
      request.log.warn({ provider, header }, 'HMAC signature verification failed')
      return reply.code(401).send({ error: 'Invalid signature' })
    }
    else {
      console.log(rawBody.toString('utf8')); // Log the raw body for debugging
      //console.log(`--- incoming webhook HMAC signature verification succeeded for provider: ${provider}`); // Log success
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
