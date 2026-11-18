# Squadify · La Formazione

I tuoi 11 artisti più ascoltati su Spotify diventano una squadra in campo: partita animata, tabellone delle sostituzioni tra i periodi, 4 stili e la carta del capitano da condividere nelle storie.

**Online:** https://sambrosio17.github.io/squadify/

## Come funziona la pubblicazione

Ogni push su `main` fa partire `.github/workflows/pages.yml`, che compila l'app e la pubblica su GitHub Pages.

Servono due impostazioni una volta sola:

1. **Variabile del Client ID**: in *Settings → Secrets and variables → Actions → Variables* crea `VITE_SPOTIFY_CLIENT_ID` con il Client ID dell'app Spotify. Non è un segreto (con PKCE non c'è client secret), ma così non sta nel codice.
2. **Redirect URI su Spotify**: nella [Developer Dashboard](https://developer.spotify.com/dashboard) aggiungi `https://sambrosio17.github.io/squadify/` (con la barra finale).

L'app Spotify in Development Mode accetta solo i 5 utenti in allowlist (*User Management* nella dashboard). Le immagini condivise invece le vede chiunque.

## In locale

```bash
pnpm install
cp .env.example .env   # inserisci VITE_SPOTIFY_CLIENT_ID
pnpm dev               # http://127.0.0.1:5172/ (registralo come redirect URI)
```

Il codice viene dal monorepo [something-sportify](https://github.com/sambrosio17/something-sportify) (`apps/la-formazione` + `packages/core` e `packages/share`).

---

made by [@salvatoreambrosio17](https://www.instagram.com/salvatoreambrosio17/)
