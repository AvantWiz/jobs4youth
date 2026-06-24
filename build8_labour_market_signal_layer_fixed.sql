-- Build 8: Labour Market Signal Layer for Jobs4Youth (FIXED)
-- subqueries that reference an outer grouped column.
-- Run AFTER your base schema, policies, Build 6 Pathway Intelligence SQL and Build 7 Readiness Coach SQL.

create extension if not exists pgcrypto;

create table if not exists public.labour_market_signal_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  geography_level text check (geography_level in ('Global','Country','Region')) default 'Global',
  country text,
  region text,
  metric_group text not null,
  metric_name text not null,
  metric_value numeric(12,2) not null default 0,
  metric_unit text default 'count',
  entity_type text,
  signal_metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists public.employer_signal_notes (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references public.profiles(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete cascade,
  bottleneck_type text check (bottleneck_type in ('Low Applications','Skills Mismatch','Location Mismatch','Qualification Gap','Pipeline Delay','Other')) default 'Other',
  note_text text,
  severity_level text check (severity_level in ('Low','Medium','High')) default 'Medium',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_signal_snapshots_date on public.labour_market_signal_snapshots(snapshot_date);
create index if not exists idx_signal_snapshots_geo on public.labour_market_signal_snapshots(country, region);
create index if not exists idx_signal_snapshots_group on public.labour_market_signal_snapshots(metric_group, metric_name);
create index if not exists idx_employer_signal_notes_employer on public.employer_signal_notes(employer_id);
create index if not exists idx_employer_signal_notes_opportunity on public.employer_signal_notes(opportunity_id);

alter table public.labour_market_signal_snapshots enable row level security;
alter table public.employer_signal_notes enable row level security;

do $$ begin
  drop policy if exists "Admins can manage labour market signal snapshots" on public.labour_market_signal_snapshots;
  drop policy if exists "Authenticated users can view labour market signal snapshots" on public.labour_market_signal_snapshots;
  drop policy if exists "Employers can manage own employer signal notes" on public.employer_signal_notes;
  drop policy if exists "Admins can view all employer signal notes" on public.employer_signal_notes;
exception when undefined_object then null; end $$;

create policy "Authenticated users can view labour market signal snapshots" on public.labour_market_signal_snapshots
for select using (auth.uid() is not null);

create policy "Admins can manage labour market signal snapshots" on public.labour_market_signal_snapshots
for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "Employers can manage own employer signal notes" on public.employer_signal_notes
for all using (
  auth.uid() = employer_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
)
with check (
  auth.uid() = employer_id or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy "Admins can view all employer signal notes" on public.employer_signal_notes
for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- 1) Requested skills from opportunity demand
create or replace view public.v_skill_demand_signals as
select
  coalesce(o.country, 'Unspecified') as country,
  coalesce(o.region, 'Unspecified') as region,
  sc.skill_name,
  count(distinct osm.opportunity_id) as opportunities_count,
  count(osm.id) as skill_mentions,
  round(avg(coalesce(osm.importance_weight, 1.0)), 2) as avg_importance_weight
from public.opportunity_skill_map osm
join public.opportunities o on o.id = osm.opportunity_id
join public.skills_catalog sc on sc.id = osm.skill_id
where o.status = 'Verified'
group by coalesce(o.country, 'Unspecified'), coalesce(o.region, 'Unspecified'), sc.skill_name;

-- 2) Youth skill supply from normalized profile skills
create or replace view public.v_skill_supply_signals as
select
  coalesce(p.country, 'Unspecified') as country,
  coalesce(p.region, 'Unspecified') as region,
  sc.skill_name,
  count(distinct psm.profile_id) as youth_with_skill,
  count(psm.id) as skill_records
from public.profile_skill_map psm
join public.profiles p on p.id = psm.profile_id
join public.skills_catalog sc on sc.id = psm.skill_id
where p.role = 'youth'
group by coalesce(p.country, 'Unspecified'), coalesce(p.region, 'Unspecified'), sc.skill_name;

-- 3) Skills gap view: demand minus supply
create or replace view public.v_skill_gap_signals as
select
  coalesce(d.country, s.country) as country,
  coalesce(d.region, s.region) as region,
  coalesce(d.skill_name, s.skill_name) as skill_name,
  coalesce(d.opportunities_count, 0) as demand_opportunities,
  coalesce(s.youth_with_skill, 0) as youth_supply,
  greatest(coalesce(d.opportunities_count, 0) - coalesce(s.youth_with_skill, 0), 0) as gap_count,
  case
    when coalesce(d.opportunities_count, 0) = 0 then 0
    else round((greatest(coalesce(d.opportunities_count, 0) - coalesce(s.youth_with_skill, 0), 0)::numeric / d.opportunities_count) * 100, 2)
  end as gap_percent
from public.v_skill_demand_signals d
full outer join public.v_skill_supply_signals s
  on d.country = s.country and d.region = s.region and d.skill_name = s.skill_name;

-- 4) Training gap view: where courses do not adequately cover demanded skills
create or replace view public.v_training_gap_signals as
with demand as (
  select country, region, skill_name, opportunities_count
  from public.v_skill_demand_signals
), supply as (
  select
    coalesce(c.country, 'Unspecified') as country,
    coalesce(c.region, 'Unspecified') as region,
    sc.skill_name,
    count(distinct csm.course_id) as courses_covering_skill
  from public.course_skill_map csm
  join public.courses c on c.id = csm.course_id
  join public.skills_catalog sc on sc.id = csm.skill_id
  where c.status = 'Verified'
  group by coalesce(c.country, 'Unspecified'), coalesce(c.region, 'Unspecified'), sc.skill_name
)
select
  coalesce(d.country, s.country) as country,
  coalesce(d.region, s.region) as region,
  coalesce(d.skill_name, s.skill_name) as skill_name,
  coalesce(d.opportunities_count, 0) as demand_opportunities,
  coalesce(s.courses_covering_skill, 0) as verified_courses_covering_skill,
  greatest(coalesce(d.opportunities_count, 0) - coalesce(s.courses_covering_skill, 0), 0) as training_gap_count
from demand d
full outer join supply s
  on d.country = s.country and d.region = s.region and d.skill_name = s.skill_name;

-- 5) Employer bottlenecks
create or replace view public.v_employer_hiring_bottlenecks as
with opp_counts as (
  select
    o.id as opportunity_id,
    o.posted_by as employer_id,
    o.organization_name,
    coalesce(o.country, 'Unspecified') as country,
    coalesce(o.region, 'Unspecified') as region,
    o.title,
    o.opportunity_type,
    count(a.id) as applications_received,
    count(case when a.application_status in ('Shortlisted','Placed') then 1 end) as progressed_applications,
    count(case when a.application_status = 'Rejected' then 1 end) as rejected_applications,
    min(a.created_at) as first_application_at,
    max(a.created_at) as latest_application_at
  from public.opportunities o
  left join public.applications a on a.opportunity_id = o.id
  where o.status in ('Verified','Closed')
  group by o.id, o.posted_by, o.organization_name, coalesce(o.country, 'Unspecified'), coalesce(o.region, 'Unspecified'), o.title, o.opportunity_type
)
select
  opportunity_id,
  employer_id,
  organization_name,
  country,
  region,
  title,
  opportunity_type,
  applications_received,
  progressed_applications,
  rejected_applications,
  case
    when applications_received = 0 then 'Low Applications'
    when applications_received > 0 and progressed_applications = 0 then 'Skills Mismatch'
    when applications_received between 1 and 2 then 'Thin Pipeline'
    else 'Active Pipeline'
  end as bottleneck_signal,
  case
    when first_application_at is null then null
    else extract(day from coalesce(latest_application_at, now()) - first_application_at)::int
  end as pipeline_age_days
from opp_counts;

-- 6) Underserved youth segments
create or replace view public.v_underserved_youth_segments as
select
  coalesce(country, 'Unspecified') as country,
  coalesce(region, 'Unspecified') as region,
  coalesce(education, 'Unspecified') as education_level,
  coalesce(experience_level, 'Unspecified') as experience_level,
  count(*) as youth_profiles,
  count(case when nullif(trim(coalesce(skills, '')), '') is null then 1 end) as profiles_without_skills,
  count(case when nullif(trim(coalesce(interests, '')), '') is null then 1 end) as profiles_without_interests,
  count(case when nullif(trim(coalesce(career_goal, '')), '') is null then 1 end) as profiles_without_career_goal,
  round(avg(case
    when nullif(trim(coalesce(skills, '')), '') is null then 0 else 1 end +
         case when nullif(trim(coalesce(interests, '')), '') is null then 0 else 1 end +
         case when nullif(trim(coalesce(education, '')), '') is null then 0 else 1 end +
         case when nullif(trim(coalesce(country, '')), '') is null then 0 else 1 end +
         case when nullif(trim(coalesce(region, '')), '') is null then 0 else 1 end
  ) / 5.0 * 100, 2) as average_profile_strength
from public.profiles
where role = 'youth'
group by coalesce(country, 'Unspecified'), coalesce(region, 'Unspecified'), coalesce(education, 'Unspecified'), coalesce(experience_level, 'Unspecified');

-- 7) Country activity dashboard summary (FIXED)
create or replace view public.v_country_activity_signals as
with country_base as (
  select coalesce(p.country, 'Unspecified') as country,
         count(distinct case when p.role = 'youth' then p.id end) as youth_profiles,
         count(distinct case when p.role = 'employer' then p.id end) as employers,
         count(distinct case when p.role = 'institution' then p.id end) as institutions
  from public.profiles p
  group by coalesce(p.country, 'Unspecified')
),
opportunity_counts as (
  select coalesce(o.country, 'Unspecified') as country,
         count(*) as verified_opportunities
  from public.opportunities o
  where o.status = 'Verified'
  group by coalesce(o.country, 'Unspecified')
),
course_counts as (
  select coalesce(c.country, 'Unspecified') as country,
         count(*) as verified_courses
  from public.courses c
  where c.status = 'Verified'
  group by coalesce(c.country, 'Unspecified')
),
application_counts as (
  select coalesce(o.country, 'Unspecified') as country,
         count(*) as applications_total
  from public.applications a
  join public.opportunities o on o.id = a.opportunity_id
  group by coalesce(o.country, 'Unspecified')
)
select
  cb.country,
  cb.youth_profiles,
  cb.employers,
  cb.institutions,
  coalesce(oc.verified_opportunities, 0) as verified_opportunities,
  coalesce(cc.verified_courses, 0) as verified_courses,
  coalesce(ac.applications_total, 0) as applications_total
from country_base cb
left join opportunity_counts oc on oc.country = cb.country
left join course_counts cc on cc.country = cb.country
left join application_counts ac on ac.country = cb.country;
