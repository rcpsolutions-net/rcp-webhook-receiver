'use strict'

const crypto = require('node:crypto')


function computeHmac (secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}


function safeCompare (a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false

  if (a.length !== b.length) {
    // lengths differ – still run a dummy comparison to avoid timing leaks
    crypto.timingSafeEqual(Buffer.alloc(1), Buffer.alloc(1))
    return false
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}


function verifySignature ({ secret, payload, signature }) {
  if (!signature) return false

  const normalised = signature.startsWith('sha256=') ? signature.slice('sha256='.length) : signature

  console.log('--- received signature ---', signature); // Log the received signature for debugging
  const expected = computeHmac(secret, payload)
  console.log('--- normalised signature ---', normalised); // Log received signature
  console.log('--- computed expected HMAC signature ---', expected); // Log expected signature
  
  return safeCompare(normalised, expected)
}

module.exports = { computeHmac, safeCompare, verifySignature }
