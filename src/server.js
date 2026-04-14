'use strict'

require('dotenv').config()

const buildApp = require('./app')

const HOST = process.env.HOST || '0.0.0.0'
const PORT = parseInt(process.env.PORT || '3000', 10)

const app = buildApp({ logger: true })

app.listen({ host: HOST, port: PORT }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
})

// Graceful shutdown
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    app.close().then(() => {
      process.exit(0)
    }).catch((err) => {
      app.log.error(err)
      process.exit(1)
    })
  })
}
