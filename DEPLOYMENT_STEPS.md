
## Jobs4Youth – Real Functional Upgrade (Next Actions)

This package upgrades the starter kit into a more usable MVP with these working features:
- youth sign-up, sign-in, profile update and job application
- employer opportunity posting linked to Supabase
- institution course posting linked to Supabase
- employer candidate review screen
- admin verification queue review screen
- safer role behaviour (signed-in users stay in their assigned role)

### Files updated in this package
- `app.js` → form actions and live Supabase workflows added
- `supabase_policies.sql` → includes verification queue and admin update permissions

### What you must do in Supabase now
Run these in SQL Editor in this exact order:
1. `supabase_schema.sql`
2. the **new** `supabase_policies.sql`
3. `seed_data.sql`

### Important admin setup
To test admin actions, you need one user in `profiles` with role = `admin`.
You can change one existing test user manually in Supabase Table Editor:
- Table: `profiles`
- find your user row
- set `role` to `admin`
- save

### Local test checklist
1. Sign up as youth → save profile → apply to a job
2. Sign up as employer → save organization profile → post opportunity
3. Sign up as institution → save organization profile → post course
4. Sign in as admin → open verification queue → approve pending items
5. Confirm approved items become visible publicly

### Deploy
After local testing works:
1. Push files to GitHub
2. Import repo to Vercel
3. Deploy
4. Re-test live auth, posting and applications

### Recommended next wave after this
- password reset
- email verification
- employer/institution document uploads
- notification emails
- admin analytics page with real charts
- privacy policy and terms of use
