// Tatetí - Jugador vs CPU
// CPU en modo FÁCIL (oculto), "Comenzar" solo al principio, auto-inicio de partidas,
// y modal final al completar las 3 partidas.

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
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

const playerWinsEl = document.getElementById('playerWins');
const cpuWinsEl = document.getElementById('cpuWins');
const playerBonusPercentEl = document.getElementById('playerBonusPercent');
const cpuBonusPercentEl = document.getElementById('cpuBonusPercent');
const playsLeftEl = document.getElementById('playsLeft');

const resultModal = document.getElementById('resultModal');
const modalMessage = document.getElementById('modalMessage');
const modalClose = document.getElementById('modalClose');

// Estado runtime
let board = Array(9).fill(null);
let playerSymbol = 'X';
let cpuSymbol = 'O';
let currentTurn = 'X';
let running = false;
let cpuThinking = false;
let sessionStarted = false; // indica si el ciclo de partidas fue iniciado

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
    // Si la sesión ya se inició, deshabilitamos igualmente el botón ("Comenzar" solo al principio)
    if(sessionStarted){
      startBtn.disabled = true;
      startBtn.classList.add('disabled');
    } else {
      startBtn.disabled = false;
      startBtn.classList.remove('disabled');
    }
  }
}

// --- eventos UI ---
pickX.addEventListener('click', ()=> {
  if(sessionStarted) return;
  playerSymbol = 'X';
  cpuSymbol = 'O';
  setActiveChoice();
});
pickO.addEventListener('click', ()=> {
  if(sessionStarted) return;
  playerSymbol = 'O';
  cpuSymbol = 'X';
  setActiveChoice();
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', resetGame);

cells.forEach(c => c.addEventListener('click', onCellClick));
modalClose.addEventListener('click', hideModal);

// --- juego ---
function startGame(){
  if(state.plays >= MAX_PLAYS){
    message('No puedes comenzar: alcanzaste el límite de 3 partidas por dispositivo.');
    return;
  }
  // Marcar que la sesión de partidas empezó; desactivar start para el resto del ciclo
  sessionStarted = true;
  checkPlaysLimitUI();

  // Iniciar la primera partida
  resetBoardUI();
  board = Array(9).fill(null);
  // Siempre empieza el jugador
  currentTurn = playerSymbol;
  running = true;
  message(`Juego iniciado — Tú: ${playerSymbol}  |  CPU: ${cpuSymbol}`);
}

function resetGame(){
  // reinicia la partida actual (no altera el contador de plays ni victorias persistentes)
  running = false;
  cpuThinking = false;
  board = Array(9).fill(null);
  resetBoardUI();
  // Si la sesión ya empezó, volver a iniciar la partida actual para que siga el ciclo
  if(sessionStarted && state.plays < MAX_PLAYS){
    currentTurn = playerSymbol;
    running = true;
    message('Partida reiniciada — continúa la serie');
  } else {
    message('Juego reiniciado. Presioná "Comenzar" para jugar');
  }
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
    const move = cpuEasyMove(); // dificultad fácil oculta
    if(move !== undefined && move !== null){
      makeMove(move, cpuSymbol);
    }
    cpuThinking = false;
    afterMove();
  }, 420);
}

// CPU en modo FÁCIL (oculto):
// - Bloquea siempre si el jugador puede ganar en el siguiente movimiento.
// - No intenta buscar su propia victoria.
// - Con baja probabilidad hace una jugada heurística (centro/esquina).
// - En la mayoría de los casos elige aleatorio.
function cpuEasyMove(){
  // 1) Si el jugador puede ganar en el siguiente movimiento, bloquear (siempre)
  let block = findWinningMove(board, playerSymbol);
  if(block !== null) return block;

  // 2) (Opcional) con baja probabilidad usar heurística (centro/esquinas)
  if(Math.random() < 0.20){
    if(board[4] === null) return 4;
    const corners = [0,2,6,8].filter(i => board[i] === null);
    if(corners.length) return corners[Math.floor(Math.random()*corners.length)];
    const sides = [1,3,5,7].filter(i => board[i] === null);
    if(sides.length) return sides[Math.floor(Math.random()*sides.length)];
  }

  // 3) Movimiento aleatorio
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
      message(`¡Ganaste esta partida! 🎉`);
    } else {
      state.cpuWins = Math.min(MAX_PLAYS, state.cpuWins + 1);
      message(`CPU gana esta partida 😢`);
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

  // Si aún quedan partidas, iniciar la siguiente automáticamente después de una pausa corta
  if(state.plays < MAX_PLAYS){
    setTimeout(()=>{
      // preparar tablero nuevo y comenzar la siguiente (siempre jugador empieza)
      board = Array(9).fill(null);
      resetBoardUI();
      currentTurn = playerSymbol;
      running = true;
      message(`Siguiente partida iniciada — Partida ${state.plays + 1} de ${MAX_PLAYS}`);
    }, 900);
  } else {
    // serie finalizada: mostrar modal con bono alcanzado por el usuario
    setTimeout(()=>{
      const bp = bonusPercent(state.playerWins);
      let text;
      if(bp >= 100){
        text = `La serie ha finalizado. Has ganado un bono de ${bp}% (${state.playerWins} victoria(s)).`;
      } else {
        text = `La serie ha finalizado. No obtuviste bono (0 victorias).`;
      }
      showModal(text);
    }, 700);
  }
}

// Modal helpers
function showModal(text){
  modalMessage.textContent = text;
  resultModal.classList.remove('hidden');
}
function hideModal(){
  resultModal.classList.add('hidden');
}

// Permitir iniciar con Enter cuando el foco esté en controles (solo si no se inició la sesión)
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter' && !sessionStarted){
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
