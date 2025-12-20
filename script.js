// Tatetí - Jugador vs NEXUS (CPU)
// Ajustes visuales: emojis como marcas, emoji pick buttons, overlay central, muy fácil.

// Config
const cpuName = 'NEXUS';
const WIN_COMBINATIONS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];
const MAX_PLAYS = 3;
const STORAGE_KEY = 'tatetiState_v2';

// DOM
const boardEl = document.getElementById('board');
const cells = Array.from(document.querySelectorAll('.cell'));
const messageEl = document.getElementById('message');

const opponentBanner = document.getElementById('opponentBanner');
const pickX = document.getElementById('pickX'); // here shows ⭕
const pickO = document.getElementById('pickO'); // here shows ❌
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

const playerWinsEl = document.getElementById('playerWins');
const cpuWinsEl = document.getElementById('cpuWins');
const playerBonusPercentEl = document.getElementById('playerBonusPercent');
const cpuBonusPercentEl = document.getElementById('cpuBonusPercent');
const playsLeftEl = document.getElementById('playsLeft');

const resultModal = document.getElementById('resultModal');
const modalPercent = document.getElementById('modalPercent');
const modalMessage = document.getElementById('modalMessage');
const modalClose = document.getElementById('modalClose');

// Estado runtime
let board = Array(9).fill(null); // stores 'X' or 'O'
let playerSymbol = 'O'; // default emoji mapping: pickX shows ⭕ which we map to 'O' internally
let cpuSymbol = 'X';
let currentTurn = 'X';
let running = false;
let cpuThinking = false;
let sessionStarted = false;

// Estado persistente
let state = { playerWins: 0, cpuWins: 0, plays: 0 };

// inicializar UI: show banner text
opponentBanner.querySelector('.opponent-text').textContent = `HOY JUGARÁS CONTRA ${cpuName}🤖`;

// --- helpers: map internal symbol to emoji for display ---
function symbolToEmoji(sym){
  // map internal 'X' -> ❌, 'O' -> ⭕
  if(sym === 'X') return '❌';
  if(sym === 'O') return '⭕';
  return sym;
}

// --- storage ---
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

function saveState(){
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){}
}

// --- UI helpers ---
function setActiveChoice() {
  // pickX shows emoji ⭕ but represents playerSymbol choice
  pickX.classList.toggle('active', playerSymbol === 'O');
  pickO.classList.toggle('active', playerSymbol === 'X');
}

function updateScoreboardUI(){
  playerWinsEl.textContent = `${state.playerWins} / ${MAX_PLAYS}`;
  cpuWinsEl.textContent = `${state.cpuWins} / ${MAX_PLAYS}`;
  playerBonusPercentEl.textContent = `Bono: ${bonusPercent(state.playerWins)}%`;
  cpuBonusPercentEl.textContent = `Bono: ${bonusPercent(state.cpuWins)}%`;
}

function updatePlaysUI(){
  playsLeftEl.textContent = Math.max(0, MAX_PLAYS - state.plays);
}

function bonusPercent(wins){
  if(wins <= 0) return 0;
  if(wins === 1) return 100;
  if(wins === 2) return 150;
  return 200;
}

function checkPlaysLimitUI(){
  if(state.plays >= MAX_PLAYS){
    startBtn.disabled = true;
    startBtn.classList.add('disabled');
    message('Has alcanzado el máximo de 3 partidas por dispositivo.');
    hideBanner();
  } else {
    if(sessionStarted){
      startBtn.disabled = true;
      startBtn.classList.add('disabled');
    } else {
      startBtn.disabled = false;
      startBtn.classList.remove('disabled');
      showBanner();
    }
  }
}

// --- events ---
pickX.addEventListener('click', ()=> {
  if(sessionStarted) return;
  // pickX shows ⭕, map it to 'O' internal
  playerSymbol = 'O';
  cpuSymbol = 'X';
  setActiveChoice();
});
pickO.addEventListener('click', ()=> {
  if(sessionStarted) return;
  // pickO shows ❌, map it to 'X' internal
  playerSymbol = 'X';
  cpuSymbol = 'O';
  setActiveChoice();
});

// Start from banner
startBtn.addEventListener('click', () => {
  hideBanner();
  startGame();
});
restartBtn.addEventListener('click', resetGame);

cells.forEach(c => c.addEventListener('click', onCellClick));
if(modalClose) modalClose.addEventListener('click', hideModal);

// banner functions
function hideBanner(){
  if(!opponentBanner) return;
  opponentBanner.classList.add('hidden');
}
function showBanner(){
  if(!opponentBanner) return;
  if(!sessionStarted && state.plays < MAX_PLAYS){
    opponentBanner.classList.remove('hidden');
  } else {
    opponentBanner.classList.add('hidden');
  }
}

// --- game functions ---
function startGame(){
  if(state.plays >= MAX_PLAYS){
    message('No puedes comenzar: alcanzaste el límite de 3 partidas por dispositivo.');
    return;
  }
  sessionStarted = true;
  checkPlaysLimitUI();

  resetBoardUI();
  board = Array(9).fill(null);
  // Always player starts
  currentTurn = playerSymbol;
  running = true;
  message(`Juego iniciado — Tú: ${symbolToEmoji(playerSymbol)}  |  ${cpuName}: ${symbolToEmoji(cpuSymbol)}`);
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
  } else {
    sessionStarted = false;
    showBanner();
    message('Juego reiniciado. Tocá "Comenzar" para empezar la serie');
  }
}

function resetBoardUI(){
  cells.forEach(c => {
    c.innerHTML = '';
    c.classList.remove('disabled','win');
    c.disabled = false;
  });
}

function onCellClick(e){
  if(!running || cpuThinking) return;
  const idx = Number(e.currentTarget.dataset.index);
  if(board[idx]) return;
  if(currentTurn !== playerSymbol) return;
  makeMove(idx, playerSymbol);
  afterMove();
}

function makeMove(index, symbol){
  board[index] = symbol;
  const cell = cells[index];
  // insert span with emoji for better sizing control
  cell.innerHTML = `<span>${symbolToEmoji(symbol)}</span>`;
  cell.classList.add('disabled');
}

function afterMove(){
  const winner = checkWinner(board);
  if(winner){
    handleEnd(winner);
    return;
  }
  currentTurn = currentTurn === 'X' ? 'O' : 'X';
  if(running && currentTurn === cpuSymbol){
    doCpuTurn();
  }
}

function doCpuTurn(){
  cpuThinking = true;
  message(`${cpuName} está pensando...`);
  setTimeout(()=>{
    const move = cpuVeryEasyMove();
    if(move !== undefined && move !== null){
      makeMove(move, cpuSymbol);
    }
    cpuThinking = false;
    afterMove();
  }, 420);
}

// CPU MUY FÁCIL
function cpuVeryEasyMove(){
  const blockProb = 0.30; // baja probabilidad de bloquear
  const heurProb = 0.05;

  const block = findWinningMove(board, playerSymbol);
  if(block !== null && Math.random() < blockProb){
    return block;
  }

  if(Math.random() < heurProb){
    if(board[4] === null) return 4;
    const corners = [0,2,6,8].filter(i => board[i] === null);
    if(corners.length) return corners[Math.floor(Math.random()*corners.length)];
    const sides = [1,3,5,7].filter(i => board[i] === null);
    if(sides.length) return sides[Math.floor(Math.random()*sides.length)];
  }

  return cpuRandomMove();
}

function cpuRandomMove(){
  const avail = availableMoves(board);
  if(avail.length === 0) return null;
  return avail[Math.floor(Math.random()*avail.length)];
}

function availableMoves(b){
  return b.map((v,i)=> v===null?i:null).filter(v=>v!==null);
}

function findWinningMove(b, symbol){
  for(const i of availableMoves(b)){
    b[i] = symbol;
    const w = checkWinner(b);
    b[i] = null;
    if(w === symbol) return i;
  }
  return null;
}

function checkWinner(b){
  for(const [a,b1,c] of WIN_COMBINATIONS){
    if(b[a] && b[a] === b[b1] && b[a] === b[c]){
      return b[a];
    }
  }
  if(b.every(v=>v!==null)) return 'D';
  return null;
}

function handleEnd(winner){
  running = false;

  if(state.plays < MAX_PLAYS){
    state.plays += 1;
  }

  if(winner === 'D'){
    message('Empate 🙃 — no hay bono adicional');
  } else {
    if(winner === playerSymbol){
      state.playerWins = Math.min(MAX_PLAYS, state.playerWins + 1);
      message(`¡Ganaste esta partida! 🎉`);
    } else {
      state.cpuWins = Math.min(MAX_PLAYS, state.cpuWins + 1);
      message(`${cpuName} gana esta partida 😢`);
    }

    for(const [a,b,c] of WIN_COMBINATIONS){
      if(board[a] && board[a] === board[b] && board[a] === board[c]){
        cells[a].classList.add('win');
        cells[b].classList.add('win');
        cells[c].classList.add('win');
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
    }, 900);
  } else {
    setTimeout(()=>{
      const bp = bonusPercent(state.playerWins);
      modalPercent.textContent = `${bp}%`;
      if(bp > 0){
        modalMessage.textContent = `Has obtenido ${bp}% por ${state.playerWins} victoria(s).`;
      } else {
        modalMessage.textContent = `No obtuviste bono (0 victorias).`;
      }
      showModal();
    }, 700);
  }
}

// Modal helpers
function showModal(){
  resultModal.classList.remove('hidden');
}
function hideModal(){
  resultModal.classList.add('hidden');
}

// keyboard: Enter starts if banner visible
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter' && !sessionStarted){
    hideBanner();
    startGame();
  }
});

// Utility
function message(text){
  messageEl.textContent = text;
}

// Init
setActiveChoice();
loadState();
resetBoardUI();
showBanner();
message('Tocá "Comenzar" para iniciar la serie');
```
