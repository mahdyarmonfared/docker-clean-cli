const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { createServer } = require('../src/server/server');

function makeRequest(server, method, reqPath, body = null) {
  const addr = server.address();
  const port = addr.port;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method,
      headers: {}
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ statusCode: res.statusCode, raw: data, json });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

test('Server - API endpoints and static file serving', async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, resolve));

  try {
    // 1. GET /api/df
    const dfRes = await makeRequest(server, 'GET', '/api/df');
    assert.strictEqual(dfRes.statusCode, 200);
    assert.ok(dfRes.json.summary);
    assert.ok(Array.isArray(dfRes.json.containers));

    // 2. POST /api/prune
    const pruneRes = await makeRequest(server, 'POST', '/api/prune', {
      containers: ['c1'],
      buildCache: true
    });
    assert.strictEqual(pruneRes.statusCode, 200);
    assert.strictEqual(pruneRes.json.success, true);

    // 3. Static HTML serving
    const htmlRes = await makeRequest(server, 'GET', '/');
    assert.strictEqual(htmlRes.statusCode, 200);
    assert.ok(htmlRes.raw.includes('DockerClean Studio'));

    // 4. Static CSS serving
    const cssRes = await makeRequest(server, 'GET', '/style.css');
    assert.strictEqual(cssRes.statusCode, 200);

    // 5. Path traversal protection
    const traversalRes = await makeRequest(server, 'GET', '/../../etc/passwd');
    assert.ok(traversalRes.statusCode === 404 || traversalRes.statusCode === 403);

  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
