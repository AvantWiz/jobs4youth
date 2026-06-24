-- Build 10: Pathway Twin MVP for Jobs4Youth
-- Purpose:
--   Add the first visible Phase 1 feature on top of Build 9 shared foundation.
--   This file introduces a production-safe Pathway Twin layer with:
--     1) target-role selection helpers
--     2) latest Pathway Twin dashboard view
--     3) progress-trend view
--     4) convenience functions to set a target and refresh a readiness snapshot
--
-- Run AFTER:
--   1. supabase_schema.sql
--   2. supabase_policies.sql
--   3. seed_data.sql
--   4. jobs4youth_full_product_foundation.sql
--   5. build8_labour_market_signal_layer_fixed.sql
--   6. build9_phase1_shared_foundation.sql
--
-- Design notes:
-- - conservative / additive only
-- - does not require normalized skills tables beyond what Build 9 already uses
-- - reuses Build 9 views: v_pathway_readiness_signals, v_pathway_missing_skills, v_pathway_action_recommendations
-- - avoids breaking current application flows

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1) Latest readiness snapshot helper
-- ---------------------------------------------------------------------
create or replace view public.v_user_latest_readiness_snapshot as
select distinct on (urs.user_id)
  urs.id,
  urs.user_id,
  urs.pathway_target_id,
  urs.role_title,
  urs.readiness_score,
  urs.profile_strength_score,
  urs.skills_match_score,
  urs.education_match_score,
  urs.experience_match_score,
  urs.location_match_score,
  urs.missing_skills,
  urs.recommended_actions,
  urs.recommendation_metadata,
  urs.snapshot_reason,
  urs.created_at
from public.user_readiness_snapshots urs
order by urs.user_id, urs.created_at desc;

comment on view public.v_user_latest_readiness_snapshot is
'Latest saved readiness snapshot per youth user.';

-- ---------------------------------------------------------------------
-- 2) Pathway Twin dashboard view
-- ---------------------------------------------------------------------
create or replace view public.v_user_pathway_twin as
with active_target as (
  select *
  from public.v_latest_active_pathway_targets
),
current_signals as (
  select *
  from public.v_pathway_readiness_signals
),
actions as (
  select *
  from public.v_pathway_action_recommendations
),
latest_snapshot as (
  select *
  from public.v_user_latest_readiness_snapshot
)
select
  p.id as user_id,
  p.full_name,
  p.email,
  p.country,
  p.region,
  p.education,
  p.experience_level,
  p.skills,
  p.interests,
  p.career_goal,
  at.id as pathway_target_id,
  at.role_title as target_role_title,
  at.status as target_status,
  at.source_type as target_source_type,
  at.target_confidence_score,
  at.selected_at as target_selected_at,
  cpc.pathway_name,
  cpc.sector as pathway_sector,
  cpc.description as pathway_description,
  cpc.required_skills as pathway_required_skills,
  cpc.recommended_education,
  cpc.recommended_experience,
  cpc.growth_signal_score,
  cpc.demand_signal_score,
  cpc.priority_level,
  coalesce(ls.readiness_score, cs.readiness_score, 0) as readiness_score,
  coalesce(ls.profile_strength_score, cs.profile_strength_score, 0) as profile_strength_score,
  coalesce(ls.missing_skills, ar.missing_skills, '') as missing_skills,
  coalesce(ar.recommended_courses, '') as recommended_courses,
  coalesce(ls.recommended_actions, ar.next_best_action, 'Set a clear target role and refresh your readiness.') as next_best_action,
  case
    when coalesce(ls.readiness_score, cs.readiness_score, 0) >= 80 then 'Strong'
    when coalesce(ls.readiness_score, cs.readiness_score, 0) >= 60 then 'Progressing'
    when coalesce(ls.readiness_score, cs.readiness_score, 0) >= 40 then 'Emerging'
    else 'Early Stage'
  end as readiness_band,
  ls.created_at as latest_snapshot_at
from public.profiles p
left join active_target at
  on at.user_id = p.id
left join public.career_pathways_catalog cpc
  on cpc.id = at.pathway_id
  or lower(coalesce(cpc.role_title, '')) = lower(coalesce(at.role_title, ''))
left join current_signals cs
  on cs.user_id = p.id
 and cs.pathway_target_id = at.id
left join actions ar
  on ar.user_id = p.id
 and ar.pathway_target_id = at.id
left join latest_snapshot ls
  on ls.user_id = p.id
where p.role = 'youth';

comment on view public.v_user_pathway_twin is
'Primary dashboard view for the Pathway Twin youth experience.';

-- ---------------------------------------------------------------------
-- 3) Progress trend view
-- ---------------------------------------------------------------------
create or replace view public.v_user_pathway_twin_progress as
select
  urs.user_id,
  urs.pathway_target_id,
  urs.role_title,
  urs.readiness_score,
  urs.profile_strength_score,
  urs.skills_match_score,
  urs.education_match_score,
  urs.experience_match_score,
  urs.location_match_score,
  urs.snapshot_reason,
  urs.created_at,
  lag(urs.readiness_score) over (
    partition by urs.user_id, urs.pathway_target_id
    order by urs.created_at
  ) as previous_readiness_score,
  round(
    urs.readiness_score
    - coalesce(
        lag(urs.readiness_score) over (
          partition by urs.user_id, urs.pathway_target_id
          order by urs.created_at
        ),
        urs.readiness_score
      )
  , 2) as readiness_delta
from public.user_readiness_snapshots urs;

comment on view public.v_user_pathway_twin_progress is
'Time-series progress trend for each users selected pathway target.';

-- ---------------------------------------------------------------------
-- 4) Recommended opportunities aligned to target role
-- ---------------------------------------------------------------------
create or replace view public.v_user_pathway_target_opportunities as
with twin as (
  select * from public.v_user_pathway_twin
)
select
  t.user_id,
  t.pathway_target_id,
  o.id as opportunity_id,
  o.title,
  o.organization_name,
  o.country,
  o.region,
  o.opportunity_type,
  o.education_requirement,
  o.experience_requirement,
  o.required_skills,
  o.status,
  round(
    least(
      100,
      greatest(
        0,
        coalesce(t.readiness_score, 0) * 0.55
        + case when lower(coalesce(o.title, '')) = lower(coalesce(t.target_role_title, '')) then 20 else 8 end
        + case when position(lower(coalesce(t.target_role_title, '')) in lower(coalesce(o.description, ''))) > 0 then 10 else 0 end
        + case when lower(coalesce(o.country, '')) = lower(coalesce(t.country, '')) then 10 else 4 end
        + case when nullif(trim(coalesce(t.missing_skills, '')), '') is null then 5 else 0 end
      )
    )
  , 2) as target_fit_score
from twin t
join public.opportunities o
  on o.status = 'Verified'
 and (
      lower(coalesce(o.title, '')) = lower(coalesce(t.target_role_title, ''))
      or position(lower(coalesce(t.target_role_title, '')) in lower(coalesce(o.description, ''))) > 0
      or exists (
        select 1
        from regexp_split_to_table(coalesce(t.pathway_required_skills, ''), '\s*,\s*') req_skill
        where lower(trim(req_skill)) <> ''
          and position(lower(trim(req_skill)) in lower(coalesce(o.required_skills, ''))) > 0
      )
 )
where t.pathway_target_id is not null;

comment on view public.v_user_pathway_target_opportunities is
'Verified opportunities most aligned to a users currently selected pathway target.';

-- ---------------------------------------------------------------------
-- 5) Function: set / update pathway target
-- ---------------------------------------------------------------------
create or replace function public.set_user_pathway_target(
  p_user_id uuid,
  p_role_title text,
  p_source_type text default 'Self Selected',
  p_notes text default null,
  p_target_confidence_score numeric default 70
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_target_id uuid;
  v_pathway_id uuid;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if nullif(trim(coalesce(p_role_title, '')), '') is null then
    raise exception 'p_role_title is required';
  end if;

  select cpc.id
  into v_pathway_id
  from public.career_pathways_catalog cpc
  where cpc.is_active = true
    and lower(cpc.role_title) = lower(trim(p_role_title))
  order by cpc.priority_level desc, cpc.demand_signal_score desc nulls last
  limit 1;

  select pt.id
  into v_target_id
  from public.pathway_targets pt
  where pt.user_id = p_user_id
    and lower(pt.role_title) = lower(trim(p_role_title))
    and pt.status = 'Active'
  order by pt.updated_at desc
  limit 1;

  if v_target_id is null then
    insert into public.pathway_targets (
      user_id,
      pathway_id,
      role_title,
      status,
      target_confidence_score,
      source_type,
      notes,
      selected_at,
      updated_at
    )
    values (
      p_user_id,
      v_pathway_id,
      trim(p_role_title),
      'Active',
      coalesce(p_target_confidence_score, 70),
      case
        when p_source_type in ('Self Selected','System Recommended','Advisor Suggested','Imported')
        then p_source_type
        else 'Self Selected'
      end,
      p_notes,
      now(),
      now()
    )
    returning id into v_target_id;
  else
    update public.pathway_targets
    set
      pathway_id = coalesce(v_pathway_id, pathway_id),
      target_confidence_score = coalesce(p_target_confidence_score, target_confidence_score),
      source_type = case
        when p_source_type in ('Self Selected','System Recommended','Advisor Suggested','Imported')
        then p_source_type
        else source_type
      end,
      notes = coalesce(p_notes, notes),
      updated_at = now()
    where id = v_target_id;
  end if;

  update public.profiles
  set
    target_role = trim(p_role_title),
    updated_at = now()
  where id = p_user_id;

  perform public.log_transition_event(
    p_user_id,
    p_user_id,
    'pathway_target_selected',
    'pathway_twin',
    'Active',
    'pathway_target',
    v_target_id,
    (select country from public.profiles where id = p_user_id),
    (select region from public.profiles where id = p_user_id),
    null,
    null,
    v_target_id,
    coalesce(p_target_confidence_score, 70),
    jsonb_build_object(
      'role_title', trim(p_role_title),
      'source_type', coalesce(p_source_type, 'Self Selected')
    )
  );

  return v_target_id;
end;
$$;

comment on function public.set_user_pathway_target(uuid, text, text, text, numeric) is
'Sets or refreshes an active pathway target for a youth user and logs the selection event.';

-- ---------------------------------------------------------------------
-- 6) Function: refresh readiness snapshot
-- ---------------------------------------------------------------------
create or replace function public.refresh_user_readiness_snapshot(
  p_user_id uuid,
  p_snapshot_reason text default 'Manual refresh',
  p_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_target_id uuid;
  v_snapshot_id uuid;
  v_role_title text;
  v_readiness_score numeric(5,2);
  v_profile_strength numeric(5,2);
  v_missing_skills text;
  v_next_best_action text;
  v_recommended_courses text;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  select lap.id, lap.role_title
  into v_target_id, v_role_title
  from public.v_latest_active_pathway_targets lap
  where lap.user_id = p_user_id
  limit 1;

  if v_target_id is null then
    raise exception 'No active pathway target found for user %', p_user_id;
  end if;

  select
    coalesce(ar.readiness_score, prs.readiness_score, 0),
    coalesce(prs.profile_strength_score, 0),
    coalesce(ar.missing_skills, ''),
    coalesce(ar.next_best_action, 'Strengthen profile and complete one targeted course.'),
    coalesce(ar.recommended_courses, '')
  into
    v_readiness_score,
    v_profile_strength,
    v_missing_skills,
    v_next_best_action,
    v_recommended_courses
  from public.v_pathway_readiness_signals prs
  left join public.v_pathway_action_recommendations ar
    on ar.user_id = prs.user_id
   and ar.pathway_target_id = prs.pathway_target_id
  where prs.user_id = p_user_id
    and prs.pathway_target_id = v_target_id
  limit 1;

  insert into public.user_readiness_snapshots (
    user_id,
    pathway_target_id,
    role_title,
    readiness_score,
    profile_strength_score,
    skills_match_score,
    education_match_score,
    experience_match_score,
    location_match_score,
    missing_skills,
    recommended_actions,
    recommendation_metadata,
    snapshot_reason,
    created_at
  )
  values (
    p_user_id,
    v_target_id,
    v_role_title,
    coalesce(v_readiness_score, 0),
    coalesce(v_profile_strength, 0),
    null,
    null,
    null,
    null,
    coalesce(v_missing_skills, ''),
    coalesce(v_next_best_action, ''),
    jsonb_build_object(
      'recommended_courses', coalesce(v_recommended_courses, ''),
      'refreshed_by', coalesce(p_actor_id, p_user_id)
    ),
    coalesce(p_snapshot_reason, 'Manual refresh'),
    now()
  )
  returning id into v_snapshot_id;

  update public.profiles
  set
    profile_strength_score = coalesce(v_profile_strength, profile_strength_score),
    last_readiness_refresh_at = now(),
    updated_at = now()
  where id = p_user_id;

  perform public.log_transition_event(
    p_user_id,
    coalesce(p_actor_id, p_user_id),
    'readiness_snapshot_refreshed',
    'pathway_twin',
    'Observed',
    'readiness_snapshot',
    v_snapshot_id,
    (select country from public.profiles where id = p_user_id),
    (select region from public.profiles where id = p_user_id),
    null,
    null,
    v_target_id,
    v_readiness_score,
    jsonb_build_object(
      'role_title', v_role_title,
      'missing_skills', coalesce(v_missing_skills, ''),
      'recommended_courses', coalesce(v_recommended_courses, '')
    )
  );

  return v_snapshot_id;
end;
$$;

comment on function public.refresh_user_readiness_snapshot(uuid, text, uuid) is
'Creates a saved readiness snapshot for the currently active pathway target and logs the event.';

-- ---------------------------------------------------------------------
-- 7) Convenience function: Pathway Twin bootstrap in one call
-- ---------------------------------------------------------------------
create or replace function public.bootstrap_pathway_twin(
  p_user_id uuid,
  p_role_title text,
  p_source_type text default 'Self Selected',
  p_notes text default null,
  p_snapshot_reason text default 'Initial Pathway Twin bootstrap'
)
returns table(
  pathway_target_id uuid,
  readiness_snapshot_id uuid
)
language plpgsql
security definer
as $$
declare
  v_target_id uuid;
  v_snapshot_id uuid;
begin
  v_target_id := public.set_user_pathway_target(
    p_user_id,
    p_role_title,
    p_source_type,
    p_notes,
    70
  );

  v_snapshot_id := public.refresh_user_readiness_snapshot(
    p_user_id,
    p_snapshot_reason,
    p_user_id
  );

  return query
  select v_target_id, v_snapshot_id;
end;
$$;

comment on function public.bootstrap_pathway_twin(uuid, text, text, text, text) is
'Creates/updates the target role and immediately records the first readiness snapshot.';

-- ---------------------------------------------------------------------
-- 8) Safe select exposure comment
-- ---------------------------------------------------------------------
comment on view public.v_user_pathway_target_opportunities is
'Opportunity recommendations aligned to a users current selected pathway target for the Pathway Twin UI.';
