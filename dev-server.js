/*
 * Local development server (no dependencies):
 *   GEMINI_API_KEY=your_key node dev-server.js   ->  http://localhost:3000
 * Serves the static files and routes POST /api/generate to the same handler Vercel uses.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env if present (KEY=VALUE lines)
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch (e) { /* no .env */ }

const handler = require('./api/generate.js');
const PORT = Number(process.env.PORT) || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const PUBLIC = new Set(['/index.html', '/style.css', '/app.js', '/i18n.js', '/lib/math.js']);

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/generate') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 100000) req.destroy(); });
    req.on('end', () => { req.body = body; handler(req, res); });
    return;
  }
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  if (!PUBLIC.has(file)) { res.statusCode = 404; return res.end('Not found'); }
  fs.readFile(path.join(__dirname, file), (err, data) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('AI Math Differentiator running at http://localhost:' + PORT +
    (process.env.GEMINI_API_KEY ? '' : '  (no GEMINI_API_KEY: offline templates will be used)'));
});
