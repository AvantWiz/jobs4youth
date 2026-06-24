## Jobs4Youth Phase 1 — Institutionally Distinctive Fast Build Plan

### Objective
Build three high-lift features without a full rewrite:
1. Pathway Twin
2. Curriculum Intelligence for Institutions
3. Outcomes Ledger

### Recommended build sequence

#### Step 0 — Shared foundation (must come first)
Create a shared data spine used by all three features.

##### SQL deliverable
Create: `build9_phase1_shared_foundation.sql`

##### Additions
- `career_pathways_catalog`
- `pathway_targets`
- `transition_events`
- `outcomes_ledger`
- `institution_signal_snapshots`
- `user_readiness_snapshots`
- helper views for:
  - profile readiness
  - missing skills by target role
  - pathway action recommendations
  - institution curriculum demand signals
  - outcomes funnel metrics

##### Why first
- Pathway Twin needs readiness and action data.
- Curriculum Intelligence needs demand and training-coverage snapshots.
- Outcomes Ledger needs event capture from day one.

---

#### Step 1 — Pathway Twin MVP

##### Goal
Give each youth user a dynamic “learning-to-earning twin” showing:
- target role
- readiness score
- missing skills
- recommended training
- next best action
- progression over time

##### Files
- `build10_pathway_twin.sql`
- `app.js`
- `styles.css`

##### UI changes
- Youth dashboard Pathway Twin card
- Readiness breakdown panel
- Suggested actions panel
- Progress trend block
- Target role selector

##### MVP logic
- Use existing opportunities + skills + profile data
- Compute current readiness vs selected role
- Recommend verified courses that close missing skill gaps
- Store readiness snapshots over time

---

#### Step 2 — Curriculum Intelligence MVP

##### Goal
Turn the institution dashboard into a curriculum-planning cockpit.

##### Files
- `build11_curriculum_intelligence.sql`
- `app.js`
- `styles.css`

##### UI changes
- Institution dashboard intelligence tab
- Top demanded skills by geography
- Skills not sufficiently covered by current courses
- Suggested new modules / course revisions
- Alignment score for each course
- “Jobs unlocked by this course” view

##### MVP logic
- reuse labour market signal views
- compare course skill coverage against verified opportunity demand
- rank coverage gaps
- generate suggested curriculum priorities

---

#### Step 3 — Outcomes Ledger MVP

##### Goal
Create donor-grade evidence of transitions from learning to earning.

##### Files
- `build12_outcomes_ledger.sql`
- `app.js`
- optional `styles.css`

##### UI changes
- Admin outcomes dashboard
- institution outcomes page
- employer conversion view
- youth pathway milestones timeline

##### MVP event model
- profile_created
- profile_completed
- opportunity_saved
- course_saved
- application_started
- application_submitted
- shortlisted
- training_applied
- training_accepted
- placed
- retained_30_days (future-ready placeholder)

##### MVP outputs
- conversion funnel by geography / institution / employer
- pathway completion metrics
- training-to-job linkage metrics
- employer responsiveness metrics
- underserved segment outcomes

---

### Best implementation order in code
1. Shared SQL foundation
2. Pathway Twin UX
3. Curriculum Intelligence dashboards
4. Outcomes Ledger dashboard and event capture hardening

### Immediate next build recommendation
Start with:
`build9_phase1_shared_foundation.sql`

This is the cleanest next step because all three Phase 1 features depend on a common event + pathway + snapshot layer.
