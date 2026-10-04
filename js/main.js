/* ------------------------------------------------------------------
   El Corazón de la Ciudad · Badajoz
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  const raiz   = document.documentElement;
  const hayGSAP = typeof gsap !== 'undefined';
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fino   = matchMedia('(pointer: fine)').matches;

  // «con-movimiento» SOLO si hay GSAP y no se pide movimiento reducido:
  // si no, los titulares partidos se quedarían escondidos para siempre.
  if (hayGSAP && !quieto) raiz.classList.add('con-movimiento');
  if (hayGSAP) gsap.registerPlugin(ScrollTrigger);

  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

  $('#anno').textContent = new Date().getFullYear();

  /* ============ 1. partir titulares en palabras ============ */
  function partir(h) {
    if (h.dataset.partido) return;
    h.dataset.partido = '1';
    const trozos = Array.from(h.childNodes);
    h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim());
    const envolver = (nodo) => {
      if (nodo.nodeType === 3) {
        const frag = document.createDocumentFragment();
        nodo.textContent.split(/(\s+)/).forEach((t) => {
          if (!t.trim()) { frag.appendChild(document.createTextNode(t)); return; }
          const pal = document.createElement('span');
          pal.className = 'pal';
          const i = document.createElement('i');
          i.textContent = t;
          pal.appendChild(i);
          frag.appendChild(pal);
        });
        nodo.replaceWith(frag);
      } else if (nodo.nodeType === 1) {
        Array.from(nodo.childNodes).forEach(envolver);
      }
    };
    trozos.forEach(envolver);
  }
  $$('[data-partir]').forEach(partir);

  /* ============ 2. Lenis ============ */
  let lenis = null;
  if (typeof Lenis !== 'undefined' && !quieto) {
    lenis = new Lenis({ duration: 1.05, smoothWheel: true, lerp: 0.12 });
    if (hayGSAP) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const bucle = (t) => { lenis.raf(t); requestAnimationFrame(bucle); };
      requestAnimationFrame(bucle);
    }
  }
  const irA = (sel) => {
    const el = $(sel);
    if (!el) return;
    const cab = parseFloat(getComputedStyle(raiz).getPropertyValue('--cab')) || 76;
    const y = el.getBoundingClientRect().top + scrollY - cab - 24;
    if (lenis) lenis.scrollTo(y, { duration: 1.1 });
    else scrollTo({ top: y, behavior: quieto ? 'auto' : 'smooth' });
  };

  /* ============ 3. cortina ============ */
  const cortina = $('#cortina');
  let planoLanzado = false;
  const lanzarPlano = () => {
    if (planoLanzado) return;
    planoLanzado = true;
    dispatchEvent(new Event('plano:arranca'));
  };

  function retirarCortina() {
    if (!cortina || cortina.hasAttribute('hidden')) return;
    cortina.setAttribute('hidden', '');
    document.body.style.removeProperty('overflow');
    if (lenis) lenis.start();
    lanzarPlano();
    entradaHero();
    if (hayGSAP) ScrollTrigger.refresh();
  }

  function entradaHero() {
    const pals = $$('.hero h1 .pal > i');
    if (!hayGSAP || quieto) {
      pals.forEach((p) => (p.style.transform = 'none'));
      $$('.hero .coord, .hero__pie').forEach((e) => (e.style.opacity = 1));
      return;
    }
    // Ojo: el CSS deja las palabras abajo con translateY(102%). GSAP lee eso
    // como «y» en píxeles, así que animar solo yPercent dejaba el titular
    // escondido para siempre. Hay que fijar y:0 y el desplazamiento en yPercent.
    gsap.set(pals, { y: 0, yPercent: 102 });
    gsap.timeline()
      .to(pals, { yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.055 })
      .from('.hero .coord', { opacity: 0, y: 14, duration: 0.8, ease: 'power2.out' }, 0.15)
      .from('.hero__pie', { opacity: 0, y: 26, duration: 0.95, ease: 'power3.out' }, 0.4);
  }

  if (cortina) {
    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();

    // red de seguridad: pase lo que pase, a los 5 s la cortina se va
    const red = setTimeout(retirarCortina, 5000);

    if (hayGSAP && !quieto) {
      const tl = gsap.timeline({
        onComplete: () => { clearTimeout(red); retirarCortina(); },
      });
      tl.set(['#c-tejado', '#c-mano-i', '#c-mano-d', '#c-corazon'],
             { strokeDasharray: 1, strokeDashoffset: 1 })
        // autoRound:false es obligatorio con pathLength=1, si no salta de 1 a 0
        .to('#c-tejado',  { strokeDashoffset: 0, duration: 0.62, ease: 'power2.inOut', autoRound: false })
        .to(['#c-mano-i', '#c-mano-d'], { strokeDashoffset: 0, duration: 0.5, ease: 'power2.out', autoRound: false }, '-=0.18')
        .to('#c-corazon', { strokeDashoffset: 0, duration: 0.52, ease: 'power2.out', autoRound: false }, '-=0.22')
        .to('#cortina-txt', { opacity: 1, duration: 0.45, ease: 'power2.out' }, '-=0.3')
        .to('#c-corazon', { scale: 1.14, transformOrigin: '50px 62px', duration: 0.22, ease: 'power2.out' }, '+=0.1')
        .to('#c-corazon', { scale: 1, transformOrigin: '50px 62px', duration: 0.3, ease: 'power2.inOut' })
        .to(cortina, { yPercent: -100, duration: 0.95, ease: 'expo.inOut' }, '+=0.15');
    } else {
      clearTimeout(red);
      setTimeout(retirarCortina, quieto ? 60 : 500);
    }
  } else {
    lanzarPlano();
  }

  /* ============ 4. cabecera y menú ============ */
  const cab = $('#cab');
  const alScroll = () => cab.classList.toggle('sc', scrollY > 24);
  addEventListener('scroll', alScroll, { passive: true });
  alScroll();

  const btnMenu = $('#menu-btn');
  const menu = $('#menu-movil');
  const cerrarMenu = () => {
    document.body.classList.remove('menu');
    btnMenu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    if (lenis) lenis.start();
  };
  btnMenu.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('menu');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    menu.setAttribute('aria-hidden', String(!abierto));
    if (lenis) abierto ? lenis.stop() : lenis.start();
  });

  // anclas internas
  $$('a[href^="#"]').forEach((a) => {
    const destino = a.getAttribute('href');
    if (destino === '#' || destino.length < 2) return;
    a.addEventListener('click', (e) => {
      if (!$(destino)) return;
      e.preventDefault();
      cerrarMenu();
      irA(destino);
    });
  });

  /* ============ 5. banda infinita ============ */
  const pista = $('#banda-pista');
  if (pista) {
    const grupo = $('[data-banda]', pista);
    for (let i = 0; i < 2; i++) {
      const c = grupo.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      pista.appendChild(c);
    }
    if (hayGSAP && !quieto) {
      const anchoGrupo = () => grupo.getBoundingClientRect().width;
      let tw = gsap.to(pista, {
        x: () => -anchoGrupo(),
        duration: 26,
        ease: 'none',
        repeat: -1,
        modifiers: { x: (x) => (parseFloat(x) % anchoGrupo()) + 'px' },
      });
      addEventListener('resize', () => tw.invalidate());
    }
  }

  /* ============ 6. revelados al entrar ============ */
  if (hayGSAP && !quieto) {
    $$('[data-sube]').forEach((el) => {
      gsap.fromTo(el,
        { opacity: 0, y: 34 },
        {
          opacity: 1, y: 0, duration: 1, ease: 'power3.out',
          immediateRender: false,          // si no, pinta el «from» antes de tiempo
          scrollTrigger: { trigger: el, start: 'top 86%', once: true },
        });
    });
  } else {
    $$('[data-sube]').forEach((el) => (el.style.opacity = 1));
  }

  /* ============ 7. pila de tarjetas ============ */
  const pila = $('#pila');
  if (pila) {
    const items = $$(':scope > li', pila);
    let disparos = [];

    function montarPila() {
      disparos.forEach((d) => d.kill());
      disparos = [];
      items.forEach((li) => (li.style.height = 'auto'));
      pila.style.removeProperty('--reposo');

      // todas las tarjetas, al alto de la más alta (nunca 100vh)
      const alto = Math.max(...items.map((li) => li.offsetHeight));
      const cabe = alto < innerHeight * 0.78;

      if (!cabe) {
        pila.dataset.plana = '1';
        items.forEach((li) => {
          li.style.height = 'auto';
          li.style.position = 'static';
        });
        pila.style.setProperty('--reposo', '0px');
        return;
      }

      delete pila.dataset.plana;
      items.forEach((li) => {
        li.style.height = alto + 'px';
        li.style.removeProperty('position');
      });

      pila.style.setProperty('--reposo', Math.round(innerHeight * 0.12) + 'px');

      if (!hayGSAP || quieto) return;

      // la de debajo se encoge justo hasta que la siguiente se posa encima
      items.forEach((li, i) => {
        const sig = items[i + 1];
        if (!sig) return;
        const tarjeta = $('.sitio', li);
        disparos.push(
          gsap.to(tarjeta, {
            scale: 0.94,
            opacity: 0.55,
            ease: 'none',
            scrollTrigger: {
              trigger: sig,
              start: 'top bottom',
              end: 'top top',          // exactamente en su top, sin margen de más
              scrub: true,
              invalidateOnRefresh: true,
            },
          }).scrollTrigger
        );
      });
    }

    montarPila();
    addEventListener('resize', () => { clearTimeout(pila._t); pila._t = setTimeout(() => { montarPila(); if (hayGSAP) ScrollTrigger.refresh(); }, 200); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => { montarPila(); if (hayGSAP) ScrollTrigger.refresh(); });
    }
  }

  /* ============ 8. botones magnéticos ============ */
  if (fino && hayGSAP && !quieto) {
    $$('[data-iman]').forEach((b) => {
      let act = null;
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.28;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.34;
        act && act.kill();
        act = gsap.to(b, { x: dx, y: dy, duration: 0.5, ease: 'power3.out' });
      });
      b.addEventListener('pointerleave', () => {
        act && act.kill();
        act = gsap.to(b, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1,0.4)' });
      });
    });
  }

  /* ============ 9. visor de fotos ============ */
  const FOTOS = {
    luna: [
      ['luna-salon',   'Salón comedor con sofá verde, mesa blanca y balcón'],
      ['luna-salon-2', 'El salón desde la entrada, con los cuadros enmarcados'],
      ['luna-dorm-1',  'Dormitorio de matrimonio con armario empotrado'],
      ['luna-dorm-2',  'Dormitorio de matrimonio con salida al balcón'],
      ['luna-dorm-3',  'Dormitorio con dos camas individuales y cabeceros de palé'],
      ['luna-dorm-4',  'Tercer dormitorio, con ventilador de techo'],
      ['luna-dorm-5',  'Dormitorio luminoso con colcha beige'],
      ['luna-cocina',  'Cocina con fogones, microondas, lavadora y azulejo hidráulico'],
      ['luna-bano',    'Baño con ducha y suelo hidráulico'],
      ['luna-pasillo', 'El pasillo que une los tres dormitorios'],
      ['portal',       'Portal del edificio en la calle Ramón Albarrán'],
    ],
    ciudad: [
      ['ciudad-salon',   'Salón con sofá chaise longue y mesa de centro de madera maciza'],
      ['ciudad-salon-2', 'Zona de estar del salón, con la cómoda antigua'],
      ['ciudad-dorm-1',  'Dormitorio con cabecero de madera antiguo'],
      ['ciudad-dorm-2',  'Dormitorio con cabecero de forja y armario empotrado'],
      ['ciudad-dorm-3',  'Dormitorio con mesita de noche y cortinas blancas'],
      ['ciudad-dorm-4',  'Dormitorio con cama de forja junto a la ventana'],
      ['ciudad-cocina',  'Cocina con horno, microondas, lavadora y suelo de damero'],
      ['ciudad-bano',    'Baño con lavabo de madera'],
      ['ciudad-ducha',   'Ducha con columna de hidromasaje'],
      ['ciudad-pasillo', 'Pasillo con perchero de forja'],
      ['vista-balcon',   'Vista desde el balcón a la calle Ramón Albarrán'],
      ['fachada',        'Fachada del edificio desde la calle'],
    ],
  };

  const visor  = $('#visor');
  const vImg   = $('#visor-img');
  const vPie   = $('#visor-pie');
  const vCnt   = $('#visor-cuenta');
  let serie = [], idx = 0, antesFoco = null;

  function pintarFoto() {
    const [n, alt] = serie[idx];
    vImg.src = 'img/' + n + '-1600.jpg';
    vImg.alt = alt;
    vPie.textContent = alt;
    vCnt.textContent = (idx + 1) + ' / ' + serie.length;
  }
  function abrirVisor(clave, i) {
    serie = FOTOS[clave] || [];
    if (!serie.length) return;
    idx = Math.min(i || 0, serie.length - 1);
    antesFoco = document.activeElement;
    visor.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();
    pintarFoto();
    $('#visor-x').focus();
  }
  function cerrarVisor() {
    visor.setAttribute('hidden', '');
    document.body.style.removeProperty('overflow');
    if (lenis) lenis.start();
    antesFoco && antesFoco.focus();
  }
  const mover = (d) => { idx = (idx + d + serie.length) % serie.length; pintarFoto(); };

  $('#visor-x').addEventListener('click', cerrarVisor);
  $('#visor-ant').addEventListener('click', () => mover(-1));
  $('#visor-sig').addEventListener('click', () => mover(1));
  visor.addEventListener('click', (e) => { if (e.target === visor) cerrarVisor(); });

  addEventListener('keydown', (e) => {
    if (visor.hasAttribute('hidden')) {
      if (e.key === 'Escape' && document.body.classList.contains('menu')) cerrarMenu();
      return;
    }
    if (e.key === 'Escape') cerrarVisor();
    else if (e.key === 'ArrowLeft') mover(-1);
    else if (e.key === 'ArrowRight') mover(1);
    else if (e.key === 'Tab') {
      // el foco no se escapa del visor
      const f = $$('button', visor);
      const pri = f[0], ult = f[f.length - 1];
      if (e.shiftKey && document.activeElement === pri) { e.preventDefault(); ult.focus(); }
      else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); pri.focus(); }
    }
  });

  $$('[data-galeria]').forEach((g) => {
    const clave = g.dataset.galeria;
    $$('.gal__btn', g).forEach((b) => {
      b.addEventListener('click', () => abrirVisor(clave, parseInt(b.dataset.i, 10) || 0));
      b.setAttribute('aria-label', 'Ver las fotos de este apartamento');
    });
  });
  $$('[data-abrir]').forEach((b) => b.addEventListener('click', () => abrirVisor(b.dataset.abrir, 0)));

  /* ============ 10. cookies ============ */
  const ck = $('#cookies');
  const LLAVE = 'ecdlc-cookies';
  const leer = () => { try { return localStorage.getItem(LLAVE); } catch (e) { return null; } };
  const guardar = (v) => { try { localStorage.setItem(LLAVE, v); } catch (e) {} };

  function ocultarCk() {
    if (hayGSAP && !quieto) {
      gsap.to(ck, { opacity: 0, y: 18, duration: 0.45, ease: 'power2.in',
        onComplete: () => { ck.setAttribute('hidden', ''); gsap.set(ck, { clearProps: 'all' }); } });
    } else ck.setAttribute('hidden', '');
  }
  if (!leer()) {
    setTimeout(() => {
      ck.removeAttribute('hidden');
      if (hayGSAP && !quieto) gsap.from(ck, { opacity: 0, y: 22, duration: 0.6, ease: 'power3.out' });
    }, cortina ? 2600 : 900);
  }
  $('#ck-si').addEventListener('click', () => { guardar('si'); ocultarCk(); });
  $('#ck-no').addEventListener('click', () => { guardar('no'); ocultarCk(); });
  $('#abrir-cookies').addEventListener('click', (e) => {
    e.preventDefault();
    ck.removeAttribute('hidden');
    if (hayGSAP && !quieto) gsap.from(ck, { opacity: 0, y: 22, duration: 0.5, ease: 'power3.out' });
  });

  /* ============ 11. mapa solo al pedirlo ============ */
  const btnMapa = $('#mapa-btn');
  btnMapa.addEventListener('click', () => {
    const marco = document.createElement('iframe');
    marco.src = 'https://www.google.com/maps?q=' +
      encodeURIComponent('Calle Ramón Albarrán 9, 06002 Badajoz') + '&output=embed';
    marco.loading = 'lazy';
    marco.title = 'Mapa con la calle Ramón Albarrán, 9, Badajoz';
    marco.referrerPolicy = 'no-referrer-when-downgrade';
    $('#mapa').appendChild(marco);
    $('#mapa-consent').remove();
  });

  /* ============ 12. cursor propio ============ */
  if (fino && !quieto) {
    const pto = $('#cursor'), aro = $('#cursor-aro');
    let x = innerWidth / 2, y = innerHeight / 2, ax = x, ay = y, vivo = false;

    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      if (!vivo) { vivo = true; ax = x = e.clientX; ay = y = e.clientY; raiz.classList.add('con-cursor'); }
      x = e.clientX; y = e.clientY;
      pto.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    }, { passive: true });

    addEventListener('mouseleave', () => raiz.classList.remove('con-cursor'));
    addEventListener('mouseenter', () => { if (vivo) raiz.classList.add('con-cursor'); });

    (function seguir() {
      ax += (x - ax) * 0.16;
      ay += (y - ay) * 0.16;
      aro.style.transform = 'translate(' + ax + 'px,' + ay + 'px)';
      requestAnimationFrame(seguir);
    })();

    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest('a,button,[role="button"],input,summary');
      raiz.classList.toggle('act', !!t);
    });
  }

  /* ============ 13. refresco final ============ */
  addEventListener('load', () => { if (hayGSAP) ScrollTrigger.refresh(); });
})();
