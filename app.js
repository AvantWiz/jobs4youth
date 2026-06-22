
const OPTION_SETS = {
  countries: [
    'Malawi','Kenya','Uganda','Tanzania','Rwanda','Zambia','Zimbabwe','Mozambique','Ethiopia','Nigeria','Ghana','Sierra Leone','Liberia','Senegal','Côte d’Ivoire','Remote'
  ],
  educationLevels: [
    'Secondary School','Certificate','Diploma','Bachelor\'s Degree','Master\'s Degree','PhD'
  ],
  availability: ['Immediate','Within 1 Month','Within 3 Months','Within 6 Months'],
  experienceLevels: ['None','Entry Level','1–3 Years','3–5 Years','5+ Years'],
  sectors: ['Agriculture','Agri-processing','Livestock','Fisheries','Food Manufacturing','Logistics','ICT','Finance','Education','Other'],
  opportunityTypes: ['Job','Internship','Apprenticeship','Training','Extension'],
  deliveryModes: ['Online','Hybrid','In-person'],
  courseTypes: ['Short Course','Certificate','Diploma','Degree Program','Bootcamp']
};

const initialState = {
  role: 'youth',
  view: 'dashboard',
  profile: {
    name: 'Amina Otieno',
    country: 'Kenya',
    region: 'Nakuru',
    education: 'Diploma',
    skills: 'food safety, dairy, record keeping, packaging, mobile money',
    interests: 'agri-processing, dairy, quality control',
    availability: 'Immediate',
    experience: 'Entry Level',
    organizationName: '',
    sector: '',
    verified: false
  },
  jobs: [],
  courses: [],
  employers: [],
  applications: [],
  employerCandidates: [],
  verificationItems: [],
  auditLogs: []
};

let state = structuredClone(initialState);
let supabase = null;
let isConfigured = false;
let currentUser = null;
let authMode = 'login';

if (
  window.JOBS4YOUTH_CONFIG &&
  window.JOBS4YOUTH_CONFIG.supabaseUrl &&
  !window.JOBS4YOUTH_CONFIG.supabaseUrl.includes('PASTE_') &&
  window.JOBS4YOUTH_CONFIG.supabaseAnonKey &&
  !window.JOBS4YOUTH_CONFIG.supabaseAnonKey.includes('PASTE_')
) {
  supabase = window.supabase.createClient(
    window.JOBS4YOUTH_CONFIG.supabaseUrl,
    window.JOBS4YOUTH_CONFIG.supabaseAnonKey
  );
  isConfigured = true;
}

function title(s) {
  return (s || '').split(' ').map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(' ');
}

function words(s) {
  return (s || '').toLowerCase().split(/[\s,;./()\-]+/).filter(Boolean);
}

function uniqueWords(value) {
  return [...new Set(words(value).filter(w => w.length > 2))];
}

function overlap(a, b) {
  const bSet = new Set(uniqueWords(b));
  return uniqueWords(a).filter(w => bSet.has(w));
}

function scorePart(matches, total, weight) {
  if (!total) return 0;
  return Math.min(weight, Math.round((matches / total) * weight));
}

function matchDetails(job) {
  const skillHits = overlap(state.profile.skills, job.skills);
  const interestHits = overlap(state.profile.interests, [job.title, job.desc, job.type, job.skills].join(' '));
  const jobSkillCount = Math.max(uniqueWords(job.skills).length, 1);
  let score = 25;
  score += scorePart(skillHits.length, jobSkillCount, 35);
  score += scorePart(interestHits.length, Math.max(uniqueWords(state.profile.interests).length, 1), 18);
  if ((job.country || '') && job.country === state.profile.country) score += 10;
  if ((job.region || '') && job.region === state.profile.region) score += 8;
  if ((job.education || '') && job.education === state.profile.education) score += 8;
  if ((job.experience || '') && job.experience === state.profile.experience) score += 6;
  const reasons = [];
  if (skillHits.length) reasons.push('Skills match: ' + skillHits.slice(0, 4).join(', '));
  if (interestHits.length) reasons.push('Interest match: ' + interestHits.slice(0, 3).join(', '));
  if ((job.country || '') === state.profile.country) reasons.push('Country match');
  if ((job.region || '') === state.profile.region) reasons.push('Location match');
  if ((job.education || '') === state.profile.education) reasons.push('Education match');
  if (!reasons.length) reasons.push('General profile fit based on opportunity details');
  return { score: Math.min(98, score), reasons };
}

function matchScore(job) {
  return matchDetails(job).score;
}

function skillCountsFromJobs() {
  const counts = {};
  state.jobs.forEach(job => {
    (job.skills || '').split(',').map(x => x.trim()).filter(Boolean).forEach(skill => {
      counts[skill] = (counts[skill] || 0) + 1;
    });
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function courseSkillSet() {
  const skills = new Set();
  state.courses.forEach(course => {
    (course.skills || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean).forEach(skill => skills.add(skill));
  });
  return skills;
}

function trainingGapItems() {
  const covered = courseSkillSet();
  return skillCountsFromJobs().filter(([skill]) => !covered.has(skill.toLowerCase())).slice(0, 6);
}

function careerPathways() {
  const ranked = [...state.jobs].sort((a, b) => matchScore(b) - matchScore(a)).slice(0, 3);
  return ranked.map(job => {
    const matchedCourses = state.courses.filter(course => overlap(course.skills, job.skills).length > 0).slice(0, 2);
    return { job, matchedCourses };
  });
}

function navItems() {
  if (state.role === 'youth') return ['dashboard', 'opportunities', 'training', 'profile', 'about', 'privacy', 'terms', 'contact'];
  if (state.role === 'employer') return ['dashboard', 'post opportunity', 'candidates', 'profile', 'about', 'privacy', 'terms', 'contact'];
  if (state.role === 'institution') return ['dashboard', 'post training', 'courses', 'profile', 'about', 'privacy', 'terms', 'contact'];
  return ['dashboard', 'verification', 'audit logs', 'insights', 'about', 'privacy', 'terms', 'contact'];
}

function desc() {
  if (state.view === 'about') return 'Learn what Jobs4Youth is, who it serves, and why it exists.';
  if (state.view === 'privacy') return 'Understand how Jobs4Youth collects, uses and protects user information.';
  if (state.view === 'terms') return 'Review the rules, responsibilities and conditions for using Jobs4Youth.';
  if (state.view === 'contact') return 'Get in touch for support, partnerships and platform enquiries.';
  if (state.role === 'youth') return 'Find relevant jobs, internships and training matched to your skills and goals.';
  if (state.role === 'employer') return 'Post opportunities and shortlist best-fit young candidates.';
  if (state.role === 'institution') return 'Publish courses and align training to real market demand.';
  return 'Verify partners, monitor activity and generate labour market intelligence.';
}

function setView(v) {
  state.view = v;
  render();
}

function setRole(r) {
  if (currentUser) return;
  state.role = r;
  state.view = r === 'admin' ? 'dashboard' : 'about';
  render();
}

window.setView = setView;
window.setRole = setRole;

function syncProfileToState(profile) {
  if (!profile) return;
  state.role = profile.role || 'youth';
  state.profile = {
    name: profile.full_name || '',
    country: profile.country || '',
    region: profile.region || '',
    education: profile.education || '',
    skills: profile.skills || '',
    interests: profile.interests || '',
    availability: profile.availability || '',
    experience: profile.experience_level || '',
    organizationName: profile.organization_name || '',
    sector: profile.sector || '',
    verified: !!profile.verified
  };
}

async function ensureProfile(user) {
  if (!isConfigured || !user) return null;
  const { data: existingProfile, error: fetchError } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (fetchError) {
    console.error('Error loading profile:', fetchError);
    return null;
  }
  if (existingProfile) return existingProfile;

  const incomingRole = (user.user_metadata?.role || 'youth').toLowerCase();
  const safeRole = ['youth', 'employer', 'institution', 'admin'].includes(incomingRole) ? incomingRole : 'youth';
  const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'New User';

  const { data: createdProfile, error: insertError } = await supabase
    .from('profiles')
    .insert([{ id: user.id, email: user.email, full_name: fullName, role: safeRole }])
    .select().single();

  if (insertError) {
    console.error('Error creating profile:', insertError);
    return null;
  }
  if (['employer', 'institution'].includes(safeRole)) await ensureVerificationRequest(createdProfile, safeRole);
  return createdProfile;
}

async function ensureVerificationRequest(profile, role) {
  if (!isConfigured || !currentUser || !profile || !['employer', 'institution'].includes(role)) return;
  const { data: existing } = await supabase
    .from('verification_queue')
    .select('id')
    .eq('profile_id', currentUser.id)
    .eq('item_type', role)
    .limit(1);
  if (existing && existing.length) return;
  const { error } = await supabase.from('verification_queue').insert([
    { profile_id: currentUser.id, item_type: role, item_id: null, review_status: 'Pending' }
  ]);
  if (error) console.error('Verification request insert error:', error);
}

async function loadJobsFromSupabase() {
  if (!isConfigured) return;
  const { data, error } = await supabase.from('opportunities').select('*').order('created_at', { ascending: false });
  if (error) { console.error('Error loading jobs:', error); return; }
  state.jobs = (data || []).map(job => ({
    id: job.id,
    title: job.title || 'No title',
    org: job.organization_name || 'Unknown org',
    country: job.country || '',
    region: job.region || '',
    type: job.opportunity_type || '',
    skills: job.required_skills || '',
    education: job.education_requirement || '',
    experience: job.experience_requirement || '',
    status: job.status || 'Pending',
    desc: job.description || '',
    postedBy: job.posted_by || null
  }));
}

async function loadCoursesFromSupabase() {
  if (!isConfigured) return;
  const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
  if (error) { console.error('Error loading courses:', error); return; }
  state.courses = (data || []).map(course => ({
    id: course.id,
    title: course.title || 'No title',
    provider: course.provider_name || 'Unknown provider',
    mode: course.delivery_mode || '',
    duration: course.duration || '',
    skills: course.skills_covered || '',
    country: course.country || '',
    region: course.region || '',
    status: course.status || 'Pending',
    postedBy: course.posted_by || null
  }));
}

async function loadEmployersFromSupabase() {
  state.employers = [];
  if (!isConfigured) return;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, organization_name, role, country, region, sector, verified')
    .in('role', ['employer', 'institution'])
    .eq('verified', true)
    .order('created_at', { ascending: false });
  if (error) { console.error('Error loading verified organisations:', error); return; }
  state.employers = (data || []).map(org => ({
    id: org.id,
    name: org.organization_name || org.full_name || 'Verified organisation',
    role: org.role,
    country: org.country || '',
    region: org.region || '',
    sector: org.sector || '',
    verified: !!org.verified
  }));
}

async function loadApplicationsFromSupabase() {
  state.applications = [];
  state.employerCandidates = [];
  if (!isConfigured || !currentUser) return;

  if (state.role === 'youth') {
    const { data, error } = await supabase.from('applications').select('*').eq('applicant_id', currentUser.id);
    if (error) { console.error('Error loading youth applications:', error); return; }
    state.applications = (data || []).map(a => a.opportunity_id);
    return;
  }

  if (state.role === 'employer' || state.role === 'admin') {
    const { data: myOpps, error: oppError } = await supabase.from('opportunities').select('id,title').eq('posted_by', currentUser.id);
    if (oppError) { console.error('Error loading employer opportunities:', oppError); return; }
    const opportunityIds = (myOpps || []).map(o => o.id);
    if (!opportunityIds.length) return;

    const { data: apps, error: appError } = await supabase
      .from('applications')
      .select('id, opportunity_id, applicant_id, application_status, created_at')
      .in('opportunity_id', opportunityIds)
      .order('created_at', { ascending: false });
    if (appError) { console.error('Error loading employer applications:', appError); return; }

    const applicantIds = [...new Set((apps || []).map(a => a.applicant_id).filter(Boolean))];
    let profileMap = {};
    if (applicantIds.length) {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, country, region, skills, education, experience_level')
        .in('id', applicantIds);
      if (!profileError) profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    }
    const oppMap = Object.fromEntries((myOpps || []).map(o => [o.id, o]));
    state.employerCandidates = (apps || []).map(a => ({
      id: a.id,
      opportunityTitle: oppMap[a.opportunity_id]?.title || 'Opportunity',
      applicantName: profileMap[a.applicant_id]?.full_name || 'Applicant',
      applicantEmail: profileMap[a.applicant_id]?.email || '',
      country: profileMap[a.applicant_id]?.country || '',
      region: profileMap[a.applicant_id]?.region || '',
      skills: profileMap[a.applicant_id]?.skills || '',
      education: profileMap[a.applicant_id]?.education || '',
      experience: profileMap[a.applicant_id]?.experience_level || '',
      status: a.application_status || 'Submitted'
    }));
  }
}

async function loadVerificationQueueFromSupabase() {
  state.verificationItems = [];
  if (!isConfigured || !currentUser || state.role !== 'admin') return;
  const { data: queue, error } = await supabase.from('verification_queue').select('*').order('created_at', { ascending: false });
  if (error) { console.error('Error loading verification queue:', error); return; }

  const profileIds = [...new Set((queue || []).map(q => q.profile_id).filter(Boolean))];
  const oppIds = [...new Set((queue || []).filter(q => q.item_type === 'opportunity' && q.item_id).map(q => q.item_id))];
  const courseIds = [...new Set((queue || []).filter(q => q.item_type === 'course' && q.item_id).map(q => q.item_id))];

  let profileMap = {}, oppMap = {}, courseMap = {};
  if (profileIds.length) {
    const { data } = await supabase.from('profiles').select('id, full_name, email, role, organization_name, country, region, verified').in('id', profileIds);
    profileMap = Object.fromEntries((data || []).map(p => [p.id, p]));
  }
  if (oppIds.length) {
    const { data } = await supabase.from('opportunities').select('*').in('id', oppIds);
    oppMap = Object.fromEntries((data || []).map(o => [o.id, o]));
  }
  if (courseIds.length) {
    const { data } = await supabase.from('courses').select('*').in('id', courseIds);
    courseMap = Object.fromEntries((data || []).map(c => [c.id, c]));
  }

  state.verificationItems = (queue || []).map(item => ({
    id: item.id,
    itemType: item.item_type,
    itemId: item.item_id,
    profileId: item.profile_id,
    reviewStatus: item.review_status,
    reviewNotes: item.review_notes || '',
    ownerName: profileMap[item.profile_id]?.full_name || profileMap[item.profile_id]?.email || 'Unknown',
    ownerEmail: profileMap[item.profile_id]?.email || '',
    ownerOrg: profileMap[item.profile_id]?.organization_name || '',
    ownerCountry: profileMap[item.profile_id]?.country || '',
    ownerRegion: profileMap[item.profile_id]?.region || '',
    opportunity: item.item_type === 'opportunity' ? oppMap[item.item_id] || null : null,
    course: item.item_type === 'course' ? courseMap[item.item_id] || null : null
  }));
}


async function loadAuditLogsFromSupabase() {
  state.auditLogs = [];
  if (!isConfigured || !currentUser || state.role !== 'admin') return;
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(80);
  if (error) { console.error('Error loading audit logs:', error); return; }
  state.auditLogs = data || [];
}

async function writeAuditLog(action, entityType, entityId = null, details = '') {
  if (!isConfigured || !currentUser) return;
  const { error } = await supabase.from('audit_logs').insert([{
    actor_id: currentUser.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details
  }]);
  if (error) console.error('Audit log error:', error);
}

function renderShell() {
  document.getElementById('nav').innerHTML = navItems().map(v => `<button class="${state.view === v ? 'active' : ''}" onclick="setView('${v}')">${title(v)}</button>`).join('');
  const roles = currentUser ? [state.role] : ['youth', 'employer', 'institution', 'admin'];
  document.getElementById('roleSwitch').innerHTML = roles.map(r => `<button class="${state.role === r ? 'active' : ''}" onclick="setRole('${r}')">${title(r)}</button>`).join('');
  document.getElementById('kicker').textContent = 'Platform workspace';
  document.getElementById('pageTitle').textContent = title(state.view);
  document.getElementById('pageDesc').textContent = desc();
  if (!isConfigured) document.getElementById('authStatus').textContent = 'Configuration required';
  else if (currentUser) document.getElementById('authStatus').textContent = `Signed in: ${currentUser.email}`;
  else document.getElementById('authStatus').textContent = 'Ready for sign in';
}

function metrics() {
  return `
    <div class="grid">
      <div class="card span-3"><div class="label">Visible opportunities</div><div class="metric">${state.jobs.length}</div></div>
      <div class="card span-3"><div class="label">Training offers</div><div class="metric">${state.courses.length}</div></div>
      <div class="card span-3"><div class="label">Employers</div><div class="metric">${state.employers.length}</div></div>
      <div class="card span-3"><div class="label">Applications</div><div class="metric">${state.applications.length}</div></div>
    </div>
  `;
}

function jobCard(j, action) {
  const details = matchDetails(j);
  const score = details.score;
  const alreadyApplied = state.applications.includes(j.id);
  return `
    <div class="job">
      <div>
        <h3>${escapeHtml(j.title)}</h3>
        <p><b>${escapeHtml(j.org)}</b> • ${escapeHtml(j.region)}, ${escapeHtml(j.country)} • ${escapeHtml(j.type)} • ${escapeHtml(j.experience)}</p>
        <p>${escapeHtml(j.desc)}</p>
        <div>${(j.skills || '').split(',').filter(Boolean).map(x => `<span class="pill">${escapeHtml(x.trim())}</span>`).join('')}</div>
        <p class="label" style="margin-top:8px;"><b>Match basis:</b> ${details.reasons.map(escapeHtml).join(' • ')}</p>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">${action ? (alreadyApplied ? `<button class="secondary" disabled>Application submitted</button>` : `<button class="primary" onclick="applyJob('${j.id}')">Apply now</button>`) : ''}<span class="pill">${escapeHtml(j.status || 'Pending')}</span></div>
      </div>
      <div class="fit" style="--score:${score}"><span>${score}%</span></div>
    </div>
  `;
}

window.applyJob = async function(id) {
  if (!isConfigured) return alert('Supabase not connected');
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return alert('Please sign in first before applying.');
  const profile = await ensureProfile(user);
  if (!profile || profile.role !== 'youth') return alert('Only youth accounts can apply for opportunities.');
  const { error } = await supabase.from('applications').insert([{ opportunity_id: id, applicant_id: user.id, application_status: 'Submitted' }]);
  if (error) {
    console.error('Application error:', error);
    if ((error.message || '').toLowerCase().includes('duplicate') || error.code === '23505') return alert('You have already applied for this opportunity.');
    return alert(`Failed to apply: ${error.message}`);
  }
  await writeAuditLog('application_submitted', 'opportunity', id, 'Youth submitted an application');
  await loadApplicationsFromSupabase();
  alert('✅ Application saved successfully!');
  render();
};

function actionSelect(label, id, options, selected, placeholder='Select option') {
  return `
    <label>
      ${label}
      <select id="${id}">${renderOptions(options, selected, placeholder)}</select>
    </label>
  `;
}

function trustPageShell(kicker, heading, bodyHtml) {
  return `
    <div class="grid">
      <div class="card span-12">
        <div class="kicker">${escapeHtml(kicker)}</div>
        <h3 style="margin-top:8px;">${escapeHtml(heading)}</h3>
        ${bodyHtml}
      </div>
    </div>
  `;
}

function youthDash() {
  const ranked = [...state.jobs].sort((a, b) => matchScore(b) - matchScore(a));
  return `
    ${metrics()}
    <div class="grid" style="margin-top:18px">
      <div class="card span-8">
        <div class="section-title"><h3>Best matches for ${escapeHtml(state.profile.name || 'you')}</h3><button class="secondary" onclick="setView('opportunities')">View all</button></div>
        ${ranked.slice(0, 3).map(j => jobCard(j, true)).join('') || '<p class="label">No verified opportunities yet.</p>'}
      </div>
      <div class="card span-4">
        <h3>Recommended career pathways</h3>
        ${careerPathwayPanel()}
      </div>
    </div>
  `;
}

function opportunities() {
  return `<div class="grid"><div class="card span-12"><div class="section-title"><h3>Opportunity marketplace</h3></div>${[...state.jobs].sort((a,b)=>matchScore(b)-matchScore(a)).map(j=>jobCard(j,true)).join('') || '<p class="label">No opportunities available yet.</p>'}</div></div>`;
}

function training() {
  return `
    <div class="grid">
      ${state.courses.map(c => `
        <div class="card span-4">
          <h3>${escapeHtml(c.title)}</h3>
          <p>${escapeHtml(c.provider)}</p>
          <p class="label">${escapeHtml(c.mode)} • ${escapeHtml(c.duration)}</p>
          <p class="label">${escapeHtml(c.region)}, ${escapeHtml(c.country)}</p>
          <p><span class="pill">${escapeHtml(c.status || 'Pending')}</span></p>
          ${(c.skills || '').split(',').filter(Boolean).map(x => `<span class="pill">${escapeHtml(x.trim())}</span>`).join('')}
        </div>
      `).join('') || '<div class="card span-12"><p class="label">No training offers available yet.</p></div>'}
    </div>
  `;
}

function youthProfileForm() {
  return `
    <div class="form">
      <label>Name<input id="profileName" value="${escapeHtml(state.profile.name || '')}"/></label>
      ${actionSelect('Country','profileCountry', OPTION_SETS.countries, state.profile.country, 'Choose country')}
      <label>Region / City<input id="profileRegion" value="${escapeHtml(state.profile.region || '')}"/></label>
      ${actionSelect('Education','profileEducation', OPTION_SETS.educationLevels, state.profile.education, 'Choose education')}
      ${actionSelect('Availability','profileAvailability', OPTION_SETS.availability, state.profile.availability, 'Choose availability')}
      ${actionSelect('Experience level','profileExperience', OPTION_SETS.experienceLevels, state.profile.experience, 'Choose experience')}
      <label class="full">Skills<textarea id="profileSkills">${escapeHtml(state.profile.skills || '')}</textarea></label>
      <label class="full">Interests<textarea id="profileInterests">${escapeHtml(state.profile.interests || '')}</textarea></label>
      <button class="primary full" onclick="saveProfile()">Save profile</button>
    </div>
  `;
}

function organizationProfileForm(label) {
  return `
    <div class="form">
      <label>Contact person / name<input id="orgProfileName" value="${escapeHtml(state.profile.name || '')}"/></label>
      <label>${escapeHtml(label)}<input id="orgName" value="${escapeHtml(state.profile.organizationName || '')}"/></label>
      ${actionSelect('Sector','orgSector', OPTION_SETS.sectors, state.profile.sector, 'Choose sector')}
      ${actionSelect('Country','orgCountry', OPTION_SETS.countries, state.profile.country, 'Choose country')}
      <label>Region / City<input id="orgRegion" value="${escapeHtml(state.profile.region || '')}"/></label>
      <div class="full notice"><b>Verification status:</b> ${state.profile.verified ? 'Verified' : 'Pending admin verification'}</div>
      <button class="primary full" onclick="saveOrganizationProfile()">Save organisation profile</button>
    </div>
  `;
}

function profile() {
  const content = state.role === 'youth'
    ? youthProfileForm()
    : state.role === 'employer'
    ? organizationProfileForm('Organisation name')
    : organizationProfileForm('Institution name');
  const heading = state.role === 'youth' ? 'Youth profile' : state.role === 'employer' ? 'Employer profile' : 'Institution profile';
  return `<div class="card"><h3>${heading}</h3>${content}</div>`;
}

function employerDash() {
  const myJobs = currentUser ? state.jobs.filter(j => j.postedBy === currentUser.id) : [];
  return `
    ${metrics()}
    <div class="grid" style="margin-top:18px">
      <div class="card span-7"><div class="section-title"><h3>Your posted opportunities</h3><button class="secondary" onclick="setView('post opportunity')">Post new</button></div>${myJobs.length ? myJobs.map(j => jobCard(j, false)).join('') : '<p class="label">You have not posted any opportunities yet.</p>'}</div>
      <div class="card span-5"><h3>Applications received</h3><div class="metric">${state.employerCandidates.length}</div><p class="label">Candidates who applied to your posted opportunities.</p><button class="secondary" onclick="setView('candidates')">Open candidates</button></div>
    </div>
  `;
}

function postOpportunity() {
  return `
    <div class="card">
      <div class="section-title"><h3>Post a new opportunity</h3><span class="pill">Verification required</span></div>
      <p class="label">New opportunity posts are saved with status <b>Pending</b> until admin review.</p>
      <div class="form" style="margin-top:14px">
        <label class="full">Opportunity title<input id="oppTitle" placeholder="e.g. Agribusiness Internship Officer" /></label>
        <label>Organization name<input id="oppOrg" placeholder="e.g. Green Harvest Ltd" value="${escapeHtml(state.profile.organizationName || '')}" /></label>
        ${actionSelect('Country','oppCountry', OPTION_SETS.countries, state.profile.country, 'Choose country')}
        <label>Region / City<input id="oppRegion" placeholder="e.g. Nairobi" value="${escapeHtml(state.profile.region || '')}" /></label>
        ${actionSelect('Opportunity type','oppType', OPTION_SETS.opportunityTypes, '', 'Choose opportunity type')}
        ${actionSelect('Education requirement','oppEducation', OPTION_SETS.educationLevels, '', 'Choose education requirement')}
        ${actionSelect('Experience requirement','oppExperience', OPTION_SETS.experienceLevels, '', 'Choose experience requirement')}
        <label>Required skills (comma separated)<input id="oppSkills" placeholder="e.g. food safety, packaging, record keeping" /></label>
        <label class="full">Description<textarea id="oppDescription" placeholder="Describe responsibilities, duration, location, and who should apply."></textarea></label>
        <button class="primary full" onclick="submitOpportunity()">Post opportunity</button>
        <div class="label full" id="oppMessage"></div>
      </div>
    </div>
  `;
}

window.submitOpportunity = async function() {
  const msg = document.getElementById('oppMessage');
  if (!isConfigured) return alert('Supabase not connected');
  if (msg) msg.textContent = '';
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user) { if (msg) msg.textContent = 'Please sign in first.'; return; }
  const profile = await ensureProfile(user);
  if (!profile || !['employer','admin'].includes(profile.role)) { if (msg) msg.textContent = 'Only employer or admin accounts can post opportunities.'; return; }
  const payload = {
    posted_by: user.id,
    title: document.getElementById('oppTitle')?.value.trim() || '',
    organization_name: document.getElementById('oppOrg')?.value.trim() || '',
    country: document.getElementById('oppCountry')?.value || '',
    region: document.getElementById('oppRegion')?.value.trim() || '',
    opportunity_type: document.getElementById('oppType')?.value || '',
    education_requirement: document.getElementById('oppEducation')?.value || '',
    experience_requirement: document.getElementById('oppExperience')?.value || '',
    required_skills: document.getElementById('oppSkills')?.value.trim() || '',
    description: document.getElementById('oppDescription')?.value.trim() || '',
    status: 'Pending'
  };
  if (!payload.title || !payload.organization_name || !payload.country || !payload.opportunity_type || !payload.description) {
    if (msg) msg.textContent = 'Please fill in title, organization, country, type and description.';
    return;
  }
  const { data: inserted, error } = await supabase.from('opportunities').insert([payload]).select().single();
  if (error) { console.error('Opportunity insert error:', error); if (msg) msg.textContent = `Failed to post opportunity: ${error.message}`; return; }
  const { error: queueError } = await supabase.from('verification_queue').insert([{ profile_id: user.id, item_type: 'opportunity', item_id: inserted.id, review_status: 'Pending' }]);
  if (queueError) console.error('Verification queue insert error:', queueError);
  await writeAuditLog('opportunity_posted', 'opportunity', inserted.id, 'Opportunity submitted for verification');
  await loadJobsFromSupabase();
  alert('✅ Opportunity posted successfully! It is now pending admin verification.');
  setView('dashboard');
};

function candidates() {
  return `
    <div class="card"><div class="section-title"><h3>Candidate applications</h3><button class="secondary" onclick="setView('post opportunity')">Post another opportunity</button></div>${state.employerCandidates.length ? state.employerCandidates.map(c => `
      <div class="job"><div><h3>${escapeHtml(c.applicantName)}</h3><p><b>${escapeHtml(c.opportunityTitle)}</b> • ${escapeHtml(c.region)}, ${escapeHtml(c.country)} • ${escapeHtml(c.education || 'Education not provided')}</p><p>${escapeHtml(c.skills || 'No skills listed.')}</p><div><span class="pill">${escapeHtml(c.status)}</span>${c.applicantEmail ? `<span class="pill">${escapeHtml(c.applicantEmail)}</span>` : ''}${c.experience ? `<span class="pill">${escapeHtml(c.experience)}</span>` : ''}</div><div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;"><button class="secondary" onclick="updateApplicationStatus('${c.id}','Shortlisted')">Shortlist</button><button class="secondary" onclick="updateApplicationStatus('${c.id}','Rejected')">Reject</button><button class="primary" onclick="updateApplicationStatus('${c.id}','Placed')">Mark placed</button></div></div><div class="fit" style="--score:76"><span>76%</span></div></div>
    `).join('') : '<p class="label">No applications received yet for your opportunities.</p>'}</div>
  `;
}

window.updateApplicationStatus = async function(applicationId, status) {
  if (!isConfigured || !currentUser) return alert('Please sign in first.');
  const allowed = ['Shortlisted', 'Rejected', 'Placed'];
  if (!allowed.includes(status)) return alert('Invalid application status.');
  const { error } = await supabase
    .from('applications')
    .update({ application_status: status })
    .eq('id', applicationId);
  if (error) return alert(`❌ Failed to update application: ${error.message}`);
  await writeAuditLog('application_status_updated', 'application', applicationId, 'Application marked as ' + status);
  await loadApplicationsFromSupabase();
  alert(`✅ Application marked as ${status}.`);
  render();
};

function institutionDash() {
  const myCourses = currentUser ? state.courses.filter(c => c.postedBy === currentUser.id) : [];
  return `
    ${metrics()}
    <div class="grid" style="margin-top:18px">
      <div class="card span-6"><div class="section-title"><h3>Your training catalogue</h3><button class="secondary" onclick="setView('post training')">Post training</button></div>${myCourses.length ? myCourses.map(c => `<p><b>${escapeHtml(c.title)}</b><br><span class="label">${escapeHtml(c.provider)} • ${escapeHtml(c.mode)} • ${escapeHtml(c.duration)} • ${escapeHtml(c.region)}, ${escapeHtml(c.country)}</span><br><span class="pill">${escapeHtml(c.status)}</span></p>`).join('') : '<p class="label">No courses posted yet.</p>'}</div>
      <div class="card span-6"><h3>Demand signals</h3>${skillsDemandBars()}</div>
    </div>
  `;
}

function postTraining() {
  return `
    <div class="card">
      <div class="section-title"><h3>Post training course</h3><span class="pill">Verification required</span></div>
      <p class="label">New courses are saved with status <b>Pending</b> until admin review.</p>
      <div class="form" style="margin-top:14px">
        <label class="full">Course title<input id="courseTitle" placeholder="e.g. Digital Farm Records for Youth" /></label>
        <label>Provider name<input id="courseProvider" placeholder="e.g. AgriLearn Africa" value="${escapeHtml(state.profile.organizationName || '')}" /></label>
        ${actionSelect('Delivery mode','courseMode', OPTION_SETS.deliveryModes, '', 'Choose delivery mode')}
        ${actionSelect('Course type','courseType', OPTION_SETS.courseTypes, '', 'Choose course type')}
        <label>Duration<input id="courseDuration" placeholder="e.g. 6 weeks" /></label>
        ${actionSelect('Country','courseCountry', OPTION_SETS.countries, state.profile.country, 'Choose country')}
        <label>Region / City<input id="courseRegion" placeholder="e.g. Nairobi / Remote" value="${escapeHtml(state.profile.region || '')}" /></label>
        <label class="full">Skills covered (comma separated)<input id="courseSkills" placeholder="e.g. agronomy, records, mobile money" /></label>
        <button class="primary full" onclick="submitCourse()">Post training</button>
        <div class="label full" id="courseMessage"></div>
      </div>
    </div>
  `;
}

window.submitCourse = async function() {
  const msg = document.getElementById('courseMessage');
  if (!isConfigured) return alert('Supabase not connected');
  if (msg) msg.textContent = '';
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user) { if (msg) msg.textContent = 'Please sign in first.'; return; }
  const profile = await ensureProfile(user);
  if (!profile || !['institution','admin'].includes(profile.role)) { if (msg) msg.textContent = 'Only institution or admin accounts can post training.'; return; }
  const payload = {
    posted_by: user.id,
    title: document.getElementById('courseTitle')?.value.trim() || '',
    provider_name: document.getElementById('courseProvider')?.value.trim() || '',
    delivery_mode: document.getElementById('courseMode')?.value || '',
    duration: [document.getElementById('courseDuration')?.value.trim() || '', document.getElementById('courseType')?.value || ''].filter(Boolean).join(' • '),
    skills_covered: document.getElementById('courseSkills')?.value.trim() || '',
    country: document.getElementById('courseCountry')?.value || '',
    region: document.getElementById('courseRegion')?.value.trim() || '',
    status: 'Pending'
  };
  if (!payload.title || !payload.provider_name || !payload.country) { if (msg) msg.textContent = 'Please fill in title, provider name and country.'; return; }
  const { data: inserted, error } = await supabase.from('courses').insert([payload]).select().single();
  if (error) { console.error('Course insert error:', error); if (msg) msg.textContent = `Failed to post training: ${error.message}`; return; }
  const { error: queueError } = await supabase.from('verification_queue').insert([{ profile_id: user.id, item_type: 'course', item_id: inserted.id, review_status: 'Pending' }]);
  if (queueError) console.error('Verification queue insert error:', queueError);
  await writeAuditLog('course_posted', 'course', inserted.id, 'Training course submitted for verification');
  await loadCoursesFromSupabase();
  alert('✅ Training course posted successfully! It is now pending admin verification.');
  setView('dashboard');
};

function courses() { return training(); }

function verificationCard(item) {
  const details = item.itemType === 'opportunity' && item.opportunity ? `
    <p><b>${escapeHtml(item.opportunity.title)}</b></p>
    <p class="label">${escapeHtml(item.opportunity.organization_name || '')} • ${escapeHtml(item.opportunity.region || '')}, ${escapeHtml(item.opportunity.country || '')}</p>
  ` : item.itemType === 'course' && item.course ? `
    <p><b>${escapeHtml(item.course.title)}</b></p>
    <p class="label">${escapeHtml(item.course.provider_name || '')} • ${escapeHtml(item.course.region || '')}, ${escapeHtml(item.course.country || '')}</p>
  ` : `
    <p><b>${escapeHtml(title(item.itemType))} verification</b></p>
    <p class="label">${escapeHtml(item.ownerName)} ${item.ownerEmail ? '• ' + escapeHtml(item.ownerEmail) : ''}</p>
  `;

  return `
    <div class="job">
      <div>
        <h3>${escapeHtml(title(item.itemType))} • ${escapeHtml(item.reviewStatus)}</h3>
        ${details}
        <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">${item.reviewStatus === 'Pending' ? `<button class="primary" onclick="reviewVerification('${item.id}','Approved')">Approve</button><button class="secondary" onclick="reviewVerification('${item.id}','Rejected')">Reject</button>` : ''}</div>
      </div>
      <div class="fit" style="--score:${item.reviewStatus === 'Approved' ? 100 : item.reviewStatus === 'Rejected' ? 30 : 60}"><span>${item.reviewStatus === 'Approved' ? '✓' : item.reviewStatus === 'Rejected' ? '✕' : '…'}</span></div>
    </div>
  `;
}

function adminDash() {
  const pendingCount = state.verificationItems.filter(i => i.reviewStatus === 'Pending').length;
  return `
    ${metrics()}
    <div class="grid" style="margin-top:18px">
      <div class="card span-4"><div class="label">Pending verification items</div><div class="metric">${pendingCount}</div></div>
      <div class="card span-4"><div class="label">Approved items</div><div class="metric">${state.verificationItems.filter(i => i.reviewStatus === 'Approved').length}</div></div>
      <div class="card span-4"><div class="label">Rejected items</div><div class="metric">${state.verificationItems.filter(i => i.reviewStatus === 'Rejected').length}</div></div>
    </div>
    <div class="grid" style="margin-top:18px"><div class="card span-7"><div class="section-title"><h3>Verification queue</h3><button class="secondary" onclick="setView('verification')">Open queue</button></div><p class="label">Approve organisations, opportunities and courses from one place.</p></div><div class="card span-5"><h3>Platform governance</h3><p class="label">Verified partners, moderated opportunities, reviewed training providers and accountable admin decisions.</p></div></div>
  `;
}

function verification() {
  const pending = state.verificationItems.filter(i => i.reviewStatus === 'Pending');
  const reviewed = state.verificationItems.filter(i => i.reviewStatus !== 'Pending');
  return `<div class="grid"><div class="card span-12"><div class="section-title"><h3>Admin verification queue</h3><button class="secondary" onclick="refreshAdminQueue()">Refresh queue</button></div><div class="label" id="verificationMessage"></div><h4 style="margin-top:12px;">Pending items</h4>${pending.length ? pending.map(verificationCard).join('') : '<p class="label">No pending verification items.</p>'}<h4 style="margin-top:18px;">Reviewed items</h4>${reviewed.length ? reviewed.map(verificationCard).join('') : '<p class="label">No reviewed items yet.</p>'}</div></div>`;
}

window.refreshAdminQueue = async function() { await loadVerificationQueueFromSupabase(); render(); };

window.reviewVerification = async function(queueId, decision) {
  if (!isConfigured || !currentUser) return;
  const item = state.verificationItems.find(v => v.id === queueId);
  const msg = document.getElementById('verificationMessage');
  if (msg) msg.textContent = '';
  if (!item) { if (msg) msg.textContent = 'Verification item not found.'; return; }
  const approved = decision === 'Approved';
  const note = prompt(`Optional admin note for ${decision.toLowerCase()}:`, '') || '';
  if (['employer','institution'].includes(item.itemType)) {
    const { error } = await supabase.from('profiles').update({ verified: approved, updated_at: new Date().toISOString() }).eq('id', item.profileId);
    if (error) { if (msg) msg.textContent = `Failed to update profile verification: ${error.message}`; return; }
  }
  if (item.itemType === 'opportunity' && item.itemId) {
    const updates = { updated_at: new Date().toISOString() };
    updates.status = approved ? 'Verified' : 'Rejected';
    const { error } = await supabase.from('opportunities').update(updates).eq('id', item.itemId);
    if (error) { if (msg) msg.textContent = `Failed to update opportunity: ${error.message}`; return; }
  }
  if (item.itemType === 'course' && item.itemId) {
    const updates = { updated_at: new Date().toISOString() };
    updates.status = approved ? 'Verified' : 'Rejected';
    const { error } = await supabase.from('courses').update(updates).eq('id', item.itemId);
    if (error) { if (msg) msg.textContent = `Failed to update course: ${error.message}`; return; }
  }
  const { error: queueError } = await supabase.from('verification_queue').update({ review_status: approved ? 'Approved' : 'Rejected', reviewer_id: currentUser.id, review_notes: note, updated_at: new Date().toISOString() }).eq('id', queueId);
  if (queueError) { if (msg) msg.textContent = `Failed to update verification queue: ${queueError.message}`; return; }
  await loadJobsFromSupabase();
  await loadCoursesFromSupabase();
  await writeAuditLog('verification_' + decision.toLowerCase(), item.itemType, item.itemId || item.profileId, note);
  await loadVerificationQueueFromSupabase();
  await loadAuditLogsFromSupabase();
  alert(`✅ ${decision} successfully.`);
  render();
};


function auditLogs() {
  return `
    <div class="grid">
      <div class="card span-12">
        <div class="section-title"><h3>Audit logs</h3><button class="secondary" onclick="refreshAuditLogs()">Refresh logs</button></div>
        ${state.auditLogs.length ? state.auditLogs.map(log => `<div class="job"><div><h3>${escapeHtml(log.action || 'Activity')}</h3><p><b>${escapeHtml(log.entity_type || '')}</b>${log.entity_id ? ' • ' + escapeHtml(log.entity_id) : ''}</p><p class="label">${escapeHtml(log.details || '')}</p><p class="label">${escapeHtml(new Date(log.created_at).toLocaleString())}</p></div><div class="fit" style="--score:100"><span>Log</span></div></div>`).join('') : '<p class="label">No audit activity has been recorded yet.</p>'}
      </div>
    </div>
  `;
}

window.refreshAuditLogs = async function() { await loadAuditLogsFromSupabase(); render(); };

function skillsDemandBars() {
  const topSkills = skillCountsFromJobs().slice(0, 6);
  if (!topSkills.length) return '<p class="label">Demand signals will appear as verified opportunities are published.</p>';
  const maxCount = Math.max(...topSkills.map(([, count]) => count), 1);
  return topSkills.map(([skill, count]) => bar(skill, Math.max(18, Math.round((count / maxCount) * 100)))).join('');
}

function trainingGapPanel() {
  const gaps = trainingGapItems();
  if (!gaps.length) return '<p class="label">Current training catalogue covers the main skills requested by verified opportunities.</p>';
  return gaps.map(([skill, count]) => `<p><b>${escapeHtml(skill)}</b><br><span class="label">Requested in ${count} verified opportunity${count === 1 ? '' : 'ies'} with limited matching training coverage.</span></p>`).join('');
}

function careerPathwayPanel() {
  const pathways = careerPathways();
  if (!pathways.length) return '<p class="label">Career pathways will appear when opportunities and training offers are available.</p>';
  return pathways.map(item => `<p><b>${escapeHtml(item.job.title)}</b><br><span class="label">${item.matchedCourses.length ? 'Relevant training: ' + item.matchedCourses.map(c => escapeHtml(c.title)).join(', ') : 'Build skills in: ' + escapeHtml(item.job.skills || 'core role requirements')}</span></p>`).join('');
}

function insights() {
  return `
    <div class="grid">
      <div class="card span-6"><h3>Skills demand dashboard</h3>${skillsDemandBars()}</div>
      <div class="card span-6"><h3>Training gap insights</h3>${trainingGapPanel()}</div>
      <div class="card span-12"><h3>Career pathways</h3>${careerPathwayPanel()}</div>
    </div>
  `;
}

function about() {
  return `
    <div class="grid">
      <div class="card span-8">
        <div class="kicker">About Jobs4Youth</div>
        <h3 style="margin-top:8px;">A professional jobs, internships and skills platform for young people</h3>
        <p>Jobs4Youth is designed to connect young people to verified employment, internship, apprenticeship and training opportunities in a structured, trusted and accessible digital environment. The platform brings together youth, employers, training institutions and administrators in one coordinated ecosystem.</p>
        <p>Our goal is simple: reduce the gap between youth talent and real opportunities by making labour market information easier to access, easier to trust and easier to act on.</p>
        <div class="notice"><b>Why this matters:</b> many young people struggle to find credible vacancies, while employers and training providers struggle to reach the right candidates. Jobs4Youth exists to make that connection faster, safer and more transparent.</div>
      </div>
      <div class="card span-4">
        <h3>Who the platform serves</h3>
        <p><b>Youth job seekers</b><br><span class="label">Find opportunities matched to skills, education and location.</span></p>
        <p><b>Employers</b><br><span class="label">Publish vacancies and review candidate applications in one place.</span></p>
        <p><b>Training institutions</b><br><span class="label">Promote programmes that respond to real market demand.</span></p>
        <p><b>Administrators</b><br><span class="label">Strengthen trust through verification and moderation.</span></p>
      </div>
      <div class="card span-6">
        <h3>Core value proposition</h3>
        <ul>
          <li>Verified opportunity listings and moderation workflows</li>
          <li>Structured user profiles and cleaner data entry through drop-down fields</li>
          <li>Role-based dashboards for youth, employers, institutions and admin users</li>
          <li>Opportunity, training and application management in one place</li>
          <li>Labour market analytics and youth employment reporting</li>
        </ul>
      </div>
      <div class="card span-6">
        <h3>Professional standards</h3>
        <p>Jobs4Youth operates as a professional public service platform with structured forms, verification, responsible moderation, consistent data capture and clear governance.</p>
      </div>
    </div>
  `;
}

function privacy() {
  return trustPageShell('Privacy Policy', 'How Jobs4Youth handles personal information', `
    <p><b>Last updated:</b> June 2026</p>
    <p>Jobs4Youth is committed to protecting the privacy and security of all users. This Privacy Policy explains what information may be collected, how that information is used, and the steps taken to protect it.</p>
    <h4>Information we may collect</h4>
    <ul>
      <li>Name, email address and account role</li>
      <li>Country, region and profile information</li>
      <li>Education, skills, interests and employment preferences</li>
      <li>Organisation information for employers and training institutions</li>
      <li>Application and posting activity on the platform</li>
    </ul>
    <h4>How information is used</h4>
    <ul>
      <li>To create and manage user accounts</li>
      <li>To match youth with opportunities and training offers</li>
      <li>To support recruitment and course applications</li>
      <li>To improve the platform and generate aggregated insights</li>
      <li>To maintain quality, moderation and verification workflows</li>
    </ul>
    <h4>Information sharing</h4>
    <p>Jobs4Youth does not sell personal information. Information may be shared between applicants and employers, or between applicants and institutions, only where required to support legitimate platform functions. Information may also be disclosed when required by law.</p>
    <h4>Data protection</h4>
    <p>Reasonable technical and organisational measures are used to protect information from unauthorised access, disclosure, loss or misuse. Users are encouraged to keep passwords secure and report any suspicious activity promptly.</p>
    <h4>User choices and rights</h4>
    <p>Users may request review, correction or deletion of their information, subject to applicable legal and operational requirements.</p>
  `);
}

function terms() {
  return trustPageShell('Terms of Use', 'Rules for using Jobs4Youth responsibly', `
    <p>By accessing or using Jobs4Youth, users agree to use the platform lawfully, responsibly and in accordance with these Terms of Use.</p>
    <h4>User responsibilities</h4>
    <ul>
      <li>Provide accurate and up-to-date account information</li>
      <li>Maintain the confidentiality of login credentials</li>
      <li>Use the platform only for legitimate employment and training purposes</li>
      <li>Respect other users and avoid misleading or harmful behaviour</li>
    </ul>
    <h4>Prohibited conduct</h4>
    <ul>
      <li>Posting false, deceptive or fraudulent opportunities</li>
      <li>Impersonating individuals or organisations</li>
      <li>Uploading harmful content or attempting unauthorised access</li>
      <li>Using the platform for unlawful, abusive or misleading purposes</li>
    </ul>
    <h4>Employer and institution obligations</h4>
    <p>Employers and training institutions are responsible for ensuring that the opportunities, courses and organisation details they publish are accurate, lawful and professional. Jobs4Youth reserves the right to review, verify, approve, reject or remove content as needed.</p>
    <h4>No guaranteed outcomes</h4>
    <p>Jobs4Youth facilitates connections between users but does not guarantee job placement, training admission, interview selection or hiring outcomes.</p>
    <h4>Updates to these terms</h4>
    <p>These Terms may be updated periodically. Continued use of the platform after updates indicates acceptance of the revised terms.</p>
  `);
}

function contact() {
  return trustPageShell('Contact Jobs4Youth', 'Get support, share feedback or explore partnerships', `
    <p>Jobs4Youth welcomes feedback, technical support requests and partnership enquiries.</p>
    <h4>Contact categories</h4>
    <ul>
      <li>Technical support</li>
      <li>Employer support</li>
      <li>Training institution support</li>
      <li>Partnership and collaboration inquiries</li>
      <li>General questions and user feedback</li>
    </ul>
    <h4>Contact details</h4>
    <p><b>Email:</b> info@jobs4youth.org</p>
    <p><b>Support:</b> support@jobs4youth.org</p>
    <p><b>Partnerships:</b> partnerships@jobs4youth.org</p>
    <h4>Response approach</h4>
    <p>The platform team aims to respond to enquiries as promptly as possible, prioritising technical issues and safeguarding concerns.</p>
  `);
}

function bar(label, n) {
  return `<p><b>${escapeHtml(label)}</b></p><div class="chartbar"><div style="width:${n}%"></div></div><p class="label">${n}% relative demand signal</p>`;
}

function render() {
  renderShell();
  let c = '';
  if (state.view === 'about') c = about();
  else if (state.view === 'privacy') c = privacy();
  else if (state.view === 'terms') c = terms();
  else if (state.view === 'contact') c = contact();
  else if (state.role === 'youth') c = state.view === 'dashboard' ? youthDash() : state.view === 'opportunities' ? opportunities() : state.view === 'training' ? training() : profile();
  else if (state.role === 'employer') c = state.view === 'dashboard' ? employerDash() : state.view === 'post opportunity' ? postOpportunity() : state.view === 'candidates' ? candidates() : profile();
  else if (state.role === 'institution') c = state.view === 'dashboard' ? institutionDash() : state.view === 'post training' ? postTraining() : state.view === 'courses' ? courses() : profile();
  else if (state.role === 'admin') c = state.view === 'dashboard' ? adminDash() : state.view === 'verification' ? verification() : state.view === 'audit logs' ? auditLogs() : state.view === 'insights' ? insights() : state.view === 'about' ? about() : state.view === 'privacy' ? privacy() : state.view === 'terms' ? terms() : contact();
  document.getElementById('content').innerHTML = c;
}

function openAuthModal(mode = 'login') {
  authMode = mode;
  document.getElementById('authModal')?.classList.remove('hidden');
  updateAuthModal();
}

function closeAuthModal() {
  document.getElementById('authModal')?.classList.add('hidden');
  document.getElementById('authMessage').textContent = '';
  document.getElementById('authPassword').value = '';
}

function updateAuthModal() {
  const isSignup = authMode === 'signup';
  document.getElementById('authTitle').textContent = isSignup ? 'Create your Jobs4Youth account' : 'Sign in to Jobs4Youth';
  document.getElementById('authSubmitBtn').textContent = isSignup ? 'Create account' : 'Sign In';
  document.getElementById('fullNameWrap').style.display = isSignup ? 'block' : 'none';
  document.getElementById('roleWrap').style.display = isSignup ? 'block' : 'none';
  document.getElementById('tabLogin').classList.toggle('active', !isSignup);
  document.getElementById('tabSignup').classList.toggle('active', isSignup);
  document.getElementById('authMessage').textContent = '';
}

function showSignIn() { openAuthModal('login'); }

async function handleAuthSubmit() {
  if (!isConfigured) return alert('Add config.js with your Supabase URL and anon key first.');
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  const fullName = document.getElementById('authFullName').value.trim();
  const role = document.getElementById('authRole').value;
  const msg = document.getElementById('authMessage');
  msg.textContent = '';
  if (!email || !password) { msg.textContent = 'Please enter email and password.'; return; }

  let authResult;
  try {
    authResult = authMode === 'signup'
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, role } } })
      : await supabase.auth.signInWithPassword({ email, password });
  } catch (networkError) {
    console.error('Signup/signin network error:', networkError);
    msg.textContent = networkError?.message || networkError?.name || 'Network error while contacting Supabase.';
    return;
  }
  if (authResult.error) {
    console.error('Auth error full object:', authResult.error);
    msg.textContent = authResult.error?.message || authResult.error?.name || authResult.error?.status || JSON.stringify(authResult.error);
    return;
  }

  currentUser = authResult.data.user || authResult.data.session?.user || null;
  if (authMode === 'signup' && !authResult.data.session) {
    msg.textContent = 'Account created. Please check your email to confirm your account, then sign in.';
    return;
  }
  if (currentUser) {
    let profile = await ensureProfile(currentUser);
    if (profile && authMode === 'signup') {
      const safeRole = ['youth','employer','institution','admin'].includes((role || '').toLowerCase()) ? role.toLowerCase() : 'youth';
      const { data: updatedProfile, error: roleUpdateError } = await supabase.from('profiles').update({ full_name: fullName, role: safeRole }).eq('id', currentUser.id).select().single();
      if (!roleUpdateError && updatedProfile) profile = updatedProfile;
      await ensureVerificationRequest(profile, safeRole);
    }
    syncProfileToState(profile);
  }
  await loadJobsFromSupabase();
  await loadCoursesFromSupabase();
  await loadEmployersFromSupabase();
  await loadApplicationsFromSupabase();
  await loadVerificationQueueFromSupabase();
  await loadAuditLogsFromSupabase();
  closeAuthModal();
  state.view = 'dashboard';
  render();
}

async function handlePasswordReset() {
  if (!isConfigured) return alert('Add config.js with your Supabase URL and anon key first.');
  const email = document.getElementById('authEmail').value.trim();
  const msg = document.getElementById('authMessage');
  msg.textContent = '';
  if (!email) { msg.textContent = 'Enter your email first, then click reset password.'; return; }
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) { msg.textContent = error.message; return; }
  msg.textContent = 'Password reset email sent. Check your inbox.';
}

async function signOut() {
  if (isConfigured && supabase) await supabase.auth.signOut();
  currentUser = null;
  state = structuredClone(initialState);
  state.view = 'about';
  render();
  alert('Signed out.');
}

window.saveProfile = async function () {
  if (!isConfigured) return alert('Supabase not connected');
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return alert('Please sign in first.');
  const updates = {
    full_name: document.getElementById('profileName')?.value || '',
    country: document.getElementById('profileCountry')?.value || '',
    region: document.getElementById('profileRegion')?.value || '',
    education: document.getElementById('profileEducation')?.value || '',
    availability: document.getElementById('profileAvailability')?.value || '',
    experience_level: document.getElementById('profileExperience')?.value || '',
    skills: document.getElementById('profileSkills')?.value || '',
    interests: document.getElementById('profileInterests')?.value || '',
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
  if (error) return alert(`❌ Failed to save profile: ${error.message}`);
  state.profile = { ...state.profile, name: updates.full_name, country: updates.country, region: updates.region, education: updates.education, availability: updates.availability, experience: updates.experience_level, skills: updates.skills, interests: updates.interests };
  await writeAuditLog('profile_saved', 'profile', user.id, 'Youth profile updated');
  alert('✅ Profile saved successfully!');
  render();
};

window.saveOrganizationProfile = async function () {
  if (!isConfigured) return alert('Supabase not connected');
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return alert('Please sign in first.');
  const updates = {
    full_name: document.getElementById('orgProfileName')?.value || '',
    organization_name: document.getElementById('orgName')?.value || '',
    sector: document.getElementById('orgSector')?.value || '',
    country: document.getElementById('orgCountry')?.value || '',
    region: document.getElementById('orgRegion')?.value || '',
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
  if (error) return alert(`❌ Failed to save organisation profile: ${error.message}`);
  state.profile = { ...state.profile, name: updates.full_name, organizationName: updates.organization_name, sector: updates.sector, country: updates.country, region: updates.region };
  await ensureVerificationRequest({ id: user.id }, state.role);
  await writeAuditLog('organisation_profile_saved', 'profile', user.id, 'Organisation profile updated');
  await loadEmployersFromSupabase();
  alert('✅ Organisation profile saved successfully!');
  render();
};

async function initializeApp() {
  state.view = 'about';
  if (isConfigured && supabase) {
    const { data: sessionData, error } = await supabase.auth.getSession();
    if (!error && sessionData?.session?.user) {
      currentUser = sessionData.session.user;
      const profile = await ensureProfile(currentUser);
      syncProfileToState(profile);
      state.view = 'dashboard';
    }
    await loadJobsFromSupabase();
    await loadCoursesFromSupabase();
    await loadEmployersFromSupabase();
    await loadApplicationsFromSupabase();
    await loadVerificationQueueFromSupabase();
    await loadAuditLogsFromSupabase();
    supabase.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || null;
      if (currentUser) {
        const profile = await ensureProfile(currentUser);
        syncProfileToState(profile);
        state.view = 'dashboard';
      } else {
        state = structuredClone(initialState);
        state.view = 'about';
      }
      await loadJobsFromSupabase();
      await loadCoursesFromSupabase();
      await loadEmployersFromSupabase();
      await loadApplicationsFromSupabase();
      await loadVerificationQueueFromSupabase();
      await loadAuditLogsFromSupabase();
      render();
    });
  }
  render();
}

document.getElementById('btnSignIn').addEventListener('click', showSignIn);
document.getElementById('btnSignOut').addEventListener('click', signOut);
document.getElementById('closeAuthModal').addEventListener('click', closeAuthModal);
document.getElementById('authSubmitBtn').addEventListener('click', handleAuthSubmit);
document.getElementById('btnResetPassword').addEventListener('click', handlePasswordReset);
document.getElementById('tabLogin').addEventListener('click', () => { authMode = 'login'; updateAuthModal(); });
document.getElementById('tabSignup').addEventListener('click', () => { authMode = 'signup'; updateAuthModal(); });

initializeApp();
