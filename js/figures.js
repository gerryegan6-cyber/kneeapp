/* Exercise diagrams: small pose-based stick-figure renderer.
   Each figure has a start pose (A) and end pose (B); the animation eases between them.
   Limbs use fixed lengths, so the body never "stretches". The working muscle is highlighted. */
(function () {
  const KA = (window.KA = window.KA || {});

  const L = { torso: 46, neck: 9, ua: 24, fa: 22, th: 44, sh: 42, ft: 16 };
  const FLOOR = 176;
  const rad = (d) => (d * Math.PI) / 180;
  const dir = (a) => [Math.cos(rad(a)), Math.sin(rad(a))];
  const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
  const mul = (v, k) => [v[0] * k, v[1] * k];
  const lerp = (a, b, t) => a + (b - a) * t;
  const f1 = (n) => n.toFixed(1);
  const pts = (a) => a.map((p) => f1(p[0]) + ',' + f1(p[1])).join(' ');
  const line = (cls, a, w) => `<polyline class="${cls}" points="${pts(a)}" stroke-width="${w}"/>`;

  /* ---------- skeleton ---------- */
  function legGeom(hip, spec) {
    let kn, an;
    if (spec.a) {
      kn = add(hip, mul(dir(spec.a[0]), L.th));
      an = add(kn, mul(dir(spec.a[1]), L.sh));
    } else {
      an = spec.ank;
      const dx = an[0] - hip[0], dy = an[1] - hip[1];
      let d = Math.hypot(dx, dy) || 1;
      const u = [dx / d, dy / d];
      const max = (L.th + L.sh) * 0.998;
      if (d > max) { d = max; an = add(hip, mul(u, d)); }
      const a = (L.th * L.th - L.sh * L.sh + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(0, L.th * L.th - a * a));
      const perp = [-u[1], u[0]];
      const s = spec.s === undefined ? -1 : spec.s;
      kn = [hip[0] + u[0] * a + perp[0] * h * s, hip[1] + u[1] * a + perp[1] * h * s];
    }
    const shinAng = (Math.atan2(an[1] - kn[1], an[0] - kn[0]) * 180) / Math.PI;
    const footAng = spec.foot !== undefined ? spec.foot : spec.flat ? 0 : shinAng - 90 + (spec.f || 0);
    return { hip, kn, an, toe: add(an, mul(dir(footAng), L.ft)) };
  }

  function lerpAny(a, b, t) {
    if (Array.isArray(a)) return a.map((v, i) => lerpAny(v, b[i], t));
    if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
    if (a && typeof a === 'object') { const o = {}; for (const k in a) o[k] = lerpAny(a[k], b[k], t); return o; }
    return a;
  }

  function drawSkel(pose, def) {
    const hip = pose.hip;
    const sh = add(hip, mul(dir(pose.torso), L.torso));
    const head = add(sh, mul(dir(pose.hd === undefined ? pose.torso : pose.hd), L.neck + 9));
    const el = add(sh, mul(dir(pose.arm[0]), L.ua));
    const wr = add(el, mul(dir(pose.arm[1]), L.fa));
    const N = legGeom(hip, pose.legN), F = legGeom(hip, pose.legF);
    const g = { hip, sh, head, el, wr, N, F, kn: N.kn, an: N.an, toe: N.toe };
    let s = '';
    if (def.props) s += def.props(g);
    s += line('ff', [hip, F.kn, F.an, F.toe], 7);
    s += line('fb', [hip, sh], 13);
    s += line('fb', [hip, N.kn, N.an, N.toe], 8);
    s += line('fb', [sh, el, wr], 6);
    s += `<circle class="fhead" cx="${f1(head[0])}" cy="${f1(head[1])}" r="9"/>`;
    (def.hl || []).forEach((k) => {
      if (k === 'thN') s += line('fh', [hip, N.kn], 9);
      if (k === 'shN') s += line('fh', [N.kn, N.an], 9);
      if (k === 'hip') s += `<circle class="fglow" cx="${f1(hip[0])}" cy="${f1(hip[1])}" r="15"/>`;
      if (k === 'knee') s += `<circle class="fring" cx="${f1(N.kn[0])}" cy="${f1(N.kn[1])}" r="9"/>`;
    });
    if (def.over) s += def.over(g);
    return s;
  }

  /* ---------- shared props ---------- */
  const wall = (x) => {
    let s = `<line class="fwall" x1="${x}" y1="10" x2="${x}" y2="${FLOOR}"/>`;
    for (let y = 26; y < FLOOR; y += 14) s += `<line class="fhatch" x1="${x}" y1="${y}" x2="${x + 8}" y2="${y - 8}"/>`;
    return s;
  };

  /* ---------- pose bases ---------- */
  const sup = (o) => Object.assign({
    hip: [125, 170], torso: 180, hd: 180, arm: [-20, -3],
    legN: { a: [0, 0] }, legF: { ank: [187, 170], s: -1, flat: true },
  }, o);
  const X0 = 150;
  const stand = (o) => Object.assign({
    hip: [X0, 86], torso: -90, hd: -90, arm: [15, 5],
    legN: { ank: [X0, 172], s: -1, foot: 0 }, legF: { ank: [X0 - 10, 172], s: -1, foot: 0 },
  }, o);

  const FIG = {};

  /* ----- lying on back ----- */
  FIG.quadset = {
    mat: true, labels: ['Relax', 'Press knee down, tighten thigh'], hl: ['thN'],
    A: sup({ legN: { a: [-7, 7], f: 0 } }), B: sup({ legN: { a: [0, 0], f: 0 } }),
    props: () => `<circle class="ftowel" cx="169" cy="165" r="8"/>`,
  };
  FIG.slr = {
    mat: true, labels: ['Start: leg flat', 'Lift to the height of the other knee'], hl: ['thN'],
    A: sup({ legN: { a: [0, 0] } }), B: sup({ legN: { a: [-38, -38] } }),
  };
  FIG.heelslide = {
    mat: true, labels: ['Start: leg straight', 'Slide heel in, only as far as comfortable'], hl: ['knee'],
    A: sup({ legN: { a: [0, 0] }, legF: { a: [0, 0] } }),
    B: sup({ legN: { a: [-40, 42.4] }, legF: { a: [0, 0] } }),
  };
  FIG.ankle = {
    mat: true, labels: ['Pull toes toward you', 'Point toes away'], hl: ['shN'],
    A: sup({ legN: { a: [0, 0], f: -12 }, legF: { a: [0, 0], f: -12 } }),
    B: sup({ legN: { a: [0, 0], f: 62 }, legF: { a: [0, 0], f: 62 } }),
  };
  const bridgeLegs = (far) => ({ legN: { ank: [185, 170], s: -1, flat: true }, legF: far });
  FIG.bridge = {
    mat: true, labels: ['Start: feet flat', 'Squeeze buttocks, lift hips'], hl: ['hip', 'thN'],
    A: sup(bridgeLegs({ ank: [180, 170], s: -1, flat: true })),
    B: sup(Object.assign({ hip: [115, 141], torso: 140.9 }, bridgeLegs({ ank: [180, 170], s: -1, flat: true }))),
  };
  FIG.bridge1 = {
    mat: true, labels: ['Start: feet flat', 'Lift hips, other leg straight'], hl: ['hip', 'thN'],
    A: sup(bridgeLegs({ ank: [180, 170], s: -1, flat: true })),
    B: sup(Object.assign({ hip: [115, 141], torso: 140.9 }, bridgeLegs({ ank: [189, 89], s: -1, foot: -125 }))),
  };
  FIG.hamstretch = {
    mat: true, labels: ['Towel around foot', 'Gently draw the leg closer'], hl: ['thN'],
    A: sup({ arm: [-60, -60], legN: { a: [-68, -68] } }), B: sup({ arm: [-62, -62], legN: { a: [-80, -80] } }),
    over: (g) => `<line class="fband" x1="${f1(g.toe[0])}" y1="${f1(g.toe[1])}" x2="${f1(g.wr[0])}" y2="${f1(g.wr[1])}"/>`,
  };

  /* ----- standing, side view ----- */
  const calf = (hx, ank, foot, far) => stand({
    hip: [hx, ank[1] - 85.8],
    legN: { ank, s: -1, foot }, legF: { ank: far, s: -1, foot },
  });
  FIG.calfraise = {
    labels: ['Heels down', 'Rise onto the balls of your feet'], hl: ['shN'],
    A: calf(150, [150, 172], 0, [140, 172]), B: calf(155.3, [155.3, 160], 48, [145.3, 160]),
    props: () => wall(200),
  };
  FIG.hamcurl = {
    labels: ['Standing tall', 'Heel toward bottom, thigh stays still'], hl: ['thN'],
    A: stand({ legN: { ank: [150, 172], s: -1, foot: 0 }, legF: { ank: [138, 172], s: -1, foot: 0 } }),
    B: stand({ legN: { ank: [112, 130], s: -1 }, legF: { ank: [138, 172], s: -1, foot: 0 } }),
    props: () => wall(200),
  };
  FIG.balance = {
    labels: ['Stand tall', 'Lift one foot, stay tall'], hl: ['thN'],
    A: stand({ hip: [145, 86], legN: { ank: [150, 172], s: -1, foot: 0 }, legF: { ank: [138, 172], s: -1, foot: 0 }, arm: [20, 8] }),
    B: stand({ hip: [142, 86], legN: { ank: [160, 146], s: -1 }, legF: { ank: [142, 172], s: -1, foot: 0 }, arm: [20, 8] }),
    props: () => wall(192),
  };
  FIG.tke = {
    labels: ['Knee slightly bent', 'Straighten the knee against the band'], hl: ['thN', 'knee'],
    A: stand({ hip: [145, 90], legN: { ank: [150, 172], s: -1, foot: 0 }, legF: { ank: [140, 172], s: -1, foot: 0 }, arm: [30, 20] }),
    B: stand({ hip: [150, 86], legN: { ank: [150, 172], s: -1, foot: 0 }, legF: { ank: [140, 172], s: -1, foot: 0 }, arm: [30, 20] }),
    props: () => `<rect class="fpost" x="22" y="40" width="10" height="${FLOOR - 40}" rx="3"/>`,
    over: (g) => `<line class="fband" x1="32" y1="${f1(g.kn[1])}" x2="${f1(g.kn[0] - 6)}" y2="${f1(g.kn[1])}"/>`,
  };
  FIG.march = {
    labels: ['Lift one knee', 'Swap sides'], hl: ['thN'],
    A: stand({ legN: { ank: [165, 138], s: -1 }, legF: { ank: [145, 172], s: -1, foot: 0 }, arm: [75, 110] }),
    B: stand({ legN: { ank: [152, 172], s: -1, foot: 0 }, legF: { ank: [165, 138], s: -1 }, arm: [100, 75] }),
  };
  const chair = () => `<rect class="fprop" x="90" y="130" width="50" height="6" rx="2"/>
    <line class="fpropl" x1="92" y1="132" x2="92" y2="84"/><line class="fpropl" x1="94" y1="136" x2="94" y2="${FLOOR}"/>
    <line class="fpropl" x1="136" y1="136" x2="136" y2="${FLOOR}"/>`;
  FIG.sitstand = {
    labels: ['Sit tall, feet under knees', 'Stand up fully, then sit slowly'], hl: ['thN', 'hip'],
    A: stand({ hip: [118, 121], torso: -72, hd: -80, arm: [-5, -2], legN: { ank: [152, 172], s: -1, foot: 0 }, legF: { ank: [146, 172], s: -1, foot: 0 } }),
    B: stand({ hip: [151, 87], torso: -90, arm: [-20, -10], legN: { ank: [152, 172], s: -1, foot: 0 }, legF: { ank: [146, 172], s: -1, foot: 0 } }),
    props: chair,
  };
  const step = () => `<rect class="fprop" x="140" y="162" width="76" height="14" rx="2"/>`;
  FIG.stepup = {
    labels: ['Foot on step', 'Stand tall on the step'], hl: ['thN', 'hip'],
    A: stand({ hip: [138, 90], torso: -78, hd: -85, legN: { ank: [160, 158], s: -1, foot: 0 }, legF: { ank: [128, 172], s: -1, foot: 0 } }),
    B: stand({ hip: [160, 74], torso: -90, legN: { ank: [160, 158], s: -1, foot: 0 }, legF: { ank: [170, 134], s: -1 } }),
    props: step,
  };
  const stretchLegs = (dx) => ({
    legN: { ank: [113.7 + dx, 172], s: -1, foot: 0 }, legF: { ank: [172 + dx, 172], s: -1, foot: 0 },
  });
  FIG.calfstretch = {
    labels: ['Back heel down, leg straight', 'Lean in until you feel the calf'], hl: ['shN'],
    A: stand(Object.assign({ hip: [150, 94], torso: -65, hd: -65, arm: [-10, -5] }, stretchLegs(0))),
    B: stand(Object.assign({ hip: [153, 94], torso: -62, hd: -62, arm: [-8, -3] }, stretchLegs(2))),
    props: () => wall(222),
  };
  FIG.hipfront = {
    labels: ['Stand tall, back leg straight', 'Tuck tailbone, ease hips forward'], hl: ['hip', 'thN'],
    A: stand(Object.assign({ hip: [150, 94], torso: -88, hd: -88, arm: [120, 64] }, stretchLegs(0))),
    B: stand(Object.assign({ hip: [157, 93], torso: -88, hd: -88, arm: [120, 64] }, stretchLegs(3))),
  };

  /* ---------- custom figures ---------- */
  function pointsFor(hipA, hipB, ank, outward) {
    // front-view leg: choose the knee position that bows outwards
    const mk = (s) => legGeom(hipA, { ank, s }).kn;
    const k1 = mk(1), k2 = mk(-1);
    return Math.abs(k1[0] - outward) > Math.abs(k2[0] - outward) ? k1 : k2;
  }
  function frontFig(p, extra) {
    const cx = p.cx;
    let s = extra && extra.back ? extra.back : '';
    const hl = [cx - 10, 86], hr = [cx + 10, 86];
    const kl = pointsFor(hl, hr, p.lank, cx - 60), kr = pointsFor(hr, hl, p.rank, cx + 60);
    s += line('ff', [hl, kl, p.lank, [p.lank[0] + 10, p.lank[1]]], 8);
    s += line('fb', [hr, kr, p.rank, [p.rank[0] + 10, p.rank[1]]], 8);
    s += line('fb', [[cx, 32], [cx, 86]], 24);
    s += line('fb', [[cx - 18, 38], [cx + 18, 38]], 8);
    const la = p.lhand || [cx - 24, 84], ra = p.rhand || [cx + 24, 84];
    s += line('fb', [[cx - 18, 38], [(cx - 18 + la[0]) / 2, (38 + la[1]) / 2 + 8], la], 6);
    s += line('fb', [[cx + 18, 38], [(cx + 18 + ra[0]) / 2, (38 + ra[1]) / 2 + 8], ra], 6);
    s += `<circle class="fhead" cx="${cx}" cy="16" r="10"/>`;
    if (extra && extra.hlRight) s += line('fh', [hr, kr], 9) + `<circle class="fglow" cx="${f1(hr[0])}" cy="86" r="14"/>`;
    if (extra && extra.over) s += extra.over({ hl, hr, kl, kr, p });
    return s;
  }
  FIG.hipabd = {
    labels: ['Stand tall, hold the wall', 'Lift the leg out to the side, toes forward'],
    draw(t) {
      const L1 = lerpAny({ r: [172, 172] }, { r: [212, 158] }, t).r;
      return wall(96) + frontFig({ cx: 160, lank: [148, 172], rank: L1, lhand: [102, 66], rhand: [184, 84] }, { hlRight: true });
    },
  };
  FIG.bandwalk = {
    labels: ['Feet hip-width apart, soft knees', 'Step sideways, toes forward'],
    draw(t) {
      const cx = lerp(160, 166, t), l = [140, 172], r = [lerp(180, 208, t), 172];
      const band = (g) => {
        const pl = [lerp(g.hl[0], l[0], 0.5), lerp(g.hl[1], l[1], 0.5)], pr = [lerp(g.hr[0], r[0], 0.5), lerp(g.hr[1], r[1], 0.5)];
        return `<path class="fband" d="M${f1(pl[0])} ${f1(pl[1])} Q${f1((pl[0] + pr[0]) / 2)} ${f1(pl[1] + 10)} ${f1(pr[0])} ${f1(pr[1])}" fill="none"/>`;
      };
      return frontFig({ cx, lank: l, rank: r }, { over: band, hlRight: true });
    },
  };
  FIG.clamshell = {
    mat: true, labels: ['Knees together, feet together', 'Open the top knee, feet stay together'],
    draw(t) {
      const H = [124, 164], F = [134, 172];
      const kb = [162, 171], kt = lerpAny([162, 166], [152, 132], t);
      let s = `<ellipse class="ftowel" cx="52" cy="168" rx="22" ry="7"/>`;
      s += line('ff', [H, kb, F], 8);
      s += line('fb', [[76, 164], H], 14);
      s += line('fb', [[78, 156], [98, 146], [122, 154]], 6);
      s += `<circle class="fhead" cx="54" cy="156" r="10"/>`;
      s += line('fb', [H, kt, F], 8);
      s += line('fh', [H, kt], 9) + `<circle class="fglow" cx="${H[0]}" cy="${H[1] - 2}" r="14"/>`;
      return s;
    },
  };

  /* ---------- render API ---------- */
  function frame(id, t) {
    const d = FIG[id];
    if (!d) return '';
    const base = `<line class="floor" x1="8" y1="${FLOOR + 2}" x2="312" y2="${FLOOR + 2}"/>`;
    const mat = d.mat ? `<rect class="fmat" x="24" y="${FLOOR - 1}" width="236" height="6" rx="3"/>` : '';
    if (d.draw) return base + mat + d.draw(t);
    const pose = { hip: lerpAny(d.A.hip, d.B.hip, t), torso: lerp(d.A.torso, d.B.torso, t),
      hd: d.A.hd === undefined ? undefined : lerp(d.A.hd, d.B.hd, t),
      arm: lerpAny(d.A.arm, d.B.arm, t), legN: lerpAny(d.A.legN, d.B.legN, t), legF: lerpAny(d.A.legF, d.B.legF, t) };
    return base + mat + drawSkel(pose, d);
  }
  function svg(id, t, label) {
    const vb = FIG[id] && FIG[id].mat ? '0 76 320 112' : '0 0 320 190';
    return `<svg class="fig" viewBox="${vb}" role="img" aria-label="${label || id}">${frame(id, t)}</svg>`;
  }

  const running = new Set();
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ease = (x) => x * x * (3 - 2 * x);
  const PERIOD = 4400;

  function mount(el, id) {
    const d = FIG[id];
    el.innerHTML = svg(id, 0, d ? d.labels.join(' to ') : id);
    const svgEl = el.firstChild;
    const caption = el.parentNode && el.parentNode.querySelector('[data-figlabel]');
    if (!d || reduce()) return () => {};
    let raf = 0, last = -1, stopped = false;
    const tick = (now) => {
      if (stopped) return;
      const u = (now % PERIOD) / PERIOD;
      let t, idx;
      if (u < 0.12) { t = 0; idx = 0; }
      else if (u < 0.42) { t = ease((u - 0.12) / 0.3); idx = t > 0.5 ? 1 : 0; }
      else if (u < 0.7) { t = 1; idx = 1; }
      else { t = 1 - ease((u - 0.7) / 0.3); idx = t > 0.5 ? 1 : 0; }
      svgEl.innerHTML = frame(id, t);
      if (caption && idx !== last) { caption.textContent = d.labels[idx]; last = idx; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const stop = () => { stopped = true; cancelAnimationFrame(raf); running.delete(stop); };
    running.add(stop);
    return stop;
  }
  function stopAll() { [...running].forEach((s) => s()); }

  KA.Fig = { svg, mount, stopAll, labels: (id) => (FIG[id] ? FIG[id].labels : ['', '']), has: (id) => !!FIG[id], ids: () => Object.keys(FIG) };
})();
