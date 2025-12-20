// script.js (reemplazar todo)
// Flujo garantizado: INTRO (logo + 🔱 + barra) -> cuando termina: oculta INTRO -> muestra cartel NEXUS
// Mantiene la lógica del juego (startGame, clicks, CPU, fin de partida).

/* ---------- Config / Estado ---------- */
const cpuName = 'NEXUS';
const WIN_COMBINATIONS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];
const MAX_PLAYS = 3;
const STORAGE_KEY = 'tatetiState_v2';
const INTRO_DURATION = 1600; // ms duración visual de "carga"

let board = Array(9).fill(null);
let playerSymbol = 'X';
let cpuSymbol = 'O';
let currentTurn = 'X';
let running = false;
let cpuThinking = false;
let sessionStarted = false;
let state = { playerWins:0, cpuWins:0, plays:0 };

/* ---------- DOM refs ---------- */
let boardEl, cells, messageEl;
let introOverlay, introCard, introParticlesContainer, loadingBar, loadingText;
let opponentBanner, startBtn, restartBtn, pickX, pickO;
let playerWinsEl, cpuWinsEl, playerBonusPercentEl, cpuBonusPercentEl, playsLeftEl;
let resultModal, modalPercent, modalMessage, modalClose;
let boardLogo, bgTridents, bgEmojis;

/* ---------- Utils ---------- */
function dbg(...s){ console.debug('[tateti]', ...s); }
function byId(id){ return document.getElementById(id); }
function symbolToEmoji(sym){ if(sym==='X') return '❌'; if(sym==='O') return '⭕'; return sym; }
function message(text){ if(messageEl) messageEl.textContent = text; }

/* ---------- BACKGROUND (global) ---------- */
function createBgLayer(id){
  let el = byId(id);
  if(!el){
    el = document.createElement('div');
    el.id = id;
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.zIndex = '0';
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);
  }
  return el;
}
function populateBackground(){
  bgTridents = createBgLayer('bgTridents');
  bgEmojis = createBgLayer('bgEmojis');
  bgTridents.innerHTML = '';
  bgEmojis.innerHTML = '';

  const W = Math.max(window.innerWidth, 800);
  const H = Math.max(window.innerHeight, 600);

  const place = (container, count, factory) => {
    for(let i=0;i<count;i++){
      const x = Math.random() * W;
      const y = Math.random() * H;
      const n = factory();
      n.style.position = 'absolute';
      n.style.left = `${x}px`;
      n.style.top = `${y}px`;
      n.style.pointerEvents = 'none';
      container.appendChild(n);
    }
  };

  const trCount = Math.round(Math.max(8, Math.min(22, (W*H)/200000)));
  place(bgTridents, trCount, () => {
    const s = 10 + Math.floor(Math.random()*18);
    const el = document.createElement('div');
    el.className = 'bg-item trident';
    el.textContent = '🔱';
    el.style.fontSize = `${s}px`;
    el.style.opacity = `${0.04 + Math.random()*0.08}`;
    el.style.filter = 'blur(.2px)';
    el.style.transform = `rotate(${(-12 + Math.random()*24).toFixed(1)}deg)`;
    return el;
  });

  const emojis = ['⭕','❌','🎁','✨'];
  const emCount = Math.round(Math.max(10, Math.min(20, (W*H)/180000)));
  place(bgEmojis, emCount, () => {
    const s = 14 + Math.floor(Math.random()*36);
    const el = document.createElement('div');
    el.className = 'bg-item emoji';
    el.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    el.style.fontSize = `${s}px`;
    el.style.opacity = `${0.03 + Math.random()*0.07}`;
    el.style.filter = 'blur(.25px)';
    el.style.transform = `rotate(${(-25 + Math.random()*50).toFixed(1)}deg)`;
    return el;
  });

  bgTridents.style.zIndex = 0;
  bgEmojis.style.zIndex = 0;
}

/* ---------- INTRO: ensure UI (bar + text) and particles inside overlay ---------- */
function ensureLoadingUI(){
  if(!introCard) return;
  loadingBar = byId('loadingBar');
  loadingText = byId('loadingText');
  if(loadingBar && loadingText) return;

  const outer = document.createElement('div');
  outer.className = 'loading-bar-outer';
  outer.style.width = '72%';
  outer.style.maxWidth = '520px';
  outer.style.height = '12px';
  outer.style.background = 'rgba(0,0,0,0.12)';
  outer.style.borderRadius = '8px';
  outer.style.overflow = 'hidden';
  outer.style.marginTop = '12px';
  outer.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04)';

  const inner = document.createElement('div');
  inner.id = 'loadingBar';
  inner.className = 'loading-bar';
  inner.style.height = '100%';
  inner.style.width = '0%';
  inner.style.background = 'linear-gradient(90deg, #ffd9b3, var(--orange-bright))';
  inner.style.borderRadius = '8px';
  inner.style.transition = 'width .08s linear';
  outer.appendChild(inner);

  const text = document.createElement('div');
  text.id = 'loadingText';
  text.className = 'loading-text';
  text.style.marginTop = '8px';
  text.style.color = '#fff';
  text.style.fontWeight = '700';
  text.style.textAlign = 'center';
  text.textContent = 'Cargando el juego... 0%';

  const logo = introCard.querySelector('#introLogo') || introCard.querySelector('img');
  if(logo && logo.parentNode === introCard){
    logo.insertAdjacentElement('afterend', outer);
    outer.insertAdjacentElement('afterend', text);
  } else {
    introCard.appendChild(outer);
    introCard.appendChild(text);
  }
  loadingBar = inner;
  loadingText = text;
  dbg('Loading UI created inside intro');
}

function populateIntroParticles(){
  if(!introOverlay) return;
  introParticlesContainer = byId('introParticles');
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
  const count = 12;
  for(let i=0;i<count;i++){
    const size = 12 + Math.round(Math.random()*26);
    const opacity = 0.06 + Math.random()*0.08;
    const rot = (-20 + Math.random()*40).toFixed(1);
    const px = Math.random() * rect.width;
    const py = Math.random() * rect.height;
    const span = document.createElement('div');
    span.className = 'bg-item trident';
    span.textContent = '🔱';
    span.style.position = 'absolute';
    span.style.left = `${px}px`;
    span.style.top  = `${py}px`;
    span.style.fontSize = `${size}px`;
    span.style.opacity = `${opacity}`;
    span.style.transform = `rotate(${rot}deg)`;
    span.style.filter = 'blur(.2px)';
    introParticlesContainer.appendChild(span);
  }
  dbg('Intro particles added');
}

/* ---------- Loading animation (requestAnimationFrame) ---------- */
function animateLoading(duration){
  return new Promise(resolve => {
    ensureLoadingUI();
    if(!loadingBar || !loadingText){
      setTimeout(resolve, duration);
      return;
    }
    const start = performance.now();
    function frame(now){
      const pct = Math.min(1, (now - start) / duration);
      const p = Math.round(pct * 100);
      loadingBar.style.width = `${p}%`;
      loadingText.textContent = `Cargando el juego... ${p}%`;
      if(pct < 1) requestAnimationFrame(frame);
      else {
        loadingText.textContent = 'Listo';
        setTimeout(resolve, 220);
      }
    }
    requestAnimationFrame(frame);
  });
}

/* ---------- Intro -> Banner flow (guaranteed) ---------- */
function attachStartListener(){
  startBtn = startBtn || byId('startBtn');
  if(!startBtn) return;
  startBtn.type = 'button';
  if(startBtn._h) startBtn.removeEventListener('click', startBtn._h);
  startBtn._h = ()=>{ hideBanner(); startGame(); };
  startBtn.addEventListener('click', startBtn._h);
  startBtn.disabled = false;
  startBtn.classList.remove('disabled');
  dbg('start listener attached');
}
function showBanner(){ const b = byId('opponentBanner'); if(!b) return; b.classList.remove('hidden'); b.setAttribute('aria-hidden','false'); dbg('Banner shown'); }
function hideBanner(){ const b = byId('opponentBanner'); if(!b) return; b.classList.add('hidden'); b.setAttribute('aria-hidden','true'); }

async function showIntroThenBanner(){
  introOverlay = introOverlay || byId('introOverlay');
  introCard = introCard || (introOverlay && introOverlay.querySelector('.intro-card'));
  if(!introOverlay){
    dbg('No introOverlay — skipping intro');
    attachStartListener();
    showBanner();
    return;
  }
  // show intro
  introOverlay.classList.remove('hidden');
  introOverlay.setAttribute('aria-hidden','false');
  // particles + global background
  populateIntroParticles();
  populateBackground();
  // animate loading
  try{
    await animateLoading(INTRO_DURATION);
  } catch(e){
    dbg('animateLoading error', e);
  }
  // transition
  introOverlay.classList.add('hidden');
  introOverlay.setAttribute('aria-hidden','true');
  setTimeout(()=>{ attachStartListener(); showBanner(); }, 160);
}

/* ---------- Populate global background on load & resize ---------- */
document.addEventListener('DOMContentLoaded', ()=>{
  populateBackground();
  window.addEventListener('resize', ()=> { try{ const bt=byId('bgTridents'); const be=byId('bgEmojis'); if(bt) bt.innerHTML=''; if(be) be.innerHTML=''; populateBackground(); }catch(e){console.error(e);} });
});

/* ---------- Init game / UI ---------- */
document.addEventListener('DOMContentLoaded', async ()=>{
  boardEl = byId('board');
  cells = Array.from(document.querySelectorAll('.cell'));
  messageEl = byId('message');

  introOverlay = byId('introOverlay');
  introCard = introOverlay ? introOverlay.querySelector('.intro-card') : null;

  opponentBanner = byId('opponentBanner');
  startBtn = byId('startBtn');
  restartBtn = byId('restartBtn');
  pickX = byId('pickX'); pickO = byId('pickO');

  playerWinsEl = byId('playerWins');
  cpuWinsEl = byId('cpuWins');
  playerBonusPercentEl = byId('playerBonusPercent');
  cpuBonusPercentEl = byId('cpuBonusPercent');
  playsLeftEl = byId('playsLeft');

  resultModal = byId('resultModal');
  modalPercent = byId('modalPercent');
  modalMessage = byId('modalMessage');
  modalClose = byId('modalClose');

  boardLogo = byId('boardLogo');

  if(!boardEl || !cells.length || !messageEl){
    console.error('FATAL: elementos del tablero faltantes.');
    return;
  }

  // UI listeners
  if(pickX) pickX.addEventListener('click', ()=> onPick('X'));
  if(pickO) pickO.addEventListener('click', ()=> onPick('O'));
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
    if(introOverlay) introOverlay.classList.add('hidden');
    hideBanner();
    hideBoardLogo();
  } else {
    await showIntroThenBanner();
  }

  attachStartListener();
  dbg('Init complete');
});

/* ---------- Game logic (igual que antes) ---------- */
function showBoardLogo(){ if(!boardLogo) return; boardLogo.classList.remove('hidden'); boardLogo.style.display='block'; }
function hideBoardLogo(){ if(!boardLogo) return; boardLogo.classList.add('hidden'); boardLogo.style.display='none'; }

function loadState(){ try{ const raw = localStorage.getItem(STORAGE_KEY); if(raw) state = JSON.parse(raw); } catch(e){ state = {playerWins:0,cpuWins:0,plays:0}; } updateScoreboardUI(); updatePlaysUI(); checkPlaysLimitUI(); }
function saveState(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }
function updateScoreboardUI(){ if(playerWinsEl) playerWinsEl.textContent = `${state.playerWins} / ${MAX_PLAYS}`; if(cpuWinsEl) cpuWinsEl.textContent = `${state.cpuWins} / ${MAX_PLAYS}`; if(playerBonusPercentEl) playerBonusPercentEl.textContent = `Bono: ${bonusPercent(state.playerWins)}%`; if(cpuBonusPercentEl) cpuBonusPercentEl.textContent = `Bono: ${bonusPercent(state.cpuWins)}%`; }
function updatePlaysUI(){ if(playsLeftEl) playsLeftEl.textContent = Math.max(0, MAX_PLAYS - state.plays); }
function bonusPercent(w){ if(w<=0) return 0; if(w===1) return 100; if(w===2) return 150; return 200; }
function checkPlaysLimitUI(){ if(!startBtn) return; if(state.plays >= MAX_PLAYS){ startBtn.disabled=true; startBtn.classList.add('disabled'); message('Has alcanzado el máximo de 3 partidas.'); hideBanner(); if(introOverlay) introOverlay.classList.add('hidden'); hideBoardLogo(); } else { if(sessionStarted){ startBtn.disabled=true; startBtn.classList.add('disabled'); } else { startBtn.disabled=false; startBtn.classList.remove('disabled'); } } }
function setActiveChoice(){ if(!pickX||!pickO) return; pickX.classList.toggle('active', playerSymbol==='X'); pickO.classList.toggle('active', playerSymbol==='O'); }
function onPick(sym){ if(sessionStarted) return; if(sym==='X'){ playerSymbol='X'; cpuSymbol='O'; } else { playerSymbol='O'; cpuSymbol='X'; } setActiveChoice(); }
function resetBoardUI(){ cells.forEach(c=>{ c.innerHTML=''; c.classList.remove('disabled','win'); c.disabled=false; }); }

function startGame(){ if(state.plays >= MAX_PLAYS){ message('No puedes comenzar: alcanzaste el límite.'); return; } sessionStarted=true; checkPlaysLimitUI(); resetBoardUI(); board=Array(9).fill(null); currentTurn=playerSymbol; running=true; cpuThinking=false; message(`Juego iniciado — Tú: ${symbolToEmoji(playerSymbol)}  |  ${cpuName}: ${symbolToEmoji(cpuSymbol)}`); showBoardLogo(); }
function resetGame(){ running=false; cpuThinking=false; board=Array(9).fill(null); resetBoardUI(); if(sessionStarted && state.plays < MAX_PLAYS){ currentTurn=playerSymbol; running=true; message('Partida reiniciada — continúa la serie'); showBoardLogo(); } else { sessionStarted=false; showIntroThenBanner(); message('Juego reiniciado. Mostrando presentación...'); hideBoardLogo(); } }

function onCellClick(e){ if(!running || cpuThinking) return; const idx=Number(e.currentTarget.dataset.index); if(Number.isNaN(idx)) return; if(board[idx]) return; if(currentTurn!==playerSymbol) return; makeMove(idx, playerSymbol); afterMove(); setTimeout(()=>{ if(running && !cpuThinking && currentTurn===cpuSymbol) doCpuTurn(); },350); }
function makeMove(i,s){ board[i]=s; const c=cells[i]; if(c){ c.innerHTML=`<span>${symbolToEmoji(s)}</span>`; c.classList.add('disabled'); } }
function afterMove(){ const w=checkWinner(board); if(w){ handleEnd(w); return; } currentTurn = currentTurn==='X'?'O':'X'; if(running && currentTurn===cpuSymbol) doCpuTurn(); }
function doCpuTurn(){ cpuThinking=true; message(`${cpuName} está pensando...`); setTimeout(()=>{ const m = cpuVeryEasyMove(); if(m!==undefined && m!==null) makeMove(m,cpuSymbol); cpuThinking=false; afterMove(); },420); }
function cpuVeryEasyMove(){ const blockProb=0.30, heurProb=0.05; const block=findWinningMove(board, playerSymbol); if(block!==null && Math.random()<blockProb) return block; if(Math.random()<heurProb){ if(board[4]===null) return 4; const corners=[0,2,6,8].filter(i=>board[i]===null); if(corners.length) return corners[Math.floor(Math.random()*corners.length)]; const sides=[1,3,5,7].filter(i=>board[i]===null); if(sides.length) return sides[Math.floor(Math.random()*sides.length)]; } return cpuRandomMove(); }
function cpuRandomMove(){ const avail = availableMoves(board); if(avail.length===0) return null; return avail[Math.floor(Math.random()*avail.length)]; }
function availableMoves(b){ return b.map((v,i)=> v===null?i:null).filter(v=>v!==null); }
function findWinningMove(b,sym){ for(const i of availableMoves(b)){ b[i]=sym; const w=checkWinner(b); b[i]=null; if(w===sym) return i; } return null; }
function checkWinner(b){ for(const [a,b1,c] of WIN_COMBINATIONS){ if(b[a] && b[a]===b[b1] && b[a]===b[c]) return b[a]; } if(b.every(v=>v!==null)) return 'D'; return null; }
function handleEnd(w){ running=false; if(state.plays<MAX_PLAYS) state.plays+=1; if(w==='D') message('Empate 🙃 — no hay bono adicional'); else { if(w===playerSymbol){ state.playerWins = Math.min(MAX_PLAYS, state.playerWins+1); message('¡Ganaste esta partida! 🎉'); } else { state.cpuWins = Math.min(MAX_PLAYS, state.cpuWins+1); message(`${cpuName} gana esta partida 😢`); } for(const [a,b,c] of WIN_COMBINATIONS){ if(board[a] && board[a]===board[b] && board[a]===board[c]){ if(cells[a]) cells[a].classList.add('win'); if(cells[b]) cells[b].classList.add('win'); if(cells[c]) cells[c].classList.add('win'); break; } } } cells.forEach(c=>c.classList.add('disabled')); saveState(); updateScoreboardUI(); updatePlaysUI(); checkPlaysLimitUI(); if(state.plays < MAX_PLAYS){ setTimeout(()=>{ board=Array(9).fill(null); resetBoardUI(); currentTurn=playerSymbol; running=true; message(`Siguiente partida iniciada — Partida ${state.plays + 1} de ${MAX_PLAYS}`); showBoardLogo(); },900); } else { setTimeout(()=>{ const bp = bonusPercent(state.playerWins); if(modalPercent) modalPercent.textContent = `${bp}%`; if(modalMessage) modalMessage.textContent = (bp>0)?`Has obtenido ${bp}% por ${state.playerWins} victoria(s).`:`No obtuviste bono (0 victorias).`; showModal(); hideBoardLogo(); },700); } }
function showModal(){ if(resultModal) resultModal.classList.remove('hidden'); }
function hideModal(){ if(resultModal) resultModal.classList.add('hidden'); }
