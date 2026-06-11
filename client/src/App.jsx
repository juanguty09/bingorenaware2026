import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminPanel from './pages/AdminPanel.jsx';
import DrawControl from './pages/DrawControl.jsx';
import CardView from './pages/CardView.jsx';
import PublicDisplay from './pages/PublicDisplay.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/draw" element={<DrawControl />} />
        <Route path="/carton/:cardCode" element={<CardView />} />
        <Route path="/display" element={<PublicDisplay />} />
        <Route path="/" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
