// Servidor estático mínimo para desarrollo local: node scripts/serve.mjs [carpeta] [puerto]
// Las rutas /api/* se reenvían al backend (ALGARROBO_API, por defecto http://localhost:8080), así la
// web de desarrollo ve los mismos datos que el panel. Si el backend está apagado, /api responde 404
// y la web pasa sola a su modo de demostración.
import { createServer, request } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const port = Number(process.argv[3] ?? 5173);
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

const api = new URL(process.env.ALGARROBO_API ?? 'http://localhost:8080');

function reenviar(req, res) {
  const salida = request({
    host: api.hostname, port: api.port, method: req.method, path: req.url,
    headers: { ...req.headers, host: api.host },
  }, (respuesta) => {
    res.writeHead(respuesta.statusCode, respuesta.headers);
    respuesta.pipe(res);
  });
  salida.on('error', () => { if (!res.headersSent) res.writeHead(404).end('Sin backend'); });
  req.pipe(salida);
}

createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) { reenviar(req, res); return; }
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  let file = join(root, path);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404).end('No encontrado');
  }
}).listen(port, () => console.log(`Sirviendo ${root} en http://localhost:${port}`));
