# DM Tracker Extension

A full-stack outreach CRM that automatically logs and manages direct message conversations from Carousell into a shared team database. Built for small startup teams to track all co-founders' outreach activity in one place.

## Architecture

- **Browser Extension** (Chrome, Manifest V3) — runs on Carousell, extracts DM conversations from the DOM, sends to the backend
- **Backend API** (Node.js + Express, TypeScript) — receives conversation data, generates AI summaries using Claude, writes to the database
- **Database** (Supabase / PostgreSQL) — stores contacts, conversations, and messages
- **Frontend Dashboard** (React + Tailwind, TypeScript) — view and manage all outreach activity

## Setup Instructions

### 1. Database (Supabase)

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in your Supabase dashboard
3. Copy the contents of `supabase/migrations/001_initial_schema.sql` and run it
4. Go to **Settings > API** and copy your **Project URL** and **service_role key**

### 2. Backend

```bash
cd backend
cp .env.example .env
```

Fill in your `.env` file:
- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_SERVICE_KEY` — your Supabase service role key
- `ANTHROPIC_API_KEY` — your Anthropic API key (get one at [console.anthropic.com](https://console.anthropic.com))
- `JWT_SECRET` — any random string (used to sign login tokens)

Then install and run:

```bash
npm install
npm run dev
```

The backend runs on `http://localhost:3001` by default.

### 3. Frontend Dashboard

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Register an account, then log in.

### 4. Chrome Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked** and select the `extension` folder
4. Navigate to [carousell.sg](https://www.carousell.sg) and open your DMs
5. Click the extension icon and log in with your backend URL and credentials

## How It Works

### Full Historical Sync
Triggered from the extension popup. Auto-scrolls through your entire Carousell DM inbox, opens each conversation, captures the full message history, and syncs everything to the backend. Shows progress in the popup. Safe to re-run — skips conversations already synced.

### Incremental Sync
A "Sync this conversation" button appears on Carousell DM pages. Click it to sync just the conversation you're currently viewing.

### AI Summaries
Each conversation is automatically summarised using Claude (1-2 sentences) so you can quickly scan what was discussed and the outcome.

### Dashboard
View all conversations in a table with filters for co-founder, status, and date range. Click into any conversation to see the full message thread and AI summary. Change the status (New / Responded / Following Up / Converted / Not Interested) directly from the table.

## Project Structure

```
DM_Tracker_Extension/
├── extension/          # Chrome extension (Manifest V3)
│   └── src/
│       ├── background/ # Service worker
│       ├── content/    # Content scripts + platform extractors
│       │   └── platforms/  # Modular platform extractors (add new platforms here)
│       ├── popup/      # Extension popup UI
│       ├── types/      # TypeScript types
│       └── utils/      # Shared utilities
├── backend/            # Express API server
│   └── src/
│       ├── middleware/  # Auth middleware
│       ├── routes/     # API routes
│       ├── services/   # AI summarization service
│       ├── types/      # TypeScript types
│       └── utils/      # Supabase client
├── frontend/           # React dashboard
│   └── src/
│       ├── components/ # Reusable UI components
│       ├── hooks/      # React hooks
│       ├── pages/      # Page components
│       ├── services/   # API client
│       └── types/      # TypeScript types
└── supabase/
    └── migrations/     # SQL migration files
```

## Adding a New Platform

The extension is designed to be modular. To add a new platform (e.g. Facebook Marketplace):

1. Create a new file in `extension/src/content/platforms/` (e.g. `facebook.ts`)
2. Implement the `PlatformExtractor` interface
3. Register it in `extension/src/content/platforms/index.ts`
4. Add the platform's URL to `manifest.json` under `content_scripts.matches` and `host_permissions`
