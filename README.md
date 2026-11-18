# Squadify · La Formazione

Crea la tua squadra con 11 artisti presi da tutto il catalogo di Spotify: scegli modulo, ruoli e capitano, guarda la partita animata, dai i tuoi voti da mister sulla carta del capitano e sfida un amico con un link. 4 stili e card 9:16 da condividere nelle storie.

Non serve il login: i dati arrivano dal catalogo pubblico attraverso un piccolo Worker (cartella [`worker/`](worker/README.md)). Chi è tra gli utenti abilitati dell'app Spotify può ancora usare i propri ascolti con "Usa i tuoi ascolti".

**Online:** https://sambrosio17.github.io/squadify/

## Come funziona la pubblicazione

Ogni push su `main` fa partire `.github/workflows/pages.yml`, che compila l'app e la pubblica su GitHub Pages.

Impostazioni (una volta sola, in *Settings → Secrets and variables → Actions → Variables*):

1. **`VITE_SQUADIFY_API`**: l'indirizzo del Worker che legge il catalogo di Spotify. Come metterlo online: [worker/README.md](worker/README.md). Se manca, il sito gira con un catalogo di prova (solo nomi, senza foto).
2. **`VITE_SPOTIFY_CLIENT_ID`** (facoltativo): il Client ID dell'app Spotify, per il login "Usa i tuoi ascolti". Va registrato `https://sambrosio17.github.io/squadify/` come Redirect URI nella [Developer Dashboard](https://developer.spotify.com/dashboard). Il login accetta solo i 5 utenti in allowlist di Development Mode.

## In locale

```bash
pnpm install
cp .env.example .env   # VITE_SQUADIFY_API (facoltativo: senza, catalogo di prova)
pnpm dev               # http://127.0.0.1:5172/
```

Il codice viene dal monorepo [something-sportify](https://github.com/sambrosio17/something-sportify) (`apps/la-formazione` + `packages/core` e `packages/share`).

---

made by [@salvatoreambrosio17](https://www.instagram.com/salvatoreambrosio17/)
