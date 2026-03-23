/* === DOM ELEMENTS === */
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const particlesCanvas = document.getElementById('particles');
const particlesCtx = particlesCanvas.getContext('2d');

const holdPieceCanvas = document.getElementById('hold-piece');
const holdPieceContext = holdPieceCanvas.getContext('2d');
const nextQueueCanvas = document.getElementById('next-queue');
const nextQueueContext = nextQueueCanvas.getContext('2d');

const startScreen = document.getElementById('start-screen');
const statusScreen = document.getElementById('status-screen');
const gameWrapper = document.getElementById('game-wrapper');
const canvasContainer = document.getElementById('canvas-container');

const scoreElement = document.getElementById('score');
const levelElement = document.getElementById('level');
const linesElement = document.getElementById('lines');
const highScoreElement = document.getElementById('high-score');
const mScoreElement = document.getElementById('m-score');

const mainStartBtn = document.getElementById('main-start-btn');
const resumeBtn = document.getElementById('resume-btn');
const restartBtn = document.getElementById('restart-btn');
const quitBtn = document.getElementById('quit-btn');
const pauseBtns = document.querySelectorAll('.pause-action');

const startLevelInput = document.getElementById('start-level');
const themeSelect = document.getElementById('theme-select');
const soundBtn = document.getElementById('toggle-sound-btn');

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 30; // 300 / 10

context.scale(BLOCK_SIZE, BLOCK_SIZE);
holdPieceContext.scale(BLOCK_SIZE, BLOCK_SIZE);
nextQueueContext.scale(BLOCK_SIZE, BLOCK_SIZE);

/* === THEME & AUDIO === */
let isSoundEnabled = true;
let currentTheme = 'theme-neon';
let themeColors = [];

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!isSoundEnabled || !audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'move') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'drop') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'clear') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.linearRampToValueAtTime(800, now + 0.1);
            osc.frequency.linearRampToValueAtTime(1200, now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now); osc.stop(now + 0.3);
        } else if (type === 'gameover') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 1.0);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
            osc.start(now); osc.stop(now + 1.0);
        }
    } catch(e) { console.error("Audio error", e); }
}

const THEME_PALETTES = {
    'theme-neon': [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'],
    'theme-retro': [null, '#0f380f', '#0f380f', '#0f380f', '#0f380f', '#0f380f', '#0f380f', '#0f380f'],
    'theme-light': [null, '#E53935', '#039BE5', '#43A047', '#8E24AA', '#F4511E', '#FFB300', '#3949AB']
};

function updateTheme() {
    currentTheme = themeSelect.value;
    document.body.className = currentTheme;
    themeColors = THEME_PALETTES[currentTheme];
}
themeSelect.addEventListener('change', () => {
    updateTheme();
    if(!isPaused) draw(); // Re-render pieces in new colors
});

soundBtn.addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    soundBtn.innerText = isSoundEnabled ? "مفعل" : "معطل";
    soundBtn.style.color = isSoundEnabled ? "inherit" : "red";
    if(isSoundEnabled) initAudio();
});

/* === GAME SHAPES === */
const SHAPES = [
    [],
    [[0,1,0],[1,1,1],[0,0,0]], // T
    [[0,2,0,0],[0,2,0,0],[0,2,0,0],[0,2,0,0]], // I
    [[0,3,3],[3,3,0],[0,0,0]], // S
    [[4,4,0],[0,4,4],[0,0,0]], // Z
    [[0,5,0],[0,5,0],[0,5,5]], // L
    [[0,6,0],[0,6,0],[6,6,0]], // J
    [[7,7],[7,7]], // O
];

/* === GAME STATE VARS === */
function createMatrix(w, h) { return Array.from({length: h}, () => new Array(w).fill(0)); }

let board = createMatrix(COLS, ROWS);
const player = { pos: {x: 0, y: 0}, matrix: null, score: 0, lines: 0, level: 1 };
let pieceQueue = [];
let holdPieceMatrix = null;
let canHold = true;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let animationId = null;
let isGameOver = false;
let isPaused = true;
let highScore = localStorage.getItem('tetrisProHighScore') || 0;
highScoreElement.innerText = highScore;

/* === PARTICLES SYSTEM === */
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        this.vx = (Math.random() - 0.5) * 8; // random horizontal explosion velocity
        this.vy = (Math.random() - 0.5) * 8; // random vertical explosion velocity
        this.life = 1.0;
        this.color = color;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.life -= 0.04;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        // Drawing smaller blocks for particles
        ctx.fillRect(this.x, this.y, 4, 4);
        ctx.globalAlpha = 1.0;
    }
}
let particles = [];

function addExplosion(y, rowArray) {
    // Screen shake
    canvasContainer.classList.remove('shake'); // reset if already shaking
    void canvasContainer.offsetWidth; // trigger reflow
    canvasContainer.classList.add('shake');
    setTimeout(() => canvasContainer.classList.remove('shake'), 400);
    
    // Create particles from the cleared row colors
    rowArray.forEach((val, x) => {
        if(val !== 0) {
            const px = x * BLOCK_SIZE + BLOCK_SIZE/2;
            const py = y * BLOCK_SIZE + BLOCK_SIZE/2;
            // 6 particles per block
            for(let i=0; i<6; i++) {
                particles.push(new Particle(px, py, themeColors[val]));
            }
        }
    });
}

function updateParticles() {
    particlesCtx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
    for(let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw(particlesCtx);
        if(particles[i].life <= 0) particles.splice(i, 1);
    }
}

/* === RENDERING === */
function drawMatrix(matrix, offset, ctx = context, isGhost = false) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                if (isGhost) {
                    ctx.fillStyle = currentTheme === 'theme-retro' ? 'rgba(15, 56, 15, 0.2)' : 'rgba(255, 255, 255, 0.15)';
                    ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
                    ctx.strokeStyle = currentTheme === 'theme-retro' ? 'rgba(15, 56, 15, 0.5)' : 'rgba(255, 255, 255, 0.3)';
                    ctx.lineWidth = 0.05;
                    ctx.strokeRect(x + offset.x, y + offset.y, 1, 1);
                } else {
                    ctx.fillStyle = themeColors[value];
                    ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
                    
                    if(currentTheme !== 'theme-retro') {
                        // Gloss effect
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                        ctx.fillRect(x + offset.x, y + offset.y, 1, 0.2);
                    }
                    
                    ctx.strokeStyle = currentTheme === 'theme-retro' ? '#9bbc0f' : 'rgba(0, 0, 0, 0.5)';
                    ctx.lineWidth = 0.05;
                    ctx.strokeRect(x + offset.x, y + offset.y, 1, 1);
                }
            }
        });
    });
}

function drawGhost() {
    const ghost = { matrix: player.matrix, pos: {x: player.pos.x, y: player.pos.y} };
    while (!collide(board, ghost)) ghost.pos.y++;
    ghost.pos.y--; // Rest position
    drawMatrix(ghost.matrix, ghost.pos, context, true);
}

function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawMatrix(board, {x: 0, y: 0});
    if (player.matrix && !isPaused && !isGameOver) {
        drawGhost();
        drawMatrix(player.matrix, player.pos);
    }
}

function drawMiniPiece(matrix, ctx, canvasElement, offsetY = 0) {
    if (offsetY === 0) {
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }
    if (matrix) {
        // Center the piece horizontally
        const oX = 2 - Math.floor(matrix[0].length / 2);
        const oY = offsetY + 1; // Slight gap top
        drawMatrix(matrix, {x: oX, y: oY}, ctx);
    }
}

function drawQueue() {
    nextQueueContext.clearRect(0, 0, nextQueueCanvas.width, nextQueueCanvas.height);
    // Draw 3 pieces vertically
    pieceQueue.forEach((piece, index) => {
        drawMiniPiece(piece, nextQueueContext, nextQueueCanvas, index * 3);
    });
}

function drawHoldPiece() {
    drawMiniPiece(holdPieceMatrix, holdPieceContext, holdPieceCanvas);
}

/* === GAME LOGIC === */
function getRandomPiece() {
    const index = Math.floor(Math.random() * (SHAPES.length - 1)) + 1;
    return JSON.parse(JSON.stringify(SHAPES[index]));
}

function initQueue() {
    pieceQueue = [];
    while(pieceQueue.length < 3) pieceQueue.push(getRandomPiece());
}

function playerReset() {
    if(pieceQueue.length === 0) initQueue();
    player.matrix = pieceQueue.shift();
    pieceQueue.push(getRandomPiece());
    drawQueue();
    
    player.pos.y = 0;
    player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);
    canHold = true;
    
    if (collide(board, player)) {
        triggerGameOver();
    }
}

function collide(board, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 && (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function merge(board, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) board[y + player.pos.y][x + player.pos.x] = value;
        });
    });
}

function arenaSweep() {
    let rowCount = 0;
    outer: for (let y = board.length - 1; y >= 0; --y) {
        for (let x = 0; x < board[y].length; ++x) {
            if (board[y][x] === 0) continue outer;
        }

        const row = board.splice(y, 1)[0]; // Remove full row
        addExplosion(y, row); // Spawn visual particles for the cleared line
        board.unshift(new Array(COLS).fill(0)); // Add empty row at top
        ++y; // Recheck this y because everything shifted down
        rowCount++;
    }

    if (rowCount > 0) {
        playSound('clear');
        const points = [0, 40, 100, 300, 1200];
        player.score += points[rowCount] * player.level;
        player.lines += rowCount;
        
        // Calculate dynamic level based on starting level
        const startLvl = parseInt(startLevelInput.value) || 1;
        player.level = startLvl + Math.floor(player.lines / 10);
        dropInterval = Math.max(80, 1000 - (player.level - 1) * 85);
        
        updateScore();
    } else {
        playSound('drop');
    }
}

function playerDrop() {
    if (isPaused || isGameOver) return;
    player.pos.y++;
    if (collide(board, player)) {
        player.pos.y--;
        merge(board, player);
        arenaSweep();
        playerReset();
    }
    dropCounter = 0;
}

function hardDrop() {
    if (isPaused || isGameOver) return;
    while (!collide(board, player)) {
        player.pos.y++;
    }
    player.pos.y--;
    merge(board, player);
    arenaSweep();
    playerReset();
    dropCounter = 0;
    draw(); // Draw immediately so player sees it drop before next frame
}

function playerMove(dir) {
    if (isPaused || isGameOver) return;
    player.pos.x += dir;
    if (collide(board, player)) {
        player.pos.x -= dir;
    } else {
        playSound('move');
    }
}

function rotate(matrix, dir) {
    const rotated = matrix.map((_, i) => matrix.map(row => row[i]));
    return dir > 0 ? rotated.map(row => row.reverse()) : rotated.reverse();
}

function playerRotate(dir) {
    if (isPaused || isGameOver) return;
    const pos = player.pos.x;
    let offset = 1;
    player.matrix = rotate(player.matrix, dir);
    // Wall kick
    while (collide(board, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            player.matrix = rotate(player.matrix, -dir); // Revert
            player.pos.x = pos;
            return;
        }
    }
    playSound('move');
}

function holdPiece() {
    if (isPaused || isGameOver || !canHold) return;
    
    if (holdPieceMatrix === null) {
        holdPieceMatrix = player.matrix;
        playerReset();
    } else {
        const temp = player.matrix;
        player.matrix = holdPieceMatrix;
        holdPieceMatrix = temp;
        player.pos.y = 0;
        player.pos.x = Math.floor(COLS / 2) - Math.floor(player.matrix[0].length / 2);
    }
    canHold = false;
    drawHoldPiece();
    dropCounter = 0;
}

function triggerGameOver() {
    isGameOver = true;
    isPaused = true;
    playSound('gameover');
    
    if (player.score > highScore) {
        highScore = player.score;
        localStorage.setItem('tetrisProHighScore', highScore);
        highScoreElement.innerText = highScore;
    }
    
    document.getElementById('status-title').innerText = "انتهت اللعبة! 💥";
    document.getElementById('final-score-display').classList.remove('hidden');
    document.getElementById('final-score').innerText = player.score;
    
    resumeBtn.classList.add('hidden');
    restartBtn.classList.remove('hidden');
    statusScreen.classList.remove('hidden');
    cancelAnimationFrame(animationId);
}

function updateScore() {
    scoreElement.innerText = player.score;
    mScoreElement.innerText = player.score;
    levelElement.innerText = player.level;
    linesElement.innerText = player.lines;
}

function update(time = 0) {
    if (isPaused || isGameOver) return;
    
    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

    draw();
    updateParticles();
    animationId = requestAnimationFrame(update);
}

/* === FLOW CONTROL === */
function togglePause() {
    if(isGameOver || startScreen.classList.contains('visible')) return;
    isPaused = !isPaused;
    
    if(isPaused) {
        document.getElementById('status-title').innerText = "إيقاف مؤقت ⏸️";
        document.getElementById('final-score-display').classList.add('hidden');
        resumeBtn.classList.remove('hidden');
        restartBtn.classList.remove('hidden');
        statusScreen.classList.remove('hidden');
        cancelAnimationFrame(animationId);
    } else {
        statusScreen.classList.add('hidden');
        lastTime = performance.now();
        update(lastTime);
    }
}

function startGame() {
    if(isSoundEnabled) initAudio();
    updateTheme();
    
    board = createMatrix(COLS, ROWS);
    player.score = 0;
    player.lines = 0;
    player.level = parseInt(startLevelInput.value) || 1;
    dropInterval = Math.max(80, 1000 - (player.level - 1) * 85);
    
    isGameOver = false;
    isPaused = false;
    holdPieceMatrix = null;
    particles = [];
    drawHoldPiece();
    
    startScreen.classList.remove('visible');
    startScreen.classList.add('hidden');
    statusScreen.classList.add('hidden');
    gameWrapper.classList.remove('hidden');
    
    updateScore();
    initQueue();
    playerReset(); // Spawns first piece
    
    lastTime = performance.now();
    cancelAnimationFrame(animationId);
    update(lastTime);
}

/* === EVENT LISTENERS === */
mainStartBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
resumeBtn.addEventListener('click', togglePause);
pauseBtns.forEach(b => b.addEventListener('click', togglePause));

quitBtn.addEventListener('click', () => {
    isPaused = true;
    cancelAnimationFrame(animationId);
    statusScreen.classList.add('hidden');
    gameWrapper.classList.add('hidden');
    startScreen.classList.remove('hidden');
    startScreen.classList.add('visible');
});

// Initial Setup Call
updateTheme();

document.addEventListener('keydown', event => {
    if (startScreen.classList.contains('visible')) return;
    if (event.key.toLowerCase() === 'p' || event.key === 'Escape') {
        togglePause();
        return;
    }
    if (isGameOver && event.key === 'Enter') {
        startGame();
        return;
    }
    if (isPaused) return;
    
    switch (event.key) {
        case 'ArrowLeft': playerMove(-1); break;
        case 'ArrowRight': playerMove(1); break;
        case 'ArrowDown': playerDrop(); break;
        case 'ArrowUp': playerRotate(1); break;
        case ' ': event.preventDefault(); hardDrop(); break;
        case 'c': case 'C': holdPiece(); break;
    }
});

/* Mobile Controls */
function addControl(id, action) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if(!isPaused && !isGameOver) action();
    });
}
addControl('btn-left', () => playerMove(-1));
addControl('btn-right', () => playerMove(1));
addControl('btn-down', () => playerDrop());
addControl('btn-rotate', () => playerRotate(1));
addControl('btn-drop', () => hardDrop());
addControl('btn-hold', () => holdPiece());

// Prevent scrolling on mobile when swiping canvas or buttons
document.addEventListener('touchmove', function(e) {
    if(!startScreen.classList.contains('visible') && e.target.tagName !== 'SELECT' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
    }
}, { passive: false });
