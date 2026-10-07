/* Guided timer: builds a timeline of segments (get ready / work phase / rest) and plays it.
   Uses wall-clock timestamps, so it stays accurate if the phone throttles the page. */
(function () {
  const KA = (window.KA = window.KA || {});
  const { EX } = KA.Data;

  /* ---------- timeline ---------- */
  function sidesFor(ex, p, cfg) {
    const uni = p.uni !== undefined ? p.uni : ex.uni;
    if (!uni) return [null];
    const labels = ex.sideLabels || ['Left leg', 'Right leg'];
    const idx = [0, 1];
    if (cfg.knee === 'right') idx.reverse();
    if (cfg.knee !== 'both' && cfg.bothLegs === false) return [labels[cfg.knee === 'right' ? 1 : 0]];
    return idx.map((i) => labels[i]);
  }

  function stepSegs(step, cfg, stepIdx) {
    const ex = step.ex || EX[step.id], p = step;
    const sides = sidesFor(ex, p, cfg);
    const phases = [[ex.verbs.up, p.up || 0], [ex.verbs.hold, p.hold || 0], [ex.verbs.down, p.down || 0]].filter((x) => x[1] > 0);
    const segs = [];
    sides.forEach((side, si) => {
      for (let s = 1; s <= p.sets; s++) {
        const meta = { step: stepIdx, side, set: s, sets: p.sets, reps: p.reps };
        if (si === 0 && s === 1) segs.push(Object.assign({ kind: 'prep', label: 'Get ready', secs: step.prep || 8 }, meta, { rep: 0 }));
        for (let r = 1; r <= p.reps; r++) phases.forEach(([label, secs]) => segs.push(Object.assign({ kind: 'work', label, secs, rep: r }, meta)));
        const last = si === sides.length - 1 && s === p.sets;
        if (!last) {
          const switching = s === p.sets;
          segs.push(Object.assign({ kind: 'rest', label: switching ? 'Switch sides' : 'Rest', secs: switching ? 10 : p.rest || 20, rep: 0,
            next: switching ? sides[si + 1] : 'Set ' + (s + 1) + ' of ' + p.sets }, meta));
        }
      }
    });
    return segs;
  }

  function build(steps, cfg) {
    const segs = [];
    steps.forEach((st, i) => stepSegs(st, cfg, i).forEach((s) => segs.push(s)));
    return segs;
  }
  const total = (segs) => segs.reduce((a, s) => a + s.secs, 0);

  /* ---------- audio / voice ---------- */
  let ctx = null;
  function unlock() {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
  }
  function beep(freq, dur, vol) {
    if (!ctx) return;
    try {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + dur + 0.02);
    } catch (e) { /* ignore */ }
  }
  function speak(text) {
    try {
      if (!window.speechSynthesis) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1; speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }

  let wake = null;
  async function keepAwake(on) {
    try {
      if (on && navigator.wakeLock) wake = await navigator.wakeLock.request('screen');
      else if (wake) { await wake.release(); wake = null; }
    } catch (e) { /* ignore */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Player.active) keepAwake(true); });

  /* ---------- player ---------- */
  const Player = {
    active: false,
    segs: [], i: 0, end: 0, left: 0, paused: true, timer: 0, opts: {}, cb: {},
    start(segs, opts, cb) {
      unlock(); keepAwake(true);
      Object.assign(Player, { active: true, segs, i: 0, opts: opts || {}, cb: cb || {}, paused: false });
      Player.enter(0, true);
      clearInterval(Player.timer);
      Player.timer = setInterval(Player.tick, 200);
    },
    enter(i, silent) {
      Player.i = i;
      const s = Player.segs[i];
      if (!s) return;
      Player.left = s.secs * 1000;
      Player.end = Date.now() + Player.left;
      Player.lastWhole = Math.ceil(s.secs);
      if (!silent || i === 0) Player.cue(s, true);
      if (Player.cb.onSeg) Player.cb.onSeg(s, i);
    },
    cue(s, first) {
      const o = Player.opts;
      if (o.sound !== false) {
        if (s.kind === 'work') beep(s.rep === 1 && s.label === Player.segs[Player.i].label ? 800 : 700, 0.18);
        else if (s.kind === 'rest') beep(440, 0.25);
        else beep(520, 0.12);
      }
      if (o.vibrate !== false && navigator.vibrate) navigator.vibrate(s.kind === 'work' ? 60 : 120);
      if (o.voice && first) {
        const say = s.kind === 'rest' ? (s.label === 'Switch sides' ? 'Switch sides. ' + s.next : 'Rest ' + s.secs + ' seconds')
          : s.kind === 'prep' ? 'Get ready' : s.label;
        speak(say);
      }
    },
    tick() {
      if (Player.paused || !Player.active) return;
      const s = Player.segs[Player.i];
      const ms = Player.end - Date.now();
      Player.left = Math.max(0, ms);
      const whole = Math.ceil(Player.left / 1000);
      if (whole !== Player.lastWhole) {
        Player.lastWhole = whole;
        if (whole > 0 && whole <= 3 && s.secs > 4 && Player.opts.sound !== false) beep(520, 0.08, 0.12);
      }
      if (ms <= 0) {
        if (Player.i + 1 >= Player.segs.length) { Player.finish(); return; }
        Player.enter(Player.i + 1);
      }
      if (Player.cb.onTick) Player.cb.onTick(Player.left, s);
    },
    pause() { if (Player.paused) return; Player.paused = true; Player.left = Math.max(0, Player.end - Date.now()); if (Player.cb.onState) Player.cb.onState(); },
    resume() { if (!Player.paused) return; unlock(); Player.paused = false; Player.end = Date.now() + Player.left; if (Player.cb.onState) Player.cb.onState(); },
    toggle() { Player.paused ? Player.resume() : Player.pause(); },
    gotoStep(step) {
      const idx = Player.segs.findIndex((s) => s.step === step);
      if (idx >= 0) { Player.enter(idx); if (Player.paused) Player.left = Player.segs[idx].secs * 1000; if (Player.cb.onTick) Player.cb.onTick(Player.left, Player.segs[idx]); }
      else Player.finish();
    },
    skipSeg() {
      if (Player.i + 1 >= Player.segs.length) return Player.finish();
      Player.enter(Player.i + 1);
      if (Player.paused) Player.left = Player.segs[Player.i].secs * 1000;
    },
    finish() {
      const cb = Player.cb;
      Player.stop();
      if (Player.opts.sound !== false) { beep(660, 0.15); setTimeout(() => beep(880, 0.25), 180); }
      if (Player.opts.vibrate !== false && navigator.vibrate) navigator.vibrate([100, 60, 200]);
      if (Player.opts.voice) speak('Session complete. Well done.');
      if (cb.onDone) cb.onDone();
    },
    stop() {
      clearInterval(Player.timer); Player.active = false; Player.paused = true; keepAwake(false);
      try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    },
  };

  KA.Timer = { build, total, Player, beep, unlock, sidesFor };
})();
