/* ------------------------------------------------------------------
   El plano del hero · «Cartografía» de noche.

   Coreografía, en este orden:
     1. La cámara cae desde muy arriba hasta el portal, mientras el
        callejero real se traza saliendo de la chincheta.
     2. Las manzanas del casco antiguo aparecen en silueta.
     3. Breve pausa a ras de calle.
     4. La cámara se retira y, al hacerlo, salen del portal los
        recorridos a pie REALES con sus minutos. Se retira justo para
        que quepan: si no, se saldrían de pantalla.

   Datos de OpenStreetMap (ODbL): js/callejero.js y js/manzanas.js.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const lienzo = document.getElementById('plano');
  if (!lienzo || !window.CALLEJERO) return;

  const ctx = lienzo.getContext('2d');
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // --- tintas de noche ---
  const VIA     = '197,205,255';
  const MANZANA = 'rgba(122,132,218,.17)';
  const BORDE   = 'rgba(152,162,242,.30)';
  const MARCA   = '255,92,72';
  const FONDO   = '#140F3A';
  const ALFA    = { 4: .9, 3: .85, 2: .6, 1: .34 };

  /* Dos maneras de contarlo, se elige con ?hero=a o ?hero=b:
       a · un solo deszoom suave mientras salen los caminos  (por defecto)
       b · la cámara se retira a tirones, uno por cada camino que llega
     Las dos arrancan YA ampliadas, a ras de calle: así desde el primer
     fotograma hay mapa y el callejero se traza encima. */
  const VERSION = (new URLSearchParams(location.search).get('hero') || 'a').toLowerCase() === 'b' ? 'b' : 'a';

  const CERCA = 340;                 // metros de encuadre a ras de calle
  const PAUSA = 0.46;                // hasta aquí solo se dibuja el callejero
  const RITMO = 0.13, LARGO = 0.42;  // cadencia de los caminos (en el tramo final)

  const TRAZOS = window.CALLEJERO.map((a) => {
    const p = [];
    for (let i = 2; i < a.length; i += 2) p.push(a[i], a[i + 1]);
    let L = 0;
    for (let i = 2; i < p.length; i += 2) L += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
    return { w: a[0], d: a[1], p, largo: L };
  });

  const MANZ = (window.MANZANAS || []).map((a) => {
    const p = [];
    for (let i = 1; i < a.length; i += 2) p.push(a[i], a[i + 1]);
    return { d: a[0], p };
  });

  // de más cerca a más lejos: así cada camino que llega pide un poco más de
  // campo que el anterior, y el deszoom acompaña en vez de ir a saltos raros
  const TODAS = (window.RUTAS || []).filter((r) => r.hero).sort((a, b) => a.m - b.m);

  let W = 0, H = 0, dpr = 1, gf = 1, util = 1000, lejos = 1080, cyFin = 0.62;
  let rutas = TODAS, base = null, posado = false, suelo = 400;

  function medir() {
    const r = lienzo.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    lienzo.width = Math.round(W * dpr);
    lienzo.height = Math.round(H * dpr);
    gf = Math.min(1.5, Math.max(0.95, W / 1000));
    util = Math.max(W, H * 1.08);
    // encuadre final: tiene que caber lo más lejos que se enseña (la Alcazaba,
    // a 769 m al norte, y la Puerta de Palmas, a 664 m al oeste)
    lejos = W < 760 ? 950 : 1250;
    cyFin = 0.6;

    // Solo se enseñan los caminos que de verdad CABEN en el encuadre final.
    // En móvil la Puerta de Palmas se sale por la izquierda, así que se cae
    // sola en vez de dibujar una etiqueta pegada al borde.
    const escFin = (util * 0.62) / lejos;
    const cx = W / 2, cy = H * cyFin;
    rutas = TODAS.filter((ru) => {
      const f = ru.p[ru.p.length - 1];
      const x = cx + f[0] * escFin, y = cy + f[1] * escFin;
      // el margen de arriba es corto porque, si la chapa no cabe encima del
      // punto, se coloca debajo con su hilo; lo que no vale es salirse
      return x > 70 && x < W - 70 && y > 50 && y < H - 60;
    });

    // Hasta dónde pueden bajar las chapas: se mide el bloque de texto real en
    // vez de usar una fracción a ojo, que en móvil se quedaba corta y la
    // chapa de la Catedral acababa encima de «de la ciudad».
    const txt = document.querySelector('.hero__env');
    suelo = txt
      ? Math.max(150, txt.getBoundingClientRect().top - r.top - 14)
      : H * 0.55;

    base = null; posado = false;
  }

  // escalera suave: un tirón de cámara por cada camino que llega (versión b)
  function escalon(u, n) {
    let k = 0;
    for (let i = 0; i < n; i++) {
      const ini = i === 0 ? 0 : RITMO * (i - 1) + LARGO;
      const fin = RITMO * i + LARGO;
      if (u <= ini) break;
      const d = Math.min(1, (u - ini) / Math.max(0.01, fin - ini));
      k = (i + (1 - Math.pow(1 - d, 2.4))) / n;
      if (d < 1) break;
    }
    return Math.min(1, k);
  }

  // --- cámara: dónde está y cuánto abarca en cada momento ---
  function camara(t) {
    // mientras se traza el callejero la cámara no se mueve: a ras de calle
    if (t < PAUSA) return { radio: CERCA, cy: 0.42 };
    const u = Math.min(1, (t - PAUSA) / (1 - PAUSA));
    const k = VERSION === 'b'
      ? escalon(u, Math.max(1, rutas.length))
      : 1 - Math.pow(1 - u, 3);
    return { radio: CERCA + (lejos - CERCA) * k, cy: 0.42 + (cyFin - 0.42) * k };
  }

  let esc = 1, cx = 0, cy = 0;
  const px = (x) => cx + x * esc;
  const py = (y) => cy + y * esc;

  function grosor(w) {
    const g = w >= 4 ? 3.3 : w === 3 ? 2.5 : w === 2 ? 1.65 : 1.0;
    return g * gf;
  }

  function trazar(c, t, f) {
    const p = t.p;
    c.beginPath();
    c.moveTo(px(p[0]), py(p[1]));
    if (f >= 1) {
      for (let i = 2; i < p.length; i += 2) c.lineTo(px(p[i]), py(p[i + 1]));
      c.stroke(); return;
    }
    let queda = t.largo * f;
    for (let i = 2; i < p.length; i += 2) {
      const ax = p[i - 2], ay = p[i - 1], bx = p[i], by = p[i + 1];
      const seg = Math.hypot(bx - ax, by - ay);
      if (seg <= queda) { c.lineTo(px(bx), py(by)); queda -= seg; }
      else { const k = seg ? queda / seg : 0;
        c.lineTo(px(ax + (bx - ax) * k), py(ay + (by - ay) * k)); break; }
    }
    c.stroke();
  }

  function manzanas(c, t) {
    if (t <= 0) return;
    c.save();
    c.globalAlpha = Math.min(1, t);
    c.fillStyle = MANZANA; c.strokeStyle = BORDE; c.lineWidth = 0.6 * gf;
    for (const m of MANZ) {
      c.beginPath();
      c.moveTo(px(m.p[0]), py(m.p[1]));
      for (let i = 2; i < m.p.length; i += 2) c.lineTo(px(m.p[i]), py(m.p[i + 1]));
      c.closePath(); c.fill(); c.stroke();
    }
    c.restore();
  }

  function caminos(c, t) {
    if (t <= 0 || !rutas.length) return;
    const chapas = [];
    rutas.forEach((r, i) => {
      const f = Math.max(0, Math.min(1, (t - i * RITMO) / LARGO));
      if (f <= 0) return;
      let L = 0;
      for (let k = 1; k < r.p.length; k++) L += Math.hypot(r.p[k][0] - r.p[k - 1][0], r.p[k][1] - r.p[k - 1][1]);
      let queda = L * f, fin = r.p[0];
      c.save();
      c.strokeStyle = 'rgba(' + MARCA + ',.95)';
      c.lineWidth = 2.6 * gf; c.lineCap = 'round'; c.lineJoin = 'round';
      c.setLineDash([7 * gf, 5 * gf]);
      c.beginPath(); c.moveTo(px(r.p[0][0]), py(r.p[0][1]));
      for (let k = 1; k < r.p.length; k++) {
        const a = r.p[k - 1], b = r.p[k];
        const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (seg <= queda) { c.lineTo(px(b[0]), py(b[1])); queda -= seg; fin = b; }
        else { const kk = seg ? queda / seg : 0;
          fin = [a[0] + (b[0] - a[0]) * kk, a[1] + (b[1] - a[1]) * kk];
          c.lineTo(px(fin[0]), py(fin[1])); break; }
      }
      c.stroke(); c.restore();
      if (f >= 1) chapas.push({ x: px(fin[0]), y: py(fin[1]), etq: r.min + ' min · ' + r.n });
    });
    if (!chapas.length) return;

    c.save();
    c.font = '500 ' + (11 * gf) + 'px Jost, system-ui, sans-serif';
    c.textBaseline = 'middle';
    const al = 21 * gf, sep = 4 * gf, puestas = [];
    const techo = 66;   // por debajo de la cabecera fija
    for (const ch of chapas) {
      const an = c.measureText(ch.etq).width + 16 * gf;
      let ex = Math.min(Math.max(10, ch.x - an / 2), W - an - 10);
      let ey = Math.max(techo, Math.min(ch.y - al - 11 * gf, suelo - al));
      for (let i = 0; i < 16; i++) {
        const choca = puestas.some((p) =>
          ex < p.ex + p.an + sep && ex + an + sep > p.ex &&
          ey < p.ey + al + sep && ey + al + sep > p.ey);
        if (!choca) break;
        ey -= al + sep;                               // busca hueco hacia arriba
        if (ey < techo) { ey = suelo - al; ex += 18 * gf; }
      }
      puestas.push({ ex, ey, an });
      c.strokeStyle = 'rgba(' + MARCA + ',.45)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(ex + an / 2, ey + al / 2); c.lineTo(ch.x, ch.y); c.stroke();
      c.fillStyle = 'rgb(' + MARCA + ')';
      c.beginPath();
      (c.roundRect ? c.roundRect(ex, ey, an, al, 2) : c.rect(ex, ey, an, al));
      c.fill();
      c.fillStyle = '#fff';
      c.fillText(ch.etq, ex + 8 * gf, ey + al / 2);
      c.beginPath(); c.arc(ch.x, ch.y, 3.4 * gf, 0, Math.PI * 2);
      c.fillStyle = 'rgb(' + MARCA + ')'; c.fill();
    }
    // las chapas se dibujan en el lienzo, así que no hay nada en el DOM que
    // medir: se dejan aquí para que verificar.mjs compruebe que no pisan nada
    lienzo.__chapas = puestas.map((p) => ({ x: p.ex, y: p.ey, w: p.an, h: al }));
    c.restore();
  }

  function chincheta(c, pulso) {
    const x = px(0), y = py(0), r = 11 * gf;
    for (const d of [0, 0.5]) {
      const p = (pulso + d) % 1;
      c.beginPath(); c.arc(x, y, r + 4 + p * 30 * gf, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(' + MARCA + ',' + (0.34 * (1 - p)) + ')';
      c.lineWidth = 1.2 * gf; c.stroke();
    }
    c.beginPath(); c.arc(x, y, r + 3 * gf, 0, Math.PI * 2);
    c.fillStyle = 'rgba(20,15,58,.9)'; c.fill();
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = 'rgb(' + MARCA + ')'; c.fill();
    c.beginPath();
    c.moveTo(x - 5.2 * gf, y + 2.2 * gf);
    c.lineTo(x, y - 3.6 * gf);
    c.lineTo(x + 5.2 * gf, y + 2.2 * gf);
    c.strokeStyle = '#fff'; c.lineWidth = 2.1 * gf;
    c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
  }

  // dibuja todo salvo la chincheta, que late aparte
  function escena(c, t) {
    const cam = camara(t);
    esc = (util * 0.62) / cam.radio;
    cx = W / 2; cy = H * cam.cy;
    lienzo.__radio = Math.round(cam.radio);   // para poder medir la cámara desde los tests

    c.fillStyle = FONDO;
    c.fillRect(0, 0, W, H);

    manzanas(c, (t - 0.08) / 0.24);

    // El trazado va por delante de la cámara: cuando esta empieza a retirarse
    // (t = PAUSA) el callejero ya está hecho hasta mucho más lejos de lo que
    // se ve, así que al abrirse el plano no aparecen calles de la nada.
    const frente = 55 + (1 - Math.pow(1 - Math.min(1, t / 0.6), 2.6)) * 1200;

    // Las sendas finas no se leen con la cámara alta, pero un corte seco
    // (radio > 680) las metía TODAS de golpe al cruzar el umbral. Ahora entran
    // con un desvanecido.
    const detalle = Math.max(0, Math.min(1, (900 - cam.radio) / 320));

    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const tr of TRAZOS) {
      if (tr.d > frente) break;
      if (tr.w === 1 && detalle <= 0.02) continue;
      const f = Math.min(1, (frente - tr.d) / (tr.largo * 0.55 + 30));
      if (f <= 0) continue;
      const fino = tr.w === 1 ? detalle : 1;
      c.strokeStyle = 'rgba(' + VIA + ',' + ALFA[tr.w] * Math.min(1, f * 1.6) * fino + ')';
      c.lineWidth = grosor(tr.w);
      trazar(c, tr, f);
    }

    caminos(c, (t - PAUSA) / (1 - PAUSA));
  }

  let t0 = 0, raf = 0;
  const DUR = 5200;

  function pinta(ahora) {
    if (!t0) t0 = ahora;
    const t = quieto ? 1 : Math.min(1, (ahora - t0) / DUR);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (t >= 1 && !posado) {
      // ya está todo quieto: se estampa una vez y a partir de aquí solo
      // se repinta la chincheta, que es lo único que sigue latiendo
      base = document.createElement('canvas');
      base.width = lienzo.width; base.height = lienzo.height;
      const b = base.getContext('2d');
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      escena(b, 1);
      posado = true;
    }

    if (posado) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(base, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      escena(ctx, t);
    }

    chincheta(ctx, quieto ? 0 : (ahora % 2600) / 2600);
    raf = requestAnimationFrame(pinta);
  }

  function arrancar() {
    cancelAnimationFrame(raf);
    medir();
    t0 = 0;
    raf = requestAnimationFrame(pinta);
  }

  window.addEventListener('plano:arranca', arrancar, { once: true });

  let remedir;
  addEventListener('resize', () => {
    clearTimeout(remedir);
    remedir = setTimeout(() => {
      const yaEstaba = posado;
      medir();
      if (yaEstaba) t0 = performance.now() - DUR;   // reencuadra sin repetir el viaje
    }, 180);
  });

  // red de seguridad: si nadie lanza el evento, arranca solo
  setTimeout(() => { if (!t0) arrancar(); }, 4200);
})();
