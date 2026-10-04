/* Recorre la web de verdad (con rueda, que es lo único que entiende Lenis)
   y captura cada sección ya revelada y con las fotos cargadas. */
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/ayuntamiento-usagre-web/');
const { chromium } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8732;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml' };

const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => servidor.listen(PUERTO, r));

const ancho = Number(process.argv[2]) || 1440;
const alto = Number(process.argv[3]) || 900;
const sufijo = process.argv[4] || 'esc';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: ancho, height: alto },
  isMobile: ancho < 700, hasTouch: ancho < 700, deviceScaleFactor: ancho < 700 ? 2 : 1,
});
const page = await ctx.newPage();
await page.addInitScript(() => { history.scrollRestoration = 'manual'; });
await page.goto(`http://localhost:${PUERTO}/`, { waitUntil: 'load' });
await page.waitForFunction(() => document.getElementById('cortina').hasAttribute('hidden'), null, { timeout: 9000 }).catch(() => {});
await page.waitForTimeout(5200);
await page.evaluate(() => { const b = document.getElementById('ck-si'); b && b.click(); });
await page.waitForTimeout(600);

// baja del todo despacio para que se revele todo y carguen las fotos
const altoDoc = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < altoDoc; y += Math.round(alto * 0.45)) {
  await page.mouse.wheel(0, Math.round(alto * 0.45));
  await page.waitForTimeout(240);
}
await page.waitForTimeout(1200);
// y vuelve arriba
for (let y = 0; y < altoDoc + alto * 2; y += Math.round(alto * 0.9)) {
  await page.mouse.wheel(0, -Math.round(alto * 0.9));
  await page.waitForTimeout(90);
}
await page.waitForTimeout(1400);

const dir = path.join(RAIZ, 'pruebas');
fs.mkdirSync(dir, { recursive: true });

async function hasta(sel) {
  // desplaza con rueda hasta dejar la sección arriba
  for (let i = 0; i < 160; i++) {
    const d = await page.evaluate((s) => {
      const e = document.querySelector(s);
      if (!e) return 0;
      const cab = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cab')) || 76;
      return Math.round(e.getBoundingClientRect().top - cab - 12);
    }, sel);
    if (Math.abs(d) < 14) break;
    await page.mouse.wheel(0, Math.max(-420, Math.min(420, d)));
    await page.waitForTimeout(70);
  }
  await page.waitForTimeout(650);
}

const tomas = [
  ['portal', '#portal'],
  ['apartamentos', '#apartamentos'],
  ['apt-luna', '[data-apt="luna"]'],
  ['apt-ciudad', '[data-apt="ciudad"]'],
  ['a-pie', '#a-pie'],
  ['pila-montada', '#pila > li:nth-child(3)'],
  ['dicen', '#dicen'],
  ['donde', '#donde'],
];
for (const [nombre, sel] of tomas) {
  await hasta(sel);
  const f = path.join(dir, `${sufijo}-${nombre}.jpg`);
  await page.screenshot({ path: f, quality: 82, type: 'jpeg' });
  console.log('  ' + path.basename(f));
}

// el visor abierto
await page.evaluate(() => document.querySelector('[data-abrir="ciudad"]').click());
await page.waitForTimeout(1100);
await page.screenshot({ path: path.join(dir, `${sufijo}-visor.jpg`), quality: 82, type: 'jpeg' });
console.log('  ' + sufijo + '-visor.jpg');

await browser.close();
servidor.close();
console.log('listo');
