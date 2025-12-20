// Tatetí - Jugador vs NEXUS (CPU)
// Overlay cartel en el centro con "HOY JUGARÁS CONTRA NEXUS🤖" + botón Comenzar.
// Al tocar Comenzar, el cartel desaparece y comienza la serie (auto-inicio de partidas).

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
const modalPercent = document.getElementById('modalPercent');
const modalMessage = document.getElementById('modalMessage');
const modalClose = document.getElementById('modalClose');

// Estado runtime
let board = Array(9).fill(null);
let playerSymbol = 'X';
let cpuSymbol = 'O';
let currentTurn = 'X';
let running = false;
let cpuThinking = false;
let sessionStarted = false;

// Estado persistente
let state = { playerWins: 0, cpuWins: 0, plays: 0 };

// inicializar texto del banner
opponentBanner.querySelector('.opponent-text').textContent = `HOY JUGARÁS CONTRA ${cpuName}🤖`;

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
    // Si ya jugaste las 3 partidas no permitimos volver a iniciar
    startBtn.disabled = true;
    startBtn.classList.add('disabled');
    message('Has alcanzado el máximo de 3 partidas por dispositivo.');
    // ocultar el banner si queda visible
    hideBanner();
  } else {
    if(sessionStarted){
      startBtn.disabled = true;
      startBtn.classList.add('disabled');
    } else {
      startBtn.disabled = false;
      startBtn.classList.remove('disabled');
      showBanner(); // mostrar banner si aún no se inició la serie
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

startBtn.addEventListener('click', () => {
  // Al presionar, ocultar el cartel y comenzar la serie
  hideBanner();
  startGame();
});
restartBtn.addEventListener('click', resetGame);

cells.forEach(c => c.addEventListener('click', onCellClick));
modalClose.addEventListener('click', hideModal);

// --- banner show/hide ---
function hideBanner(){
  if(!opponentBanner) return;
  opponentBanner.classList.add('hidden');
}
function showBanner(){
  if(!opponentBanner) return;
  // solo mostrar si no se inició la sesión y no se superó el limite
  if(!sessionStarted && state.plays < MAX_PLAYS){
    opponentBanner.classList.remove('hidden');
  } else {
    opponentBanner.classList.add('hidden');
  }
}

// --- juego ---
function startGame(){
  if(state.plays >= MAX_PLAYS){
    message('No puedes comenzar: alcanzaste el límite de 3 partidas por dispositivo.');
    return;
  }
  sessionStarted = true;
  checkPlaysLimitUI();

  resetBoardUI();
  board = Array(9).fill(null);
  currentTurn = playerSymbol;
  running = true;
  message(`Juego iniciado — Tú: ${playerSymbol}  |  ${cpuName}: ${cpuSymbol}`);
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
  currentTurn = currentTurn === 'X' ? 'O' : 'X';
  if(running && currentTurn === cpuSymbol){
    doCpuTurn();
  }
}

function doCpuTurn(){
  cpuThinking = true;
  message(`${cpuName} está pensando...`);
  setTimeout(()=>{
    const move = cpuVeryEasyMove(); // modo MUY FÁCIL oculto
    if(move !== undefined && move !== null){
      makeMove(move, cpuSymbol);
    }
    cpuThinking = false;
    afterMove();
  }, 420);
}

// CPU MUY FÁCIL (oculto)
// blockProb reducido para facilitar ganar a NEXUS
function cpuVeryEasyMove(){
  const blockProb = 0.30; // puede ajustarse aún más abajo si querés
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

// Teclas
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter' && !sessionStarted){
    hideBanner();
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
showBanner();
message('Tocá "Comenzar" para iniciar la serie');
