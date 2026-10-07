import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { SERVER_ENV } from './env.js';

async function writeFixture() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595, 842]);
  page.drawText(
    'Paging splits memory into fixed-size frames, so a process no longer needs one contiguous block. ' +
      'A TLB caches recent translations, so most lookups never reach the page table.',
    { x: 50, y: 780, size: 11, font, maxWidth: 495, lineHeight: 14 },
  );
  await mkdir(new URL('./.fixtures/', import.meta.url), { recursive: true });
  await writeFile(new URL('./.fixtures/os-notes.pdf', import.meta.url), await pdf.save());
}

/** Playwright's webServer needs a URL to wait on, and the worker has none, so it's started here. */
export default async function globalSetup() {
  await writeFixture();
  const worker = spawn('npm', ['run', 'worker', '-w', 'server'], {
    env: { ...process.env, ...SERVER_ENV },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return async () => {
    worker.kill('SIGTERM');
  };
}
