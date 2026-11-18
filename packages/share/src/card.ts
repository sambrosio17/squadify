import "./card.css";
import { toBlob } from 'html-to-image';

/** Formato storia Instagram/TikTok/WhatsApp. */
export const STORY = { width: 1080, height: 1920 } as const;

/**
 * Trasforma un elemento HTML (la card, disegnata a 360×640 CSS px) in un PNG 1080×1920.
 * Le immagini esterne (copertine Spotify da i.scdn.co) supportano CORS, quindi finiscono nel PNG.
 */
export async function renderCard(el: HTMLElement): Promise<Blob> {
  await document.fonts.ready;
  const pixelRatio = STORY.width / el.offsetWidth;
  const blob = await toBlob(el, { pixelRatio, cacheBust: true });
  if (!blob) throw new Error('Impossibile generare l\'immagine');
  return blob;
}

/**
 * Condivide la card: su mobile apre il menu nativo (Instagram Stories, WhatsApp...),
 * altrimenti scarica il PNG.
 */
export async function shareCard(el: HTMLElement, opts: { filename: string; title?: string; text?: string }) {
  const blob = await renderCard(el);
  const file = new File([blob], `${opts.filename}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: opts.title, text: opts.text });
      return 'shared' as const;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled' as const;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'downloaded' as const;
}

/** JPEG base64 (senza prefisso) sotto i 256 KB, per usare la card come copertina di una playlist. */
export async function cardAsPlaylistCover(el: HTMLElement, size = 640): Promise<string> {
  const png = await renderCard(el);
  const bmp = await createImageBitmap(png);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const side = Math.min(bmp.width, bmp.height);
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  for (let q = 0.9; q > 0.3; q -= 0.1) {
    const data = canvas.toDataURL('image/jpeg', q).split(',')[1];
    if (data.length * 0.75 < 256 * 1024) return data;
  }
  throw new Error('Copertina troppo grande');
}
