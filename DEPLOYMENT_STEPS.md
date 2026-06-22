# Jobs4Youth Hub – Deployment Steps

## 1. Supabase database setup

Open Supabase SQL Editor and run these files in order:

1. `supabase_schema.sql`
2. `supabase_policies.sql`
3. `seed_data.sql`

## 2. Supabase Authentication setup

In Supabase Authentication settings:

1. Enable email/password authentication
2. Set the Site URL to the deployed platform URL
3. Add local and production URLs to Redirect URLs
4. Decide whether email confirmation is required before sign-in

Recommended redirect URLs:

- `http://localhost:3000`
- your Vercel or Netlify deployment URL
- your custom domain once connected

## 3. Admin setup

Create one account through the platform, then in Supabase Table Editor:

1. Open `profiles`
2. Find your user row
3. Set `role` to `admin`
4. Save

## 4. Email and domain setup

Activate the selected domain and create or route these addresses:

- `info@jobs4youth.org`
- `support@jobs4youth.org`
- `partnerships@jobs4youth.org`

Cloudflare Email Routing is enough for low-cost forwarding. Zoho Mail is a low-cost full mailbox option if you need to send directly from the domain.

## 5. Deploy frontend

Deploy these files to Vercel, Netlify or another static web host:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`

## 6. Live test checklist

Test these workflows on the deployed URL:

1. Youth sign-up and sign-in
2. Youth profile save
3. Youth application submission
4. Employer sign-up and organisation profile save
5. Employer opportunity posting
6. Institution sign-up and course posting
7. Admin verification approval/rejection
8. Employer candidate status updates
9. Audit log visibility for admin
10. Skills demand, training gaps and career pathways
11. Password reset email

## 7. Security checklist

Confirm Row Level Security is enabled on all public tables. Confirm the service role key is not in any frontend file. Confirm the Supabase redirect URLs match the real domains users will access.
