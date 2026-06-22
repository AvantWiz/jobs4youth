-- Step 6: Support / contact workflow additions for Jobs4Youth
-- Run this AFTER your existing supabase_schema.sql and supabase_policies.sql

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid references public.profiles(id) on delete set null,
  full_name text not null,
  email text not null,
  category text check (category in ('Technical Support','Employer Support','Institution Support','Partnerships','General Feedback','Safeguarding Concern')) not null,
  subject text not null,
  message text not null,
  status text check (status in ('Open','In Progress','Resolved','Closed')) not null default 'Open',
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_support_tickets_status on public.support_tickets(status);
create index if not exists idx_support_tickets_created_at on public.support_tickets(created_at);
create index if not exists idx_support_tickets_submitted_by on public.support_tickets(submitted_by);

alter table public.support_tickets enable row level security;

do $$ begin
  drop policy if exists "Anyone can submit support tickets" on public.support_tickets;
  drop policy if exists "Users can view own support tickets" on public.support_tickets;
  drop policy if exists "Admins can view all support tickets" on public.support_tickets;
  drop policy if exists "Admins can update support tickets" on public.support_tickets;
exception when undefined_object then null; end $$;

create policy "Anyone can submit support tickets" on public.support_tickets
for insert with check (
  submitted_by is null or submitted_by = auth.uid()
);

create policy "Users can view own support tickets" on public.support_tickets
for select using (
  submitted_by = auth.uid()
);

create policy "Admins can view all support tickets" on public.support_tickets
for select using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);

create policy "Admins can update support tickets" on public.support_tickets
for update using (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )
);
