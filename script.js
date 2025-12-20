// script.js (versión final ajustada)
// - Intro con tridentes/emoji atenuados + barra de carga
// - Al terminar la carga: oculta intro y muestra cartel "HOY JUGARÁS CONTRA NEXUS" (espera click)
// - El modal "Resultado final" aparecerá únicamente cuando se completaron las 3 partidas (MAX_PLAYS).
// - Lógica del juego (partidas, CPU, etc.) intacta.

const cpuName = 'NEXUS';
const WIN_COMBINATIONS = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6]
];
const MAX_PLAYS = 3;
const STORAGE_KEY = 'tatetiState_v2';
const INTRO_DURATION = 1600;

let board = Array(9).fill(null);
let playerSymbol = 'X';
let cpuSymbol = 'O';
let currentTurn = 'X';
let running = false;
let cpuThinking = false;
let sessionStarted = false;
let state = { playerWins:0, cpuWins:0, plays:0 };

// DOM refs
let boardEl, cells, messageEl;
let introOverlay, introCard, introParticles;
let loadingBar, loadingText;
let opponentBanner, startBtn, restartBtn, pickX, pickO;
let playerWinsEl, cpuWinsEl, playerBonusPercentEl, cpuBonusPercentEl, playsLeftEl;
let resultModal, modalPercent, modalMessage, modalClose;
let boardLogo, bgTridents, bgEmojis;

function by(id){ return document.getElementById(id); }
function dbg(...a){ console.debug('[tateti]', ...a); }
function symbolToEmoji(s){ return s === 'X' ? '❌' : (s === 'O' ? '⭕' : s); }
function message(txt){ if(messageEl) messageEl.textContent = txt; }

/* ---------------- Background ---------------- */
function createBgLayer(id){
  let el = by(id);
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

  function place(container, count, factory, minDist = 60){
    const placed = [];
    const padding = 24;
    for(let i=0;i<count;i++){
      let attempts = 0, x, y, ok;
      do {
        x = Math.random() * (W - padding*2) + padding;
        y = Math.random() * (H - padding*2) + padding;
        ok = true;
        for(const p of placed){
          if(Math.hypot(p.x-x,p.y-y) < minDist){ ok = false; break; }
        }
        attempts++;
      } while(!ok && attempts < 40);
      placed.push({x,y});
      const node = factory();
      node.style.position = 'absolute';
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.style.pointerEvents = 'none';
      container.appendChild(node);
    }
  }

  const trCount = Math.round(Math.max(8, Math.min(24, (W*H)/180000)));
  place(bgTridents, trCount, () => {
    const n = document.createElement('div');
    n.className = 'bg-item trident';
    n.textContent = '🔱';
    n.style.fontSize = `${10 + Math.floor(Math.random()*20)}px`;
    n.style.opacity = `${0.04 + Math.random()*0.06}`;
    n.style.transform = `rotate(${(-12 + Math.random()*24).toFixed(1)}deg)`;
    n.style.filter = 'blur(.2px)';
    return n;
  }, 60);

  const emojis = ['⭕','❌','🎁','✨'];
  const emCount = Math.round(Math.max(10, Math.min(22, (W*H)/150000)));
  place(bgEmojis, emCount, () => {
    const n = document.createElement('div');
    n.className = 'bg-item emoji';
    n.textContent = emojis[Math.floor(Math.random()*emojis.length)];
    n.style.fontSize = `${14 + Math.floor(Math.random()*36)}px`;
    n.style.opacity = `${0.03 + Math.random()*0.06}`;
    n.style.transform = `rotate(${(-25 + Math.random()*50).toFixed(1)}deg)`;
    n.style.filter = 'blur(.25px)';
    return n;
  }, 50);

  bgTridents.style.zIndex = 0;
  bgEmojis.style.zIndex = 0;
}

/* ---------------- Intro UI & particles ---------------- */
function ensureIntroElements(){
  introOverlay = introOverlay || by('introOverlay');
  if(!introOverlay) return false;
  introCard = introCard || introOverlay.querySelector('.intro-card');

  introParticles = by('introParticles');
  if(!introParticles){
    introParticles = document.createElement('div');
    introParticles.id = 'introParticles';
    introParticles.style.position = 'absolute';
    introParticles.style.inset = '0';
    introParticles.style.pointerEvents = 'none';
    introOverlay.appendChild(introParticles);
  }

  loadingBar = by('loadingBar');
  loadingText = by('loadingText');

  if(!loadingBar || !loadingText){
    const outer = document.createElement('div');
    outer.className = 'loading-bar-outer';
    outer.style.width = '72%';
    outer.style.maxWidth = '560px';
    outer.style.height = '12px';
    outer.style.background = 'rgba(0,0,0,0.12)';
    outer.style.borderRadius = '10px';
    outer.style.overflow = 'hidden';
    outer.style.marginTop = '12px';
    outer.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04)';
    outer.style.alignSelf = 'center';

    const inner = document.createElement('div');
    inner.id = 'loadingBar';
    inner.className = 'loading-bar';
    inner.style.height = '100%';
    inner.style.width = '0%';
    inner.style.background = 'linear-gradient(90deg, #ffd9b3, var(--orange-bright))';
    inner.style.borderRadius = '8px';
    outer.appendChild(inner);

    const text = document.createElement('div');
    text.id = 'loadingText';
    text.className = 'loading-text';
    text.style.marginTop = '8px';
    text.style.color = '#fff';
    text.style.fontWeight = '700';
    text.style.textAlign = 'center';
    text.textContent = 'Cargando el juego... 0%';

    if(introCard){
      const logo = introCard.querySelector('#introLogo') || introCard.querySelector('img');
      if(logo && logo.parentNode === introCard){
        logo.insertAdjacentElement('afterend', outer);
        outer.insertAdjacentElement('afterend', text);
      } else {
        introCard.appendChild(outer);
        introCard.appendChild(text);
      }
    } else {
      introOverlay.appendChild(outer);
      introOverlay.appendChild(text);
    }

    loadingBar = inner;
    loadingText = text;
  }

  return true;
}

function populateIntroParticles(){
  if(!introOverlay) return;
  ensureIntroElements();
  if(!introParticles) return;
  introParticles.innerHTML = '';
  const rect = introOverlay.getBoundingClientRect();
  const count = 12;
  for(let i=0;i<count;i++){
    const span = document.createElement('div');
    span.className = 'bg-item trident';
    span.textContent = '🔱';
    span.style.position = 'absolute';
    span.style.left = `${Math.random() * rect.width}px`;
    span.style.top = `${Math.random() * rect.height}px`;
    span.style.fontSize = `${12 + Math.round(Math.random()*22)}px`;
    span.style.opacity = `${0.04 + Math.random()*0.06}`;
    span.style.transform = `rotate(${(-20 + Math.random()*40).toFixed(1)}deg)`;
    span.style.filter = 'blur(.25px)';
    introParticles.appendChild(span);
  }
}

/* ---------- Loading animation ---------- */
function animateLoading(duration){
  return new Promise(resolve=>{
    if(!ensureIntroElements()){
      setTimeout(resolve, duration);
      return;
    }
    const start = performance.now();
    function step(now){
      const pct = Math.min(1, (now - start) / duration);
      const p = Math.round(pct * 100);
      if(loadingBar) loadingBar.style.width = `${p}%`;
      if(loadingText) loadingText.textContent = `Cargando el juego... ${p}%`;
      if(pct < 1) requestAnimationFrame(step);
      else {
        if(loadingText) loadingText.textContent = 'Listo';
        setTimeout(resolve, 240);
      }
    }
    requestAnimationFrame(step);
  });
}

/* ---------- Banner control ---------- */
function attachStartListener(){
  startBtn = startBtn || by('startBtn');
  if(!startBtn) return;
  startBtn.type = 'button';
  if(startBtn._h) startBtn.removeEventListener('click', startBtn._h);
  startBtn._h = ()=>{ hideBanner(); startGame(); };
  startBtn.addEventListener('click', startBtn._h);
  startBtn.disabled = false;
  startBtn.classList.remove('disabled');
}
function showBanner(){ const b = by('opponentBanner'); if(!b) return; b.classList.remove('hidden'); b.setAttribute('aria-hidden','false'); }
function hideBanner(){ const b = by('opponentBanner'); if(!b) return; b.classList.add('hidden'); b.setAttribute('aria-hidden','true'); }

/* ---------- Intro flow (no auto-start) ---------- */
async function showIntroThenProceed(){
  introOverlay = introOverlay || by('introOverlay');
  introCard = introCard || (introOverlay && introOverlay.querySelector('.intro-card'));

  if(!introOverlay){
    attachStartListener();
    showBanner();
    return;
  }

  introOverlay.classList.remove('hidden');
  introOverlay.setAttribute('aria-hidden','false');

  populateBackground();
  populateIntroParticles();

  try { await animateLoading(INTRO_DURATION); } catch(e){ console.error('animateLoading err', e); }

  introOverlay.classList.add('hidden');
  introOverlay.setAttribute('aria-hidden','true');

  attachStartListener();
  showBanner();
  dbg('Intro finished; banner shown waiting for user');
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', async ()=>{
  // refs
  boardEl = by('board'); cells = Array.from(document.querySelectorAll('.cell')); messageEl = by('message');

  introOverlay = by('introOverlay'); introCard = introOverlay ? introOverlay.querySelector('.intro-card') : null;

  opponentBanner = by('opponentBanner'); startBtn = by('startBtn'); restartBtn = by('restartBtn'); pickX = by('pickX'); pickO = by('pickO');

  playerWinsEl = by('playerWins'); cpuWinsEl = by('cpuWins'); playerBonusPercentEl = by('playerBonusPercent'); cpuBonusPercentEl = by('cpuBonusPercent'); playsLeftEl = by('playsLeft');

  resultModal = by('resultModal'); modalPercent = by('modalPercent'); modalMessage = by('modalMessage'); modalClose = by('modalClose');
  boardLogo = by('boardLogo');

  if(!boardEl || !cells.length || !messageEl){ console.error('FATAL: elementos faltantes'); return; }

  if(pickX) pickX.addEventListener('click', ()=> onPick('X'));
  if(pickO) pickO.addEventListener('click', ()=> onPick('O'));
  if(restartBtn) restartBtn.addEventListener('click', resetGame);
  if(modalClose) modalClose.addEventListener('click', ()=> { hideModal(); /* keep modal hidden until final */ });

  cells.forEach(c => c.addEventListener('click', onCellClick));

  document.addEventListener('keydown', (e)=> {
    if(e.key === 'Enter' && !sessionStarted && opponentBanner && !opponentBanner.classList.contains('hidden')){
      hideBanner(); startGame();
    }
  });

  setActiveChoice();
  loadState();
  resetBoardUI();

  // If already reached the plays limit, show modal (result) and hide intro/banner
  if(state.plays >= MAX_PLAYS){
    if(introOverlay) introOverlay.classList.add('hidden');
    hideBanner();
    // show result modal with bonus (user said result box only after full series)
    const bp = bonusPercent(state.playerWins);
    if(modalPercent) modalPercent.textContent = `${bp}%`;
    if(modalMessage) modalMessage.textContent = (bp>0)?`Has obtenido ${bp}% por ${state.playerWins} victoria(s).`:`No obtuviste bono (0 victorias).`;
    if(resultModal) resultModal.classList.remove('hidden');
  } else {
    await showIntroThenProceed();
  }

  attachStartListener();
  dbg('Init complete');
});

/* ---------- Game logic (igual) ---------- */
function showBoardLogo(){ if(!boardLogo) return; boardLogo.classList.remove('hidden'); boardLogo.style.display='block'; }
function hideBoardLogo(){ if(!boardLogo) return; boardLogo.classList.add('hidden'); boardLogo.style.display='none'; }

function loadState(){ try{ const raw = localStorage.getItem(STORAGE_KEY); if(raw) state = JSON.parse(raw); }catch(e){ state={playerWins:0,cpuWins:0,plays:0}; } updateScoreboardUI(); updatePlaysUI(); checkPlaysLimitUI(); }
function saveState(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){} }

function updateScoreboardUI(){ if(playerWinsEl) playerWinsEl.textContent = `${state.playerWins} / ${MAX_PLAYS}`; if(cpuWinsEl) cpuWinsEl.textContent = `${state.cpuWins} / ${MAX_PLAYS}`; if(playerBonusPercentEl) playerBonusPercentEl.textContent = `Bono: ${bonusPercent(state.playerWins)}%`; if(cpuBonusPercentEl) cpuBonusPercentEl.textContent = `Bono: ${bonusPercent(state.cpuWins)}%`; }
function updatePlaysUI(){ if(playsLeftEl) playsLeftEl.textContent = Math.max(0, MAX_PLAYS - state.plays); }
function bonusPercent(w){ if(w<=0) return 0; if(w===1) return 100; if(w===2) return 150; return 200; }

function checkPlaysLimitUI(){ if(!startBtn) return; if(state.plays >= MAX_PLAYS){ startBtn.disabled=true; startBtn.classList.add('disabled'); message('Has alcanzado el máximo de 3 partidas.'); hideBanner(); if(introOverlay) introOverlay.classList.add('hidden'); hideBoardLogo(); } else { if(sessionStarted){ startBtn.disabled=true; startBtn.classList.add('disabled'); } else { startBtn.disabled=false; startBtn.classList.remove('disabled'); } } }

function setActiveChoice(){ if(!pickX||!pickO) return; pickX.classList.toggle('active', playerSymbol==='X'); pickO.classList.toggle('active', playerSymbol==='O'); }
function onPick(sym){ if(sessionStarted) return; if(sym==='X'){ playerSymbol='X'; cpuSymbol='O'; } else { playerSymbol='O'; cpuSymbol='X'; } setActiveChoice(); }
function resetBoardUI(){ cells.forEach(c=>{ c.innerHTML=''; c.classList.remove('disabled','win'); c.disabled=false; }); }

function startGame(){ if(state.plays >= MAX_PLAYS){ message('No puedes comenzar: alcanzaste el límite.'); return; } sessionStarted=true; checkPlaysLimitUI(); resetBoardUI(); board=Array(9).fill(null); currentTurn=playerSymbol; running=true; cpuThinking=false; message(`Juego iniciado — Tú: ${symbolToEmoji(playerSymbol)}  |  ${cpuName}: ${symbolToEmoji(cpuSymbol)}`); showBoardLogo(); }

function resetGame(){ running=false; cpuThinking=false; board=Array(9).fill(null); resetBoardUI(); if(sessionStarted && state.plays < MAX_PLAYS){ currentTurn=playerSymbol; running=true; message('Partida reiniciada — continúa la serie'); showBoardLogo(); } else { sessionStarted=false; showIntroThenProceed(); message('Juego reiniciado. Mostrando presentación...'); hideBoardLogo(); } }

function onCellClick(e){ if(!running || cpuThinking) return; const idx = Number(e.currentTarget.dataset.index); if(Number.isNaN(idx)) return; if(board[idx]) return; if(currentTurn !== playerSymbol) return; makeMove(idx, playerSymbol); afterMove(); setTimeout(()=>{ if(running && !cpuThinking && currentTurn===cpuSymbol) doCpuTurn(); }, 350); }
function makeMove(i,s){ board[i]=s; const c=cells[i]; if(c){ c.innerHTML=`<span>${symbolToEmoji(s)}</span>`; c.classList.add('disabled'); } }
function afterMove(){ const w=checkWinner(board); if(w){ handleEnd(w); return; } currentTurn = currentTurn==='X'?'O':'X'; if(running && currentTurn===cpuSymbol) doCpuTurn(); }
function doCpuTurn(){ cpuThinking=true; message(`${cpuName} está pensando...`); setTimeout(()=>{ const m = cpuVeryEasyMove(); if(m!==undefined && m!==null) makeMove(m,cpuSymbol); cpuThinking=false; afterMove(); }, 420); }
function cpuVeryEasyMove(){ const blockProb=0.30, heurProb=0.05; const block=findWinningMove(board, playerSymbol); if(block!==null && Math.random()<blockProb) return block; if(Math.random()<heurProb){ if(board[4]===null) return 4; const corners=[0,2,6,8].filter(i=>board[i]===null); if(corners.length) return corners[Math.floor(Math.random()*corners.length)]; const sides=[1,3,5,7].filter(i=>board[i]===null); if(sides.length) return sides[Math.floor(Math.random()*sides.length)]; } return cpuRandomMove(); }
function cpuRandomMove(){ const avail = availableMoves(board); if(avail.length===0) return null; return avail[Math.floor(Math.random()*avail.length)]; }
function availableMoves(b){ return b.map((v,i)=> v===null?i:null).filter(v=>v!==null); }
function findWinningMove(b,sym){ for(const i of availableMoves(b)){ b[i]=sym; const w=checkWinner(b); b[i]=null; if(w===sym) return i; } return null; }
function checkWinner(b){ for(const [a,b1,c] of WIN_COMBINATIONS){ if(b[a] && b[a]===b[b1] && b[a]===b[c]) return b[a]; } if(b.every(v=>v!==null)) return 'D'; return null; }

function handleEnd(winner){
  running=false;
  if(state.plays < MAX_PLAYS) state.plays += 1;

  if(winner === 'D'){
    message('Empate 🙃 — no hay bono adicional');
  } else {
    if(winner === playerSymbol){
      state.playerWins = Math.min(MAX_PLAYS, state.playerWins + 1);
      message('¡Ganaste esta partida! 🎉');
    } else {
      state.cpuWins = Math.min(MAX_PLAYS, state.cpuWins + 1);
      message(`${cpuName} gana esta partida 😢`);
    }
    // resaltar línea ganadora
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
    setTimeout(()=> {
      board = Array(9).fill(null);
      resetBoardUI();
      currentTurn = playerSymbol;
      running = true;
      message(`Siguiente partida iniciada — Partida ${state.plays + 1} de ${MAX_PLAYS}`);
      showBoardLogo();
    }, 900);
  } else {
    // Serie finalizada: mostramos modal de resultado (solo aquí)
    setTimeout(()=> {
      const bp = bonusPercent(state.playerWins);
      if(modalPercent) modalPercent.textContent = `${bp}%`;
      if(modalMessage) modalMessage.textContent = (bp>0) ? `Has obtenido ${bp}% por ${state.playerWins} victoria(s).` : `No obtuviste bono (0 victorias).`;
      if(resultModal) resultModal.classList.remove('hidden');
      hideBoardLogo();
    }, 700);
  }
}

function showModal(){ if(resultModal) resultModal.classList.remove('hidden'); }
function hideModal(){ if(resultModal) resultModal.classList.add('hidden'); }

