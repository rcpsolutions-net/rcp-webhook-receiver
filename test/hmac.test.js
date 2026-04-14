'use strict'

const { test } = require('tap')
const { computeHmac, safeCompare, verifySignature } = require('../src/plugins/hmac')

test('computeHmac produces a consistent hex digest', (t) => {
  const digest = computeHmac('secret', 'hello world')
  t.equal(typeof digest, 'string', 'returns a string')
  t.match(digest, /^[0-9a-f]+$/, 'result is lowercase hex')
  t.equal(computeHmac('secret', 'hello world'), digest, 'deterministic')
  t.not(computeHmac('other-secret', 'hello world'), digest, 'different secret → different digest')
  t.not(computeHmac('secret', 'different payload'), digest, 'different payload → different digest')
  t.end()
})

test('safeCompare returns true for identical strings', (t) => {
  t.ok(safeCompare('abc123', 'abc123'))
  t.end()
})

test('safeCompare returns false for differing strings', (t) => {
  t.notOk(safeCompare('abc123', 'abc124'))
  t.notOk(safeCompare('abc', 'abcd'))
  t.end()
})

test('safeCompare returns false for non-string inputs', (t) => {
  t.notOk(safeCompare(null, 'abc'))
  t.notOk(safeCompare('abc', undefined))
  t.end()
})

test('verifySignature accepts a valid raw-hex signature', (t) => {
  const secret = 'my-secret'
  const payload = Buffer.from('{"event":"push"}')
  const signature = computeHmac(secret, payload)
  t.ok(verifySignature({ secret, payload, signature }))
  t.end()
})

test('verifySignature accepts a "sha256=<hex>" prefixed signature (GitHub-style)', (t) => {
  const secret = 'my-secret'
  const payload = Buffer.from('{"event":"push"}')
  const signature = 'sha256=' + computeHmac(secret, payload)
  t.ok(verifySignature({ secret, payload, signature }))
  t.end()
})

test('verifySignature rejects a tampered payload', (t) => {
  const secret = 'my-secret'
  const signature = computeHmac(secret, Buffer.from('original'))
  t.notOk(verifySignature({ secret, payload: Buffer.from('tampered'), signature }))
  t.end()
})

test('verifySignature rejects a wrong secret', (t) => {
  const payload = Buffer.from('{"event":"push"}')
  const signature = computeHmac('correct-secret', payload)
  t.notOk(verifySignature({ secret: 'wrong-secret', payload, signature }))
  t.end()
})

test('verifySignature rejects missing signature', (t) => {
  const payload = Buffer.from('{"event":"push"}')
  t.notOk(verifySignature({ secret: 'secret', payload, signature: undefined }))
  t.notOk(verifySignature({ secret: 'secret', payload, signature: '' }))
  t.end()
})
