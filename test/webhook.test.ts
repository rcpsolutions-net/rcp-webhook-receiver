import { test } from 'tap';

import buildApp from '../src/server';
import { computeHmac } from '../src/plugins/hmac';
import { drain } from '../src/queue';

process.env.SKIP_MONGODB = 'true';

function sign(secret: string, timestamp: string, body: string): string {
  return `sha256=${computeHmac(secret, `${timestamp}\n${body}`)}`;
}

test('GET /3PS/incoming/webhook/health returns 200 ok', async (t) => {
  const app = await buildApp({ logger: false });
  t.teardown(() => app.close());

  const res = await app.inject({ method: 'GET', url: '/3PS/incoming/webhook/health' });
  t.equal(res.statusCode, 200);
  t.same(JSON.parse(res.body), { status: 'ok' });
});

test('POST /3PS/incoming/webhook/:provider returns 400 when provider is not configured', async (t) => {
  const app = await buildApp({ logger: false });
  t.teardown(() => app.close());

  delete process.env.WEBHOOK_SECRET_UNKNOWN;

  const res = await app.inject({
    method: 'POST',
    url: '/3PS/incoming/webhook/unknown',
    headers: {
      'content-type': 'application/json',
      'x-hub-timestamp': '1713200000',
    },
    payload: JSON.stringify({ event: 'test' }),
  });

  t.equal(res.statusCode, 400);
  t.match(JSON.parse(res.body), { error: 'Unknown provider' });
});

test('POST /3PS/incoming/webhook/:provider returns 401 when signature is missing', async (t) => {
  const app = await buildApp({ logger: false });
  t.teardown(() => app.close());

  process.env.WEBHOOK_SECRET_TESTPROVIDER = 'test-secret';

  const body = JSON.stringify({ event: 'ping' });
  const res = await app.inject({
    method: 'POST',
    url: '/3PS/incoming/webhook/testprovider',
    headers: {
      'content-type': 'application/json',
      'x-hub-timestamp': '1713200000',
    },
    payload: body,
  });

  t.equal(res.statusCode, 401);
  t.match(JSON.parse(res.body), { error: 'Invalid signature' });

  delete process.env.WEBHOOK_SECRET_TESTPROVIDER;
});

test('POST /3PS/incoming/webhook/:provider returns 401 when signature is wrong', async (t) => {
  const app = await buildApp({ logger: false });
  t.teardown(() => app.close());

  process.env.WEBHOOK_SECRET_TESTPROVIDER = 'correct-secret';

  const timestamp = '1713200000';
  const body = JSON.stringify({ event: 'ping' });
  const res = await app.inject({
    method: 'POST',
    url: '/3PS/incoming/webhook/testprovider',
    headers: {
      'content-type': 'application/json',
      'x-hub-timestamp': timestamp,
      'x-hub-signature-256': sign('wrong-secret', timestamp, body),
    },
    payload: body,
  });

  t.equal(res.statusCode, 401);
  delete process.env.WEBHOOK_SECRET_TESTPROVIDER;
});

test('POST /3PS/incoming/webhook/:provider returns 200 for immediate mode with valid signature', async (t) => {
  const app = await buildApp({ logger: false });
  t.teardown(() => app.close());

  const secret = 'my-webhook-secret';
  process.env.WEBHOOK_SECRET_MYPROVIDER = secret;
  process.env.WEBHOOK_MODE_MYPROVIDER = 'immediate';

  const timestamp = '1713200000';
  const body = JSON.stringify({ event: 'order.created', id: 42 });
  const res = await app.inject({
    method: 'POST',
    url: '/3PS/incoming/webhook/myprovider',
    headers: {
      'content-type': 'application/json',
      'x-hub-timestamp': timestamp,
      'x-hub-signature-256': sign(secret, timestamp, body),
    },
    payload: body,
  });

  t.equal(res.statusCode, 200);
  t.same(JSON.parse(res.body), { status: 'ok' });

  delete process.env.WEBHOOK_SECRET_MYPROVIDER;
  delete process.env.WEBHOOK_MODE_MYPROVIDER;
});

test('POST /3PS/incoming/webhook/:provider returns 202 and enqueues event in queue mode', async (t) => {
  drain();

  const app = await buildApp({ logger: false });
  t.teardown(() => app.close());

  const secret = 'queue-secret';
  process.env.WEBHOOK_SECRET_QPROVIDER = secret;
  process.env.WEBHOOK_MODE_QPROVIDER = 'queue';

  const timestamp = '1713200000';
  const payload = { event: 'shipment.updated', trackingId: 'ABC123' };
  const body = JSON.stringify(payload);
  const res = await app.inject({
    method: 'POST',
    url: '/3PS/incoming/webhook/qprovider',
    headers: {
      'content-type': 'application/json',
      'x-hub-timestamp': timestamp,
      'x-hub-signature-256': sign(secret, timestamp, body),
    },
    payload: body,
  });

  t.equal(res.statusCode, 202);
  t.same(JSON.parse(res.body), { status: 'queued' });

  const events = drain();
  t.equal(events.length, 1);
  t.equal(events[0].provider, 'qprovider');
  t.same(events[0].body, payload);

  delete process.env.WEBHOOK_SECRET_QPROVIDER;
  delete process.env.WEBHOOK_MODE_QPROVIDER;
});

test('queue mode can be overridden per-request with ?mode=queue', async (t) => {
  drain();

  const app = await buildApp({ logger: false });
  t.teardown(() => app.close());

  const secret = 'override-secret';
  process.env.WEBHOOK_SECRET_OVERRIDE = secret;
  process.env.WEBHOOK_MODE_OVERRIDE = 'immediate';

  const timestamp = '1713200000';
  const body = JSON.stringify({ event: 'test' });
  const res = await app.inject({
    method: 'POST',
    url: '/3PS/incoming/webhook/override?mode=queue',
    headers: {
      'content-type': 'application/json',
      'x-hub-timestamp': timestamp,
      'x-hub-signature-256': sign(secret, timestamp, body),
    },
    payload: body,
  });

  t.equal(res.statusCode, 202);
  t.equal(drain().length, 1);

  delete process.env.WEBHOOK_SECRET_OVERRIDE;
  delete process.env.WEBHOOK_MODE_OVERRIDE;
});

test('custom signature header (WEBHOOK_HEADER_*) is respected', async (t) => {
  const app = await buildApp({ logger: false });
  t.teardown(() => app.close());

  const secret = 'custom-header-secret';
  process.env.WEBHOOK_SECRET_STRIPE = secret;
  process.env.WEBHOOK_HEADER_STRIPE = 'x-stripe-signature';
  process.env.WEBHOOK_HEADER_TIMESTAMP_STRIPE = 'x-stripe-timestamp';
  process.env.WEBHOOK_MODE_STRIPE = 'immediate';

  const timestamp = '1713200000';
  const body = JSON.stringify({ type: 'payment_intent.succeeded' });
  const res = await app.inject({
    method: 'POST',
    url: '/3PS/incoming/webhook/stripe',
    headers: {
      'content-type': 'application/json',
      'x-stripe-timestamp': timestamp,
      'x-stripe-signature': sign(secret, timestamp, body),
    },
    payload: body,
  });

  t.equal(res.statusCode, 200);

  delete process.env.WEBHOOK_SECRET_STRIPE;
  delete process.env.WEBHOOK_HEADER_STRIPE;
  delete process.env.WEBHOOK_HEADER_TIMESTAMP_STRIPE;
  delete process.env.WEBHOOK_MODE_STRIPE;
});
