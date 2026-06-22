
-- Enable RLS
alter table public.profiles enable row level security;
alter table public.opportunities enable row level security;
alter table public.courses enable row level security;
alter table public.applications enable row level security;
alter table public.verification_queue enable row level security;
alter table public.audit_logs enable row level security;

-- Clean old policies if rerunning

do $$ begin
  drop policy if exists "Users can view profiles" on public.profiles;
  drop policy if exists "Users can insert own profile" on public.profiles;
  drop policy if exists "Users can update own profile" on public.profiles;
  drop policy if exists "Admins can update all profiles" on public.profiles;

  drop policy if exists "Anyone can view verified opportunities" on public.opportunities;
  drop policy if exists "Admins can view all opportunities" on public.opportunities;
  drop policy if exists "Employers can insert opportunities" on public.opportunities;
  drop policy if exists "Poster or admin can update opportunities" on public.opportunities;

  drop policy if exists "Anyone can view verified courses" on public.courses;
  drop policy if exists "Admins can view all courses" on public.courses;
  drop policy if exists "Institutions can insert courses" on public.courses;
  drop policy if exists "Poster or admin can update courses" on public.courses;

  drop policy if exists "Users can view own applications" on public.applications;
  drop policy if exists "Youth can insert own applications" on public.applications;
  drop policy if exists "Applicant can update own applications" on public.applications;
  drop policy if exists "Employers can update applications to own opportunities" on public.applications;

  drop policy if exists "Users can insert own verification items" on public.verification_queue;
  drop policy if exists "Users can view own verification items" on public.verification_queue;
  drop policy if exists "Admins can view verification queue" on public.verification_queue;
  drop policy if exists "Admins can update verification queue" on public.verification_queue;

  drop policy if exists "Users can insert audit logs" on public.audit_logs;
  drop policy if exists "Admins can view audit logs" on public.audit_logs;
exception when undefined_object then null; end $$;

-- Profiles
create policy "Users can view profiles" on public.profiles
for select using (true);

create policy "Users can insert own profile" on public.profiles
for insert with check (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
for update using (auth.uid() = id);

create policy "Admins can update all profiles" on public.profiles
for update using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Opportunities
create policy "Anyone can view verified opportunities" on public.opportunities
for select using (status = 'Verified' or auth.uid() = posted_by);

create policy "Admins can view all opportunities" on public.opportunities
for select using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Employers can insert opportunities" on public.opportunities
for insert with check (
  auth.uid() = posted_by and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('employer','admin')
  )
);

create policy "Poster or admin can update opportunities" on public.opportunities
for update using (
  auth.uid() = posted_by or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Courses
create policy "Anyone can view verified courses" on public.courses
for select using (status = 'Verified' or auth.uid() = posted_by);

create policy "Admins can view all courses" on public.courses
for select using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Institutions can insert courses" on public.courses
for insert with check (
  auth.uid() = posted_by and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('institution','admin')
  )
);

create policy "Poster or admin can update courses" on public.courses
for update using (
  auth.uid() = posted_by or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

-- Applications
create policy "Users can view own applications" on public.applications
for select using (
  auth.uid() = applicant_id or exists (
    select 1 from public.opportunities o where o.id = opportunity_id and o.posted_by = auth.uid()
  )
);

create policy "Youth can insert own applications" on public.applications
for insert with check (
  auth.uid() = applicant_id and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'youth'
  )
);

create policy "Applicant can update own applications" on public.applications
for update using (auth.uid() = applicant_id);

create policy "Employers can update applications to own opportunities" on public.applications
for update using (
  exists (
    select 1 from public.opportunities o where o.id = opportunity_id and o.posted_by = auth.uid()
  )
);

-- Verification queue
create policy "Users can insert own verification items" on public.verification_queue
for insert with check (
  auth.uid() = profile_id and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('employer','institution','admin')
  )
);

create policy "Users can view own verification items" on public.verification_queue
for select using (auth.uid() = profile_id);

create policy "Admins can view verification queue" on public.verification_queue
for select using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Admins can update verification queue" on public.verification_queue
for update using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);


-- Audit logs
create policy "Users can insert audit logs" on public.audit_logs
for insert with check (auth.uid() = actor_id);

create policy "Admins can view audit logs" on public.audit_logs
for select using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);
