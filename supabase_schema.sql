-- Jobs4Youth Hub schema

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text check (role in ('youth','employer','institution','admin')) not null default 'youth',
  country text,
  region text,
  education text,
  skills text,
  interests text,
  availability text,
  experience_level text,
  organization_name text,
  sector text,
  verified boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  posted_by uuid references public.profiles(id) on delete set null,
  title text not null,
  organization_name text not null,
  country text not null,
  region text,
  opportunity_type text check (opportunity_type in ('Job','Internship','Apprenticeship','Training','Extension')) not null,
  required_skills text,
  education_requirement text,
  experience_requirement text,
  description text,
  status text check (status in ('Pending','Verified','Rejected','Closed')) default 'Pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  posted_by uuid references public.profiles(id) on delete set null,
  title text not null,
  provider_name text not null,
  delivery_mode text,
  duration text,
  skills_covered text,
  country text,
  region text,
  status text check (status in ('Pending','Verified','Rejected')) default 'Pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  applicant_id uuid references public.profiles(id) on delete cascade,
  application_status text check (application_status in ('Saved','Submitted','Shortlisted','Rejected','Placed')) default 'Saved',
  created_at timestamptz default now(),
  unique(opportunity_id, applicant_id)
);



create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details text,
  created_at timestamptz default now()
);

create table if not exists public.verification_queue (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  item_type text check (item_type in ('employer','institution','opportunity','course')) not null,
  item_id uuid,
  review_status text check (review_status in ('Pending','Approved','Rejected')) default 'Pending',
  reviewer_id uuid references public.profiles(id) on delete set null,
  review_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_opportunities_country on public.opportunities(country);
create index if not exists idx_opportunities_type on public.opportunities(opportunity_type);
create index if not exists idx_applications_applicant on public.applications(applicant_id);
create unique index if not exists idx_verification_profile_type_pending_org
  on public.verification_queue(profile_id, item_type)
  where item_id is null;
create unique index if not exists idx_verification_profile_type_item
  on public.verification_queue(profile_id, item_type, item_id)
  where item_id is not null;

create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id);
