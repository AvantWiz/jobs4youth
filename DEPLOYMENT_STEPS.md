
## Jobs4Youth – Production Launch Steps

This package upgrades the starter kit into a usable live MVP with these working features:
- youth sign-up, sign-in, profile update and job application
- employer opportunity posting linked to Supabase
- institution course posting linked to Supabase
- employer candidate review screen
- admin verification queue review screen
- safer role behaviour (signed-in users stay in their assigned role)
- password reset request from the sign-in modal
- employer application actions: shortlist, reject and mark placed
- verified organisation count in live metrics

### Files updated in this package
- `app.js` → form actions and live Supabase workflows added
- `index.html` → password reset action added
- `styles.css` → disabled button styling added
- `supabase_schema.sql` → production statuses aligned
- `supabase_policies.sql` → includes verification queue and admin update permissions

### What you must do in Supabase now
Run these in SQL Editor in this exact order:
1. `supabase_schema.sql`
2. the **new** `supabase_policies.sql`
3. `seed_data.sql`

### Supabase Auth settings
In Supabase Auth settings:
1. Enable email/password authentication
2. Add your production domain to allowed redirect URLs
3. Set the site URL to your production domain
4. Decide whether email confirmation is required before login

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
6. Sign in as employer → open candidates → shortlist/reject/mark placed
7. Test password reset using the sign-in modal

### Deploy
After local testing works:
1. Push files to GitHub
2. Import repo to Vercel
3. Deploy
4. Re-test live auth, posting and applications

### Production cutover checklist
Before public announcement:
1. Activate the jobs4youth.org domain and email mailboxes
2. Connect a real domain
3. Confirm privacy and terms pages with your legal/privacy lead
4. Create at least one admin account
5. Approve the first seed/pilot opportunities
6. Run the checklist above on the live domain
7. Keep Supabase service role keys private and never place them in frontend files

### Recommended next wave after this
- email verification
- employer/institution document uploads
- notification emails
- admin analytics page with real charts
- privacy policy and terms of use
