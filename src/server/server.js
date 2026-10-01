/**
 * Zero-dependency HTTP server for DockerClean-CLI Web Studio.
 * Runs on localhost:3013 with REST API and static asset serving.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const {
  getDiskUsage,
  removeContainers,
  removeImages,
  removeVolumes,
  pruneBuildCache,
  pruneSystem
} = require('../core');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function isPathSafe(baseDir, targetPath) {
  const resolved = path.resolve(baseDir, targetPath);
  return resolved === baseDir || resolved.startsWith(baseDir + path.sep);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function createServer() {
  const uiDir = path.resolve(__dirname, '../ui');

  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // --- REST API ---

    if (pathname === '/api/df' && method === 'GET') {
      try {
        const usage = getDiskUsage();
        return sendJson(res, 200, usage);
      } catch (err) {
        return sendError(res, 500, err.message);
      }
    }

    if (pathname === '/api/prune' && method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const { containers = [], images = [], volumes = [], buildCache = false, force = false } = body;

        const results = {
          containers: { removed: 0 },
          images: { removed: 0 },
          volumes: { removed: 0 },
          cache: { pruned: false }
        };

        if (containers.length > 0) {
          const resContainers = removeContainers(containers, force);
          results.containers.removed = resContainers.removedCount || containers.length;
        }

        if (images.length > 0) {
          const resImages = removeImages(images, force);
          results.images.removed = resImages.removedCount || images.length;
        }

        if (volumes.length > 0) {
          const resVolumes = removeVolumes(volumes);
          results.volumes.removed = resVolumes.removedCount || volumes.length;
        }

        if (buildCache) {
          const resCache = pruneBuildCache();
          results.cache.pruned = resCache.success;
        }

        return sendJson(res, 200, { success: true, results });
      } catch (err) {
        return sendError(res, 500, err.message);
      }
    }

    // --- STATIC ASSET SERVING ---

    if (method === 'GET') {
      let relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
      const filePath = path.resolve(uiDir, relativePath);

      if (!isPathSafe(uiDir, filePath)) {
        return sendError(res, 403, 'Forbidden');
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    sendError(res, 405, 'Method Not Allowed');
  });

  return server;
}

function startServer(port = 3013) {
  const server = createServer();
  server.listen(port, () => {
    const ansi = require('../cli/ansi');
    console.log(`\n🐳 ${ansi.chalk.bold('DockerClean-CLI Web Studio')} is live at:`);
    console.log(`   ${ansi.chalk.cyan(`http://localhost:${port}`)}\n`);
    console.log(`   Press Ctrl+C to stop the server.\n`);
  });
  return server;
}

module.exports = {
  createServer,
  startServer
};
