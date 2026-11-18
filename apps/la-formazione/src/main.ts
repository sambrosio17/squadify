import './fonts';
import { startApp } from '@sportify/share';
import { loadModel } from './data';
import { mountFormazione } from './engine';
import { SCOPES } from './scopes';
import { CARD_HTML, CONTROLS_HTML } from './templates';
import './style.css';

startApp({
  title: 'La Formazione',
  tagline: 'I tuoi 11 artisti in campo, con sostituzioni e carta del capitano.',
  cta: 'Schiera la tua squadra',
  scopes: SCOPES,
  async build(api) {
    const [model, me] = await Promise.all([loadModel(api), api.me()]);
    const teamDefault = `FC ${me.display_name?.split(' ')[0] ?? 'Sportify'}`.slice(0, 18);
    let hooks: ReturnType<typeof mountFormazione> | null = null;
    return {
      className: 'card',
      filename: 'la-mia-formazione',
      getFilename: () => hooks?.filename() ?? 'la-mia-formazione',
      shareText: () => hooks?.shareText() ?? 'Ecco la mia formazione ⚽',
      html: CARD_HTML,
      controls: CONTROLS_HTML,
      mount: (card, root) => { hooks = mountFormazione(card, root, model, api, teamDefault); },
    };
  },
});
