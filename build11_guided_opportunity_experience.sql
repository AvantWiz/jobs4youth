
-- Build 11: Guided Opportunity Experience State Layer
-- Purpose:
--   Add durable draft/application session storage for the new youth-facing
--   shortlist + readiness + guided application workflow.
--
-- Run AFTER:
--   1. supabase_schema.sql
--   2. supabase_policies.sql
--   3. jobs4youth_full_product_foundation.sql
--   4. build9_phase1_shared_foundation.sql (recommended)
--   5. build10_pathway_twin.sql (recommended)

create extension if not exists pgcrypto;

create table if not exists public.opportunity_application_drafts (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  current_step int not null default 1 check (current_step between 1 and 5),
  draft_status text not null default 'In Progress' check (draft_status in ('In Progress','Ready to Submit','Submitted','Archived')),
  readiness_score numeric(5,2) default 0,
  readiness_band text default 'Early Stage',
  readiness_summary jsonb default '{}'::jsonb,
  motivation_note text,
  document_state jsonb default '{}'::jsonb,
  screening_answers jsonb default '{}'::jsonb,
  draft_payload jsonb default '{}'::jsonb,
  started_at timestamptz default now(),
  updated_at timestamptz default now(),
  submitted_at timestamptz,
  unique(opportunity_id, applicant_id)
);

create table if not exists public.application_submission_payloads (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  draft_id uuid references public.opportunity_application_drafts(id) on delete set null,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  readiness_score numeric(5,2) default 0,
  readiness_band text,
  readiness_summary jsonb default '{}'::jsonb,
  motivation_note text,
  document_state jsonb default '{}'::jsonb,
  screening_answers jsonb default '{}'::jsonb,
  submitted_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_opportunity_application_drafts_applicant
  on public.opportunity_application_drafts(applicant_id, updated_at desc);
create index if not exists idx_opportunity_application_drafts_opportunity
  on public.opportunity_application_drafts(opportunity_id);
create index if not exists idx_application_submission_payloads_applicant
  on public.application_submission_payloads(applicant_id, submitted_at desc);
create index if not exists idx_application_submission_payloads_opportunity
  on public.application_submission_payloads(opportunity_id);

alter table public.opportunity_application_drafts enable row level security;
alter table public.application_submission_payloads enable row level security;

do $$ begin
  drop policy if exists "Users can manage own opportunity application drafts" on public.opportunity_application_drafts;
  drop policy if exists "Employers can view drafts for own opportunities" on public.opportunity_application_drafts;
  drop policy if exists "Users can manage own application submission payloads" on public.application_submission_payloads;
  drop policy if exists "Employers can view submission payloads for own opportunities" on public.application_submission_payloads;
exception when undefined_object then null; end $$;

create policy "Users can manage own opportunity application drafts" on public.opportunity_application_drafts
for all using (auth.uid() = applicant_id)
with check (auth.uid() = applicant_id);

create policy "Employers can view drafts for own opportunities" on public.opportunity_application_drafts
for select using (
  exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_id
      and (
        o.posted_by = auth.uid()
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      )
  )
);

create policy "Users can manage own application submission payloads" on public.application_submission_payloads
for all using (auth.uid() = applicant_id)
with check (auth.uid() = applicant_id);

create policy "Employers can view submission payloads for own opportunities" on public.application_submission_payloads
for select using (
  exists (
    select 1
    from public.opportunities o
    where o.id = opportunity_id
      and (
        o.posted_by = auth.uid()
        or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      )
  )
);

create or replace function public.touch_guided_application_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_guided_application_drafts on public.opportunity_application_drafts;
create trigger trg_touch_guided_application_drafts
before update on public.opportunity_application_drafts
for each row execute function public.touch_guided_application_updated_at();

drop trigger if exists trg_touch_application_submission_payloads on public.application_submission_payloads;
create trigger trg_touch_application_submission_payloads
before update on public.application_submission_payloads
for each row execute function public.touch_guided_application_updated_at();

comment on table public.opportunity_application_drafts is
'Guided multi-step opportunity application drafts storing step progress, readiness summary, motivation note, document checklist state and screening answers.';

comment on table public.application_submission_payloads is
'Final structured submission payload linked to each submitted opportunity application.';
