/** HTML della card (storia 9:16) e dei controlli della regia. */
export const CARD_HTML = `
    <div class="bug">
      <span class="live">Live</span>
      <span class="team" id="teamLbl">La mia squadra</span>
      <span class="score"><b id="sHome">0</b>–<b id="sAway">0</b></span>
      <span class="opp">Noia</span>
      <span class="clock" id="clock">00'</span>
    </div>
    <div class="period-chip" id="periodChip"></div>
    <div class="ticker" id="ticker"><span>Squadre in campo, si parte.</span></div>
    <div class="pitch" id="pitch">
      <div class="line half"></div><div class="line circle"></div>
      <div class="line box-top"></div><div class="line box-bot"></div>
      <div class="goal" id="goal"></div>
      <svg id="trails" aria-hidden="true"><defs><marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#ffe58a"></path></marker></defs></svg>
      <div class="ball" id="ball"></div>
      <div class="goal-flash" id="flash"><div>GOL!<small id="scorer"></small></div></div>
    </div>
    <div class="board" id="board" aria-live="polite">
      <div class="bh"><span id="boardTitle">Sostituzioni</span><b id="boardCount"></b></div>
      <div class="rows" id="rows"></div>
    </div>
    <div class="capcard" id="capcard" hidden>
      <div class="cc-beams" id="ccBeams"></div>
      <div class="cc-tilt" id="ccTilt"><div class="cc-shell" id="ccShell">
        <div class="cc-back" id="ccBack"></div>
        <div class="cc-photo" id="ccFace" role="img" aria-label="Foto dell'artista"></div>
        <div class="cc-fade"></div>
        <div class="cc-top"><div class="cc-ovr" id="ccOvr"></div><div class="cc-pos" id="ccPos"></div><div class="cc-num" id="ccNum"></div></div>
        <div class="cc-body">
          <div class="cc-name" id="ccName"></div>
          <div class="cc-tier" id="ccTier"></div>
          <div class="cc-stats" id="ccStats"></div>
          <dl class="cc-gen" id="ccGen"></dl>
        </div>
      </div>
      </div>
      <div class="cc-caption" id="ccCap"></div>
      <div class="cc-sparks" id="ccSparks" aria-hidden="true"></div>
    </div>
`;

export const CONTROLS_HTML = `<div class="regia">
    <div class="group">
      <span class="lbl" id="lblPeriodo">Periodo</span>
      <div class="seg" role="group" aria-labelledby="lblPeriodo" id="segPeriodo">
        <button id="p-short" data-v="short" aria-pressed="true">4 settimane</button>
        <button id="p-medium" data-v="medium" aria-pressed="false">6 mesi</button>
        <button id="p-long" data-v="long" aria-pressed="false">1 anno</button>
      </div>
    </div>
    <div class="group">
      <span class="lbl" id="lblModulo">Modulo</span>
      <div class="seg" role="group" aria-labelledby="lblModulo" id="segModulo">
        <button id="m-433" data-v="433" aria-pressed="true">4-3-3</button>
        <button id="m-442" data-v="442" aria-pressed="false">4-4-2</button>
        <button id="m-352" data-v="352" aria-pressed="false">3-5-2</button>
      </div>
    </div>
    <div class="group">
      <span class="lbl" id="lblFormato">Cosa condividi</span>
      <div class="seg" role="group" aria-labelledby="lblFormato" id="segFormato">
        <button id="f-partita" data-v="partita" aria-pressed="true">La partita</button>
        <button id="f-carta" data-v="carta" aria-pressed="false">Carta del capitano</button>
      </div>
    </div>
    <div class="group">
      <span class="lbl" id="lblStile">Stile della storia</span>
      <div class="styles" role="group" aria-labelledby="lblStile" id="segStile">
        <button id="s-notte" data-v="notte" aria-pressed="true"><span class="sw" style="background:linear-gradient(#0c331e,#070d0b);box-shadow:inset 0 -10px 0 #ffb21a"></span><span>Notturna<small>Diretta TV, LED</small></span></button>
        <button id="s-figurine" data-v="figurine" aria-pressed="false"><span class="sw" style="background:linear-gradient(#f1e4c4 0 30%,#5c9a46 30% 80%,#c0261c 80%)"></span><span>Figurine<small>Album anni '80</small></span></button>
        <button id="s-lavagna" data-v="lavagna" aria-pressed="false"><span class="sw" style="background:#26322d;box-shadow:inset 0 0 0 3px #6b4a2b"></span><span>Lavagna<small>Tattica del mister</small></span></button>
        <button id="s-arcade" data-v="arcade" aria-pressed="false"><span class="sw" style="background:repeating-conic-gradient(#2fa84f 0 25%,#120f3a 0 50%) 0 0/10px 10px;border-radius:0"></span><span>Arcade<small>Videogioco 8 bit</small></span></button>
      </div>
    </div>
    <button class="sound" id="btnSound" aria-pressed="false"><span class="bars"><i></i><i></i><i></i></span><span id="soundLbl">Attiva i suoni</span></button>
    <div class="group" id="grpCarta" hidden>
      <label for="ccPlayer">Giocatore della carta</label>
      <select id="ccPlayer"></select>
      <button class="btn alt" id="btnReplay" style="align-self:flex-start">Rigioca l'apertura</button>
      <div class="howto"><b>DA DOVE VENGONO I NUMERI DI <span id="ccHowName"></span></b>
        <ul id="ccHow"></ul>
        FED, RIP, LIB e HIT sono relativi alla tua squadra del periodo: il titolare con il valore più alto prende 99, chi ha zero prende 40.
        DIS e CAR vengono dalla discografia (<code>/artists/{id}/albums</code>); se Spotify non la fornisce compare un trattino e non contano nella valutazione.
      </div>
    </div>
    <div class="group">
      <label for="teamName">Nome della squadra</label>
      <input type="text" id="teamName" value="" maxlength="18" placeholder="La mia squadra">
    </div>
    <div class="btns">
      <button class="btn" id="btnAzione">Fai partire l'azione</button>
      <button class="btn alt" id="btnCambio">Prossimo cambio</button>
    </div>
    <label class="toggle"><input type="checkbox" id="auto" checked> Azioni e cambi automatici</label>
    <div class="group">
      <span class="lbl">Scheda giocatore</span>
      <div class="scheda" id="scheda"></div>
    </div>
    <p class="note">Tocca un giocatore per la sua scheda. Il numero di maglia è la posizione nella classifica degli artisti più ascoltati del periodo. Il capitano (C) è il numero 1 e segna sempre lui.</p>
</div>`;
