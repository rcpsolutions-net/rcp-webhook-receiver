import 'dotenv/config';

import Fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import rateLimit from '@fastify/rate-limit';

import webhookRoutes from './routes/webhook';
import { connectToMongoDB } from './plugins/mongoose';

export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify(opts);

  await fastify.register(rateLimit, {
    max: Number.parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10),
    timeWindow: Number.parseInt(process.env.RATE_LIMIT_WINDOW ?? '1000', 10),
  });

  fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, (request, body, done) => {
    request.rawBody = Buffer.isBuffer(body) ? body : Buffer.from(body);
    try {
      done(null, JSON.parse(body.toString('utf8')));
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  for (const ct of ['application/x-www-form-urlencoded', 'text/plain']) {
    fastify.addContentTypeParser(ct, { parseAs: 'buffer' }, (request, body, done) => {
      request.rawBody = Buffer.isBuffer(body) ? body : Buffer.from(body);
      done(null, request.rawBody.toString('utf8'));
    });
  }

  fastify.get('/3PS/incoming/webhook/health', async (_request, reply) => {
    return reply.code(200).send({ status: 'ok' });
  });

  await connectToMongoDB(fastify);
  await fastify.register(webhookRoutes);

  return fastify;
}


const HOST = process.env.HOST ?? '0.0.0.0';
const PORT = Number.parseInt(process.env.PORT ?? '3000', 10);

export async function start(): Promise<void> {
  const app = await buildApp({ logger: true });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      void app
        .close()
        .then(() => {
          process.exit(0);
        })
        .catch((err: unknown) => {
          app.log.error(err);
          process.exit(1);
        });
    });
  }

  await app.listen({ host: HOST, port: PORT });
}

function isDirectExecution(): boolean {
  return typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module;
}

if (isDirectExecution()) {
  void start().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default buildApp;
