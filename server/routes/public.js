const express = require('express');
const { PrismaClient } = require('@prisma/client');
const drawEngine = require('../services/drawEngine');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/draw/status
router.get('/draw/status', async (req, res) => {
  try {
    const status = await drawEngine.getStatus();
    res.json(status);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/carton/:cardCode
router.get('/carton/:cardCode', async (req, res) => {
  try {
    const card = await prisma.bingoCard.findUnique({
      where: { cardCode: req.params.cardCode },
      include: {
        participant: { select: { fullName: true, contractNumber: true } },
      },
    });

    if (!card) {
      return res.status(404).json({
        error: 'Cartón no encontrado. Verifica tu enlace o contacta al organizador.',
      });
    }

    const drawStatus = await drawEngine.getStatus();

    res.json({
      cardCode: card.cardCode,
      participantName: card.participant.fullName,
      contractNumber: card.participant.contractNumber,
      grid: card.grid,
      markedNumbers: card.markedNumbers,
      drawStatus: drawStatus.status,
      numbersDrawn: drawStatus.numbersDrawn,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/winners  — winners for the most recent session (used by the public display screen)
router.get('/winners', async (req, res) => {
  try {
    const session = await prisma.drawSession.findFirst({
      orderBy: { startedAt: 'desc' },
    });
    if (!session) return res.json({ winners: [] });

    const winners = await prisma.winner.findMany({
      where: { sessionId: session.id },
      orderBy: { detectedAt: 'asc' },
      include: {
        card: {
          select: {
            cardCode: true,
            participant: { select: { fullName: true, contractNumber: true } },
          },
        },
      },
    });

    res.json({
      winners: winners.map((w) => ({
        cardCode: w.card.cardCode,
        participantName: w.card.participant.fullName,
        contractNumber: w.card.participant.contractNumber,
        winType: w.winType,
        detectedAt: w.detectedAt,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
