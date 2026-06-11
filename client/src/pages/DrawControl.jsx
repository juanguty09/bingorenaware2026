import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const COLUMNS = {
  B: Array.from({ length: 15 }, (_, i) => i + 1),
  I: Array.from({ length: 15 }, (_, i) => i + 16),
  N: Array.from({ length: 15 }, (_, i) => i + 31),
  G: Array.from({ length: 15 }, (_, i) => i + 46),
  O: Array.from({ length: 15 }, (_, i) => i + 61),
};

const LETTER_COLOR = { B: '#e74c3c', I: '#e67e22', N: '#2ecc71', G: '#3498db', O: '#9b59b6' };
const STATUS_COLOR = { PENDING: '#7f8c8d', ACTIVE: '#2ecc71', PAUSED: '#f39c12', FINISHED: '#e74c3c' };

function getLetter(n) {
  if (n <= 15) return 'B';
  if (n <= 30) return 'I';
  if (n <= 45) return 'N';
  if (n <= 60) return 'G';
  return 'O';
}

export default function DrawControl() {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('PENDING');
  const [currentNumber, setCurrentNumber] = useState(null);
  const [currentLetter, setCurrentLetter] = useState(null);
  const [allDrawn, setAllDrawn] = useState([]);
  const [winners, setWinners] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('number_drawn', ({ number, letter, allDrawn: all }) => {
      setCurrentNumber(number);
      setCurrentLetter(letter);
      setAllDrawn(all);
    });

    socket.on('winner_found', (winner) => {
      setWinners((prev) => [winner, ...prev]);
    });

    socket.on('draw_status_change', ({ status: s }) => setStatus(s));
    socket.on('error', ({ message }) => setError(message));

    fetch('/api/draw/status')
      .then((r) => r.json())
      .then((data) => {
        setStatus(data.status);
        setAllDrawn(data.numbersDrawn || []);
        if (data.currentNumber) {
          setCurrentNumber(data.currentNumber);
          setCurrentLetter(getLetter(data.currentNumber));
        }
      })
      .catch(() => {});

    return () => socket.disconnect();
  }, []);

  async function control(action) {
    if (!password) return setError('Ingresa la contraseña primero');
    setError(null);
    try {
      const r = await fetch(`/api/admin/draw/${action}`, {
        method: 'POST',
        headers: { 'x-admin-password': password },
      });
      const data = await r.json();
      if (!r.ok) setError(data.error);
    } catch (err) {
      setError(err.message);
    }
  }

  const isPending = status === 'PENDING' || status === 'FINISHED';
  const isActive = status === 'ACTIVE';
  const isPaused = status === 'PAUSED';

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>Control de Sorteo — Bingo Rena Ware 2026</h1>
        <div style={s.connRow}>
          <div style={{ ...s.dot, background: connected ? '#2ecc71' : '#e74c3c' }} />
          <span style={s.connLabel}>{connected ? 'Conectado' : 'Desconectado'}</span>
        </div>
      </div>

      {/* Password */}
      <input
        type="password"
        placeholder="Contraseña de administrador"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={s.passInput}
      />

      {error && <div style={s.error}>{error}</div>}

      <div style={s.main}>
        {/* LEFT: current number + controls */}
        <div style={s.leftPanel}>
          <div style={s.numberBox}>
            {currentNumber ? (
              <>
                <div style={{ ...s.bigLetter, color: LETTER_COLOR[currentLetter] }}>
                  {currentLetter}
                </div>
                <div style={s.bigNumber}>{currentNumber}</div>
              </>
            ) : (
              <div style={s.dash}>—</div>
            )}
          </div>

          <div style={s.countLabel}>{allDrawn.length} / 75 números sorteados</div>

          <div style={{ ...s.statusBadge, background: STATUS_COLOR[status] }}>{status}</div>

          <div style={s.btnGroup}>
            <Btn color="#2ecc71" disabled={!isPending} onClick={() => control('start')}>
              ▶ Iniciar
            </Btn>
            <Btn color="#f39c12" disabled={!isActive} onClick={() => control('pause')}>
              ⏸ Pausar
            </Btn>
            <Btn color="#3498db" disabled={!isPaused} onClick={() => control('resume')}>
              ▶ Reanudar
            </Btn>
            <Btn color="#e74c3c" disabled={!isActive && !isPaused} onClick={() => control('end')}>
              ■ Terminar
            </Btn>
          </div>
        </div>

        {/* CENTER: B/I/N/G/O number grid */}
        <div style={s.grid}>
          {Object.entries(COLUMNS).map(([letter, nums]) => (
            <div key={letter} style={s.gridCol}>
              <div style={{ ...s.colHeader, background: LETTER_COLOR[letter] }}>{letter}</div>
              {nums.map((n) => {
                const isDrawn = allDrawn.includes(n);
                const isCurrent = n === currentNumber;
                return (
                  <div
                    key={n}
                    style={{
                      ...s.cell,
                      ...(isDrawn ? s.cellDrawn : {}),
                      ...(isCurrent ? s.cellCurrent : {}),
                    }}
                  >
                    {n}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* RIGHT: Winners */}
        <div style={s.winnersPanel}>
          <h3 style={s.winnersTitle}>Ganadores ({winners.length})</h3>
          <div style={s.winnersList}>
            {winners.length === 0 ? (
              <p style={s.noWinners}>Aún no hay ganadores</p>
            ) : (
              winners.map((w, i) => (
                <div key={i} style={s.winnerCard}>
                  <div style={s.winType}>{w.winType}</div>
                  <div style={s.winName}>{w.participantName}</div>
                  <div style={s.winMeta}>
                    #{w.contractNumber} · {w.cardCode}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Btn({ color, disabled, onClick, children }) {
  return (
    <button
      style={{
        padding: '11px 0',
        background: disabled ? '#2a2a3a' : color,
        color: disabled ? '#555' : '#fff',
        border: 'none',
        borderRadius: 8,
        fontWeight: 700,
        fontSize: 14,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.2s',
        width: '100%',
      }}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: '#0f0f1a',
    color: '#fff',
    padding: 24,
    fontFamily: 'system-ui, sans-serif',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: 700, margin: 0 },
  connRow: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: '50%' },
  connLabel: { fontSize: 12, color: '#aaa' },
  passInput: {
    padding: '8px 12px',
    background: '#1e1e2e',
    border: '1px solid #333',
    borderRadius: 6,
    color: '#fff',
    fontSize: 14,
    width: 280,
    marginBottom: 16,
    display: 'block',
  },
  error: {
    padding: '10px 14px',
    background: '#3a1a1a',
    border: '1px solid #e74c3c',
    borderRadius: 6,
    color: '#f5a5a5',
    marginBottom: 16,
    fontSize: 13,
  },
  main: { display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' },
  leftPanel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    minWidth: 190,
  },
  numberBox: {
    width: 190,
    height: 190,
    background: '#1e1e2e',
    borderRadius: 16,
    border: '2px solid #2a2a3e',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigLetter: { fontSize: 44, fontWeight: 900, lineHeight: 1 },
  bigNumber: { fontSize: 80, fontWeight: 900, lineHeight: 1, color: '#fff' },
  dash: { fontSize: 60, color: '#333' },
  countLabel: { fontSize: 13, color: '#888' },
  statusBadge: {
    padding: '3px 14px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: 1,
  },
  btnGroup: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%' },
  grid: { display: 'flex', gap: 4 },
  gridCol: { display: 'flex', flexDirection: 'column', gap: 3 },
  colHeader: {
    width: 46,
    height: 46,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 900,
    fontSize: 20,
    borderRadius: 6,
    color: '#fff',
  },
  cell: {
    width: 46,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1a1a2a',
    borderRadius: 4,
    fontSize: 13,
    color: '#444',
    transition: 'background 0.4s, color 0.4s',
  },
  cellDrawn: { background: '#2c3e50', color: '#7f8c8d' },
  cellCurrent: { background: '#f39c12', color: '#fff', fontWeight: 700 },
  winnersPanel: {
    flex: 1,
    minWidth: 220,
    maxWidth: 320,
    background: '#1e1e2e',
    borderRadius: 12,
    padding: 16,
  },
  winnersTitle: { margin: '0 0 12px', fontSize: 16, fontWeight: 700 },
  winnersList: { maxHeight: 520, overflowY: 'auto' },
  noWinners: { color: '#555', fontSize: 13, textAlign: 'center', marginTop: 40 },
  winnerCard: {
    padding: '10px 12px',
    background: '#252538',
    borderRadius: 8,
    marginBottom: 8,
    borderLeft: '3px solid #f39c12',
  },
  winType: { fontSize: 11, fontWeight: 700, color: '#f39c12', marginBottom: 2, letterSpacing: 1 },
  winName: { fontSize: 14, fontWeight: 600, color: '#fff' },
  winMeta: { fontSize: 12, color: '#666', marginTop: 2 },
};
