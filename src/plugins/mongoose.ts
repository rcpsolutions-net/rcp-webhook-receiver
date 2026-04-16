import type { FastifyInstance } from 'fastify';
import mongoose, { ConnectOptions } from 'mongoose';

export interface MongooseConfig {
  mongoUri: string;
}

export interface MongooseConnectOptions extends ConnectOptions {}

let config: MongooseConfig = {
  mongoUri: process.env.MONGODB_URI || '',
};

let connectionPromise: Promise<typeof mongoose> | null = null;

export async function connectToMongoDB(fastify: FastifyInstance, options?: MongooseConnectOptions): Promise<void> {
  if (process.env.SKIP_MONGODB === 'true') {
    fastify.log.info('Skipping MongoDB connection (SKIP_MONGODB=true)');
    return;
  }

  const mongoUri = config.mongoUri || process.env.MONGODB_URI || '';

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not configured');
  }

  if (!connectionPromise) {
    fastify.log.info('Connecting to MongoDB at [secret uri]...');

    connectionPromise = mongoose.connect(mongoUri, options);
  }

  try {
    await connectionPromise;

    fastify.log.info('MongoDB connected successfully');
  } catch (err) {
    connectionPromise = null;

    fastify.log.error({ err }, 'MongoDB connection failed');
    
    throw err;
  }
}

export function setMongooseConfig(nextConfig: Partial<MongooseConfig>): void {
  config = {
    ...config,
    ...nextConfig,
  };
}

  