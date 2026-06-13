require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');
const cors = require('cors');

const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');
const drawEngine = require('./services/drawEngine');

const app = express();
const server = http.createServer(app);

// In production Railway sets RAILWAY_PUBLIC_DOMAIN; fall back to CLIENT_URL for custom domains
const clientUrl =
  process.env.CLIENT_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : 'http://localhost:5173');

const io = new Server(server, {
  cors: { origin: clientUrl, methods: ['GET', 'POST'] },
});

app.use(cors({ origin: clientUrl }));
app.use(express.json());

app.use('/api/admin', adminRoutes);
app.use('/api', publicRoutes);

// Serve the built React app when server/public/index.html is present.
// Checked at startup so it works without NODE_ENV=production being set.
const staticPath = path.join(__dirname, 'public');
const indexHtml  = path.join(staticPath, 'index.html');
if (fs.existsSync(indexHtml)) {
  app.use(express.static(staticPath));
  // SPA catch-all: any GET not matched by /api or /socket.io serves index.html
  app.get('*', (_req, res) => res.sendFile(indexHtml));
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Admin can control the draw via socket as an alternative to REST
  socket.on('admin_draw_control', async ({ action, password }) => {
    if (!password || password !== process.env.ADMIN_PASSWORD) {
      socket.emit('error', { message: 'No autorizado' });
      return;
    }
    try {
      if (action === 'start') await drawEngine.startDraw();
      else if (action === 'pause') await drawEngine.pauseDraw();
      else if (action === 'resume') await drawEngine.resumeDraw();
      else if (action === 'end') await drawEngine.endDraw();
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('disconnect', () => console.log(`Client disconnected: ${socket.id}`));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await drawEngine.init(io);
});

module.exports = { io };
