# Bingo Rena Ware 2026

Virtual Bingo web application for the Rena Ware corporate sales campaign.
Supports ~3,000 participants with real-time updates via Socket.io.

## Stack

- **Backend**: Node.js + Express + Socket.io
- **Database**: PostgreSQL + Prisma ORM
- **Frontend**: React + Vite
- **Deployment**: Railway (Docker)

---

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL running locally (or a cloud connection string)

### Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd bingo-renaware-2026

# 2. Copy and fill in environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL, ADMIN_PASSWORD, etc.

# 3. Install server dependencies
npm install

# 4. Apply database schema
npm run prisma:migrate      # development (creates migration files)
# OR: npx prisma db push --schema=server/prisma/schema.prisma

# 5. Install client dependencies
cd client && npm install && cd ..

# 6. Start the backend (port 3001)
npm run dev

# 7. In a second terminal, start the frontend (port 5173)
cd client && npm run dev
```

Open **http://localhost:5173** in your browser.

### Available Routes

| URL | Description |
|-----|-------------|
| `/admin` | Upload participants Excel file |
| `/admin/draw` | Control the live draw (start/pause/resume/end) |
| `/display` | Full-screen projector view |
| `/carton/:cardCode` | Individual participant bingo card |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `ADMIN_PASSWORD` | Yes | Password for all admin routes and the draw panel |
| `PORT` | No | Server port (default: 3001; Railway sets this automatically) |
| `CLIENT_URL` | No | Frontend origin for CORS (Railway auto-detects via `RAILWAY_PUBLIC_DOMAIN`) |
| `NODE_ENV` | No | Set to `production` to enable static file serving |

---

## Railway Deployment

### Step 1 — Push code to GitHub

```bash
git init
git add .
git commit -m "initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

### Step 2 — Create a Railway account

Sign up at **https://railway.app** (free tier available).

### Step 3 — Create a new project

1. Click **New Project** in the Railway dashboard
2. Select **Deploy from GitHub repo**
3. Authorize Railway to access your GitHub account
4. Select your repository

Railway detects the `Dockerfile` automatically and begins building.

### Step 4 — Add a PostgreSQL database

1. In your Railway project, click **+ New**
2. Select **Database → PostgreSQL**
3. Railway creates the database and automatically injects `DATABASE_URL` into your app service

### Step 5 — Set environment variables

In your app service → **Variables** tab, add:

```
ADMIN_PASSWORD=<choose a strong password>
NODE_ENV=production
```

`PORT` and `DATABASE_URL` are injected by Railway automatically.

### Step 6 — Deploy

Railway triggers a deploy automatically on every push to `main`. The first deploy will:

1. Build the Docker image (installs deps, builds the React frontend)
2. On container start: run `prisma db push` to sync the schema, then start the server

### Step 7 — Get your public URL

In the Railway dashboard → your app service → **Settings** → **Networking** → click **Generate Domain**.

Your app is live at `https://<your-app>.up.railway.app`.

---

## How to Run the Event

### Before the event: Upload participants

1. Prepare an Excel file (`.xlsx`) with these exact column headers:

   | participantId | fullName | contractNumber | organization | email | phone |
   |---|---|---|---|---|---|

2. Open `https://<your-app>.up.railway.app/admin`
3. Enter the admin password
4. Select the file and click **Cargar participantes**
5. The system imports participants and generates a unique bingo card for each one
6. Share each participant's card link: `https://<your-app>.up.railway.app/carton/<cardCode>`

### During the event: Run the live draw

1. Open `https://<your-app>.up.railway.app/admin/draw` (keep this tab open on your laptop)
2. Project `https://<your-app>.up.railway.app/display` on the big screen (full-screen browser)
3. When ready, enter the admin password and click **▶ Iniciar** — numbers draw every 5 seconds
4. Use **⏸ Pausar** / **▶ Reanudar** to hold for announcements
5. The display screen shows each number live and scrolls winners as they appear
6. Click **■ Terminar** when the event is over

### After the event: Export results

1. Go to `/admin`
2. Enter the admin password
3. Click **Descargar Ganadores CSV**
4. Open the file in Excel — columns: Nombre, Contrato, Codigo_Carton, Tipo_Premio, Fecha_Hora

---

## Build for Production (manual)

```bash
# Build the React frontend into server/public/
npm run build

# Start the production server
NODE_ENV=production node server/index.js
```
