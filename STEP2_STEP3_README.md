# Jobs4Youth Step 2 and Step 3 Frontend Upgrade

## File to deploy
Replace your existing `app.js` with the provided updated `app.js`.

## What this adds

### Step 2: Professional marketplace experience
- Replaces the confusing `Apply / Save` button with:
  - View details
  - Save
  - Start application
- Adds `My Shortlist` to the youth navigation.
- Adds saved opportunities and saved training display.
- Adds opportunity detail page before application.
- Adds save/remove logic for `saved_opportunities` and `saved_courses`.

### Step 3: Guided application flow
- Adds 6-step guided application wizard:
  1. Review opportunity
  2. Profile readiness
  3. Application package
  4. Screening questions
  5. Final review
  6. Submitted
- Uses `opportunity_application_drafts` when available.
- Writes final applications to `applications`.
- Writes structured detail to `application_submission_payloads` when available.

## Required database files before deploying
Make sure these have been run in Supabase SQL Editor:
1. `jobs4youth_full_product_foundation.sql`
2. `build11_guided_opportunity_experience.sql` OR `build12_guided_opportunity_session.sql`
3. `guided_application_constraint_fix.sql`

## Deployment steps
1. Backup your current `app.js`.
2. Replace it with the new `app.js`.
3. Commit to GitHub.
4. Let Vercel redeploy.
5. Test as a youth user:
   - open opportunities
   - click View details
   - click Save
   - open My Shortlist
   - click Start application
   - complete all wizard steps
   - submit

## If something breaks
Restore your old `app.js`, then share the browser console error.
