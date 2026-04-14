'use strict'

const { test } = require('tap')
const buildApp = require('../src/app')
const { computeHmac } = require('../src/plugins/hmac')
const { drain } = require('../src/queue')

// ── helpers ──────────────────────────────────────────────────────────────────

function makeApp () {
  return buildApp({ logger: false })
}

function sign (secret, body) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body)
  return 'sha256=' + computeHmac(secret, Buffer.from(raw))
}

// ── health check ─────────────────────────────────────────────────────────────

test('GET /health returns 200 ok', async (t) => {
  const app = makeApp()
  t.teardown(() => app.close())

  const res = await app.inject({ method: 'GET', url: '/health' })
  t.equal(res.statusCode, 200)
  t.same(JSON.parse(res.body), { status: 'ok' })
})

// ── webhook – configuration guard ────────────────────────────────────────────

test('POST /webhooks/:provider returns 400 when provider is not configured', async (t) => {
  const app = makeApp()
  t.teardown(() => app.close())

  delete process.env.WEBHOOK_SECRET_UNKNOWN

  const res = await app.inject({
    method: 'POST',
    url: '/webhooks/unknown',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ event: 'test' })
  })

  t.equal(res.statusCode, 400)
  t.match(JSON.parse(res.body), { error: 'Unknown provider' })
})

// ── webhook – HMAC verification ───────────────────────────────────────────────

test('POST /webhooks/:provider returns 401 when signature is missing', async (t) => {
  const app = makeApp()
  t.teardown(() => app.close())

  process.env.WEBHOOK_SECRET_TESTPROVIDER = 'test-secret'

  const body = JSON.stringify({ event: 'ping' })
  const res = await app.inject({
    method: 'POST',
    url: '/webhooks/testprovider',
    headers: { 'content-type': 'application/json' },
    payload: body
  })

  t.equal(res.statusCode, 401)
  t.match(JSON.parse(res.body), { error: 'Invalid signature' })
  delete process.env.WEBHOOK_SECRET_TESTPROVIDER
})

test('POST /webhooks/:provider returns 401 when signature is wrong', async (t) => {
  const app = makeApp()
  t.teardown(() => app.close())

  process.env.WEBHOOK_SECRET_TESTPROVIDER = 'correct-secret'

  const body = JSON.stringify({ event: 'ping' })
  const res = await app.inject({
    method: 'POST',
    url: '/webhooks/testprovider',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': sign('wrong-secret', body)
    },
    payload: body
  })

  t.equal(res.statusCode, 401)
  delete process.env.WEBHOOK_SECRET_TESTPROVIDER
})

test('POST /webhooks/:provider returns 200 for immediate mode with valid signature', async (t) => {
  const app = makeApp()
  t.teardown(() => app.close())

  const secret = 'my-webhook-secret'
  process.env.WEBHOOK_SECRET_MYPROVIDER = secret
  process.env.WEBHOOK_MODE_MYPROVIDER = 'immediate'

  const body = JSON.stringify({ event: 'order.created', id: 42 })
  const res = await app.inject({
    method: 'POST',
    url: '/webhooks/myprovider',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': sign(secret, body)
    },
    payload: body
  })

  t.equal(res.statusCode, 200)
  t.same(JSON.parse(res.body), { status: 'ok' })

  delete process.env.WEBHOOK_SECRET_MYPROVIDER
  delete process.env.WEBHOOK_MODE_MYPROVIDER
})

// ── webhook – queue mode ──────────────────────────────────────────────────────

test('POST /webhooks/:provider returns 202 and enqueues event in queue mode', async (t) => {
  drain() // clear any leftover events

  const app = makeApp()
  t.teardown(() => app.close())

  const secret = 'queue-secret'
  process.env.WEBHOOK_SECRET_QPROVIDER = secret
  process.env.WEBHOOK_MODE_QPROVIDER = 'queue'

  const payload = { event: 'shipment.updated', trackingId: 'ABC123' }
  const body = JSON.stringify(payload)
  const res = await app.inject({
    method: 'POST',
    url: '/webhooks/qprovider',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': sign(secret, body)
    },
    payload: body
  })

  t.equal(res.statusCode, 202)
  t.same(JSON.parse(res.body), { status: 'queued' })

  const events = drain()
  t.equal(events.length, 1)
  t.equal(events[0].provider, 'qprovider')
  t.same(events[0].body, payload)

  delete process.env.WEBHOOK_SECRET_QPROVIDER
  delete process.env.WEBHOOK_MODE_QPROVIDER
})

test('queue mode can be overridden per-request with ?mode=queue', async (t) => {
  drain()

  const app = makeApp()
  t.teardown(() => app.close())

  const secret = 'override-secret'
  process.env.WEBHOOK_SECRET_OVERRIDE = secret
  process.env.WEBHOOK_MODE_OVERRIDE = 'immediate'

  const body = JSON.stringify({ event: 'test' })
  const res = await app.inject({
    method: 'POST',
    url: '/webhooks/override?mode=queue',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': sign(secret, body)
    },
    payload: body
  })

  t.equal(res.statusCode, 202)
  t.equal(drain().length, 1)

  delete process.env.WEBHOOK_SECRET_OVERRIDE
  delete process.env.WEBHOOK_MODE_OVERRIDE
})

// ── custom signature header ───────────────────────────────────────────────────

test('custom signature header (WEBHOOK_HEADER_*) is respected', async (t) => {
  const app = makeApp()
  t.teardown(() => app.close())

  const secret = 'custom-header-secret'
  process.env.WEBHOOK_SECRET_STRIPE = secret
  process.env.WEBHOOK_HEADER_STRIPE = 'x-stripe-signature'
  process.env.WEBHOOK_MODE_STRIPE = 'immediate'

  const body = JSON.stringify({ type: 'payment_intent.succeeded' })
  const res = await app.inject({
    method: 'POST',
    url: '/webhooks/stripe',
    headers: {
      'content-type': 'application/json',
      'x-stripe-signature': sign(secret, body)
    },
    payload: body
  })

  t.equal(res.statusCode, 200)

  delete process.env.WEBHOOK_SECRET_STRIPE
  delete process.env.WEBHOOK_HEADER_STRIPE
  delete process.env.WEBHOOK_MODE_STRIPE
})
