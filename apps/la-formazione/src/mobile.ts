/**
 * Interfaccia per telefono (sotto i 720px): card a tutto schermo con il periodo sopra,
 * barra fissa in basso (modulo, stile, carta, condividi), controlli in un pannello che sale dal basso
 * e galleria dei giocatori per la carta del capitano.
 * Non sostituisce la regia: i pulsanti nuovi "premono" quelli esistenti, così la logica resta in engine.ts.
 */
const MOBILE = '(max-width: 720px)';

const ICON = {
  modulo: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  stile: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 100 18c1 0 1.5-.8 1.5-1.6 0-1.2-1-1.4-1-2.4s.8-1.5 1.8-1.5H17a4 4 0 004-4c0-4.7-4-8.5-9-8.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/></svg>',
  carta: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 15h6M12 7v4"/></svg>',
  campo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.5"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10z"/><path class="on" d="M16.5 9a4 4 0 010 6M19 6.5a7.5 7.5 0 010 11"/><path class="off" d="M17 9l4 6M21 9l-4 6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
};

export interface MobileOpts {
  /** Mostra la scelta del periodo sopra la card (solo con gli ascolti). */
  periods?: boolean;
  /** Squadra fatta a mano: al posto del modulo, un pulsante che torna al mercato. */
  onEdit?: () => void;
  /** Testo del pulsante in fondo al pannello (di default "Esci da Spotify"). */
  exitLabel?: string;
}

export function mountMobile(card: HTMLElement, root: HTMLElement, opts: MobileOpts = {}) {
  const periods = opts.periods ?? true;
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const mq = matchMedia(MOBILE);
  root.classList.add('lf-m');

  // ---- Card che entra nello schermo: la scala sta su un contenitore, non sulla card (che si esporta a 360×640).
  const fit = document.createElement('div'); fit.className = 'm-fit';
  const scale = document.createElement('div'); scale.className = 'm-scale';
  card.replaceWith(fit); fit.appendChild(scale); scale.appendChild(card);

  // ---- Barra in alto: nome dell'app, nome della squadra, suoni.
  const top = document.createElement('header');
  top.className = 'm-top';
  top.innerHTML = `<span class="m-logo">La Formazione</span>
    <button type="button" class="m-team" id="mTeam"><span></span>${ICON.edit}</button>
    <button type="button" class="m-icon" id="mSound" aria-label="Attiva i suoni" aria-pressed="false">${ICON.sound}</button>`;
  root.prepend(top);

  // ---- Periodo sopra la card (rimanda ai pulsanti della regia).
  const period = document.createElement('div');
  period.className = 'm-period';
  period.setAttribute('role', 'group');
  period.setAttribute('aria-label', 'Periodo');
  for (const b of root.querySelectorAll<HTMLButtonElement>('#segPeriodo button')) {
    const c = document.createElement('button');
    c.type = 'button'; c.textContent = b.textContent; c.dataset.v = b.dataset.v;
    c.addEventListener('click', () => b.click());
    period.appendChild(c);
  }
  fit.before(period);
  period.hidden = !periods;

  // ---- Galleria dei giocatori sotto la carta del capitano.
  const picker = document.createElement('div');
  picker.className = 'm-picker';
  picker.innerHTML = `<div class="m-picker-h"><span>Giocatore</span><button type="button" id="mHow">${ICON.info}Come si calcolano i numeri</button></div><div class="m-picker-row" id="mPickRow"></div>`;
  fit.after(picker);

  // ---- Barra fissa in basso.
  const bar = document.createElement('nav');
  bar.className = 'm-bar';
  bar.setAttribute('aria-label', 'Azioni');
  bar.innerHTML = `<button type="button" id="mModulo">${ICON.modulo}<span></span></button>
    <button type="button" id="mStile">${ICON.stile}<span>Stile</span></button>
    <button type="button" id="mView"></button>
    <button type="button" class="m-share" id="mShare">${ICON.share}<span>Condividi</span></button>`;
  root.appendChild(bar);

  // ---- Pannello dal basso: la regia esistente, con maniglia, titolo e "Esci".
  const aside = $('.stage-controls');
  const sheetHead = document.createElement('div');
  sheetHead.className = 'm-sheet-head';
  sheetHead.innerHTML = `<i aria-hidden="true"></i><h2>Personalizza</h2><button type="button" class="m-done" id="mDone">Fatto</button>`;
  aside.prepend(sheetHead);
  const logout = document.createElement('button');
  logout.type = 'button'; logout.className = 'btn ghost m-logout'; logout.textContent = opts.exitLabel ?? 'Esci da Spotify';
  logout.addEventListener('click', () => $<HTMLButtonElement>('#logout').click());
  aside.appendChild(logout);
  aside.setAttribute('aria-label', 'Personalizza la storia');
  const backdrop = document.createElement('div');
  backdrop.className = 'm-backdrop';
  root.appendChild(backdrop);

  const openSheet = (focus?: string) => {
    root.classList.add('m-sheet-open');
    if (focus) requestAnimationFrame(() => {
      const el = $(focus);
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (el instanceof HTMLInputElement) el.focus({ preventScroll: true });
    });
  };
  const closeSheet = () => root.classList.remove('m-sheet-open');
  $('#mStile').addEventListener('click', () => openSheet());
  $('#mTeam').addEventListener('click', () => openSheet('#teamName'));
  $('#mHow').addEventListener('click', () => openSheet('.howto'));
  $('#mDone').addEventListener('click', closeSheet);
  backdrop.addEventListener('click', closeSheet);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  $('#mSound').addEventListener('click', () => $<HTMLButtonElement>('#btnSound').click());
  $('#mShare').addEventListener('click', () => $<HTMLButtonElement>('#share').click());
  $('#mModulo').addEventListener('click', () => {
    if (opts.onEdit) { opts.onEdit(); return; }
    const bs = [...root.querySelectorAll<HTMLButtonElement>('#segModulo button')];
    const i = bs.findIndex((b) => b.getAttribute('aria-pressed') === 'true');
    bs[(i + 1) % bs.length].click();
  });
  $('#mView').addEventListener('click', () => {
    $<HTMLButtonElement>(card.dataset.view === 'carta' ? '#f-partita' : '#f-carta').click();
  });

  // ---- Allinea i controlli nuovi allo stato della regia.
  const select = $<HTMLSelectElement>('#ccPlayer');
  function renderPicker() {
    if (!card.isConnected) return;
    const row = $('#mPickRow');
    row.innerHTML = '';
    for (const o of select.options) {
      const pl = root.querySelector<HTMLElement>(`.pl[data-id="${o.value}"] .disc`);
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.id = o.value;
      const label = o.textContent!.replace(/^\d+\.\s*/, '').replace(' (capitano)', '');
      b.innerHTML = `<span class="m-av"></span><span class="m-nm"></span>`;
      const av = b.querySelector<HTMLElement>('.m-av')!;
      if (pl) av.style.cssText = pl.style.cssText;
      if (!pl?.classList.contains('has-photo')) av.textContent = label.split(/\s+/).map((w) => w[0]).join('').slice(0, 2);
      b.querySelector('.m-nm')!.textContent = label;
      b.addEventListener('click', () => {
        select.value = o.value;
        select.dispatchEvent(new Event('change'));
        sync();
      });
      row.appendChild(b);
    }
  }
  function sync() {
    // La partita può essere già stata tolta dalla pagina (si torna al mercato): i listener su root restano.
    if (!card.isConnected) return;
    for (const b of root.querySelectorAll<HTMLElement>('#mPickRow button')) b.setAttribute('aria-pressed', String(b.dataset.id === select.value));
    for (const c of period.querySelectorAll('button')) {
      const b = root.querySelector(`#segPeriodo button[data-v="${c.dataset.v}"]`);
      c.setAttribute('aria-pressed', b?.getAttribute('aria-pressed') ?? 'false');
    }
    const mod = root.querySelector('#segModulo button[aria-pressed="true"]');
    if (opts.onEdit) {
      $('#mModulo').innerHTML = `${ICON.edit}<span>Squadra</span>`;
      $('#mModulo').setAttribute('aria-label', 'Modifica la squadra');
    } else {
      $('#mModulo span').textContent = mod?.textContent ?? 'Modulo';
      $('#mModulo').setAttribute('aria-label', `Modulo ${mod?.textContent ?? ''}, tocca per cambiarlo`);
    }
    const carta = card.dataset.view === 'carta';
    $('#mView').innerHTML = carta ? `${ICON.campo}<span>Partita</span>` : `${ICON.carta}<span>Carta</span>`;
    $('#mShare span').textContent = carta ? 'Condividi la carta' : 'Condividi';
    root.classList.toggle('m-carta', carta);
    const team = ($<HTMLInputElement>('#teamName').value.trim() || $('#teamLbl').textContent) ?? '';
    $('#mTeam span').textContent = team;
    $('#mTeam').setAttribute('aria-label', `Nome della squadra: ${team}. Tocca per cambiarlo`);
    const on = $('#btnSound').getAttribute('aria-pressed') === 'true';
    $('#mSound').setAttribute('aria-pressed', String(on));
    $('#mSound').setAttribute('aria-label', on ? 'Disattiva i suoni' : 'Attiva i suoni');
  }
  root.addEventListener('click', () => requestAnimationFrame(sync));
  $('#teamName').addEventListener('input', sync);
  new MutationObserver(() => { renderPicker(); sync(); }).observe(select, { childList: true, subtree: true });
  new MutationObserver(sync).observe(card, { attributes: true, attributeFilter: ['data-view'] });

  // ---- Scala della card in base allo spazio libero.
  function resize() {
    if (!card.isConnected) return;
    if (!mq.matches) {
      fit.style.cssText = ''; scale.style.cssText = '';
      return;
    }
    const used = top.offsetHeight + (periods ? period.offsetHeight : 0) + bar.offsetHeight
      + (root.classList.contains('m-carta') ? picker.offsetHeight : 0) + 28;
    const k = Math.min(1, (innerWidth - 24) / 360, (innerHeight - used) / 640);
    fit.style.cssText = `width:${Math.round(360 * k)}px;height:${Math.round(640 * k)}px`;
    scale.style.cssText = `transform:scale(${k})`;
  }
  addEventListener('resize', resize);
  mq.addEventListener('change', () => { if (!mq.matches) closeSheet(); resize(); });
  new MutationObserver(resize).observe(root, { attributes: true, attributeFilter: ['class'] });

  renderPicker();
  sync();
  resize();
}
