import { createSpotify, SpotifyError, type Endpoints, esc } from '@sportify/core';
import { renderCard } from './card';
import { openShareSheet } from './sheet';
import { creditLink, ctaStrip, withCredit } from './credit';
import './shell.css';

export interface CardResult {
  /** HTML della card (verrà messo dentro un <div class="story-card">). */
  html: string;
  /** Classe CSS aggiuntiva per la card. */
  className?: string;
  /** Nome del file PNG esportato. */
  filename: string;
  /** Testo che accompagna la condivisione (può cambiare mentre l'app gira). */
  shareText?: string | (() => string);
  /** Nome del file, se dipende dallo stato dell'app. */
  getFilename?: () => string;
  /** HTML dei controlli mostrati accanto alla card (facoltativo). */
  controls?: string;
  /** Chiamata dopo che card e controlli sono nella pagina: qui l'app aggancia animazioni ed eventi. */
  mount?: (card: HTMLElement, root: HTMLElement) => void;
}

export interface AppDefinition {
  title: string;
  tagline: string;
  /** Invito stampato in fondo alla card condivisa, es. "Schiera la tua squadra". */
  cta?: string;
  /** HTML mostrato sopra il pulsante di accesso (anteprima, titolo). */
  hero?: string;
  scopes: string[];
  build: (api: Endpoints) => Promise<CardResult>;
}

/**
 * Guscio comune delle app: login, caricamento, errori, card e pulsanti.
 * Ogni app deve solo fornire `build`, che chiama l'API e restituisce l'HTML della card.
 */
export async function startApp(def: AppDefinition) {
  const root = document.querySelector<HTMLElement>('#app')!;
  root.className = 'shell';
  const header = `<h1>${esc(def.title)}</h1><p class="tagline">${esc(def.tagline)}</p>`;
  const cta = def.cta ?? 'Crea anche la tua';
  const footer = `<footer class="made-by">${creditLink('made-by-link')}</footer>`;

  try {
    const spotify = await createSpotify({ scopes: def.scopes });
    if (!spotify.loggedIn) {
      root.classList.add('login');
      root.innerHTML = `${header}${def.hero ?? ''}<button class="btn" id="login">Accedi con Spotify</button>${footer}`;
      root.querySelector('#login')!.addEventListener('click', () => spotify.login());
      return;
    }
    root.innerHTML = `${header}<p class="status">Sto ascoltando i tuoi ascolti…</p>${footer}`;
    const card = await def.build(spotify.api);
    const actions = `<div class="actions">
        <button class="btn" id="share">Condividi</button>
        <button class="btn ghost" id="logout">Esci</button>
      </div>`;
    const cardHtml = `<div class="story-card ${card.className ?? ''}" id="card">${card.html}${ctaStrip(cta)}</div>`;
    root.innerHTML = card.controls
      ? `${header}<div class="stage"><div class="stage-card">${cardHtml}${actions}</div><aside class="stage-controls">${card.controls}</aside></div>${footer}`
      : `${header}${cardHtml}${actions}${footer}`;
    const el = root.querySelector<HTMLElement>('#card')!;
    const share = root.querySelector<HTMLButtonElement>('#share')!;
    share.addEventListener('click', async () => {
      share.disabled = true;
      // Durante l'export le animazioni si fermano, così il PNG mostra lo stato finale.
      el.classList.add('exporting');
      try {
        const text = typeof card.shareText === 'function' ? card.shareText() : card.shareText;
        const blob = await renderCard(el);
        openShareSheet({ blob, filename: card.getFilename?.() ?? card.filename, title: def.title, text: withCredit(cta, text) });
      } catch (e) {
        console.error(e);
        share.textContent = 'Errore, riprova';
        setTimeout(() => { share.textContent = 'Condividi'; }, 2500);
      } finally {
        el.classList.remove('exporting');
        share.disabled = false;
      }
    });
    root.querySelector('#logout')!.addEventListener('click', () => spotify.logout());
    card.mount?.(el, root);
  } catch (e) {
    const msg = e instanceof SpotifyError && e.status === 403
      ? 'Il tuo account non è tra i 5 utenti abilitati per questa app (Development Mode).'
      : e instanceof SpotifyError && e.reason === 'QUOTA_EXCEEDED'
        ? 'Quota di Spotify esaurita per oggi: riprova più tardi.'
        : (e as Error).message;
    root.innerHTML = `${header}<p class="status error">${esc(msg)}</p>${footer}`;
    console.error(e);
  }
}
