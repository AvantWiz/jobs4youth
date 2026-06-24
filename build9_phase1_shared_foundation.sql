-- Build 9: Phase 1 Shared Foundation for Jobs4Youth
-- Purpose:
-- Establish the shared data spine for Phase 1 features:
--   1) Pathway Twin
--   2) Curriculum Intelligence for Institutions
--   3) Outcomes Ledger
--
-- Run AFTER:
--   1. supabase_schema.sql
--   2. supabase_policies.sql
--   3. seed_data.sql
--   4. jobs4youth_full_product_foundation.sql
--   5. build8_labour_market_signal_layer_fixed.sql
--
-- This script is intentionally conservative:
-- - it adds columns only if missing
-- - it creates new shared tables and views
-- - it enables Row Level Security on new tables
-- - it avoids breaking current app behavior

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 0) Minimal profile extensions for pathway / outcomes work
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists career_goal text;
alter table public.profiles add column if not exists target_role text;
alter table public.profiles add column if not exists profile_strength_score numeric(5,2);
alter table public.profiles add column if not exists last_readiness_refresh_at timestamptz;

-- ---------------------------------------------------------------------
-- 1) Career pathway catalog
-- ---------------------------------------------------------------------
create table if not exists public.career_pathways_catalog (
  id uuid primary key default gen_random_uuid(),
  pathway_code text unique,
  pathway_name text not null,
  role_title text not null,
  sector text,
  country text,
  region text,
  description text,
  required_skills text,
  recommended_education text,
  recommended_experience text,
  growth_signal_score numeric(8,2) default 0,
  demand_signal_score numeric(8,2) default 0,
  priority_level text check (priority_level in ('Low','Medium','High','Strategic')) default 'Medium',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_career_pathways_catalog_role_title on public.career_pathways_catalog(role_title);
create index if not exists idx_career_pathways_catalog_country_region on public.career_pathways_catalog(country, region);
create index if not exists idx_career_pathways_catalog_sector on public.career_pathways_catalog(sector);

-- ---------------------------------------------------------------------
-- 2) Pathway targets picked by youth users
-- ---------------------------------------------------------------------
create table if not exists public.pathway_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pathway_id uuid references public.career_pathways_catalog(id) on delete set null,
  role_title text not null,
  status text check (status in ('Active','Paused','Completed','Archived')) default 'Active',
  target_confidence_score numeric(5,2) default 0,
  source_type text check (source_type in ('Self Selected','System Recommended','Advisor Suggested','Imported')) default 'Self Selected',
  notes text,
  selected_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, role_title, status)
);

create index if not exists idx_pathway_targets_user on public.pathway_targets(user_id);
create index if not exists idx_pathway_targets_pathway on public.pathway_targets(pathway_id);
create index if not exists idx_pathway_targets_status on public.pathway_targets(status);

-- ---------------------------------------------------------------------
-- 3) User readiness snapshots
-- ---------------------------------------------------------------------
create table if not exists public.user_readiness_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pathway_target_id uuid references public.pathway_targets(id) on delete cascade,
  role_title text not null,
  readiness_score numeric(5,2) not null default 0,
  profile_strength_score numeric(5,2) default 0,
  skills_match_score numeric(5,2) default 0,
  education_match_score numeric(5,2) default 0,
  experience_match_score numeric(5,2) default 0,
  location_match_score numeric(5,2) default 0,
  missing_skills text,
  recommended_actions text,
  recommendation_metadata jsonb default '{}'::jsonb,
  snapshot_reason text,
  created_at timestamptz default now()
);

create index if not exists idx_user_readiness_snapshots_user on public.user_readiness_snapshots(user_id);
create index if not exists idx_user_readiness_snapshots_target on public.user_readiness_snapshots(pathway_target_id);
create index if not exists idx_user_readiness_snapshots_created_at on public.user_readiness_snapshots(created_at desc);

-- ---------------------------------------------------------------------
-- 4) Transition events: atomic user journey events
-- ---------------------------------------------------------------------
create table if not exists public.transition_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  event_stage text,
  event_status text,
  related_entity_type text,
  related_entity_id uuid,
  geography_country text,
  geography_region text,
  institution_id uuid references public.profiles(id) on delete set null,
  employer_id uuid references public.profiles(id) on delete set null,
  pathway_target_id uuid references public.pathway_targets(id) on delete set null,
  event_value numeric(12,2),
  event_metadata jsonb default '{}'::jsonb,
  occurred_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_transition_events_user on public.transition_events(user_id);
create index if not exists idx_transition_events_type on public.transition_events(event_type);
create index if not exists idx_transition_events_entity on public.transition_events(related_entity_type, related_entity_id);
create index if not exists idx_transition_events_occurred_at on public.transition_events(occurred_at desc);
create index if not exists idx_transition_events_institution on public.transition_events(institution_id);
create index if not exists idx_transition_events_employer on public.transition_events(employer_id);

-- ---------------------------------------------------------------------
-- 5) Outcomes ledger: milestone-level summarized evidence
-- ---------------------------------------------------------------------
create table if not exists public.outcomes_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  pathway_target_id uuid references public.pathway_targets(id) on delete set null,
  outcome_type text not null,
  outcome_status text check (outcome_status in ('Observed','Verified','Rejected','Archived')) default 'Observed',
  milestone_name text not null,
  milestone_sequence int default 1,
  source_event_id uuid references public.transition_events(id) on delete set null,
  related_entity_type text,
  related_entity_id uuid,
  institution_id uuid references public.profiles(id) on delete set null,
  employer_id uuid references public.profiles(id) on delete set null,
  country text,
  region text,
  outcome_value numeric(12,2),
  evidence_text text,
  evidence_metadata jsonb default '{}'::jsonb,
  occurred_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_outcomes_ledger_user on public.outcomes_ledger(user_id);
create index if not exists idx_outcomes_ledger_type_status on public.outcomes_ledger(outcome_type, outcome_status);
create index if not exists idx_outcomes_ledger_institution on public.outcomes_ledger(institution_id);
create index if not exists idx_outcomes_ledger_employer on public.outcomes_ledger(employer_id);
create index if not exists idx_outcomes_ledger_occurred_at on public.outcomes_ledger(occurred_at desc);

-- ---------------------------------------------------------------------
-- 6) Institution signal snapshots for curriculum intelligence
-- ---------------------------------------------------------------------
create table if not exists public.institution_signal_snapshots (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.profiles(id) on delete cascade,
  snapshot_date date not null default current_date,
  country text,
  region text,
  metric_group text not null,
  metric_name text not null,
  metric_value numeric(12,2) not null default 0,
  metric_unit text default 'count',
  related_course_id uuid references public.courses(id) on delete set null,
  signal_metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique(institution_id, snapshot_date, metric_group, metric_name, related_course_id)
);

create index if not exists idx_institution_signal_snapshots_inst on public.institution_signal_snapshots(institution_id);
create index if not exists idx_institution_signal_snapshots_date on public.institution_signal_snapshots(snapshot_date desc);
create index if not exists idx_institution_signal_snapshots_group on public.institution_signal_snapshots(metric_group, metric_name);

-- ---------------------------------------------------------------------
-- 7) RLS enablement
-- ---------------------------------------------------------------------
alter table public.career_pathways_catalog enable row level security;
alter table public.pathway_targets enable row level security;
alter table public.user_readiness_snapshots enable row level security;
alter table public.transition_events enable row level security;
alter table public.outcomes_ledger enable row level security;
alter table public.institution_signal_snapshots enable row level security;

-- ---------------------------------------------------------------------
-- 8) Policies
-- ---------------------------------------------------------------------
do $$ begin
  drop policy if exists "Authenticated users can view active career pathways" on public.career_pathways_catalog;
  drop policy if exists "Admins can manage career pathways" on public.career_pathways_catalog;

  drop policy if exists "Users can manage own pathway targets" on public.pathway_targets;
  drop policy if exists "Admins can view all pathway targets" on public.pathway_targets;

  drop policy if exists "Users can view own readiness snapshots" on public.user_readiness_snapshots;
  drop policy if exists "Admins can view all readiness snapshots" on public.user_readiness_snapshots;
  drop policy if exists "Users can insert own readiness snapshots" on public.user_readiness_snapshots;

  drop policy if exists "Users can view own transition events" on public.transition_events;
  drop policy if exists "Actors can insert transition events" on public.transition_events;
  drop policy if exists "Admins can view all transition events" on public.transition_events;

  drop policy if exists "Users can view own outcomes ledger" on public.outcomes_ledger;
  drop policy if exists "Admins can view all outcomes ledger" on public.outcomes_ledger;
  drop policy if exists "System actors can insert outcomes ledger" on public.outcomes_ledger;

  drop policy if exists "Institutions can view own snapshots" on public.institution_signal_snapshots;
  drop policy if exists "Institutions can manage own snapshots" on public.institution_signal_snapshots;
  drop policy if exists "Admins can view all institution snapshots" on public.institution_signal_snapshots;
exception when undefined_object then null; end $$;

create policy "Authenticated users can view active career pathways" on public.career_pathways_catalog
for select using (
  auth.uid() is not null and is_active = true
);

create policy "Admins can manage career pathways" on public.career_pathways_catalog
for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "Users can manage own pathway targets" on public.pathway_targets
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Admins can view all pathway targets" on public.pathway_targets
for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "Users can view own readiness snapshots" on public.user_readiness_snapshots
for select using (auth.uid() = user_id);

create policy "Admins can view all readiness snapshots" on public.user_readiness_snapshots
for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "Users can insert own readiness snapshots" on public.user_readiness_snapshots
for insert with check (auth.uid() = user_id);

create policy "Users can view own transition events" on public.transition_events
for select using (
  auth.uid() = user_id
  or auth.uid() = actor_id
  or auth.uid() = institution_id
  or auth.uid() = employer_id
);

create policy "Actors can insert transition events" on public.transition_events
for insert with check (
  auth.uid() = actor_id
  or auth.uid() = user_id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "Admins can view all transition events" on public.transition_events
for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "Users can view own outcomes ledger" on public.outcomes_ledger
for select using (
  auth.uid() = user_id
  or auth.uid() = institution_id
  or auth.uid() = employer_id
);

create policy "Admins can view all outcomes ledger" on public.outcomes_ledger
for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "System actors can insert outcomes ledger" on public.outcomes_ledger
for insert with check (
  auth.uid() = user_id
  or auth.uid() = institution_id
  or auth.uid() = employer_id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "Institutions can view own snapshots" on public.institution_signal_snapshots
for select using (auth.uid() = institution_id);

create policy "Institutions can manage own snapshots" on public.institution_signal_snapshots
for all using (auth.uid() = institution_id)
with check (auth.uid() = institution_id);

create policy "Admins can view all institution snapshots" on public.institution_signal_snapshots
for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- ---------------------------------------------------------------------
-- 9) Helper views for Pathway Twin
-- ---------------------------------------------------------------------
create or replace view public.v_latest_active_pathway_targets as
select distinct on (pt.user_id)
  pt.id,
  pt.user_id,
  pt.pathway_id,
  pt.role_title,
  pt.status,
  pt.target_confidence_score,
  pt.source_type,
  pt.notes,
  pt.selected_at,
  pt.updated_at
from public.pathway_targets pt
where pt.status = 'Active'
order by pt.user_id, pt.updated_at desc, pt.selected_at desc;

create or replace view public.v_profile_strength_signals as
select
  p.id as user_id,
  p.full_name,
  p.email,
  p.country,
  p.region,
  p.role,
  round((
    (case when nullif(trim(coalesce(p.full_name, '')), '') is null then 0 else 1 end) +
    (case when nullif(trim(coalesce(p.country, '')), '') is null then 0 else 1 end) +
    (case when nullif(trim(coalesce(p.region, '')), '') is null then 0 else 1 end) +
    (case when nullif(trim(coalesce(p.education, '')), '') is null then 0 else 1 end) +
    (case when nullif(trim(coalesce(p.skills, '')), '') is null then 0 else 1 end) +
    (case when nullif(trim(coalesce(p.interests, '')), '') is null then 0 else 1 end) +
    (case when nullif(trim(coalesce(p.availability, '')), '') is null then 0 else 1 end) +
    (case when nullif(trim(coalesce(p.experience_level, '')), '') is null then 0 else 1 end) +
    (case when nullif(trim(coalesce(p.career_goal, '')), '') is null then 0 else 1 end)
  )::numeric / 9.0 * 100, 2) as profile_strength_score
from public.profiles p
where p.role = 'youth';

create or replace view public.v_pathway_readiness_signals as
select
  lap.user_id,
  lap.id as pathway_target_id,
  lap.role_title,
  cps.profile_strength_score,
  round(
    least(
      100,
      greatest(
        0,
        coalesce(cps.profile_strength_score, 0) * 0.45 +
        case when lower(coalesce(p.education, '')) = lower(coalesce(cpc.recommended_education, p.education, '')) then 20 else 8 end +
        case when lower(coalesce(p.experience_level, '')) = lower(coalesce(cpc.recommended_experience, p.experience_level, '')) then 15 else 6 end +
        case when lower(coalesce(p.country, '')) = lower(coalesce(cpc.country, p.country, '')) then 10 else 4 end +
        case when nullif(trim(coalesce(p.skills, '')), '') is not null and nullif(trim(coalesce(cpc.required_skills, '')), '') is not null
             then least(10, greatest(0, cardinality(regexp_split_to_array(lower(replace(p.skills, ';', ',')), '\\s*,\\s*'))))
             else 2 end
      )
    )
  , 2) as readiness_score,
  round(coalesce(cps.profile_strength_score, 0) * 0.45, 2) as readiness_from_profile,
  cpc.required_skills,
  cpc.recommended_education,
  cpc.recommended_experience,
  p.education,
  p.experience_level,
  p.skills,
  p.country,
  p.region
from public.v_latest_active_pathway_targets lap
join public.profiles p on p.id = lap.user_id
left join public.v_profile_strength_signals cps on cps.user_id = lap.user_id
left join public.career_pathways_catalog cpc
  on cpc.id = lap.pathway_id
  or lower(cpc.role_title) = lower(lap.role_title);

create or replace view public.v_pathway_missing_skills as
select
  prs.user_id,
  prs.pathway_target_id,
  prs.role_title,
  trim(skill_item) as missing_skill
from public.v_pathway_readiness_signals prs,
lateral regexp_split_to_table(coalesce(prs.required_skills, ''), '\\s*,\\s*') as skill_item
where nullif(trim(coalesce(prs.required_skills, '')), '') is not null
  and lower(trim(skill_item)) <> ''
  and position(lower(trim(skill_item)) in lower(coalesce(prs.skills, ''))) = 0;

create or replace view public.v_pathway_action_recommendations as
with latest_readiness as (
  select * from public.v_pathway_readiness_signals
),
missing_skill_rollup as (
  select
    user_id,
    pathway_target_id,
    string_agg(missing_skill, ', ' order by missing_skill) as missing_skills
  from public.v_pathway_missing_skills
  group by user_id, pathway_target_id
),
recommended_courses as (
  select
    lr.user_id,
    lr.pathway_target_id,
    string_agg(distinct c.title, ', ' order by c.title) as recommended_courses
  from latest_readiness lr
  left join public.v_pathway_missing_skills ms
    on ms.user_id = lr.user_id and ms.pathway_target_id = lr.pathway_target_id
  left join public.courses c
    on c.status = 'Verified'
   and (
      position(lower(ms.missing_skill) in lower(coalesce(c.skills_covered, ''))) > 0
      or position(lower(ms.missing_skill) in lower(coalesce(c.modules_overview, ''))) > 0
   )
  group by lr.user_id, lr.pathway_target_id
)
select
  lr.user_id,
  lr.pathway_target_id,
  lr.role_title,
  lr.readiness_score,
  coalesce(msr.missing_skills, '') as missing_skills,
  coalesce(rc.recommended_courses, '') as recommended_courses,
  case
    when lr.readiness_score >= 80 then 'Apply now to high-fit opportunities and strengthen proof of skills.'
    when lr.readiness_score >= 60 then 'Complete one targeted course and refine your profile before applying.'
    when lr.readiness_score >= 40 then 'Build missing skills, strengthen profile completeness, and shortlist priority opportunities.'
    else 'Start by strengthening profile data, setting a target role, and completing entry-level training.'
  end as next_best_action
from latest_readiness lr
left join missing_skill_rollup msr on msr.user_id = lr.user_id and msr.pathway_target_id = lr.pathway_target_id
left join recommended_courses rc on rc.user_id = lr.user_id and rc.pathway_target_id = lr.pathway_target_id;

-- ---------------------------------------------------------------------
-- 10) Helper views for Curriculum Intelligence
-- ---------------------------------------------------------------------
create or replace view public.v_institution_course_skill_coverage as
select
  c.posted_by as institution_id,
  c.id as course_id,
  c.title as course_title,
  coalesce(c.country, 'Unspecified') as country,
  coalesce(c.region, 'Unspecified') as region,
  c.status,
  c.skills_covered,
  c.modules_overview,
  c.audience,
  c.certification,
  c.schedule
from public.courses c
where c.posted_by is not null;

create or replace view public.v_institution_curriculum_demand_alignment as
select
  ic.institution_id,
  ic.course_id,
  ic.course_title,
  ic.country,
  ic.region,
  coalesce(sum(sds.opportunities_count), 0) as demand_score,
  count(distinct sds.skill_name) as demanded_skills_matched,
  coalesce(array_to_string(array_agg(distinct sds.skill_name) filter (where sds.skill_name is not null), ', '), '') as matched_skills,
  case
    when coalesce(sum(sds.opportunities_count), 0) >= 15 then 'High'
    when coalesce(sum(sds.opportunities_count), 0) >= 5 then 'Medium'
    else 'Low'
  end as alignment_band
from public.v_institution_course_skill_coverage ic
left join public.v_skill_demand_signals sds
  on lower(coalesce(sds.country, '')) = lower(coalesce(ic.country, ''))
 and (
      position(lower(coalesce(sds.skill_name, '')) in lower(coalesce(ic.skills_covered, ''))) > 0
      or position(lower(coalesce(sds.skill_name, '')) in lower(coalesce(ic.modules_overview, ''))) > 0
 )
group by ic.institution_id, ic.course_id, ic.course_title, ic.country, ic.region;

create or replace view public.v_institution_curriculum_gap_priorities as
select
  c.posted_by as institution_id,
  tgs.country,
  tgs.region,
  tgs.skill_name,
  tgs.demand_opportunities,
  tgs.verified_courses_covering_skill,
  tgs.training_gap_count,
  case
    when tgs.training_gap_count >= 10 then 'Strategic'
    when tgs.training_gap_count >= 5 then 'High'
    when tgs.training_gap_count >= 2 then 'Medium'
    else 'Low'
  end as priority_band
from public.v_training_gap_signals tgs
join public.courses c
  on lower(coalesce(c.country, 'Unspecified')) = lower(coalesce(tgs.country, 'Unspecified'))
where c.posted_by is not null
group by c.posted_by, tgs.country, tgs.region, tgs.skill_name, tgs.demand_opportunities, tgs.verified_courses_covering_skill, tgs.training_gap_count;

-- ---------------------------------------------------------------------
-- 11) Helper views for Outcomes Ledger / donor evidence
-- ---------------------------------------------------------------------
create or replace view public.v_outcomes_funnel_metrics as
select
  coalesce(country, 'Unspecified') as country,
  coalesce(region, 'Unspecified') as region,
  outcome_type,
  milestone_name,
  count(*) as milestone_count,
  count(distinct user_id) as unique_users,
  count(distinct institution_id) as institutions_involved,
  count(distinct employer_id) as employers_involved
from public.outcomes_ledger
where outcome_status in ('Observed','Verified')
group by coalesce(country, 'Unspecified'), coalesce(region, 'Unspecified'), outcome_type, milestone_name;

create or replace view public.v_youth_transition_timeline as
select
  te.user_id,
  p.full_name,
  te.event_type,
  te.event_stage,
  te.event_status,
  te.related_entity_type,
  te.related_entity_id,
  te.institution_id,
  te.employer_id,
  te.pathway_target_id,
  te.occurred_at,
  te.event_metadata
from public.transition_events te
left join public.profiles p on p.id = te.user_id;

create or replace view public.v_institution_outcomes_summary as
select
  coalesce(ol.institution_id, te.institution_id) as institution_id,
  coalesce(p.organization_name, p.full_name, 'Institution') as institution_name,
  coalesce(ol.country, te.geography_country, 'Unspecified') as country,
  coalesce(ol.region, te.geography_region, 'Unspecified') as region,
  count(distinct ol.user_id) as youth_with_recorded_outcomes,
  count(*) filter (where ol.milestone_name = 'training_accepted') as training_acceptances,
  count(*) filter (where ol.milestone_name = 'application_submitted') as job_applications_submitted,
  count(*) filter (where ol.milestone_name = 'placed') as placements,
  count(*) filter (where ol.milestone_name = 'retained_30_days') as retained_30_days
from public.outcomes_ledger ol
full outer join public.transition_events te
  on te.id = ol.source_event_id
left join public.profiles p on p.id = coalesce(ol.institution_id, te.institution_id)
where coalesce(ol.institution_id, te.institution_id) is not null
group by coalesce(ol.institution_id, te.institution_id), coalesce(p.organization_name, p.full_name, 'Institution'), coalesce(ol.country, te.geography_country, 'Unspecified'), coalesce(ol.region, te.geography_region, 'Unspecified');

-- ---------------------------------------------------------------------
-- 12) Seed starter pathway catalog (conservative)
-- ---------------------------------------------------------------------
insert into public.career_pathways_catalog (
  pathway_code,
  pathway_name,
  role_title,
  sector,
  country,
  region,
  description,
  required_skills,
  recommended_education,
  recommended_experience,
  growth_signal_score,
  demand_signal_score,
  priority_level
)
values
  ('AGRIPROC_QC_ENTRY', 'Agri-processing Quality Pathway', 'Quality Control Assistant', 'Agri-processing', 'Kenya', 'Nakuru', 'Entry pathway into food quality systems and production compliance.', 'food safety, quality control, packaging, record keeping', 'Diploma', 'Entry Level', 80, 82, 'High'),
  ('DAIRY_EXTENSION_ENTRY', 'Dairy Extension Pathway', 'Dairy Extension Intern', 'Livestock', 'Kenya', 'Eldoret', 'Entry pathway into dairy advisory, quality checks and farmer support.', 'dairy, farmer training, record keeping, milk quality', 'Diploma', 'Entry Level', 74, 76, 'High'),
  ('DIGITAL_RECORDS_ENTRY', 'Digital Farm Data Pathway', 'Records and Data Assistant', 'Agriculture', 'Kenya', 'Remote', 'Pathway into digital records, farmer data systems and field informatics.', 'record keeping, digital literacy, spreadsheets, mobile tools', 'Certificate', 'Entry Level', 78, 72, 'Medium')
on conflict (pathway_code) do nothing;

-- ---------------------------------------------------------------------
-- 13) Convenience function to capture transition events
-- ---------------------------------------------------------------------
create or replace function public.log_transition_event(
  p_user_id uuid,
  p_actor_id uuid,
  p_event_type text,
  p_event_stage text default null,
  p_event_status text default null,
  p_related_entity_type text default null,
  p_related_entity_id uuid default null,
  p_country text default null,
  p_region text default null,
  p_institution_id uuid default null,
  p_employer_id uuid default null,
  p_pathway_target_id uuid default null,
  p_event_value numeric default null,
  p_event_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_event_id uuid;
begin
  insert into public.transition_events (
    user_id,
    actor_id,
    event_type,
    event_stage,
    event_status,
    related_entity_type,
    related_entity_id,
    geography_country,
    geography_region,
    institution_id,
    employer_id,
    pathway_target_id,
    event_value,
    event_metadata
  )
  values (
    p_user_id,
    p_actor_id,
    p_event_type,
    p_event_stage,
    p_event_status,
    p_related_entity_type,
    p_related_entity_id,
    p_country,
    p_region,
    p_institution_id,
    p_employer_id,
    p_pathway_target_id,
    p_event_value,
    coalesce(p_event_metadata, '{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

comment on table public.career_pathways_catalog is 'Shared catalog of strategic roles/pathways used by Pathway Twin and institutional planning.';
comment on table public.pathway_targets is 'Target roles selected or recommended for youth users.';
comment on table public.user_readiness_snapshots is 'Time-series readiness snapshots supporting the Pathway Twin experience.';
comment on table public.transition_events is 'Atomic transition events captured across learning-to-earning workflows.';
comment on table public.outcomes_ledger is 'Milestone-oriented ledger for donor-grade outcomes and transition evidence.';
comment on table public.institution_signal_snapshots is 'Institution-level curriculum and demand snapshots for course planning.';
