// --- CONFIG ---
const AVAILABLE_THEMES = [
  "animais",
  "geografia",
  "natureza",
  "cotidiano",
  "cultura",
  "alimentos",
  "nomes",
  "adjetivos",
  "geek",
  "marcas",
  "verbos",
];

// --- STATE ---
let GLOBAL_GRID_SIZE = 25;
let placedWordsData = [];
let activeWordsSet = new Set();

// --- UI HANDLERS ---
function handleCategoryChange() {
  const category = document.getElementById("dbCategory").value;
  const isManual = category === "manual";

  document.getElementById("section-auto").classList.toggle("active", !isManual);
  document
    .getElementById("section-manual")
    .classList.toggle("active", isManual);
}

window.onload = handleCategoryChange;

async function runGenerator() {
  const btn = document.querySelector("button");
  btn.disabled = true;
  btn.innerText = "Carregando...";

  const categoryInput = document.getElementById("dbCategory");
  const category = categoryInput.value;
  let finalWordList = [];

  // Title Update Logic
  try {
    const titleElement = document.getElementById("printHeader");
    if (titleElement) {
      const selectedText =
        categoryInput.options[categoryInput.selectedIndex].text;
      let cleanTheme = selectedText
        .replace(/[★✎]|\s*\(.*?\)/g, "")
        .trim()
        .toUpperCase();

      titleElement.innerText =
        category === "manual"
          ? "CRUZADOX - DESAFIO"
          : `CRUZADOX - ${cleanTheme}`;
    }
  } catch (e) {
    console.warn("Title update failed", e);
  }

  // Data Fetching & Processing
  try {
    if (category === "manual") {
      const rawText = document.getElementById("manualInput").value;
      finalWordList = rawText
        .split("\n")
        .map((w) => w.trim().toUpperCase())
        .filter((w) => w.length > 0);
    } else {
      const count = parseInt(document.getElementById("dbCount").value) || 20;
      let pool = [];

      if (category === "mix") {
        const promises = AVAILABLE_THEMES.map((theme) =>
          fetch(`./data/${theme}.json`).then((res) => res.json()),
        );
        const results = await Promise.all(promises);
        results.forEach((data) => (pool = pool.concat(data.palavras)));
      } else {
        const response = await fetch(`./data/${category}.json`);
        if (!response.ok) throw new Error(`Fetch error: ${category}`);
        const data = await response.json();
        pool = data.palavras;
      }

      pool = [...new Set(pool)].map((w) => w.toUpperCase());

      finalWordList =
        pool.length < count
          ? pool
          : pool.sort(() => 0.5 - Math.random()).slice(0, count);
    }

    generateBestLayout(finalWordList);
  } catch (error) {
    console.error(error);
    alert("Erro de processamento.");
  } finally {
    btn.disabled = false;
    btn.innerText = "Gerar Jogo";
  }
}

// --- GENERATOR CORE (Greedy Algorithm) ---
function generateBestLayout(words) {
  if (words.length === 0) {
    alert("Lista vazia.");
    return;
  }

  const maxLen = Math.max(...words.map((w) => w.length));
  GLOBAL_GRID_SIZE = Math.max(20, maxLen + 6);

  let bestResult = { placedCount: -1, grid: [] };
  const iterations = 300;

  for (let i = 0; i < iterations; i++) {
    let result = attemptGeneration([...words]);
    if (result.placedCount > bestResult.placedCount) {
      bestResult = result;
    }
    if (result.placedCount === words.length) break;
  }

  if (bestResult.placedCount === 0) {
    document.getElementById("status").innerText = "Erro: Falha no encaixe.";
    return;
  }

  placedWordsData = bestResult.placedWords;
  activeWordsSet.clear();

  renderGridStructure(bestResult.grid);
  renderInteractiveList(bestResult.placedWords);
  refreshGridVisibility();

  document.getElementById("status").innerText =
    `Sucesso! ${bestResult.placedCount} de ${words.length} palavras encaixadas.`;
}

function attemptGeneration(words) {
  let grid = Array(GLOBAL_GRID_SIZE)
    .fill(null)
    .map(() => Array(GLOBAL_GRID_SIZE).fill(null));
  let placedWords = [];

  // Sort by length desc (anchor strategy)
  words.sort((a, b) => b.length - a.length);

  const first = words[0];
  const startX = Math.floor((GLOBAL_GRID_SIZE - first.length) / 2);
  const startY = Math.floor(GLOBAL_GRID_SIZE / 2);
  placeWord(grid, first, startX, startY, "H");
  placedWords.push({ word: first, x: startX, y: startY, dir: "H" });

  let remaining = words.slice(1);
  remaining.sort(() => Math.random() - 0.5);

  for (let word of remaining) {
    let placed = false;

    // Scan grid for intersection points
    for (let y = 0; y < GLOBAL_GRID_SIZE; y++) {
      for (let x = 0; x < GLOBAL_GRID_SIZE; x++) {
        if (grid[y][x] && word.includes(grid[y][x])) {
          const letterIndex = word.indexOf(grid[y][x]);

          if (canPlace(grid, word, x, y - letterIndex, "V")) {
            placeWord(grid, word, x, y - letterIndex, "V");
            placedWords.push({
              word: word,
              x: x,
              y: y - letterIndex,
              dir: "V",
            });
            placed = true;
            break;
          }
          if (canPlace(grid, word, x - letterIndex, y, "H")) {
            placeWord(grid, word, x - letterIndex, y, "H");
            placedWords.push({
              word: word,
              x: x - letterIndex,
              y: y,
              dir: "H",
            });
            placed = true;
            break;
          }
        }
      }
      if (placed) break;
    }
  }
  return { grid, placedCount: placedWords.length, placedWords };
}

function canPlace(grid, word, startX, startY, dir) {
  if (dir === "H") {
    if (startX < 0 || startX + word.length > GLOBAL_GRID_SIZE) return false;
    if (startY < 0 || startY >= GLOBAL_GRID_SIZE) return false;

    for (let i = 0; i < word.length; i++) {
      let cell = grid[startY][startX + i];
      if (cell !== null && cell !== word[i]) return false;

      // Check adjacency for empty cells
      if (cell === null) {
        if (grid[startY][startX + i] !== null) return false;
        if (startY > 0 && grid[startY - 1][startX + i] !== null) {
          if (grid[startY - 1][startX + i] !== null) return false;
        }
        if (startY > 0 && grid[startY - 1][startX + i] !== null) return false;
        if (
          startY < GLOBAL_GRID_SIZE - 1 &&
          grid[startY + 1][startX + i] !== null
        )
          return false;
      }
    }
    if (startX > 0 && grid[startY][startX - 1] !== null) return false;
    if (
      startX + word.length < GLOBAL_GRID_SIZE &&
      grid[startY][startX + word.length] !== null
    )
      return false;
  } else {
    // Vertical Logic
    if (startY < 0 || startY + word.length > GLOBAL_GRID_SIZE) return false;
    if (startX < 0 || startX >= GLOBAL_GRID_SIZE) return false;
    for (let i = 0; i < word.length; i++) {
      let cell = grid[startY + i][startX];
      if (cell !== null && cell !== word[i]) return false;
      if (cell === null) {
        if (startX > 0 && grid[startY + i][startX - 1] !== null) return false;
        if (
          startX < GLOBAL_GRID_SIZE - 1 &&
          grid[startY + i][startX + 1] !== null
        )
          return false;
      }
    }
    if (startY > 0 && grid[startY - 1][startX] !== null) return false;
    if (
      startY + word.length < GLOBAL_GRID_SIZE &&
      grid[startY + word.length][startX] !== null
    )
      return false;
  }
  return true;
}

function placeWord(grid, word, startX, startY, dir) {
  for (let i = 0; i < word.length; i++) {
    if (dir === "H") grid[startY][startX + i] = word[i];
    else grid[startY + i][startX] = word[i];
  }
}

// --- RENDERERS ---

function renderGridStructure(grid) {
  // Crop Grid Logic
  let minX = GLOBAL_GRID_SIZE,
    maxX = 0,
    minY = GLOBAL_GRID_SIZE,
    maxY = 0;
  for (let y = 0; y < GLOBAL_GRID_SIZE; y++) {
    for (let x = 0; x < GLOBAL_GRID_SIZE; x++) {
      if (grid[y][x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  minX = Math.max(0, minX - 1);
  minY = Math.max(0, minY - 1);
  maxX = Math.min(GLOBAL_GRID_SIZE - 1, maxX + 1);
  maxY = Math.min(GLOBAL_GRID_SIZE - 1, maxY + 1);

  const table = document.getElementById("grid");
  table.innerHTML = "";

  for (let y = minY; y <= maxY; y++) {
    const tr = document.createElement("tr");
    for (let x = minX; x <= maxX; x++) {
      const td = document.createElement("td");
      const cell = grid[y][x];

      if (cell === null) {
        td.className = "empty";
      } else {
        td.className = "filled";
        td.innerText = cell;
        td.id = `cell-${x}-${y}`;
      }
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

function renderInteractiveList(placedWords) {
  const listDiv = document.getElementById("wordList");
  listDiv.innerHTML = "";

  const groups = {};
  placedWords.forEach((w) => {
    const len = w.word.length;
    if (!groups[len]) groups[len] = [];
    groups[len].push(w.word);
  });

  Object.keys(groups)
    .sort((a, b) => a - b)
    .forEach((len) => {
      const groupContainer = document.createElement("div");
      groupContainer.className = "word-group";

      const h4 = document.createElement("div");
      h4.className = "group-title";
      h4.innerText = `${len} Letras`;
      groupContainer.appendChild(h4);

      groups[len].sort().forEach((wordString) => {
        const item = document.createElement("div");
        item.className = "word-item";
        item.innerText = wordString;

        item.onclick = function () {
          toggleWordState(wordString, this);
        };
        groupContainer.appendChild(item);
      });
      listDiv.appendChild(groupContainer);
    });
}

function toggleWordState(wordString, domElement) {
  if (activeWordsSet.has(wordString)) {
    activeWordsSet.delete(wordString);
    domElement.classList.remove("active");
  } else {
    activeWordsSet.add(wordString);
    domElement.classList.add("active");
  }
  refreshGridVisibility();
}

function refreshGridVisibility() {
  const allCells = document.querySelectorAll("#grid td.filled");
  allCells.forEach((td) => td.classList.remove("revealed"));

  activeWordsSet.forEach((activeWordStr) => {
    const wordDataList = placedWordsData.filter(
      (w) => w.word === activeWordStr,
    );

    wordDataList.forEach((wData) => {
      for (let i = 0; i < wData.word.length; i++) {
        let tX, tY;
        if (wData.dir === "H") {
          tX = wData.x + i;
          tY = wData.y;
        } else {
          tX = wData.x;
          tY = wData.y + i;
        }

        const cell = document.getElementById(`cell-${tX}-${tY}`);
        if (cell) cell.classList.add("revealed");
      }
    });
  });
}
