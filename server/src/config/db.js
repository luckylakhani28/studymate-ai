import mongoose from 'mongoose';
import { env, isProd } from './env.js';
import { logger } from '../utils/logger.js';

mongoose.set('strictQuery', true);

export async function connectDB() {
  const conn = mongoose.connection;
  conn.on('disconnected', () => logger.warn('MongoDB disconnected'));
  conn.on('reconnected', () => logger.info('MongoDB reconnected'));
  conn.on('error', (err) => logger.error({ err }, 'MongoDB error'));

  // Production builds indexes as an explicit deploy step (npm run db:sync-indexes), not on every boot.
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000, autoIndex: !isProd });
  logger.info({ host: conn.host, db: conn.name }, 'MongoDB connected');
}

export const disconnectDB = () => mongoose.disconnect();
export const isDBConnected = () => mongoose.connection.readyState === 1;
