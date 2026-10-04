/* Comprueba la web YA PUBLICADA en GitHub Pages, bajo el prefijo del repo. */
import { createRequire } from 'node:module';
const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/ayuntamiento-usagre-web/');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'https://alvarotaiagu.github.io/apartamentos-corazon-ciudad-badajoz-web/';
const fallos = [];
const mal = (m) => { fallos.push(m); console.log('  FALLO  ' + m); };
const ok = (m) => console.log('  ok     ' + m);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const rotos = [], consola = [];
page.on('response', (r) => { if (r.status() >= 400) rotos.push(r.status() + ' ' + r.url()); });
page.on('console', (m) => { if (m.type() === 'error') consola.push(m.text()); });
page.on('pageerror', (e) => consola.push('pageerror: ' + e.message));

console.log('== ' + BASE + ' ==');
await page.goto(BASE, { waitUntil: 'load', timeout: 60000 });

const t = await page.title();
/Corazón de la Ciudad/.test(t) ? ok('título: ' + t) : mal('título: ' + t);

const rb = await page.getAttribute('meta[name="robots"]', 'content');
/noindex/.test(rb || '') ? ok('noindex puesto') : mal('FALTA noindex en producción');

// la hoja de estilos ha cargado de verdad (no solo el <link>)
const estilado = await page.evaluate(() => {
  const b = getComputedStyle(document.body);
  return { bg: b.backgroundColor, fuente: b.fontFamily.split(',')[0] };
});
if (estilado.bg === 'rgb(239, 238, 244)') ok('el CSS carga bajo el prefijo (fondo ' + estilado.bg + ')');
else mal('el CSS NO carga: fondo ' + estilado.bg);

await page.waitForFunction(() => document.getElementById('cortina').hasAttribute('hidden'), null, { timeout: 9000 })
  .then(() => ok('la cortina se retira')).catch(() => mal('la cortina no se retira'));
await page.waitForTimeout(6800);   // la coreografía del plano dura 5,2 s

// el plano es nocturno y rellena el fondo: hay que contar lo que se SALE del
// color de fondo, no los pixeles opacos (saldrian todos)
const tinta = await page.evaluate(() => {
  const c = document.getElementById('plano'); const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let n = 0, rojos = 0, total = 0;
  for (let i = 0; i < d.length; i += 4 * 37) {
    total++;
    if (Math.abs(d[i] - 20) + Math.abs(d[i + 1] - 15) + Math.abs(d[i + 2] - 58) > 24) n++;
    if (d[i] > 180 && d[i + 1] < 140 && d[i + 2] < 120) rojos++;
  }
  return { n, rojos, total, chapas: (c.__chapas || []).length };
});
tinta.n > tinta.total * 0.05
  ? ok(`el plano dibuja el callejero (${tinta.n}/${tinta.total} fuera del fondo)`)
  : mal(`el plano está vacío (${tinta.n}/${tinta.total})`);
tinta.rojos > 20 && tinta.chapas >= 4
  ? ok(`los caminos salen con sus minutos (${tinta.chapas} chapas)`)
  : mal(`caminos mal: ${tinta.rojos} muestras rojas, ${tinta.chapas} chapas`);

const h1 = await page.evaluate(() => {
  const e = document.querySelector('.hero h1');
  const pals = Array.from(e.querySelectorAll('.pal'));
  const peor = Math.max(...pals.map((p) => Math.abs(Math.round(
    p.firstElementChild.getBoundingClientRect().top - p.getBoundingClientRect().top))));
  return { txt: e.innerText.replace(/\s+/g, ' ').trim(), peor, n: pals.length };
});
(h1.peor <= 3 && h1.n >= 5) ? ok('titular visible: «' + h1.txt + '»') : mal('titular escondido: ' + JSON.stringify(h1));

// una foto de verdad, no un hueco
const foto = await page.evaluate(() => {
  const i = document.querySelector('.gal__btn img');
  return { src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 100, w: i.naturalWidth };
});
foto.ok ? ok('las fotos cargan (' + foto.src + ', ' + foto.w + 'px)') : mal('foto rota: ' + JSON.stringify(foto));

// páginas legales bajo el prefijo
for (const f of ['aviso-legal.html', 'privacidad.html']) {
  const r = await page.goto(BASE + f, { waitUntil: 'load', timeout: 45000 });
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const rb2 = await page.getAttribute('meta[name="robots"]', 'content');
  if (r.status() === 200 && bg === 'rgb(239, 238, 244)' && /noindex/.test(rb2 || '')) ok(f + ' en vivo, con estilos y noindex');
  else mal(f + ': status ' + r.status() + ' fondo ' + bg + ' robots ' + rb2);
}

await browser.close();
console.log('\n--- recursos rotos ---');
rotos.length ? rotos.forEach((r) => console.log('  ' + r)) : console.log('  ninguno');
console.log('--- errores de consola ---');
consola.length ? consola.forEach((c) => console.log('  ' + c.slice(0, 160))) : console.log('  ninguno');
console.log('\nfallos: ' + fallos.length);
process.exit(fallos.length || rotos.length ? 1 : 0);
