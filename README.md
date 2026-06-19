# Trip Tracker — Multi-user shared expense tracker

A full multi-user web app for splitting shared expenses — trips, flatshares, events, anything.
Anyone can sign up, create a "project," invite others, and track who paid what, who owes whom,
with full edit history, a recoverable trash bin, and recurring expense templates.

## Features

- **Multi-user accounts** — email/password or Google sign-in
- **Multiple projects** — one account can have many trips/groups, each isolated
- **Invite via link or email** — share a code, or invite someone's email directly
- **Placeholder members** — add people who don't want to create an account; you log expenses on their behalf
- **Full expense tracking** — description, amount, category, payment mode, who paid, who it's split among (partial splits supported), notes
- **Day and/or Date** — use a day label ("Day 3"), a calendar date, or both — at least one is required
- **Edit and delete expenses** — not just add; mistakes are fixable
- **Custom categories and payment modes** — add your own anytime, per project
- **Settlement payments** — record money already transferred between people (e.g. "X already paid me ₹40,000 across 4 payments") — this is layered on top of expense balances automatically
- **Settle-up calculator** — minimum number of transactions needed to settle all balances, accounting for settlements already made
- **Recurring templates** — save a common expense (like "daily breakfast") and reuse it in one click
- **Activity log** — every add/edit/delete is recorded with who and when, for transparency and trust
- **30-day recoverable trash** — deleting an expense or settlement doesn't destroy it immediately; it can be restored for 30 days. This directly fixes the "accidentally hit reset and lost everything" problem.
- **CSV export** — download all expenses for a project anytime

## Tech stack

- **Frontend**: React 18 + React Router, plain CSS (no framework lock-in)
- **Backend**: Supabase (Postgres database + Auth + Row Level Security) — free tier is enough for personal/small-group use
- **Hosting**: Vercel or Netlify (free tier)

You will need free accounts on Supabase and Vercel (or Netlify). Neither requires a credit card for the free tier as of this writing — if that's changed, the free tier equivalent will still work.

---

## Setup — Part 1: Supabase (database + auth)

1. Go to https://supabase.com and sign up / log in.
2. Click **New Project**. Choose any name (e.g. "trip-tracker"), set a database password (save it somewhere), pick the region closest to you, and create the project. Wait ~2 minutes for it to provision.
3. Once it's ready, go to the **SQL Editor** tab (left sidebar) → **New query**.
4. Open the file `supabase/schema.sql` from this codebase, copy its entire contents, paste into the SQL editor, and click **Run**. This creates all tables, security rules, and starter data triggers. You should see "Success. No rows returned."
5. Go to **Project Settings** (gear icon) → **API**. You'll see:
   - **Project URL** — looks like `https://abcdefgh.supabase.co`
   - **anon public** key — a long string starting with `eyJ...`
   Keep this tab open, you'll need both values shortly.
6. **Enable Google sign-in (optional)**: Go to **Authentication** → **Providers** → **Google**, toggle it on, and follow Supabase's instructions to create Google OAuth credentials (takes ~5 extra minutes). You can skip this and just use email/password if you prefer — toggle it off in the app's Login/Signup pages later by removing the Google button, or just leave it and it simply won't work until configured.
7. **Email confirmation**: By default, Supabase requires email confirmation for new signups. For faster testing, you can turn this off at **Authentication** → **Providers** → **Email** → toggle off "Confirm email." For a real public deployment, leave it on.

## Setup — Part 2: Configure the app locally

1. Make sure you have [Node.js](https://nodejs.org) installed (v18 or newer).
2. Open a terminal in this project folder.
3. Copy the example environment file:
   ```
   cp .env.example .env
   ```
4. Open `.env` and paste in your Supabase **Project URL** and **anon public** key from step 5 above:
   ```
   VITE_SUPABASE_URL=https://abcdefgh.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...your-long-key...
   ```
5. Install dependencies:
   ```
   npm install
   ```
6. Run it locally to test:
   ```
   npm run dev
   ```
   Open the URL it prints (usually `http://localhost:5173`). Sign up, create a project, try adding expenses.

If everything works locally, you're ready to deploy.

## Setup — Part 3: Deploy to Vercel (free, gives you a real URL)

1. Push this project to a GitHub repository (create a new repo on GitHub, then in this folder run `git init`, `git add .`, `git commit -m "initial"`, and follow GitHub's instructions to push). If you're not comfortable with git, Vercel also supports dragging a folder in some flows — but GitHub is the smoothest path.
2. Go to https://vercel.com, sign up (you can use your GitHub account to sign up directly).
3. Click **Add New** → **Project**, and import the GitHub repo you just created.
4. Vercel will auto-detect it's a Vite project. Before deploying, expand **Environment Variables** and add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
5. Click **Deploy**. After ~1 minute you'll get a live URL like `trip-tracker-yourname.vercel.app`.
6. **Important**: go back to Supabase → **Authentication** → **URL Configuration**, and add your new Vercel URL to **Site URL** and **Redirect URLs** — this is required for login/signup and Google OAuth redirects to work correctly on the deployed version.

That's it — share the Vercel URL with anyone, and they can sign up and use it independently. Each user's projects are private to them and the people they invite.

---

## Project structure

```
supabase/schema.sql       — run this once in Supabase SQL editor to set up the database
src/
  lib/
    supabase.js            — Supabase client setup
    balances.js             — core balance & settlement math (pure functions, easy to test)
    activityLog.js          — helper to write audit log entries
  context/
    AuthContext.jsx         — auth state, login/signup/logout logic
  pages/
    Login.jsx, Signup.jsx   — auth screens
    Dashboard.jsx            — list of your projects, create new, join via code
    JoinProject.jsx          — landing page for invite links
    ProjectView.jsx          — the main app shell with all tabs
  components/
    ExpenseForm.jsx          — add/edit expense form (day/date logic, custom categories/modes)
    ExpenseList.jsx           — filterable list, edit/delete, CSV export
    SettlementsTab.jsx        — record payments already made
    SummaryTab.jsx             — charts and per-person breakdown
    SettleUpTab.jsx             — minimum-transaction settlement calculator
    MembersTab.jsx               — invite link/email, placeholder members
    TemplatesTab.jsx              — recurring expense templates
    ActivityTab.jsx                — audit log
    TrashTab.jsx                    — 30-day recoverable trash
    Toast.jsx                        — small notification popup
```

## Notes on email invites

The "invite by email" feature currently saves the invite to the database but does not send an actual email — that requires hooking up an email-sending service (e.g. Resend, SendGrid, or Supabase's own SMTP settings), which needs its own account and API key. The invite link/code system works fully without this. If you want real email sending added, that's a small additional integration — just ask.

## Extending this further

Ideas that fit naturally into this data model if you want to add them later:
- Multi-currency conversion (store an exchange rate per expense)
- Receipt photo upload (Supabase Storage — free tier included)
- A cross-project dashboard showing total owed/owing across all your groups
- Push/email notifications when someone adds an expense or settles up
- Mobile app wrapper (the web app already works fine on mobile browsers as-is)
