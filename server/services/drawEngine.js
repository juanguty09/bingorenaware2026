const { PrismaClient } = require('@prisma/client');
const { detectWinners } = require('./winDetector');

const prisma = new PrismaClient();

let io = null;
let timer = null;
let activeSession = null;
let drawing = false;

function getBingoLetter(n) {
  if (n <= 15) return 'B';
  if (n <= 30) return 'I';
  if (n <= 45) return 'N';
  if (n <= 60) return 'G';
  return 'O';
}

function startTimer() {
  stopTimer();
  timer = setInterval(drawNext, 5000);
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function drawNext() {
  if (drawing || !activeSession) return;
  drawing = true;
  try {
    const session = await prisma.drawSession.findUnique({ where: { id: activeSession.id } });
    if (!session || session.status !== 'ACTIVE') {
      stopTimer();
      return;
    }

    const drawn = session.numbersDrawn;
    const remaining = [];
    for (let i = 1; i <= 75; i++) {
      if (!drawn.includes(i)) remaining.push(i);
    }

    if (remaining.length === 0) {
      await endDraw();
      return;
    }

    const number = remaining[Math.floor(Math.random() * remaining.length)];
    const newDrawn = [...drawn, number];

    activeSession = await prisma.drawSession.update({
      where: { id: session.id },
      data: { numbersDrawn: newDrawn, currentNumber: number },
    });

    io.emit('number_drawn', {
      number,
      letter: getBingoLetter(number),
      allDrawn: newDrawn,
      currentSession: { id: activeSession.id, status: activeSession.status },
    });

    const newWinners = await detectWinners(activeSession.id, newDrawn);
    for (const winner of newWinners) {
      io.emit('winner_found', winner);
    }
  } catch (err) {
    console.error('drawNext error:', err);
  } finally {
    drawing = false;
  }
}

async function startDraw() {
  const existing = await prisma.drawSession.findFirst({
    where: { status: { in: ['ACTIVE', 'PAUSED'] } },
  });
  if (existing) throw new Error('Ya existe una sesión activa o en pausa');

  const session = await prisma.drawSession.create({
    data: { status: 'ACTIVE', numbersDrawn: [], startedAt: new Date() },
  });
  activeSession = session;
  startTimer();
  io.emit('draw_status_change', { status: 'ACTIVE' });
  return session;
}

async function pauseDraw() {
  if (!activeSession) throw new Error('No hay sesión activa');
  stopTimer();
  activeSession = await prisma.drawSession.update({
    where: { id: activeSession.id },
    data: { status: 'PAUSED' },
  });
  io.emit('draw_status_change', { status: 'PAUSED' });
  return activeSession;
}

async function resumeDraw() {
  if (!activeSession) throw new Error('No hay sesión activa');
  if (activeSession.status !== 'PAUSED') throw new Error('La sesión no está en pausa');
  activeSession = await prisma.drawSession.update({
    where: { id: activeSession.id },
    data: { status: 'ACTIVE' },
  });
  startTimer();
  io.emit('draw_status_change', { status: 'ACTIVE' });
  return activeSession;
}

async function endDraw() {
  if (!activeSession) throw new Error('No hay sesión activa');
  stopTimer();
  const session = await prisma.drawSession.update({
    where: { id: activeSession.id },
    data: { status: 'FINISHED', endedAt: new Date() },
  });
  io.emit('draw_status_change', { status: 'FINISHED' });
  activeSession = null;
  return session;
}

async function getStatus() {
  const session = activeSession
    ? await prisma.drawSession.findUnique({
        where: { id: activeSession.id },
        include: { _count: { select: { winners: true } } },
      })
    : await prisma.drawSession.findFirst({
        orderBy: { startedAt: 'desc' },
        include: { _count: { select: { winners: true } } },
      });

  if (!session) {
    return { status: 'PENDING', numbersDrawn: [], currentNumber: null, winnersCount: 0 };
  }
  return {
    status: session.status,
    numbersDrawn: session.numbersDrawn,
    currentNumber: session.currentNumber,
    winnersCount: session._count.winners,
  };
}

async function init(socketIo) {
  io = socketIo;
  // Restore any session that was active before a server restart
  const session = await prisma.drawSession.findFirst({
    where: { status: { in: ['ACTIVE', 'PAUSED'] } },
    orderBy: { startedAt: 'desc' },
  });
  if (session) {
    activeSession = session;
    if (session.status === 'ACTIVE') startTimer();
    console.log(`Restored draw session ${session.id} (${session.status})`);
  }
}

module.exports = { init, startDraw, pauseDraw, resumeDraw, endDraw, getStatus };
