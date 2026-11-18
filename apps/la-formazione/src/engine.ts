import { esc, type Endpoints } from '@sportify/core';
import { cardStats, discography, PERIOD_FULL, PERIOD_LBL, PERIODS, type Model, type Period } from './data';
import { sfx } from './sfx';

type Modulo = '433' | '442' | '352';
type View = 'partita' | 'carta';

const NEXT: Record<Period, Period | null> = { short: 'medium', medium: 'long', long: null };
// Posizioni in % del campo, in ordine: attacco (il primo è il centravanti), centrocampo, difesa, portiere.
const MODULI: Record<Modulo, { roles: number[]; pos: [number, number][] }> = {
  '433': { roles: [3, 3, 4, 1], pos: [[50, 17], [20, 24], [80, 24], [50, 46], [24, 51], [76, 51], [38, 75], [62, 75], [13, 71], [87, 71], [50, 88]] },
  '442': { roles: [2, 4, 4, 1], pos: [[38, 19], [62, 19], [37, 48], [63, 48], [11, 45], [89, 45], [38, 75], [62, 75], [13, 71], [87, 71], [50, 88]] },
  '352': { roles: [2, 5, 3, 1], pos: [[38, 19], [62, 19], [50, 40], [30, 52], [70, 52], [9, 46], [91, 46], [26, 75], [50, 77], [74, 75], [50, 88]] },
};
const ROLE_NAMES = ['Attaccante', 'Centrocampista', 'Difensore', 'Portiere'];
const ROLE_SHORT = ['ATT', 'CEN', 'DIF', 'POR'];
const PASS_VERBS = ['apre per', 'serve', 'scarica su', 'imbuca per', 'cambia gioco verso', 'appoggia a', 'lancia lungo per'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function hue(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
const grad = (s: string) => `linear-gradient(140deg, hsl(${hue(s)} 70% 55%), hsl(${(hue(s) + 50) % 360} 65% 30%))`;
const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const backdrop = (s: string) => {
  const h = hue(s);
  return `radial-gradient(60% 40% at 30% 25%, hsl(${h} 80% 60% / .55), transparent 70%),
    radial-gradient(50% 35% at 80% 40%, hsl(${(h + 50) % 360} 80% 55% / .45), transparent 70%),
    repeating-linear-gradient(-35deg, rgba(255,255,255,.10) 0 2px, transparent 2px 14px)`;
};

/** Aggancia animazioni, suoni e controlli alla card già inserita nella pagina. */
export function mountFormazione(card: HTMLElement, root: HTMLElement, m: Model, api: Endpoints, teamDefault: string) {
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const pitch = $('pitch'), ball = $('ball'), trails = root.querySelector<SVGSVGElement>('#trails')!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const name = (id: string) => m.players.get(id)?.name ?? '—';

  const state = {
    period: 'short' as Period, modulo: '433' as Modulo, view: 'partita' as View,
    home: 0, away: 0, minute: 0, selected: '' as string, ccId: '' as string, subIdx: 0, busy: false,
  };
  const els = new Map<string, HTMLButtonElement>();

  card.dataset.style = 'notte';
  card.dataset.view = 'partita';
  $('teamLbl').textContent = teamDefault;
  $<HTMLInputElement>('teamName').value = teamDefault;
  const team = () => $('teamLbl').textContent ?? '';

  function roleOf(i: number) {
    const r = MODULI[state.modulo].roles; let acc = 0;
    for (let k = 0; k < r.length; k++) { acc += r[k]; if (i < acc) return k; }
    return 3;
  }

  /** Dischetto: la foto dell'artista se c'è, altrimenti un colore stabile con le iniziali. */
  function discStyle(id: string) {
    const p = m.players.get(id);
    return p?.thumb ? `background:center/cover url("${p.thumb}")` : `background:${grad(id)}`;
  }

  function makePlayer(id: string) {
    const b = document.createElement('button');
    b.className = 'pl gone';
    b.type = 'button';
    const p = m.players.get(id)!;
    b.innerHTML = `<div class="disc${p.thumb ? ' has-photo' : ''}" style='${discStyle(id)};--d:${(hue(id) % 30) / 10}s;--rot:${(hue(id) % 9) - 4}deg'>${p.thumb ? '' : esc(initials(p.name))}<span class="num"></span></div><span class="name">${esc(p.name)}</span>`;
    b.addEventListener('click', () => select(id));
    pitch.appendChild(b);
    els.set(id, b);
    return b;
  }

  function layout() {
    $('periodChip').textContent = PERIOD_FULL[state.period];
    const lineup = m.lineups[state.period];
    const pos = MODULI[state.modulo].pos;
    for (const [id, el] of els) if (!lineup.includes(id)) el.classList.add('gone');
    lineup.forEach((id, i) => {
      const el = els.get(id) ?? makePlayer(id);
      el.style.left = pos[i][0] + '%';
      el.style.top = pos[i][1] + '%';
      el.querySelector('.num')!.textContent = String(i + 1);
      el.classList.toggle('cap', i === 0);
      el.setAttribute('aria-label', `${name(id)}, numero ${i + 1}, ${ROLE_NAMES[roleOf(i)]}`);
      requestAnimationFrame(() => el.classList.remove('gone'));
    });
    renderBoard(true);
    if (!lineup.includes(state.selected)) state.selected = lineup[0];
    select(state.selected);
    fillPlayerSelect();
    if (state.view === 'carta') void renderCarta(false);
  }

  // ---------- Tabellone delle sostituzioni ----------
  function subs() {
    const next = NEXT[state.period];
    if (!next) return [];
    const now = m.lineups[state.period], before = m.lineups[next];
    const out = before.filter((id) => !now.includes(id));
    const inn = now.filter((id) => !before.includes(id));
    return inn.map((id, i) => ({ in: id, inNum: now.indexOf(id) + 1, out: out[i] as string | undefined, outNum: out[i] ? before.indexOf(out[i]) + 1 : null }));
  }

  function renderBoard(reset: boolean) {
    const list = subs();
    if (reset) state.subIdx = 0;
    const rows = $('rows');
    if (!list.length) {
      $('boardTitle').textContent = state.period === 'long' ? 'Formazione storica' : 'Sostituzioni';
      $('boardCount').textContent = '';
      rows.innerHTML = state.period === 'long'
        ? `<div class="none">NESSUN CAMBIO<br>SQUADRA DELL'ANNO</div>`
        : `<div class="none">STESSA SQUADRA<br>DEL PERIODO PRIMA</div>`;
      $<HTMLButtonElement>('btnCambio').disabled = true;
      return null;
    }
    $<HTMLButtonElement>('btnCambio').disabled = false;
    const s = list[state.subIdx % list.length];
    $('boardTitle').textContent = `Sostituzioni · vs ${PERIOD_LBL[NEXT[state.period]!]}`;
    $('boardCount').textContent = `${(state.subIdx % list.length) + 1}/${list.length}`;
    rows.innerHTML = `<div class="sub flip-in">
      <div class="side out"><span class="arrow">▼</span><span class="n">${String(s.outNum ?? '–').padStart(2, '0')}</span><span class="who"><span>Esce</span><b>${s.out ? esc(name(s.out)) : '—'}</b></span></div>
      <div class="side in"><span class="arrow">▲</span><span class="n">${String(s.inNum).padStart(2, '0')}</span><span class="who"><span>Entra</span><b>${esc(name(s.in))}</b></span></div>
    </div>`;
    return s;
  }

  async function nextSub() {
    const list = subs();
    if (!list.length) return;
    state.subIdx = (state.subIdx + 1) % list.length;
    const s = renderBoard(false)!;
    sfx.beep();
    const el = els.get(s.in);
    if (!el || reduce) return;
    // Il fantasma di chi esce scivola fuori dalla linea laterale, chi entra si accende di verde.
    const g = document.createElement('div');
    g.className = 'pl-ghost';
    g.setAttribute('style', s.out ? discStyle(s.out) : 'background:#333');
    g.style.left = el.style.left; g.style.top = el.style.top;
    if (s.out && !m.players.get(s.out)?.thumb) g.textContent = initials(name(s.out));
    pitch.appendChild(g);
    el.classList.add('entering');
    el.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: .7 }, { transform: 'scale(1)' }], { duration: 700, easing: 'ease-out' });
    const side = parseFloat(el.style.left) < 50 ? '-60px' : `${pitch.clientWidth + 60}px`;
    await g.animate([{ left: g.style.left, opacity: .9 }, { left: side, opacity: 0 }], { duration: 900, easing: 'ease-in', fill: 'forwards' }).finished;
    g.remove();
    setTimeout(() => el.classList.remove('entering'), 900);
    say(`Cambio: esce ${s.out ? name(s.out) : '—'}, entra ${name(s.in)}.`);
  }

  // ---------- Scheda giocatore ----------
  function select(id: string) {
    state.selected = id;
    for (const [k, el] of els) el.classList.toggle('selected', k === id);
    const i = m.lineups[state.period].indexOf(id);
    const inP = PERIODS.map((p) => `<span class="${m.lineups[p].includes(id) ? 'yes' : ''}">${PERIOD_LBL[p]}${m.lineups[p].includes(id) ? ' ✓' : ''}</span>`).join('');
    const sinceAll = PERIODS.every((p) => m.lineups[p].includes(id));
    const p = m.players.get(id)!;
    $('scheda').innerHTML = `<div class="big" style='${discStyle(id)}'>${p.thumb ? '' : esc(initials(p.name))}</div>
      <h3>${esc(p.name)}</h3>
      <div class="meta">N. ${i + 1} · ${ROLE_NAMES[roleOf(i)]}${i === 0 ? ' · Capitano' : ''}${sinceAll ? ' · Bandiera' : ''}</div>
      <div class="periods">${inP}</div>
      <div class="meta">In campo per i tuoi ascolti delle ultime ${PERIOD_LBL[state.period]}.</div>`;
  }

  // ---------- Azione: passaggi fino al gol del capitano ----------
  const say = (t: string) => { $('ticker').innerHTML = `<span>${esc(t)}</span>`; };
  const center = (el: HTMLElement): [number, number] =>
    [parseFloat(el.style.left) / 100 * pitch.clientWidth, parseFloat(el.style.top) / 100 * pitch.clientHeight];

  function trail(a: [number, number], b: [number, number]) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', String(a[0])); l.setAttribute('y1', String(a[1]));
    l.setAttribute('x2', String(b[0])); l.setAttribute('y2', String(b[1]));
    l.setAttribute('class', 'trail');
    trails.appendChild(l);
    l.animate([{ opacity: .9 }, { opacity: 0 }], { duration: 1800, delay: 300, fill: 'forwards' }).finished.then(() => l.remove());
  }

  async function kick(from: [number, number], to: [number, number], ms = 620, lift = 18) {
    trail(from, to);
    sfx.kick(lift > 20);
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - lift];
    await ball.animate([
      { transform: `translate(${from[0]}px, ${from[1]}px) scale(1)` },
      { transform: `translate(${mid[0]}px, ${mid[1]}px) scale(1.35)` },
      { transform: `translate(${to[0]}px, ${to[1]}px) scale(1)` },
    ], { duration: ms, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'forwards' }).finished;
  }

  function touch(el: HTMLElement) { el.classList.remove('touch'); void el.offsetWidth; el.classList.add('touch'); }
  const pickRole = (k: number) => {
    const idx = m.lineups[state.period].map((_, i) => i).filter((i) => roleOf(i) === k);
    return idx[Math.floor(Math.random() * idx.length)];
  };

  async function azione() {
    if (state.busy || state.view === 'carta') return;
    state.busy = true; $<HTMLButtonElement>('btnAzione').disabled = true;
    const lineup = m.lineups[state.period];
    // Portiere → difensore → centrocampista → (altro centrocampista) → attaccante → capitano, che tira.
    const chain = [10, pickRole(2), pickRole(1)];
    if (Math.random() > .4) { const x = pickRole(1); if (x !== chain.at(-1)) chain.push(x); }
    const wing = pickRole(0);
    if (wing !== 0) chain.push(wing);
    chain.push(0);
    const first = els.get(lineup[chain[0]])!;
    ball.classList.add('on');
    sfx.whistle(.22);
    let p = center(first);
    ball.style.transform = `translate(${p[0]}px, ${p[1]}px)`;
    say(`${name(lineup[chain[0]])} rinvia, inizia l'azione.`);
    touch(first);
    for (let k = 1; k < chain.length; k++) {
      const nxt = els.get(lineup[chain[k]])!;
      const q = center(nxt);
      say(`${name(lineup[chain[k - 1]])} ${PASS_VERBS[Math.floor(Math.random() * PASS_VERBS.length)]} ${name(lineup[chain[k]])}…`);
      state.minute = Math.min(90, state.minute + Math.ceil(Math.random() * 3));
      $('clock').textContent = String(state.minute).padStart(2, '0') + "'";
      await kick(p, q, reduce ? 1 : 560 + Math.random() * 200, Math.hypot(q[0] - p[0], q[1] - p[1]) > 140 ? 34 : 14);
      touch(nxt);
      sfx.swell(k / chain.length);
      p = q;
      await sleep(reduce ? 0 : 160);
    }
    const goalPt: [number, number] = [pitch.clientWidth / 2 + (Math.random() * 30 - 15), 4];
    say(`${name(lineup[0])} calcia…`);
    await kick(p, goalPt, reduce ? 1 : 380, 4);
    const goal = $('goal'); goal.classList.remove('ripple'); void goal.offsetWidth; goal.classList.add('ripple');
    state.home++;
    sfx.goal();
    const s = $('sHome'); s.textContent = String(state.home); s.classList.add('bump'); setTimeout(() => s.classList.remove('bump'), 500);
    $('scorer').textContent = name(lineup[0]);
    const f = $('flash'); f.classList.remove('show'); void f.offsetWidth; f.classList.add('show');
    say(`GOL di ${name(lineup[0])}! ${team()} ${state.home}, Noia ${state.away}.`);
    await sleep(reduce ? 0 : 1300);
    ball.classList.remove('on');
    if (state.minute >= 90) { state.minute = 0; state.home = 0; $('sHome').textContent = '0'; }
    state.busy = false; $<HTMLButtonElement>('btnAzione').disabled = (state.view as View) === 'carta';
  }

  // ---------- Carta del giocatore ----------
  function fillPlayerSelect() {
    const lineup = m.lineups[state.period];
    if (!lineup.includes(state.ccId)) state.ccId = lineup[0];
    $('ccPlayer').innerHTML = lineup.map((id, i) =>
      `<option value="${id}" ${id === state.ccId ? 'selected' : ''}>${i + 1}. ${esc(name(id))}${i === 0 ? ' (capitano)' : ''}</option>`).join('');
  }

  let revealRun = 0;
  async function renderCarta(animate: boolean) {
    const run = ++revealRun;
    const id = state.ccId || m.lineups[state.period][0];
    const i = m.lineups[state.period].indexOf(id);
    const p = m.players.get(id)!;
    const shell = $('ccShell');
    if (animate && !reduce) hideParts();
    const disc = await discography(api, id);
    if (run !== revealRun) return;
    const { st, raw, ovr } = cardStats(m, id, state.period, disc);
    const tier = ovr >= 85 ? 'oro' : ovr >= 72 ? 'argento' : 'bronzo';
    shell.className = `cc-shell ${tier}`;
    $('ccOvr').textContent = String(ovr);
    $('ccPos').textContent = ROLE_SHORT[roleOf(i)];
    $('ccNum').textContent = '#' + (i + 1);
    const face = $('ccFace');
    face.style.backgroundImage = p.photo ? `url("${p.photo}")` : grad(id);
    face.classList.toggle('nophoto', !p.photo);
    face.textContent = p.photo ? '' : initials(p.name);
    // Con la foto: copia ingrandita e sfocata a tutta carta dietro la foto nitida, così non si vedono bordi.
    const back = $('ccBack');
    back.classList.toggle('photo', !!p.photo);
    back.style.background = p.photo ? `center / cover no-repeat url("${p.photo}")` : backdrop(id);
    $('ccName').textContent = p.name;
    $('ccTier').textContent = `${tier}${i === 0 ? ' · capitano' : ''} · ${PERIOD_LBL[state.period]}`;
    $('ccStats').innerHTML = Object.entries(st).map(([k, v]) => `<div data-v="${v ?? ''}"><b>${v ?? '–'}</b><span>${k}</span></div>`).join('');
    $('ccHow').innerHTML = (Object.keys(raw) as (keyof typeof raw)[]).map((k) =>
      `<li><b>${k} ${st[k] ?? '–'}</b> ${esc(raw[k])}</li>`).join('');
    $('ccHowName').textContent = p.name;
    const present = PERIODS.filter((x) => m.lineups[x].includes(id)).length;
    const song = m.song.get(id);
    $('ccGen').innerHTML = `<dt>Esordio</dt><dd>${disc.debut ?? '—'}</dd>`
      + `<dt>Brano simbolo</dt><dd>${song ? `«${esc(song)}»` : '—'}</dd>`
      + `<dt>In squadra</dt><dd>${present} ${present === 1 ? 'periodo' : 'periodi'} su 3</dd>`;
    $('ccCap').innerHTML = `${esc(i === 0 ? `Il capitano di ${team()}` : `In campo per ${team()}`)}<small>Ascolti: ${PERIOD_FULL[state.period].toLowerCase()}</small>`;
    $('ccBeams').className = `cc-beams ${tier}`;
    if (animate && !reduce) void playReveal(run, ovr, tier);
    else showParts();
  }

  const partIds = ['ccOvr', 'ccPos', 'ccNum', 'ccFace', 'ccName', 'ccTier', 'ccStats', 'ccGen', 'ccCap'];
  function hideParts() { partIds.forEach((x) => $(x).classList.add('cc-hidden')); }
  function showParts() { root.querySelectorAll('#capcard .cc-hidden').forEach((el) => el.classList.remove('cc-hidden')); }
  const replay = (el: HTMLElement, cls: string) => { el.classList.remove('cc-hidden', cls); void el.offsetWidth; el.classList.add(cls); };

  // Apertura: flip, raggi di luce, valutazione che sale, foto, nome lettera per lettera, statistiche una alla volta.
  async function playReveal(run: number, ovr: number, tier: string) {
    const alive = () => run === revealRun && state.view === 'carta';
    const stats = [...$('ccStats').children] as HTMLElement[];
    $('ccStats').classList.remove('cc-hidden');
    stats.forEach((el) => el.classList.add('cc-hidden'));
    replay($('ccShell'), 'reveal');
    replay($('ccBeams'), 'burst');
    sfx.reveal();
    await sleep(650); if (!alive()) return;
    const o = $('ccOvr'); o.classList.remove('cc-hidden');
    const t0 = performance.now();
    await new Promise<void>((res) => {
      (function step(now: number) {
        const p = Math.min(1, (now - t0) / 750);
        const v = Math.round(ovr * (1 - Math.pow(1 - p, 3)));
        if (o.textContent !== String(v)) { o.textContent = String(v); sfx.tick(p); }
        if (p < 1 && alive()) requestAnimationFrame(step); else res();
      })(t0);
    });
    if (!alive()) return;
    replay($('ccPos'), 'cc-pop'); replay($('ccNum'), 'cc-pop');
    sfx.kick(true);
    await sleep(200);
    replay($('ccFace'), 'glow');
    await sleep(450); if (!alive()) return;
    const nm = $('ccName'); const txt = nm.textContent ?? '';
    nm.innerHTML = [...txt].map((c, i) => `<span class="ch" style="animation-delay:${i * 45}ms">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');
    nm.classList.remove('cc-hidden');
    await sleep(txt.length * 45 + 200); if (!alive()) return;
    replay($('ccTier'), 'cc-up');
    for (const [k, el] of stats.entries()) {
      if (!alive()) return;
      if (!el.dataset.v) { el.classList.remove('cc-hidden'); continue; }
      const target = Number(el.dataset.v), b = el.querySelector('b')!;
      el.classList.remove('cc-hidden'); el.classList.add('in');
      for (let v = 0; v <= target; v += Math.ceil(target / 8)) { b.textContent = String(v); await sleep(16); }
      b.textContent = String(target);
      if (target >= 90) { el.classList.add('hot'); setTimeout(() => el.classList.remove('hot'), 900); }
      sfx.tick(.3 + k * .12);
      await sleep(70);
    }
    replay($('ccGen'), 'cc-up'); replay($('ccCap'), 'cc-up');
    sparkBurst(tier === 'oro' ? 26 : tier === 'argento' ? 14 : 8);
    if (tier === 'oro') sfx.goal();
  }

  function sparkBurst(n: number) {
    const box = $('ccSparks'); box.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      const ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 120;
      s.className = 'fly';
      s.style.left = '180px'; s.style.top = '260px';
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px'); s.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      s.style.animationDelay = Math.random() * 200 + 'ms';
      box.appendChild(s);
    }
    setTimeout(() => {
      box.innerHTML = Array.from({ length: Math.ceil(n / 3) }, () =>
        `<i style="left:${40 + Math.random() * 280}px;top:${60 + Math.random() * 460}px;animation-delay:${Math.random() * 2.4}s"></i>`).join('');
    }, 1500);
  }

  // Inclinazione 3D e parallasse: lo sfondo, la foto e i testi si muovono a velocità diverse.
  const tilt = $('ccTilt');
  $('capcard').addEventListener('pointermove', (e) => {
    if (reduce) return;
    const r = tilt.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    tilt.classList.add('hover');
    tilt.style.setProperty('--mx', String(x * 2)); tilt.style.setProperty('--my', String(y * 2));
    tilt.style.setProperty('--ry', `${x * 22}deg`); tilt.style.setProperty('--rx', `${-y * 18}deg`);
    $('ccShell').style.setProperty('--shine', `${50 - x * 140}%`);
  });
  $('capcard').addEventListener('pointerleave', () => {
    tilt.classList.remove('hover'); tilt.style.removeProperty('--ry'); tilt.style.removeProperty('--rx');
  });
  (function idle(now: number) {
    if (state.view === 'carta' && !tilt.classList.contains('hover') && !reduce && !card.classList.contains('exporting')) {
      const p = Math.sin((now / 6000) * Math.PI * 2 - Math.PI / 2);
      tilt.style.setProperty('--mx', (-p * .6).toFixed(3));
      tilt.style.setProperty('--my', (p * .2).toFixed(3));
    }
    requestAnimationFrame(idle);
  })(performance.now());

  // ---------- Controlli ----------
  function seg(id: string, onPick: (v: string, b: HTMLButtonElement) => void) {
    $(id).addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button'); if (!b) return;
      for (const x of $(id).querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
      onPick(b.dataset.v!, b);
    });
  }
  seg('segPeriodo', (v) => { if (state.busy) return; state.period = v as Period; layout(); say(`Formazione delle ultime ${PERIOD_LBL[state.period]}.`); });
  seg('segModulo', (v, b) => { if (state.busy) return; state.modulo = v as Modulo; layout(); say(`Il mister passa al ${b.textContent}.`); });
  seg('segStile', (v) => { card.dataset.style = v; sfx.beep(); });
  seg('segFormato', (v) => {
    state.view = v as View;
    card.dataset.view = state.view;
    $('capcard').hidden = state.view !== 'carta';
    $('grpCarta').hidden = state.view !== 'carta';
    $<HTMLButtonElement>('btnAzione').disabled = state.view === 'carta' || state.busy;
    if (state.view === 'carta') void renderCarta(true);
  });
  $('btnReplay').addEventListener('click', () => void renderCarta(true));
  $('ccPlayer').addEventListener('change', (e) => { state.ccId = (e.target as HTMLSelectElement).value; void renderCarta(true); });
  $('btnSound').addEventListener('click', () => {
    const on = sfx.toggle();
    $('btnSound').setAttribute('aria-pressed', String(on));
    $('soundLbl').textContent = on ? 'Suoni attivi' : 'Attiva i suoni';
    if (on) sfx.whistle(.4);
  });
  $('teamName').addEventListener('input', (e) => {
    $('teamLbl').textContent = (e.target as HTMLInputElement).value.trim() || teamDefault;
    if (state.view === 'carta') void renderCarta(false);
  });
  $('btnAzione').addEventListener('click', () => void azione());
  $('btnCambio').addEventListener('click', () => void nextSub());

  layout();

  // Regia automatica: un'azione ogni tanto, i cambi in alternanza.
  let tick = 0;
  const auto = $<HTMLInputElement>('auto');
  auto.checked = !reduce;
  setInterval(() => {
    if (!auto.checked || document.hidden || state.view === 'carta' || card.classList.contains('exporting')) return;
    tick++;
    if (tick % 3 === 0) void nextSub();
    else if (tick % 3 === 1) void azione();
  }, 3600);
  if (!reduce) setTimeout(() => void azione(), 900);

  return {
    filename: () => state.view === 'carta' ? `carta-${name(state.ccId).toLowerCase().replace(/\W+/g, '-')}` : 'la-mia-formazione',
    shareText: () => state.view === 'carta'
      ? `${name(state.ccId)} è il capitano di ${team()} 🏆`
      : `Ecco la formazione di ${team()} ⚽`,
  };
}
