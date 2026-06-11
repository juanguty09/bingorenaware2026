import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const LETTERS = ['B', 'I', 'N', 'G', 'O'];
const LETTER_COLOR = { B: '#e74c3c', I: '#e67e22', N: '#2ecc71', G: '#3498db', O: '#9b59b6' };

const WIN_ES = {
  LINE:     'Línea',
  COLUMN:   'Columna',
  DIAGONAL: 'Diagonal',
  CORNERS:  'Cuatro Esquinas',
  BINGO:    'BINGO Completo',
};

const STATUS_INFO = {
  ACTIVE:   { label: 'SORTEO EN VIVO',    bg: '#27ae60' },
  PAUSED:   { label: 'SORTEO PAUSADO',    bg: '#f39c12' },
  PENDING:  { label: 'ESPERANDO INICIO',  bg: '#636e72' },
  FINISHED: { label: 'SORTEO FINALIZADO', bg: '#c0392b' },
};

// B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
const COLUMNS = LETTERS.map((_, i) => Array.from({ length: 15 }, (__, j) => i * 15 + j + 1));

function getLetter(n) {
  if (n <= 15) return 'B';
  if (n <= 30) return 'I';
  if (n <= 45) return 'N';
  if (n <= 60) return 'G';
  return 'O';
}

const STYLE_ID = 'display-keyframes';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    @keyframes numSlideIn {
      from { opacity: 0; transform: scale(0.55) translateY(16px); }
      to   { opacity: 1; transform: scale(1)    translateY(0);    }
    }
    @keyframes dotPop {
      0%   { transform: scale(1);   }
      50%  { transform: scale(1.6); }
      100% { transform: scale(1);   }
    }
    @keyframes marquee {
      from { transform: translateX(0);    }
      to   { transform: translateX(-50%); }
    }
    .dot-new { animation: dotPop 0.7s ease; }
  `;
  document.head.appendChild(el);
}

export default function PublicDisplay() {
  const [drawStatus,     setStatus]    = useState('PENDING');
  const [numbersDrawn,   setDrawn]     = useState([]);
  const [currentNumber,  setCurrent]   = useState(null);
  const [previousNumber, setPrev]      = useState(null);
  const [winners,        setWinners]   = useState([]);
  const [newNumber,      setNew]       = useState(null);
  const [animKey,        setAnimKey]   = useState(0);
  const [connected,      setConnected] = useState(false);
  const [reconnecting,   setReconn]    = useState(false);

  const currentRef = useRef(null);
  const newTimer   = useRef(null);

  useEffect(() => { currentRef.current = currentNumber; }, [currentNumber]);
  useEffect(() => { injectStyles(); }, []);

  // Load initial state on mount
  useEffect(() => {
    fetch('/api/draw/status')
      .then((r) => r.json())
      .then((data) => {
        setStatus(data.status);
        const drawn = data.numbersDrawn || [];
        setDrawn(drawn);
        if (data.currentNumber) {
          setCurrent(data.currentNumber);
          const idx = drawn.lastIndexOf(data.currentNumber);
          if (idx > 0) setPrev(drawn[idx - 1]);
        }
      })
      .catch(() => {});

    fetch('/api/winners')
      .then((r) => r.json())
      .then((data) => { if (data.winners) setWinners(data.winners); })
      .catch(() => {});
  }, []);

  // Socket.io — auto-reconnects by default
  useEffect(() => {
    const socket = io({ path: '/socket.io' });

    socket.on('connect',    () => { setConnected(true);  setReconn(false); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setReconn(true));
    socket.io.on('reconnect_attempt', () => setReconn(true));
    socket.io.on('reconnect',         () => { setConnected(true); setReconn(false); });

    socket.on('number_drawn', ({ number, allDrawn }) => {
      setPrev(currentRef.current);
      setCurrent(number);
      setDrawn(allDrawn);
      setAnimKey((k) => k + 1);
      clearTimeout(newTimer.current);
      setNew(number);
      newTimer.current = setTimeout(() => setNew(null), 800);
    });

    socket.on('winner_found', (winner) => {
      setWinners((prev) => [...prev, winner]);
    });

    socket.on('draw_status_change', ({ status }) => setStatus(status));

    return () => {
      socket.disconnect();
      clearTimeout(newTimer.current);
    };
  }, []);

  const si = STATUS_INFO[drawStatus] || STATUS_INFO.PENDING;
  const connLabel = reconnecting ? 'Reconectando…' : connected ? 'En vivo' : 'Sin conexión';
  const connColor = reconnecting ? '#f39c12' : connected ? '#27ae60' : '#c0392b';
  const currentLetter = currentNumber ? getLetter(currentNumber) : null;
  const prevLetter    = previousNumber ? getLetter(previousNumber) : null;

  return (
    <div style={s.page}>
      {/* ── HEADER ── */}
      <div style={s.header}>
        <div style={s.title}>BINGO RENA WARE 2026</div>
        <div style={s.headerRight}>
          <div style={{ ...s.statusPill, background: si.bg }}>{si.label}</div>
          <div style={s.connRow}>
            <div style={{ ...s.connDot, background: connColor }} />
            <span style={s.connLabel}>{connLabel}</span>
          </div>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={s.main}>
        {/* LEFT: current number display */}
        <div style={s.leftPanel}>
          {currentNumber ? (
            <>
              <div key={animKey} style={s.currentWrap}>
                <span style={{ ...s.currentLetter, color: LETTER_COLOR[currentLetter] }}>
                  {currentLetter}
                </span>
                <span style={s.currentNum}>{currentNumber}</span>
              </div>

              {previousNumber && (
                <div style={s.prevWrap}>
                  <span style={s.prevLabel}>Anterior: </span>
                  <span style={{ ...s.prevLetter, color: LETTER_COLOR[prevLetter] }}>
                    {prevLetter}
                  </span>
                  <span style={s.prevNum}>{previousNumber}</span>
                </div>
              )}
            </>
          ) : (
            <div style={s.waitingText}>
              {drawStatus === 'PENDING' ? 'Esperando inicio…' : '—'}
            </div>
          )}

          <div style={s.drawnCount}>
            {numbersDrawn.length}
            <span style={s.drawnOf}> / 75 sorteados</span>
          </div>
        </div>

        {/* RIGHT: B/I/N/G/O number grid */}
        <div style={s.gridWrap}>
          <div style={s.bingoGrid}>
            {LETTERS.map((letter, colIdx) => (
              <div key={letter} style={s.gridCol}>
                <div style={{ ...s.colHeader, background: LETTER_COLOR[letter] }}>{letter}</div>
                {COLUMNS[colIdx].map((n) => {
                  const isDrawn   = numbersDrawn.includes(n);
                  const isCurrent = n === currentNumber;
                  const isNew     = n === newNumber;
                  return (
                    <div
                      key={n}
                      className={isNew ? 'dot-new' : undefined}
                      style={{
                        ...s.numCell,
                        ...(isDrawn   ? s.numCellDrawn   : {}),
                        ...(isCurrent ? s.numCellCurrent : {}),
                      }}
                    >
                      {n}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── WINNERS FOOTER ── */}
      <div style={s.footer}>
        <div style={s.footerLabel}>GANADORES</div>
        <div style={s.tickerOuter}>
          {winners.length === 0 ? (
            <span style={s.noWinners}>Esperando ganadores…</span>
          ) : (
            <div
              key={winners.length}
              style={{
                ...s.tickerTrack,
                animationDuration: `${Math.max(20, winners.length * 6)}s`,
              }}
            >
              {/* Duplicate items so the marquee loops seamlessly (-50% = one full copy) */}
              {[...winners, ...winners].map((w, i) => (
                <span key={i} style={s.tickerItem}>
                  <span style={s.tickerName}>{w.participantName}</span>
                  <span style={s.tickerWin}>{WIN_ES[w.winType] || w.winType}</span>
                  <span style={s.tickerSep}>•</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  // ── Page ──
  page: {
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    background: '#080c18',
    color: '#fff',
    fontFamily: 'system-ui, sans-serif',
    overflow: 'hidden',
    userSelect: 'none',
  },

  // ── Header ──
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 32px',
    height: 68,
    background: '#0d1220',
    borderBottom: '2px solid #1a2240',
    flexShrink: 0,
  },
  title: {
    fontSize: 'clamp(16px, 2vw, 30px)',
    fontWeight: 900,
    letterSpacing: '0.07em',
  },
  headerRight: { display: 'flex', alignItems: 'center', gap: 20 },
  statusPill: {
    padding: '5px 18px',
    borderRadius: 20,
    fontSize: 'clamp(10px, 0.9vw, 13px)',
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#fff',
  },
  connRow: { display: 'flex', alignItems: 'center', gap: 7 },
  connDot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  connLabel: { fontSize: 12, color: '#636e72' },

  // ── Main ──
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },

  // ── Left panel ──
  leftPanel: {
    width: '40%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'clamp(10px, 2vh, 28px)',
    padding: '0 24px',
    borderRight: '2px solid #1a2240',
    flexShrink: 0,
  },
  currentWrap: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 'clamp(4px, 0.8vw, 14px)',
    animation: 'numSlideIn 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
  },
  currentLetter: {
    fontSize: 'clamp(52px, 7.5vw, 130px)',
    fontWeight: 900,
    lineHeight: 1,
  },
  currentNum: {
    fontSize: 'clamp(80px, 13vw, 220px)',
    fontWeight: 900,
    lineHeight: 1,
    color: '#fff',
  },
  prevWrap: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 5,
    opacity: 0.5,
  },
  prevLabel:  { fontSize: 'clamp(12px, 1.1vw, 18px)', color: '#95a5a6' },
  prevLetter: { fontSize: 'clamp(14px, 1.6vw, 26px)', fontWeight: 700 },
  prevNum:    { fontSize: 'clamp(16px, 2vw, 34px)',   fontWeight: 700, color: '#bdc3c7' },
  drawnCount: {
    fontSize: 'clamp(20px, 2.4vw, 40px)',
    fontWeight: 900,
    color: '#fff',
  },
  drawnOf: {
    fontSize: 'clamp(11px, 1.1vw, 18px)',
    fontWeight: 400,
    color: '#636e72',
  },
  waitingText: {
    fontSize: 'clamp(18px, 2.5vw, 40px)',
    color: '#2c3e50',
    fontStyle: 'italic',
  },

  // ── BINGO grid ──
  gridWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 28px',
    overflow: 'hidden',
  },
  bingoGrid: {
    display: 'flex',
    gap: 'clamp(3px, 0.5vw, 8px)',
    height: '100%',
  },
  gridCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(2px, 0.3vh, 5px)',
    width: 'clamp(44px, 5.5vw, 88px)',
  },
  colHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 'clamp(14px, 1.8vw, 26px)',
    borderRadius: 6,
    color: '#fff',
    flexShrink: 0,
    height: 'clamp(32px, 4vh, 56px)',
  },
  numCell: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111827',
    borderRadius: 4,
    fontSize: 'clamp(10px, 1.2vw, 17px)',
    color: '#374151',
    fontWeight: 600,
    transition: 'background 0.35s, color 0.35s',
    minHeight: 18,
  },
  numCellDrawn: {
    background: '#27ae60',
    color: '#fff',
  },
  numCellCurrent: {
    background: '#f1c40f',
    color: '#1a1a2e',
    fontWeight: 900,
  },

  // ── Winners footer ──
  footer: {
    height: 64,
    flexShrink: 0,
    background: '#0d1220',
    borderTop: '2px solid #1a2240',
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
  },
  footerLabel: {
    padding: '0 22px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.14em',
    color: '#f39c12',
    flexShrink: 0,
    borderRight: '1px solid #1a2240',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
  },
  tickerOuter: {
    flex: 1,
    overflow: 'hidden',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
  },
  tickerTrack: {
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    animation: 'marquee linear infinite',
    willChange: 'transform',
  },
  tickerItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 28px',
  },
  tickerName: {
    fontSize: 'clamp(12px, 1.1vw, 16px)',
    fontWeight: 700,
    color: '#ecf0f1',
  },
  tickerWin: {
    fontSize: 'clamp(10px, 0.85vw, 13px)',
    fontWeight: 600,
    color: '#f39c12',
    background: 'rgba(243,156,18,0.18)',
    padding: '2px 10px',
    borderRadius: 10,
  },
  tickerSep: { color: '#1e2a40', fontSize: 20, lineHeight: 1 },
  noWinners: { color: '#2c3e50', fontSize: 14, paddingLeft: 28, fontStyle: 'italic' },
};
