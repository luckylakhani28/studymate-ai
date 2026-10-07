import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import mongoose from 'mongoose';
import { AppError } from '../utils/AppError.js';

/**
 * PDFs stored in MongoDB (GridFS). For hosts with ephemeral disks: no extra service to run.
 * Same four methods as LocalStorage, so nothing else in the app changes.
 */
export class GridFsStorage {
  #bucket() {
    return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
  }

  async #find(key) {
    const [file] = await this.#bucket().find({ filename: key }).limit(1).toArray();
    if (!file) throw new AppError('NOT_FOUND', { message: 'File not found' });
    return file;
  }

  async putFile(key, sourcePath) {
    await pipeline(
      createReadStream(sourcePath),
      this.#bucket().openUploadStream(key, { contentType: 'application/pdf' }),
    );
  }

  async openReadStream(key) {
    const file = await this.#find(key);
    return { stream: this.#bucket().openDownloadStream(file._id), size: file.length };
  }

  async getBuffer(key) {
    const { stream } = await this.openReadStream(key);
    const parts = [];
    for await (const part of stream) parts.push(part);
    return Buffer.concat(parts);
  }

  async remove(key) {
    const bucket = this.#bucket();
    const files = await bucket.find({ filename: key }).toArray();
    await Promise.all(files.map((f) => bucket.delete(f._id)));
  }
}
