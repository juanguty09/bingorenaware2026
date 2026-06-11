const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// grid[col][row], col 0-4 = B/I/N/G/O, row 0-4 top to bottom
// grid[2][2] is always 'FREE'
function isMarked(cell, drawnNumbers) {
  return cell === 'FREE' || drawnNumbers.includes(Number(cell));
}

function checkWins(grid, drawnNumbers) {
  const m = (col, row) => isMarked(grid[col][row], drawnNumbers);
  const wins = new Set();

  // LINE: any complete horizontal row
  for (let r = 0; r < 5; r++) {
    if (m(0, r) && m(1, r) && m(2, r) && m(3, r) && m(4, r)) {
      wins.add('LINE');
      break;
    }
  }

  // COLUMN: any complete vertical column
  for (let c = 0; c < 5; c++) {
    if (m(c, 0) && m(c, 1) && m(c, 2) && m(c, 3) && m(c, 4)) {
      wins.add('COLUMN');
      break;
    }
  }

  // DIAGONAL: top-left to bottom-right
  if (m(0, 0) && m(1, 1) && m(2, 2) && m(3, 3) && m(4, 4)) wins.add('DIAGONAL');
  // DIAGONAL: top-right to bottom-left
  if (m(4, 0) && m(3, 1) && m(2, 2) && m(1, 3) && m(0, 4)) wins.add('DIAGONAL');

  // CORNERS: all 4 corner cells
  if (m(0, 0) && m(4, 0) && m(0, 4) && m(4, 4)) wins.add('CORNERS');

  // BINGO: all 25 cells marked
  let allMarked = true;
  outer: for (let c = 0; c < 5; c++) {
    for (let r = 0; r < 5; r++) {
      if (!m(c, r)) { allMarked = false; break outer; }
    }
  }
  if (allMarked) wins.add('BINGO');

  return [...wins];
}

async function detectWinners(sessionId, drawnNumbers) {
  // Load existing wins for this session to skip duplicates
  const existing = await prisma.winner.findMany({
    where: { sessionId },
    select: { cardId: true, winType: true },
  });
  const existingSet = new Set(existing.map((w) => `${w.cardId}:${w.winType}`));

  const newWinners = [];
  const BATCH = 200;
  let skip = 0;

  while (true) {
    const cards = await prisma.bingoCard.findMany({
      skip,
      take: BATCH,
      select: {
        id: true,
        cardCode: true,
        grid: true,
        participant: { select: { fullName: true, contractNumber: true } },
      },
    });

    if (cards.length === 0) break;

    for (const card of cards) {
      const wins = checkWins(card.grid, drawnNumbers);
      for (const winType of wins) {
        const key = `${card.id}:${winType}`;
        if (!existingSet.has(key)) {
          existingSet.add(key);
          await prisma.winner.create({ data: { cardId: card.id, sessionId, winType } });
          newWinners.push({
            cardCode: card.cardCode,
            participantName: card.participant.fullName,
            contractNumber: card.participant.contractNumber,
            winType,
          });
        }
      }
    }

    if (cards.length < BATCH) break;
    skip += BATCH;

    // Yield to event loop between batches to avoid blocking Socket.io
    await new Promise((resolve) => setImmediate(resolve));
  }

  return newWinners;
}

module.exports = { detectWinners };
