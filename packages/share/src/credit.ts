/** Firma dell'autore: compare nella pagina, su ogni card esportata e nel testo condiviso. */
export const CREDIT = {
  handle: '@salvatoreambrosio17',
  url: 'https://www.instagram.com/salvatoreambrosio17/',
} as const;

/**
 * Indirizzo pubblico dell'app, da VITE_SHARE_URL nel file .env (facoltativo).
 * Se manca, la CTA rimanda al link nella bio del profilo Instagram.
 */
const SHARE_URL: string | undefined = import.meta.env.VITE_SHARE_URL || undefined;
const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

/** Link "made by" per la pagina e per la card (nel PNG resta il nome, che su Instagram si tagga). */
export const creditLink = (cls: string) =>
  `<a class="${cls}" href="${CREDIT.url}" target="_blank" rel="noopener">made by <b>${CREDIT.handle}</b></a>`;

/** Fascia in fondo a ogni card: invito a provare l'app + firma. */
export const ctaStrip = (cta: string) => `<div class="share-cta">
    <span class="share-cta-line"><b>${cta}</b> → ${SHARE_URL ? shortUrl(SHARE_URL) : 'link in bio'}</span>
    ${creditLink('share-cta-credit')}
  </div>`;

/** Aggiunge invito, firma e link al testo che accompagna la condivisione. */
export const withCredit = (cta: string, text?: string) =>
  [text, SHARE_URL ? `${cta}: ${SHARE_URL}` : undefined, `made by ${CREDIT.handle} ${CREDIT.url}`]
    .filter(Boolean).join('\n\n');
