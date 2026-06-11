import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

const LETTERS = ['B', 'I', 'N', 'G', 'O'];

const WIN_ES = {
  LINE:     '¡Línea completa!',
  COLUMN:   '¡Columna completa!',
  DIAGONAL: '¡Diagonal completa!',
  CORNERS:  '¡Cuatro esquinas!',
  BINGO:    '¡BINGO completo!',
};

const STATUS_INFO = {
  ACTIVE:   { label: 'Sorteo en vivo',    bg: '#27ae60' },
  PAUSED:   { label: 'Sorteo pausado',    bg: '#f39c12' },
  PENDING:  { label: 'Sorteo no iniciado', bg: '#7f8c8d' },
  FINISHED: { label: 'Sorteo finalizado', bg: '#c0392b' },
};

function getLetter(n) {
  if (n <= 15) return 'B';
  if (n <= 30) return 'I';
  if (n <= 45) return 'N';
  if (n <= 60) return 'G';
  return 'O';
}

function playWinSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  } catch (_) {}
}

// Inject keyframe animations once
const STYLE_ID = 'cardview-keyframes';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    @keyframes cellPop {
      0%   { transform: scale(1);    background: #27ae60; }
      35%  { transform: scale(1.25); background: #00b894; }
      100% { transform: scale(1);    background: #27ae60; }
    }
    @keyframes toastDrop {
      from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes celebPop {
      from { opacity: 0; transform: scale(0.6); }
      to   { opacity: 1; transform: scale(1); }
    }
    .cell-pop { animation: cellPop 0.65s ease; }
  `;
  document.head.appendChild(el);
}

export default function CardView() {
  const { cardCode } = useParams();
  const [card, setCard]             = useState(null);
  const [numbersDrawn, setDrawn]    = useState([]);
  const [drawStatus, setStatus]     = useState('PENDING');
  const [notFound, setNotFound]     = useState(false);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState(null);   // { number, letter }
  const [celebration, setCelebrate] = useState(null);   // { winType }
  const [poppingCell, setPopping]   = useState(null);   // number currently animating
  const [connected, setConnected]   = useState(false);
  const [reconnecting, setReconn]   = useState(false);
  const cardRef    = useRef(null);
  const toastTimer = useRef(null);
  const popTimer   = useRef(null);

  // Inject CSS keyframes
  useEffect(() => { injectStyles(); }, []);

  // Keep ref in sync with state so socket handlers see latest card
  useEffect(() => { cardRef.current = card; }, [card]);

  // Load card from API
  useEffect(() => {
    fetch(`/api/carton/${cardCode}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        if (data.error) { setNotFound(true); setLoading(false); return; }
        setCard(data);
        setDrawn(data.numbersDrawn || []);
        setStatus(data.drawStatus || 'PENDING');
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [cardCode]);

  // Socket.io
  useEffect(() => {
    const socket = io({ path: '/socket.io' });

    socket.on('connect',       () => { setConnected(true);  setReconn(false); });
    socket.on('disconnect',    () => { setConnected(false); });
    socket.on('connect_error', () => { setReconn(true); });
    socket.io.on('reconnect_attempt', () => setReconn(true));
    socket.io.on('reconnect',         () => { setConnected(true); setReconn(false); });

    socket.on('number_drawn', ({ number, letter, allDrawn }) => {
      setDrawn(allDrawn);
      const c = cardRef.current;
      if (!c) return;
      const isOnThisCard = c.grid.some((col) => col.includes(number));
      if (isOnThisCard) {
        // Animate cell
        clearTimeout(popTimer.current);
        setPopping(number);
        popTimer.current = setTimeout(() => setPopping(null), 700);
        // Toast
        clearTimeout(toastTimer.current);
        setToast({ number, letter });
        toastTimer.current = setTimeout(() => setToast(null), 3000);
      }
    });

    socket.on('winner_found', ({ cardCode: wCode, winType }) => {
      if (wCode === cardCode) {
        setCelebrate({ winType });
        playWinSound();
      }
    });

    socket.on('draw_status_change', ({ status }) => setStatus(status));

    return () => socket.disconnect();
  }, [cardCode]);

  // ── Render: loading ──
  if (loading) {
    return (
      <div style={s.center}>
        <div style={s.loaderText}>Cargando cartón…</div>
      </div>
    );
  }

  // ── Render: 404 ──
  if (notFound) {
    return (
      <div style={s.center}>
        <div style={s.notFoundBox}>
          <div style={s.notFoundIcon}>🔍</div>
          <h2 style={s.notFoundTitle}>Cartón no encontrado</h2>
          <p style={s.notFoundMsg}>
            Verifica tu enlace o contacta al organizador.
          </p>
        </div>
      </div>
    );
  }

  const si = STATUS_INFO[drawStatus] || STATUS_INFO.PENDING;
  const statusLabel = reconnecting
    ? '🔄 Reconectando…'
    : !connected
    ? '📡 Sin conexión'
    : si.label;
  const statusBg = reconnecting || !connected ? '#636e72' : si.bg;

  return (
    <div style={s.page}>
      {/* ── Celebration overlay ── */}
      {celebration && (
        <div style={s.overlay} onClick={() => setCelebrate(null)}>
          <div style={s.celebBox}>
            <div style={s.celebEmoji}>🎉</div>
            <div style={s.celebTitle}>¡GANASTE!</div>
            <div style={s.celebWinType}>
              {WIN_ES[celebration.winType] || celebration.winType}
            </div>
            <div style={s.celebEmoji}>🎉</div>
            <div style={s.celebTap}>Toca para cerrar</div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={s.toast}>
          <strong style={s.toastLetter}>{toast.letter}</strong>
          <strong style={s.toastNum}>{toast.number}</strong>
          <span style={s.toastLabel}> ¡está en tu cartón!</span>
        </div>
      )}

      {/* ── Header ── */}
      <div style={s.header}>
        <div style={s.headerTitle}>BINGO RENA WARE 2026</div>
        <div style={s.headerMeta}>
          <span>{card.participantName}</span>
          <span>Contrato: {card.contractNumber}</span>
          <span style={s.cardCode}>{card.cardCode}</span>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div style={{ ...s.statusBar, background: statusBg }}>{statusLabel}</div>

      {/* ── Bingo Card ── */}
      <div style={s.cardWrap}>
        <div style={s.grid}>
          {/* Column headers */}
          {LETTERS.map((l) => (
            <div key={l} style={s.colHeader}>{l}</div>
          ))}

          {/* Cells — iterate row by row for correct visual order */}
          {[0, 1, 2, 3, 4].flatMap((row) =>
            [0, 1, 2, 3, 4].map((col) => {
              const cell = card.grid[col][row];
              const isFree   = cell === 'FREE';
              const isMarked = isFree || numbersDrawn.includes(Number(cell));
              const isPopping = cell === poppingCell;

              return (
                <div
                  key={`${col}-${row}`}
                  className={isPopping ? 'cell-pop' : undefined}
                  style={{
                    ...s.cell,
                    ...(isMarked ? s.cellMarked : s.cellUnmarked),
                  }}
                >
                  <span style={s.cellText}>{isFree ? 'FREE' : cell}</span>
                  {isMarked && !isFree && <span style={s.check}>✓</span>}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Drawn numbers ── */}
      <div style={s.drawnSection}>
        <div style={s.drawnTitle}>
          Números sorteados — {numbersDrawn.length} / 75
        </div>
        <div style={s.drawnList}>
          {numbersDrawn.length === 0 ? (
            <span style={s.drawnEmpty}>Aún no se han sorteado números</span>
          ) : (
            [...numbersDrawn].reverse().map((n, i) => (
              <span key={i} style={s.chip}>
                {getLetter(n)}{n}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  // ── Layout ──
  page: {
    minHeight: '100dvh',
    background: '#f0f4f8',
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 480,
    margin: '0 auto',
  },
  center: {
    minHeight: '100dvh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f4f8',
    fontFamily: 'system-ui, sans-serif',
  },

  // ── Loading ──
  loaderText: { fontSize: 16, color: '#636e72' },

  // ── 404 ──
  notFoundBox: { textAlign: 'center', padding: 32 },
  notFoundIcon: { fontSize: 48, marginBottom: 12 },
  notFoundTitle: { fontSize: 20, fontWeight: 700, color: '#2d3436', margin: '0 0 8px' },
  notFoundMsg: { fontSize: 15, color: '#636e72', lineHeight: 1.5 },

  // ── Overlay ──
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.82)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
  },
  celebBox: {
    textAlign: 'center',
    animation: 'celebPop 0.4s ease',
    padding: 32,
  },
  celebEmoji:   { fontSize: 52, lineHeight: 1.2 },
  celebTitle:   { fontSize: 56, fontWeight: 900, color: '#fdcb6e', lineHeight: 1, margin: '8px 0' },
  celebWinType: { fontSize: 26, fontWeight: 700, color: '#fff', marginTop: 8 },
  celebTap:     { fontSize: 13, color: '#b2bec3', marginTop: 20 },

  // ── Toast ──
  toast: {
    position: 'fixed', top: 72, left: '50%',
    transform: 'translateX(-50%)',
    background: '#2d3436',
    color: '#fff',
    padding: '10px 20px',
    borderRadius: 24,
    fontSize: 15,
    zIndex: 50,
    whiteSpace: 'nowrap',
    animation: 'toastDrop 0.25s ease',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  },
  toastLetter: { color: '#74b9ff', marginRight: 4 },
  toastNum:    { color: '#55efc4', marginRight: 4 },
  toastLabel:  { color: '#dfe6e9' },

  // ── Header ──
  header: {
    background: '#c0392b',
    color: '#fff',
    padding: '12px 16px 10px',
  },
  headerTitle: { fontSize: 18, fontWeight: 900, letterSpacing: 1, marginBottom: 4 },
  headerMeta: {
    display: 'flex', flexWrap: 'wrap', gap: '2px 12px',
    fontSize: 12, color: 'rgba(255,255,255,0.85)',
  },
  cardCode: { fontWeight: 700, color: '#ffeaa7' },

  // ── Status bar ──
  statusBar: {
    padding: '7px 16px',
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    textAlign: 'center',
    transition: 'background 0.4s',
  },

  // ── Card grid ──
  cardWrap: { padding: '14px 12px 8px', },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: 4,
  },
  colHeader: {
    background: '#1a3a6b',
    color: '#fff',
    fontWeight: 900,
    fontSize: 'clamp(16px, 5vw, 22px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 6,
    aspectRatio: '1',
  },
  cell: {
    borderRadius: 6,
    aspectRatio: '1',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexDirection: 'column',
    position: 'relative',
    userSelect: 'none',
  },
  cellUnmarked: { background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' },
  cellMarked:   { background: '#27ae60' },
  cellText: {
    fontSize: 'clamp(13px, 4vw, 18px)',
    fontWeight: 700,
    color: 'inherit',
    lineHeight: 1,
  },
  check: {
    position: 'absolute', bottom: 2, right: 4,
    fontSize: 9, color: 'rgba(255,255,255,0.7)',
  },

  // ── Drawn numbers ──
  drawnSection: { padding: '8px 12px 24px' },
  drawnTitle: {
    fontSize: 12, fontWeight: 600, color: '#636e72',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 8,
  },
  drawnList: {
    display: 'flex', flexWrap: 'wrap', gap: 6,
    maxHeight: 120, overflowY: 'auto',
  },
  drawnEmpty: { fontSize: 13, color: '#b2bec3', fontStyle: 'italic' },
  chip: {
    background: '#dfe6e9',
    color: '#2d3436',
    borderRadius: 12,
    padding: '3px 8px',
    fontSize: 12,
    fontWeight: 600,
  },
};
