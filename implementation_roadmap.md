# Implementation Roadmap – Jobs4Youth Hub

## Current status
You already have a **browser prototype** with multi-role screens and local demo data.
The next move is not redesign — it is **productization**.

## What “real working platform” means
A real platform must have:
- real user accounts
- secure database
- role-based access
- live opportunity posting
- live applications
- verification workflow
- analytics layer
- hosting + domain
- privacy and governance controls

## Recommended stack
### Fastest path
- Frontend: keep the current HTML/JS structure for speed
- Backend: Supabase
- DB: Postgres on Supabase
- Auth: Supabase Auth
- Hosting: Vercel / Netlify

### Why this is the right step now
Because your current MVP already proves the flows. You do not need to restart in Flutter right now for the board-facing pilot. Build the web platform first, validate usage, then add mobile later.

## Build sequence
### Sprint 1 – Foundation
- Set up Supabase tables
- Add authentication
- Create profile onboarding by role
- Move demo seed data into database
- Deploy web app

### Sprint 2 – Core workflows
- Youth profile edit
- Employer opportunity posting
- Institution course posting
- Youth applications
- Employer candidate view

### Sprint 3 – Trust and admin
- Verification queue
- Approve/reject opportunity posts
- Approve employers and institutions
- Basic moderation and audit notes

### Sprint 4 – Intelligence
- Matching engine from profile skills + location + interests
- Skills demand dashboard
- Placement / application funnel metrics
- Export analytics for AGRA reporting

## Minimum production database entities
- profiles
- opportunities
- courses
- applications
- verification_queue
- later: saved_jobs, notifications, audits, match_scores

## Non-negotiables before public launch
- privacy policy
- terms of use
- platform moderation rules
- employer verification SOP
- institution verification SOP
- safeguarding and fraud reporting process

## Recommended pilot scope
To stay focused, pilot these three roles first:
1. Youth job seekers
2. Employers
3. Admin

Education institutions can be included now, but if speed matters, they can be switched on in wave two.

## Suggested success metrics for pilot
- number of verified employers onboarded
- number of opportunities posted
- number of youth profiles completed
- number of applications submitted
- number of matches above 70%
- number of placements confirmed
- top skill gaps identified

## My practical recommendation
Use the attached starter kit to move from prototype to live web MVP first.
Once you paste the Supabase anon key and deploy, we can then do the next two tasks:
1. wire authentication fully
2. connect all forms and dashboards to real tables

## Practical deployment milestone
Before public launch, finish: email auth, profile save, opportunity posting, course posting, RLS testing, and Vercel deployment connected to your Supabase project.
