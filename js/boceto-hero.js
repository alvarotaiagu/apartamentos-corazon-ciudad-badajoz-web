/* Motor de plano para los bocetos de hero.
   Mismo callejero real de siempre; lo que cambia es la paleta y las capas. */
(function () {
  'use strict';

  const TRAZOS = (window.CALLEJERO || []).map((a) => {
    const p = [];
    for (let i = 2; i < a.length; i += 2) p.push(a[i], a[i + 1]);
    let L = 0;
    for (let i = 2; i < p.length; i += 2) L += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
    return { w: a[0], d: a[1], p, largo: L };
  });
  const DMAX = TRAZOS.reduce((m, t) => Math.max(m, t.d), 1);

  const MANZ = (window.MANZANAS || []).map((a) => {
    const p = [];
    for (let i = 1; i < a.length; i += 2) p.push([a[i], a[i + 1]]);
    return { d: a[0], p };
  });

  const RUTAS = window.RUTAS || [];

  const PALETAS = {
    claro: {
      fondo: '#EFEEF4', via: '48,36,144', manzana: 'rgba(48,36,144,.085)',
      borde: 'rgba(48,36,144,.2)', marca: '216,36,26', texto: 'rgba(48,36,144,.7)',
      halo: 'rgba(239,238,244,.85)',
      alfa: { 3: .62, 2: .44, 1: .26, 4: .7 },
    },
    noche: {
      fondo: '#140F3A', via: '197,205,255', manzana: 'rgba(120,130,215,.16)',
      borde: 'rgba(150,160,240,.3)', marca: '255,92,72', texto: 'rgba(205,210,255,.75)',
      halo: 'rgba(20,15,58,.9)',
      alfa: { 3: .85, 2: .6, 1: .34, 4: .9 },
    },
  };

  class Plano {
    constructor(lienzo, cfg) {
      this.c = lienzo;
      this.ctx = lienzo.getContext('2d');
      this.cfg = Object.assign({
        paleta: 'claro', manzanas: false, rutas: false, zoom: false,
        calado: false, radio: 470, cyRel: 0.4, dur: 3400,
      }, cfg);
      this.pal = PALETAS[this.cfg.paleta];
      this.raf = 0; this.t0 = 0; this.corriendo = false;
      this.medir();
    }

    medir() {
      const r = this.c.getBoundingClientRect();
      this.dpr = Math.min(devicePixelRatio || 1, 2);
      this.W = Math.max(1, Math.round(r.width));
      this.H = Math.max(1, Math.round(r.height));
      this.c.width = Math.round(this.W * this.dpr);
      this.c.height = Math.round(this.H * this.dpr);
      const util = Math.max(this.W, this.H * 1.08);
      this.escBase = (util * 0.62) / this.cfg.radio;
      this.cx = this.W * 0.5;
      this.cy = this.H * (this.W < 760 ? 0.3 : this.cfg.cyRel);
      this.gf = Math.min(1.5, Math.max(0.95, this.W / 1000));
      // hasta donde merece la pena dibujar (con zoom hay que pintarlo todo,
      // porque al principio la camara esta muy arriba)
      this.corte = this.cfg.zoom ? 1e9 : this.cfg.radio * 1.7;
      this.base = null;
      this._masc = null;
    }

    grosor(w) {
      const g = w >= 4 ? 3.3 : w === 3 ? 2.5 : w === 2 ? 1.65 : 1.0;
      return g * this.gf * this.k;
    }

    px(x) { return this.cx + x * this.esc; }
    py(y) { return this.cy + y * this.esc; }

    trazar(ctx, t, f) {
      const p = t.p;
      ctx.beginPath();
      ctx.moveTo(this.px(p[0]), this.py(p[1]));
      if (f >= 1) {
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(this.px(p[i]), this.py(p[i + 1]));
        ctx.stroke(); return;
      }
      let queda = t.largo * f;
      for (let i = 2; i < p.length; i += 2) {
        const ax = p[i - 2], ay = p[i - 1], bx = p[i], by = p[i + 1];
        const seg = Math.hypot(bx - ax, by - ay);
        if (seg <= queda) { ctx.lineTo(this.px(bx), this.py(by)); queda -= seg; }
        else { const kk = seg ? queda / seg : 0;
          ctx.lineTo(this.px(ax + (bx - ax) * kk), this.py(ay + (by - ay) * kk)); break; }
      }
      ctx.stroke();
    }

    manzanas(ctx, t) {
      if (!this.cfg.manzanas || t <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t);
      ctx.fillStyle = this.pal.manzana;
      ctx.strokeStyle = this.pal.borde;
      ctx.lineWidth = 0.6 * this.gf;
      for (const m of MANZ) {
        if (m.d > this.cfg.radio * 1.15) continue;
        ctx.beginPath();
        ctx.moveTo(this.px(m.p[0][0]), this.py(m.p[0][1]));
        for (let i = 1; i < m.p.length; i++) ctx.lineTo(this.px(m.p[i][0]), this.py(m.p[i][1]));
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }

    caminos(ctx, t) {
      if (!this.cfg.rutas || t <= 0) return;
      const ctx2 = ctx;
      const chapas = [];      // se colocan al final, para que no se pisen
      RUTAS.forEach((r, i) => {
        const ini = 0.12 * i;
        const f = Math.max(0, Math.min(1, (t - ini) / 0.5));
        if (f <= 0) return;
        let L = 0;
        for (let k = 1; k < r.p.length; k++) L += Math.hypot(r.p[k][0] - r.p[k - 1][0], r.p[k][1] - r.p[k - 1][1]);
        let queda = L * f;
        ctx2.save();
        ctx2.strokeStyle = 'rgba(' + this.pal.marca + ',.92)';
        ctx2.lineWidth = 2.6 * this.gf;
        ctx2.lineCap = 'round'; ctx2.lineJoin = 'round';
        ctx2.setLineDash([7 * this.gf, 5 * this.gf]);
        ctx2.beginPath();
        ctx2.moveTo(this.px(r.p[0][0]), this.py(r.p[0][1]));
        let fin = [r.p[0][0], r.p[0][1]];
        for (let k = 1; k < r.p.length; k++) {
          const a = r.p[k - 1], b = r.p[k];
          const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (seg <= queda) { ctx2.lineTo(this.px(b[0]), this.py(b[1])); queda -= seg; fin = b; }
          else { const kk = seg ? queda / seg : 0;
            fin = [a[0] + (b[0] - a[0]) * kk, a[1] + (b[1] - a[1]) * kk];
            ctx2.lineTo(this.px(fin[0]), this.py(fin[1])); break; }
        }
        ctx2.stroke();
        ctx2.setLineDash([]);
        ctx2.restore();
        if (f >= 1) chapas.push({ x: this.px(fin[0]), y: this.py(fin[1]), etq: r.min + ' min · ' + r.n });
      });

      if (!chapas.length) return;
      ctx2.save();
      ctx2.font = '500 ' + (11 * this.gf) + 'px Jost, system-ui, sans-serif';
      ctx2.textBaseline = 'middle';
      const al = 20 * this.gf, sep = 4 * this.gf;
      const puestas = [];
      for (const ch of chapas) {
        const an = ctx2.measureText(ch.etq).width + 16 * this.gf;
        let ex = Math.min(Math.max(10, ch.x - an / 2), this.W - an - 10);
        // intenta arriba del punto; si choca, va bajando hasta encontrar hueco
        const arriba = ch.y - al - 10 * this.gf;
        const abajo = ch.y + 10 * this.gf;
        let ey = arriba > 10 ? arriba : abajo;
        for (let intento = 0; intento < 14; intento++) {
          const choca = puestas.some((p) =>
            ex < p.ex + p.an + sep && ex + an + sep > p.ex &&
            ey < p.ey + al + sep && ey + al + sep > p.ey);
          if (!choca) break;
          ey += al + sep;
          if (ey + al > this.H - 10) { ey = 10; ex += 14 * this.gf; }
        }
        puestas.push({ ex, ey, an });
        // hilo de la chapa al punto exacto
        ctx2.strokeStyle = 'rgba(' + this.pal.marca + ',.5)';
        ctx2.lineWidth = 1;
        ctx2.beginPath();
        ctx2.moveTo(ex + an / 2, ey + al / 2);
        ctx2.lineTo(ch.x, ch.y);
        ctx2.stroke();
        ctx2.fillStyle = 'rgb(' + this.pal.marca + ')';
        ctx2.beginPath();
        (ctx2.roundRect ? ctx2.roundRect(ex, ey, an, al, 2) : ctx2.rect(ex, ey, an, al));
        ctx2.fill();
        ctx2.fillStyle = '#fff';
        ctx2.fillText(ch.etq, ex + 8 * this.gf, ey + al / 2);
        ctx2.beginPath();
        ctx2.arc(ch.x, ch.y, 3.4 * this.gf, 0, Math.PI * 2);
        ctx2.fillStyle = 'rgb(' + this.pal.marca + ')'; ctx2.fill();
      }
      ctx2.restore();
    }

    chincheta(ctx, pulso) {
      const x = this.px(0), y = this.py(0), r = 11 * this.gf * this.k;
      for (const d of [0, 0.5]) {
        const p = (pulso + d) % 1;
        ctx.beginPath();
        ctx.arc(x, y, r + 4 + p * 30 * this.gf, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(' + this.pal.marca + ',' + (0.3 * (1 - p)) + ')';
        ctx.lineWidth = 1.2 * this.gf; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x, y, r + 3 * this.gf, 0, Math.PI * 2);
      ctx.fillStyle = this.pal.halo; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgb(' + this.pal.marca + ')'; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 5.2 * this.gf, y + 2.2 * this.gf);
      ctx.lineTo(x, y - 3.6 * this.gf);
      ctx.lineTo(x + 5.2 * this.gf, y + 2.2 * this.gf);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.1 * this.gf;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    }

    adornos(ctx, t) {
      if (t <= 0) return;
      const x = this.W - Math.min(74, this.W * 0.13), y = Math.min(118, this.H * 0.17);
      const R = Math.min(22, this.W * 0.035);
      ctx.save(); ctx.globalAlpha = t * 0.5;
      ctx.strokeStyle = 'rgba(' + this.pal.via + ',.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - R - 5); ctx.lineTo(x, y + R + 5);
      ctx.moveTo(x - R - 5, y); ctx.lineTo(x + R + 5, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y - R - 5);
      ctx.lineTo(x - 3.6, y - 2); ctx.lineTo(x + 3.6, y - 2); ctx.closePath();
      ctx.fillStyle = 'rgba(' + this.pal.marca + ',.85)'; ctx.fill();
      ctx.restore();
    }

    // las dos líneas del rótulo, en un lienzo propio, para recortar de una vez
    mascara() {
      if (this._masc && this._mascW === this.c.width) return this._masc;
      const m = document.createElement('canvas');
      m.width = this.c.width; m.height = this.c.height;
      const g = m.getContext('2d');
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const tipo = (s) => '600 ' + s + 'px "Cormorant Garamond", Georgia, serif';
      let fs = Math.min(this.W / 4.4, this.H / 2.9);
      // el rótulo tiene que CABER: se mide y se encoge hasta el ancho útil
      g.font = tipo(fs);
      const ancho = Math.max(g.measureText('EN EL').width, g.measureText('CORAZÓN').width);
      fs *= Math.min(1, (this.W * 0.86) / ancho);
      g.font = tipo(fs);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#000';
      const cy = this.H * 0.4;
      g.fillText('EN EL', this.W / 2, cy - fs * 0.45);
      g.fillText('CORAZÓN', this.W / 2, cy + fs * 0.45);
      this._masc = m; this._mascW = this.c.width;
      return m;
    }

    pinta(ahora) {
      if (!this.t0) this.t0 = ahora;
      const cfg = this.cfg;
      const t = Math.min(1, (ahora - this.t0) / cfg.dur);
      const ctx = this.ctx;

      // zoom: la camara entra desde muy lejos
      if (cfg.zoom) {
        const z = 1 - Math.pow(1 - Math.min(1, t / 0.75), 3);
        this.esc = this.escBase * (0.1 + 0.9 * z);
        this.k = 0.35 + 0.65 * z;
      } else { this.esc = this.escBase; this.k = 1; }

      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = this.pal.fondo;
      ctx.fillRect(0, 0, this.W, this.H);

      const frente = cfg.zoom ? DMAX * 2 : (1 - Math.pow(1 - t, 2.4)) * DMAX * 1.02;

      this.manzanas(ctx, cfg.zoom ? t : (t - 0.25) / 0.5);

      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const tr of TRAZOS) {
        if (tr.d > frente) break;
        if (tr.d > this.corte) continue;
        const f = Math.min(1, (frente - tr.d) / (tr.largo * 0.55 + 30));
        if (f <= 0) continue;
        ctx.strokeStyle = 'rgba(' + this.pal.via + ',' + (this.pal.alfa[tr.w] || 0.4) * Math.min(1, f * 1.6) + ')';
        ctx.lineWidth = this.grosor(tr.w);
        this.trazar(ctx, tr, f);
      }

      this.caminos(ctx, (t - 0.3) / 0.7);
      if (!cfg.rutas) this.adornos(ctx, Math.max(0, (t - 0.55) / 0.45));
      this.chincheta(ctx, (ahora % 2600) / 2600);

      // Calado: el plano solo se ve dentro de las letras.
      // OJO: con destination-in cada dibujo se INTERSECA con lo anterior, así
      // que dos fillText seguidos (dos renglones a distinta altura) dejan el
      // lienzo vacío. Hay que montar la máscara entera aparte y recortar UNA vez.
      if (cfg.calado) {
        const m = this.mascara();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(m, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      }

      this.raf = requestAnimationFrame(this.pinta.bind(this));
    }

    arranca() {
      if (this.corriendo) return;
      this.corriendo = true; this.t0 = 0;
      this.raf = requestAnimationFrame(this.pinta.bind(this));
    }
    para() { cancelAnimationFrame(this.raf); this.corriendo = false; }
    reinicia() { this.para(); this.medir(); this.arranca(); }
  }

  window.PlanoBoceto = Plano;
})();
