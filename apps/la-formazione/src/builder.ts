import { esc, type Catalog, type CatalogArtist } from '@sportify/core';
import { creditLink } from '@sportify/share';
import { grad, initials, MODULI, MODULI_LIST, MODULO_LBL, ROLE_NAMES, ROLE_SHORT, roleOf } from './formation';
import { sfx } from './sfx';
import { filled, isComplete, saveDraft, type Team } from './team';
import { findArtist, POOL, shuffle, THEMES } from './themes';

export interface BuilderOpts {
  catalog: Catalog;
  team: Team;
  onPlay: (t: Team) => void;
  /** C'è il login con Spotify per gli utenti abilitati. */
  onLogin?: () => void;
}

/**
 * Il "mercato": scegli il modulo, cerca un artista per ogni posto, trascinali per cambiare ruolo
 * e scegli il capitano. Quando gli 11 posti sono pieni si scende in campo.
 */
export function mountBuilder(root: HTMLElement, o: BuilderOpts) {
  const t = o.team;
  root.className = 'shell builder';
  root.innerHTML = `
    <header class="bd-head">
      <span class="bd-logo">Squadify</span>
      <h1>Crea la tua squadra</h1>
      <p>Undici artisti da tutto Spotify, il modulo e il capitano li scegli tu.</p>
    </header>
    ${t.vs ? `<div class="vs-banner"><b>Rispondi alla sfida di ${esc(t.vs)}</b><span>Schiera la tua squadra: la partita sarà contro di loro.</span></div>` : ''}
    ${o.catalog.demo ? `<p class="bd-demo">Modalità prova: catalogo con soli nomi, senza foto né discografia. Con il Worker online arrivano i dati veri di Spotify.</p>` : ''}
    <div class="bd-grid">
      <div class="bd-left">
        <div class="seg bd-modulo" role="group" aria-label="Modulo" id="bdModulo">
          ${MODULI_LIST.map((m) => `<button type="button" data-v="${m}" aria-pressed="${m === t.modulo}">${MODULO_LBL[m]}</button>`).join('')}
        </div>
        <div class="bd-pitch" id="bdPitch">
          <div class="line half"></div><div class="line circle"></div><div class="line box-top"></div><div class="line box-bot"></div>
        </div>
        <div class="bd-sel" id="bdSel" aria-live="polite"></div>
      </div>
      <div class="bd-right">
        <div class="group">
          <label for="bdName">Nome della squadra</label>
          <input type="text" id="bdName" maxlength="18" placeholder="La mia squadra" value="${esc(t.name)}">
        </div>
        <div class="group">
          <span class="lbl">Squadre a tema</span>
          <div class="bd-themes" id="bdThemes">
            ${THEMES.map((x) => `<button type="button" class="chip" data-theme="${x.id}">${esc(x.label)}</button>`).join('')}
          </div>
        </div>
        <div class="btns">
          <button type="button" class="btn alt" id="bdDraft">Draft casuale</button>
          <button type="button" class="btn alt" id="bdClear">Svuota</button>
        </div>
        <p class="note">Tocca un posto vuoto per cercare un artista. Trascina un giocatore su un altro posto per scambiarli, oppure tocca un giocatore e usa i pulsanti sotto il campo.</p>
        <button type="button" class="btn bd-play" id="bdPlay"></button>
        ${o.onLogin ? `<button type="button" class="bd-login" id="bdLogin">Hai l'accesso a Squadify su Spotify? <b>Usa i tuoi ascolti</b></button>` : ''}
      </div>
    </div>
    <footer class="made-by">${creditLink('made-by-link')}</footer>
    <div class="bd-search" id="bdSearch" hidden>
      <div class="bd-search-bg" data-close></div>
      <section class="bd-search-panel" role="dialog" aria-modal="true" aria-labelledby="bdSearchTitle">
        <header><h2 id="bdSearchTitle">Cerca</h2><button type="button" class="share-sheet-x" data-close aria-label="Chiudi">✕</button></header>
        <input type="search" id="bdQ" placeholder="Nome dell'artista" autocomplete="off" enterkeyhint="search">
        <div class="bd-results" id="bdResults"></div>
      </section>
    </div>`;

  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id)!;
  const pitch = $('bdPitch');
  let selected: number | null = null;
  let swapping = false;
  let busy = false;

  const save = () => saveDraft(t);
  const avatar = (a: CatalogArtist) => a.thumb ? `background:center/cover url("${a.thumb}")` : `background:${grad(a.id)}`;

  // ---------- Campo con gli 11 posti ----------
  function render() {
    const pos = MODULI[t.modulo].pos;
    pitch.querySelectorAll('.bd-slot').forEach((el) => el.remove());
    t.slots.forEach((a, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bd-slot' + (a ? ' full' : '') + (i === selected ? ' selected' : '') + (a && i === t.captain ? ' cap' : '');
      b.dataset.i = String(i);
      b.style.left = pos[i][0] + '%';
      b.style.top = pos[i][1] + '%';
      const role = ROLE_SHORT[roleOf(t.modulo, i)];
      b.innerHTML = a
        ? `<span class="bd-disc" style='${avatar(a)}'>${a.thumb ? '' : esc(initials(a.name))}</span><span class="bd-name">${esc(a.name)}</span>`
        : `<span class="bd-disc empty">+</span><span class="bd-name">${role}</span>`;
      b.setAttribute('aria-label', a ? `${a.name}, ${ROLE_NAMES[roleOf(t.modulo, i)]}${i === t.captain ? ', capitano' : ''}` : `Posto libero: ${ROLE_NAMES[roleOf(t.modulo, i)]}. Cerca un artista`);
      pitch.appendChild(b);
    });
    renderSel();
    const n = filled(t);
    const play = $<HTMLButtonElement>('bdPlay');
    play.disabled = n < 11 || busy;
    play.innerHTML = n < 11 ? `Mancano ${11 - n} giocatori <small>${n}/11</small>` : 'Scendi in campo';
  }

  function renderSel() {
    const box = $('bdSel');
    const a = selected === null ? null : t.slots[selected];
    if (selected === null || !a) {
      box.innerHTML = `<span class="bd-hint">${filled(t) < 11 ? 'Tocca un posto vuoto per scegliere un artista' : 'Squadra completa: tocca un giocatore per cambiarlo o farlo capitano'}</span>`;
      return;
    }
    if (swapping) {
      box.innerHTML = `<span class="bd-hint">Tocca il posto con cui scambiare <b>${esc(a.name)}</b></span><button type="button" class="chip" data-act="cancel">Annulla</button>`;
      return;
    }
    box.innerHTML = `<b class="bd-sel-name">${esc(a.name)}</b><span class="bd-sel-role">${ROLE_NAMES[roleOf(t.modulo, selected)]}</span>
      <div class="bd-sel-acts">
        <button type="button" class="chip" data-act="cap" ${selected === t.captain ? 'aria-pressed="true"' : ''}>${selected === t.captain ? 'Capitano ✓' : 'Fai capitano'}</button>
        <button type="button" class="chip" data-act="swap">Scambia</button>
        <button type="button" class="chip" data-act="change">Cambia</button>
        <button type="button" class="chip" data-act="remove">Togli</button>
      </div>`;
  }

  function swap(i: number, j: number) {
    if (i === j) return;
    [t.slots[i], t.slots[j]] = [t.slots[j], t.slots[i]];
    if (t.captain === i) t.captain = j; else if (t.captain === j) t.captain = i;
    sfx.kick(false);
    save();
  }

  function tapSlot(i: number) {
    if (busy) return;
    if (swapping && selected !== null) {
      swap(selected, i); swapping = false; selected = i; render(); return;
    }
    if (!t.slots[i]) { selected = i; render(); openSearch(i); return; }
    selected = selected === i ? null : i;
    render();
  }

  $('bdSel').addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (!act || selected === null) return;
    if (act === 'cap') { t.captain = selected; sfx.whistle(.25); }
    if (act === 'swap') swapping = true;
    if (act === 'cancel') swapping = false;
    if (act === 'change') { openSearch(selected); return; }
    if (act === 'remove') { t.slots[selected] = null; selected = null; }
    save(); render();
  });

  // ---------- Trascina per scambiare (mouse e dita) ----------
  let drag: { i: number; x: number; y: number; ghost?: HTMLElement; moved: boolean } | null = null;
  let suppressClick = false;
  pitch.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.bd-slot.full');
    if (!el || busy) return;
    drag = { i: Number(el.dataset.i), x: e.clientX, y: e.clientY, moved: false };
  });
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
    if (!drag.moved) {
      drag.moved = true;
      const src = pitch.querySelector<HTMLElement>(`.bd-slot[data-i="${drag.i}"] .bd-disc`)!;
      drag.ghost = src.cloneNode(true) as HTMLElement;
      drag.ghost.classList.add('bd-ghost');
      document.body.appendChild(drag.ghost);
      pitch.classList.add('dragging');
    }
    e.preventDefault();
    drag.ghost!.style.transform = `translate(${e.clientX - 24}px, ${e.clientY - 24}px)`;
    pitch.querySelectorAll('.bd-slot.over').forEach((x) => x.classList.remove('over'));
    targetAt(e.clientX, e.clientY)?.classList.add('over');
  }, { passive: false });
  const targetAt = (x: number, y: number) => {
    drag?.ghost && (drag.ghost.style.display = 'none');
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('.bd-slot') ?? null;
    drag?.ghost && (drag.ghost.style.display = '');
    return el;
  };
  addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    if (!d.moved) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 50);
    d.ghost?.remove();
    pitch.classList.remove('dragging');
    const target = targetAt(e.clientX, e.clientY);
    if (target) { swap(d.i, Number(target.dataset.i)); selected = Number(target.dataset.i); swapping = false; }
    render();
  });
  pitch.addEventListener('click', (e) => {
    if (suppressClick) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('.bd-slot');
    if (el) tapSlot(Number(el.dataset.i));
  });

  // ---------- Ricerca ----------
  const sheet = $('bdSearch'), q = $<HTMLInputElement>('bdQ'), results = $('bdResults');
  let target = 0, seq = 0, timer = 0;
  function openSearch(i: number) {
    target = i;
    $('bdSearchTitle').textContent = `${ROLE_NAMES[roleOf(t.modulo, i)]}: chi metti?`;
    sheet.hidden = false;
    q.value = '';
    results.innerHTML = suggestions();
    requestAnimationFrame(() => { sheet.classList.add('open'); q.focus(); });
  }
  function closeSearch() {
    sheet.classList.remove('open');
    sheet.hidden = true;
  }
  /** Prima di scrivere: qualche nome a caso dalle squadre a tema, per partire. */
  function suggestions() {
    const names = shuffle(POOL).slice(0, 6);
    return `<p class="bd-res-k">Prova con</p><div class="bd-themes">${names.map((n) => `<button type="button" class="chip" data-q="${esc(n)}">${esc(n)}</button>`).join('')}</div>`;
  }
  async function runSearch(text: string) {
    const my = ++seq;
    if (text.trim().length < 2) { results.innerHTML = suggestions(); return; }
    results.innerHTML = `<p class="bd-res-k">Cerco…</p>`;
    try {
      const list = await o.catalog.search(text);
      if (my !== seq) return;
      const used = new Set(t.slots.map((a) => a?.id));
      results.innerHTML = list.length
        ? list.map((a) => `<button type="button" class="bd-res" data-id="${esc(a.id)}" ${used.has(a.id) ? 'disabled' : ''}>
            <span class="bd-disc" style='${avatar(a)}'>${a.thumb ? '' : esc(initials(a.name))}</span>
            <span>${esc(a.name)}${used.has(a.id) ? '<small>già in squadra</small>' : ''}</span></button>`).join('')
        : `<p class="bd-res-k">Nessun artista trovato per «${esc(text)}»</p>`;
      lastResults = list;
    } catch (e) {
      if (my !== seq) return;
      results.innerHTML = `<p class="bd-res-k error">${esc((e as Error).message || 'Ricerca non riuscita, riprova.')}</p>`;
    }
  }
  let lastResults: CatalogArtist[] = [];
  q.addEventListener('input', () => { clearTimeout(timer); timer = window.setTimeout(() => void runSearch(q.value), 280); });
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(timer); void runSearch(q.value); } });
  results.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-q]');
    if (chip) { q.value = chip.dataset.q!; void runSearch(q.value); return; }
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.bd-res');
    const a = b && lastResults.find((x) => x.id === b.dataset.id);
    if (!a) return;
    t.slots[target] = a;
    sfx.beep();
    save();
    closeSearch();
    // Si passa da solo al prossimo posto vuoto, così la squadra si fa di fila.
    const next = t.slots.findIndex((s) => !s);
    selected = next >= 0 ? null : target;
    render();
    pitch.querySelector(`.bd-slot[data-i="${target}"]`)?.classList.add('pop');
  });
  sheet.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-close]')) closeSearch(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheet.hidden) closeSearch(); });

  // ---------- Modulo, nome, squadre a tema, draft ----------
  $('bdModulo').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b || busy) return;
    t.modulo = b.dataset.v as Team['modulo'];
    for (const x of $('bdModulo').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
    save(); render();
  });
  $<HTMLInputElement>('bdName').addEventListener('input', (e) => { t.name = (e.target as HTMLInputElement).value.trim() || 'La mia squadra'; save(); });

  /** Riempie i posti uno alla volta, con un piccolo effetto da asta del fantacalcio. */
  async function fill(names: string[], label: string) {
    if (busy) return;
    busy = true; selected = null; swapping = false;
    root.classList.add('filling');
    const sel = $('bdSel');
    try {
      const found = await Promise.all(names.map((n) => findArtist(o.catalog, n).catch(() => null)));
      const seen = new Set<string>();
      t.slots = found.map((a) => (a && !seen.has(a.id) && seen.add(a.id)) ? a : null);
      t.captain = 0;
      for (let i = 0; i < 11; i++) {
        render();
        pitch.querySelector(`.bd-slot[data-i="${i}"]`)?.classList.add('pop');
        sel.innerHTML = `<span class="bd-hint">${esc(label)}: ${t.slots[i] ? esc(t.slots[i]!.name) : '—'}</span>`;
        sfx.tick(i / 11);
        await new Promise((r) => setTimeout(r, 90));
      }
      const missing = t.slots.filter((s) => !s).length;
      if (missing) sel.innerHTML = `<span class="bd-hint">${missing} nomi non trovati: completa tu i posti vuoti.</span>`;
    } finally {
      busy = false;
      root.classList.remove('filling');
      save();
      render();
    }
  }
  $('bdThemes').addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('[data-theme]')?.dataset.theme;
    const th = THEMES.find((x) => x.id === id);
    if (!th) return;
    if (t.name === 'La mia squadra' || THEMES.some((x) => x.label === t.name)) { t.name = th.label; $<HTMLInputElement>('bdName').value = th.label; }
    void fill(th.names, th.label);
  });
  $('bdDraft').addEventListener('click', () => void fill(shuffle(POOL).slice(0, 11), 'Draft'));
  $('bdClear').addEventListener('click', () => {
    if (busy) return;
    t.slots = Array(11).fill(null); t.captain = 0; selected = null; save(); render();
  });
  $('bdPlay').addEventListener('click', () => { if (isComplete(t) && !busy) o.onPlay(t); });
  root.querySelector('#bdLogin')?.addEventListener('click', () => o.onLogin?.());

  render();
}
