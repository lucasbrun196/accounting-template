/* ==========================================================================
   Lastro Contabilidade — interações
   Sem dependências. Tudo roda num único loop de requestAnimationFrame.
   ========================================================================== */
(() => {
  'use strict';
  window.__lastro = true;

  const html = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const lerp = (a, b, t) => a + (b - a) * t;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const wideQuery = matchMedia('(min-width: 901px)');

  const fmt = {
    int: new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }),
    brl: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
    brl2: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };
  const format = (v, type) => (fmt[type] || fmt.int).format(v);

  /* ------------------------------------------------------------------
     Padrões guilloché (como os de cédulas), gerados em SVG
     ------------------------------------------------------------------ */
  const GUILLOCHE = {
    rosette: {
      size: 1000,
      bands: [
        { n: 28, k: 12, r: 330, a: 58, steps: 360 },
        { n: 22, k: 30, r: 452, a: 26, steps: 600, mod: [5, 0.45] },
        { n: 18, k: 7, r: 168, a: 54, steps: 280 },
      ],
      circles: [392, 398, 494, 499, 244],
    },
    rings: {
      size: 1000,
      bands: [
        { n: 26, k: 16, r: 400, a: 34, steps: 420 },
        { n: 16, k: 9, r: 250, a: 40, steps: 300 },
      ],
      circles: [452, 458],
    },
    seal: {
      size: 200,
      bands: [
        { n: 16, k: 14, r: 78, a: 7, steps: 260 },
        { n: 12, k: 6, r: 45, a: 15, steps: 180 },
      ],
      circles: [92, 95, 62],
    },
  };

  function polarPath(c, steps, radius) {
    let d = '';
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const r = radius(t);
      d += (i ? 'L' : 'M') + (c + r * Math.cos(t)).toFixed(1) + ' ' + (c + r * Math.sin(t)).toFixed(1);
    }
    return d + 'Z';
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  function drawGuilloche(svg) {
    const type = svg.dataset.guilloche;
    const frag = document.createDocumentFragment();

    if (type === 'waves') {
      const W = 460, H = 300;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      [1, -1].forEach((dir) => {
        for (let j = -3; j < 38; j++) {
          let d = '';
          for (let x = 0; x <= W; x += 6) {
            const y = j * 8.4 + 7 * Math.sin(x * 0.028 + j * 0.42 * dir) + 3 * Math.sin(x * 0.011 - j * 0.2);
            d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(1);
          }
          frag.appendChild(svgEl('path', { d }));
        }
      });
      svg.appendChild(frag);
      return;
    }

    const cfg = GUILLOCHE[type];
    if (!cfg) return;
    const c = cfg.size / 2;
    svg.setAttribute('viewBox', `0 0 ${cfg.size} ${cfg.size}`);
    cfg.bands.forEach((b) => {
      for (let j = 0; j < b.n; j++) {
        const ph = (j / b.n) * Math.PI * 2;
        const d = polarPath(c, b.steps, (t) => {
          const m = b.mod ? 1 - b.mod[1] + b.mod[1] * Math.cos(b.mod[0] * t) : 1;
          return b.r + b.a * Math.sin(b.k * t + ph) * m;
        });
        frag.appendChild(svgEl('path', { d }));
      }
    });
    cfg.circles.forEach((r) => frag.appendChild(svgEl('circle', { cx: c, cy: c, r })));
    svg.appendChild(frag);
  }

  $$('[data-guilloche]').forEach(drawGuilloche);

  /* ------------------------------------------------------------------
     Contadores numéricos
     ------------------------------------------------------------------ */
  function tween(el, to, { from = 0, dur = 1800, type = 'int', ease = (p) => 1 - Math.pow(1 - p, 4) } = {}) {
    cancelAnimationFrame(el._raf);
    el._value = to;
    if (reduceMotion) { el.textContent = format(to, type); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const p = clamp((now - t0) / dur, 0, 1);
      el.textContent = format(from + (to - from) * ease(p), type);
      if (p < 1) el._raf = requestAnimationFrame(tick);
    };
    el._raf = requestAnimationFrame(tick);
  }

  const counters = $$('[data-count]');
  if (!reduceMotion) counters.forEach((el) => { el.textContent = format(0, el.dataset.format); });

  function runCounter(el) {
    tween(el, parseFloat(el.dataset.count), { type: el.dataset.format, dur: +el.dataset.dur || 2000 });
  }

  // Ao passar o mouse num número, ele "roda" de novo, como numa máquina registradora.
  $$('.stat').forEach((stat) => {
    const el = $('[data-count]', stat);
    let last = 0;
    stat.addEventListener('pointerenter', () => {
      const now = performance.now();
      if (!el || now - last < 1400) return;
      last = now;
      tween(el, parseFloat(el.dataset.count), { type: el.dataset.format, dur: 900 });
    });
  });

  /* ------------------------------------------------------------------
     Texto dividido em palavras (para revelar no scroll)
     ------------------------------------------------------------------ */
  function splitWords(root) {
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            const inner = document.createElement('span');
            w.className = 'w';
            inner.className = 'w__i';
            inner.style.setProperty('--i', i++);
            inner.textContent = part;
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1 && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(root);
  }
  $$('[data-split]').forEach(splitWords);

  /* ------------------------------------------------------------------
     Intro / preloader
     ------------------------------------------------------------------ */
  let markReady;
  const ready = new Promise((resolve) => { markReady = resolve; });

  function setReady() {
    html.classList.remove('is-loading');
    requestAnimationFrame(() => {
      html.classList.add('is-ready');
      markReady();
    });
  }

  (function intro() {
    const pre = $('.preloader');
    if (!pre || html.classList.contains('intro-seen')) {
      if (pre) pre.remove();
      setReady();
      return;
    }
    const num = $('[data-preloader-count]', pre);
    const bar = $('.preloader__bar span', pre);
    const label = $('[data-preloader-label]', pre);
    const labels = ['Conciliando lançamentos', 'Apurando tributos', 'Fechando o balanço'];
    const dur = 1700;
    const t0 = performance.now();
    let lastLabel = -1;

    const step = (now) => {
      const p = clamp((now - t0) / dur, 0, 1);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      num.textContent = String(Math.round(e * 100)).padStart(3, '0');
      bar.style.transform = `scaleX(${e})`;
      const li = Math.min(labels.length - 1, Math.floor(p * labels.length));
      if (li !== lastLabel) { label.textContent = labels[li]; lastLabel = li; }
      if (p < 1) requestAnimationFrame(step);
      else setTimeout(finish, 220);
    };
    requestAnimationFrame(step);

    function finish() {
      pre.classList.add('is-done');
      setTimeout(setReady, 380);
      setTimeout(() => pre.remove(), 1300);
      try { sessionStorage.setItem('lastro-intro', '1'); } catch (e) { /* modo privado */ }
    }
  })();

  /* ------------------------------------------------------------------
     Revelação no scroll
     ------------------------------------------------------------------ */
  ready.then(() => {
    const revealIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealIO.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
    $$('[data-reveal], [data-split]').forEach((el) => revealIO.observe(el));

    const countIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        runCounter(entry.target);
        countIO.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
    counters.forEach((el) => countIO.observe(el));
  });

  /* ------------------------------------------------------------------
     Gráfico de economia acumulada (redesenhado ao redimensionar)
     ------------------------------------------------------------------ */
  const chartBox = $('[data-chart]');
  const chart = { line: null, pts: [], progress: -1 };

  function renderChart() {
    if (!chartBox) return;
    const svg = $('svg', chartBox);
    const data = JSON.parse(chartBox.dataset.chart);
    const W = Math.max(chartBox.clientWidth, 280);
    const H = W < 640 ? 230 : 300;
    const pad = { l: 4, r: 4, t: 50, b: 34 };
    const max = 70;
    const x = (i) => pad.l + (i / (data.length - 1)) * (W - pad.l - pad.r);
    const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
    const pts = data.map((d, i) => [x(i), y(d[1])]);
    const f = (n) => n.toFixed(1);

    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
    }
    const base = H - pad.b;
    const area = `${d} L${f(pts[pts.length - 1][0])} ${base} L${f(pts[0][0])} ${base}Z`;
    const compact = W < 640;

    let out = '<defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#c9a44c" stop-opacity=".32"/><stop offset="1" stop-color="#c9a44c" stop-opacity="0"/></linearGradient></defs>';
    [0, 20, 40, 60].forEach((v) => {
      out += `<line class="chart__grid" x1="${pad.l}" x2="${W - pad.r}" y1="${f(y(v))}" y2="${f(y(v))}"/>`;
      if (v) out += `<text class="chart__ylab" x="${pad.l}" y="${f(y(v) - 7)}">R$ ${v} mi</text>`;
    });
    out += `<path class="chart__area" d="${area}"/>`;
    out += `<path class="chart__line" pathLength="1" d="${d}"/>`;
    data.forEach(([year, v], i) => {
      const [px, py] = pts[i];
      const shift = i === 0 ? 46 : i === data.length - 1 ? -46 : 0;
      const label = `${year} · R$ ${v.toLocaleString('pt-BR')} mi`;
      out += `<g class="chart__pt" transform="translate(${f(px)} ${f(py)})" tabindex="0" aria-label="${label}">` +
        `<circle class="chart__hit" r="16"/><circle class="chart__dot" r="4.5"/>` +
        `<g class="chart__tip"><rect x="${-74 + shift}" y="-48" width="148" height="30" rx="8"/>` +
        `<text x="${shift}" y="-28" text-anchor="middle">${label}</text></g></g>`;
      if (!compact || i % 3 === 0 || i === data.length - 1) {
        const anchor = i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle';
        out += `<text class="chart__xlab" x="${f(px)}" y="${H - 8}" text-anchor="${anchor}">${year}</text>`;
      }
    });

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = out;
    chart.line = $('.chart__line', svg);
    chart.area = $('.chart__area', svg);
    chart.pts = $$('.chart__pt', svg);
    chart.progress = -1;
  }

  function updateChart(vh) {
    if (!chart.line) return;
    const r = chartBox.getBoundingClientRect();
    if (r.bottom < -100 || r.top > vh + 100) return;
    const p = reduceMotion ? 1 : clamp((vh * 0.92 - r.top) / (vh * 0.55), 0, 1);
    if (Math.abs(p - chart.progress) < 0.001) return;
    chart.progress = p;
    chart.line.style.strokeDashoffset = (1 - p).toFixed(4);
    chart.area.style.setProperty('--p', p.toFixed(3));
    const n = chart.pts.length - 1;
    chart.pts.forEach((pt, i) => pt.classList.toggle('is-on', p >= i / n - 0.001));
  }

  /* ------------------------------------------------------------------
     Header, progresso, parallax, faixas, pilha de cartões
     ------------------------------------------------------------------ */
  const header = $('[data-header]');
  const progress = $('.progress span');
  const waFloat = $('[data-wa]');
  const hero = $('[data-hero]');
  const heroGlow = $('[data-hero-glow]');

  const parallax = $$('[data-speed]').map((el) => ({ el, speed: parseFloat(el.dataset.speed) || 0, base: 0 }));
  const marquees = $$('[data-marquee]').map((track) => {
    track.innerHTML += track.innerHTML;
    return { track, x: 0, w: 0, dir: parseFloat(track.dataset.dir) || 1 };
  });
  const steps = $$('.step');
  const stackSection = $('.method');

  const view = { vh: innerHeight, docH: 1, heroVisible: true, stackVisible: false, wide: wideQuery.matches };

  function measure() {
    view.vh = innerHeight;
    view.wide = wideQuery.matches;
    view.docH = Math.max(1, document.documentElement.scrollHeight - view.vh);
    const y = scrollY;
    parallax.forEach((p) => {
      p.el.style.transform = '';
      const r = p.el.getBoundingClientRect();
      p.base = r.top + y + r.height / 2;
    });
    marquees.forEach((m) => { m.w = m.track.scrollWidth / 2; });
    renderChart();
    lastFrameY = -1;
  }

  let resizeTimer;
  const scheduleMeasure = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(measure, 120); };
  addEventListener('resize', scheduleMeasure);
  addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  if ('ResizeObserver' in window) new ResizeObserver(scheduleMeasure).observe(document.body);

  const visIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.target === hero) view.heroVisible = e.isIntersecting;
      if (e.target === stackSection) view.stackVisible = e.isIntersecting;
    });
  });
  if (hero) visIO.observe(hero);
  if (stackSection) visIO.observe(stackSection);

  // Cursor e brilho do hero
  const pointer = { x: innerWidth * 0.6, y: innerHeight * 0.4, active: false };
  const glow = { x: pointer.x, y: pointer.y };
  const ring = { x: -100, y: -100 };
  const cursor = $('.cursor');
  const cursorRing = $('.cursor__ring');
  const cursorDot = $('.cursor__dot');
  const cursorLabel = $('.cursor__label');

  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    if (!pointer.active) { pointer.active = true; ring.x = e.clientX; ring.y = e.clientY; }
    if (cursorDot && html.classList.contains('has-cursor')) {
      cursorDot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    }
  }, { passive: true });

  let lastFrameY = -1;
  let lastY = scrollY;
  let lastT = performance.now();
  let vel = 0;
  let scrollDir = 1;
  let headerHidden = false;

  function frame(now) {
    const dt = clamp((now - lastT) / 16.67, 0.25, 3);
    lastT = now;
    const y = scrollY;
    const dy = y - lastY;
    lastY = y;
    vel = lerp(vel, dy, 0.18);
    if (dy > 0.5) scrollDir = 1; else if (dy < -0.5) scrollDir = -1;

    // Header: aparece ao rolar para cima, some ao descer
    if (header) {
      header.classList.toggle('is-scrolled', y > 24);
      if (dy > 3 && y > 520 && !html.classList.contains('menu-open')) headerHidden = true;
      else if (dy < -3 || y < 200) headerHidden = false;
      header.classList.toggle('is-hidden', headerHidden);
    }

    if (y !== lastFrameY) {
      lastFrameY = y;
      if (progress) progress.style.transform = `scaleX(${clamp(y / view.docH, 0, 1).toFixed(4)})`;
      if (waFloat) waFloat.classList.toggle('is-visible', y > view.vh * 0.6);

      // Parallax
      if (!reduceMotion) {
        const center = y + view.vh / 2;
        parallax.forEach((p) => {
          if (!view.wide) { p.el.style.transform = ''; return; }
          const offset = (p.base - center) * p.speed;
          if (Math.abs(p.base - center) > view.vh * 1.6) return;
          p.el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
        });
      }

      // Pilha de cartões do método
      if (view.stackVisible && steps.length) {
        const rects = steps.map((s) => s.getBoundingClientRect());
        steps.forEach((s, i) => {
          const next = rects[i + 1];
          if (!next) return;
          const h = s.offsetHeight;
          const p = clamp((rects[i].top + h - next.top) / h, 0, 1);
          s.style.setProperty('--p', p.toFixed(3));
        });
      }

      updateChart(view.vh);
    }

    // Faixas: velocidade e direção acompanham o scroll
    if (!reduceMotion) {
      const boost = Math.min(Math.abs(vel) * 0.35, 14);
      marquees.forEach((m) => {
        if (!m.w) return;
        m.x -= (0.55 + boost) * dt * m.dir * scrollDir;
        if (m.x <= -m.w) m.x += m.w;
        if (m.x > 0) m.x -= m.w;
        m.track.style.transform = `translate3d(${m.x.toFixed(2)}px, 0, 0)`;
      });
    }

    // Brilho que segue o mouse no hero
    if (heroGlow && view.heroVisible && !reduceMotion) {
      glow.x = lerp(glow.x, pointer.x, 0.06);
      glow.y = lerp(glow.y, pointer.y + y, 0.06);
      heroGlow.style.transform = `translate3d(${glow.x.toFixed(1)}px, ${glow.y.toFixed(1)}px, 0)`;
    }

    // Anel do cursor com atraso suave
    if (cursorRing && pointer.active && html.classList.contains('has-cursor')) {
      ring.x = lerp(ring.x, pointer.x, 0.2);
      ring.y = lerp(ring.y, pointer.y, 0.2);
      cursorRing.style.transform = `translate3d(${ring.x.toFixed(1)}px, ${ring.y.toFixed(1)}px, 0)`;
    }

    requestAnimationFrame(frame);
  }

  measure();
  requestAnimationFrame(frame);

  /* ------------------------------------------------------------------
     Cursor personalizado
     ------------------------------------------------------------------ */
  if (finePointer && !reduceMotion && cursor) {
    html.classList.add('has-cursor');
    const interactive = 'a, button, [data-cursor], label, select, .range, .chart__pt, .opt, [role="combobox"], [role="option"]';
    const textual = 'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]), textarea';

    document.addEventListener('pointerover', (e) => {
      const t = e.target;
      const isText = t.closest && t.closest(textual);
      const el = !isText && t.closest && t.closest(interactive);
      const label = el && el.dataset ? el.dataset.cursor : '';
      cursor.classList.toggle('is-text', !!isText);
      cursor.classList.toggle('is-hover', !!el && !label);
      cursor.classList.toggle('is-label', !!label);
      if (label) cursorLabel.textContent = label;
    });
    document.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    document.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    document.documentElement.addEventListener('pointerleave', () => cursor.classList.add('is-out'));
    document.documentElement.addEventListener('pointerenter', () => cursor.classList.remove('is-out'));
  }

  /* ------------------------------------------------------------------
     Efeitos de hover: magnético, tilt 3D e spotlight
     ------------------------------------------------------------------ */
  if (finePointer && !reduceMotion) {
    $$('[data-magnetic]').forEach((el) => {
      const strength = parseFloat(el.dataset.magnetic) || 0.3;
      let tx = 0, ty = 0;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const cx = r.left - tx + r.width / 2;
        const cy = r.top - ty + r.height / 2;
        tx = (e.clientX - cx) * strength;
        ty = (e.clientY - cy) * strength * 1.2;
        el.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
      });
      el.addEventListener('pointerleave', () => { tx = ty = 0; el.style.transform = ''; });
    });

    $$('[data-tilt]').forEach((el) => {
      const max = parseFloat(el.dataset.tilt) || 8;
      let raf = 0;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = clamp((e.clientX - r.left) / r.width, 0, 1);
        const py = clamp((e.clientY - r.top) / r.height, 0, 1);
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.classList.add('is-tilting');
          el.style.setProperty('--rx', `${((0.5 - py) * max).toFixed(2)}deg`);
          el.style.setProperty('--ry', `${((px - 0.5) * max).toFixed(2)}deg`);
          el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
          el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
          el.style.setProperty('--holo', `${(px * 100).toFixed(1)}%`);
        });
      });
      el.addEventListener('pointerleave', () => {
        cancelAnimationFrame(raf);
        el.classList.remove('is-tilting');
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });

    $$('[data-spot]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${(e.clientX - r.left).toFixed(0)}px`);
        el.style.setProperty('--my', `${(e.clientY - r.top).toFixed(0)}px`);
      });
    });
  }

  /* ------------------------------------------------------------------
     Navegação: link ativo e menu mobile
     ------------------------------------------------------------------ */
  const navLinks = $$('.nav a');
  const navIO = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id]').forEach((s) => navIO.observe(s));

  const burger = $('[data-burger]');
  const menu = $('[data-menu]');
  function toggleMenu(open) {
    html.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    if (open) headerHidden = false;
  }
  if (burger && menu) {
    burger.addEventListener('click', () => toggleMenu(!html.classList.contains('menu-open')));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => toggleMenu(false)));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && html.classList.contains('menu-open')) { toggleMenu(false); burger.focus(); } });
    wideQuery.addEventListener('change', () => toggleMenu(false));
  }

  /* ------------------------------------------------------------------
     Simulador de economia tributária (ilustrativo)
     ------------------------------------------------------------------ */
  const sim = $('[data-sim]');
  if (sim) {
    const range = $('input[name="faturamento"]', sim);
    const out = {
      fat: $('[data-sim-fat]', sim),
      atual: $('[data-sim-atual]', sim),
      novo: $('[data-sim-novo]', sim),
      eco: $('[data-sim-eco]', sim),
      pct: $('[data-sim-pct]', sim),
    };
    const barAtual = $('[data-bar-atual]', sim);
    const barNovo = $('[data-bar-novo]', sim);

    // Alíquotas efetivas médias e potencial de redução por regime — valores ilustrativos.
    const RATE = { servicos: 0.152, comercio: 0.082, industria: 0.104, saude: 0.128 };
    const SAVE = { simples: 0.16, presumido: 0.24, real: 0.19, naosei: 0.27 };

    const toRevenue = (v) => {
      const raw = 10000 * Math.pow(200, v / 100);
      const step = raw < 100000 ? 1000 : raw < 500000 ? 5000 : 10000;
      return Math.round(raw / step) * step;
    };

    function update() {
      const fat = toRevenue(+range.value);
      const seg = $('input[name="segmento"]:checked', sim).value;
      const reg = $('input[name="regime"]:checked', sim).value;
      const scale = clamp(0.86 + 0.11 * Math.log2(fat / 60000), 0.78, 1.42);
      const atual = fat * RATE[seg] * scale;
      const save = SAVE[reg] * clamp(0.92 + 0.04 * Math.log2(fat / 60000), 0.82, 1.12);
      const novo = atual * (1 - save);
      const eco = (atual - novo) * 12;

      range.style.setProperty('--p', `${range.value}%`);
      range.setAttribute('aria-valuetext', format(fat, 'brl'));
      out.fat.textContent = format(fat, 'brl');

      [[out.atual, atual], [out.novo, novo], [out.eco, eco]].forEach(([el, val]) => {
        tween(el, val, { from: el._value || 0, dur: 700, type: 'brl' });
      });
      out.pct.textContent = `${Math.round(save * 100)}%`;
      barAtual.style.setProperty('--w', '100%');
      barNovo.style.setProperty('--w', `${((novo / atual) * 100).toFixed(1)}%`);
    }

    sim.addEventListener('input', update);
    sim.addEventListener('change', update);
    // Só anima os valores quando o simulador aparece na tela.
    const simIO = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      update();
      simIO.disconnect();
    }, { threshold: 0.25 });
    simIO.observe(sim);
    range.style.setProperty('--p', `${range.value}%`);
    out.fat.textContent = format(toRevenue(+range.value), 'brl');
  }

  /* ------------------------------------------------------------------
     Planos: alternância mensal/anual
     ------------------------------------------------------------------ */
  const billing = $('[data-billing]');
  if (billing) {
    const setBilling = (annual) => {
      billing.setAttribute('aria-checked', String(annual));
      $$('[data-billing-set]').forEach((b) => b.classList.toggle('is-on', (b.dataset.billingSet === 'annual') === annual));
      $$('[data-price]').forEach((el) => {
        const from = parseInt(el.textContent.replace(/\D/g, ''), 10) || 0;
        tween(el, +(annual ? el.dataset.annual : el.dataset.monthly), { from, dur: 650, type: 'int' });
      });
      $$('[data-billing-note]').forEach((n) => { n.textContent = annual ? 'por mês, no plano anual' : 'por mês'; });
    };
    billing.addEventListener('click', () => setBilling(billing.getAttribute('aria-checked') !== 'true'));
    $$('[data-billing-set]').forEach((b) => b.addEventListener('click', () => setBilling(b.dataset.billingSet === 'annual')));
  }

  /* ------------------------------------------------------------------
     FAQ (acordeão)
     ------------------------------------------------------------------ */
  $$('.faq__q').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq__item');
      const open = btn.getAttribute('aria-expanded') !== 'true';
      $$('.faq__item.is-open').forEach((other) => {
        if (other === item) return;
        other.classList.remove('is-open');
        $('.faq__q', other).setAttribute('aria-expanded', 'false');
      });
      item.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });

  /* ------------------------------------------------------------------
     Dropdowns personalizados
     O <select> nativo fica escondido e continua guardando o valor do formulário.
     Teclado segue o padrão "select-only combobox" da WAI-ARIA.
     ------------------------------------------------------------------ */
  const normalize = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const openSelects = new Set();

  function enhanceSelect(native, n) {
    const field = native.closest('.field');
    const label = field && $('label', field);
    const uid = native.id || `select-${n}`;
    const labelId = `${uid}-label`;
    if (label) { label.id = labelId; label.removeAttribute('for'); }

    const wrap = document.createElement('div');
    wrap.className = 'select';
    native.before(wrap);
    wrap.appendChild(native);
    native.classList.add('select__native');
    native.tabIndex = -1;
    native.setAttribute('aria-hidden', 'true');

    const trigger = document.createElement('div');
    trigger.className = 'select__trigger';
    trigger.tabIndex = 0;
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${uid}-list`);
    if (label) trigger.setAttribute('aria-labelledby', labelId);
    trigger.innerHTML = '<span class="select__value"></span><svg class="ico select__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
    const valueEl = $('.select__value', trigger);

    const list = document.createElement('ul');
    list.className = 'select__list';
    list.id = `${uid}-list`;
    list.tabIndex = -1;
    list.setAttribute('role', 'listbox');
    if (label) list.setAttribute('aria-labelledby', labelId);

    const opts = Array.from(native.options).map((o, i) => {
      const li = document.createElement('li');
      li.className = 'select__opt';
      li.id = `${uid}-opt-${i}`;
      li.setAttribute('role', 'option');
      li.style.setProperty('--i', i);
      li.innerHTML = `<span class="select__idx">${String(i + 1).padStart(2, '0')}</span><span class="select__text"></span><svg class="ico select__check" aria-hidden="true"><use href="#i-check"/></svg>`;
      $('.select__text', li).textContent = o.textContent;
      list.appendChild(li);
      return li;
    });
    wrap.append(trigger, list);

    let active = native.selectedIndex;
    let typed = '';
    let typedTimer;
    const isOpen = () => wrap.classList.contains('is-open');

    function render(animate) {
      const i = native.selectedIndex;
      opts.forEach((li, k) => li.setAttribute('aria-selected', String(k === i)));
      valueEl.textContent = native.options[i].textContent;
      if (animate) {
        valueEl.classList.remove('is-changed');
        void valueEl.offsetWidth;
        valueEl.classList.add('is-changed');
      }
    }

    function setActive(i) {
      active = clamp(i, 0, opts.length - 1);
      opts.forEach((li, k) => li.classList.toggle('is-active', k === active));
      trigger.setAttribute('aria-activedescendant', opts[active].id);
      const li = opts[active];
      if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop - 8;
      else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight + 8;
      }
    }

    function open() {
      if (isOpen()) return;
      openSelects.forEach((closeOther) => closeOther());
      // Abre para cima quando não há espaço abaixo.
      const r = trigger.getBoundingClientRect();
      const below = innerHeight - r.bottom;
      wrap.classList.toggle('is-up', below < list.scrollHeight + 24 && r.top > below);
      wrap.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      setActive(native.selectedIndex);
      openSelects.add(close);
    }

    function close() {
      wrap.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-activedescendant');
      openSelects.delete(close);
    }

    function choose(i) {
      const changed = native.selectedIndex !== i;
      native.selectedIndex = i;
      render(changed);
      if (changed) native.dispatchEvent(new Event('change', { bubbles: true }));
      close();
    }

    trigger.addEventListener('click', () => (isOpen() ? close() : open()));
    list.addEventListener('mousedown', (e) => e.preventDefault()); // mantém o foco no gatilho
    opts.forEach((li, i) => {
      li.addEventListener('click', () => { choose(i); trigger.focus(); });
      li.addEventListener('pointermove', () => { if (active !== i) setActive(i); });
    });
    wrap.addEventListener('focusout', (e) => { if (!wrap.contains(e.relatedTarget)) close(); });
    document.addEventListener('pointerdown', (e) => { if (isOpen() && !wrap.contains(e.target)) close(); });

    trigger.addEventListener('keydown', (e) => {
      const opened = isOpen();
      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowUp':
          e.preventDefault();
          if (!opened) open();
          else if (e.altKey) choose(active);
          else setActive(active + (e.key === 'ArrowDown' ? 1 : -1));
          return;
        case 'Home':
        case 'End':
          e.preventDefault();
          if (!opened) open();
          setActive(e.key === 'Home' ? 0 : opts.length - 1);
          return;
        case 'PageDown':
        case 'PageUp':
          if (!opened) return;
          e.preventDefault();
          setActive(active + (e.key === 'PageDown' ? 5 : -5));
          return;
        case 'Enter':
        case ' ':
          if (e.key === ' ' && typed) break; // espaço faz parte da busca por digitação
          e.preventDefault();
          if (opened) choose(active); else open();
          return;
        case 'Escape':
          if (opened) { e.preventDefault(); e.stopPropagation(); close(); }
          return;
        case 'Tab':
          if (opened) choose(active);
          return;
        default:
          break;
      }
      // Busca por digitação: "pl" leva a "Planejamento tributário".
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        clearTimeout(typedTimer);
        typed += normalize(e.key);
        typedTimer = setTimeout(() => { typed = ''; }, 600);
        const start = typed.length === 1 ? active + 1 : active;
        const order = opts.map((_, k) => (start + k) % opts.length);
        const hit = order.find((k) => normalize(native.options[k].textContent).startsWith(typed));
        if (hit !== undefined) {
          if (!opened) open();
          setActive(hit);
        }
      }
    });

    native.addEventListener('change', () => render(false));
    if (native.form) native.form.addEventListener('reset', () => setTimeout(() => render(false)));
    render(false);
  }

  $$('.field--select select').forEach(enhanceSelect);

  /* ------------------------------------------------------------------
     Formulário de contato
     ------------------------------------------------------------------ */
  const form = $('[data-form]');
  if (form) {
    const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const today = new Date();
    const pad2 = (n) => String(n).padStart(2, '0');
    $('[data-serial]', form).textContent = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}${pad2(today.getDate())}`;
    $('[data-stamp-date]', form).textContent = `${pad2(today.getDate())} ${MONTHS[today.getMonth()]} ${today.getFullYear()}`;

    const msgField = form.elements.mensagem;
    const growMessage = () => {
      msgField.style.height = 'auto';
      msgField.style.height = `${msgField.scrollHeight}px`;
      msgField.style.overflowY = msgField.scrollHeight > 168 ? 'auto' : 'hidden';
    };
    msgField.addEventListener('input', growMessage);
    form.addEventListener('reset', () => { msgField.style.height = ''; msgField.style.overflowY = ''; });

    const tel = form.elements.telefone;
    tel.addEventListener('input', () => {
      const d = tel.value.replace(/\D/g, '').slice(0, 11);
      let v = d;
      if (d.length > 10) v = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
      else if (d.length > 6) v = `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      else if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
      else if (d.length) v = `(${d}`;
      tel.value = v;
    });

    const rules = {
      nome: (v) => (v.trim().length >= 3 ? '' : 'Informe seu nome completo.'),
      email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Informe um e-mail válido.'),
      telefone: (v) => (v.replace(/\D/g, '').length >= 10 ? '' : 'Informe um telefone com DDD.'),
      consentimento: (_, el) => (el.checked ? '' : 'Precisamos da sua autorização para retornar o contato.'),
    };

    function validateField(name) {
      const el = form.elements[name];
      const msg = rules[name](el.value, el);
      const wrap = el.closest('.field, .check');
      const err = $(`[data-error-for="${name}"]`, form);
      if (wrap) wrap.classList.toggle('is-invalid', !!msg);
      if (err) err.textContent = msg;
      el.setAttribute('aria-invalid', String(!!msg));
      return !msg;
    }

    Object.keys(rules).forEach((name) => {
      const el = form.elements[name];
      el.addEventListener(el.type === 'checkbox' ? 'change' : 'blur', () => validateField(name));
      el.addEventListener('input', () => { if (el.getAttribute('aria-invalid') === 'true') validateField(name); });
    });

    const submit = $('.sheet__submit', form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const results = Object.keys(rules).map(validateField);
      if (results.includes(false)) {
        const firstInvalid = Object.keys(rules).find((n) => form.elements[n].getAttribute('aria-invalid') === 'true');
        form.elements[firstInvalid].focus();
        return;
      }

      submit.classList.add('is-loading');
      submit.disabled = true;

      // Integração: troque este bloco por um envio real, por exemplo:
      // await fetch('https://formspree.io/f/SEU_ID', { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
      await new Promise((r) => setTimeout(r, 1400));

      const firstName = form.elements.nome.value.trim().split(/\s+/)[0];
      $('[data-done-msg]', form).textContent = `Obrigado, ${firstName}! Um contador retorna em até 2 horas úteis.`;
      submit.classList.remove('is-loading');
      form.classList.add('is-sent');
    });

    $('[data-form-reset]', form).addEventListener('click', () => {
      form.reset();
      form.classList.remove('is-sent');
      submit.disabled = false;
      $$('.is-invalid', form).forEach((el) => el.classList.remove('is-invalid'));
      form.elements.nome.focus();
    });

    // Botões dos planos preenchem o assunto do formulário.
    $$('[data-plan]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const msg = form.elements.mensagem;
        if (!msg.value) { msg.value = `Tenho interesse no plano ${btn.dataset.plan}.`; growMessage(); }
      });
    });
  }

  /* ------------------------------------------------------------------
     Detalhes
     ------------------------------------------------------------------ */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
