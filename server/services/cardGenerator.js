function pickRandom(min, max, count) {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => i + min);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function buildGrid() {
  const columns = [
    pickRandom(1, 15, 5),
    pickRandom(16, 30, 5),
    pickRandom(31, 45, 5),
    pickRandom(46, 60, 5),
    pickRandom(61, 75, 5),
  ];
  columns[2][2] = 'FREE';
  return columns;
}

function makeCardCode(contractNumber) {
  const num = parseInt(contractNumber, 10);
  const padded = isNaN(num)
    ? String(contractNumber).slice(0, 6).padEnd(6, '0')
    : String(num).padStart(6, '0');
  return `BNG-${padded}`;
}

// existingGrids is a Set of JSON-stringified grids, mutated in place as new cards are added.
function generateUniqueCard(contractNumber, existingGrids, maxRetries = 100) {
  for (let i = 0; i < maxRetries; i++) {
    const grid = buildGrid();
    const key = JSON.stringify(grid);
    if (!existingGrids.has(key)) {
      existingGrids.add(key);
      return { grid, cardCode: makeCardCode(contractNumber) };
    }
  }
  throw new Error(
    `Could not generate unique card for contract ${contractNumber} after ${maxRetries} retries`
  );
}

module.exports = { generateUniqueCard };
