// Usage: npm run seed:demo -w server
// Creates a demo account with a sample OS-notes PDF queued for the worker. Safe to run twice.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import bcrypt from 'bcrypt';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { env } from '../config/env.js';
import { connectDB, disconnectDB } from '../config/db.js';
import { User, StudyDocument } from '../models/index.js';
import { storage } from '../storage/index.js';

const DEMO = { name: 'Demo Student', email: 'demo@studymate.app', password: 'studymate-demo-1' };

const PAGES = [
  [
    '1 Paging',
    'Paging divides physical memory into fixed-size frames and a process address space into pages of the same size. A page table maps each virtual page to a frame, so a process no longer needs one contiguous block of memory. The cost is translation: every memory access needs a lookup.',
  ],
  [
    '2 The TLB',
    'A translation lookaside buffer (TLB) is a small, fast hardware cache of recent page table entries. Because programs show locality, most translations hit in the TLB and never touch the page table in memory. A TLB miss forces a page-table walk, which is much slower.',
  ],
  [
    '3 Page Replacement',
    'When memory is full and a page fault occurs, the operating system must evict a page. FIFO evicts the oldest page, LRU evicts the least recently used page, and the optimal algorithm evicts the page used furthest in the future. FIFO can suffer from Belady’s anomaly: more frames can cause more faults.',
  ],
  [
    '4 Thrashing',
    'Thrashing happens when processes spend more time paging than executing because their working sets do not fit in memory. Symptoms are high page-fault rates and low CPU utilization. Remedies include reducing the degree of multiprogramming or using a working-set model.',
  ],
  [
    '5 Deadlocks',
    'A deadlock requires four conditions at once: mutual exclusion, hold and wait, no preemption, and circular wait. Preventing any one condition prevents deadlock. Avoidance algorithms such as the Banker’s algorithm grant requests only if the system stays in a safe state.',
  ],
];

async function buildPdf() {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Operating Systems: Memory and Deadlocks (demo notes)');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const [heading, body] of PAGES) {
    const page = pdf.addPage([595, 842]);
    page.drawText(heading, { x: 56, y: 770, size: 16, font: bold });
    page.drawText(body, { x: 56, y: 740, size: 12, font, maxWidth: 483, lineHeight: 17 });
  }
  return Buffer.from(await pdf.save());
}

await connectDB();
try {
  let user = await User.findOne({ email: DEMO.email });
  if (!user) {
    user = await User.create({
      name: DEMO.name,
      email: DEMO.email,
      passwordHash: await bcrypt.hash(DEMO.password, env.BCRYPT_ROUNDS),
    });
    console.log(`Created ${DEMO.email} / ${DEMO.password}`);
  }

  const bytes = await buildPdf();
  const fileHash = createHash('sha256').update(bytes).digest('hex');
  if (await StudyDocument.exists({ userId: user._id, fileHash })) {
    console.log('Demo document already exists.');
  } else {
    const tmp = path.join(
      env.STORAGE_DRIVER === 'local' ? path.join(env.STORAGE_DIR, '.tmp') : tmpdir(),
      randomUUID(),
    );
    await mkdir(path.dirname(tmp), { recursive: true });
    await writeFile(tmp, bytes);
    const storageKey = `users/${user._id}/${randomUUID()}.pdf`;
    await storage.putFile(storageKey, tmp);
    await StudyDocument.create({
      userId: user._id,
      originalName: 'OS Memory and Deadlocks (demo).pdf',
      storageKey,
      mimeType: 'application/pdf',
      sizeBytes: bytes.length,
      fileHash,
    });
    console.log('Demo PDF queued. Start the worker (npm run dev) to process it.');
  }
} finally {
  await disconnectDB();
}
