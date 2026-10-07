/**
 * Maps per-stage progress (0..1) onto a slice of the overall bar and throttles writes.
 * stage('ocr', 10, 90)(0.5) reports 50%.
 */
export function createProgressReporter(report, { minStep = 2 } = {}) {
  let last = -1;
  return (name, from, to) => (fraction) => {
    const pct = Math.round(from + (to - from) * Math.min(1, Math.max(0, fraction)));
    if (pct - last >= minStep || fraction >= 1) {
      last = pct;
      report(name, pct);
    }
  };
}
