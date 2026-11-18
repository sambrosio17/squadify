import { esc } from '@sportify/core';
import type { Period } from './data';
import { grad, hue, initials, MODULI, ROLE_NAMES, ROLE_SHORT, roleOf as roleIn, type Modulo } from './formation';
import { sfx } from './sfx';
import type { Squad } from './squad';

type View = 'partita' | 'carta';

const PASS_VERBS = ['apre per', 'serve', 'scarica su', 'imbuca per', 'cambia gioco verso', 'appoggia a', 'lancia lungo per'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backdrop = (s: string) => {
  const h = hue(s);
  return `radial-gradient(60% 40% at 30% 25%, hsl(${h} 80% 60% / .55), transparent 70%),
    radial-gradient(50% 35% at 80% 40%, hsl(${(h + 50) % 360} 80% 55% / .45), transparent 70%),
    repeating-linear-gradient(-35deg, rgba(255,255,255,.10) 0 2px, transparent 2px 14px)`;
};

/** Aggancia animazioni, suoni e controlli alla card già inserita nella pagina. */
export interface EngineOpts {
  teamDefault: string;
  modulo?: Modulo;
  /** Il modulo non si cambia dalla regia (squadra fatta a mano: si cambia dal mercato). */
  lockModulo?: boolean;
}

export function mountFormazione(card: HTMLElement, root: HTMLElement, sq: Squad, opts: EngineOpts) {
  const { teamDefault } = opts;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const pitch = $('pitch'), ball = $('ball'), trails = root.querySelector<SVGSVGElement>('#trails')!;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const name = (id: string) => sq.players.get(id)?.name ?? '—';

  const state = {
    period: 'short' as Period, modulo: (opts.modulo ?? '433') as Modulo, view: 'partita' as View,
    home: 0, away: 0, minute: 0, selected: '' as string, ccId: '' as string, subIdx: 0, busy: false,
  };
  const els = new Map<string, HTMLButtonElement>();

  card.dataset.style = 'notte';
  card.dataset.view = 'partita';
  $('teamLbl').textContent = teamDefault;
  $<HTMLInputElement>('teamName').value = teamDefault;
  const team = () => $('teamLbl').textContent ?? '';

  const roleOf = (i: number) => roleIn(state.modulo, i);
  const lineupNow = () => sq.lineup(state.period);
  const captain = () => sq.captain(state.period);
  $('sAwayName').textContent = sq.opponent;
  $('regiaNote').textContent = sq.note;
  $('ccHowNote').innerHTML = sq.howNote;
  if (!sq.periods) $('grpPeriodo').hidden = true;
  if (opts.lockModulo) $('grpModulo').hidden = true;
  for (const b of root.querySelectorAll<HTMLButtonElement>('#segModulo button')) b.setAttribute('aria-pressed', String(b.dataset.v === state.modulo));

  /** Dischetto: la foto dell'artista se c'è, altrimenti un colore stabile con le iniziali. */
  function discStyle(id: string) {
    const p = sq.players.get(id);
    return p?.thumb ? `background:center/cover url("${p.thumb}")` : `background:${grad(id)}`;
  }

  function makePlayer(id: string) {
    const b = document.createElement('button');
    b.className = 'pl gone';
    b.dataset.id = id;
    b.type = 'button';
    const p = sq.players.get(id)!;
    b.innerHTML = `<div class="disc${p.thumb ? ' has-photo' : ''}" style='${discStyle(id)};--d:${(hue(id) % 30) / 10}s;--rot:${(hue(id) % 9) - 4}deg'>${p.thumb ? '' : esc(initials(p.name))}<span class="num"></span></div><span class="name">${esc(p.name)}</span>`;
    b.addEventListener('click', () => select(id));
    pitch.appendChild(b);
    els.set(id, b);
    return b;
  }

  function layout() {
    $('periodChip').textContent = sq.chip(state.period);
    const lineup = lineupNow();
    const pos = MODULI[state.modulo].pos;
    for (const [id, el] of els) if (!lineup.includes(id)) el.classList.add('gone');
    lineup.forEach((id, i) => {
      const el = els.get(id) ?? makePlayer(id);
      el.style.left = pos[i][0] + '%';
      el.style.top = pos[i][1] + '%';
      const n = sq.shirt(id, state.period);
      el.querySelector('.num')!.textContent = String(n);
      el.classList.toggle('cap', id === captain());
      el.setAttribute('aria-label', `${name(id)}, numero ${n}, ${ROLE_NAMES[roleOf(i)]}${id === captain() ? ', capitano' : ''}`);
      requestAnimationFrame(() => el.classList.remove('gone'));
    });
    renderBoard(true);
    if (!lineup.includes(state.selected)) state.selected = captain();
    select(state.selected);
    fillPlayerSelect();
    if (state.view === 'carta') void renderCarta(false);
  }

  // ---------- Tabellone sotto il campo (sostituzioni o schermate della squadra) ----------
  function renderBoard(reset: boolean) {
    const b = sq.board(state.period);
    if (reset) state.subIdx = 0;
    const rows = $('rows');
    $('boardTitle').textContent = b.title;
    if (!b.slides.length) {
      $('boardCount').textContent = '';
      rows.innerHTML = `<div class="none">${b.empty}</div>`;
      $<HTMLButtonElement>('btnCambio').disabled = true;
      return null;
    }
    $<HTMLButtonElement>('btnCambio').disabled = false;
    const k = state.subIdx % b.slides.length;
    $('boardCount').textContent = b.slides.length > 1 ? `${k + 1}/${b.slides.length}` : '';
    rows.innerHTML = b.slides[k].html;
    return b.slides[k];
  }

  async function nextSub() {
    const n = sq.board(state.period).slides.length;
    if (!n) return;
    state.subIdx = (state.subIdx + 1) % n;
    const slide = renderBoard(false)!;
    sfx.beep();
    const s = slide.sub;
    if (!s) return;
    const el = els.get(s.in);
    if (!el || reduce) return;
    // Il fantasma di chi esce scivola fuori dalla linea laterale, chi entra si accende di verde.
    const g = document.createElement('div');
    g.className = 'pl-ghost';
    g.setAttribute('style', s.out ? discStyle(s.out) : 'background:#333');
    g.style.left = el.style.left; g.style.top = el.style.top;
    if (s.out && !sq.players.get(s.out)?.thumb) g.textContent = initials(name(s.out));
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
    const i = lineupNow().indexOf(id);
    const p = sq.players.get(id)!;
    $('scheda').innerHTML = `<div class="big" style='${discStyle(id)}'>${p.thumb ? '' : esc(initials(p.name))}</div>
      <h3>${esc(p.name)}</h3>
      <div class="meta">N. ${sq.shirt(id, state.period)} · ${ROLE_NAMES[roleOf(i)]}${id === captain() ? ' · Capitano' : ''}</div>
      ${sq.scheda(id, state.period)}`;
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
    const idx = lineupNow().map((_, i) => i).filter((i) => roleOf(i) === k);
    return idx[Math.floor(Math.random() * idx.length)];
  };

  async function azione() {
    if (state.busy || state.view === 'carta') return;
    state.busy = true; $<HTMLButtonElement>('btnAzione').disabled = true;
    const lineup = lineupNow();
    const cap = Math.max(0, lineup.indexOf(captain()));
    // Portiere → difensore → centrocampista → (altro centrocampista) → attaccante → capitano, che tira.
    const chain = [10, pickRole(2), pickRole(1)];
    if (Math.random() > .4) { const x = pickRole(1); if (x !== chain.at(-1)) chain.push(x); }
    const wing = pickRole(0);
    if (wing !== cap) chain.push(wing);
    // Se il capitano è già nella catena (difensore, centrocampista) la catena si ferma a lui.
    const at = chain.indexOf(cap);
    if (at > 0) chain.length = at;
    if (chain.at(-1) !== cap) chain.push(cap);
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
      if (!card.isConnected) return;
      touch(nxt);
      sfx.swell(k / chain.length);
      p = q;
      await sleep(reduce ? 0 : 160);
    }
    const goalPt: [number, number] = [pitch.clientWidth / 2 + (Math.random() * 30 - 15), 4];
    const scorer = lineup[cap];
    say(`${name(scorer)} calcia…`);
    await kick(p, goalPt, reduce ? 1 : 380, 4);
    if (!card.isConnected) return;
    const goal = $('goal'); goal.classList.remove('ripple'); void goal.offsetWidth; goal.classList.add('ripple');
    state.home++;
    sfx.goal();
    const s = $('sHome'); s.textContent = String(state.home); s.classList.add('bump'); setTimeout(() => s.classList.remove('bump'), 500);
    $('scorer').textContent = name(scorer);
    const f = $('flash'); f.classList.remove('show'); void f.offsetWidth; f.classList.add('show');
    say(`GOL di ${name(scorer)}! ${team()} ${state.home}, ${sq.opponent} ${state.away}.`);
    await sleep(reduce ? 0 : 1300);
    if (!card.isConnected) return;
    ball.classList.remove('on');
    if (state.minute >= 90) { state.minute = 0; state.home = 0; $('sHome').textContent = '0'; }
    state.busy = false; $<HTMLButtonElement>('btnAzione').disabled = (state.view as View) === 'carta';
  }

  // ---------- Carta del giocatore ----------
  function fillPlayerSelect() {
    const lineup = lineupNow();
    if (!lineup.includes(state.ccId)) state.ccId = captain();
    // Il capitano per primo, poi in ordine di posizione.
    const order = [captain(), ...lineup.filter((id) => id !== captain())];
    $('ccPlayer').innerHTML = order.map((id) =>
      `<option value="${id}" ${id === state.ccId ? 'selected' : ''}>${sq.shirt(id, state.period)}. ${esc(name(id))}${id === captain() ? ' (capitano)' : ''}</option>`).join('');
  }

  let revealRun = 0;
  async function renderCarta(animate: boolean) {
    const run = ++revealRun;
    const id = state.ccId || captain();
    const i = lineupNow().indexOf(id);
    const isCap = id === captain();
    const p = sq.players.get(id)!;
    const shell = $('ccShell');
    if (animate && !reduce) hideParts();
    const data = await sq.card(id, state.period);
    if (run !== revealRun) return;
    const { st, raw, ovr } = data;
    const tier = ovr >= 85 ? 'oro' : ovr >= 72 ? 'argento' : 'bronzo';
    shell.className = `cc-shell ${tier}`;
    $('ccOvr').textContent = String(ovr);
    $('ccPos').textContent = ROLE_SHORT[roleOf(i)];
    $('ccNum').textContent = '#' + sq.shirt(id, state.period);
    const face = $('ccFace');
    face.style.backgroundImage = p.photo ? `url("${p.photo}")` : grad(id);
    face.classList.toggle('nophoto', !p.photo);
    face.textContent = p.photo ? '' : initials(p.name);
    // Con la foto: copia ingrandita e sfocata a tutta carta dietro la foto nitida, così non si vedono bordi.
    const back = $('ccBack');
    back.classList.toggle('photo', !!p.photo);
    back.style.background = p.photo ? `center / cover no-repeat url("${p.photo}")` : backdrop(id);
    $('ccName').textContent = p.name;
    $('ccTier').textContent = [tier, isCap ? 'capitano' : '', data.tierNote].filter(Boolean).join(' · ');
    $('ccStats').innerHTML = Object.entries(st).map(([k, v]) => `<div data-v="${v ?? ''}"><b>${v ?? '–'}</b><span>${k}</span></div>`).join('');
    $('ccHow').innerHTML = (Object.keys(raw) as (keyof typeof raw)[]).map((k) =>
      `<li><b>${k} ${st[k] ?? '–'}</b> ${esc(raw[k])}</li>`).join('');
    $('ccHowName').textContent = p.name;
    $('ccGen').innerHTML = data.gen.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('');
    $('ccCap').innerHTML = `${esc(isCap ? `Il capitano di ${team()}` : `In campo per ${team()}`)}<small>${esc(data.captionNote)}</small>`;
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
    if (card.isConnected) requestAnimationFrame(idle);
  })(performance.now());

  // ---------- Controlli ----------
  function seg(id: string, onPick: (v: string, b: HTMLButtonElement) => void) {
    $(id).addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button'); if (!b) return;
      for (const x of $(id).querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
      onPick(b.dataset.v!, b);
    });
  }
  seg('segPeriodo', (v) => { if (state.busy) return; state.period = v as Period; layout(); say(`Formazione: ${sq.chip(state.period).toLowerCase()}.`); });
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
  const timer = setInterval(() => {
    if (!card.isConnected) { clearInterval(timer); return; }
    if (!auto.checked || document.hidden || state.view === 'carta' || card.classList.contains('exporting')) return;
    tick++;
    if (tick % 3 === 0) void nextSub();
    else if (tick % 3 === 1) void azione();
  }, 3600);
  if (!reduce) setTimeout(() => void azione(), 900);

  return {
    /** Ridisegna la carta (es. dopo che il mister cambia un voto). */
    refreshCard: () => { if (state.view === 'carta') void renderCarta(false); },
    cardPlayer: () => state.ccId || captain(),
    team,
    filename: () => state.view === 'carta' ? `carta-${name(state.ccId).toLowerCase().replace(/\W+/g, '-')}` : 'la-mia-formazione',
    shareText: () => state.view === 'carta'
      ? `${name(state.ccId)} è il capitano di ${team()} 🏆`
      : `Ecco la formazione di ${team()} ⚽`,
  };
}
