import { User } from './User.js';
import { RefreshToken } from './RefreshToken.js';
import { StudyDocument } from './Document.js';
import { Chunk } from './Chunk.js';
import { AiUsage } from './AiUsage.js';
import { StudyArtifact } from './StudyArtifact.js';
import { Conversation } from './Conversation.js';
import { Message } from './Message.js';

export { User, RefreshToken, StudyDocument, Chunk, AiUsage, StudyArtifact, Conversation, Message };

/** Every model whose indexes must exist in production. Append new models here. */
export const models = [
  User,
  RefreshToken,
  StudyDocument,
  Chunk,
  AiUsage,
  StudyArtifact,
  Conversation,
  Message,
];
