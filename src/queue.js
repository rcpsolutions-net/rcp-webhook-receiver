'use strict'

/**
 * Simple queue abstraction.
 *
 * In-memory by default for development/testing.
 * Replace `enqueue` with your preferred message-queue client
 * (e.g. BullMQ, SQS, RabbitMQ) without changing any route code.
 */

const _queue = []

/**
 * Add a webhook event to the queue.
 * @param {object} event
 * @param {string} event.provider - Webhook provider name (e.g. "github")
 * @param {object} event.headers  - Original request headers
 * @param {object} event.body     - Parsed request body
 * @param {string} event.receivedAt - ISO timestamp
 */
async function enqueue (event) {
  _queue.push(event)
}

/**
 * Drain all queued events (useful in tests or worker processes).
 * @returns {object[]}
 */
function drain () {
  return _queue.splice(0, _queue.length)
}

/**
 * Current queue depth (for health-checks / metrics).
 * @returns {number}
 */
function depth () {
  return _queue.length
}

module.exports = { enqueue, drain, depth }
