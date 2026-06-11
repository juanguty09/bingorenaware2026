import { useState, useRef } from 'react';

const styles = {
  page: { maxWidth: 960, margin: '0 auto', padding: 32, fontFamily: 'system-ui, sans-serif' },
  heading: { fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#1a1a2e' },
  section: { marginBottom: 24 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#444' },
  input: {
    width: '100%', padding: '8px 12px', fontSize: 14, border: '1px solid #ccc',
    borderRadius: 6, boxSizing: 'border-box',
  },
  fileRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  fileBtn: {
    padding: '8px 16px', background: '#f0f0f0', border: '1px solid #ccc',
    borderRadius: 6, cursor: 'pointer', fontSize: 14,
  },
  fileName: { fontSize: 13, color: '#555', fontStyle: 'italic' },
  uploadBtn: {
    padding: '10px 24px', background: '#0057b8', color: '#fff', border: 'none',
    borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  uploadBtnDisabled: {
    padding: '10px 24px', background: '#aaa', color: '#fff', border: 'none',
    borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'not-allowed',
  },
  progressWrap: { margin: '16px 0' },
  progressTrack: { height: 10, background: '#e0e0e0', borderRadius: 5, overflow: 'hidden' },
  progressBar: { height: '100%', background: '#0057b8', transition: 'width 0.2s ease' },
  progressLabel: { fontSize: 12, color: '#666', marginTop: 4 },
  processingLabel: { fontSize: 13, color: '#555', marginTop: 8, fontStyle: 'italic' },
  success: {
    padding: '12px 16px', background: '#d4edda', border: '1px solid #c3e6cb',
    borderRadius: 6, color: '#155724', fontWeight: 600, marginBottom: 20,
  },
  error: {
    padding: '12px 16px', background: '#f8d7da', border: '1px solid #f5c6cb',
    borderRadius: 6, color: '#721c24', marginBottom: 20,
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: {
    textAlign: 'left', padding: '10px 12px', background: '#f4f4f4',
    borderBottom: '2px solid #ddd', fontWeight: 600, color: '#333',
  },
  td: { padding: '9px 12px', borderBottom: '1px solid #eee', color: '#444' },
  tableTitle: { fontSize: 15, fontWeight: 600, marginBottom: 10, color: '#333' },
};

export default function AdminPanel() {
  const [password, setPassword] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef(null);

  const canUpload = file && password && !uploading && !processing;

  function handleFileChange(e) {
    setFile(e.target.files[0] || null);
    setResult(null);
    setError(null);
  }

  async function handleExport() {
    if (!password) { setError('Ingresa la contraseña primero'); return; }
    setError(null);
    setExporting(true);
    try {
      const r = await fetch('/api/admin/winners/export', {
        headers: { 'x-admin-password': password },
      });
      if (!r.ok) {
        const data = await r.json();
        setError(data.error || 'Error al exportar');
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ganadores-bingo-2026.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Error de red al exportar');
    } finally {
      setExporting(false);
    }
  }

  function handleUpload() {
    if (!canUpload) return;

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.upload.onload = () => {
      setUploading(false);
      setProcessing(true);
    };

    xhr.onload = () => {
      setProcessing(false);
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status === 200) {
          setResult(data);
          setError(null);
        } else {
          setError(data.error || 'Error al cargar el archivo');
          setResult(null);
        }
      } catch {
        setError('Respuesta inesperada del servidor');
        setResult(null);
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setProcessing(false);
      setError('Error de red. Verifica que el servidor esté corriendo.');
    };

    xhr.open('POST', '/api/admin/upload-participants');
    xhr.setRequestHeader('x-admin-password', password);
    setUploading(true);
    setProcessing(false);
    setProgress(0);
    setResult(null);
    setError(null);
    xhr.send(formData);
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Panel de Administrador — Bingo Rena Ware 2026</h1>

      <div style={styles.section}>
        <label style={styles.label}>Contraseña de administrador</label>
        <input
          style={{ ...styles.input, maxWidth: 320 }}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Ingresa la contraseña"
        />
      </div>

      <div style={styles.section}>
        <label style={styles.label}>Archivo de participantes (.xlsx, .xls, .csv)</label>
        <div style={styles.fileRow}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button style={styles.fileBtn} onClick={() => fileInputRef.current?.click()}>
            Seleccionar archivo
          </button>
          <span style={styles.fileName}>{file ? file.name : 'Ningún archivo seleccionado'}</span>
          <button
            style={canUpload ? styles.uploadBtn : styles.uploadBtnDisabled}
            onClick={handleUpload}
            disabled={!canUpload}
          >
            {uploading ? 'Subiendo...' : processing ? 'Procesando...' : 'Cargar participantes'}
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
          Columnas requeridas: participantId, fullName, contractNumber, organization, email, phone
        </p>
      </div>

      {(uploading || processing) && (
        <div style={styles.progressWrap}>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressBar, width: `${uploading ? progress : 100}%` }} />
          </div>
          {uploading && <div style={styles.progressLabel}>Subiendo archivo: {progress}%</div>}
          {processing && (
            <div style={styles.processingLabel}>
              Procesando participantes y generando cartones...
            </div>
          )}
        </div>
      )}

      <div style={styles.section}>
        <label style={styles.label}>Exportar resultados</label>
        <button
          style={password && !exporting ? styles.uploadBtn : styles.uploadBtnDisabled}
          onClick={handleExport}
          disabled={!password || exporting}
        >
          {exporting ? 'Descargando…' : 'Descargar Ganadores CSV'}
        </button>
        <p style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
          Exporta todos los ganadores registrados con nombre, contrato, cartón y tipo de premio.
        </p>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {result && (
        <>
          <div style={styles.success}>{result.message}</div>
          <div style={styles.tableTitle}>
            Primeros {result.participants.length} participantes cargados
          </div>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>#</th>
                <th style={styles.th}>Nombre completo</th>
                <th style={styles.th}>N° de contrato</th>
                <th style={styles.th}>Código de cartón</th>
              </tr>
            </thead>
            <tbody>
              {result.participants.map((p, i) => (
                <tr key={p.id}>
                  <td style={styles.td}>{i + 1}</td>
                  <td style={styles.td}>{p.fullName}</td>
                  <td style={styles.td}>{p.contractNumber}</td>
                  <td style={{ ...styles.td, fontWeight: 600, color: '#0057b8' }}>{p.cardCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
