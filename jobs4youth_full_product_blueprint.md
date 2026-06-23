# Jobs4Youth Full Product Blueprint

## Product vision
Jobs4Youth should feel like a professional digital employment and skills platform — not a simple vacancy board. The next product evolution separates **Save** from **Apply**, introduces richer **opportunity and training detail experiences**, adds **shortlist workflows**, and creates **guided application journeys** for both jobs and training pathways.

---

## Core product upgrades

### 1) Save vs Apply separation
Current behaviour makes **Save** and **Apply** feel like the same action. The new product should split them clearly.

#### Jobs
- **Save to shortlist**
- **View details**
- **Apply now**

#### Training
- **Save to shortlist**
- **View details**
- **Apply / Request enrolment**

---

## 2) New youth experience architecture

### A. Youth dashboard
The youth dashboard should become a decision-support hub with these blocks:

1. **Recommended opportunities**
2. **Saved opportunities**
3. **Saved training**
4. **Applications in progress**
5. **Profile strength / profile readiness**
6. **Suggested training based on skills gaps**
7. **Next best action**

### B. Opportunity detail page
Each job should open a structured detail experience with:

- job title
- organisation name
- verification / trust badge
- location
- opportunity type
- experience level
- education requirement
- skills required
- compensation / stipend (optional)
- deadline (optional)
- employer overview
- why this role matters
- what the applicant may learn or gain
- fit to profile guidance
- suggested trainings before applying
- related opportunities
- action panel: **Save**, **Apply**, **Share**

### C. Training detail page
Each training offer should open a structured detail experience with:

- course / programme title
- institution name
- verification badge
- mode (online / hybrid / in-person)
- duration
- cost / fee / scholarship / sponsored status
- certification outcome
- key modules / learning outcomes
- entry requirements
- target audience
- language of delivery
- schedule / cohort period
- institution overview
- why this training matters
- related jobs or labour market pathways
- action panel: **Save**, **Apply / Request enrolment**, **Share**

---

## 3) Shortlist model (the “cart” equivalent)
Recommended naming for youth-facing saved content:

## **My Shortlist**

Shortlist should contain two tabs:

- **Saved Opportunities**
- **Saved Training**

For each saved item, users should be able to:
- open details
- remove from shortlist
- apply directly from shortlist
- compare multiple items conceptually

---

## 4) Guided application experience

### Job application journey
Do **not** submit immediately from the browse card.

#### Step 1 — Review opportunity
User sees full opportunity details.

#### Step 2 — Profile readiness
Platform checks:
- profile completeness
- education requirement match
- skills gap signals
- location alignment

#### Step 3 — Application package
User reviews or uploads:
- CV / resume
- cover note / motivation note
- optional attachments

#### Step 4 — Screening questions
Employer-defined screening questions appear.
Examples:
- Why are you interested in this role?
- Do you have experience in [field]?
- Are you available immediately?

#### Step 5 — Final confirmation
User reviews application summary.

#### Step 6 — Success page
Show:
- application submitted
- application status = Submitted
- next steps
- return to shortlist / dashboard

---

### Training application / enrolment journey
Similar structure, but adapted for institutions.

#### Step 1 — Review training details
#### Step 2 — Eligibility / readiness
#### Step 3 — Upload required documents (optional)
#### Step 4 — Learner questions / statement of interest
#### Step 5 — Confirm submission
#### Step 6 — Success page + tracking

---

## 5) Employer-side product upgrades

### Opportunity publishing should support richer metadata
Additional fields recommended:
- application deadline
- compensation / stipend range
- work arrangement
- duration
- screening questions
- benefits / learning outcomes
- contact or hiring team notes (internal/admin visible as needed)

### Candidate management should support
- Submitted
- Under Review
- Shortlisted
- Interviewing
- Rejected
- Selected
- Placed

Employers should be able to review candidates from a stronger workflow page, not just raw cards.

---

## 6) Institution-side product upgrades

### Training publishing should support richer metadata
Additional fields recommended:
- fees
- scholarship availability
- certification type
- target audience
- language
- schedule / cohort
- enrolment deadline
- prerequisites
- modules / outcomes

### Student / learner workflow
Institutions should be able to see:
- saved training interest (optional future feature)
- submitted training applications
- application pipeline status

---

## 7) Admin and trust layer
Admins should continue to control:
- organisation moderation
- opportunity moderation
- course moderation
- document review
- notification triggering
- trust badges and public visibility

Recommended moderation statuses:
- Pending review
- Revision requested
- Approved
- Rejected
- Archived

---

## 8) Proposed data model additions

### New tables
1. `saved_opportunities`
2. `saved_courses`
3. `opportunity_screening_questions`
4. `course_application_questions`
5. `course_applications`
6. `application_documents` (optional if attachments are required)

### Recommended new columns
#### opportunities
- `deadline`
- `compensation`
- `work_arrangement`
- `duration`
- `benefits`
- `learning_outcomes`

#### courses
- `fees`
- `scholarship_info`
- `certification`
- `application_deadline`
- `audience`
- `language`
- `schedule`
- `entry_requirements`
- `modules_overview`

---

## 9) UI pages to build

### Youth-facing
- Opportunity detail page
- Training detail page
- My Shortlist page
- Job application wizard page
- Training application wizard page
- Application success / tracking page

### Employer-facing
- Opportunity detail management page
- Candidate workflow board
- Screening question builder

### Institution-facing
- Training detail management page
- Learner application board
- Institution application question builder

### Admin-facing
- Moderation queue enhancements
- moderation detail page with decision rationale
- QA / launch checklist page (already added)

---

## 10) Build order recommendation

### Build 1 — foundation
- save / shortlist tables
- save buttons for jobs and training
- shortlist page
- separate Save vs View Details actions

### Build 2 — detail experiences
- opportunity detail page
- training detail page
- richer employer / institution information blocks

### Build 3 — application flows
- job application wizard
- training application wizard
- success / tracking pages

### Build 4 — employer / institution management
- screening questions
- candidate pipeline board
- learner application board

### Build 5 — final trust + launch review
- cross-device QA
- content sweep
- production SMTP/email sender
- final admin launch review

---

## 11) Experience principles
The new product should feel:
- intentional
- trustworthy
- mobile-first
- guided
- not cluttered
- not overly technical for youth users
- structured and investor / institutional quality

---

## 12) Immediate next build recommendation
The safest next code sprint is:

## **Build 1 — Save / Shortlist foundation + detail page shell architecture**

That gives you:
- meaningful separation between Save and Apply
- better UX immediately
- a strong foundation for building the guided application experiences next
