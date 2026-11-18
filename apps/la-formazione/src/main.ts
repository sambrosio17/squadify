import './fonts';
import { createCatalog, createSpotify, esc, SpotifyError, type Catalog } from '@sportify/core';
import { creditLink, renderStage, type CardResult } from '@sportify/share';
import { mountBuilder } from './builder';
import { loadModel } from './data';
import { demoCatalog } from './demo';
import { mountFormazione } from './engine';
import { mountMobile } from './mobile';
import { SCOPES } from './scopes';
import { spotifySquad } from './squad';
import { challengeUrl, emptyTeam, loadDraft, manualSquad, readChallenge, saveDraft, teamFromChallenge, VOTI, VOTO_BASE, type Team } from './team';
import { CARD_HTML, CONTROLS_HTML } from './templates';
import './style.css';

const DEF = {
  title: 'La Formazione',
  tagline: 'Crea la tua squadra con gli artisti di Spotify: partita, carta del capitano e sfida agli amici.',
  cta: 'Schiera la tua squadra',
};
const HERO = `<div class="hero">
    <div class="hero-cards" aria-hidden="true"><span class="h1c"></span><span class="h2c"></span><span class="h3c"></span></div>
    <h2>Undici artisti<br><em>scendono in campo</em></h2>
    <p>Scegli modulo, giocatori e capitano da tutto il catalogo di Spotify. Poi partita, carta del capitano e sfida a un amico.</p>
  </div>`;

const root = document.querySelector<HTMLElement>('#app')!;
const footer = `<footer class="made-by">${creditLink('made-by-link')}</footer>`;
const clientId: string | undefined = import.meta.env.VITE_SPOTIFY_CLIENT_ID || undefined;
const apiUrl: string | undefined = import.meta.env.VITE_SQUADIFY_API || undefined;
const catalog: Catalog = apiUrl ? createCatalog(apiUrl) : demoCatalog();

function status(msg: string, error = false) {
  root.className = 'shell';
  root.innerHTML = `<h1>${esc(DEF.title)}</h1><p class="status${error ? ' error' : ''}">${esc(msg)}</p>${footer}`;
}

// ---------- Home ----------
function home() {
  root.className = 'shell login';
  const draft = loadDraft();
  root.innerHTML = `<h1>Squadify</h1>${HERO}
    <button class="btn" id="go">${draft && draft.slots.some(Boolean) ? 'Riprendi la tua squadra' : 'Crea la tua squadra'}</button>
    ${clientId ? `<button class="bd-login" id="spLogin">Hai l'accesso su Spotify? <b>Usa i tuoi ascolti</b></button>` : ''}
    ${footer}`;
  root.querySelector('#go')!.addEventListener('click', () => builder(draft ?? emptyTeam()));
  root.querySelector("#spLogin")?.addEventListener('click', () => void loginSpotify());
}

function builder(team: Team) {
  history.replaceState(null, '', location.pathname + location.search);
  mountBuilder(root, { catalog, team, onPlay: play, onLogin: clientId ? () => void loginSpotify() : undefined });
  scrollTo(0, 0);
}

// ---------- Partita con la squadra fatta a mano ----------
/** `readOnly`: la squadra di chi ha lanciato la sfida, vista da chi ha aperto il link. */
function play(team: Team, readOnly = false) {
  let hooks: ReturnType<typeof mountFormazione> | null = null;
  const edit = () => readOnly ? builder({ ...emptyTeam(), vs: team.name }) : builder(team);
  const card: CardResult = {
    className: 'card',
    filename: 'la-mia-formazione',
    getFilename: () => hooks?.filename() ?? 'la-mia-formazione',
    shareText: () => {
      const base = hooks?.shareText() ?? `Ecco la formazione di ${team.name} ⚽`;
      return readOnly ? base : `${base}\nSfidami con la tua squadra: ${challengeUrl(team)}`;
    },
    link: () => challengeUrl(team),
    html: CARD_HTML,
    controls: CONTROLS_HTML,
    mount: (el, r) => {
      hooks = mountFormazione(el, r, manualSquad(team, catalog), { teamDefault: team.name, modulo: team.modulo, lockModulo: true });
      mountMobile(el, r, { periods: false, onEdit: edit, exitLabel: readOnly ? 'Rispondi alla sfida' : 'Modifica squadra' });
      mountExtras(r, team, readOnly, () => hooks!);
    },
  };
  renderStage(root, DEF, card, { label: readOnly ? 'Rispondi alla sfida' : 'Modifica squadra', onClick: edit });
  if (readOnly) {
    const banner = document.createElement('div');
    banner.className = 'vs-banner';
    banner.innerHTML = `<b>${esc(team.name)} ti sfida</b><span>Ecco la loro squadra. Rispondi con la tua: la partita sarà contro di loro.</span>
      <button type="button" class="btn" id="vsGo">Rispondi alla sfida</button>`;
    root.querySelector('.stage')!.before(banner);
    banner.querySelector('#vsGo')!.addEventListener('click', edit);
  }
  scrollTo(0, 0);
}

/** Voti del mister sulla carta, nome della squadra e pulsante "Sfida un amico". */
function mountExtras(r: HTMLElement, team: Team, readOnly: boolean, hooks: () => ReturnType<typeof mountFormazione>) {
  const voti = r.querySelector<HTMLElement>('#ccVoti')!;
  const select = r.querySelector<HTMLSelectElement>('#ccPlayer')!;
  function renderVoti() {
    const id = hooks().cardPlayer();
    const v = team.ratings[id] ?? VOTI.map(() => VOTO_BASE);
    voti.hidden = readOnly;
    voti.innerHTML = `<span class="lbl">Voti del mister</span>` + VOTI.map((x, i) => `
      <label class="voto"><span><b>${x.k}</b> ${x.label}<small>${x.hint}</small></span>
        <input type="range" min="40" max="99" value="${v[i]}" data-i="${i}" aria-label="${x.label}"><output>${v[i]}</output></label>`).join('');
  }
  voti.addEventListener('input', (e) => {
    const inp = e.target as HTMLInputElement;
    if (inp.type !== 'range') return;
    const id = hooks().cardPlayer();
    const v = team.ratings[id] ?? VOTI.map(() => VOTO_BASE);
    v[Number(inp.dataset.i)] = Number(inp.value);
    team.ratings[id] = v;
    inp.nextElementSibling!.textContent = inp.value;
    hooks().refreshCard();
    if (!readOnly) saveDraft(team);
  });
  select.addEventListener('change', renderVoti);
  new MutationObserver(renderVoti).observe(select, { childList: true });
  renderVoti();

  r.querySelector<HTMLInputElement>('#teamName')!.addEventListener('input', (e) => {
    team.name = (e.target as HTMLInputElement).value.trim() || team.name;
    if (!readOnly) saveDraft(team);
  });

  if (readOnly) return;
  const grp = document.createElement('div');
  grp.className = 'group sfida';
  grp.innerHTML = `<span class="lbl">Sfida un amico</span>
    <p class="note">Il link contiene la tua squadra: chi lo apre la vede in campo e risponde con la sua.</p>
    <button type="button" class="btn" id="btnSfida">Manda la sfida</button>`;
  r.querySelector('.regia')!.prepend(grp);
  const btn = grp.querySelector<HTMLButtonElement>('#btnSfida')!;
  btn.addEventListener('click', async () => {
    const url = challengeUrl(team);
    const text = `${team.name} ti sfida su Squadify ⚽ Schiera la tua squadra:`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Squadify', text, url }); return; }
      await navigator.clipboard.writeText(`${text} ${url}`);
      btn.textContent = 'Link copiato';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
      btn.textContent = 'Copia non riuscita';
    }
    setTimeout(() => { btn.textContent = 'Manda la sfida'; }, 2500);
  });
}

// ---------- Squadra dagli ascolti (login Spotify, solo utenti in allowlist) ----------
async function loginSpotify() {
  const spotify = await createSpotify({ clientId, scopes: SCOPES });
  spotify.login();
}

async function listeningFlow(spotify: Awaited<ReturnType<typeof createSpotify>>) {
  status('Sto ascoltando i tuoi ascolti…');
  try {
    const [model, me] = await Promise.all([loadModel(spotify.api), spotify.api.me()]);
    const teamDefault = `FC ${me.display_name?.split(' ')[0] ?? 'Sportify'}`.slice(0, 18);
    let hooks: ReturnType<typeof mountFormazione> | null = null;
    renderStage(root, { ...DEF, tagline: 'I tuoi 11 artisti più ascoltati in campo, con sostituzioni e carta del capitano.' }, {
      className: 'card',
      filename: 'la-mia-formazione',
      getFilename: () => hooks?.filename() ?? 'la-mia-formazione',
      shareText: () => hooks?.shareText() ?? 'Ecco la mia formazione ⚽',
      html: CARD_HTML,
      controls: CONTROLS_HTML,
      mount: (card, r) => {
        hooks = mountFormazione(card, r, spotifySquad(model, spotify.api), { teamDefault });
        mountMobile(card, r);
      },
    }, { label: 'Esci', onClick: () => spotify.logout() });
  } catch (e) {
    const msg = e instanceof SpotifyError && e.status === 403
      ? 'Il tuo account non è tra gli utenti abilitati al login. Puoi comunque creare la squadra a mano.'
      : e instanceof SpotifyError && e.reason === 'QUOTA_EXCEEDED'
        ? 'Quota di Spotify esaurita per oggi: riprova più tardi.'
        : (e as Error).message;
    status(msg, true);
    const b = document.createElement('button');
    b.className = 'btn'; b.textContent = 'Crea la squadra a mano';
    b.addEventListener('click', () => { spotify.logout(); });
    root.querySelector('.status')!.after(b);
    console.error(e);
  }
}

// ---------- Avvio ----------
async function start() {
  // Ritorno dal login di Spotify (o token già salvato): la squadra dagli ascolti.
  if (clientId) {
    const spotify = await createSpotify({ clientId, scopes: SCOPES }).catch((e) => { console.warn(e); return null; });
    if (spotify?.loggedIn) return listeningFlow(spotify);
  }
  const ch = readChallenge();
  if (ch) {
    status('Carico la squadra che ti ha sfidato…');
    try {
      play(await teamFromChallenge(ch, catalog), true);
    } catch (e) {
      status((e as Error).message || 'Link della sfida non valido.', true);
      const b = document.createElement('button');
      b.className = 'btn'; b.textContent = 'Crea la tua squadra';
      b.addEventListener('click', () => builder(emptyTeam()));
      root.querySelector('.status')!.after(b);
    }
    return;
  }
  home();
}

void start();
