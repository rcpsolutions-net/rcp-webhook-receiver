'use strict'

const Fastify = require('fastify')
const rateLimit = require('@fastify/rate-limit')
const webhookRoutes = require('./routes/webhook')

/**
 * Build and return a configured Fastify instance.
 * Separating app construction from `listen()` makes the server
 * straightforward to test without binding a port.
 *
 * @param {import('fastify').FastifyServerOptions} [opts]
 * @returns {import('fastify').FastifyInstance}
 */
function buildApp (opts = {}) {
  const fastify = Fastify(opts)

  fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10)
  })

  // --------------------------------------------------------------------------
  // Raw-body capture
  // Fastify does not expose the raw body by default.  We register a custom
  // content-type parser for JSON that stores the original Buffer on the
  // request object before handing the parsed result to the route handler.
  // --------------------------------------------------------------------------
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      req.rawBody = body
      try {
        done(null, JSON.parse(body.toString('utf8')))
      } catch (err) {
        err.statusCode = 400
        done(err, undefined)
      }
    }
  )

  // Also capture raw body for other common MIME types used by webhooks
  // (e.g. application/x-www-form-urlencoded, text/plain)
  for (const ct of ['application/x-www-form-urlencoded', 'text/plain']) {
    fastify.addContentTypeParser(ct, { parseAs: 'buffer' }, (req, body, done) => {
      req.rawBody = body
      done(null, body.toString('utf8'))
    })
  }

  fastify.get('/3PS/incoming/webhook/health', async (_request, reply) => {
    return reply.code(200).send({ status: 'ok' })
  })

  // --------------------------------------------------------------------------
  // Webhook routes
  // --------------------------------------------------------------------------
  fastify.register(webhookRoutes)

  return fastify
}

module.exports = buildApp
