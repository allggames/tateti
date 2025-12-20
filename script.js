// script.js (editado — listo para copiar/pegar)
// Cambios principales:
// - Se asegura que la barra de carga funcione y, al terminar, oculte el intro y muestre el cartel NEXUS.
// - Se generan 🔱 (tridentes) en la pantalla de INTRO específicamente (dentro de #introOverlay).
// - populateBackground mantiene los iconos dispersos en el fondo general.
// - Logging adicional para depuración (console.debug).

const cpuName = 'NEXUS';
const WIN_COMBINATIONS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];
const MAX_PLAYS = 3;
const STORAGE_KEY = 'tatetiState_v2';
const INTRO_DURATION = 1800; // ms (ajustá si querés más/menos tiempo en la intro)

let board = Array(9).fill(null);
let playerSymbol = 'X';
let cpuSymbol = 'O';
let currentTurn = 'X';
let running = false;
let cpuThinking = false;
let sessionStarted = false;
let state = { playerWins: 0, cpuWins: 0, plays: 0 };

// DOM refs
let boardEl, cells, messageEl;
let introOverlay, introParticlesContainer, loadingBar, loadingText;
let opponentBanner, pickX, pickO, startBtn, restartBtn;
let playerWinsEl, cpuWinsEl, playerBonusPercentEl, cpuBonusPercentEl, playsLeftEl;
let resultModal, modalPercent, modalMessage, modalClose;
let boardLogo, bgTridents, bgEmojis;

function symbolToEmoji(sym){
  if(sym === 'X') return '❌';
  if(sym === 'O') return '⭕';
  return sym;
}

function debounce(fn, wait=120){
  let t;
  return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), wait); };
}

/* ------------------- BACKGROUND (global) ------------------- */
function populateBackground(){
  bgTridents = document.getElementById('bgTridents');
  bgEmojis = document.getElementById('bgEmojis');

  // If not present, create them and append to body (backward-compatibility)
  if(!bgTridents){
    bgTridents = document.createElement('div');
    bgTridents.id = 'bgTridents';
    document.body.appendChild(bgTridents);
  }
  if(!bgEmojis){
    bgEmojis = document.createElement('div');
    bgEmojis.id = 'bgEmojis';
    document.body.appendChild(bgEmojis);
  }

  bgTridents.innerHTML = '';
  bgEmojis.innerHTML = '';

  const W = Math.max(window.innerWidth, 800);
  const H = Math.max(window.innerHeight, 600);

  // small helper to place items with minimal collisions
  function placeItems(container, count, minDist, factory){
    const placed = [];
    const padding = 24;
    for(let i=0;i<count;i++){
      let attempts = 0;
      let x, y;
      let ok;
      do {
        x = Math.random() * (W - padding*2) + padding;
        y = Math.random() * (H - padding*2) + padding;
        ok = true;
        for(const p of placed){
          if(Math.hypot(p.x - x, p.y - y) < minDist){ ok = false; break; }
        }
        attempts++;
      } while(!ok && attempts < 40);
      placed.push({x,y});
      const node = factory(x,y,i);
      node.style.position = 'absolute';
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.style.pointerEvents = 'none';
      container.appendChild(node);
    }
  }

  const tridentCount = Math.round(Math.max(8, Math.min(22, (W*H)/(200000))));
  placeItems(bgTridents, tridentCount, 90, (x,y,i) => {
    const size = 10 + Math.floor(Math.random()*20);
    const opacity = (0.04 + Math.random()*0.08).toFixed(3);
    const rot = (-12 + Math.random()*24).toFixed(1);
    const span = document.createElement('div');
    span.className = 'bg-item trident';
    span.textContent = '🔱';
    span.style.fontSize = `${size}px`;
    span.style.opacity = opacity;
    span.style.transform = `rotate(${rot}deg)`;
    span.style.zIndex = 0;
    span.style.filter = 'blur(.2px)';
    return span;
  });

  const emojis = ['⭕','❌','🎁','✨'];
  const emojiCount = Math.round(Math.max(10, Math.min(20, (W*H)/(180000))));
  placeItems(bgEmojis, emojiCount, 80, (x,y,i) => {
    const size = 16 + Math.floor(Math.random()*38);
    const opacity = (0.03 + Math.random()*0.08).toFixed(3);
    const rot = (-25 + Math.random()*50).toFixed(1);
    const span = document.createElement('div');
    span.className = 'bg-item emoji';
    span.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    span.style.fontSize = `${size}px`;
    span.style.opacity = opacity;
    span.style.transform = `rotate(${rot}deg)`;
    span.style.zIndex = 0;
    span.style.filter = 'blur(.25px)';
    return span;
  });

  bgTridents.style.zIndex = 0;
  bgEmojis.style.zIndex = 0;
}

/* ------------------- INTRO PARTICLES (inside intro) ------------------- */
function populateIntroParticles(){
  // We create tridents around the intro logo area, inside the intro overlay.
  if(!introOverlay) return;

  // find or create container
  introParticlesContainer = document.getElementById('introParticles');
  if(!introParticlesContainer){
    introParticlesContainer = document.createElement('div');
    introParticlesContainer.id = 'introParticles';
    introParticlesContainer.style.position = 'absolute';
    introParticlesContainer.style.inset = '0';
    introParticlesContainer.style.pointerEvents = 'none';
    introOverlay.appendChild(introParticlesContainer);
  }
  introParticlesContainer.innerHTML = '';

  const rect = introOverlay.getBoundingClientRect();
  const W = Math.max(600, rect.width);
  const H = Math.max(300, rect.height);

  const count = 12; // fixed number for intro
  for(let i=0;i<count;i++){
    const size = 14 + Math.round(Math.random()*22); // 14-36
    const opacity = 0.06 + Math.random()*0.08; // 0.06-0.14
    const rot = (-20 + Math.random()*40).toFixed(1);
    // random position biased towards center
    const px = (rect.width/2) + (Math.random()-0.5) * rect.width * 0.9;
    const py = (rect.height/2) + (Math.random()-0.5) * rect.height * 0.7;

    const span = document.createElement('div');
    span.className = 'bg-item trident';
    span.textContent = '🔱';
    span.style.position = 'absolute';
    span.style.left = `${Math.max(8, px)}px`;
    span.style.top = `${Math.max(8, py)}px`;
    span.style.fontSize = `${size}px`;
    span.style.opacity = `${opacity}`;
    span.style.transform = `rotate(${rot}deg)`;
    span.style.filter = 'blur(.2px)';
    introParticlesContainer.appendChild(span);
  }
}

/* ------------------- Game logic & flow (robust) ------------------- */
function attachStartListener(){
  if(!startBtn) return;
  startBtn.type = 'button';
  // remove previous if any
  try { startBtn.removeEventListener('click', startBtn._handler); } catch(e){}
  startBtn._handler = () => { hideBanner(); startGame(); };
  startBtn.addEventListener('click', startBtn._handler);
  startBtn.disabled = false;
  startBtn.classList.remove('disabled');
  console.debug('attachStartListener: attached');
}

function showIntroThenBanner(){
  showIntro();
  // populate intro particles each time we show intro
  populateIntroParticles();
  // start loading bar animation and then transition
  startLoadingBar(INTRO_DURATION).then(()=> {
    if(state.plays >= MAX_PLAYS){
      hideIntro();
      hideBanner();
      return;
    }
    hideIntro();
    setTimeout(()=> {
      attachStartListener();
      showBanner();
    }, 160);
  }).catch(err => {
    console.error('startLoadingBar error', err);
    // fallback: still hide intro and show banner
    hideIntro();
    setTimeout(()=> { attachStartListener(); showBanner(); }, 160);
  });
}

function showIntro(){
  if(!introOverlay) return;
  introOverlay.classList.remove('hidden');
  introOverlay.setAttribute('aria-hidden', 'false');
  if(opponentBanner) opponentBanner.classList.add('hidden');
  hideBoardLogo();
  if(loadingBar) loadingBar.style.width = '0%';
  if(loadingText) loadingText.textContent = 'Cargando el juego...';
  console.debug('showIntro: shown');
}

function hideIntro(){
  if(!introOverlay) return;
  introOverlay.classList.add('hidden');
  introOverlay.setAttribute('aria-hidden', 'true');
  console.debug('hideIntro: hidden');
}

// loading bar animation returns a Promise
function startLoadingBar(duration){
  return new Promise((resolve) => {
    if(!loadingBar || !loadingText){
      // if missing, wait duration then resolve
      setTimeout(resolve, duration);
      return;
    }
    const start = performance.now();
    function step(now){
      const elapsed = now - start;
      const pct = Math.min(1, elapsed / duration);
      loadingBar.style.width = `${Math.round(pct*100)}%`;
      loadingText.textContent = `Cargando el juego... ${Math.round(pct*100)}%`;
      if(pct < 1) requestAnimationFrame(step);
      else {
        loadingText.textContent = 'Listo';
        setTimeout(resolve, 220);
      }
    }
    requestAnimationFrame(step);
  });
}

/* Banner helpers */
function showBanner(){ if(!opponentBanner) return; opponentBanner.classList.remove('hidden'); opponentBanner.setAttribute('aria-hidden','false'); attachStartListener(); console.debug('showBanner'); }
function hideBanner(){ if(!opponentBanner) return; opponentBanner.classList.add('hidden'); opponentBanner.setAttribute('aria-hidden','true'); }

/* background initial & resize */
document.addEventListener('DOMContentLoaded', ()=> {
  // cache DOM refs that might be used by populateBackground/intro
  bgTridents = document.getElementById('bgTridents');
  bgEmojis = document.getElementById('bgEmojis');
  introOverlay = document.getElementById('introOverlay');
  loadingBar = document.getElementById('loadingBar');
  loadingText = document.getElementById('loadingText');

  // generate background icons
  populateBackground();
  // regenerate on resize
  window.addEventListener('resize', debounce(()=> {
    try {
      if(bgTridents) bgTridents.innerHTML = '';
      if(bgEmojis) bgEmojis.innerHTML = '';
      populateBackground();
      // also reposition intro particles if visible
      if(introOverlay && !introOverlay.classList.contains('hidden')){
        populateIntroParticles();
      }
    } catch(e){ console.error(e); }
  }, 220));
});

/* ---------- Init main UI & game (keeps behavior) ---------- */
document.addEventListener('DOMContentLoaded', () => {
  // game elements
  boardEl = document.getElementById('board');
  cells = Array.from(document.querySelectorAll('.cell'));
  messageEl = document.getElementById('message');

  opponentBanner = document.getElementById('opponentBanner');
  pickX = document.getElementById('pickX');
  pickO = document.getElementById('pickO');
  startBtn = document.getElementById('startBtn');
  restartBtn = document.getElementById('restartBtn');

  playerWinsEl = document.getElementById('playerWins');
  cpuWinsEl = document.getElementById('cpuWins');
  playerBonusPercentEl = document.getElementById('playerBonusPercent');
  cpuBonusPercentEl = document.getElementById('cpuBonusPercent');
  playsLeftEl = document.getElementById('playsLeft');

  resultModal = document.getElementById('resultModal');
  modalPercent = document.getElementById('modalPercent');
  modalMessage = document.getElementById('modalMessage');
  modalClose = document.getElementById('modalClose');

  boardLogo = document.getElementById('boardLogo');

  if(!boardEl || !cells.length || !messageEl){
    console.error('FATAL: elementos del tablero faltantes.');
    return;
  }

  // UI listeners
  if(pickX) pickX.addEventListener('click', () => onPick('X'));
  if(pickO) pickO.addEventListener('click', () => onPick('O'));
  if(restartBtn) restartBtn.addEventListener('click', resetGame);
  if(modalClose) modalClose.addEventListener('click', hideModal);
  cells.forEach(c => c.addEventListener('click', onCellClick));

  document.addEventListener('keydown', (e)=> {
    if(e.key === 'Enter' && !sessionStarted && opponentBanner && !opponentBanner.classList.contains('hidden')){
      hideBanner();
      startGame();
    }
  });

  setActiveChoice();
  loadState();
  resetBoardUI();

  if(state.plays >= MAX_PLAYS){
    hideIntro();
    hideBanner();
    hideBoardLogo();
  } else {
    // show intro then banner (this will also populate intro tridents)
    showIntroThenBanner();
  }

  attachStartListener();
  console.debug('Game init done');
});

/* ---------- Remaining game logic (unchanged) ---------- */

function showBoardLogo(){ if(!boardLogo) return; boardLogo.classList.remove('hidden'); boardLogo.style.display = 'block'; }
function hideBoardLogo(){ if(!boardLogo) return; boardLogo.classList.add('hidden'); boardLogo.style.display = 'none'; }

function loadState(){ try { const raw = localStorage.getItem(STORAGE_KEY); if(raw) state = JSON.parse(raw); } catch(e){ state = { playerWins:0, cpuWins:0, plays:0 }; } updateScoreboardUI(); updatePlaysUI(); checkPlaysLimitUI(); }
function saveState(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){} }
function updateScoreboardUI(){ if(playerWinsEl) playerWinsEl.textContent = `${state.playerWins} / ${MAX_PLAYS}`; if(cpuWinsEl) cpuWinsEl.textContent = `${state.cpuWins} / ${MAX_PLAYS}`; if(playerBonusPercentEl) playerBonusPercentEl.textContent = `Bono: ${bonusPercent(state.playerWins)}%`; if(cpuBonusPercentEl) cpuBonusPercentEl.textContent = `Bono: ${bonusPercent(state.cpuWins)}%`; }
function updatePlaysUI(){ if(playsLeftEl) playsLeftEl.textContent = Math.max(0, MAX_PLAYS - state.plays); }
function bonusPercent(wins){ if(wins<=0) return 0; if(wins===1) return 100; if(wins===2) return 150; return 200; }
function checkPlaysLimitUI(){ if(!startBtn) return; if(state.plays >= MAX_PLAYS){ startBtn.disabled = true; startBtn.classList.add('disabled'); message('Has alcanzado el máximo de 3 partidas por dispositivo.'); hideBanner(); hideIntro(); hideBoardLogo(); } else { if(sessionStarted){ startBtn.disabled = true; startBtn.classList.add('disabled'); } else { startBtn.disabled = false; startBtn.classList.remove('disabled'); } } }
function setActiveChoice(){ if(!pickX || !pickO) return; pickX.classList.toggle('active', playerSymbol === 'X'); pickO.classList.toggle('active', playerSymbol === 'O'); }

function onPick(sym){ if(sessionStarted) return; if(sym === 'X'){ playerSymbol='X'; cpuSymbol='O'; } else { playerSymbol='O'; cpuSymbol='X'; } setActiveChoice(); }
function resetBoardUI(){ cells.forEach(c => { c.innerHTML = ''; c.classList.remove('disabled','win'); c.disabled = false; }); }

function startGame(){
  if(state.plays >= MAX_PLAYS){ message('No puedes comenzar: alcanzaste el límite de 3 partidas por dispositivo.'); return; }
  sessionStarted = true;
  checkPlaysLimitUI();
  resetBoardUI();
  board = Array(9).fill(null);
  currentTurn = playerSymbol;
  running = true;
  cpuThinking = false;
  message(`Juego iniciado — Tú: ${symbolToEmoji(playerSymbol)}  |  ${cpuName}: ${symbolToEmoji(cpuSymbol)}`);
  showBoardLogo();
}

function resetGame(){
  running = false;
  cpuThinking = false;
  board = Array(9).fill(null);
  resetBoardUI();
  if(sessionStarted && state.plays < MAX_PLAYS){
    currentTurn = playerSymbol;
    running = true;
    message('Partida reiniciada — continúa la serie');
    showBoardLogo();
  } else {
    sessionStarted = false;
    showIntroThenBanner();
    message('Juego reiniciado. Mostrando presentación...');
    hideBoardLogo();
  }
}

function onCellClick(e){
  if(!running || cpuThinking) return;
  const idx = Number(e.currentTarget.dataset.index);
  if(Number.isNaN(idx)) return;
  if(board[idx]) return;
  if(currentTurn !== playerSymbol) return;

  makeMove(idx, playerSymbol);
  afterMove();

  setTimeout(()=>{
    if(running && !cpuThinking && currentTurn === cpuSymbol) doCpuTurn();
  }, 350);
}

function makeMove(index, symbol){
  board[index] = symbol;
  const cell = cells[index];
  if(cell){ cell.innerHTML = `<span>${symbolToEmoji(symbol)}</span>`; cell.classList.add('disabled'); }
}

function afterMove(){
  const winner = checkWinner(board);
  if(winner){ handleEnd(winner); return; }
  currentTurn = currentTurn === 'X' ? 'O' : 'X';
  if(running && currentTurn === cpuSymbol) doCpuTurn();
}

function doCpuTurn(){
  cpuThinking = true;
  message(`${cpuName} está pensando...`);
  setTimeout(()=>{
    const move = cpuVeryEasyMove();
    if(move !== undefined && move !== null) makeMove(move, cpuSymbol);
    cpuThinking = false;
    afterMove();
  }, 420);
}
function cpuVeryEasyMove(){
  const blockProb = 0.30;
  const heurProb = 0.05;
  const block = findWinningMove(board, playerSymbol);
  if(block !== null && Math.random() < blockProb) return block;
  if(Math.random() < heurProb){
    if(board[4] === null) return 4;
    const corners = [0,2,6,8].filter(i => board[i] === null);
    if(corners.length) return corners[Math.floor(Math.random()*corners.length)];
    const sides = [1,3,5,7].filter(i => board[i] === null);
    if(sides.length) return sides[Math.floor(Math.random()*sides.length)];
  }
  return cpuRandomMove();
}
function cpuRandomMove(){ const avail = availableMoves(board); if(avail.length === 0) return null; return avail[Math.floor(Math.random()*avail.length)]; }
function availableMoves(b){ return b.map((v,i)=> v===null?i:null).filter(v=>v!==null); }
function findWinningMove(b, symbol){ for(const i of availableMoves(b)){ b[i] = symbol; const w = checkWinner(b); b[i] = null; if(w === symbol) return i; } return null; }

function checkWinner(b){ for(const [a,b1,c] of WIN_COMBINATIONS){ if(b[a] && b[a] === b[b1] && b[a] === b[c]) return b[a]; } if(b.every(v=>v!==null)) return 'D'; return null; }

function handleEnd(winner){
  running = false;
  if(state.plays < MAX_PLAYS) state.plays += 1;
  if(winner === 'D') message('Empate 🙃 — no hay bono adicional');
  else {
    if(winner === playerSymbol){ state.playerWins = Math.min(MAX_PLAYS, state.playerWins + 1); message(`¡Ganaste esta partida! 🎉`); }
    else { state.cpuWins = Math.min(MAX_PLAYS, state.cpuWins + 1); message(`${cpuName} gana esta partida 😢`); }
    for(const [a,b,c] of WIN_COMBINATIONS){
      if(board[a] && board[a] === board[b] && board[a] === board[c]){
        if(cells[a]) cells[a].classList.add('win');
        if(cells[b]) cells[b].classList.add('win');
        if(cells[c]) cells[c].classList.add('win');
        break;
      }
    }
  }
  cells.forEach(c=>c.classList.add('disabled'));
  saveState();
  updateScoreboardUI();
  updatePlaysUI();
  checkPlaysLimitUI();

  if(state.plays < MAX_PLAYS){
    setTimeout(()=>{
      board = Array(9).fill(null);
      resetBoardUI();
      currentTurn = playerSymbol;
      running = true;
      message(`Siguiente partida iniciada — Partida ${state.plays + 1} de ${MAX_PLAYS}`);
      showBoardLogo();
    }, 900);
  } else {
    setTimeout(()=>{
      const bp = bonusPercent(state.playerWins);
      if(modalPercent) modalPercent.textContent = `${bp}%`;
      if(modalMessage) modalMessage.textContent = (bp>0) ? `Has obtenido ${bp}% por ${state.playerWins} victoria(s).` : `No obtuviste bono (0 victorias).`;
      showModal();
      hideBoardLogo();
    }, 700);
  }
}

function showModal(){ if(resultModal) resultModal.classList.remove('hidden'); }
function hideModal(){ if(resultModal) resultModal.classList.add('hidden'); }

function message(text){ if(messageEl) messageEl.textContent = text; }
function bonusPercent(wins){ if(wins<=0) return 0; if(wins===1) return 100; if(wins===2) return 150; return 200; }
