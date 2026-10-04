import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/alvar/Desktop/WEBS NEGOCIOS/ayuntamiento-usagre-web/');
const { chromium } = require('playwright');

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUERTO = 8731;                 // puerto propio de esta sesion
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const servidor = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(RAIZ, p);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); res.end('no'); return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => servidor.listen(PUERTO, r));
const BASE = `http://localhost:${PUERTO}/`;
console.log('sirviendo en ' + BASE);

const fallos = [], avisos = [];
const mal = (m) => { fallos.push(m); console.log('  FALLO  ' + m); };
const ok = (m) => console.log('  ok     ' + m);
const avi = (m) => { avisos.push(m); console.log('  aviso  ' + m); };

const browser = await chromium.launch({ headless: true });

/* ---------------- 1. escritorio ---------------- */
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const consola = [], red404 = [];
page.on('console', (m) => { if (m.type() === 'error') consola.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400) red404.push(r.status() + ' ' + r.url().replace(BASE, '')); });
page.on('pageerror', (e) => consola.push('pageerror: ' + e.message));

// Apunta cuánto mapa hay dibujado JUSTO cuando la cortina se quita. Si el
// plano no arranca hasta después, el hero aparece vacío medio segundo y
// parece que la página se ha colgado (pasó, y el usuario lo cazó).
await page.addInitScript(() => {
  window.__alDestapar = null;
  const mira = () => {
    const cor = document.getElementById('cortina');
    const c = document.getElementById('plano');
    if (!cor || !c) return requestAnimationFrame(mira);
    if (cor.hasAttribute('hidden') && window.__alDestapar === null) {
      let n = 0, tot = 0;
      try {
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        for (let i = 0; i < d.length; i += 4 * 151) {
          tot++;
          if (Math.abs(d[i] - 20) + Math.abs(d[i + 1] - 15) + Math.abs(d[i + 2] - 58) > 24) n++;
        }
      } catch (e) {}
      window.__alDestapar = tot ? Math.round(n * 100 / tot) : -1;
      return;
    }
    requestAnimationFrame(mira);
  };
  requestAnimationFrame(mira);
});

console.log('\n== escritorio 1440x900 ==');
await page.goto(BASE, { waitUntil: 'load' });

const titulo = await page.title();
if (/Corazón de la Ciudad/.test(titulo)) ok('titulo correcto: ' + titulo);
else mal('titulo inesperado: ' + titulo);

const robots = await page.getAttribute('meta[name="robots"]', 'content');
if (/noindex/.test(robots || '')) ok('noindex puesto'); else mal('falta noindex');

// la cortina debe irse sola
await page.waitForFunction(() => document.getElementById('cortina').hasAttribute('hidden'), null, { timeout: 8000 })
  .then(() => ok('la cortina se retira sola'))
  .catch(() => mal('la cortina NO se retira'));

// el observador escribe en su propio rAF: hay que esperarlo, no leer a ciegas
await page.waitForFunction(() => window.__alDestapar !== null, null, { timeout: 4000 }).catch(() => {});
const alDestapar = await page.evaluate(() => window.__alDestapar);
if (alDestapar > 10) ok(`al destaparse ya hay mapa dibujado (${alDestapar}% del lienzo)`);
else mal(`el hero aparece vacío al quitarse la cortina (solo ${alDestapar}% dibujado)`);

// el body vuelve a poder scrollear
const ov = await page.evaluate(() => getComputedStyle(document.body).overflow);
if (ov !== 'hidden') ok('el scroll queda libre tras la cortina'); else mal('el body sigue con overflow:hidden');

// el plano tiene que haber pintado algo de verdad.
// La coreografía dura 5,2 s (descenso + pausa + retroceso con los caminos),
// así que hay que esperar a que acabe o los caminos aún no están.
await page.waitForTimeout(6600);
// Contar pixeles OPACOS ya no vale: el plano nocturno rellena el fondo, asi
// que saldrian todos. Hay que contar los que se SALEN del color de fondo.
const tinta = await page.evaluate(() => {
  const c = document.getElementById('plano');
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const fondo = [20, 15, 58];               // --noche #140F3A
  let n = 0, total = 0, rojos = 0;
  for (let i = 0; i < d.length; i += 4 * 37) {
    total++;
    const dif = Math.abs(d[i] - fondo[0]) + Math.abs(d[i + 1] - fondo[1]) + Math.abs(d[i + 2] - fondo[2]);
    if (dif > 24) n++;
    if (d[i] > 180 && d[i + 1] < 140 && d[i + 2] < 120) rojos++;   // bermellon: caminos y chincheta
  }
  return { tinta: n, total, rojos, w: c.width, h: c.height };
});
if (tinta.tinta > tinta.total * 0.05) ok(`el plano dibuja el callejero (${tinta.tinta} muestras distintas del fondo de ${tinta.total})`);
else mal(`el plano está casi vacío (${tinta.tinta}/${tinta.total} distintas del fondo)`);
if (tinta.rojos > 20) ok(`los caminos se dibujan (${tinta.rojos} muestras en bermellón)`);
else mal(`no se ven los caminos: solo ${tinta.rojos} muestras en bermellón`);

// las chapas de los minutos no pueden montarse sobre el titular ni salirse
const chapas = await page.evaluate(() => {
  const c = document.getElementById('plano');
  const ch = c.__chapas || [];
  const h1 = document.querySelector('.hero h1').getBoundingClientRect();
  const lz = c.getBoundingClientRect();
  const pisan = ch.filter((p) => {
    const x = lz.left + p.x, y = lz.top + p.y;
    return x < h1.right && x + p.w > h1.left && y < h1.bottom && y + p.h > h1.top;
  }).length;
  const fuera = ch.filter((p) => p.x < 0 || p.y < 0 || p.x + p.w > lz.width || p.y + p.h > lz.height).length;
  return { n: ch.length, pisan, fuera };
});
if (chapas.n >= 4 && !chapas.pisan && !chapas.fuera)
  ok(`${chapas.n} chapas de minutos colocadas, ninguna pisa el titular ni se sale`);
else mal(`chapas: ${chapas.n} dibujadas, ${chapas.pisan} sobre el titular, ${chapas.fuera} fuera del lienzo`);

// Titular: innerText miente (existe aunque esté tapado por overflow:hidden).
// Hay que medir cuánto se desvía cada palabra respecto de su caja recortadora.
const h1 = await page.evaluate(() => {
  const e = document.querySelector('.hero h1');
  const pals = Array.from(e.querySelectorAll('.pal'));
  const fugas = pals.map((p) => {
    const i = p.firstElementChild;
    return Math.round(i.getBoundingClientRect().top - p.getBoundingClientRect().top);
  });
  const r = e.getBoundingClientRect();
  return {
    txt: e.innerText.replace(/\s+/g, ' ').trim(),
    op: getComputedStyle(e).opacity,
    n: pals.length,
    peor: fugas.length ? Math.max(...fugas.map(Math.abs)) : 0,
    enPantalla: r.top < innerHeight && r.bottom > 0 && r.height > 20,
  };
});
if (h1.txt.includes('En el corazón') && h1.op === '1' && h1.enPantalla) ok('titular en pantalla: «' + h1.txt + '»');
else mal('titular no se ve: ' + JSON.stringify(h1));
if (h1.n >= 5 && h1.peor <= 3) ok('las ' + h1.n + ' palabras están asentadas (desvío máx. ' + h1.peor + 'px)');
else mal('palabras del titular escondidas: ' + h1.n + ' partidas, desvío máx. ' + h1.peor + 'px');

// cookies
const ckVis = await page.evaluate(() => {
  const c = document.getElementById('cookies');
  return { oculto: c.hasAttribute('hidden'), disp: getComputedStyle(c).display };
});
if (!ckVis.oculto && ckVis.disp === 'flex') ok('el aviso de cookies aparece y es flex');
else mal('cookies mal: ' + JSON.stringify(ckVis));
await page.click('#ck-si');
await page.waitForTimeout(700);
if (await page.evaluate(() => document.getElementById('cookies').hasAttribute('hidden'))) ok('cookies se cierra al aceptar');
else mal('cookies no se cierra');

// cabecera: blur al bajar
await page.mouse.wheel(0, 400);
await page.waitForTimeout(500);
if (await page.evaluate(() => document.getElementById('cab').classList.contains('sc'))) ok('la cabecera se vuelve translúcida al bajar');
else mal('la cabecera no reacciona al scroll');

// cursor propio: no puede haber dos
await page.mouse.move(700, 450);
await page.waitForTimeout(400);
const cur = await page.evaluate(() => ({
  clase: document.documentElement.classList.contains('con-cursor'),
  body: getComputedStyle(document.body).cursor,
}));
if (cur.clase && cur.body === 'none') ok('cursor propio activo y el del sistema oculto');
else mal('cursor: ' + JSON.stringify(cur));

// visor de fotos
await page.evaluate(() => document.querySelector('[data-abrir="luna"]').click());
await page.waitForTimeout(600);
const v1 = await page.evaluate(() => {
  const v = document.getElementById('visor');
  return { abierto: !v.hasAttribute('hidden'), src: document.getElementById('visor-img').getAttribute('src'),
           cuenta: document.getElementById('visor-cuenta').textContent };
});
if (v1.abierto && /luna-salon-1600/.test(v1.src)) ok('el visor abre con la primera foto (' + v1.cuenta + ')');
else mal('visor mal: ' + JSON.stringify(v1));
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(300);
const v2 = await page.evaluate(() => document.getElementById('visor-cuenta').textContent);
if (v2.trim().startsWith('2')) ok('las flechas pasan foto (' + v2 + ')');
else mal('las flechas no pasan foto: ' + v2);
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
if (await page.evaluate(() => document.getElementById('visor').hasAttribute('hidden'))) ok('Escape cierra el visor');
else mal('Escape no cierra el visor');

/* ---- la pila: bajar en pasos y comprobar que nadie se suelta ---- */
console.log('\n== pila de tarjetas ==');
await page.evaluate(() => document.getElementById('a-pie').scrollIntoView());
await page.waitForTimeout(900);
const info = await page.evaluate(() => {
  const li = Array.from(document.querySelectorAll('#pila > li'));
  return { n: li.length, plana: !!document.getElementById('pila').dataset.plana,
    altos: li.map((l) => l.offsetHeight), mb: li.map((l) => getComputedStyle(l).marginBottom) };
});
const altosIguales = new Set(info.altos).size === 1;
if (info.plana) avi('la pila está desapilada en este tamaño (las tarjetas no caben)');
else {
  if (altosIguales) ok('las ' + info.n + ' tarjetas miden lo mismo (' + info.altos[0] + 'px)');
  else mal('alturas distintas: ' + info.altos.join(', '));
  if (new Set(info.mb).size === 1) ok('mismo margen inferior en todas: ' + info.mb[0]);
  else mal('margenes distintos: ' + info.mb.join(', '));

  let suelta = null, asoma = null;
  for (let k = 0; k < 42; k++) {
    await page.mouse.wheel(0, 90);
    await page.waitForTimeout(90);
    const r = await page.evaluate(() => {
      const li = Array.from(document.querySelectorAll('#pila > li'));
      const cab = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cab')) || 76;
      const tope = cab + 24;
      const tops = li.map((l) => Math.round(l.getBoundingClientRect().top));
      const ult = li[li.length - 1].getBoundingClientRect();
      // ¿asoma algo por DEBAJO de la última mientras la pila está montada?
      const porDebajo = li.slice(0, -1).some((l) => {
        const b = l.getBoundingClientRect();
        return ult.top <= tope + 6 && b.bottom > ult.bottom + 4;
      });
      return { tops, ultTop: Math.round(ult.top), porDebajo, tope };
    });
    // una tarjeta "se suelta" si sube claramente por encima del tope estando aún la última por llegar
    if (suelta === null && r.ultTop > r.tope + 30) {
      const fuga = r.tops.slice(0, -1).findIndex((t) => t < r.tope - 30);
      if (fuga >= 0) suelta = 'la tarjeta ' + (fuga + 1) + ' sube antes de que se pose la última';
    }
    if (asoma === null && r.porDebajo) asoma = 'una tarjeta asoma por debajo de la última';
  }
  suelta ? mal(suelta) : ok('ninguna tarjeta se suelta antes de tiempo');
  asoma ? mal(asoma) : ok('ninguna asoma por debajo de la última');

  // con la pila ya montada, la sección siguiente no puede comerse el pie de
  // la última tarjeta (pasó: un margin-top negativo tapaba dos líneas)
  const tapa = await page.evaluate(() => {
    const li = Array.from(document.querySelectorAll('#pila > li'));
    const ult = li[li.length - 1];
    const r = ult.getBoundingClientRect();
    if (r.bottom < 40 || r.bottom > innerHeight) return null;
    const x = Math.round(r.left + r.width * 0.25);
    const e = document.elementFromPoint(x, Math.round(r.bottom - 8));
    return e && !ult.contains(e) ? (e.className || e.tagName) : null;
  });
  if (tapa) mal('algo tapa el pie de la última tarjeta: ' + tapa);
  else ok('nada tapa el pie de la última tarjeta');
}

/* ---- capturas: con Lenis un scrollTo() no vuelve arriba, y al recargar el
       navegador restaura la posición; hay que entrar por una URL nueva ---- */
await page.addInitScript(() => { history.scrollRestoration = 'manual'; });
await page.goto(BASE + '?captura=1', { waitUntil: 'load' });
await page.waitForFunction(() => document.getElementById('cortina').hasAttribute('hidden'), null, { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(6600);
await page.screenshot({ path: 'pruebas/escritorio-hero.jpg', quality: 80, type: 'jpeg' });
await page.screenshot({ path: 'pruebas/escritorio-completa.jpg', fullPage: true, quality: 72, type: 'jpeg' });

/* ---------------- 2. móvil ---------------- */
console.log('\n== móvil 390x844 ==');
const ctxM = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const pm = await ctxM.newPage();
const consolaM = [];
pm.on('console', (m) => { if (m.type() === 'error') consolaM.push(m.text()); });
pm.on('pageerror', (e) => consolaM.push('pageerror: ' + e.message));
await pm.goto(BASE, { waitUntil: 'load' });
// hay que esperar a la cortina MÁS la coreografía del plano (5,2 s), que no
// empieza hasta que la cortina se va
await pm.waitForFunction(() => document.getElementById('cortina').hasAttribute('hidden'), null, { timeout: 9000 }).catch(() => {});
await pm.waitForTimeout(6600);

const anchoH = await pm.evaluate(() => {
  const vp = 390;
  const culpables = [];
  const recortado = (e) => {
    for (let p = e.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'hidden' || o === 'clip') return true;
    }
    return false;
  };
  document.querySelectorAll('body *').forEach((e) => {
    const r = e.getBoundingClientRect();
    if (r.width > vp + 2 && r.left > -1 && !recortado(e)) {
      culpables.push(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '') + ' ' + Math.round(r.width));
    }
  });
  return { doc: document.documentElement.scrollWidth, win: innerWidth, vp,
           culpables: culpables.slice(0, 6) };
});
if (anchoH.doc <= anchoH.win + 1) ok('sin scroll horizontal (' + anchoH.doc + ' ≤ ' + anchoH.win + ')');
else mal('la página se va de ancho: ' + anchoH.doc + ' > ' + anchoH.win);
if (anchoH.win > anchoH.vp + 2) {
  avi('el viewport se ha ensanchado a ' + anchoH.win + ' (pedimos ' + anchoH.vp + '). Más anchos que la pantalla: ' + (anchoH.culpables.join(' | ') || 'ninguno'));
}
// el titular también tiene que verse en móvil
const h1m = await pm.evaluate(() => {
  const e = document.querySelector('.hero h1');
  const pals = Array.from(e.querySelectorAll('.pal'));
  const peor = pals.length ? Math.max(...pals.map((p) =>
    Math.abs(Math.round(p.firstElementChild.getBoundingClientRect().top - p.getBoundingClientRect().top)))) : 999;
  const r = e.getBoundingClientRect();
  return { peor, alto: Math.round(r.height), arriba: Math.round(r.top) };
});
if (h1m.peor <= 3 && h1m.alto > 20) ok('el titular se ve en móvil (alto ' + h1m.alto + 'px, desvío ' + h1m.peor + 'px)');
else mal('titular escondido en móvil: ' + JSON.stringify(h1m));

// aquí es donde la chapa de la Catedral se montaba sobre «de la ciudad»
const chapasM = await pm.evaluate(() => {
  const c = document.getElementById('plano');
  const ch = c.__chapas || [];
  const h1 = document.querySelector('.hero h1').getBoundingClientRect();
  const lz = c.getBoundingClientRect();
  return {
    n: ch.length,
    pisan: ch.filter((p) => {
      const x = lz.left + p.x, y = lz.top + p.y;
      return x < h1.right && x + p.w > h1.left && y < h1.bottom && y + p.h > h1.top;
    }).length,
    fuera: ch.filter((p) => p.x < 0 || p.x + p.w > lz.width).length,
  };
});
if (chapasM.n >= 3 && !chapasM.pisan && !chapasM.fuera)
  ok(`${chapasM.n} chapas en móvil, ninguna pisa el titular ni se sale`);
else mal(`chapas en móvil: ${chapasM.n}, ${chapasM.pisan} sobre el titular, ${chapasM.fuera} fuera`);

// menú móvil
await pm.click('#menu-btn');
await pm.waitForTimeout(800);
const men = await pm.evaluate(() => {
  const m = document.getElementById('menu-movil');
  const r = m.getBoundingClientRect();
  return { alto: Math.round(r.height), vis: getComputedStyle(m).visibility, top: Math.round(r.top),
           cabBlur: getComputedStyle(document.getElementById('cab')).backdropFilter };
});
if (men.vis === 'visible' && men.alto >= 800) ok('el menú móvil ocupa la pantalla (' + men.alto + 'px)');
else mal('menú móvil raro: ' + JSON.stringify(men));

// El botón del menú NO puede heredar la tipografía de «.menu-movil a»
// (pasó: salía en Cormorant, oscuro y sin padding: «el botón es feísimo»).
const btnMenu = await pm.evaluate(() => {
  const b = document.querySelector('.menu-movil .btn');
  const g = getComputedStyle(b);
  return { fuente: g.fontFamily.split(',')[0].replace(/["']/g, ''), color: g.color,
           fondo: g.backgroundColor, mayus: g.textTransform,
           alto: Math.round(b.getBoundingClientRect().height) };
});
if (btnMenu.fuente === 'Jost' && btnMenu.color === 'rgb(255, 255, 255)' &&
    btnMenu.mayus === 'uppercase' && btnMenu.alto >= 44)
  ok('el botón del menú conserva su estilo (' + btnMenu.fuente + ', ' + btnMenu.alto + 'px)');
else mal('el botón del menú hereda estilos ajenos: ' + JSON.stringify(btnMenu));

// y las dos rayas de la hamburguesa tienen que cruzarse en el mismo punto
const equis = await pm.evaluate(() => {
  const btn = document.getElementById('menu-btn');
  const s = Array.from(btn.querySelectorAll('span')).filter((e) => !e.className);
  const c = s.map((e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const ops = s.map((e) => getComputedStyle(e).opacity);
  return { sep: Math.round(Math.hypot(c[0][0] - c[2][0], c[0][1] - c[2][1])), media: ops[1] };
});
if (equis.sep <= 2 && equis.media === '0') ok('la hamburguesa cierra la X (desvío ' + equis.sep + 'px)');
else mal('la X no cierra: las diagonales quedan a ' + equis.sep + 'px, raya central opacidad ' + equis.media);
await pm.click('#menu-btn');
await pm.waitForTimeout(600);

// que no haya cursor propio en táctil
if (!(await pm.evaluate(() => document.documentElement.classList.contains('con-cursor')))) ok('sin cursor propio en táctil');
else mal('hay cursor propio en táctil');

await pm.screenshot({ path: 'pruebas/movil-hero.jpg', quality: 80, type: 'jpeg' });
await pm.screenshot({ path: 'pruebas/movil-completa.jpg', fullPage: true, quality: 70, type: 'jpeg' });

/* ---------------- 3. movimiento reducido ---------------- */
console.log('\n== movimiento reducido ==');
const ctxR = await browser.newContext({ viewport: { width: 1280, height: 860 }, reducedMotion: 'reduce' });
const pr = await ctxR.newPage();
const consolaR = [];
pr.on('pageerror', (e) => consolaR.push('pageerror: ' + e.message));
await pr.goto(BASE, { waitUntil: 'load' });
await pr.waitForTimeout(2600);
const red = await pr.evaluate(() => {
  const h = document.querySelector('.hero h1');
  const subs = Array.from(document.querySelectorAll('[data-sube]'));
  return {
    cortina: document.getElementById('cortina').hasAttribute('hidden'),
    h1op: getComputedStyle(h).opacity,
    h1txt: h.innerText.replace(/\s+/g, ' ').trim(),
    ocultos: subs.filter((e) => getComputedStyle(e).opacity === '0').length,
    total: subs.length,
  };
});
if (red.cortina) ok('la cortina también se retira con movimiento reducido'); else mal('cortina atascada con movimiento reducido');
if (red.h1op === '1' && red.h1txt.includes('corazón')) ok('el titular se lee: «' + red.h1txt + '»'); else mal('titular oculto con movimiento reducido');
if (red.ocultos === 0) ok('ningún bloque se queda invisible (' + red.total + ' comprobados)');
else mal(red.ocultos + ' de ' + red.total + ' bloques quedan a opacidad 0');
await pr.screenshot({ path: 'pruebas/reducido.jpg', quality: 78, type: 'jpeg' });

/* ---------------- 4. sin JavaScript ---------------- */
console.log('\n== sin JavaScript ==');
const ctxJ = await browser.newContext({ viewport: { width: 1280, height: 860 }, javaScriptEnabled: false });
const pj = await ctxJ.newPage();
await pj.goto(BASE, { waitUntil: 'load' });
await pj.waitForTimeout(800);
const sinJs = await pj.evaluate(() => 1).catch(() => null);
const txt = await pj.innerText('body');
if (txt.includes('En el corazón') && txt.includes('Ramón Albarrán')) ok('el contenido se lee sin JS');
else mal('sin JS no se lee el contenido');
// sin JS la cortina la esconde el <noscript>; comprobamos que el hero se ve
const tapado = await pj.evaluate(() => {
  const h = document.querySelector('.hero h1');
  const r = h.getBoundingClientRect();
  const enMedio = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
  return { visible: r.height > 20 && r.top < innerHeight, encima: enMedio ? enMedio.closest('.cortina') !== null : false };
});
if (tapado.visible && !tapado.encima) ok('sin JS el hero se ve, la cortina no tapa');
else mal('sin JS la página queda tapada: ' + JSON.stringify(tapado));
await pj.screenshot({ path: 'pruebas/sin-js.jpg', quality: 78, type: 'jpeg' });

/* ---------------- 5. páginas legales ---------------- */
console.log('\n== páginas legales ==');
const ctxL = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const pl = await ctxL.newPage();
const consolaL = [];
pl.on('pageerror', (e) => consolaL.push('pageerror: ' + e.message));
pl.on('response', (r) => { if (r.status() >= 400) red404.push(r.status() + ' ' + r.url().replace(BASE, '')); });
for (const [f, debe] of [['aviso-legal.html', 'Ramón Albarrán'], ['privacidad.html', 'cookies']]) {
  await pl.goto(BASE + f, { waitUntil: 'load' });
  const t = await pl.title();
  const rb = await pl.getAttribute('meta[name="robots"]', 'content');
  const cuerpo = await pl.innerText('body');
  const vuelve = await pl.$('a[href="index.html"]');
  if (/Corazón de la Ciudad/.test(t) && /noindex/.test(rb || '') && cuerpo.includes(debe) && vuelve)
    ok(f + ' correcta (noindex, contenido y vuelta a portada)');
  else mal(f + ' mal: titulo="' + t + '" robots="' + rb + '" contiene="' + cuerpo.includes(debe) + '" volver=' + !!vuelve);
}
// y que el pie de la portada enlace a ambas
await pl.goto(BASE, { waitUntil: 'load' });
const enlaces = await pl.$$eval('.pie a[href$=".html"]', (as) => as.map((a) => a.getAttribute('href')));
if (enlaces.includes('aviso-legal.html') && enlaces.includes('privacidad.html')) ok('el pie enlaza las dos páginas legales');
else mal('faltan enlaces legales en el pie: ' + enlaces.join(', '));

/* ---------------- cierre ---------------- */
await browser.close();
servidor.close();

console.log('\n================ RESUMEN ================');
const todasConsolas = [...consola, ...consolaM, ...consolaR, ...consolaL];
if (todasConsolas.length) { console.log('errores de consola:'); todasConsolas.forEach((c) => console.log('   ' + c.slice(0, 180))); }
else console.log('0 errores de consola');
if (red404.length) { console.log('respuestas >=400:'); [...new Set(red404)].forEach((r) => console.log('   ' + r)); }
else console.log('0 respuestas 404/500');
console.log(`\nfallos: ${fallos.length}   avisos: ${avisos.length}`);
fallos.forEach((f) => console.log('  FALLO  ' + f));
avisos.forEach((a) => console.log('  aviso  ' + a));
process.exit(fallos.length || todasConsolas.length || red404.length ? 1 : 0);
