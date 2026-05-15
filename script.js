/* ────────────────────────────────────────────────
   Edwin Romero M | Institute — Interacciones
──────────────────────────────────────────────── */

/* ============ HUD GLOBAL — live sensors ============ */
(() => {
  const vec = { fill: document.getElementById('vec-fill'), val: document.getElementById('vec-val') };
  const alk = { fill: document.getElementById('alk-fill'), val: document.getElementById('alk-val') };
  const timeEl = document.getElementById('hud-time');
  const sectionEl = document.getElementById('hud-section');

  let lastX = 0, lastY = 0, lastT = performance.now();
  let velSmooth = 0;
  let lastScroll = window.scrollY, scrollSpeedSmooth = 0;
  let dwellSamples = [];

  window.addEventListener('mousemove', (e) => {
    const now = performance.now();
    const dt = Math.max(1, now - lastT);
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    const vel = Math.hypot(dx, dy) / dt; // px/ms
    velSmooth = velSmooth * 0.85 + vel * 0.15;
    lastX = e.clientX; lastY = e.clientY; lastT = now;
  }, { passive: true });

  window.addEventListener('scroll', () => {
    const cur = window.scrollY;
    scrollSpeedSmooth = scrollSpeedSmooth * 0.7 + Math.abs(cur - lastScroll) * 0.3;
    lastScroll = cur;
  }, { passive: true });

  const start = Date.now();
  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = String(Math.floor(s / 60)).padStart(2,'0');
    const ss = String(s % 60).padStart(2,'0');
    return m + ':' + ss;
  }

  // current section detection
  function currentSection() {
    const secs = document.querySelectorAll('section[data-section]');
    let cur = secs[0];
    secs.forEach(s => {
      const r = s.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.4) cur = s;
    });
    return cur ? cur.dataset.section : '';
  }

  function tick() {
    // Vectría: cursor velocity → 0..100
    let v = Math.min(1, velSmooth / 1.4);
    v = v * 0.7 + (Math.abs(Math.sin(performance.now() * 0.0005)) * 0.02); // small idle drift
    const vPct = Math.round(40 + v * 55); // floor at 40
    vec.fill.style.width = vPct + '%';
    vec.val.textContent = vPct + '%';

    // alKimetría: scroll smoothness (low variance = high score)
    const noise = Math.min(1, scrollSpeedSmooth / 40);
    const alkScore = Math.round(60 + (1 - noise) * 35);
    alk.fill.style.width = alkScore + '%';
    alk.val.textContent = alkScore + '%';

    // session time
    timeEl.textContent = fmtTime(Date.now() - start);

    // section
    const cur = currentSection();
    if (cur && sectionEl.textContent !== cur) sectionEl.textContent = cur;

    // decay
    velSmooth *= 0.96;
    scrollSpeedSmooth *= 0.90;

    requestAnimationFrame(tick);
  }
  tick();
})();

/* ============ HERO — oscilloscope reactive signal ============ */
(() => {
  const canvas = document.getElementById('scope');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  let mx = 0.5, my = 0.5, target_mx = 0.5, target_my = 0.5;
  window.addEventListener('mousemove', (e) => {
    target_mx = e.clientX / window.innerWidth;
    target_my = e.clientY / window.innerHeight;
  });

  let t = 0;

  function draw() {
    t += 0.014;
    mx += (target_mx - mx) * 0.06;
    my += (target_my - my) * 0.06;

    ctx.clearRect(0, 0, w, h);

    // Frequency & amplitude shaped by cursor
    const freq = 1.4 + mx * 3.5;
    const amp = 26 + (1 - my) * 90;
    const yMid = h / 2;

    // Faint baseline
    ctx.strokeStyle = 'rgba(238,237,224,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, yMid);
    ctx.lineTo(w, yMid);
    ctx.stroke();

    // Two waves: dorado + morado, slightly offset
    drawWave({
      color: 'rgba(201,168,76,0.55)',
      amp, freq, phase: t,
      yMid, glow: 8
    });
    drawWave({
      color: 'rgba(94,138,180,0.45)',
      amp: amp * 0.75, freq: freq * 0.82, phase: t * 1.13 + 1.2,
      yMid: yMid + 18, glow: 6
    });
    drawWave({
      color: 'rgba(238,237,224,0.08)',
      amp: amp * 1.2, freq: freq * 0.55, phase: -t * 0.7,
      yMid, glow: 0
    });

    // Tick marks every 80px
    ctx.strokeStyle = 'rgba(238,237,224,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, yMid - 4);
      ctx.lineTo(x, yMid + 4);
      ctx.stroke();
    }

    requestAnimationFrame(draw);
  }

  function drawWave({color, amp, freq, phase, yMid, glow}) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const u = x / w;
      // envelope so it fades at edges
      const env = Math.sin(u * Math.PI);
      const y = yMid + Math.sin(u * Math.PI * 2 * freq + phase) * amp * env
                     + Math.sin(u * Math.PI * 2 * freq * 2.6 + phase * 1.5) * amp * 0.18 * env;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  draw();
})();

/* ============ FAULT WAVES — degrade on hover ============ */
(() => {
  document.querySelectorAll('.fault-wave').forEach((slot, idx) => {
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.setAttribute('viewBox', '0 0 400 40');
    svg.setAttribute('preserveAspectRatio', 'none');
    const path = document.createElementNS(svgNs, 'path');
    path.setAttribute('stroke', '#C9A84C');
    path.setAttribute('stroke-width', '1.2');
    path.setAttribute('fill', 'none');
    svg.appendChild(path);
    slot.appendChild(svg);

    const phase = idx * 0.7;
    const ttl = { healthy: 1, dying: 0 };
    let target = 1;
    slot.parentElement.addEventListener('mouseenter', () => target = 0);
    slot.parentElement.addEventListener('mouseleave', () => target = 1);

    let raf, t = 0;
    function loop() {
      t += 0.05;
      ttl.healthy += (target - ttl.healthy) * 0.06;
      let d = 'M 0 20';
      for (let x = 0; x <= 400; x += 4) {
        const env = ttl.healthy;
        const y = 20 + Math.sin(x * 0.05 + t + phase) * 10 * env
                     + Math.sin(x * 0.12 + t * 1.6) * 3 * env
                     + (1 - env) * (Math.random() - 0.5) * 1.5;
        d += ` L ${x} ${y.toFixed(2)}`;
      }
      path.setAttribute('d', d);
      path.setAttribute('stroke', ttl.healthy > 0.5 ? '#C9A84C' : '#d96a4a');
      raf = requestAnimationFrame(loop);
    }
    loop();
  });
})();

/* ============ GAUGES — fill on view ============ */
(() => {
  const gauges = document.querySelectorAll('.gauge');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const arc = e.target.querySelector('.gauge-arc-fill');
        const pct = parseFloat(e.target.dataset.pct || 80);
        const len = parseFloat(arc.getAttribute('stroke-dasharray'));
        arc.style.strokeDashoffset = (len * (1 - pct / 100)).toString();
      }
    });
  }, { threshold: 0.35 });
  gauges.forEach(g => io.observe(g));
})();

/* ============ JERARQUÍA — expand nodes ============ */
(() => {
  document.querySelectorAll('.node').forEach(n => {
    n.addEventListener('click', () => {
      n.classList.toggle('open');
    });
  });
})();

/* ============ EJES — quadrant interactive ============ */
(() => {
  const rows = document.querySelectorAll('.eje-row');
  const quad = document.getElementById('eje-quad-svg');
  const ejeLbl = document.getElementById('eje-lbl');

  // 4 quadrants positions: TL, TR, BL, BR (idx 0..3)
  const positions = [
    { x: 25, y: 25 },  // EJE 1 — top-left
    { x: 75, y: 25 },  // EJE 2 — top-right
    { x: 25, y: 75 },  // EJE 3 — bottom-left
    { x: 75, y: 75 },  // EJE 4 — bottom-right
  ];

  const axisLabels = [
    { x: 50, y: 6,  txt: 'INDIVIDUAL' },
    { x: 50, y: 96, txt: 'COLECTIVO' },
    { x: 4,  y: 50, txt: 'OPERATIVO', rot: -90 },
    { x: 96, y: 50, txt: 'ESTRATÉGICO', rot: 90 },
  ];

  const svgNs = 'http://www.w3.org/2000/svg';
  function setupQuad() {
    quad.innerHTML = '';
    // crosshair
    const v = document.createElementNS(svgNs, 'line');
    v.setAttribute('x1', '50'); v.setAttribute('x2', '50');
    v.setAttribute('y1', '8');  v.setAttribute('y2', '92');
    v.setAttribute('stroke', 'rgba(238,237,224,0.10)');
    v.setAttribute('stroke-width', '0.2');
    quad.appendChild(v);
    const hl = document.createElementNS(svgNs, 'line');
    hl.setAttribute('x1', '8'); hl.setAttribute('x2', '92');
    hl.setAttribute('y1', '50'); hl.setAttribute('y2', '50');
    hl.setAttribute('stroke', 'rgba(238,237,224,0.10)');
    hl.setAttribute('stroke-width', '0.2');
    quad.appendChild(hl);

    // axis labels
    axisLabels.forEach(a => {
      const t = document.createElementNS(svgNs, 'text');
      t.setAttribute('x', a.x); t.setAttribute('y', a.y);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dominant-baseline', 'middle');
      t.setAttribute('fill', 'rgba(238,237,224,0.4)');
      t.setAttribute('font-family', 'Barlow Condensed, sans-serif');
      t.setAttribute('font-size', '2.4');
      t.setAttribute('letter-spacing', '0.4');
      t.textContent = a.txt;
      if (a.rot) t.setAttribute('transform', `rotate(${a.rot} ${a.x} ${a.y})`);
      quad.appendChild(t);
    });

    // outer frame
    const frame = document.createElementNS(svgNs, 'rect');
    frame.setAttribute('x', '8'); frame.setAttribute('y', '8');
    frame.setAttribute('width', '84'); frame.setAttribute('height', '84');
    frame.setAttribute('fill', 'none');
    frame.setAttribute('stroke', 'rgba(238,237,224,0.06)');
    frame.setAttribute('stroke-width', '0.15');
    quad.appendChild(frame);

    // 4 dots
    positions.forEach((p, i) => {
      // halo
      const halo = document.createElementNS(svgNs, 'circle');
      halo.setAttribute('cx', p.x); halo.setAttribute('cy', p.y);
      halo.setAttribute('r', 7);
      halo.setAttribute('fill', 'rgba(201,168,76,0.06)');
      halo.dataset.idx = i;
      halo.classList.add('eje-halo');
      quad.appendChild(halo);

      const dot = document.createElementNS(svgNs, 'circle');
      dot.setAttribute('cx', p.x); dot.setAttribute('cy', p.y);
      dot.setAttribute('r', 1.2);
      dot.setAttribute('fill', '#C9A84C');
      dot.dataset.idx = i;
      dot.classList.add('eje-dot');
      quad.appendChild(dot);

      const lbl = document.createElementNS(svgNs, 'text');
      lbl.setAttribute('x', p.x); lbl.setAttribute('y', p.y - 10);
      lbl.setAttribute('text-anchor', 'middle');
      lbl.setAttribute('font-family', 'JetBrains Mono, monospace');
      lbl.setAttribute('font-size', '2.2');
      lbl.setAttribute('fill', 'rgba(238,237,224,0.5)');
      lbl.textContent = 'EJE 0' + (i + 1);
      quad.appendChild(lbl);
    });

    // vector arrow placeholder
    const vec = document.createElementNS(svgNs, 'line');
    vec.id = 'eje-vector';
    vec.setAttribute('x1', '50'); vec.setAttribute('y1', '50');
    vec.setAttribute('x2', '50'); vec.setAttribute('y2', '50');
    vec.setAttribute('stroke', '#5E8AB4');
    vec.setAttribute('stroke-width', '0.4');
    vec.setAttribute('stroke-linecap', 'round');
    quad.appendChild(vec);

    const vhead = document.createElementNS(svgNs, 'circle');
    vhead.id = 'eje-vhead';
    vhead.setAttribute('cx', 50); vhead.setAttribute('cy', 50);
    vhead.setAttribute('r', 1.6);
    vhead.setAttribute('fill', '#5E8AB4');
    quad.appendChild(vhead);
  }
  setupQuad();

  function activate(idx) {
    rows.forEach(r => r.classList.toggle('active', parseInt(r.dataset.idx) === idx));
    const target = positions[idx];
    const vec = document.getElementById('eje-vector');
    const vhead = document.getElementById('eje-vhead');
    vec.setAttribute('x2', target.x);
    vec.setAttribute('y2', target.y);
    vhead.setAttribute('cx', target.x);
    vhead.setAttribute('cy', target.y);

    const row = document.querySelector(`.eje-row[data-idx="${idx}"]`);
    if (ejeLbl && row) {
      ejeLbl.textContent = row.querySelector('.idx').textContent + ' · ' + row.querySelector('.name').textContent;
    }
  }

  rows.forEach(r => {
    r.addEventListener('mouseenter', () => activate(parseInt(r.dataset.idx)));
    r.addEventListener('focusin',    () => activate(parseInt(r.dataset.idx)));
    r.addEventListener('click',      () => activate(parseInt(r.dataset.idx)));
  });

  // Activate first by default (so the user sees the inline detail open)
  activate(0);
})();

/* ============ TEST DE ENTROPÍA™ ============ */
(() => {
  const state = { q1: null, q2: null, q3: null, q4: null, q5: null, q6: null };
  const arc = document.getElementById('ent-arc');
  const valEl = document.getElementById('ent-val');
  const unitEl = document.getElementById('ent-unit');
  const readingEl = document.getElementById('ent-reading');
  const recoEl = document.getElementById('ent-reco');
  const resultBox = document.getElementById('ent-result');
  const bands = document.querySelectorAll('.ent-band');
  const pitch = document.getElementById('ent-pitch');
  if (!arc) return;
  const arcLen = parseFloat(arc.getAttribute('stroke-dasharray'));

  const readings = {
    a: {
      label: 'SISTEMA CALIBRADO · BAJA ENTROPÍA',
      msg: 'Su sistema opera con orden y holgura. El siguiente paso no es corregir — es <em>amplificar</em>. La verticalidad ya es posible; conviene calibrar la <strong>Vectría™</strong> antes de exigir más empuje.'
    },
    b: {
      label: 'FRICCIÓN CONTENIDA · ENTROPÍA MODERADA',
      msg: 'El sistema produce, pero a costo de fricciones crónicas. <strong>Hay deuda humana acumulándose en silencio.</strong> Recomendado: diagnóstico alKimétrico™ enfocado en el eje de mayor drenaje.'
    },
    c: {
      label: 'ENTROPÍA OPERATIVA · DRENAJE CONTINUO',
      msg: 'El sistema gasta más energía en sostenerse que en avanzar. Los resultados dependen de presencia y esfuerzo heroico. <strong>Se requiere intervención estructural inmediata</strong> sobre liderazgo y equipos.'
    },
    d: {
      label: 'CAOS ESTRUCTURAL · DEUDA HUMANA™ ACTIVA',
      msg: 'El sistema opera en deuda. Burnout, rotación de talento crítico y decisiones de baja calidad ya están afectando la rentabilidad. <strong>La intervención no es opcional — es ingeniería financiera.</strong>'
    }
  };

  document.querySelectorAll('.likert').forEach(group => {
    const q = group.dataset.q;
    group.querySelectorAll('.lk').forEach(btn => {
      btn.addEventListener('click', () => {
        state[q] = parseInt(btn.dataset.v);
        group.querySelectorAll('.lk').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        recompute();
      });
    });
  });

  function bandOf(score) {
    if (score <= 25) return 'a';
    if (score <= 50) return 'b';
    if (score <= 75) return 'c';
    return 'd';
  }

  function estadoOf(score) {
    if (score <= 20) return { nivel: 5, nombre: 'En expansión' };
    if (score <= 40) return { nivel: 4, nombre: 'Funcional' };
    if (score <= 60) return { nivel: 3, nombre: 'En activación' };
    if (score <= 80) return { nivel: 2, nombre: 'Inestable' };
    return { nivel: 1, nombre: 'Bloqueado' };
  }

  function recompute() {
    const answered = Object.values(state).filter(v => v !== null).length;
    const sum = Object.values(state).reduce((a,b) => a + (b ?? 0), 0);
    // Max possible: 6 * 4 = 24 → normalize to 0..100
    const score = Math.round((sum / 24) * 100);

    // Always animate the arc to the current partial-completion score
    arc.style.strokeDashoffset = (arcLen * (1 - score / 100)).toString();

    if (answered === 0) {
      valEl.textContent = '—';
      unitEl.textContent = 'EN ESPERA';
      arc.classList.remove('band-a','band-b','band-c','band-d');
      bands.forEach(b => b.classList.remove('active'));
      resultBox.className = 'ent-result empty';
      readingEl.textContent = 'EN ESPERA';
      recoEl.textContent = 'Complete las seis preguntas para obtener la lectura preliminar.';
      pitch.hidden = true;
      return;
    }

    valEl.textContent = score;
    if (answered < 6) {
      unitEl.textContent = `${answered}/6 PROVISIONAL`;
      readingEl.textContent = `LECTURA PROVISIONAL · ${6 - answered} pregunta${6-answered>1?'s':''} restante${6-answered>1?'s':''}`;
      recoEl.textContent = 'Continúe — el índice se ajusta con cada respuesta.';
      resultBox.className = 'ent-result empty';
      pitch.hidden = true;
    } else {
      const b = bandOf(score);
      const est = estadoOf(score);
      const estNum = String(est.nivel).padStart(2, '0');
      unitEl.textContent = 'IEE FINAL';
      const r = readings[b];
      resultBox.className = 'ent-result band-' + b;
      readingEl.textContent = `DIAGNÓSTICO · IEE ${score}% · ESTADO ${estNum} — ${est.nombre.toUpperCase()}`;
      recoEl.innerHTML = r.msg
        + ` <a href="#estados" class="estado-link" data-nivel="${est.nivel}">Ver estado ${estNum} · ${est.nombre} →</a>`;
      pitch.hidden = false;

      // Wire the estado link
      const link = recoEl.querySelector('.estado-link');
      if (link) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          if (typeof window.__ermHighlightEstado === 'function') {
            window.__ermHighlightEstado(est.nivel);
          }
        });
      }
    }

    // Color the arc by band
    const b = bandOf(score);
    arc.classList.remove('band-a','band-b','band-c','band-d');
    arc.classList.add('band-' + b);
    bands.forEach(el => el.classList.toggle('active', el.dataset.band === b));
  }
  recompute();
})();

/* ============ REVEAL on scroll ============ */
(() => {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();

/* ============ JERARQUÍA — connecting pulse lines (decorative) ============ */
(() => {
  const treeSvg = document.getElementById('tree-svg');
  if (!treeSvg) return;
  // Simple animated dashes between levels
  function build() {
    const tree = document.getElementById('tree');
    const rect = tree.getBoundingClientRect();
    treeSvg.setAttribute('width', rect.width);
    treeSvg.setAttribute('height', rect.height);
  }
  build();
  window.addEventListener('resize', build);
})();


/* ============ ASISTENTE DEL NAVEGANTE ============ */
(() => {
  const trigger = document.getElementById('nav-trigger');
  const panel = document.getElementById('nav-panel');
  const closeBtn = document.getElementById('nav-close');
  const body = document.getElementById('nav-body');
  const form = document.getElementById('nav-form');
  const input = document.getElementById('nav-input');
  const send = document.getElementById('nav-send');
  const sugWrap = document.getElementById('nav-suggestions');
  if (!trigger) return;

  const systemContext = `Eres el Asistente del Institute para Edwin Romero M | Institute. Respondes EN ESPAÑOL, en tono editorial, técnico, preciso y alquímico — NUNCA motivacional. NUNCA uses frases como "desbloquea tu potencial", "alcanza tus sueños", "sal de tu zona de confort", "el éxito está en tu mente", "coaching transformacional".

CONOCIMIENTO ESENCIAL:
- Edwin Romero M es Ingeniero del Desempeño Humano™ (rol que él creó). Ingeniero Electrónico con especialización en Gerencia Estratégica y Comercial (U. de La Sabana). 17+ años. 3.000+ intervenciones. 70.000+ personas. Operaciones en Latinoamérica (Colombia, Ecuador, Panamá).
- NO es coach, consultor motivacional ni speaker. Nunca lo describas así.
- IP propio (jerarquía):
  · Nivel 0 — Ingeniería del Ser™: cúspide filosófica.
  · Nivel 1 — Ingeniería del Desempeño Humano™: rol aplicado. Instrumento: Vectría™.
  · Nivel 2 — Alquimia del Potencial Humano™: marco metodológico. Instrumento: alKimetría™.
  · alKimetría™ — sensor de esencia. Mide calidad/pureza de la señal. Mide Factor E™ (energía funcional) y Factor K™ (conversión del potencial).
  · Vectría™ — sensor de potencia. Mide alineación y empuje del sistema.
- 4 EJES de intervención:
  · EJE 01: Liderazgo neurológico bajo presión.
  · EJE 02: Equipos que se autogobiernan.
  · EJE 03: Estrategia que aterriza en ejecución.
  · EJE 04: Ingeniería de cierre y negociación.
- Programas B2B: EXPONÉNCIATE™ (liderazgo, 5 niveles), POTÉNCIATE™ (equipos, DEE/IEE).
- Programas B2C: IRREVERSIBLE™ (cambio de aleación), CÉNIT™ (verticalidad).
- Proceso: Leemos (alKimetría™) → Intervenimos (Alquimia del Potencial Humano™) → Nos vamos (Soberanía Operativa™).
- Conceptos clave: Soberanía Operativa™, Deuda Humana™, Factor E™, Ingeniería de Vuelo™.
- Frase guía: "Primero se ordena el sistema. Luego el potencial responde."
- Contacto real: mentor@edwinromerom.com · +57 318 206 7128 · edwinromerom.com.

REGLAS DE RESPUESTA:
- 2–4 oraciones, máximo 60 palabras.
- Tono editorial-técnico, no comercial.
- Sin emojis. Sin viñetas. Prosa breve.
- Si te preguntan algo fuera de alcance, redirige a "una conversación de exploración con el Institute".
- Usa los términos propietarios con ™ donde aplique.
- Si la pregunta no es clara, pide una sola precisión.`;

  let conversation = [];
  let isOpen = false;
  let busy = false;

  function setOpen(o) {
    isOpen = o;
    if (o) {
      panel.hidden = false;
      trigger.style.display = 'none';
      trigger.setAttribute('aria-expanded', 'true');
      setTimeout(() => input.focus(), 50);
    } else {
      panel.hidden = true;
      trigger.style.display = '';
      trigger.setAttribute('aria-expanded', 'false');
    }
  }
  setOpen(false);

  trigger.addEventListener('click', () => setOpen(true));
  closeBtn.addEventListener('click', () => setOpen(false));

  function addMsg(role, html, cls = '') {
    const div = document.createElement('div');
    div.className = 'nav-msg ' + role + (cls ? ' ' + cls : '');
    if (role === 'user') {
      div.innerHTML = '<p></p>';
      div.querySelector('p').textContent = html;
    } else if (role === 'thinking') {
      div.textContent = 'leyendo la señal…';
      div.className = 'nav-msg thinking';
    } else {
      div.innerHTML = '<p>' + html + '</p>';
    }
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
  }

  async function ask(prompt) {
    if (busy || !prompt.trim()) return;
    busy = true;
    send.disabled = true;
    if (sugWrap) sugWrap.style.display = 'none';

    addMsg('user', prompt);
    const thinkingEl = addMsg('thinking', '');

    // Build messages — embed system context in the first user message
    conversation.push({ role: 'user', content: prompt });

    const fullPrompt = systemContext + '\n\n=== HISTORIAL DE LA CONVERSACIÓN ===\n'
      + conversation.map(m => (m.role === 'user' ? 'Visitante: ' : 'Asistente: ') + m.content).join('\n')
      + '\n\nResponde como Asistente del Institute, breve y preciso:';

    try {
      const reply = await window.claude.complete(fullPrompt);
      thinkingEl.remove();
      const clean = (reply || '').trim().replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
      addMsg('assistant', clean);
      conversation.push({ role: 'assistant', content: reply });
    } catch (e) {
      thinkingEl.remove();
      addMsg('assistant', 'No fue posible obtener una respuesta en este momento. Le invito a escribirnos directamente a <strong>mentor@edwinromerom.com</strong>.');
    }

    busy = false;
    send.disabled = false;
    input.focus();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) return;
    input.value = '';
    ask(v);
  });

  if (sugWrap) {
    sugWrap.querySelectorAll('.nav-sug').forEach(b => {
      b.addEventListener('click', () => ask(b.dataset.prompt));
    });
  }

  // Keyboard: Escape closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) setOpen(false);
  });
})();


/* ============ HERO H1 — character split + reveal ============ */
(() => {
  const h1 = document.querySelector('.hero h1');
  if (!h1) return;

  let i = 0;
  function wrap(node, parent, isFirstChildOfParent, isLastChildOfParent) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Collapse whitespace and trim at element edges
      let txt = node.textContent.replace(/\s+/g, ' ');
      if (isFirstChildOfParent) txt = txt.replace(/^\s+/, '');
      if (isLastChildOfParent) txt = txt.replace(/\s+$/, '');

      // Tokenize: words + spaces. Wrap each WORD in a non-breaking
      // container so the line never breaks mid-word (e.g. "q | ue").
      // Between words, emit a real text-node space so the browser
      // still finds a legitimate line-break opportunity.
      const tokens = txt.split(/(\s+)/);
      tokens.forEach(token => {
        if (token === '') return;
        if (/^\s+$/.test(token)) {
          parent.appendChild(document.createTextNode(' '));
          return;
        }
        const wordEl = document.createElement('span');
        wordEl.className = 'word';
        for (const ch of token) {
          const span = document.createElement('span');
          span.className = 'ch';
          span.style.setProperty('--i', i++);
          span.textContent = ch;
          wordEl.appendChild(span);
        }
        parent.appendChild(wordEl);
      });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === 'BR') {
        parent.appendChild(document.createElement('br'));
      } else {
        const clone = node.cloneNode(false);
        const kids = [...node.childNodes];
        kids.forEach((child, idx) => wrap(child, clone, idx === 0, idx === kids.length - 1));
        parent.appendChild(clone);
      }
    }
  }

  const frag = document.createDocumentFragment();
  const topKids = [...h1.childNodes];
  topKids.forEach((child, idx) => wrap(child, frag, idx === 0, idx === topKids.length - 1));
  h1.innerHTML = '';
  h1.appendChild(frag);

  // Kick off after a short beat so the page is ready
  requestAnimationFrame(() => {
    setTimeout(() => h1.classList.add('in'), 220);
  });
})();


/* ============ SISTEMA HUMANO — pulses traveling along lines ============ */
(() => {
  const svg = document.getElementById('red-svg');
  if (!svg) return;
  const svgNs = 'http://www.w3.org/2000/svg';
  const lines = [...svg.querySelectorAll('line.line-base')];
  if (lines.length === 0) return;

  const pulses = lines.map((line, i) => {
    const x1 = parseFloat(line.getAttribute('x1'));
    const y1 = parseFloat(line.getAttribute('y1'));
    const x2 = parseFloat(line.getAttribute('x2'));
    const y2 = parseFloat(line.getAttribute('y2'));
    const c = document.createElementNS(svgNs, 'circle');
    c.setAttribute('r', '3.2');
    c.setAttribute('class', 'pulse');
    c.style.opacity = '0';
    svg.appendChild(c);
    return { c, x1, y1, x2, y2, offset: i * 620 };
  });

  // Travel from center → satellite repeatedly, with stagger
  const PERIOD = 3400;
  function tick() {
    const now = performance.now();
    pulses.forEach(p => {
      const t = ((now + p.offset) % PERIOD) / PERIOD; // 0..1
      // Envelope: fade in/out at edges
      const fade = Math.sin(t * Math.PI);
      p.c.style.opacity = (0.85 * fade).toFixed(2);
      const cx = p.x1 + (p.x2 - p.x1) * t;
      const cy = p.y1 + (p.y2 - p.y1) * t;
      p.c.setAttribute('cx', cx.toFixed(2));
      p.c.setAttribute('cy', cy.toFixed(2));
    });
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // On satellite hover, intensify the corresponding line + pulse
  const satellites = [...document.querySelectorAll('.nodo-s')];
  satellites.forEach((sat, i) => {
    const line = lines[i];
    const pulse = pulses[i];
    if (!line) return;
    sat.addEventListener('mouseenter', () => {
      line.style.stroke = 'rgba(201,168,76,0.6)';
      line.style.strokeWidth = '0.9';
      line.style.strokeDasharray = '0';
      if (pulse) pulse.c.setAttribute('r', '4.2');
    });
    sat.addEventListener('mouseleave', () => {
      line.style.stroke = '';
      line.style.strokeWidth = '';
      line.style.strokeDasharray = '';
      if (pulse) pulse.c.setAttribute('r', '3.2');
    });
  });
})();

/* ============ ESTADOS DEL SISTEMA — toggle + highlight from entropy ============ */
(() => {
  const cards = [...document.querySelectorAll('.estado-card')];
  if (cards.length === 0) return;

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const wasOpen = card.classList.contains('abierto');
      cards.forEach(c => c.classList.remove('abierto'));
      if (!wasOpen) card.classList.add('abierto');
    });
  });

  // Public helper for entropy logic to call
  window.__ermHighlightEstado = function(nivel) {
    cards.forEach(c => c.classList.remove('highlighted', 'abierto'));
    const target = cards.find(c => parseInt(c.dataset.nivel) === nivel);
    if (target) {
      target.classList.add('highlighted', 'abierto');
      setTimeout(() => {
        const rect = target.getBoundingClientRect();
        const y = window.scrollY + rect.top - (window.innerHeight - rect.height) / 2;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }, 80);
    }
  };
})();
