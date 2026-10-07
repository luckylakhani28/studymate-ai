import { StudyArtifact } from '../../models/index.js';
import { generateArtifact } from '../handlers/generateArtifact.js';
import { createMongoQueue } from './mongoQueue.js';

export function createArtifactQueue({ process = generateArtifact } = {}) {
  const base = createMongoQueue({
    name: 'artifacts',
    Model: StudyArtifact,
    process,
    initialStage: 'mapping',
  });
  return {
    ...base,
    complete: (job, workerId, result) => base.markReady(job, workerId, { content: result.content }),
  };
}
