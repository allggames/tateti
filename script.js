// Tatetí - Jugador vs NEXUS (CPU)
// Intro ahora se muestra como pantalla de inicio y se auto-oculta después de un tiempo.
// Al ocultar el intro salta directamente el cartel "HOY JUGARÁS CONTRA NEXUS".

// Config
const cpuName = 'NEXUS';
const WIN_COMBINATIONS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];
const MAX_PLAYS = 3;
const STORAGE_KEY = 'tatetiState_v2';
const INTRO_DURATION = 1800; // ms que dura la pantalla de inicio antes de pasar al cartel

// Estado runtime y persistente
let board = Array(9).fill(null);
let playerSymbol = 'X'; // usuario = ❌
let cpuSymbol = 'O';    // NEXUS = ⭕
let currentTurn = 'X';
let running = false;
let cpuThinking = false;
let sessionStarted = false;
let state = { playerWins: 0, cpuWins: 0, plays: 0 };

// Elementos DOM
let boardEl, cells, messageEl;
let introOverlay, opponentBanner, pickX, pickO, startBtn, restartBtn;
let playerWinsEl, cpuWinsEl, playerBonusPercentEl, cpuBonusPercentEl, playsLeftEl;
let resultModal, modalPercent, modalMessage, modalClose;
let footerLogo;

// Map internal symbol to emoji
function symbolToEmoji(sym){
  if(sym === 'X') return '❌';
  if(sym === 'O') return '⭕';
  return sym;
}

// DOMContentLoaded init
document.addEventListener('DOMContentLoaded', () => {
  boardEl = document.getElementById('board');
  cells = Array.from(document.querySelectorAll('.cell'));
  messageEl = document.getElementById('message');

  introOverlay = document.getElementById('introOverlay');

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

  footerLogo = document.getElementById('footerLogo');

  // Safety
  if(!boardEl || !cells.length || !messageEl){
    console.error('Elementos del tablero faltantes. Revisá el HTML.');
    return;
  }

  // Picks
  if(pickX) pickX.addEventListener('click', () => onPick('X'));
  if(pickO) pickO.addEventListener('click', () => onPick('O'));

  // Banner / start
  if(startBtn) startBtn.addEventListener('click', () => {
    hideBanner();
    startGame();
  });

  if(restartBtn) restartBtn.addEventListener('click', resetGame);

  // Modal close
  if(modalClose) modalClose.addEventListener('click', hideModal);

  // Cells
  cells.forEach(c => c.addEventListener('click', onCellClick));

  // keyboard
  document.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      // si intro visible: ignora (auto-hide)
      if(!sessionStarted && opponentBanner && !opponentBanner.classList.contains('hidden')){
        hideBanner();
        startGame();
      }
    }
  });

  // Init UI / state
  setActiveChoice();
  loadState();
  resetBoardUI();

  // Show intro first (unless series completed)
  if(state.plays >= MAX_PLAYS){
    hideIntro();
    hideBanner();
    hideFooterLogo();
  } else {
    showIntroThenBanner();
  }

  message('Tocá "Comenzar" para iniciar la serie');
});

// --------- intro / banner flow ----------
function showIntroThenBanner(){
  showIntro();
  // auto-hide intro after INTRO_DURATION and show the opponent banner
  setTimeout(() => {
    // If user already completed the series while intro shown, skip
    if(state.plays >= MAX_PLAYS){
      hideIntro();
      hideBanner();
      return;
    }
    hideIntro();
    // a small delay to ensure hide animation looks smooth
    setTimeout(() => {
      showBanner();
    }, 150);
  }, INTRO_DURATION);
}
function showIntro(){
  if(!introOverlay) return;
  introOverlay.classList.remove('hidden');
  introOverlay.setAttribute('aria-hidden', 'false');
  if(opponentBanner) opponentBanner.classList.add('hidden');
  hideFooterLogo();
}
function hideIntro(){
  if(!introOverlay) return;
  introOverlay.classList.add('hidden');
  introOverlay.setAttribute('aria-hidden', 'true');
}

// --------- banner / footer control ----------
function showBanner(){
  if(!opponentBanner) return;
  opponentBanner.classList.remove('hidden');
  opponentBanner.setAttribute('aria-hidden', 'false');
}
function hideBanner(){
  if(!opponentBanner) return;
  opponentBanner.classList.add('hidden');
  opponentBanner.setAttribute('aria-hidden', 'true');
}
function showFooterLogo(){
  if(!footerLogo) return;
  footerLogo.classList.remove('hidden');
  footerLogo.style.display = '';
}
function hideFooterLogo(){
  if(!footerLogo) return;
  footerLogo.classList.add('hidden');
  footerLogo.style.display = 'none';
}

// ---------- storage / UI ----------
function loadState(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) state = JSON.parse(raw);
  } catch(e){
    state = { playerWins:0, cpuWins:0, plays:0 };
  }
  updateScoreboardUI();
  updatePlaysUI();
  checkPlaysLimitUI();
}
function saveState(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){} }
function updateScoreboardUI(){
  if(playerWinsEl) playerWinsEl.textContent = `${state.playerWins} / ${MAX_PLAYS}`;
  if(cpuWinsEl) cpuWinsEl.textContent = `${state.cpuWins} / ${MAX_PLAYS}`;
  if(playerBonusPercentEl) playerBonusPercentEl.textContent = `Bono: ${bonusPercent(state.playerWins)}%`;
  if(cpuBonusPercentEl) cpuBonusPercentEl.textContent = `Bono: ${bonusPercent(state.cpuWins)}%`;
}
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
    hideFooterLogo();
  } else {
    if(sessionStarted){ startBtn.disabled = true; startBtn.classList.add('disabled'); }
    else { startBtn.disabled = false; startBtn.classList.remove('disabled'); }
  }
}
function setActiveChoice(){
  if(!pickX || !pickO) return;
  pickX.classList.toggle('active', playerSymbol === 'X');
  pickO.classList.toggle('active', playerSymbol === 'O');
}

// ---------- picks ----------
function onPick(sym){
  if(sessionStarted) return;
  if(sym === 'X'){ playerSymbol = 'X'; cpuSymbol = 'O'; }
  else { playerSymbol = 'O'; cpuSymbol = 'X'; }
  setActiveChoice();
}

// ---------- tablero ----------
function resetBoardUI(){
  cells.forEach(c => { c.innerHTML = ''; c.classList.remove('disabled','win'); c.disabled = false; });
}

// ---------- juego ----------
function startGame(){
  if(state.plays >= MAX_PLAYS){ message('No puedes comenzar: alcanzaste el límite de 3 partidas por dispositivo.'); return; }
  sessionStarted = true;
  checkPlaysLimitUI();

  resetBoardUI();
  board = Array(9).fill(null);
  currentTurn = playerSymbol; // jugador empieza
  running = true;
  message(`Juego iniciado — Tú: ${symbolToEmoji(playerSymbol)}  |  ${cpuName}: ${symbolToEmoji(cpuSymbol)}`);

  showFooterLogo();
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
    showFooterLogo();
  } else {
    sessionStarted = false;
    showIntroThenBanner();
    message('Juego reiniciado. Esperá la presentación para continuar');
    hideFooterLogo();
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

// ---------- CPU (muy fácil) ----------
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

// ---------- ganador / fin de partida ----------
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
      showFooterLogo();
    }, 900);
  } else {
    setTimeout(()=>{
      const bp = bonusPercent(state.playerWins);
      if(modalPercent) modalPercent.textContent = `${bp}%`;
      if(modalMessage) modalMessage.textContent = (bp>0) ? `Has obtenido ${bp}% por ${state.playerWins} victoria(s).` : `No obtuviste bono (0 victorias).`;
      showModal();
      hideFooterLogo();
    }, 700);
  }
}

// Modal
function showModal(){ if(resultModal) resultModal.classList.remove('hidden'); }
function hideModal(){ if(resultModal) resultModal.classList.add('hidden'); }
