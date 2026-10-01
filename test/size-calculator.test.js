const test = require('node:test');
const assert = require('node:assert');
const {
  parseSizeToBytes,
  formatBytes,
  calculateReclaimableSummary
} = require('../src/core/size-calculator');

test('SizeCalculator - parseSizeToBytes parses human sizes accurately', () => {
  assert.strictEqual(parseSizeToBytes('1 GB'), 1073741824);
  assert.strictEqual(parseSizeToBytes('500 MB'), 524288000);
  assert.strictEqual(parseSizeToBytes('10 KB'), 10240);
  assert.strictEqual(parseSizeToBytes('100 B'), 100);
  assert.strictEqual(parseSizeToBytes('invalid'), 0);
});

test('SizeCalculator - formatBytes formats byte counts into strings', () => {
  assert.strictEqual(formatBytes(1073741824), '1 GB');
  assert.strictEqual(formatBytes(524288000), '500 MB');
  assert.strictEqual(formatBytes(0), '0 B');
});

test('SizeCalculator - calculateReclaimableSummary totals stopped and dangling assets', () => {
  const usageData = {
    containers: [
      { id: 'c1', stopped: true, sizeBytes: 100 * 1024 * 1024 },
      { id: 'c2', stopped: false, sizeBytes: 200 * 1024 * 1024 }
    ],
    images: [
      { id: 'i1', dangling: true, sizeBytes: 500 * 1024 * 1024 }
    ],
    volumes: [],
    buildCache: []
  };

  const summary = calculateReclaimableSummary(usageData);
  assert.strictEqual(summary.containerReclaimableBytes, 100 * 1024 * 1024);
  assert.strictEqual(summary.imageReclaimableBytes, 500 * 1024 * 1024);
  assert.strictEqual(summary.totalReclaimableBytes, 600 * 1024 * 1024);
});
