import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod;

export async function connectTestDB() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Wait for index builds — otherwise unique-constraint tests race the index.
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

export async function clearTestDB() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((c) => c.deleteMany({}))); // keeps indexes
}

export async function closeTestDB() {
  await mongoose.disconnect();
  await mongod?.stop();
}
