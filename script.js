// Tatetí (Tic-Tac-Toe) - Jugador vs CPU
// Interfaz en español. Guarda los 3 archivos (index.html, style.css, script.js)
// y abre index.html en tu navegador.

const WIN_COMBINATIONS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];

const boardEl = document.getElementById('board');
const cells = Array.from(document.querySelectorAll('.cell'));
const messageEl = document.getElementById('message');

const pickX = document.getElementById('pickX');
const pickO = document.getElementById('pickO');
const whoStarts = document.getElementById('whoStarts');
const difficulty = document.getElementById('difficulty');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

const playerBonusesEl = document.getElementById('playerBonuses');
const cpuBonusesEl = document.getElementById('cpuBonuses');

let board = Array(9).fill(null);
let playerSymbol = 'X';
let cpuSymbol = 'O';
let currentTurn = 'X';
let running = false;
let cpuThinking = false;

// Bonos (persisten en localStorage)
const STORAGE_KEY = 'tatetiBonos';
let bonuses = { player: 0, cpu: 0 };

function loadBonuses(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) bonuses = JSON.parse(raw);
  } catch(e){ bonuses = { player:0, cpu:0 }; }
  updateBonusesUI();
}

function saveBonuses(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(bonuses)); } catch(e){}
}

function updateBonusesUI(){
  playerBonusesEl.textContent = bonuses.player;
  cpuBonusesEl.textContent = bonuses.cpu;
}

function setActiveChoice() {
  pickX.classList.toggle('active', playerSymbol === 'X');
  pickO.classList.toggle('active', playerSymbol === 'O');
}

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

function startGame(){
  resetBoardUI();
  board = Array(9).fill(null);
  // Dificultad por defecto ya está configurada en el HTML como 'easy'
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
    endGame(winner);
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
  // Pequeña pausa para dar sensación de "pensar"
  setTimeout(()=>{
    const level = difficulty.value;
    let move;
    if(level === 'easy') move = cpuRandomMove();
    else if(level === 'medium') move = cpuMediumMove();
    else move = cpuMinimaxMove();
    if(move !== undefined && move !== null){
      makeMove(move, cpuSymbol);
    }
    cpuThinking = false;
    afterMove();
  }, 400);
}

function cpuRandomMove(){
  const avail = availableMoves(board);
  if(avail.length === 0) return null;
  return avail[Math.floor(Math.random()*avail.length)];
}

function cpuMediumMove(){
  // Si puede ganar en 1, gana
  let move = findWinningMove(board, cpuSymbol);
  if(move !== null) return move;
  // Si el jugador puede ganar, bloquear
  move = findWinningMove(board, playerSymbol);
  if(move !== null) return move;
  // Tomar centro si está
  if(board[4] === null) return 4;
  // Tomar esquina disponible
  const corners = [0,2,6,8].filter(i => board[i]===null);
  if(corners.length) return corners[Math.floor(Math.random()*corners.length)];
  // Sino cualquier lugar
  return cpuRandomMove();
}

function cpuMinimaxMove(){
  // Minimax con evaluación por profundidad
  const copy = board.slice();
  const result = minimax(copy, cpuSymbol, 0);
  return result.move;
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

function endGame(winner){
  running = false;
  // resaltar línea ganadora si no es empate
  if(winner === 'D'){
    message('Empate 🙃 — sin bono');
  } else {
    if(winner === playerSymbol){
      message('¡Ganaste! 🎉 Has recibido 1 bono');
      bonuses.player += 1;
    } else {
      message('CPU gana 😢 — CPU recibe 1 bono');
      bonuses.cpu += 1;
    }
    saveBonuses();
    updateBonusesUI();

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
}

// Minimax: retorna {score, move}
// Score: +10 - depth si cpu gana, -10 + depth si player gana, 0 empate
function minimax(b, turn, depth){
  const winner = checkWinner(b);
  if(winner === cpuSymbol) return {score: 10 - depth, move: null};
  if(winner === playerSymbol) return {score: depth - 10, move: null};
  if(winner === 'D') return {score: 0, move: null};

  const moves = availableMoves(b);
  let bestMove = null;

  if(turn === cpuSymbol){
    // maximizer
    let bestScore = -Infinity;
    for(const m of moves){
      b[m] = turn;
      const res = minimax(b, opposite(turn), depth+1);
      b[m] = null;
      if(res.score > bestScore){
        bestScore = res.score;
        bestMove = m;
      }
    }
    return {score: bestScore, move: bestMove};
  } else {
    // minimizer
    let bestScore = Infinity;
    for(const m of moves){
      b[m] = turn;
      const res = minimax(b, opposite(turn), depth+1);
      b[m] = null;
      if(res.score < bestScore){
        bestScore = res.score;
        bestMove = m;
      }
    }
    return {score: bestScore, move: bestMove};
  }
}

function opposite(sym){
  return sym === 'X' ? 'O' : 'X';
}

function message(text){
  messageEl.textContent = text;
}

// Permitir iniciar con Enter cuando el foco esté en controles
document.addEventListener('keydown', (e)=>{
  if(e.key === 'Enter' && !running){
    startGame();
  }
});

// Ajustar símbolos si el usuario cambia antes de iniciar
setActiveChoice();

// Cargar y mostrar bonos guardados
loadBonuses();

// Al cargar, desactivar células hasta empezar
resetBoardUI();
message('Presioná "Comenzar" para jugar');
