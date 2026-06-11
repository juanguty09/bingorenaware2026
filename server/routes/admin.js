const express = require('express');
const multer = require('multer');
const path = require('path');
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const { generateUniqueCard } = require('../services/cardGenerator');
const drawEngine = require('../services/drawEngine');

const router = express.Router();
const prisma = new PrismaClient();

const REQUIRED_COLUMNS = [
  'participantId',
  'fullName',
  'contractNumber',
  'organization',
  'email',
  'phone',
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) cb(null, true);
    else cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls) o CSV'));
  },
});

function adminAuth(req, res, next) {
  const password = req.headers['x-admin-password'];
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  next();
}

// POST /api/admin/upload-participants
router.post(
  '/upload-participants',
  adminAuth,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

    try {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rows.length === 0) {
        return res.status(400).json({ error: 'El archivo está vacío' });
      }

      const fileColumns = Object.keys(rows[0]);
      const missing = REQUIRED_COLUMNS.filter((col) => !fileColumns.includes(col));
      if (missing.length > 0) {
        return res.status(400).json({
          error: `Columnas faltantes: ${missing.join(', ')}`,
          columnsFound: fileColumns,
          columnsRequired: REQUIRED_COLUMNS,
        });
      }

      const existingCards = await prisma.bingoCard.findMany({ select: { grid: true } });
      const existingGrids = new Set(existingCards.map((c) => JSON.stringify(c.grid)));

      let participantsLoaded = 0;
      let cardsGenerated = 0;

      for (const row of rows) {
        const participant = await prisma.participant.upsert({
          where: { participantId: String(row.participantId) },
          update: {
            fullName: String(row.fullName),
            contractNumber: String(row.contractNumber),
            organization: String(row.organization),
            email: String(row.email),
            phone: String(row.phone),
          },
          create: {
            participantId: String(row.participantId),
            fullName: String(row.fullName),
            contractNumber: String(row.contractNumber),
            organization: String(row.organization),
            email: String(row.email),
            phone: String(row.phone),
          },
        });
        participantsLoaded++;

        const existingCard = await prisma.bingoCard.findFirst({
          where: { participantId: participant.id },
        });

        if (!existingCard) {
          const { grid, cardCode } = generateUniqueCard(row.contractNumber, existingGrids);
          await prisma.bingoCard.create({
            data: { cardCode, participantId: participant.id, grid, markedNumbers: [] },
          });
          cardsGenerated++;
        }
      }

      const latest = await prisma.participant.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          contractNumber: true,
          cards: { select: { cardCode: true }, take: 1 },
        },
      });

      const participants = latest.map((p) => ({
        id: p.id,
        fullName: p.fullName,
        contractNumber: p.contractNumber,
        cardCode: p.cards[0]?.cardCode ?? null,
      }));

      res.json({
        message: `${participantsLoaded} participantes cargados, ${cardsGenerated} cartones generados`,
        participantsLoaded,
        cardsGenerated,
        participants,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/admin/participants?page=1&limit=50
router.get('/participants', adminAuth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  try {
    const [total, participants] = await Promise.all([
      prisma.participant.count(),
      prisma.participant.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fullName: true,
          contractNumber: true,
          cards: { select: { cardCode: true }, take: 1 },
        },
      }),
    ]);

    const data = participants.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      contractNumber: p.contractNumber,
      cardCode: p.cards[0]?.cardCode ?? null,
    }));

    res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/draw/start
router.post('/draw/start', adminAuth, async (req, res) => {
  try {
    const session = await drawEngine.startDraw();
    res.json({ message: 'Sorteo iniciado', session });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/draw/pause
router.post('/draw/pause', adminAuth, async (req, res) => {
  try {
    const session = await drawEngine.pauseDraw();
    res.json({ message: 'Sorteo pausado', session });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/admin/draw/resume
router.post('/draw/resume', adminAuth, async (req, res) => {
  try {
    const session = await drawEngine.resumeDraw();
    res.json({ message: 'Sorteo reanudado', session });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const WIN_LABELS_ES = {
  LINE:     'Línea',
  COLUMN:   'Columna',
  DIAGONAL: 'Diagonal',
  CORNERS:  'Cuatro Esquinas',
  BINGO:    'BINGO Completo',
};

// GET /api/admin/winners/export  — download all winners as UTF-8 CSV (Excel-compatible)
router.get('/winners/export', adminAuth, async (req, res) => {
  try {
    const winners = await prisma.winner.findMany({
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

    const header = ['Nombre', 'Contrato', 'Codigo_Carton', 'Tipo_Premio', 'Fecha_Hora'];
    const rows = winners.map((w) => [
      w.card.participant.fullName,
      w.card.participant.contractNumber,
      w.card.cardCode,
      WIN_LABELS_ES[w.winType] || w.winType,
      w.detectedAt.toISOString().replace('T', ' ').slice(0, 19),
    ]);

    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ganadores-bingo-2026.csv"');
    res.send('﻿' + csv); // UTF-8 BOM so Excel auto-detects encoding
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/draw/end
router.post('/draw/end', adminAuth, async (req, res) => {
  try {
    const session = await drawEngine.endDraw();
    res.json({ message: 'Sorteo finalizado', session });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
