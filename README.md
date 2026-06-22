# Jobs4Youth Hub – Deployable Web Platform

Jobs4Youth Hub is a deployable web platform for youth opportunities, training, applications, employer workflows, institution workflows, admin verification and labour market insights.

## Stack

- Frontend: HTML, CSS and JavaScript
- Backend, database and authentication: Supabase Auth, Postgres and Row Level Security
- Hosting: Vercel, Netlify or another static web host

## Included files

1. `index.html` – application shell
2. `app.js` – live Supabase application logic
3. `styles.css` – platform styling
4. `config.js` – Supabase URL and anon public key
5. `supabase_schema.sql` – database schema
6. `supabase_policies.sql` – Row Level Security policies
7. `seed_data.sql` – initial verified opportunities and training data
8. `DEPLOYMENT_STEPS.md` – deployment and go-live checklist

## Core capabilities

The platform supports email/password authentication, role-based dashboards, youth profiles, employer opportunity posting, institution course posting, youth applications, employer candidate management, admin verification, audit logs, skills demand insights, match explanations, training gap insights and career pathway recommendations.

## Supabase setup

In Supabase SQL Editor, run these in order:

1. `supabase_schema.sql`
2. `supabase_policies.sql`
3. `seed_data.sql`

Then configure Authentication URL settings with the deployed site URL and allowed redirect URLs.

## Security note

This frontend uses the Supabase anon public key, which is safe for browser use when Row Level Security policies are enabled. Never place the Supabase service role key in frontend code.
