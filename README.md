# ReachFlow

Agency LinkedIn + Email outreach platform.

## Project structure

```
reachflow/
├── src/
│   ├── App.jsx              # Main React app (4,800+ lines)
│   ├── AuthScreen.jsx       # Login / signup screen
│   ├── supabase.js          # Supabase client
│   ├── useSupabaseData.js   # Data hook — replaces localStorage with Supabase
│   └── main.jsx             # Entry point
├── api/
│   ├── claude.js            # Anthropic API proxy
│   ├── linkedin/
│   │   ├── connect.js       # Initiate LinkedIn OAuth via Unipile
│   │   └── send.js          # Send LinkedIn messages via Unipile
│   ├── unipile/
│   │   └── webhook.js       # Receive LinkedIn replies + connection events
│   └── stripe/
│       ├── create-checkout.js  # Create Stripe checkout session
│       └── webhook.js          # Handle subscription lifecycle events
├── supabase/
│   └── schema.sql           # Full database schema — run this first
├── .env.example             # Copy to .env and fill in keys
├── vercel.json              # Vercel routing config
├── vite.config.js
└── package.json
```

## Setup

### 1. Supabase
1. Create a new project at supabase.com
2. SQL Editor → paste `supabase/schema.sql` → Run
3. Settings → API → copy URL and anon key

### 2. Environment variables
```bash
cp .env.example .env
# Fill in all values in .env
```

### 3. Local development
```bash
npm install
npm run dev
```

### 4. Deploy to Vercel
1. Push to GitHub
2. Connect repo at vercel.com
3. Add all `.env` values in Vercel → Settings → Environment Variables
4. Deploy

### 5. Unipile (LinkedIn API)
1. Sign up at unipile.com
2. Add `UNIPILE_API_KEY` to Vercel env vars
3. Set webhook URL in Unipile dashboard:
   `https://your-domain.com/api/unipile/webhook`

### 6. Stripe
1. Create three products in Stripe dashboard (Starter/Pro/Agency+)
2. Add price IDs and secret key to env vars
3. Set webhook URL: `https://your-domain.com/api/stripe/webhook`
4. Enable events: `customer.subscription.created/updated/deleted`

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Auth + DB | Supabase |
| LinkedIn API | Unipile |
| Email | Resend |
| Payments | Stripe |
| Hosting | Vercel |
| AI | Anthropic Claude |
