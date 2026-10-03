const wrapper = document.getElementById('gameWrapper');
const road = document.getElementById('road');
const laneContainer = document.getElementById('laneContainer');
const playerCar = document.getElementById('playerCar');
const scoreEl = document.getElementById('scoreVal');
const speedEl = document.getElementById('speedVal');
const levelEl = document.getElementById('levelVal');
const livesEl = document.getElementById('livesVal');
const comboEl = document.getElementById('combo');
const comboValEl = document.getElementById('comboVal');
const nitroFill = document.getElementById('nitroFill');
const nitroTrail = document.getElementById('nitroTrail');
const flash = document.getElementById('flashOverlay');
const lBanner = document.getElementById('levelBanner');
const lbTitle = document.getElementById('lbTitle');
const cursor = document.getElementById('cursor');

const ROAD_LEFT = 118;
const ROAD_RIGHT = 300;
const PLAYER_CAR_WIDTH = 48;
const PLAYER_CAR_HEIGHT = 90;
const PLAYER_BASE_Y = 60;

const state = {
  running: false,
  paused: false,
  score: 0,
  lives: 3,
  level: 1,
  speed: 3.5,
  playerX: 210,
  combo: 0,
  comboTimer: 0,
  nitro: 100,
  nitroActive: false,
  invincible: false,
  invTimer: 0,
  enemies: [],
  obstacles: [],
  powerups: [],
  spawnTimer: 0,
  spawnInterval: 90,
  levelTimer: 0,
  levelInterval: 600,
  keys: {},
  mLeft: false,
  mRight: false,
  mNitro: false,
  bestScore: Number(localStorage.getItem('trBest') || 0),
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function makeStars() {
  const sky = document.getElementById('sky');
  for (let i = 0; i < 80; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = Math.random() * 2 + 0.5;
    star.style.cssText = `
      width:${size}px;
      height:${size}px;
      left:${Math.random() * 100}%;
      top:${Math.random() * 100}%;
      --d:${(Math.random() * 2 + 1).toFixed(1)}s;
      --min:${(Math.random() * 0.35 + 0.1).toFixed(2)};
    `;
    sky.appendChild(star);
  }
}

function makeLanes() {
  laneContainer.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const stripe = document.createElement('div');
    stripe.className = 'laneStripe';
    stripe.style.top = (i * 120 - 60) + 'px';
    stripe.style.animationDelay = (i * 0.08) + 's';
    laneContainer.appendChild(stripe);
  }
}

function drawGrid() {
  const canvas = document.getElementById('groundGrid');
  const width = wrapper.clientWidth;
  const height = wrapper.clientHeight * 0.68;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(0, 207, 255, 0.14)';
  ctx.lineWidth = 1;

  const rows = 12;
  const cols = 8;

  for (let r = 0; r <= rows; r++) {
    const y = (r / rows) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  for (let c = 0; c <= cols; c++) {
    const xTop = width / 2 + (c / cols - 0.5) * width * 0.5;
    const xBot = (c / cols) * width;
    ctx.beginPath();
    ctx.moveTo(xTop, 0);
    ctx.lineTo(xBot, height);
    ctx.stroke();
  }
}

const enemyColors = ['#00cfff', '#7722ff', '#22ff77', '#ff9900', '#ff22cc'];
const enemyNums = ['07', '13', '23', '42', '99'];

function makeEnemySVG(color, num) {
  return `
    <svg viewBox="0 0 50 88" width="50" height="88" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 68 L6 28 Q25 12 44 28 L42 68 Z" fill="${color}33"/>
      <path d="M8 68 L6 28 Q25 12 44 28 L42 68 Z" fill="${color}" opacity="0.15"/>
      <path d="M13 46 L11 27 Q25 16 39 27 L37 46 Z" fill="${color}44"/>
      <path d="M15 44 L13 28 Q25 20 37 28 L35 44 Z" fill="#001122" opacity="0.8"/>
      <rect x="11" y="22" width="7" height="4" rx="2" fill="#ff4444"/>
      <rect x="32" y="22" width="7" height="4" rx="2" fill="#ff4444"/>
      <rect x="9" y="64" width="7" height="4" rx="2" fill="${color}" opacity="0.8"/>
      <rect x="34" y="64" width="7" height="4" rx="2" fill="${color}" opacity="0.8"/>
      <rect x="3" y="28" width="7" height="16" rx="3.5" fill="#111"/>
      <rect x="40" y="28" width="7" height="16" rx="3.5" fill="#111"/>
      <rect x="3" y="54" width="7" height="16" rx="3.5" fill="#111"/>
      <rect x="40" y="54" width="7" height="16" rx="3.5" fill="#111"/>
      <text x="25" y="52" text-anchor="middle" fill="${color}" font-size="8" font-family="Orbitron" font-weight="900" opacity="0.8">${num}</text>
    </svg>
  `;
}

const obstacleSVG = `
  <svg viewBox="0 0 40 40" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
    <polygon points="20,2 38,38 2,38" fill="#ff440022" stroke="#ff4400" stroke-width="2"/>
    <text x="20" y="30" text-anchor="middle" fill="#ff4400" font-size="18" font-family="Orbitron">⚠</text>
  </svg>
`;

const powerupTypes = [
  { emoji: '⚡', color: '#ffe600', type: 'nitro', label: '+NITRO' },
  { emoji: '❤️', color: '#ff2244', type: 'life', label: '+LIFE' },
  { emoji: '🛡️', color: '#00cfff', type: 'shield', label: 'SHIELD' },
  { emoji: '🌀', color: '#7722ff', type: 'slow', label: 'SLOW MO' },
];

function spawnEnemy() {
  const laneW = 180 / 3;
  const lane = Math.floor(Math.random() * 3);
  const xBase = ROAD_LEFT + lane * laneW + laneW / 2 - 25;
  const x = xBase + (Math.random() - 0.5) * 20;
  const color = enemyColors[Math.floor(Math.random() * enemyColors.length)];
  const num = enemyNums[Math.floor(Math.random() * enemyNums.length)];
  const el = document.createElement('div');
  el.className = 'enemyCar';
  el.innerHTML = makeEnemySVG(color, num);
  el.style.left = x + 'px';
  el.style.top = '-100px';
  wrapper.appendChild(el);

  state.enemies.push({ el, x, y: -100, color });
}

function spawnObstacle() {
  const x = ROAD_LEFT + Math.random() * (ROAD_RIGHT - ROAD_LEFT - 40);
  const el = document.createElement('div');
  el.className = 'obstacle';
  el.innerHTML = obstacleSVG;
  el.style.left = x + 'px';
  el.style.top = '-80px';
  wrapper.appendChild(el);

  state.obstacles.push({ el, x, y: -80 });
}

function spawnPowerup() {
  const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
  const x = ROAD_LEFT + 18 + Math.random() * (ROAD_RIGHT - ROAD_LEFT - 36);
  const el = document.createElement('div');
  el.className = 'powerup';
  el.textContent = type.emoji;
  el.style.left = x + 'px';
  el.style.color = type.color;
  el.style.background = type.color + '22';
  el.style.border = `2px solid ${type.color}44`;
  el.style.boxShadow = `0 0 12px ${type.color}88`;
  wrapper.appendChild(el);

  state.powerups.push({ el, x, y: -60, type: type.type, label: type.label, color: type.color });
}

function burst(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const angle = (i / count) * Math.PI * 2;
    const distance = 30 + Math.random() * 50;
    const duration = 0.4 + Math.random() * 0.6;

    p.style.cssText = `
      left:${x}px;
      top:${y}px;
      width:${4 + Math.random() * 6}px;
      height:${4 + Math.random() * 6}px;
      background:${color};
      box-shadow: 0 0 6px ${color};
      --tx:${Math.cos(angle) * distance}px;
      --ty:${Math.sin(angle) * distance}px;
      --dur:${duration}s;
    `;

    wrapper.appendChild(p);
    setTimeout(() => p.remove(), duration * 1000);
  }
}

function scorePopup(x, y, text, color) {
  const popup = document.createElement('div');
  popup.className = 'scorePopup';
  popup.textContent = text;
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';
  popup.style.color = color;
  popup.style.textShadow = `0 0 10px ${color}`;
  wrapper.appendChild(popup);
  setTimeout(() => popup.remove(), 1000);
}

function flashScreen(color, dur = 200) {
  flash.style.background = color;
  flash.style.opacity = '0.45';
  setTimeout(() => {
    flash.style.opacity = '0';
  }, dur);
}

function shakeScreen() {
  wrapper.style.animation = 'shake 0.4s ease';
  setTimeout(() => {
    wrapper.style.animation = '';
  }, 400);
}

function collides(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function updateHUD() {
  scoreEl.textContent = Math.floor(state.score);
  speedEl.textContent = Math.floor(state.speed * 8) + ' km/h';
  levelEl.textContent = state.level;
  livesEl.textContent = '❤️'.repeat(state.lives) + (state.lives < 3 ? '🖤'.repeat(3 - state.lives) : '');
  nitroFill.style.width = state.nitro + '%';
}

function levelUp() {
  state.level += 1;
  state.speed = 3.5 + state.level * 0.7;
  state.spawnInterval = Math.max(35, 90 - state.level * 8);
  lbTitle.textContent = 'LEVEL ' + state.level;
  lBanner.classList.add('show');
  flashScreen('#00ff44', 300);
  burst(210, 300, '#39ff14', 20);
  setTimeout(() => {
    lBanner.classList.remove('show');
  }, 1800);
}

function hitPlayer(x, y) {
  if (state.invincible) return;

  state.lives -= 1;
  state.combo = 0;
  comboEl.style.opacity = '0';
  burst(x || state.playerX, y || (wrapper.clientHeight - PLAYER_BASE_Y - 48), '#ff2244', 18);
  flashScreen('#ff0000', 400);
  shakeScreen();
  state.invincible = true;
  state.invTimer = 120;

  let blinks = 0;
  const blinkInterval = setInterval(() => {
    playerCar.style.opacity = blinks % 2 === 0 ? '0.3' : '1';
    blinks++;
    if (blinks > 10) {
      clearInterval(blinkInterval);
      playerCar.style.opacity = '1';
    }
  }, 80);

  updateHUD();

  if (state.lives <= 0) {
    gameOver();
  }
}

let lastTime = 0;

function loop(ts) {
  if (!state.running) return;
  if (state.paused) {
    requestAnimationFrame(loop);
    return;
  }

  const dt = Math.min((ts - lastTime) / 16.67, 3);
  lastTime = ts;

  const wH = wrapper.clientHeight;
  const baseSpeed = state.speed * dt;
  const spd = state.nitroActive ? baseSpeed * 1.8 : baseSpeed;

  let dx = 0;
  if (state.keys.ArrowLeft || state.keys.a || state.keys.A || state.mLeft) dx -= 4.5;
  if (state.keys.ArrowRight || state.keys.d || state.keys.D || state.mRight) dx += 4.5;
  if (state.nitroActive) dx *= 1.2;

  state.playerX = clamp(state.playerX + dx * dt, ROAD_LEFT + 12, ROAD_RIGHT - 12);
  playerCar.style.left = state.playerX + 'px';

  const tilt = dx * 1.8;
  playerCar.style.transform = `translateX(-50%) rotate(${tilt}deg)`;

  const wantNitro = state.keys[' '] || state.mNitro;
  if (wantNitro && state.nitro > 0) {
    state.nitroActive = true;
    state.nitro = Math.max(0, state.nitro - 1.2 * dt);
    nitroTrail.style.opacity = '1';
  } else {
    state.nitroActive = false;
    state.nitro = Math.min(100, state.nitro + 0.3 * dt);
    nitroTrail.style.opacity = '0';
  }

  state.score += spd * 0.15 * (state.combo ? 1 + state.combo * 0.1 : 1);

  if (state.combo > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      state.combo = 0;
      comboEl.style.opacity = '0';
    }
  }

  if (state.invincible) {
    state.invTimer -= dt;
    if (state.invTimer <= 0) {
      state.invincible = false;
      playerCar.style.opacity = '1';
    }
  }

  state.spawnTimer += dt;
  if (state.spawnTimer >= state.spawnInterval) {
    state.spawnTimer = 0;
    const roll = Math.random();
    if (roll < 0.55) {
      spawnEnemy();
    } else if (roll < 0.75) {
      spawnObstacle();
    } else {
      spawnPowerup();
    }
  }

  state.levelTimer += dt;
  if (state.levelTimer >= state.levelInterval) {
    state.levelTimer = 0;
    levelUp();
  }

  const pLeft = state.playerX - PLAYER_CAR_WIDTH / 2;
  const pTop = wH - PLAYER_BASE_Y - PLAYER_CAR_HEIGHT;
  const pRight = pLeft + PLAYER_CAR_WIDTH;
  const pBottom = pTop + PLAYER_CAR_HEIGHT;

  state.enemies = state.enemies.filter((enemy) => {
    enemy.y += spd * 1.1;
    enemy.el.style.top = enemy.y + 'px';

    if (collides(pLeft, pTop, PLAYER_CAR_WIDTH, PLAYER_CAR_HEIGHT, enemy.x, enemy.y, 50, 88)) {
      if (!state.invincible) {
        hitPlayer(enemy.x + 25, enemy.y + 44);
        burst(enemy.x + 25, enemy.y + 44, enemy.color, 16);
        enemy.el.remove();
        return false;
      }
    }

    if (enemy.y > pBottom && enemy.y < pBottom + spd * 2 && !enemy._passed) {
      enemy._passed = true;
      state.combo += 1;
      state.comboTimer = 180;
      comboEl.style.opacity = '1';
      comboValEl.textContent = 'x' + state.combo;
      scorePopup(enemy.x, enemy.y, '+' + (10 * state.combo), '#39ff14');
      state.score += 10 * state.combo;
    }

    if (enemy.y > wH + 100) {
      enemy.el.remove();
      return false;
    }

    return true;
  });

  state.obstacles = state.obstacles.filter((obstacle) => {
    obstacle.y += spd * 0.95;
    obstacle.el.style.top = obstacle.y + 'px';

    if (collides(pLeft, pTop, PLAYER_CAR_WIDTH, PLAYER_CAR_HEIGHT, obstacle.x, obstacle.y, 40, 40)) {
      if (!state.invincible) {
        hitPlayer(obstacle.x + 20, obstacle.y + 20);
        obstacle.el.remove();
        return false;
      }
    }

    if (obstacle.y > wH + 80) {
      obstacle.el.remove();
      return false;
    }

    return true;
  });

  state.powerups = state.powerups.filter((powerup) => {
    powerup.y += spd * 0.85;
    powerup.el.style.top = powerup.y + 'px';

    if (collides(pLeft, pTop, PLAYER_CAR_WIDTH, PLAYER_CAR_HEIGHT, powerup.x - 18, powerup.y - 18, 36, 36)) {
      applyPowerup(powerup);
      powerup.el.remove();
      return false;
    }

    if (powerup.y > wH + 60) {
      powerup.el.remove();
      return false;
    }

    return true;
  });

  const stripes = laneContainer.querySelectorAll('.laneStripe');
  stripes.forEach((stripe) => {
    stripe.style.animationDuration = (0.5 / spd) * 3 + 's';
  });

  updateHUD();
  requestAnimationFrame(loop);
}

function applyPowerup(powerup) {
  burst(powerup.x, powerup.y, powerup.color, 14);
  scorePopup(powerup.x, powerup.y, powerup.label, powerup.color);
  flashScreen(powerup.color, 200);

  switch (powerup.type) {
    case 'nitro':
      state.nitro = Math.min(100, state.nitro + 50);
      break;
    case 'life':
      if (state.lives < 3) {
        state.lives += 1;
      }
      updateHUD();
      break;
    case 'shield':
      state.invincible = true;
      state.invTimer = 300;
      flashScreen('#00cfff', 150);
      break;
    case 'slow': {
      const prev = state.speed;
      state.speed *= 0.5;
      setTimeout(() => {
        state.speed = prev;
      }, 3000);
      break;
    }
    default:
      break;
  }
}

function startGame() {
  wrapper.querySelectorAll('.enemyCar, .obstacle, .powerup, .particle, .scorePopup').forEach((el) => el.remove());

  document.getElementById('startScreen').style.display = 'none';
  document.getElementById('gameOverScreen').style.display = 'none';
  document.getElementById('pauseScreen').style.display = 'none';

  state.running = true;
  state.paused = false;
  state.score = 0;
  state.lives = 3;
  state.level = 1;
  state.speed = 3.5;
  state.playerX = 210;
  state.combo = 0;
  state.comboTimer = 0;
  state.nitro = 100;
  state.nitroActive = false;
  state.invincible = false;
  state.invTimer = 0;
  state.enemies = [];
  state.obstacles = [];
  state.powerups = [];
  state.spawnTimer = 0;
  state.spawnInterval = 90;
  state.levelTimer = 0;
  state.levelInterval = 600;

  comboEl.style.opacity = '0';
  nitroTrail.style.opacity = '0';
  playerCar.style.opacity = '1';
  playerCar.style.left = state.playerX + 'px';

  updateHUD();
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function gameOver() {
  state.running = false;

  if (state.score > state.bestScore) {
    state.bestScore = Math.floor(state.score);
    localStorage.setItem('trBest', String(state.bestScore));
  }

  document.getElementById('finalScore').textContent = Math.floor(state.score);
  document.getElementById('finalLevel').textContent = state.level;
  document.getElementById('finalBest').textContent = state.bestScore;
  document.getElementById('gameOverScreen').style.display = 'flex';
  flashScreen('#ff0000', 500);
}

function showStart() {
  state.running = false;
  wrapper.querySelectorAll('.enemyCar, .obstacle, .powerup').forEach((node) => node.remove());
  document.getElementById('gameOverScreen').style.display = 'none';
  document.getElementById('pauseScreen').style.display = 'none';
  document.getElementById('startScreen').style.display = 'flex';
}

function togglePause() {
  if (!state.running) return;

  state.paused = !state.paused;
  document.getElementById('pauseScreen').style.display = state.paused ? 'flex' : 'none';

  if (!state.paused) {
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}

document.addEventListener('keydown', (event) => {
  state.keys[event.key] = true;

  if (event.key === 'p' || event.key === 'P') {
    togglePause();
  }

  if ([' ', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
  }
});

document.addEventListener('keyup', (event) => {
  state.keys[event.key] = false;
});

const mLeft = document.getElementById('mLeft');
const mRight = document.getElementById('mRight');
const mNitro = document.getElementById('mNitro');

mLeft.addEventListener('touchstart', () => { state.mLeft = true; }, { passive: true });
mLeft.addEventListener('touchend', () => { state.mLeft = false; });
mLeft.addEventListener('mousedown', () => { state.mLeft = true; });
mLeft.addEventListener('mouseup', () => { state.mLeft = false; });

mRight.addEventListener('touchstart', () => { state.mRight = true; }, { passive: true });
mRight.addEventListener('touchend', () => { state.mRight = false; });
mRight.addEventListener('mousedown', () => { state.mRight = true; });
mRight.addEventListener('mouseup', () => { state.mRight = false; });

mNitro.addEventListener('touchstart', () => { state.mNitro = true; }, { passive: true });
mNitro.addEventListener('touchend', () => { state.mNitro = false; });
mNitro.addEventListener('mousedown', () => { state.mNitro = true; });
mNitro.addEventListener('mouseup', () => { state.mNitro = false; });

document.addEventListener('mousemove', (event) => {
  cursor.style.left = event.clientX + 'px';
  cursor.style.top = event.clientY + 'px';
});

makeStars();
makeLanes();
drawGrid();
updateHUD();
playerCar.style.left = state.playerX + 'px';
