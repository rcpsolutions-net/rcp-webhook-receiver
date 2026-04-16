import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }

  interface FastifyContextConfig {
    rawBody?: boolean;
  }
}
