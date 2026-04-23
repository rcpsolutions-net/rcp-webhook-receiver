import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import mongoose from 'mongoose';

import { verifySignature } from '../plugins/hmac';
import { enqueue } from '../queue';
import { incomingWebhooks } from '../models/incomingWebhooks';


interface WebhookParams {
  provider: string;
}

interface WebhookQuery {
  mode?: 'immediate' | 'queue';
}

interface WebhookBody {
  EventName?: string;
  [key: string]: unknown;
}

interface ProviderConfig {
  secret: string | undefined;
  header: string;
  timestampHeader: string;
  mode: 'immediate' | 'queue';
}

function getProviderConfig(provider: string): ProviderConfig {
  const key = provider.toUpperCase().replace(/-/g, '_');

  return {
    secret:          process.env[`WEBHOOK_SECRET_${key}`],
    header:         (process.env[`WEBHOOK_HEADER_${key}`]           ?? 'x-hub-signature-256').toLowerCase(),
    timestampHeader:(process.env[`WEBHOOK_HEADER_TIMESTAMP_${key}`] ?? 'x-hub-timestamp').toLowerCase(),
    mode:           (process.env[`WEBHOOK_MODE_${key}`]             ?? 'immediate') as 'immediate' | 'queue',
  };
}

async function handleImmediate(request: FastifyRequest, provider: string, body: WebhookBody): Promise<void> {
  request.log.info({ provider, body }, 'webhook received (immediate)');
}

function getHeaderValue(headers: Record<string, unknown>, headerName: string): string | undefined {
  const value = headers[headerName];
  
  if (typeof value === 'string') return value;  
  else if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  else return undefined;
}

export default async function webhookRoutes(fastify: FastifyInstance): Promise<void> {

  fastify.post<{ Params: WebhookParams; Querystring: WebhookQuery; Body: WebhookBody }>('/3PS/incoming/webhook/:provider', {
      config: {
        rawBody: true,
        rateLimit: {
          max:        parseInt(process.env.RATE_LIMIT_MAX    ?? '100',  10),
          timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW ?? '1000', 10),
        },
      },
    },
    async (request: FastifyRequest<{ Params: WebhookParams; Querystring: WebhookQuery; Body: WebhookBody }>, reply: FastifyReply) => {
      const { provider } = request.params;
      const { secret, header, timestampHeader, mode } = getProviderConfig(provider);

      request.log.debug({ provider, header, timestampHeader, mode }, 'provider config');

      if (!secret) {
        request.log.warn({ provider }, 'no HMAC secret configured for provider');
        return reply.code(400).send({ error: 'Unknown provider' });
      }

      const parsedBody: WebhookBody = typeof request.body === 'object' && request.body !== null ? request.body : {};
      const rawBodyBuffer = request.rawBody ?? Buffer.from(JSON.stringify(parsedBody), 'utf8');
      const rawBodyStr = rawBodyBuffer.toString('utf8');

      const timestamp = getHeaderValue(request.headers as Record<string, unknown>, timestampHeader);
      if (!timestamp) {
        request.log.warn({ provider }, 'missing required timestamp header for HMAC verification');

        return reply.code(400).send({ error: 'Missing timestamp header' });
      }

      const signature = getHeaderValue(request.headers as Record<string, unknown>, header);
      const rawPayload = `${timestamp}\n${rawBodyStr}`;
      
      const valid = verifySignature({ secret, payload: rawPayload, signature });

      if (!valid) {
        request.log.warn({ provider, header }, 'HMAC signature verification failed');
        return reply.code(401).send({ error: 'Invalid signature' });
      }

      //request.log.info({ provider }, `HMAC verified — incoming webhook`);

      if (process.env.SKIP_MONGODB === 'true' || mongoose.connection.readyState !== 1) {
        request.log.warn({ provider }, 'MongoDB unavailable, skipping webhook persistence');
      } else {
        incomingWebhooks      // change this to non-blocking by not awaiting it and just logging success/failure
          .create({
            provider,
            eventName: parsedBody.EventName ?? 'unknown',
            payload: parsedBody,
            processed: false,
          })
          .then(() => {
            request.log.debug({ provider, eventName: parsedBody.EventName }, 'Webhook stored in database');            
          })
          .catch((err: Error) => {
            request.log.error({ err, provider, eventName: parsedBody.EventName }, 'Failed to store webhook in database');           
          });          
      }

      return reply.code(200).send({ status: 'ok' });

      /***
      const effectiveMode: 'immediate' | 'queue' = request.query.mode === 'immediate' || request.query.mode === 'queue' ? request.query.mode : mode;

      if (effectiveMode.toLowerCase() === 'queue') {
        await enqueue({
          provider,
          headers: request.headers as Record<string, unknown>,
          body: parsedBody,
          receivedAt: new Date().toISOString(),
        });
        
        return reply.code(202).send({ status: 'queued' });
      }

      await handleImmediate(request, provider, parsedBody);

      return reply.code(200).send({ status: 'ok' });
      ***/
    },
  );
}