/**
 * Native Docker CLI Wrapper & Disk Usage Inspector.
 * Uses child_process to interact with Docker daemon with graceful mock fallback.
 */

const { spawnSync } = require('child_process');
const { parseSizeToBytes, calculateReclaimableSummary } = require('./size-calculator');

function isDockerAvailable() {
  try {
    const res = spawnSync('docker', ['info'], { encoding: 'utf8', timeout: 3000 });
    return res.status === 0;
  } catch {
    return false;
  }
}

function getContainers() {
  try {
    const res = spawnSync('docker', ['ps', '-a', '--format', '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Size}}|{{.CreatedAt}}'], { encoding: 'utf8' });
    if (res.status !== 0 || !res.stdout.trim()) return [];

    const lines = res.stdout.trim().split('\n');
    return lines.map(line => {
      const [id, name, image, status, size, created] = line.split('|');
      const stopped = status.includes('Exited') || status.includes('Created');
      const sizeBytes = parseSizeToBytes(size);

      return {
        id,
        name,
        image,
        status,
        stopped,
        size: size || '0 B',
        sizeBytes,
        created
      };
    });
  } catch {
    return [];
  }
}

function getImages() {
  try {
    const res = spawnSync('docker', ['images', '-a', '--format', '{{.ID}}|{{.Repository}}|{{.Tag}}|{{.Size}}|{{.CreatedAt}}'], { encoding: 'utf8' });
    if (res.status !== 0 || !res.stdout.trim()) return [];

    const lines = res.stdout.trim().split('\n');
    return lines.map(line => {
      const [id, repository, tag, size, created] = line.split('|');
      const dangling = repository === '<none>' || tag === '<none>';
      const sizeBytes = parseSizeToBytes(size);

      return {
        id,
        repository,
        tag,
        dangling,
        inUse: !dangling,
        size: size || '0 B',
        sizeBytes,
        created
      };
    });
  } catch {
    return [];
  }
}

function getVolumes() {
  try {
    const res = spawnSync('docker', ['volume', 'ls', '--format', '{{.Name}}|{{.Driver}}'], { encoding: 'utf8' });
    if (res.status !== 0 || !res.stdout.trim()) return [];

    const lines = res.stdout.trim().split('\n');
    return lines.map(line => {
      const [name, driver] = line.split('|');
      return {
        name,
        driver: driver || 'local',
        size: '150 MB', // Estimated average volume size
        sizeBytes: 150 * 1024 * 1024,
        inUse: false
      };
    });
  } catch {
    return [];
  }
}

function getBuildCache() {
  try {
    const res = spawnSync('docker', ['builder', 'du', '--format', '{{.ID}}|{{.Type}}|{{.Size}}|{{.Reclaimable}}'], { encoding: 'utf8' });
    if (res.status !== 0 || !res.stdout.trim()) return [];

    const lines = res.stdout.trim().split('\n');
    return lines.map(line => {
      const [id, type, size, reclaimable] = line.split('|');
      const sizeBytes = parseSizeToBytes(size);
      return {
        id,
        type: type || 'build-cache',
        size: size || '0 B',
        sizeBytes,
        reclaimable: true
      };
    });
  } catch {
    return [];
  }
}

function getSimulatedDiskUsage() {
  const containers = [
    { id: 'c1a2b3c4d5e6', name: 'old_postgres_dev', image: 'postgres:15-alpine', status: 'Exited (0) 3 weeks ago', stopped: true, size: '240 MB', sizeBytes: 240 * 1024 * 1024, created: '3 weeks ago' },
    { id: 'f7e8d9c0b1a2', name: 'redis_cache_test', image: 'redis:alpine', status: 'Exited (137) 5 days ago', stopped: true, size: '45 MB', sizeBytes: 45 * 1024 * 1024, created: '5 days ago' },
    { id: 'a9b8c7d6e5f4', name: 'active_api_server', image: 'node:20-alpine', status: 'Up 4 hours', stopped: false, size: '120 MB', sizeBytes: 120 * 1024 * 1024, created: '2 days ago' }
  ];

  const images = [
    { id: 'img111222333', repository: '<none>', tag: '<none>', dangling: true, inUse: false, size: '1.45 GB', sizeBytes: 1.45 * 1024 * 1024 * 1024, created: '1 month ago' },
    { id: 'img444555666', repository: '<none>', tag: '<none>', dangling: true, inUse: false, size: '890 MB', sizeBytes: 890 * 1024 * 1024, created: '2 weeks ago' },
    { id: 'img777888999', repository: 'node', tag: '18-alpine', dangling: false, inUse: true, size: '175 MB', sizeBytes: 175 * 1024 * 1024, created: '3 months ago' },
    { id: 'img000111222', repository: 'postgres', tag: '15-alpine', dangling: false, inUse: true, size: '379 MB', sizeBytes: 379 * 1024 * 1024, created: '4 months ago' }
  ];

  const volumes = [
    { name: 'old_pg_data_vol', driver: 'local', size: '3.2 GB', sizeBytes: 3.2 * 1024 * 1024 * 1024, inUse: false },
    { name: 'unused_cache_volume', driver: 'local', size: '540 MB', sizeBytes: 540 * 1024 * 1024, inUse: false }
  ];

  const buildCache = [
    { id: 'cache-layer-001', type: 'exec.cache', size: '4.8 GB', sizeBytes: 4.8 * 1024 * 1024 * 1024, reclaimable: true },
    { id: 'cache-layer-002', type: 'regular', size: '1.2 GB', sizeBytes: 1.2 * 1024 * 1024 * 1024, reclaimable: true }
  ];

  return {
    isMock: true,
    dockerAvailable: false,
    containers,
    images,
    volumes,
    buildCache
  };
}

function getDiskUsage() {
  const isAvailable = isDockerAvailable();

  if (!isAvailable) {
    const mockData = getSimulatedDiskUsage();
    const summary = calculateReclaimableSummary(mockData);
    return {
      dockerAvailable: false,
      isMock: true,
      summary,
      ...mockData
    };
  }

  const containers = getContainers();
  const images = getImages();
  const volumes = getVolumes();
  const buildCache = getBuildCache();

  const usageData = { containers, images, volumes, buildCache };
  const summary = calculateReclaimableSummary(usageData);

  return {
    dockerAvailable: true,
    isMock: false,
    summary,
    ...usageData
  };
}

function removeContainers(ids = [], force = false) {
  if (ids.length === 0) return { success: true, removedCount: 0 };
  const args = ['rm'];
  if (force) args.push('-f');
  args.push(...ids);

  const res = spawnSync('docker', args, { encoding: 'utf8' });
  return {
    success: res.status === 0,
    output: res.stdout || res.stderr,
    removedCount: ids.length
  };
}

function removeImages(ids = [], force = false) {
  if (ids.length === 0) return { success: true, removedCount: 0 };
  const args = ['rmi'];
  if (force) args.push('-f');
  args.push(...ids);

  const res = spawnSync('docker', args, { encoding: 'utf8' });
  return {
    success: res.status === 0,
    output: res.stdout || res.stderr,
    removedCount: ids.length
  };
}

function removeVolumes(names = []) {
  if (names.length === 0) return { success: true, removedCount: 0 };
  const args = ['volume', 'rm', ...names];

  const res = spawnSync('docker', args, { encoding: 'utf8' });
  return {
    success: res.status === 0,
    output: res.stdout || res.stderr,
    removedCount: names.length
  };
}

function pruneBuildCache() {
  const res = spawnSync('docker', ['builder', 'prune', '-f', '-a'], { encoding: 'utf8' });
  return {
    success: res.status === 0,
    output: res.stdout || res.stderr
  };
}

function pruneSystem(all = false, volumes = false) {
  const args = ['system', 'prune', '-f'];
  if (all) args.push('-a');
  if (volumes) args.push('--volumes');

  const res = spawnSync('docker', args, { encoding: 'utf8' });
  return {
    success: res.status === 0,
    output: res.stdout || res.stderr
  };
}

module.exports = {
  isDockerAvailable,
  getContainers,
  getImages,
  getVolumes,
  getBuildCache,
  getDiskUsage,
  getSimulatedDiskUsage,
  removeContainers,
  removeImages,
  removeVolumes,
  pruneBuildCache,
  pruneSystem
};
