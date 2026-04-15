'use strict'

const _queue = []

/**
 * Add a webhook event to the queue.
 * @param {object} event
 * @param {string} event.provider - Webhook provider name (e.g. "github")
 * @param {object} event.headers  - Original request headers
 * @param {object} event.body     - Parsed request body
 * @param {string} event.receivedAt - ISO timestamp
 */

async function enqueue(event) {
  _queue.push(event)
}


function drain() {
  return _queue.splice(0, _queue.length)
}

function depth() {
  return _queue.length
}

module.exports = { enqueue, drain, depth }
