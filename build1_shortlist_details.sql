-- Build 1: Save / Shortlist + detail shell foundation for Jobs4Youth
-- Run AFTER your base schema, policies, and the current step6 / step7+step8 SQL.

create table if not exists public.saved_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, opportunity_id)
);

create table if not exists public.saved_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, course_id)
);

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
  application_status text check (application_status in ('Saved','Submitted','Under Review','Shortlisted','Rejected','Accepted','Enrolled')) default 'Submitted',
  motivation_note text,
  created_at timestamptz default now(),
  unique(course_id, applicant_id)
);

alter table public.opportunities add column if not exists deadline date;
alter table public.opportunities add column if not exists compensation text;
alter table public.opportunities add column if not exists work_arrangement text;
alter table public.opportunities add column if not exists duration text;
alter table public.opportunities add column if not exists benefits text;
alter table public.opportunities add column if not exists learning_outcomes text;

alter table public.courses add column if not exists fees text;
alter table public.courses add column if not exists scholarship_info text;
alter table public.courses add column if not exists certification text;
alter table public.courses add column if not exists application_deadline date;
alter table public.courses add column if not exists audience text;
alter table public.courses add column if not exists language text;
alter table public.courses add column if not exists schedule text;
alter table public.courses add column if not exists entry_requirements text;
alter table public.courses add column if not exists modules_overview text;

create index if not exists idx_saved_opportunities_user on public.saved_opportunities(user_id);
create index if not exists idx_saved_courses_user on public.saved_courses(user_id);
create index if not exists idx_opp_questions_opportunity on public.opportunity_screening_questions(opportunity_id);
create index if not exists idx_course_questions_course on public.course_application_questions(course_id);
create index if not exists idx_course_applications_applicant on public.course_applications(applicant_id);

alter table public.saved_opportunities enable row level security;
alter table public.saved_courses enable row level security;
alter table public.opportunity_screening_questions enable row level security;
alter table public.course_application_questions enable row level security;
alter table public.course_applications enable row level security;

do $$ begin
  drop policy if exists "Users can manage own saved opportunities" on public.saved_opportunities;
  drop policy if exists "Users can manage own saved courses" on public.saved_courses;
  drop policy if exists "Users can view opportunity questions for visible opportunities" on public.opportunity_screening_questions;
  drop policy if exists "Poster or admin can manage opportunity questions" on public.opportunity_screening_questions;
  drop policy if exists "Users can view course questions for visible courses" on public.course_application_questions;
  drop policy if exists "Poster or admin can manage course questions" on public.course_application_questions;
  drop policy if exists "Users can manage own course applications" on public.course_applications;
  drop policy if exists "Institutions can view own course applications" on public.course_applications;
exception when undefined_object then null; end $$;

create policy "Users can manage own saved opportunities" on public.saved_opportunities
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage own saved courses" on public.saved_courses
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can view opportunity questions for visible opportunities" on public.opportunity_screening_questions
for select using (
  exists (
    select 1 from public.opportunities o
    where o.id = opportunity_id
      and (o.status = 'Verified' or o.posted_by = auth.uid())
  )
);

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

create policy "Users can view course questions for visible courses" on public.course_application_questions
for select using (
  exists (
    select 1 from public.courses c
    where c.id = course_id
      and (c.status = 'Verified' or c.posted_by = auth.uid())
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

create policy "Users can manage own course applications" on public.course_applications
for all using (auth.uid() = applicant_id)
with check (auth.uid() = applicant_id);

create policy "Institutions can view own course applications" on public.course_applications
for select using (
  exists (select 1 from public.courses c where c.id = course_id and c.posted_by = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
