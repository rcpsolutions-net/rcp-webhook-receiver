'use strict'

require('dotenv').config()

const buildApp = require('./app');

const HOST = process.env.HOST || '0.0.0.0'
const PORT = parseInt(process.env.PORT || '3000', 10)

const app = buildApp({ logger: true }).then((app) => {

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

  app.listen({ host: HOST, port: PORT }, (err) => {
    if (err) {
      app.log.error(err)
      process.exit(1)
    }
  })
}).catch((err) => {
  console.error('Failed to build app:', err);
  process.exit(1);
});


