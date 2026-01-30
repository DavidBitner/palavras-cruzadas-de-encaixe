/**
 * CRUZADOX GENERATOR v5.0
 * Logic & PDF Export
 */

/* ==========================================================================
   CONFIGURATION & STATE
   ========================================================================== */
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

let GLOBAL_GRID_SIZE = 25;
let currentPlacedWords = [];
let currentGrid = [];
let activeWordsSet = new Set();
let currentThemeName = "MISTO";

window.onload = handleCategoryChange;

/* ==========================================================================
   UI HANDLERS & DATA
   ========================================================================== */
function handleCategoryChange() {
  const category = document.getElementById("dbCategory").value;
  const isManual = category === "manual";

  document.getElementById("section-auto").classList.toggle("active", !isManual);
  document
    .getElementById("section-manual")
    .classList.toggle("active", isManual);
}

async function getWordPool(category) {
  if (category === "manual") {
    const rawText = document.getElementById("manualInput").value;
    return rawText
      .split("\n")
      .map((w) => w.trim().toUpperCase())
      .filter((w) => w.length > 0);
  }

  let pool = [];
  if (category === "mix") {
    const promises = AVAILABLE_THEMES.map((theme) =>
      fetch(`./data/${theme}.json`).then((res) => res.json()),
    );
    const results = await Promise.all(promises);
    results.forEach((data) => (pool = pool.concat(data.palavras)));
  } else {
    const res = await fetch(`./data/${category}.json`);
    if (!res.ok) throw new Error(`Fetch error: ${category}`);
    const data = await res.json();
    pool = data.palavras;
  }
  return [...new Set(pool)].map((w) => w.toUpperCase());
}

async function runGenerator() {
  const btn = document.querySelector("button.btn-primary");
  const statusDiv = document.getElementById("status");

  btn.disabled = true;
  statusDiv.innerText = "Processando...";

  try {
    // 1. Setup
    const categoryInput = document.getElementById("dbCategory");
    const category = categoryInput.value;
    const count = parseInt(document.getElementById("dbCount").value) || 25;

    // 2. Theme Name
    const selectedText =
      categoryInput.options[categoryInput.selectedIndex].text;
    currentThemeName =
      category === "manual"
        ? "DESAFIO"
        : selectedText
            .replace(/[★✎]|\s*\(.*?\)/g, "")
            .trim()
            .toUpperCase();

    document.getElementById("printHeader").innerText =
      `CRUZADOX - ${currentThemeName}`;

    // 3. Data & Generation
    const fullPool = await getWordPool(category);
    const selectedWords =
      category !== "manual" && fullPool.length > count
        ? fullPool.sort(() => 0.5 - Math.random()).slice(0, count)
        : fullPool;

    const result = generateBestLayout(selectedWords);

    if (result.placedCount === 0) {
      throw new Error("Não foi possível encaixar nenhuma palavra.");
    }

    // 4. Update State (Reveal Longest Word)
    currentPlacedWords = result.placedWords;
    currentGrid = result.grid;
    activeWordsSet.clear();

    if (currentPlacedWords.length > 0) {
      const longest = currentPlacedWords.reduce((p, c) =>
        p.word.length > c.word.length ? p : c,
      );
      activeWordsSet.add(longest.word);
    }

    // 5. Render
    renderGridStructure(currentGrid);
    renderInteractiveList(currentPlacedWords);
    refreshGridVisibility();

    statusDiv.innerText = `Sucesso! ${result.placedCount} palavras encaixadas.`;
  } catch (error) {
    console.error(error);
    statusDiv.innerText = "Erro ao processar.";
  } finally {
    btn.disabled = false;
  }
}

/* ==========================================================================
   ALGORITHM (GREEDY PLACEMENT)
   ========================================================================== */
function generateBestLayout(words) {
  if (!words?.length) return { placedCount: 0, grid: [] };

  const maxLen = Math.max(...words.map((w) => w.length));
  GLOBAL_GRID_SIZE = Math.max(20, maxLen + 6);

  let bestResult = { placedCount: -1, grid: [] };
  const ATTEMPTS = 50;

  for (let i = 0; i < ATTEMPTS; i++) {
    let result = attemptGeneration([...words]);
    if (result.placedCount > bestResult.placedCount) {
      bestResult = result;
    }
    if (result.placedCount === words.length) break;
  }
  return bestResult;
}

function attemptGeneration(words) {
  let grid = Array(GLOBAL_GRID_SIZE)
    .fill(null)
    .map(() => Array(GLOBAL_GRID_SIZE).fill(null));
  let placedWords = [];

  // Anchor Strategy: Longest first, center placement
  words.sort((a, b) => b.length - a.length);
  const first = words[0];
  const startX = Math.floor((GLOBAL_GRID_SIZE - first.length) / 2);
  const startY = Math.floor(GLOBAL_GRID_SIZE / 2);

  placeWordInGrid(grid, first, startX, startY, "H");
  placedWords.push({ word: first, x: startX, y: startY, dir: "H" });

  // Place remaining
  const remaining = words.slice(1).sort(() => Math.random() - 0.5);

  for (let word of remaining) {
    let placed = false;

    // Scan grid for intersection points
    for (let y = 0; y < GLOBAL_GRID_SIZE; y++) {
      for (let x = 0; x < GLOBAL_GRID_SIZE; x++) {
        const cell = grid[y][x];
        if (!cell || !word.includes(cell)) continue;

        const letterIndex = word.indexOf(cell);

        // Try Vertical Intersection
        if (canPlace(grid, word, x, y - letterIndex, "V")) {
          placeWordInGrid(grid, word, x, y - letterIndex, "V");
          placedWords.push({ word, x, y: y - letterIndex, dir: "V" });
          placed = true;
          break;
        }
        // Try Horizontal Intersection
        if (canPlace(grid, word, x - letterIndex, y, "H")) {
          placeWordInGrid(grid, word, x - letterIndex, y, "H");
          placedWords.push({ word, x: x - letterIndex, y, dir: "H" });
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
  }
  return { grid, placedCount: placedWords.length, placedWords };
}

function canPlace(grid, word, startX, startY, dir) {
  const len = word.length;
  const isH = dir === "H";

  // Bounds Check
  if (startX < 0 || startY < 0) return false;
  if (isH && startX + len > GLOBAL_GRID_SIZE) return false;
  if (!isH && startY + len > GLOBAL_GRID_SIZE) return false;

  // Collision & Adjacency Check
  for (let i = 0; i < len; i++) {
    const cx = isH ? startX + i : startX;
    const cy = isH ? startY : startY + i;
    const cell = grid[cy][cx];

    if (cell !== null && cell !== word[i]) return false;

    // If empty, check neighbors (no crowding)
    if (cell === null) {
      if (isH) {
        if (cy > 0 && grid[cy - 1][cx] !== null) return false;
        if (cy < GLOBAL_GRID_SIZE - 1 && grid[cy + 1][cx] !== null)
          return false;
      } else {
        if (cx > 0 && grid[cy][cx - 1] !== null) return false;
        if (cx < GLOBAL_GRID_SIZE - 1 && grid[cy][cx + 1] !== null)
          return false;
      }
    }
  }

  // Endcaps Check
  if (isH) {
    if (startX > 0 && grid[startY][startX - 1] !== null) return false;
    if (startX + len < GLOBAL_GRID_SIZE && grid[startY][startX + len] !== null)
      return false;
  } else {
    if (startY > 0 && grid[startY - 1][startX] !== null) return false;
    if (startY + len < GLOBAL_GRID_SIZE && grid[startY + len][startX] !== null)
      return false;
  }

  return true;
}

function placeWordInGrid(grid, word, x, y, dir) {
  for (let i = 0; i < word.length; i++) {
    if (dir === "H") grid[y][x + i] = word[i];
    else grid[y + i][x] = word[i];
  }
}

/* ==========================================================================
   RENDERERS (DOM)
   ========================================================================== */
function renderGridStructure(grid) {
  const bounds = getGridBounds(grid);
  const table = document.getElementById("grid");
  table.innerHTML = "";

  for (let y = bounds.minY; y <= bounds.maxY; y++) {
    const tr = document.createElement("tr");
    for (let x = bounds.minX; x <= bounds.maxX; x++) {
      const td = document.createElement("td");
      const cell = grid[y][x];

      if (cell) {
        td.className = "filled";
        td.innerText = cell;
        td.id = `cell-${x}-${y}`;
      } else {
        td.className = "empty";
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
      const container = document.createElement("div");
      container.className = "word-group";

      const title = document.createElement("div");
      title.className = "group-title";
      title.innerText = `${len} Letras`;
      container.appendChild(title);

      groups[len].sort().forEach((wordStr) => {
        const item = document.createElement("div");
        item.className = "word-item";
        item.innerText = wordStr;
        item.onclick = function () {
          toggleWordState(wordStr, this);
        };
        container.appendChild(item);
      });
      listDiv.appendChild(container);
    });
}

function toggleWordState(word, el) {
  if (activeWordsSet.has(word)) {
    activeWordsSet.delete(word);
  } else {
    activeWordsSet.add(word);
  }
  refreshGridVisibility();
}

function refreshGridVisibility() {
  document
    .querySelectorAll("#grid td.filled")
    .forEach((td) => td.classList.remove("revealed"));
  document.querySelectorAll(".word-item").forEach((item) => {
    item.classList.toggle("active", activeWordsSet.has(item.innerText));
  });

  activeWordsSet.forEach((word) => {
    const data = currentPlacedWords.find((w) => w.word === word);
    if (!data) return;

    for (let i = 0; i < word.length; i++) {
      const tx = data.dir === "H" ? data.x + i : data.x;
      const ty = data.dir === "H" ? data.y : data.y + i;
      const cell = document.getElementById(`cell-${tx}-${ty}`);
      if (cell) cell.classList.add("revealed");
    }
  });
}

function getGridBounds(grid) {
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
  return {
    minX: Math.max(0, minX - 1),
    minY: Math.max(0, minY - 1),
    maxX: Math.min(GLOBAL_GRID_SIZE - 1, maxX + 1),
    maxY: Math.min(GLOBAL_GRID_SIZE - 1, maxY + 1),
  };
}

/* ==========================================================================
   PDF GENERATION (JSPDF)
   ========================================================================== */
function downloadCurrentPDF() {
  if (!currentPlacedWords.length) return alert("Gere um jogo primeiro!");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", format: "a4", unit: "mm" });
  drawGameToPDF(
    doc,
    currentGrid,
    currentPlacedWords,
    currentThemeName,
    1,
    activeWordsSet,
  );
  doc.save(`cruzadox_${currentThemeName}_atual.pdf`);
}

async function generateBatchPDF() {
  const btn = document.querySelector("button[onclick*='generateBatch']");
  const qtyInput = document.getElementById("batchQty");
  const qty = parseInt(qtyInput.value) || 50;
  const originalText = btn.innerText;

  if (qty < 1) return alert("Quantidade inválida.");

  btn.disabled = true;

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: "landscape",
      format: "a4",
      unit: "mm",
    });

    // Configs
    const categoryInput = document.getElementById("dbCategory");
    const category = categoryInput.value;
    const count = parseInt(document.getElementById("dbCount").value) || 25;

    let themeTitle =
      category === "manual"
        ? "DESAFIO"
        : categoryInput.options[categoryInput.selectedIndex].text
            .replace(/[★✎]|\s*\(.*?\)/g, "")
            .trim()
            .toUpperCase();

    const fullPool = await getWordPool(category);

    for (let i = 0; i < qty; i++) {
      btn.innerText = `Gerando ${i + 1}/${qty}...`;

      const selectedWords =
        category !== "manual" && fullPool.length > count
          ? fullPool.sort(() => 0.5 - Math.random()).slice(0, count)
          : fullPool;

      const result = generateBestLayout(selectedWords);

      if (result.placedCount > 0) {
        // Auto-reveal logic for PDF
        let pdfActiveSet = new Set();
        const longest = result.placedWords.reduce((p, c) =>
          p.word.length > c.word.length ? p : c,
        );
        pdfActiveSet.add(longest.word);

        if (i > 0) doc.addPage();
        drawGameToPDF(
          doc,
          result.grid,
          result.placedWords,
          themeTitle,
          i + 1,
          pdfActiveSet,
        );
      }
    }

    doc.save(`cruzadox_livro_${qty}_jogos.pdf`);
  } catch (e) {
    console.error(e);
    alert("Erro na geração em lote.");
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

function drawGameToPDF(doc, grid, placedWords, title, pageNum, revealedSet) {
  const pageWidth = 297;
  const pageHeight = 210;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(`CRUZADOX - ${title}`, pageWidth / 2, 15, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Jogo #${pageNum}`, pageWidth - 15, 10, { align: "right" });

  // Calc Grid Size
  const bounds = getGridBounds(grid);
  const rows = bounds.maxY - bounds.minY + 1;
  const cols = bounds.maxX - bounds.minX + 1;

  const maxGridW = 175;
  const maxGridH = 170;
  const startX = 10;
  const startY = 25;

  let cellSize = Math.min(maxGridW / cols, maxGridH / rows);
  if (cellSize > 14) cellSize = 14;

  const totalW = cols * cellSize;
  const totalH = rows * cellSize;
  const offX = startX + (maxGridW - totalW) / 2;
  const offY = startY + (maxGridH - totalH) / 2;

  // Draw Grid
  doc.setLineWidth(0.4);
  doc.setDrawColor(0);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = grid[bounds.minY + y][bounds.minX + x];
      const posX = offX + x * cellSize;
      const posY = offY + y * cellSize;

      if (!cell) {
        doc.setFillColor(0, 0, 0);
        doc.rect(posX, posY, cellSize, cellSize, "F");
      } else {
        // Check if revealed
        let isRevealed = false;
        for (let rw of revealedSet) {
          const pw = placedWords.find((p) => p.word === rw);
          if (pw) {
            const isH = pw.dir === "H";
            const py = bounds.minY + y;
            const px = bounds.minX + x;
            if (isH && py === pw.y && px >= pw.x && px < pw.x + pw.word.length)
              isRevealed = true;
            if (!isH && px === pw.x && py >= pw.y && py < pw.y + pw.word.length)
              isRevealed = true;
          }
          if (isRevealed) break;
        }

        if (isRevealed) {
          doc.setFillColor(230, 230, 230);
          doc.rect(posX, posY, cellSize, cellSize, "FD");
          doc.setFontSize(cellSize * 2.2);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0);
          doc.text(cell, posX + cellSize / 2, posY + cellSize * 0.78, {
            align: "center",
          });
        } else {
          doc.setFillColor(255, 255, 255);
          doc.rect(posX, posY, cellSize, cellSize, "FD");
        }
      }
    }
  }

  // Draw List
  const listX = startX + maxGridW + 10;
  let listY = startY;
  const colWidth = 32;
  const lineHeight = 5;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Palavras:", listX, listY);
  listY += 8;

  const groups = {};
  placedWords.forEach((w) => {
    if (!groups[w.word.length]) groups[w.word.length] = [];
    groups[w.word.length].push(w.word);
  });

  doc.setFontSize(9);
  let curCol = 0,
    curLine = 0;
  const maxLines = 32;

  Object.keys(groups)
    .sort((a, b) => a - b)
    .forEach((len) => {
      if (curLine > maxLines - 2) {
        curCol++;
        curLine = 0;
      }

      const gx = listX + curCol * colWidth;
      const gy = listY + curLine * lineHeight;

      doc.setFont("helvetica", "bold");
      doc.text(`${len} LETRAS`, gx, gy);
      doc.setLineWidth(0.2);
      doc.line(gx, gy + 1, gx + 25, gy + 1);
      curLine++;

      doc.setFont("helvetica", "normal");
      groups[len].sort().forEach((word) => {
        if (curLine > maxLines) {
          curCol++;
          curLine = 0;
        }

        const wx = listX + curCol * colWidth;
        const wy = listY + curLine * lineHeight;

        if (revealedSet.has(word)) {
          doc.setTextColor(80, 80, 80);
          doc.text(word, wx, wy);
          const wWidth = doc.getTextWidth(word);
          doc.setLineWidth(0.3);
          doc.line(wx, wy - 1.5, wx + wWidth, wy - 1.5);
        } else {
          doc.setTextColor(0, 0, 0);
          doc.text(word, wx, wy);
        }
        curLine++;
      });
      curLine++;
    });
}
