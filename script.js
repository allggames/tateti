// Tatetí - Jugador vs CPU
// Implementación con límite de 3 partidas por dispositivo y bono según victorias.

// Constantes
const WIN_COMBINATIONS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];
const MAX_PLAYS = 3;
const STORAGE_KEY = 'tatetiState_v2'; // guarda { playerWins, cpuWins, plays }

// DOM
const boardEl = document.getElementById('board');
const cells = Array.from(document.querySelectorAll('.cell'));
const messageEl = document.getElementById('message');

const pickX = document.getElementById('pickX');
const pickO = document.getElementById('pickO');
const whoStarts = document.getElementById('whoStarts');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

const playerWinsEl = document.getElementById('playerWins');
const cpuWinsEl = document.getElementById('cpuWins');
const playerBonusPercentEl = document.getElementById('playerBonusPercent');
const cpuBonusPercentEl = document.getElementById('cpuBonusPercent');
const playsLeftEl = document.getElementById('playsLeft');

// Estado runtime
let board = Array(9).fill(null);
let playerSymbol = 'X';
let cpuSymbol = 'O';
let currentTurn = 'X';
let running = false;
let cpuThinking = false;

// Estado persistente
let state = { playerWins: 0, cpuWins: 0, plays: 0 };

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
  pickX.classList.toggle('active', playerSymbol === 'X');
  pickO.classList.toggle('active', playerSymbol === 'O');
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
  } else {
    startBtn.disabled = false;
    startBtn.classList.remove('disabled');
  }
}

// --- eventos UI ---
pickX.addEventListener('click', ()=> {
  if(running) return;
  playerSymbol = 'X';
  cpuSymbol = 'O';
  setActiveChoice();
});
pickO.addEventListener('click', ()=> {
  if(running) return;
  playerSymbol = 'O';
  cpuSymbol = 'X';
  setActiveChoice();
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', resetGame);

cells.forEach(c => c.addEventListener('click', onCellClick));

// --- juego ---
function startGame(){
  if(state.plays >= MAX_PLAYS){
    message('No puedes comenzar: alcanzaste el límite de 3 partidas por dispositivo.');
    return;
  }
  resetBoardUI();
  board = Array(9).fill(null);
  currentTurn = whoStarts.value === 'player' ? playerSymbol : cpuSymbol;
  running = true;
  message(`Juego iniciado — Tú: ${playerSymbol}  |  CPU: ${cpuSymbol}`);
  if(currentTurn === cpuSymbol){
    doCpuTurn();
  }
}

function resetGame(){
  running = false;
  cpuThinking = false;
  board = Array(9).fill(null);
  resetBoardUI();
  message('Juego reiniciado. Presioná "Comenzar" para jugar');
}

function resetBoardUI(){
  cells.forEach(c => {
    c.textContent = '';
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
  cell.textContent = symbol;
  cell.classList.add('disabled');
}

function afterMove(){
  const winner = checkWinner(board);
  if(winner){
    handleEnd(winner);
    return;
  }
  // switch turn
  currentTurn = currentTurn === 'X' ? 'O' : 'X';
  if(running && currentTurn === cpuSymbol){
    doCpuTurn();
  }
}

function doCpuTurn(){
  cpuThinking = true;
  message('CPU está pensando...');
  setTimeout(()=>{
    const move = cpuIntermediateMove();
    if(move !== undefined && move !== null){
      makeMove(move, cpuSymbol);
    }
    cpuThinking = false;
    afterMove();
  }, 420);
}

// CPU: intermedio entre fácil y medio
function cpuIntermediateMove(){
  // 1) Si puede ganar, gana
  let move = findWinningMove(board, cpuSymbol);
  if(move !== null) return move;
  // 2) Si el jugador puede ganar, bloquear
  move = findWinningMove(board, playerSymbol);
  if(move !== null) return move;
  // 3) Heurística con probabilidad: centro/esquinas (60% prob)
  if(Math.random() < 0.6){
    if(board[4] === null) return 4;
    const corners = [0,2,6,8].filter(i => board[i] === null);
    if(corners.length) return corners[Math.floor(Math.random()*corners.length)];
  }
  // 4) Random
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
  if(b.every(v=>v!==null)) return 'D'; // draw
  return null;
}

function handleEnd(winner){
  running = false;

  // aumentar contador de partidas (hasta MAX_PLAYS)
  if(state.plays < MAX_PLAYS){
    state.plays += 1;
  }

  if(winner === 'D'){
    message('Empate 🙃 — no hay bono adicional');
  } else {
    if(winner === playerSymbol){
      state.playerWins = Math.min(MAX_PLAYS, state.playerWins + 1);
      message(`¡Ganaste! 🎉 Bono actual: ${bonusPercent(state.playerWins)}%`);
    } else {
      state.cpuWins = Math.min(MAX_PLAYS, state.cpuWins + 1);
      message(`CPU gana 😢 — Bono CPU: ${bonusPercent(state.cpuWins)}%`);
    }

    // resaltar combos ganadoras
    for(const [a,b,c] of WIN_COMBINATIONS){
      if(board[a] && board[a] === board[b] && board[a] === board[c]){
        cells[a].classList.add('win');
        cells[b].classList.add('win');
        cells[c].classList.add('win');
        break;
      }
    }
  }

  // deshabilitar todas las casillas
  cells.forEach(c=>c.classList.add('disabled'));

  // guardar y actualizar UI
  saveState();
  updateScoreboardUI();
  updatePlaysUI();
  checkPlaysLimitUI();
}

// Permitir iniciar con Enter cuando el foco esté en controles
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter' && !running){
    startGame();
  }
});

// Utilidad
function message(text){
  messageEl.textContent = text;
}

// Inicialización
setActiveChoice();
loadState();
resetBoardUI();
message('Presioná "Comenzar" para jugar');
