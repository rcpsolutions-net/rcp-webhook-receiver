'use strict'

const crypto = require('node:crypto')

/**
 * Compute an HMAC-SHA256 digest of `payload` using `secret`.
 *
 * @param {string|Buffer} secret
 * @param {string|Buffer} payload
 * @returns {string} Hex digest
 */
function computeHmac (secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Constant-time comparison of two hex strings to prevent timing attacks.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeCompare (a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) {
    // lengths differ – still run a dummy comparison to avoid timing leaks
    crypto.timingSafeEqual(Buffer.alloc(1), Buffer.alloc(1))
    return false
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/**
 * Verify a request signature.
 *
 * Supports two common header formats:
 *   • "sha256=<hex>"   (GitHub-style)
 *   • "<hex>"          (raw hex digest)
 *
 * @param {object} opts
 * @param {string|Buffer} opts.secret   - Shared HMAC secret
 * @param {string|Buffer} opts.payload  - Raw request body bytes
 * @param {string}        opts.signature - Value from the signature header
 * @returns {boolean}
 */
function verifySignature ({ secret, payload, signature }) {
  if (!signature) return false

  // Strip well-known prefix (e.g. "sha256=") if present
  const normalised = signature.startsWith('sha256=')
    ? signature.slice('sha256='.length)
    : signature

  const expected = computeHmac(secret, payload)
  return safeCompare(normalised, expected)
}

module.exports = { computeHmac, safeCompare, verifySignature }
