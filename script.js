const board = document.getElementById("board");
const log = document.getElementById("log");
const guessCountDisplay = document.getElementById("guess-count");
const revealBtn = document.getElementById("reveal");

let atomCount = 4;
const SIZE = 10;
let atoms = [];
let guessCount = 0;
let playerGuesses = [];
let usedRays = new Set();
let revealed = false;

let raysAbsorbed = 0;
let raysReflected = 0;
let raysExited = 0;

function startGame(count) {
  atomCount = count;
  atoms = generateRandomAtoms(atomCount);
  document.getElementById("difficulty-screen").style.display = "none";
  document.getElementById("game-container").style.display = "flex";
  buildBoard();
  resetStats();
  updateGuessCount();
  revealed = false;
}

function resetStats() {
  guessCount = 0;
  raysAbsorbed = 0;
  raysReflected = 0;
  raysExited = 0;
  usedRays.clear();
  playerGuesses = [];
  log.innerHTML = "<h2>Game Log</h2>";
}

function generateRandomAtoms(count) {
  const positions = new Set();
  while (positions.size < count) {
    const r = Math.floor(Math.random() * 8) + 1;
    const c = Math.floor(Math.random() * 8) + 1;
    positions.add(r * SIZE + c);
  }
  return Array.from(positions);
}

function buildBoard() {
  board.innerHTML = "";
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");

      if ((r === 0 || r === SIZE - 1 || c === 0 || c === SIZE - 1) &&
        !(r === 0 && c === 0) && !(r === 0 && c === SIZE - 1) &&
        !(r === SIZE - 1 && c === 0) && !(r === SIZE - 1 && c === SIZE - 1)) {
        const num = getBorderNumber(r, c);
        if (num !== null) {
          cell.classList.add("border");
          cell.textContent = num;
          cell.id = `border-${num}`;
          cell.addEventListener("click", () => fireRay(num, cell));
        }
      } else {
        cell.addEventListener('click', () => handleCellClick(r, c));
      }

      board.appendChild(cell);
    }
  }
}

function getBorderNumber(r, c) {
  if (r === 0 && c >= 1 && c <= 8) return c;
  if (c === 9 && r >= 1 && r <= 8) return 8 + r;
  if (r === 9 && c >= 1 && c <= 8) return 25 - c;
  if (c === 0 && r >= 1 && r <= 8) return 33 - r;
  return null;
}

function getEntry(num) {
  if (num >= 1 && num <= 8) // Top edge
    return { pos: { r: 0, c: num }, dir: { r: 1, c: 0 } };

  if (num >= 9 && num <= 16) // Right edge
    return { pos: { r: num - 8, c: 9 }, dir: { r: 0, c: -1 } };

  if (num >= 17 && num <= 24) // Bottom edge
    return { pos: { r: 9, c: 25 - num }, dir: { r: -1, c: 0 } };

  if (num >= 25 && num <= 32) // Left edge
    return { pos: { r: 33 - num, c: 0 }, dir: { r: 0, c: 1 } };

  if (num === 33) // Special top-left just inside the board
    return { pos: { r: 1, c: 0 }, dir: { r: 0, c: 1 } };

  if (num === 34) // Special bottom-left just inside the board
    return { pos: { r: 8, c: 0 }, dir: { r: 0, c: 1 } };

  return null;
}


function fireRay(entry, cell) {
  if (usedRays.has(entry) || revealed) return;

  usedRays.add(entry);
  cell.style.backgroundColor = "#aaa"; // Visually gray the used ray
  guessCount++;
  updateGuessCount();

  let { pos, dir } = getEntry(entry);

  // Calculate the first cell inside the board the ray would move into
  const firstInside = { r: pos.r + dir.r, c: pos.c + dir.c };

  // If firstInside is inside playable area, check special rules:
  if (firstInside.r > 0 && firstInside.r < SIZE - 1 && firstInside.c > 0 && firstInside.c < SIZE - 1) {
    const firstIdx = firstInside.r * SIZE + firstInside.c;

    // 1) If the first inside cell itself contains an atom --> Absorbed immediately.
    if (atoms.includes(firstIdx)) {
      raysAbsorbed++;
      log.innerHTML += `<div>Ray ${entry} → Absorbed</div>`;
      return;
    }

    // 2) SPECIAL RULE:
    // If there exists ANY atom that is on the *first-inner layer*
    // (row 1 or row SIZE-2 (8), or col 1 or col SIZE-2 (8))
    // and that atom is 4-neighbor adjacent (manhattan distance == 1) to the firstInside cell
    // then ray reflects instantly (does NOT enter the board).
    const instantReflect = atoms.some(aIdx => {
      const ar = Math.floor(aIdx / SIZE);
      const ac = aIdx % SIZE;
      const isFirstInnerLayer = (ar === 1 || ar === SIZE - 2 || ac === 1 || ac === SIZE - 2);
      if (!isFirstInnerLayer) return false;
      const manhattan = Math.abs(ar - firstInside.r) + Math.abs(ac - firstInside.c);
      return manhattan === 1;
    });

    if (instantReflect) {
      raysReflected++;
      log.innerHTML += `<div>Ray ${entry} → Reflected </div>`;
      return;
    }
  }

  // Otherwise, proceed with normal simulation
  let firstMove = true;

  while (true) {
    pos = { r: pos.r + dir.r, c: pos.c + dir.c };

    // If we hit the border again -> exit or reflection if same entry and first move
    if (pos.r === 0 || pos.r === SIZE - 1 || pos.c === 0 || pos.c === SIZE - 1) {
      const exit = getBorderNumber(pos.r, pos.c);
      if (exit === entry && firstMove) {
        raysReflected++;
        log.innerHTML += `<div>Ray ${entry} → Reflected</div>`;
      } else {
        raysExited++;
        log.innerHTML += `<div>Ray ${entry} → Exited at ${exit}</div>`;
      }
      return;
    }

    const idx = pos.r * SIZE + pos.c;

    // Hit an atom => Absorbed
    if (atoms.includes(idx)) {
      raysAbsorbed++;
      log.innerHTML += `<div>Ray ${entry} → Absorbed</div>`;
      return;
    }

    // Check diagonal occupancy for deflection / reflection rules
    const diagonals = getDiagonals(pos);
    const occupiedDiagonals = diagonals
      .filter(d => atoms.includes(d.r * SIZE + d.c))
      .map(d => d.name);

    if ((occupiedDiagonals.includes("NW") && occupiedDiagonals.includes("SE")) ||
        (occupiedDiagonals.includes("NE") && occupiedDiagonals.includes("SW"))) {
      // Double-diagonal case -> reflection if this is first move
      if (firstMove) {
        raysReflected++;
        log.innerHTML += `<div>Ray ${entry} → Reflected</div>`;
      }
      return;
    }

    // Single diagonal -> deflect
    if (occupiedDiagonals.length === 1) {
      dir = deflect(dir, occupiedDiagonals[0]);
    }

    firstMove = false;
  }
}

function getDiagonals(pos) {
  return [
    { r: pos.r - 1, c: pos.c - 1, name: "NW" },
    { r: pos.r - 1, c: pos.c + 1, name: "NE" },
    { r: pos.r + 1, c: pos.c - 1, name: "SW" },
    { r: pos.r + 1, c: pos.c + 1, name: "SE" }
  ];
}

function deflect(dir, diag) {
  if ((dir.r === 1 && dir.c === 0) || (dir.r === -1 && dir.c === 0)) {
    return (diag === "NW" || diag === "SW") ? { r: 0, c: 1 } : { r: 0, c: -1 };
  }
  if ((dir.r === 0 && dir.c === 1) || (dir.r === 0 && dir.c === -1)) {
    return (diag === "NW" || diag === "NE") ? { r: 1, c: 0 } : { r: -1, c: 0 };
  }
  return dir;
}

function handleCellClick(r, c) {
  if (revealed) return;

  const idx = r * SIZE + c;
  if (playerGuesses.includes(idx)) {
    playerGuesses = playerGuesses.filter(i => i !== idx);
    board.children[idx].classList.remove('guess');
  } else if (playerGuesses.length < atomCount) {
    playerGuesses.push(idx);
    board.children[idx].classList.add('guess');
  }
}

function updateGuessCount() {
  guessCountDisplay.textContent = `Guesses: ${guessCount}   `;
}

revealBtn.addEventListener("click", () => {
  if (revealed) return;
  revealed = true;

  atoms.forEach(idx => board.children[idx].classList.add("atom"));
  let correct = playerGuesses.filter(g => atoms.includes(g)).length;
  let message = `Game Over! You guessed ${correct}/${atomCount} atom(s) correctly.`;

  if (correct === atomCount) {
    message += " Perfect!";
  } else if (correct >= atomCount - 1) {
    message += " Very Good!";
  } else if (correct === 0) {
    message += " Try again!";
  }

  log.innerHTML += `<div><strong>${message}</strong></div>`;
});

// --- Modal/Carousel Logic ---
const modal = document.getElementById('rules-modal');
const howToPlayBtn = document.getElementById('how-to-play-btn');
const closeBtn = document.querySelector('.close-btn');
const slides = document.querySelectorAll('.slide');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
let currentSlide = 0;

function showSlide(n) {
  slides.forEach(slide => slide.classList.remove('active'));
  slides[n].classList.add('active');
  currentSlide = n;

  prevBtn.style.display = (n === 0) ? 'none' : 'inline-block';
  nextBtn.style.display = (n === slides.length - 1) ? 'none' : 'inline-block';
}

howToPlayBtn.addEventListener('click', () => {
  modal.style.display = 'block';
  showSlide(0);
});

closeBtn.addEventListener('click', () => {
  modal.style.display = 'none';
});

window.addEventListener('click', (event) => {
  if (event.target == modal) {
    modal.style.display = 'none';
  }
});

prevBtn.addEventListener('click', () => {
  if (currentSlide > 0) {
    showSlide(currentSlide - 1);
  }
});

nextBtn.addEventListener('click', () => {
  if (currentSlide < slides.length - 1) {
    showSlide(currentSlide + 1);
  }
});