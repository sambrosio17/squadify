# squadify-api

Un Cloudflare Worker gratuito che fa da ponte tra Squadify e il catalogo pubblico di Spotify, così l'app funziona **senza login** e senza il limite dei 5 utenti di Development Mode.

- Usa il flusso **Client Credentials**: il client secret resta qui, mai nel browser.
- Restituisce solo nome, foto e discografia degli artisti.
- Tiene in cache le risposte all'edge (ricerche 1 giorno, artisti 7 giorni, discografie 3 giorni). In Development Mode la quota è per account sviluppatore, quindi ogni ricerca già fatta da qualcuno non costa più nulla.

| Rotta | Cosa restituisce |
| --- | --- |
| `GET /search?q=geolier` | fino a 10 artisti (`id`, `name`, `image`, `thumb`) |
| `GET /artists?ids=a,b,c` | fino a 15 artisti per id (serve al link "sfida un amico") |
| `GET /artist/{id}` | artista + `releases` (uscite), `debut` (anno del primo disco), `latest` (ultima uscita) |

## Metterlo online (10 minuti, una volta sola)

Ti servono Node.js e un account Cloudflare gratuito ([registrati qui](https://dash.cloudflare.com/sign-up)).

1. **Prendi le credenziali Spotify.** Nella [Developer Dashboard](https://developer.spotify.com/dashboard) apri l'app che usi già per Squadify → *Settings*. Copia il **Client ID**, poi premi *View client secret* e copia il **Client secret**.
2. **Installa e accedi a Cloudflare** (dalla cartella `worker` del repository squadify):
   ```bash
   cd worker
   npm install
   npx wrangler login        # si apre il browser: accetta
   ```
3. **Salva le credenziali come secret** (te le chiede una alla volta, incollale):
   ```bash
   npx wrangler secret put SPOTIFY_CLIENT_ID
   npx wrangler secret put SPOTIFY_CLIENT_SECRET
   ```
   Se Wrangler chiede di creare il Worker perché non esiste ancora, rispondi sì.
4. **Pubblica:**
   ```bash
   npx wrangler deploy
   ```
   Alla fine stampa un indirizzo come `https://squadify-api.TUONOME.workers.dev`. Aprilo aggiungendo `/search?q=geolier`: devi vedere un JSON con Geolier.
5. **Collega il sito.** Nel repository squadify su GitHub: *Settings → Secrets and variables → Actions → Variables → New repository variable*.
   Nome `VITE_SQUADIFY_API`, valore l'indirizzo del punto 4 (senza barra finale). Al prossimo push su `main` il sito usa il catalogo vero.

Per provare in locale metti lo stesso indirizzo in `.env` (`VITE_SQUADIFY_API=…`) nella root del repository.

## Note

- `ALLOWED_ORIGINS` in `wrangler.toml` dice quali siti possono chiamarlo dal browser: GitHub Pages e `http://127.0.0.1:5172` per lo sviluppo. Se cambi dominio, aggiungilo lì e rifai `npx wrangler deploy`.
- Il piano gratuito di Cloudflare regge 100.000 richieste al giorno.
- Se Spotify risponde `429` il Worker lo passa all'app, che mostra "Troppe richieste a Spotify in questo momento".
- Prove senza Cloudflare né Spotify: `npm test` (usa un fetch finto).
