-- Build 4: Employer / institution management upgrade foundation
-- Run AFTER your base schema, policies, and current platform SQL files.

create table if not exists public.opportunity_screening_questions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  question_text text not null,
  question_type text check (question_type in ('Short Text','Long Text','Yes/No','Single Select')) default 'Short Text',
  options_text text,
  is_required boolean default true,
  sort_order int default 1,
  created_at timestamptz default now()
);

create table if not exists public.course_application_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  question_text text not null,
  question_type text check (question_type in ('Short Text','Long Text','Yes/No','Single Select')) default 'Short Text',
  options_text text,
  is_required boolean default true,
  sort_order int default 1,
  created_at timestamptz default now()
);

create table if not exists public.course_applications (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  application_status text check (application_status in ('Submitted','Under Review','Shortlisted','Accepted','Enrolled','Rejected')) default 'Submitted',
  motivation_note text,
  screening_answers text,
  created_at timestamptz default now(),
  unique(course_id, applicant_id)
);

alter table public.applications add column if not exists motivation_note text;
alter table public.applications add column if not exists screening_answers text;
alter table public.opportunities add column if not exists deadline date;
alter table public.opportunities add column if not exists compensation text;
alter table public.opportunities add column if not exists work_arrangement text;
alter table public.opportunities add column if not exists duration text;
alter table public.opportunities add column if not exists benefits text;
alter table public.opportunities add column if not exists learning_outcomes text;
alter table public.courses add column if not exists certification text;
alter table public.courses add column if not exists fees text;
alter table public.courses add column if not exists scholarship_info text;
alter table public.courses add column if not exists application_deadline date;
alter table public.courses add column if not exists audience text;
alter table public.courses add column if not exists language text;
alter table public.courses add column if not exists schedule text;
alter table public.courses add column if not exists entry_requirements text;
alter table public.courses add column if not exists modules_overview text;

alter table public.opportunity_screening_questions enable row level security;
alter table public.course_application_questions enable row level security;
alter table public.course_applications enable row level security;

do $$ begin
  drop policy if exists "Poster or admin can manage opportunity questions" on public.opportunity_screening_questions;
  drop policy if exists "Users can view opportunity questions for visible opportunities" on public.opportunity_screening_questions;
  drop policy if exists "Poster or admin can manage course questions" on public.course_application_questions;
  drop policy if exists "Users can view course questions for visible courses" on public.course_application_questions;
  drop policy if exists "Users can manage own course applications" on public.course_applications;
  drop policy if exists "Institutions can view own course applications" on public.course_applications;
exception when undefined_object then null; end $$;

create policy "Poster or admin can manage opportunity questions" on public.opportunity_screening_questions
for all using (
  exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id and (
      o.posted_by = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  )
)
with check (
  exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id and (
      o.posted_by = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  )
);

create policy "Users can view opportunity questions for visible opportunities" on public.opportunity_screening_questions
for select using (
  exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id
      and (o.status = 'Verified' or o.posted_by = auth.uid())
  )
);

create policy "Poster or admin can manage course questions" on public.course_application_questions
for all using (
  exists (
    select 1 from public.courses c
    where c.id = course_id and (
      c.posted_by = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  )
)
with check (
  exists (
    select 1 from public.courses c
    where c.id = course_id and (
      c.posted_by = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
    )
  )
);

create policy "Users can view course questions for visible courses" on public.course_application_questions
for select using (
  exists (
    select 1 from public.courses c
    where c.id = course_id and (c.status = 'Verified' or c.posted_by = auth.uid())
  )
);

create policy "Users can manage own course applications" on public.course_applications
for all using (auth.uid() = applicant_id)
with check (auth.uid() = applicant_id);

create policy "Institutions can view own course applications" on public.course_applications
for select using (
  exists (select 1 from public.courses c where c.id = course_id and c.posted_by = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
