import { esc } from '@sportify/core';
import { downloadBlob } from './card';
import { shareLink } from './credit';

export interface SheetOpts { blob: Blob; filename: string; title: string; text: string }

const ICON_SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6"/></svg>';
const ICON_SAVE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
const ICON_LINK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/**
 * Pannello di condivisione: anteprima del PNG già pronto, testo che lo accompagna e tre azioni.
 * L'immagine si genera prima di aprirlo, così il tocco su "Condividi" chiama subito navigator.share
 * (Safari su iPhone lo permette solo durante un gesto dell'utente).
 */
export function openShareSheet(o: SheetOpts) {
  const file = new File([o.blob], `${o.filename}.png`, { type: 'image/png' });
  const canShare = !!navigator.canShare?.({ files: [file] });
  const url = URL.createObjectURL(o.blob);
  const link = shareLink();
  const prev = document.activeElement as HTMLElement | null;

  const wrap = document.createElement('div');
  wrap.className = 'share-sheet';
  wrap.innerHTML = `<div class="share-sheet-bg"></div>
    <section class="share-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="shTitle">
      <i class="share-sheet-handle" aria-hidden="true"></i>
      <header><h2 id="shTitle">La tua storia è pronta</h2><button type="button" class="share-sheet-x" aria-label="Chiudi">${ICON_X}</button></header>
      <div class="share-sheet-body">
        <img src="${url}" alt="Anteprima dell'immagine da condividere" width="1080" height="1920">
        <div class="share-sheet-info">
          <span class="share-sheet-k">Formato storia 1080 × 1920</span>
          <span class="share-sheet-k">Testo che accompagna l'immagine</span>
          <p>${esc(o.text)}</p>
        </div>
      </div>
      <div class="share-sheet-actions">
        ${canShare ? `<button type="button" class="btn share-sheet-main" data-a="share">${ICON_SHARE}Condividi</button>` : ''}
        <div class="share-sheet-row">
          <button type="button" class="btn ghost" data-a="save">${ICON_SAVE}Salva immagine</button>
          <button type="button" class="btn ghost" data-a="link">${ICON_LINK}<span>Copia link</span></button>
        </div>
      </div>
    </section>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));

  const close = () => {
    wrap.classList.remove('open');
    removeEventListener('keydown', onKey);
    setTimeout(() => { wrap.remove(); URL.revokeObjectURL(url); }, 300);
    prev?.focus?.();
  };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', onKey);
  wrap.querySelector('.share-sheet-bg')!.addEventListener('click', close);
  wrap.querySelector('.share-sheet-x')!.addEventListener('click', close);
  wrap.querySelector<HTMLButtonElement>('[data-a]')?.focus();

  wrap.querySelector('[data-a="share"]')?.addEventListener('click', async () => {
    try {
      await navigator.share({ files: [file], title: o.title, text: o.text });
      close();
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') downloadBlob(o.blob, file.name);
    }
  });
  wrap.querySelector('[data-a="save"]')!.addEventListener('click', () => downloadBlob(o.blob, file.name));
  wrap.querySelector('[data-a="link"]')!.addEventListener('click', async (e) => {
    const lbl = (e.currentTarget as HTMLElement).querySelector('span')!;
    try {
      await navigator.clipboard.writeText(link);
      lbl.textContent = 'Link copiato';
    } catch {
      lbl.textContent = link.replace(/^https?:\/\//, '');
    }
    setTimeout(() => { lbl.textContent = 'Copia link'; }, 2500);
  });
}
