(function () {
  const KA = window.KA;
  const { EX, STAGES, EQUIP } = KA.Data;
  const { Player } = KA.Timer;
  const St = KA.Store;
  const D = () => St.d;

  /* ---------- helpers ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const dstr = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => dstr(new Date());
  const mondayOf = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
  const clock = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + pad(s % 60); };
  const prettyDate = (ds) => new Date(ds + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const stageOf = (n) => STAGES[n - 1];
  const cfg = () => ({ knee: D().knee, bothLegs: D().bothLegs });

  function prescText(p, ex) {
    const uni = p.uni !== undefined ? p.uni : ex.uni;
    const each = uni ? ' each side' : '';
    if (p.reps === 1 && p.hold) return p.sets + ' × ' + p.hold + ' s' + each;
    return p.sets + ' × ' + p.reps + (p.hold ? ', ' + p.hold + ' s hold' : '') + each;
  }
  function stepsFor(stage) {
    const s = stageOf(stage);
    const tag = (arr, phase) => arr.map((p) => Object.assign({}, p, { phase }));
    return [...tag(s.warm, 'Warm-up'), ...tag(s.main, 'Main exercises'), ...tag(s.cool, 'Cool-down')];
  }
  const estMin = (stage) => {
    const st = stepsFor(stage);
    return Math.round((KA.Timer.total(KA.Timer.build(st, cfg())) + st.length * 15) / 60);
  };
  const ytLink = (ex) => ex.video || 'https://www.youtube.com/results?search_query=' + encodeURIComponent(ex.yt);

  /* ---------- progress logic ---------- */
  const sessionsOf = (stage) => D().sessions.filter((s) => s.stage === stage).sort((a, b) => a.ts.localeCompare(b.ts));
  function readiness(stage) {
    const ss = sessionsOf(stage);
    if (ss.length < 4) return { state: 'building', n: ss.length };
    const last = ss.slice(-3);
    const why = [];
    if (last.some((s) => !s.controlled)) why.push('a recent session did not feel controlled');
    if (last.some((s) => s.pain > 2)) why.push('knee pain went above 2 out of 10');
    if (last.some((s) => s.morning === false)) why.push('the knee was not back to normal the next morning');
    if (why.length) return { state: 'hold', why };
    if (last.some((s) => s.morning == null)) return { state: 'pending' };
    return { state: 'ready' };
  }
  const pendingMorning = () => {
    const ss = D().sessions.slice().sort((a, b) => b.ts.localeCompare(a.ts));
    return ss.find((s) => s.morning == null && s.date < today());
  };

  /* ---------- UI shell ---------- */
  let tab = 'today';
  const view = () => $('#view');
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600);
  }
  function setTab(t) {
    tab = t; KA.Fig.stopAll();
    document.querySelectorAll('nav button').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === t ? 'page' : 'false'));
    render(); window.scrollTo(0, 0);
  }
  function render() { KA.Fig.stopAll(); view().innerHTML = ({ today: rToday, plan: rPlan, timer: rTimer, progress: rProgress, guide: rGuide }[tab])(); if (tab === 'timer') updateQuick(); }

  /* ---------- sheet ---------- */
  function openSheet(html) {
    $('#sheetbody').innerHTML = html;
    $('#sheet').hidden = false; document.body.classList.add('lock');
    $('#sheetbody').scrollTop = 0;
  }
  function closeSheet() { KA.Fig.stopAll(); $('#sheet').hidden = true; $('#sheetbody').innerHTML = ''; document.body.classList.remove('lock'); if (!$('#runner').hidden) mountRunnerFig(); }

  /* ---------- Today ---------- */
  function rToday() {
    const stage = D().stage, s = stageOf(stage), r = readiness(stage);
    const now = new Date(), mon = mondayOf(now);
    const wk = D().sessions.filter((x) => new Date(x.date + 'T12:00:00') >= mon);
    const doneToday = D().sessions.some((x) => x.date === today());
    const yesterday = D().sessions.some((x) => x.date === dstr(new Date(Date.now() - 864e5)));
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => {
      const d = new Date(mon); d.setDate(d.getDate() + i);
      const n = D().sessions.filter((x) => x.date === dstr(d)).length;
      return `<div class="day${n ? ' done' : ''}${dstr(d) === today() ? ' now' : ''}"><span>${l}</span><i>${n ? '✓' : ''}</i></div>`;
    }).join('');
    const pm = pendingMorning();
    let h = `<section class="hero"><div class="pill">Stage ${s.n} of 4 · Weeks ${s.weeks}</div><h1>${esc(s.name)}</h1><p>${esc(s.goal)}</p></section>`;
    if (pm) h += `<section class="card warn"><h2>Morning check</h2><p>How is your knee this morning, compared with before your session on ${prettyDate(pm.date)}?</p>
      <div class="row"><button class="btn good" data-a="morning" data-id="${pm.id}" data-v="1">Back to normal</button><button class="btn bad" data-a="morning" data-id="${pm.id}" data-v="0">More sore or swollen</button></div></section>`;
    h += `<section class="card"><h2>${doneToday ? 'Done for today ✓' : 'Today’s session'}</h2>
      <p class="muted">About ${estMin(stage)} min · ${s.main.length} main exercises · warm-up and cool-down included</p>
      <div class="chips">${s.equipment.map((e) => `<span class="chip">${esc(EQUIP[e].name)}</span>`).join('')}</div>
      ${yesterday && !doneToday ? '<p class="note">You trained yesterday. A rest day between sessions is ideal, but it is your call.</p>' : ''}
      <button class="btn primary big" data-a="start">${doneToday ? 'Do another session' : 'Start guided session'}</button>
      <button class="btn ghost" data-a="plan-stage" data-n="${stage}">Preview the exercises</button></section>`;
    h += `<section class="card"><h2>This week</h2><div class="week">${days}</div><p class="muted">${wk.length} of 3 sessions done. Aim for 3 a week with a rest day between.</p></section>`;
    h += readyCard(stage, r);
    h += `<section class="card"><h2>On your other days</h2><p>${esc(s.walk)}</p></section>`;
    h += `<section class="card rule"><h2>Pain rule</h2>${ruleBars()}<button class="link" data-a="tab" data-t="guide">Read the full pain rule</button></section>`;
    return h;
  }
  const ruleBars = () => `<div class="bars"><span class="g">Muscle burn or tiredness: fine</span><span class="g">Knee pain 0 to 2: fine</span><span class="y">Knee pain 3 to 4: ease off</span><span class="r">5+ or sharp: stop that exercise</span></div>`;

  function readyCard(stage, r) {
    const last = stage === 4;
    let body, cls = '';
    if (r.state === 'building') body = `<p>${r.n} of 4 sessions logged in this stage. Keep going. You move up when the knee is ready, not on a date.</p>`;
    else if (r.state === 'hold') { cls = 'warn'; body = `<p>Hold here for now: ${r.why.join('; ')}. Repeat this stage, a little lighter, until three sessions in a row feel good.</p>`; }
    else if (r.state === 'pending') body = `<p>Nearly there. Answer tomorrow’s morning check to confirm the knee is back to normal.</p>`;
    else { cls = 'good'; body = last ? `<p>You meet the test for the final stage. Keep these exercises going. Taking 12 to 14 weeks in total is normal, and a physio can help with what comes next.</p>`
      : `<p>Your last 3 sessions were controlled, pain stayed at 0 to 2 and the knee was fine next morning. You are ready to move up.</p><button class="btn primary" data-a="setstage" data-n="${stage + 1}">Move to Stage ${stage + 1}</button>`; }
    return `<section class="card ${cls}"><h2>Ready to move up?</h2>${body}<p class="muted small">The test: controlled sessions, knee pain 0 to 2 out of 10, and back to normal the next morning, three sessions in a row.</p></section>`;
  }

  /* ---------- Plan ---------- */
  let planStage = null;
  function rPlan() {
    const n = planStage || D().stage, s = stageOf(n);
    const seg = STAGES.map((x) => `<button data-a="plan-stage" data-n="${x.n}" aria-pressed="${x.n === n}">${x.n}</button>`).join('');
    const row = (p) => { const ex = EX[p.id];
      return `<button class="ex" data-a="ex" data-id="${p.id}" data-n="${n}"><span class="thumb">${KA.Fig.svg(ex.fig, 1, ex.name)}</span><span class="exb"><b>${esc(ex.name)}</b><small>${esc(prescText(p, ex))}${p.note ? ' · ' + esc(p.note) : ''}</small></span><span class="chev">›</span></button>`; };
    let h = `<div class="seg" role="group" aria-label="Stage">${seg}</div>
      <section class="hero small"><div class="pill">Stage ${n} · Weeks ${s.weeks}${n === D().stage ? ' · you are here' : ''}</div><h1>${esc(s.name)}</h1><p>${esc(s.goal)}</p>
      <ul class="rules">${s.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      ${n !== D().stage ? `<button class="btn" data-a="setstage" data-n="${n}">Use this stage</button>` : ''}</section>
      <section class="card"><h2>You will need</h2>${s.equipment.map((e) => `<label class="check"><input type="checkbox" data-a="equip" data-k="${e}" ${D().equip[e] ? 'checked' : ''}><span><b>${esc(EQUIP[e].name)}</b><small>${esc(EQUIP[e].hint)}</small></span></label>`).join('')}</section>
      <h3 class="sec">Warm-up</h3><div class="list">${s.warm.map(row).join('')}</div>
      <h3 class="sec">Main exercises</h3><div class="list">${s.main.map(row).join('')}</div>
      <h3 class="sec">Cool-down</h3><div class="list">${s.cool.map(row).join('')}</div>
      <button class="btn primary big" data-a="start" data-n="${n}">Start Stage ${n} session</button>`;
    return h;
  }

  function openExercise(id, stageN) {
    const ex = EX[id], s = stageOf(stageN || D().stage);
    const p = [...s.warm, ...s.main, ...s.cool].find((x) => x.id === id);
    const L = KA.Fig.labels(ex.fig);
    const list = (a) => a.map((x) => `<li>${esc(x)}</li>`).join('');
    openSheet(`<h2>${esc(ex.name)}</h2><p class="muted">${esc(ex.muscles)}${p ? ' · ' + esc(prescText(p, ex)) : ''}</p>
      <div class="figbox"><div data-fig></div><div class="figlabel" data-figlabel>${esc(L[0])}</div></div>
      <div class="stills"><figure>${KA.Fig.svg(ex.fig, 0)}<figcaption>Start: ${esc(L[0])}</figcaption></figure><figure>${KA.Fig.svg(ex.fig, 1)}<figcaption>Finish: ${esc(L[1])}</figcaption></figure></div>
      <p class="legend"><i></i> Orange shows the working muscle.</p>
      ${p && p.note ? `<p class="note">This stage: ${esc(p.note)}</p>` : ''}
      ${ex.why ? `<p>${esc(ex.why)}</p>` : ''}
      <h3>Set up</h3><p>${esc(ex.setup)}</p>
      <h3>How to do it</h3><ol>${list(ex.steps)}</ol>
      <h3>Look out for</h3><ul>${list(ex.cues)}</ul>
      <h3>Common mistakes</h3><ul>${list(ex.mistakes)}</ul>
      <div class="two"><div><h3>Too hard?</h3><p>${esc(ex.easier)}</p></div><div><h3>Too easy?</h3><p>${esc(ex.harder)}</p></div></div>
      <a class="btn yt" href="${esc(ytLink(ex))}" target="_blank" rel="noopener">▶ Watch demonstrations on YouTube</a>
      <button class="btn primary" data-a="practice" data-id="${id}" data-n="${stageN || D().stage}">Practise this one with the timer</button>
      <button class="btn ghost" data-a="closesheet">Close</button>`);
    const fb = $('#sheetbody [data-fig]'); KA.Fig.mount(fb, ex.fig);
  }

  /* ---------- Runner ---------- */
  const R = { steps: [], segs: [], step: 0, fig: null, practice: false, stageN: 1 };
  const CIRC = 2 * Math.PI * 70;
  function startSession(stageN, only) {
    let steps = only ? [only] : stepsFor(stageN);
    R.steps = steps; R.stageN = stageN; R.practice = !!only;
    R.segs = KA.Timer.build(steps, cfg()); R.step = -1;
    const o = Object.assign({}, D().settings);
    $('#runner').hidden = false; document.body.classList.add('lock');
    $('#runner').innerHTML = `<div class="rtop"><button class="icon" data-a="rend" aria-label="End session">✕</button><div class="rph"><span id="rphase"></span><small id="rstep"></small></div>
      <button class="icon" data-a="rsound" id="rsound" aria-label="Sound">${o.sound ? '🔊' : '🔇'}</button></div>
      <div class="rbar"><i id="rprog"></i></div>
      <div class="rbody"><div class="rname" id="rname"></div><div class="rfig" id="rfigbox"><div id="rfig"></div><div class="figlabel" id="rfiglabel" data-figlabel></div></div>
      <div class="ring"><svg viewBox="0 0 160 160" aria-hidden="true"><circle class="rb" cx="80" cy="80" r="70"/><circle class="rf" id="rring" cx="80" cy="80" r="70" stroke-dasharray="${CIRC}" stroke-dashoffset="0"/></svg>
        <div class="rtext"><div class="rlabel" id="rlabel"></div><div class="rnum" id="rnum"></div></div></div>
      <div class="rinfo" id="rinfo"></div><div class="rnext" id="rnext"></div></div>
      <div class="rctl"><button class="icon lg" data-a="rprev" aria-label="Previous exercise">⏮</button><button class="play" data-a="rtoggle" id="rplay" aria-label="Pause">❚❚</button><button class="icon lg" data-a="rnext" aria-label="Next exercise">⏭</button></div>
      <div class="rfoot"><button class="link" data-a="rskip" id="rskip" hidden>Skip rest</button><button class="link" data-a="rvoice" id="rvoice">${o.voice ? 'Voice: on' : 'Voice: off'}</button><button class="link" data-a="rrule">Pain rule</button></div>`;
    Player.start(R.segs, o, { onSeg: runnerSeg, onTick: runnerTick, onState: runnerState, onDone: runnerDone });
  }
  function mountRunnerFig() {
    const st = R.steps[R.step]; if (!st) return;
    const ex = st.ex || EX[st.id];
    if (R.fig) R.fig();
    const box = $('#rfig'), lab = $('#rfigbox');
    if (ex.fig) { lab.hidden = false; R.fig = KA.Fig.mount(box, ex.fig); } else { lab.hidden = true; R.fig = null; }
  }
  function runnerSeg(s) {
    if (s.step !== R.step) {
      R.step = s.step;
      const st = R.steps[s.step], ex = st.ex || EX[st.id];
      $('#rphase').textContent = st.phase || (R.practice ? 'Practice' : '');
      $('#rstep').textContent = 'Exercise ' + (s.step + 1) + ' of ' + R.steps.length;
      $('#rname').textContent = ex.name;
      $('#rprog').style.width = (s.step / R.steps.length * 100) + '%';
      mountRunnerFig();
    }
    const st = R.steps[s.step], ex = st.ex || EX[st.id];
    const lbl = s.kind === 'prep' ? 'Get ready' : s.label;
    const el = $('#rlabel'); el.textContent = lbl; $('#runner').dataset.kind = s.kind;
    const bits = [];
    if (s.side) bits.push(s.side);
    bits.push('Set ' + s.set + ' of ' + s.sets);
    if (s.kind === 'work' && s.reps > 1) bits.push('Rep ' + s.rep + ' of ' + s.reps);
    $('#rinfo').textContent = s.kind === 'prep' ? ex.setup : bits.join(' · ');
    $('#rnext').textContent = s.kind === 'rest' ? 'Next: ' + s.next + (st.note ? '' : '') : (st.note || '');
    $('#rskip').hidden = s.kind !== 'rest';
    runnerTick(s.secs * 1000, s);
  }
  function runnerTick(left, s) {
    $('#rnum').textContent = s.secs >= 60 ? clock(left / 1000) : Math.ceil(left / 1000);
    $('#rring').style.strokeDashoffset = CIRC * (1 - left / (s.secs * 1000));
  }
  function runnerState() { const p = $('#rplay'); if (p) { p.textContent = Player.paused ? '▶' : '❚❚'; p.setAttribute('aria-label', Player.paused ? 'Resume' : 'Pause'); } }
  function endRunner() {
    Player.stop(); if (R.fig) R.fig(); R.fig = null;
    $('#runner').hidden = true; $('#runner').innerHTML = ''; document.body.classList.remove('lock');
  }
  function runnerDone() { const n = R.stageN, practice = R.practice; endRunner(); if (!practice) finishDialog(n, true); else { toast('Nice work.'); } }
  function confirmEnd() {
    Player.pause();
    openSheet(`<h2>End this session?</h2><p>You can log what you did so far, discard it, or carry on.</p>
      <button class="btn" data-a="resume">Carry on</button><button class="btn primary" data-a="endlog">End and log it</button><button class="btn ghost" data-a="enddiscard">End without logging</button>`);
  }

  /* ---------- Finish / log ---------- */
  function finishDialog(stageN, fromTimer) {
    openSheet(`<h2>${fromTimer ? 'Session complete 🎉' : 'Log a session'}</h2>
      <p class="muted">Takes 10 seconds. This is what tells you when to move up.</p>
      <label class="fld">Worst knee pain during the session: <b id="painv">0</b> / 10<input type="range" id="pain" min="0" max="10" value="0" step="1"></label>
      <div class="bars tight"><span class="g">0 to 2 fine</span><span class="y">3 to 4 ease off</span><span class="r">5+ stop</span></div>
      <div class="fld">Did the exercises feel controlled?<div class="row"><button class="btn tog on" data-a="ctl" data-v="1">Yes</button><button class="btn tog" data-a="ctl" data-v="0">Shaky or struggling</button></div></div>
      <label class="fld">Note (optional)<textarea id="note" rows="2" maxlength="300" placeholder="Anything worth remembering"></textarea></label>
      <button class="btn primary big" data-a="savesession" data-n="${stageN}">Save session</button>`);
    window._ctl = true;
  }
  function saveSession(stageN) {
    const now = new Date();
    D().sessions.push({ id: String(now.getTime()), ts: now.toISOString(), date: today(), stage: stageN,
      pain: +$('#pain').value, controlled: !!window._ctl, note: ($('#note').value || '').trim(), morning: null });
    St.save(); closeSheet(); render(); toast('Session saved. Well done.');
  }

  /* ---------- Timer tab ---------- */
  const Q = { mode: 'down', total: 60, left: 60000, run: false, end: 0, start: 0, iv: 0, el: 0 };
  function rTimer() {
    const pre = [30, 45, 60, 90, 120, 300].map((s) => `<button class="chip btn" data-a="qset" data-s="${s}">${s >= 60 ? s / 60 + ' min' : s + ' s'}</button>`).join('');
    return `<section class="hero small"><h1>Timer</h1><p>A quick countdown or stopwatch, plus an interval timer for holds and rests.</p></section>
      <section class="card"><div class="seg two" role="group"><button data-a="qmode" data-m="down" aria-pressed="${Q.mode === 'down'}">Countdown</button><button data-a="qmode" data-m="up" aria-pressed="${Q.mode === 'up'}">Stopwatch</button></div>
      <div class="qtime" id="qtime">0:00</div>
      ${Q.mode === 'down' ? `<div class="chips center">${pre}</div><div class="row center"><button class="btn" data-a="qadd" data-s="-10">−10 s</button><button class="btn" data-a="qadd" data-s="10">+10 s</button></div>` : ''}
      <div class="row"><button class="btn primary big" data-a="qgo" id="qgo">Start</button><button class="btn" data-a="qreset">Reset</button></div></section>
      <section class="card"><h2>Interval timer</h2><p class="muted">Set your own hold, relax, reps, sets and rest. It runs like a guided session.</p>
      <div class="grid4"><label>Hold (s)<input type="number" id="iv-hold" value="5" min="1" max="120" inputmode="numeric"></label><label>Relax (s)<input type="number" id="iv-relax" value="2" min="0" max="60" inputmode="numeric"></label>
      <label>Reps<input type="number" id="iv-reps" value="8" min="1" max="50" inputmode="numeric"></label><label>Sets<input type="number" id="iv-sets" value="2" min="1" max="10" inputmode="numeric"></label>
      <label>Rest (s)<input type="number" id="iv-rest" value="30" min="5" max="180" inputmode="numeric"></label></div>
      <button class="btn primary big" data-a="ivgo">Start interval timer</button></section>
      <section class="card"><h2>Sound and voice</h2>${toggles()}</section>`;
  }
  const toggles = () => ['sound:Beeps', 'vibrate:Vibration (Android)', 'voice:Voice cues'].map((x) => { const [k, l] = x.split(':');
    return `<label class="check"><input type="checkbox" data-a="setting" data-k="${k}" ${D().settings[k] ? 'checked' : ''}><span><b>${l}</b></span></label>`; }).join('');
  function qInit() { Q.left = Q.total * 1000; Q.el = 0; }
  function updateQuick() {
    const t = $('#qtime'); if (!t) return;
    if (Q.run) { if (Q.mode === 'down') Q.left = Math.max(0, Q.end - Date.now()); else Q.el = Date.now() - Q.start; }
    t.textContent = clock((Q.mode === 'down' ? Q.left : Q.el) / 1000 - (Q.mode === 'up' ? 0.999 : 0));
    const b = $('#qgo'); if (b) b.textContent = Q.run ? 'Pause' : 'Start';
  }
  function qTick() {
    updateQuick();
    if (Q.mode === 'down' && Q.run) {
      const w = Math.ceil(Q.left / 1000);
      if (w !== Q.w) { Q.w = w; if (w > 0 && w <= 3 && D().settings.sound) KA.Timer.beep(520, 0.1); }
      if (Q.left <= 0) { Q.run = false; clearInterval(Q.iv); if (D().settings.sound) { KA.Timer.beep(880, 0.3); setTimeout(() => KA.Timer.beep(880, 0.3), 350); } if (navigator.vibrate && D().settings.vibrate) navigator.vibrate([200, 100, 200]); toast('Time is up'); updateQuick(); }
    }
  }
  function qToggle() {
    KA.Timer.unlock();
    if (Q.run) { Q.run = false; clearInterval(Q.iv); if (Q.mode === 'up') Q.el = Date.now() - Q.start; }
    else { if (Q.mode === 'down') { if (Q.left <= 0) qInit(); Q.end = Date.now() + Q.left; } else Q.start = Date.now() - Q.el; Q.run = true; clearInterval(Q.iv); Q.iv = setInterval(qTick, 200); }
    updateQuick();
  }

  /* ---------- Progress ---------- */
  function rProgress() {
    const ss = D().sessions.slice().sort((a, b) => a.ts.localeCompare(b.ts));
    const recent = ss.slice(-5), avg = recent.length ? (recent.reduce((a, s) => a + s.pain, 0) / recent.length).toFixed(1) : '–';
    const mon = mondayOf(new Date());
    const wkN = ss.filter((x) => new Date(x.date + 'T12:00:00') >= mon).length;
    let h = `<section class="hero small"><h1>Progress</h1></section>
      <div class="tiles"><div><b>${ss.length}</b><span>sessions</span></div><div><b>${wkN}</b><span>this week</span></div><div><b>${avg}</b><span>avg pain (last 5)</span></div></div>`;
    h += `<section class="card"><h2>Session tracker</h2>`;
    STAGES.forEach((s) => {
      const done = sessionsOf(s.n), target = s.weekCount * 3, boxes = Math.max(target, Math.ceil(done.length / 3) * 3);
      let b = '';
      for (let i = 0; i < boxes; i++) {
        const x = done[i];
        if (x) b += `<button class="box on" data-a="sess" data-id="${x.id}" aria-label="Session ${i + 1}, ${prettyDate(x.date)}"><i>✓</i><small>${new Date(x.date + 'T12:00:00').getDate()}/${new Date(x.date + 'T12:00:00').getMonth() + 1}</small></button>`;
        else if (s.n === D().stage) b += `<button class="box" data-a="logmanual" data-n="${s.n}" aria-label="Log a session"><i>+</i></button>`;
        else b += `<span class="box dis"></span>`;
      }
      h += `<div class="trow"><div class="thead"><b>Stage ${s.n}</b> · ${esc(s.name)} <small>Weeks ${s.weeks}${s.n === D().stage ? ' · now' : ''}</small></div><div class="boxes">${b}</div></div>`;
    });
    h += `<p class="muted small">Boxes are 3 per week. Extra weeks are fine: more boxes appear as you go. Tap “+” to log a session you did without the timer.</p></section>`;
    h += `<section class="card"><h2>Knee pain after sessions</h2>${painChart(ss.slice(-20))}</section>`;
    h += readyCard(D().stage, readiness(D().stage));
    h += `<section class="card"><h2>History</h2>${ss.length ? ss.slice().reverse().slice(0, 15).map((x) => `<button class="hist" data-a="sess" data-id="${x.id}"><b>${prettyDate(x.date)}</b><span>Stage ${x.stage} · pain ${x.pain}/10 · ${x.controlled ? 'controlled' : 'shaky'}${x.morning === true ? ' · next morning fine' : x.morning === false ? ' · next morning sore' : ''}</span></button>`).join('') : '<p class="muted">No sessions logged yet.</p>'}</section>`;
    h += `<section class="card"><h2>Settings</h2>
      <div class="fld">Which knee is the problem?<div class="seg three" role="group">${['left', 'right', 'both'].map((k) => `<button data-a="knee" data-k="${k}" aria-pressed="${D().knee === k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div></div>
      <label class="check"><input type="checkbox" data-a="bothlegs" ${D().bothLegs ? 'checked' : ''}><span><b>Exercise both legs</b><small>Recommended. The sore knee goes first. Untick to train only the sore side.</small></span></label>
      ${toggles()}
      <div class="fld">Stage<div class="seg" role="group">${STAGES.map((x) => `<button data-a="setstage" data-n="${x.n}" aria-pressed="${x.n === D().stage}">${x.n}</button>`).join('')}</div></div></section>
      <section class="card"><h2>Reminders</h2><p class="muted">Download a calendar entry that repeats Monday, Wednesday and Friday for 14 weeks, then open it to add it to your phone calendar.</p>
      <label class="fld">Time<input type="time" id="rtime" value="${esc(D().remindTime)}"></label><button class="btn" data-a="ics">Download reminders (.ics)</button></section>
      <section class="card"><h2>Back up your data</h2><p class="muted">Everything is saved on this phone only. Back up before changing phones or clearing browser data.</p>
      <button class="btn" data-a="export">Download backup</button><label class="btn file">Restore backup<input type="file" accept="application/json,.json" id="imp" hidden></label>
      <button class="btn" data-a="summary">Copy summary for your physio</button><button class="btn bad ghost" data-a="reset">Erase all my data</button></section>`;
    return h;
  }
  function painChart(ss) {
    if (ss.length < 2) return '<p class="muted">The chart appears after your second session.</p>';
    const W = 300, H = 100, x = (i) => 12 + i * (W - 24) / (ss.length - 1), y = (v) => H - 10 - v * (H - 20) / 10;
    const pts = ss.map((s, i) => `${x(i).toFixed(1)},${y(s.pain).toFixed(1)}`).join(' ');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pain after each session"><rect x="0" y="${y(2)}" width="${W}" height="${y(0) - y(2)}" class="band"/>
      <text x="4" y="${y(2) - 3}" class="cl">0 to 2 is the target zone</text><polyline points="${pts}" class="cline"/>${ss.map((s, i) => `<circle cx="${x(i)}" cy="${y(s.pain)}" r="3.5" class="cdot${s.pain > 2 ? ' hi' : ''}"/>`).join('')}</svg>`;
  }
  function sessionSheet(id) {
    const x = D().sessions.find((s) => s.id === id); if (!x) return;
    openSheet(`<h2>${prettyDate(x.date)}</h2><p>Stage ${x.stage} · knee pain ${x.pain}/10 · ${x.controlled ? 'felt controlled' : 'felt shaky'}</p>
      <p>Next morning: ${x.morning === true ? 'back to normal' : x.morning === false ? 'more sore than usual' : 'not recorded yet'}</p>${x.note ? `<p class="note">${esc(x.note)}</p>` : ''}
      <button class="btn bad ghost" data-a="delsess" data-id="${id}">Delete this session</button><button class="btn" data-a="closesheet">Close</button>`);
  }
  function download(name, text, type) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function makeICS(time) {
    const [hh, mm] = time.split(':'); const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    const ds = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
    const st = ds + 'T' + hh + mm + '00', en = ds + 'T' + hh + pad(+mm + 30 > 59 ? 59 : +mm + 30) + '00';
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Knee rehab//EN', 'BEGIN:VEVENT', 'UID:kneerehab-' + Date.now() + '@local', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z',
      'DTSTART:' + st, 'DTEND:' + en, 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=42', 'SUMMARY:Knee exercises', 'DESCRIPTION:Open your knee rehab app and start a guided session.',
      'BEGIN:VALARM', 'TRIGGER:PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:Knee exercises', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  }
  function summaryText() {
    const ss = D().sessions.slice().sort((a, b) => a.ts.localeCompare(b.ts));
    return 'Knee rehab log (' + ss.length + ' sessions). Current stage ' + D().stage + '.\n' + ss.map((s) => `${s.date}  stage ${s.stage}  pain ${s.pain}/10  ${s.controlled ? 'controlled' : 'shaky'}  next morning: ${s.morning === true ? 'ok' : s.morning === false ? 'sore' : 'n/a'}${s.note ? '  "' + s.note + '"' : ''}`).join('\n');
  }

  /* ---------- Guide ---------- */
  function rGuide() {
    const li = (a) => a.map((x) => `<li>${x}</li>`).join('');
    return `<section class="hero small"><h1>Guide</h1><p>The rules that keep this programme safe.</p></section>
      <section class="card"><h2>Pain rule</h2>
        <div class="pr g"><b>Muscle burn: fine</b><p>Burning, tiredness or shaking in the thigh, buttock or calf. It fades within a couple of minutes of stopping.</p></div>
        <div class="pr g"><b>Knee pain 0 to 2 out of 10: fine</b><p>A background awareness. Carry on.</p></div>
        <div class="pr y"><b>Knee pain 3 to 4: ease off</b><p>Do fewer reps, a shorter hold, a smaller range, or the easier version. If it does not settle, skip that exercise today.</p></div>
        <div class="pr r"><b>5 or more, or sharp, pinching, catching: stop that exercise</b><p>Leave it out for the rest of the session. If it keeps happening, speak to a physio.</p></div>
        <div class="pr y"><b>Next morning</b><p>If the knee is more painful, stiff or swollen than usual, take a rest day and repeat the same stage a little lighter. Do not move up.</p></div></section>
      <section class="card"><h2>Never, anywhere in this programme</h2><ul>${li(['No deep knee bends. Sitting down to a chair and small bends only.', 'No kneeling, including in stretches. That is why the usual heel-to-bottom thigh stretch is left out.', 'No pushing through sharp pain.', 'No bouncing or fast, jerky movements.'])}</ul></section>
      <section class="card"><h2>Moving up a stage</h2><p>You move up when the knee is ready, not on a fixed date. Three sessions in a row where:</p><ul>${li(['exercises felt controlled', 'knee pain stayed at 0 to 2 out of 10', 'the knee was back to normal the next morning'])}</ul><p>Taking 12 to 14 weeks instead of 10 is perfectly fine.</p></section>
      <section class="card bad"><h2>See a doctor if</h2><ul>${li(['The knee swells up noticeably, or locks, or gives way.', 'You cannot put weight through the leg.', 'A hot, red, swollen knee, especially with a fever.', 'Calf pain, swelling, warmth or redness. Get urgent advice, and call emergency services if you also have chest pain or shortness of breath.', 'Pins and needles or numbness that does not go away.'])}</ul></section>
      <section class="card"><h2>Tips</h2><ul>${li(['Aim for 3 sessions a week with a rest day between.', 'Wear supportive shoes or go barefoot on a firm floor.', 'Slow beats heavy. The lowering part is as important as the lifting.', 'Feeling stiff after is normal. Sharp or lingering knee pain is not.', 'Same time each day builds the habit. Use the reminder in Progress.'])}</ul></section>
      <section class="card"><h2>Videos</h2><p>Each exercise has a YouTube link in its details. Or search:</p>
        <a class="btn yt" href="https://www.youtube.com/results?search_query=beginner+knee+strengthening+exercises+physiotherapist" target="_blank" rel="noopener">▶ Beginner knee exercises</a>
        <a class="btn yt" href="https://www.youtube.com/results?search_query=no+kneeling+low+impact+knee+rehab+exercises" target="_blank" rel="noopener">▶ Low-impact, no-kneeling routines</a></section>
      <section class="card"><h2>Put it on your phone</h2><p><b>iPhone:</b> open in Safari, tap Share, then “Add to Home Screen”.</p><p><b>Android:</b> open in Chrome, tap ⋮, then “Install app” or “Add to Home screen”.</p><p>After the first load it works without internet.</p></section>
      <section class="card"><h2>About</h2><p class="small muted">General exercise information, not medical advice. If you have a diagnosis, recent injury or surgery, or anything here feels wrong, check with your doctor or physiotherapist first. Your tracker and settings are stored on this phone only.</p></section>`;
  }

  /* ---------- events ---------- */
  const A = {
    tab: (e) => setTab(e.dataset.t),
    start: (e) => startSession(+e.dataset.n || D().stage),
    'plan-stage': (e) => { planStage = +e.dataset.n; setTab('plan'); },
    ex: (e) => openExercise(e.dataset.id, +e.dataset.n),
    closesheet: () => closeSheet(),
    practice: (e) => { const id = e.dataset.id, s = stageOf(+e.dataset.n); const p = [...s.warm, ...s.main, ...s.cool].find((x) => x.id === id) || { id, sets: 1, reps: 5, up: 2, hold: 2, down: 2, rest: 20 };
      closeSheet(); startSession(+e.dataset.n, Object.assign({}, p, { phase: 'Practice' })); },
    setstage: (e) => { D().stage = +e.dataset.n; planStage = null; St.save(); render(); toast('Now on Stage ' + e.dataset.n); },
    equip: (e) => { D().equip[e.dataset.k] = e.checked; St.save(); },
    setting: (e) => { D().settings[e.dataset.k] = e.checked; St.save(); },
    knee: (e) => { D().knee = e.dataset.k; St.save(); render(); },
    bothlegs: (e) => { D().bothLegs = e.checked; St.save(); },
    morning: (e) => { const s = D().sessions.find((x) => x.id === e.dataset.id); if (s) { s.morning = e.dataset.v === '1'; St.save(); render();
      if (!s.morning) toast('Take a rest day and repeat this stage a little lighter.'); } },
    rend: () => confirmEnd(),
    resume: () => { closeSheet(); Player.resume(); },
    endlog: () => { const n = R.stageN; closeSheet(); endRunner(); finishDialog(n, false); },
    enddiscard: () => { closeSheet(); endRunner(); },
    rtoggle: () => Player.toggle(),
    rprev: () => { const s = Player.segs[Player.i]; Player.gotoStep(Math.max(0, s.step - 1)); },
    rnext: () => { const s = Player.segs[Player.i]; Player.gotoStep(s.step + 1); },
    rskip: () => Player.skipSeg(),
    rsound: () => { D().settings.sound = !D().settings.sound; Player.opts.sound = D().settings.sound; St.save(); $('#rsound').textContent = D().settings.sound ? '🔊' : '🔇'; },
    rvoice: () => { D().settings.voice = !D().settings.voice; Player.opts.voice = D().settings.voice; St.save(); $('#rvoice').textContent = D().settings.voice ? 'Voice: on' : 'Voice: off'; },
    rrule: () => { Player.pause(); R.fig && R.fig(); openSheet(`<h2>Pain rule</h2>${ruleBars()}<p>Muscle burn is fine. Knee pain 3 to 4: make it easier. 5 or more, or sharp: stop this exercise.</p><button class="btn primary" data-a="resume">Back to the session</button>`); },
    ctl: (e) => { window._ctl = e.dataset.v === '1'; document.querySelectorAll('[data-a=ctl]').forEach((b) => b.classList.toggle('on', b === e)); },
    savesession: (e) => saveSession(+e.dataset.n),
    logmanual: (e) => finishDialog(+e.dataset.n, false),
    sess: (e) => sessionSheet(e.dataset.id),
    delsess: (e) => { D().sessions = D().sessions.filter((x) => x.id !== e.dataset.id); St.save(); closeSheet(); render(); },
    qmode: (e) => { clearInterval(Q.iv); Q.run = false; Q.mode = e.dataset.m; qInit(); render(); },
    qset: (e) => { clearInterval(Q.iv); Q.run = false; Q.total = +e.dataset.s; qInit(); updateQuick(); },
    qadd: (e) => { Q.total = Math.max(5, Q.total + +e.dataset.s); if (Q.run) Q.end += +e.dataset.s * 1000; qInit(); if (Q.run) Q.left = Q.end - Date.now(); updateQuick(); },
    qgo: () => qToggle(),
    qreset: () => { clearInterval(Q.iv); Q.run = false; qInit(); updateQuick(); },
    ivgo: () => {
      const n = (id, d) => Math.max(0, Math.round(+$('#' + id).value || d));
      const hold = Math.max(1, n('iv-hold', 5)), relax = n('iv-relax', 2);
      const step = { ex: { name: 'Interval timer', verbs: { up: 'Go', hold: 'Hold', down: 'Relax' }, setup: 'Get into position.', fig: null, uni: false },
        sets: Math.max(1, n('iv-sets', 2)), reps: Math.max(1, n('iv-reps', 8)), hold, down: relax, rest: Math.max(5, n('iv-rest', 30)), phase: 'Interval timer', prep: 5 };
      startSession(D().stage, step);
    },
    ics: () => { download('knee-exercises.ics', makeICS($('#rtime').value || '18:00'), 'text/calendar'); D().remindTime = $('#rtime').value; St.save(); },
    export: () => download('knee-rehab-backup-' + today() + '.json', JSON.stringify(D(), null, 2), 'application/json'),
    summary: async () => { const t = summaryText(); try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); toast('Summary copied'); } } catch (e) { try { await navigator.clipboard.writeText(t); toast('Summary copied'); } catch (e2) { openSheet(`<h2>Summary</h2><pre class="pre">${esc(t)}</pre><button class="btn" data-a="closesheet">Close</button>`); } } },
    reset: () => openSheet(`<h2>Erase all data?</h2><p>This removes every session and setting on this phone. It cannot be undone.</p><button class="btn bad" data-a="reset2">Yes, erase everything</button><button class="btn ghost" data-a="closesheet">Cancel</button>`),
    reset2: () => { St.reset(); closeSheet(); setTab('today'); toast('Data erased'); },
  };

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-a]');
    if (!el || el.tagName === 'INPUT') return;
    if (el.tagName === 'A') return;
    const fn = A[el.dataset.a]; if (fn) fn(el, ev);
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.id === 'imp' && el.files[0]) {
      const fr = new FileReader();
      fr.onload = () => { try { const o = JSON.parse(fr.result); if (!o || !Array.isArray(o.sessions)) throw 0; St.replace(o); render(); toast('Backup restored'); } catch (e) { toast('That file is not a valid backup'); } };
      fr.readAsText(el.files[0]); return;
    }
    if (el.dataset && el.dataset.a && el.tagName === 'INPUT' && A[el.dataset.a]) A[el.dataset.a](el);
  });
  document.addEventListener('input', (ev) => { if (ev.target.id === 'pain') $('#painv').textContent = ev.target.value; });
  document.querySelectorAll('nav button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
  $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') { if (!$('#runner').hidden && Player.active && Player.paused) { closeSheet(); Player.resume(); } else closeSheet(); } });

  qInit(); render();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  KA._test = { startSession, stepsFor, estMin };
})();
