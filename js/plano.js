/* ------------------------------------------------------------------
   El plano del hero.
   Dibuja el callejero REAL del casco antiguo de Badajoz saliendo del
   portal, como si alguien lo estuviese trazando a mano en ese momento.
   Los datos vienen de OpenStreetMap (js/callejero.js), en metros
   respecto a la calle Ramon Albarran, 9.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const lienzo = document.getElementById('plano');
  if (!lienzo || !window.CALLEJERO) return;

  const ctx = lienzo.getContext('2d', { alpha: true });
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const TINTA   = '48,36,144';     // indigo de la marca
  const MARCA   = '216,36,26';     // bermellon
  const RADIO_M = 470;             // metros que caben en el radio visible

  // --- trazos: [peso, dmin, x0,y0, x1,y1, ...] -> objetos ---
  const trazos = window.CALLEJERO.map((a) => {
    const pts = [];
    for (let i = 2; i < a.length; i += 2) pts.push(a[i], a[i + 1]);
    return { w: a[0], d: a[1], p: pts, largo: 0 };
  });

  // longitud de cada trazo, para repartir bien el dibujado
  for (const t of trazos) {
    let L = 0;
    for (let i = 2; i < t.p.length; i += 2) {
      L += Math.hypot(t.p[i] - t.p[i - 2], t.p[i + 1] - t.p[i - 1]);
    }
    t.largo = L;
  }

  const DMAX = trazos.reduce((m, t) => Math.max(m, t.d), 1);

  let W = 0, H = 0, dpr = 1, esc = 1, cx = 0, cy = 0;
  let base = null, bctx = null;   // capa con lo ya terminado
  let hechos = 0;                 // cuantos trazos hay ya estampados en la base

  function medir() {
    const r = lienzo.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    lienzo.width = Math.round(W * dpr);
    lienzo.height = Math.round(H * dpr);

    // el plano se encuadra para que quepa el radio util; el portal queda
    // algo por encima del centro, con sitio abajo para el titular
    const util = Math.max(W, H * 1.08);
    esc = (util * 0.62) / RADIO_M;
    cx = W * 0.5;
    // en pantallas estrechas el titular ocupa la mitad de abajo, así que la
    // chincheta sube para no quedar pisada por el texto
    cy = W < 760 ? H * 0.27 : H * 0.40;
    gf = Math.min(1.5, Math.max(0.95, W / 1000));

    base = document.createElement('canvas');
    base.width = lienzo.width;
    base.height = lienzo.height;
    bctx = base.getContext('2d');
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hechos = 0;
  }

  const px = (x) => cx + x * esc;
  const py = (y) => cy + y * esc;

  function estiloTrazo(c, w, alfa) {
    c.strokeStyle = 'rgba(' + TINTA + ',' + alfa + ')';
    c.lineWidth = w;
    c.lineCap = 'round';
    c.lineJoin = 'round';
  }

  // grosor y opacidad segun la jerarquia de la via.
  // El factor compensa las pantallas grandes: con el mismo grosor en px, un
  // plano a 1440 se ve lavado y a 390 se ve bien.
  let gf = 1;
  function grosor(w) {
    if (w >= 4) return 3.3 * gf;   // muralla
    if (w === 3) return 2.5 * gf;  // via principal
    if (w === 2) return 1.65 * gf; // calle
    return 1.0 * gf;               // peatonal
  }
  function alfa(w, t) {
    const a = w >= 3 ? 0.62 : w === 2 ? 0.44 : 0.26;
    return a * t;
  }

  // dibuja un trazo hasta la fraccion f (0..1) de su longitud
  function trazar(c, t, f) {
    const p = t.p;
    c.beginPath();
    c.moveTo(px(p[0]), py(p[1]));
    if (f >= 1) {
      for (let i = 2; i < p.length; i += 2) c.lineTo(px(p[i]), py(p[i + 1]));
      c.stroke();
      return;
    }
    let queda = t.largo * f;
    for (let i = 2; i < p.length; i += 2) {
      const ax = p[i - 2], ay = p[i - 1], bx = p[i], by = p[i + 1];
      const seg = Math.hypot(bx - ax, by - ay);
      if (seg <= queda) {
        c.lineTo(px(bx), py(by));
        queda -= seg;
      } else {
        const k = seg ? queda / seg : 0;
        c.lineTo(px(ax + (bx - ax) * k), py(ay + (by - ay) * k));
        break;
      }
    }
    c.stroke();
  }

  // --- la chincheta: tejado + corazon, como el logo ---
  function chincheta(c, pulso) {
    const x = px(0), y = py(0);
    const r = 11 * gf;

    // dos ondas de halo, desfasadas
    for (const d of [0, 0.5]) {
      const p = (pulso + d) % 1;
      c.beginPath();
      c.arc(x, y, r + 4 + p * 30 * gf, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(' + MARCA + ',' + (0.3 * (1 - p)) + ')';
      c.lineWidth = 1.2 * gf;
      c.stroke();
    }

    // cerco claro para despegarlo del callejero
    c.beginPath();
    c.arc(x, y, r + 3 * gf, 0, Math.PI * 2);
    c.fillStyle = 'rgba(239,238,244,.85)';
    c.fill();

    // punto
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = 'rgb(' + MARCA + ')';
    c.fill();

    // el tejadito de la marca, dentro
    c.beginPath();
    c.moveTo(x - 5.2 * gf, y + 2.2 * gf);
    c.lineTo(x, y - 3.6 * gf);
    c.lineTo(x + 5.2 * gf, y + 2.2 * gf);
    c.strokeStyle = '#fff';
    c.lineWidth = 2.1 * gf;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke();
  }

  // --- rosa de los vientos discreta, arriba a la derecha ---
  function rosa(c, t) {
    if (t <= 0) return;
    const x = W - Math.min(74, W * 0.13), y = Math.min(118, H * 0.17);
    const R = Math.min(22, W * 0.035);
    c.save();
    c.globalAlpha = t * 0.5;
    c.strokeStyle = 'rgba(' + TINTA + ',.55)';
    c.lineWidth = 1;
    c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.stroke();
    c.beginPath();
    c.moveTo(x, y - R - 5); c.lineTo(x, y + R + 5);
    c.moveTo(x - R - 5, y); c.lineTo(x + R + 5, y);
    c.stroke();
    c.beginPath();
    c.moveTo(x, y - R - 5);
    c.lineTo(x - 3.6, y - 2);
    c.lineTo(x + 3.6, y - 2);
    c.closePath();
    c.fillStyle = 'rgba(' + MARCA + ',.85)';
    c.fill();
    c.restore();
  }

  // --- escala grafica abajo a la izquierda ---
  function escala(c, t) {
    if (t <= 0) return;
    const m = 100;                       // 100 metros
    const L = m * esc;
    if (L < 36 || L > W * 0.5) return;
    // arriba a la izquierda: abajo lo tapa el velo que da contraste al titular
    const x = Math.max(24, W * 0.06), y = Math.min(132, H * 0.2);
    c.save();
    c.globalAlpha = t * 0.6;
    c.strokeStyle = 'rgba(' + TINTA + ',.6)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(x, y - 4); c.lineTo(x, y + 4);
    c.moveTo(x, y); c.lineTo(x + L, y);
    c.moveTo(x + L, y - 4); c.lineTo(x + L, y + 4);
    c.moveTo(x + L / 2, y); c.lineTo(x + L / 2, y + 4);
    c.stroke();
    c.fillStyle = 'rgba(' + TINTA + ',.72)';
    c.font = '500 9px Jost, system-ui, sans-serif';
    c.letterSpacing = '1.5px';
    c.fillText('100 M', x, y - 9);
    c.restore();
  }

  // ------------------------------------------------------------------
  let t0 = 0, acabado = false, raf = 0;
  const DUR = 3400;     // lo que tarda el frente en llegar al borde
  const COLA = 620;     // lo que tarda cada calle en trazarse

  function pintar(ahora) {
    if (!t0) t0 = ahora;
    const t = quieto ? 1 : Math.min(1, (ahora - t0) / DUR);
    // el frente avanza con freno al final, como una mano que se va parando
    const frente = (1 - Math.pow(1 - t, 2.4)) * DMAX * 1.02;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 1) estampa en la capa base lo que ya esta entero
    while (hechos < trazos.length) {
      const tr = trazos[hechos];
      const f = (frente - tr.d) / (tr.largo * 0.55 + 30);
      if (f < 1) break;
      estiloTrazo(bctx, grosor(tr.w), alfa(tr.w, 1));
      trazar(bctx, tr, 1);
      hechos++;
    }
    ctx.drawImage(base, 0, 0, W, H);

    // 2) solo se redibujan las calles que estan saliendo ahora mismo
    for (let i = hechos; i < trazos.length; i++) {
      const tr = trazos[i];
      if (tr.d > frente) break;
      const f = Math.min(1, (frente - tr.d) / (tr.largo * 0.55 + 30));
      if (f <= 0) continue;
      estiloTrazo(ctx, grosor(tr.w), alfa(tr.w, Math.min(1, f * 1.6)));
      trazar(ctx, tr, f);
    }

    // 3) adornos de lamina, ya al final
    const tarde = Math.max(0, (t - 0.55) / 0.45);
    rosa(ctx, tarde);
    escala(ctx, tarde);

    // 4) la chincheta, siempre encima
    const pulso = quieto ? 0 : (ahora % 2600) / 2600;
    chincheta(ctx, pulso);

    if (t >= 1 && hechos >= trazos.length) acabado = true;

    // tras acabar seguimos solo por el latido de la chincheta
    raf = requestAnimationFrame(pintar);
  }

  function arrancar() {
    cancelAnimationFrame(raf);
    medir();
    t0 = 0; acabado = false;
    raf = requestAnimationFrame(pintar);
  }

  // el trazado no empieza hasta que la cortina se ha ido
  window.addEventListener('plano:arranca', arrancar, { once: true });

  let remedir;
  addEventListener('resize', () => {
    clearTimeout(remedir);
    remedir = setTimeout(() => {
      const antes = acabado;
      medir();
      if (antes) { t0 = performance.now() - DUR; }   // si ya estaba, repintalo entero
    }, 180);
  });

  // red de seguridad: si nadie lanza el evento, arranca solo
  setTimeout(() => { if (!t0) arrancar(); }, 4200);
})();
