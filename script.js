// script.js (editado)
// Mejoras principales:
// - populateBackground ahora usa la función placeItems para evitar amontonamientos
//   y agrega los elementos dentro de #bgTridents y #bgEmojis (no al body).
// - los elementos de fondo usan clases diferenciadas ('trident' / 'emoji') y estilos
//   inline para tamaño/rotación/opacidad.
// - limpieza y pequeñas defensas al regenerar el fondo en resize.
// - mantiene la lógica del juego tal como la tenías.

const cpuName = 'NEXUS';
const WIN_COMBINATIONS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];
const MAX_PLAYS = 3;
const STORAGE_KEY = 'tatetiState_v2';
const INTRO_DURATION = 2400;

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
let introOverlay, loadingBar, loadingText, opponentBanner, pickX, pickO, startBtn, restartBtn;
let playerWinsEl, cpuWinsEl, playerBonusPercentEl, cpuBonusPercentEl, playsLeftEl;
let resultModal, modalPercent, modalMessage, modalClose;
let boardLogo, bgTridents, bgEmojis;

// util
function symbolToEmoji(sym){
  if(sym === 'X') return '❌';
  if(sym === 'O') return '⭕';
  return sym;
}

// Debounce helper
function debounce(fn, wait=120){
  let t;
  return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), wait); };
}

// --- random background generation ---
// placeItems: coloca 'count' elementos mediante createElementFactory, evitando colisiones
function populateBackground(){
  bgTridents = document.getElementById('bgTridents');
  bgEmojis = document.getElementById('bgEmojis');
  if(!bgTridents || !bgEmojis) return;

  // clear previous
  bgTridents.innerHTML = '';
  bgEmojis.innerHTML = '';

  const W = Math.max(window.innerWidth, 800);
  const H = Math.max(window.innerHeight, 600);

  // helper: test distance from existing points
  function tooClose(x,y,placed,minDist){
    for(const p of placed){
      const dx = p.x - x;
      const dy = p.y - y;
      if(Math.hypot(dx,dy) < minDist) return true;
    }
    return false;
  }

  // generic placer
  function placeItems(count, minDist, createNode, container){
    const placed = [];
    const padding = 24;
    for(let i=0;i<count;i++){
      let attempts = 0;
      let x = 0, y = 0;
      do {
        x = Math.random() * (W - padding*2) + padding;
        y = Math.random() * (H - padding*2) + padding;
        attempts++;
      } while(tooClose(x,y,placed,minDist) && attempts < 40);
      placed.push({x,y});
      const node = createNode(x,y,i);
      // absolute positioned element inside container (container is fixed inset:0)
      node.style.position = 'absolute';
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.style.pointerEvents = 'none';
      container.appendChild(node);
    }
    return placed;
  }

  // create trident nodes
  const tridentCount = Math.round(Math.max(8, Math.min(22, (W*H)/(200000))));
  placeItems(tridentCount, 90, (x,y,i) => {
    const size = 10 + Math.floor(Math.random()*20); // 10-30px
    const opacity = (0.04 + Math.random()*0.08).toFixed(3); // 0.04-0.12
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
  }, bgTridents);

  // create emoji nodes
  const emojis = ['⭕','❌','🎁','✨'];
  const emojiCount = Math.round(Math.max(10, Math.min(20, (W*H)/(180000))));
  placeItems(emojiCount, 80, (x,y,i) => {
    const size = 16 + Math.floor(Math.random()*38); // 16-54
    const opacity = (0.03 + Math.random()*0.08).toFixed(3); // 0.03-0.11
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
  }, bgEmojis);

  // ensure bg layers are behind main container (they are fixed with z-index 0)
  bgTridents.style.zIndex = 0;
  bgEmojis.style.zIndex = 0;
}

// --- Game code (robust) ---
// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  boardEl = document.getElementById('board');
  cells = Array.from(document.querySelectorAll('.cell'));
  messageEl = document.getElementById('message');

  introOverlay = document.getElementById('introOverlay');
  loadingBar = document.getElementById('loadingBar');
  loadingText = document.getElementById('loadingText');

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
  bgTridents = document.getElementById('bgTridents');
  bgEmojis = document.getElementById('bgEmojis');

  if(!boardEl || !cells.length || !messageEl){
    console.error('FATAL: elementos del tablero faltantes.');
    return;
  }

  // populate background initially
  populateBackground();
  // regenerate on resize (debounced)
  window.addEventListener('resize', debounce(()=>{
    if(bgTridents) bgTridents.innerHTML = '';
    if(bgEmojis) bgEmojis.innerHTML = '';
    populateBackground();
  }, 220));

  // UI listeners
  if(pickX) pickX.addEventListener('click', () => onPick('X'));
  if(pickO) pickO.addEventListener('click', () => onPick('O'));
  if(restartBtn) restartBtn.addEventListener('click', resetGame);
  if(modalClose) modalClose.addEventListener('click', hideModal);
  cells.forEach(c => c.addEventListener('click', onCellClick));

  // keyboard
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
    showIntroThenBanner();
  }

  attachStartListener();

  // debug
  console.debug('Background populated and init done');
});

// --- small helpers to show/hide the board logo below the grid ---
function showBoardLogo(){
  if(!boardLogo) return;
  boardLogo.classList.remove('hidden');
  boardLogo.style.display = 'block';
}
function hideBoardLogo(){
  if(!boardLogo) return;
  boardLogo.classList.add('hidden');
  boardLogo.style.display = 'none';
}

// --- Start listener (robust) ---
let _startHandler = null;
function attachStartListener(){
  if(!startBtn) return;
  startBtn.type = 'button';
  if(_startHandler) startBtn.removeEventListener('click', _startHandler);
  _startHandler = ()=>{ hideBanner(); startGame(); };
  startBtn.addEventListener('click', _startHandler);
  startBtn.disabled = false;
  startBtn.classList.remove('disabled');
}

// --- intro/banner flow (uses loading bar) ---
function showIntroThenBanner(){
  showIntro();
  startLoadingBar(INTRO_DURATION).then(()=> {
    if(state.plays >= MAX_PLAYS){
      hideIntro();
      hideBanner();
      return;
    }
    hideIntro();
    setTimeout(()=> showBanner(), 160);
  });
}
function showIntro(){
  if(!introOverlay) return;
  introOverlay.classList.remove('hidden');
  introOverlay.setAttribute('aria-hidden','false');
  if(opponentBanner) opponentBanner.classList.add('hidden');
  hideBoardLogo();
  if(loadingBar) loadingBar.style.width = '0%';
  if(loadingText) loadingText.textContent = 'Cargando el juego...';
}
function hideIntro(){
  if(!introOverlay) return;
  introOverlay.classList.add('hidden');
  introOverlay.setAttribute('aria-hidden','true');
}
function startLoadingBar(duration){
  return new Promise(resolve=>{
    if(!loadingBar){ setTimeout(resolve, duration); return; }
    const start = performance.now();
    function tick(now){
      const elapsed = now - start;
      const pct = Math.min(1, elapsed / duration);
      loadingBar.style.width = (pct * 100) + '%';
      if(loadingText) loadingText.textContent = `Cargando el juego... ${Math.round(pct*100)}%`;
      if(pct < 1) requestAnimationFrame(tick);
      else setTimeout(()=> { if(loadingText) loadingText.textContent = 'Listo'; resolve(); }, 220);
    }
    requestAnimationFrame(tick);
  });
}

// --- banner control ---
function showBanner(){ if(!opponentBanner) return; opponentBanner.classList.remove('hidden'); opponentBanner.setAttribute('aria-hidden','false'); attachStartListener(); }
function hideBanner(){ if(!opponentBanner) return; opponentBanner.classList.add('hidden'); opponentBanner.setAttribute('aria-hidden','true'); }

// --- storage / UI helpers (same) ---
function loadState(){ try { const raw = localStorage.getItem(STORAGE_KEY); if(raw) state = JSON.parse(raw); } catch(e){ state = { playerWins:0, cpuWins:0, plays:0 }; } updateScoreboardUI(); updatePlaysUI(); checkPlaysLimitUI(); }
function saveState(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){} }
function updateScoreboardUI(){ if(playerWinsEl) playerWinsEl.textContent = `${state.playerWins} / ${MAX_PLAYS}`; if(cpuWinsEl) cpuWinsEl.textContent = `${state.cpuWins} / ${MAX_PLAYS}`; if(playerBonusPercentEl) playerBonusPercentEl.textContent = `Bono: ${bonusPercent(state.playerWins)}%`; if(cpuBonusPercentEl) cpuBonusPercentEl.textContent = `Bono: ${bonusPercent(state.cpuWins)}%`; }
function updatePlaysUI(){ if(playsLeftEl) playsLeftEl.textContent = Math.max(0, MAX_PLAYS - state.plays); }
function bonusPercent(wins){ if(wins<=0) return 0; if(wins===1) return 100; if(wins===2) return 150; return 200; }
function checkPlaysLimitUI(){
  if(!startBtn) return;
  if(state.plays >= MAX_PLAYS){
    startBtn.disabled = true;
    startBtn.classList.add('disabled');
    message('Has alcanzado el máximo de 3 partidas por dispositivo.');
    hideBanner();
    hideIntro();
    hideBoardLogo();
  } else {
    if(sessionStarted){ startBtn.disabled = true; startBtn.classList.add('disabled'); }
    else { startBtn.disabled = false; startBtn.classList.remove('disabled'); }
  }
}
function setActiveChoice(){ if(!pickX || !pickO) return; pickX.classList.toggle('active', playerSymbol === 'X'); pickO.classList.toggle('active', playerSymbol === 'O'); }

// --- picks / board UI ---
function onPick(sym){ if(sessionStarted) return; if(sym === 'X'){ playerSymbol='X'; cpuSymbol='O'; } else { playerSymbol='O'; cpuSymbol='X'; } setActiveChoice(); }
function resetBoardUI(){ cells.forEach(c => { c.innerHTML = ''; c.classList.remove('disabled','win'); c.disabled = false; }); }

// --- game logic (same behavior) ---
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
  const el = e.currentTarget;
  const idx = Number(el.dataset.index);
  if(Number.isNaN(idx)) return;
  if(board[idx]) return;
  if(currentTurn !== playerSymbol) return;

  makeMove(idx, playerSymbol);
  afterMove();

  setTimeout(()=>{
    if(running && !cpuThinking && currentTurn === cpuSymbol){
      doCpuTurn();
    }
  }, 350);
}

function makeMove(index, symbol){
  board[index] = symbol;
  const cell = cells[index];
  if(cell){
    cell.innerHTML = `<span>${symbolToEmoji(symbol)}</span>`;
    cell.classList.add('disabled');
  }
}

function afterMove(){
  const winner = checkWinner(board);
  if(winner){ handleEnd(winner); return; }
  currentTurn = currentTurn === 'X' ? 'O' : 'X';
  if(running && currentTurn === cpuSymbol) doCpuTurn();
}

// CPU
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

// winner / end
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

// modal
function showModal(){ if(resultModal) resultModal.classList.remove('hidden'); }
function hideModal(){ if(resultModal) resultModal.classList.add('hidden'); }

// utilities
function message(text){ if(messageEl) messageEl.textContent = text; }
function bonusPercent(wins){ if(wins<=0) return 0; if(wins===1) return 100; if(wins===2) return 150; return 200; }

