const test = require('node:test');
const assert = require('node:assert');
const { getDiskUsage, getSimulatedDiskUsage } = require('../src/core/docker-client');

test('DockerClient - getSimulatedDiskUsage generates valid mock dataset', () => {
  const mock = getSimulatedDiskUsage();
  assert.strictEqual(mock.isMock, true);
  assert.strictEqual(mock.dockerAvailable, false);
  assert.ok(mock.containers.length > 0);
  assert.ok(mock.images.length > 0);
  assert.ok(mock.volumes.length > 0);
  assert.ok(mock.buildCache.length > 0);
});

test('DockerClient - getDiskUsage returns usage payload with summary', () => {
  const usage = getDiskUsage();
  assert.ok(typeof usage.dockerAvailable === 'boolean');
  assert.ok(Array.isArray(usage.containers));
  assert.ok(Array.isArray(usage.images));
  assert.ok(usage.summary);
  assert.ok(typeof usage.summary.totalReclaimableBytes === 'number');
});
