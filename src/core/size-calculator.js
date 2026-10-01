/**
 * Utility functions for parsing and formatting byte sizes and disk space reclamation calculations.
 */

function parseSizeToBytes(sizeStr) {
  if (!sizeStr || typeof sizeStr !== 'string') return 0;
  const clean = sizeStr.trim().toUpperCase();

  const match = clean.match(/^([\d.]+)\s*([A-Z]*B?)$/);
  if (!match) return 0;

  const val = parseFloat(match[1]);
  const unit = match[2];

  if (unit.startsWith('G')) return Math.round(val * 1024 * 1024 * 1024);
  if (unit.startsWith('M')) return Math.round(val * 1024 * 1024);
  if (unit.startsWith('K')) return Math.round(val * 1024);
  if (unit.startsWith('B') || unit === '') return Math.round(val);

  return Math.round(val);
}

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function calculateReclaimableSummary(usageData) {
  let containerReclaimable = 0;
  let imageReclaimable = 0;
  let volumeReclaimable = 0;
  let cacheReclaimable = 0;

  if (usageData.containers) {
    for (const c of usageData.containers) {
      if (c.stopped || (c.status && (c.status.includes('Exited') || c.status.includes('Created')))) {
        containerReclaimable += (c.sizeBytes || parseSizeToBytes(c.size));
      }
    }
  }

  if (usageData.images) {
    for (const img of usageData.images) {
      if (img.dangling || img.inUse === false) {
        imageReclaimable += (img.sizeBytes || parseSizeToBytes(img.size));
      }
    }
  }

  if (usageData.volumes) {
    for (const v of usageData.volumes) {
      if (v.inUse === false || v.links === 0) {
        volumeReclaimable += (v.sizeBytes || parseSizeToBytes(v.size));
      }
    }
  }

  if (usageData.buildCache) {
    for (const b of usageData.buildCache) {
      if (b.reclaimable || b.inUse === false) {
        cacheReclaimable += (b.sizeBytes || parseSizeToBytes(b.size));
      }
    }
  }

  const totalReclaimable = containerReclaimable + imageReclaimable + volumeReclaimable + cacheReclaimable;

  return {
    totalReclaimableBytes: totalReclaimable,
    totalReclaimableFormatted: formatBytes(totalReclaimable),
    containerReclaimableBytes: containerReclaimable,
    containerReclaimableFormatted: formatBytes(containerReclaimable),
    imageReclaimableBytes: imageReclaimable,
    imageReclaimableFormatted: formatBytes(imageReclaimable),
    volumeReclaimableBytes: volumeReclaimable,
    volumeReclaimableFormatted: formatBytes(volumeReclaimable),
    cacheReclaimableBytes: cacheReclaimable,
    cacheReclaimableFormatted: formatBytes(cacheReclaimable)
  };
}

module.exports = {
  parseSizeToBytes,
  formatBytes,
  calculateReclaimableSummary
};
