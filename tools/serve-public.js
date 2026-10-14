/* serve-public.js — tiny static server for local QA of the built page.
   usage: node tools/serve-public.js [port] [dir]                              */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = Number(process.argv[2] || 8123);
const root = path.resolve(process.argv[3] || 'public');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(root, url === '/' ? 'index.html' : url);
  if (!file.startsWith(root)) { res.writeHead(403).end('forbidden'); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }).end('404'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'content-length': buf.length });
    res.end(buf);
  });
}).listen(port, '127.0.0.1', () => console.log('serving ' + root + ' on http://127.0.0.1:' + port));
