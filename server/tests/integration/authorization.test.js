import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../src/app.js';
import { User, StudyDocument, StudyArtifact, Conversation } from '../../src/models/index.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import { connectTestDB, closeTestDB } from '../helpers/db.js';
import { seedReadyDocument } from '../helpers/seed.js';

const app = createApp();
let ids;
let attacker;

// One shared setup: the routes run in order against the same data, and the last test checks nothing changed.
beforeAll(async () => {
  await connectTestDB();
  const alice = await User.create({ name: 'Alice', email: 'alice@example.com', passwordHash: 'x' });
  const bob = await User.create({ name: 'Bob', email: 'bob@example.com', passwordHash: 'x' });
  attacker = { Authorization: `Bearer ${signAccessToken(bob)}` };

  const doc = await seedReadyDocument(alice._id);
  const artifact = await StudyArtifact.create({
    userId: alice._id,
    documentId: doc._id,
    type: 'summary',
    cacheKey: 'k',
    promptVersion: 1,
  });
  const conversation = await Conversation.create({ userId: alice._id, documentIds: [doc._id] });
  ids = {
    doc: String(doc._id),
    artifact: String(artifact._id),
    conversation: String(conversation._id),
  };
});
afterAll(closeTestDB);

const ROUTES = [
  ['GET', '/documents/:doc'],
  ['GET', '/documents/:doc/status'],
  ['GET', '/documents/:doc/file'],
  ['GET', '/documents/:doc/chunks'],
  ['GET', '/documents/:doc/artifacts'],
  ['POST', '/documents/:doc/artifacts', { type: 'summary' }],
  ['POST', '/documents/:doc/reprocess'],
  ['PATCH', '/documents/:doc', { title: 'Mine now' }],
  ['DELETE', '/documents/:doc'],
  ['GET', '/artifacts/:artifact'],
  ['DELETE', '/artifacts/:artifact'],
  ['GET', '/conversations/:conversation'],
  ['PATCH', '/conversations/:conversation', { title: 'Mine now' }],
  ['POST', '/conversations/:conversation/messages', { content: 'What is paging?' }],
  ['DELETE', '/conversations/:conversation'],
];

describe('another user’s resources are invisible', () => {
  it.each(ROUTES)('%s %s → 404', async (method, template, body) => {
    const path = template.replace(/:(\w+)/g, (_, key) => ids[key]);
    const res = await request(app)[method.toLowerCase()](`/api/v1${path}`).set(attacker).send(body);
    expect(res.status).toBe(404);
  });

  it('leaves the owner’s data untouched', async () => {
    expect(await StudyDocument.findById(ids.doc)).toMatchObject({
      title: 'OS notes',
      status: 'ready',
    });
    expect(await StudyArtifact.findById(ids.artifact)).not.toBeNull();
    expect(await Conversation.findById(ids.conversation)).toMatchObject({
      title: 'New conversation',
    });
  });
});
