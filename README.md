# Jobs4Youth Hub – Deployable Web Platform

Jobs4Youth Hub is a deployable web platform for youth opportunities, training, applications, employer workflows and admin verification.

- **Frontend:** HTML/CSS/JavaScript (easy next step from your current MVP)
- **Backend/Data/Auth:** **Supabase** (Auth + Postgres + Row Level Security + Storage)
- **Hosting:** Vercel / Netlify / Supabase static hosting

## What is included

1. `index.html` – production-ready frontend shell
2. `app.js` – live Supabase app logic
3. `styles.css` – extracted and cleaned styling
4. `supabase_schema.sql` – database schema for users, profiles, opportunities, courses, applications
5. `supabase_policies.sql` – Row Level Security policies
6. `seed_data.sql` – initial verified seed data
7. `config.js` – Supabase URL and anon public key
8. `implementation_roadmap.md` – practical phased roadmap from MVP to production

## Immediate setup steps

### 1) Create a Supabase project
You already have a Supabase project URL in your files.

### 2) Get your credentials
From Supabase project settings, copy:
- Project URL
- anon public key

Paste them into `config.template.js` and save as `config.js`.

### 3) Create database objects
In Supabase SQL editor, run in this order:
1. `supabase_schema.sql`
2. `supabase_policies.sql`
3. `seed_data.sql`

### 4) Serve the app locally
Because browsers restrict direct module loading from `file:///`, run a local server.
You can use one of these:

- VS Code Live Server extension
- Python simple server:
  ```bash
  python -m http.server 8000
  ```

Then open:
- `http://localhost:8000/jobs4youth_platform/`

### 5) Deploy
Upload the folder to:
- Vercel
- Netlify
- GitHub Pages (if you later remove auth secrets from frontend and use environment strategy)

## Recommended production path

### Phase 1 – Real MVP (2–4 weeks)
- Email/password authentication
- Youth / employer / institution / admin roles
- Opportunity posting
- Course posting
- Applications
- Basic matching and dashboards

### Phase 2 – Trust and verification
- Employer verification workflow
- Institution verification workflow
- Moderation queue
- Audit trail

### Phase 3 – Analytics and AI
- Skills demand dashboard
- Match explainability
- Training gap insights
- Career pathways

## Important note
This frontend uses the Supabase anon public key, which is safe for browser use when Row Level Security policies are enabled. Never place the Supabase service role key in frontend code.

## Jobs4Youth immediate next goal
Deploy the first live version with self-service sign-up, profile onboarding, opportunity posting, applications, verification and employer candidate management.
