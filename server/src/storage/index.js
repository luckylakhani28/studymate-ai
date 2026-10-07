import { env } from '../config/env.js';
import { GridFsStorage } from './GridFsStorage.js';
import { LocalStorage } from './LocalStorage.js';

// Services depend on the interface (putFile, openReadStream, getBuffer, remove), never on fs or GridFS.
export const storage =
  env.STORAGE_DRIVER === 'gridfs' ? new GridFsStorage() : new LocalStorage(env.STORAGE_DIR);
