
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
  courseTypes: ['Short Course','Certificate','Diploma','Degree Program','Bootcamp'],
  verificationDocumentTypes: ['Business Registration Certificate','Tax Compliance Certificate','Accreditation or Licence','Organisation Profile','Authorisation Letter','Other Supporting Document'],
  genderOptions: ['Prefer not to say','Woman','Man','Non-binary','Other']
};

const demoState = {
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
    gender: 'Woman',
    organizationName: '',
    sector: '',
    verified: false
  },
  jobs: [],
  courses: [],
  employers: [],
  applications: [],
  savedOpportunities: [],
  savedCourses: [],
  employerCandidates: [],
  verificationItems: [],
  verificationDocuments: [],
  notifications: [],
  signalLayer: {
    skillDemand: [],
    skillSupply: [],
    skillGap: [],
    trainingGap: [],
    employerBottlenecks: [],
    underservedSegments: [],
    countrySignals: []
  }
};

let state = structuredClone(demoState);
let supabase = null;
let isConfigured = false;
let currentUser = null;
let authMode = 'login';
let browseFilters = {
  jobs: { keyword: '', country: '', region: '', type: '', education: '', experience: '' },
  courses: { keyword: '', country: '', region: '', mode: '' }
};

let selectedOpportunityId = null;
let selectedCourseId = null;
let applicationWizard = {
  opportunityId: null,
  draftId: null,
  step: 1,
  readinessScore: 0,
  motivationNote: '',
  screeningAnswers: {},
  documentState: { cvReady: false, certificateReady: false, referencesReady: false }
};

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
  return (s || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderOptions(options, selected = '', placeholder = 'Select') {
  const first = `<option value="">${escapeHtml(placeholder)}</option>`;
  const items = options.map(opt => `<option value="${escapeHtml(opt)}" ${selected === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('');
  return first + items;
}

function matchesText(haystack, needle) {
  return String(haystack || '').toLowerCase().includes(String(needle || '').toLowerCase());
}
function filteredJobs() {
  const f = browseFilters.jobs;
  return [...state.jobs]
    .filter(job => {
      if (f.keyword) {
        const blob = [job.title, job.org, job.desc, job.skills, job.region, job.country, job.type].join(' ');
        if (!matchesText(blob, f.keyword)) return false;
      }
      if (f.country && job.country !== f.country) return false;
      if (f.region && !matchesText(job.region, f.region)) return false;
      if (f.type && job.type !== f.type) return false;
      if (f.education && job.education !== f.education) return false;
      if (f.experience && job.experience !== f.experience) return false;
      return true;
    })
    .sort((a, b) => matchScore(b) - matchScore(a));
}
function filteredCourses() {
  const f = browseFilters.courses;
  return [...state.courses]
    .filter(course => {
      if (f.keyword) {
        const blob = [course.title, course.provider, course.skills, course.region, course.country, course.mode, course.duration].join(' ');
        if (!matchesText(blob, f.keyword)) return false;
      }
      if (f.country && course.country !== f.country) return false;
      if (f.region && !matchesText(course.region, f.region)) return false;
      if (f.mode && course.mode !== f.mode) return false;
      return true;
    });
}
window.setOpportunityFilter = function(field, value) {
  browseFilters.jobs[field] = value;
  render();
};
window.clearOpportunityFilters = function() {
  browseFilters.jobs = { keyword: '', country: '', region: '', type: '', education: '', experience: '' };
  render();
};
window.setCourseFilter = function(field, value) {
  browseFilters.courses[field] = value;
  render();
};
window.clearCourseFilters = function() {
  browseFilters.courses = { keyword: '', country: '', region: '', mode: '' };
  render();
};

function sanitizeFileName(name) {
  return String(name || 'document').replace(/[^a-zA-Z0-9._-]+/g, '-');
}
function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}
function documentTypeBadge(value) {
  return `<span class="pill">${escapeHtml(value || 'Supporting document')}</span>`;
}
function latestUnreadCount() {
  return (state.notifications || []).filter(item => !item.isRead).length;
}
function latestVerificationNotification() {
  return [...(state.notifications || [])]
    .filter(item => String(item.notificationType || '').startsWith('verification_'))
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null;
}
function notificationCard(item) {
  return `
    <div class="notification-card ${item.isRead ? '' : 'notification-card-unread'}">
      <div class="section-title">
        <div>
          <h4>${escapeHtml(item.title || 'Notification')}</h4>
          <p class="label">${escapeHtml(item.body || '')}</p>
        </div>
        <div class="job-badges">
          ${statusBadge(item.isRead ? 'Read' : 'Unread')}
          ${item.createdAt ? `<span class="pill">${escapeHtml(new Date(item.createdAt).toLocaleString())}</span>` : ''}
        </div>
      </div>
      <div class="results-meta">
        <span class="pill">${escapeHtml(title(String(item.notificationType || 'platform update').replace(/_/g, ' ')))}</span>
        ${item.emailStatus ? `<span class="pill">Email ${escapeHtml(item.emailStatus)}</span>` : ''}
      </div>
      <div class="hero-actions" style="margin-top:12px;">
        ${!item.isRead ? `<button class="secondary" onclick="markNotificationRead('${escapeHtml(item.id)}')">Mark as read</button>` : ''}
      </div>
    </div>
  `;
}
function documentReviewCard(doc, adminMode = false) {
  return `
    <div class="document-card ${doc.reviewStatus === 'Approved' ? 'document-card-approved' : doc.reviewStatus === 'Rejected' ? 'document-card-rejected' : ''}">
      <div class="document-card-head">
        <div>
          <h4>${escapeHtml(doc.fileName || 'Uploaded document')}</h4>
          <div class="results-meta">
            ${documentTypeBadge(doc.documentType)}
            <span class="pill">${escapeHtml(doc.mimeType || 'Document')}</span>
            <span class="pill">${escapeHtml(formatBytes(doc.fileSize))}</span>
            ${doc.createdAt ? `<span class="pill">Uploaded ${escapeHtml(new Date(doc.createdAt).toLocaleDateString())}</span>` : ''}
          </div>
        </div>
        <div class="job-badges">${statusBadge(doc.reviewStatus || 'Pending')}</div>
      </div>
      ${doc.adminNotes ? `<div class="support-admin-note"><b>Admin note:</b> ${escapeHtml(doc.adminNotes)}</div>` : ''}
      <div class="document-actions">
        <button class="secondary" onclick="openVerificationDocument('${escapeHtml(doc.storagePath)}')">Open document</button>
        ${adminMode ? `<button class="primary" onclick="updateVerificationDocumentStatus('${escapeHtml(doc.id)}','Approved')">Approve document</button><button class="secondary" onclick="updateVerificationDocumentStatus('${escapeHtml(doc.id)}','Rejected')">Reject document</button>` : ''}
      </div>
    </div>
  `;
}
function documentUploadGuidance(role) {
  if (role === 'institution') return 'Upload accreditation, registration, operating licence, or another institution verification document so admins can review your institution more professionally.';
  return 'Upload registration, tax, authorisation, or another employer verification document to support admin review and build public trust.';
}
async function enqueuePlatformNotification({ userId, actorId, recipientEmail, title, body, notificationType, relatedEntityType = null, relatedEntityId = null }) {
  if (!isConfigured || !supabase || !userId || !title || !body) return { ok: false };
  const { error: notificationError } = await supabase.from('notifications').insert([{
    user_id: userId,
    actor_id: actorId || currentUser?.id || null,
    title,
    body,
    notification_type: notificationType || 'platform_update',
    related_entity_type: relatedEntityType,
    related_entity_id: relatedEntityId,
    is_read: false
  }]);
  if (notificationError) console.error('Notification insert error:', notificationError);
  if (recipientEmail) {
    const { error: emailError } = await supabase.from('email_queue').insert([{
      actor_id: actorId || currentUser?.id || null,
      user_id: userId,
      recipient_email: recipientEmail,
      subject: title,
      body,
      email_type: notificationType || 'platform_update',
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      queue_status: 'Queued'
    }]);
    if (emailError) console.error('Email queue insert error:', emailError);
  }
  return { ok: true };
}
function filtersPanel(titleText, bodyText, innerHtml, clearFnName) {
  return `
    <div class="filters-panel">
      <div class="section-title">
        <div>
          <h3>${escapeHtml(titleText)}</h3>
          <p class="label">${escapeHtml(bodyText)}</p>
        </div>
        <button class="secondary" onclick="${escapeHtml(clearFnName)}()">Clear filters</button>
      </div>
      <div class="filters-grid">${innerHtml}</div>
    </div>
  `;
}
function completenessFromFields(values) {
  const total = values.length || 1;
  const filled = values.filter(v => String(v || '').trim()).length;
  return Math.round((filled / total) * 100);
}
function youthProfileCompletion() {
  return completenessFromFields([
    state.profile.name,
    state.profile.country,
    state.profile.region,
    state.profile.education,
    state.profile.availability,
    state.profile.experience,
    state.profile.skills,
    state.profile.interests
  ]);
}
function organisationProfileCompletion() {
  return completenessFromFields([
    state.profile.name,
    state.profile.organizationName,
    state.profile.sector,
    state.profile.country,
    state.profile.region
  ]);
}
function onboardingMessage() {
  if (!currentUser) {
    return {
      title: 'Create an account to unlock the full platform',
      text: 'Browse public listings freely, then create an account to apply, publish opportunities or manage training offers.',
      action: `<button class="secondary" onclick="openSignup()">Create account</button>`
    };
  }
  if (state.role === 'youth') {
    const completion = youthProfileCompletion();
    if (completion < 75) return {
      title: 'Complete your youth profile to improve matching',
      text: `Your current profile is ${completion}% complete. Add skills, interests, education and location details to improve relevance and trust.`,
      action: `<button class="secondary" onclick="setView('profile')">Complete profile</button>`
    };
    if (!state.applications.length) return {
      title: 'You are ready to apply',
      text: 'Your profile now supports stronger match results. Explore verified opportunities and begin submitting applications.',
      action: `<button class="secondary" onclick="setView('opportunities')">Browse opportunities</button>`
    };
    return {
      title: 'Stay active in the marketplace',
      text: 'Keep your profile updated and continue exploring training pathways that strengthen your employability.',
      action: `<button class="secondary" onclick="setView('training')">Browse training</button>`
    };
  }
  if (state.role === 'employer') {
    const completion = organisationProfileCompletion();
    if (!state.profile.organizationName || completion < 80) return {
      title: 'Complete your organisation profile first',
      text: `Your employer profile is ${completion}% complete. Add organisation details before posting to present a stronger public facing profile.`,
      action: `<button class="secondary" onclick="setView('profile')">Complete profile</button>`
    };
    if (!state.profile.verified) return {
      title: 'Verification improves public trust',
      text: 'Your organisation can still save content, but verified organisations present stronger public trust signals to jobseekers.',
      action: `<button class="secondary" onclick="setView('profile')">Review organisation profile</button>`
    };
    return {
      title: 'Your employer profile is public ready',
      text: 'Continue posting moderated opportunities and reviewing fit-for-role candidates through the platform.',
      action: `<button class="secondary" onclick="setView('post opportunity')">Post opportunity</button>`
    };
  }
  if (state.role === 'institution') {
    const completion = organisationProfileCompletion();
    if (!state.profile.organizationName || completion < 80) return {
      title: 'Strengthen your institution profile',
      text: `Your institution profile is ${completion}% complete. Add provider details to present training offers more professionally.`,
      action: `<button class="secondary" onclick="setView('profile')">Complete profile</button>`
    };
    if (!state.profile.verified) return {
      title: 'Verification helps learners trust your courses',
      text: 'Verified provider status strengthens confidence in public training listings and supports a more professional learning catalogue.',
      action: `<button class="secondary" onclick="setView('profile')">Review institution profile</button>`
    };
    return {
      title: 'Your training catalogue is ready to grow',
      text: 'Publish additional courses and continue aligning content with demand signals shown on the platform.',
      action: `<button class="secondary" onclick="setView('post training')">Post training</button>`
    };
  }
  return {
    title: 'Moderate and grow public trust',
    text: 'Use admin workflows to keep opportunities, organisations and training offers credible and visible to the public.',
    action: `<button class="secondary" onclick="setView('verification')">Open verification queue</button>`
  };
}
function onboardingPanel() {
  const info = onboardingMessage();
  return `
    <div class="onboarding-panel">
      <div>
        <div class="kicker">Next best action</div>
        <h3>${escapeHtml(info.title)}</h3>
        <p class="label">${escapeHtml(info.text)}</p>
      </div>
      <div class="hero-actions">${info.action}</div>
    </div>
  `;
}
function completionCard(titleText, percent, bodyText, buttonLabel) {
  return `
    <div class="completion-card">
      <div class="section-title">
        <div>
          <h3>${escapeHtml(titleText)}</h3>
          <p class="label">${escapeHtml(bodyText)}</p>
        </div>
        <span class="status-badge ${percent >= 80 ? 'status-verified' : percent >= 50 ? 'status-pending' : 'status-rejected'}">${percent}% complete</span>
      </div>
      <div class="chartbar"><div style="width:${percent}%"></div></div>
      <div class="hero-actions" style="margin-top:12px;">
        <button class="secondary" onclick="setView('profile')">${escapeHtml(buttonLabel)}</button>
      </div>
    </div>
  `;
}


function matchScore(job) {
  const ps = new Set(words([
    state.profile.skills,
    state.profile.interests,
    state.profile.region,
    state.profile.country,
    state.profile.education
  ].join(' ')));
  const js = words([
    job.skills,
    job.region,
    job.country,
    job.type,
    job.experience,
    job.education
  ].join(' '));
  let hit = 0;
  js.forEach(w => { if (ps.has(w)) hit += 1; });
  let base = Math.round((hit / Math.max(js.length, 1)) * 70) + 20;
  if ((job.region || '') === (state.profile.region || '')) base += 10;
  if ((job.country || '') === (state.profile.country || '')) base += 6;
  return Math.min(98, base);
}

function splitSkillsSimple(value) {
  return [...new Set(String(value || '').split(/[;,\n]/).map(item => item.trim()).filter(Boolean))];
}
function deriveSignalLayerLocally() {
  const skillDemandMap = {};
  const skillSupplyMap = {};
  const trainingSupplyMap = {};
  const countryMap = {};
  const underservedMap = {};
  const employerBottlenecks = [];
  (state.jobs || []).filter(job => (job.status || '') === 'Verified').forEach(job => {
    const country = job.country || 'Unspecified';
    const region = job.region || 'Unspecified';
    countryMap[country] = countryMap[country] || { country, youthProfiles: 0, employers: 0, institutions: 0, verifiedOpportunities: 0, verifiedCourses: 0, applicationsTotal: 0 };
    countryMap[country].verifiedOpportunities += 1;
    splitSkillsSimple(job.skills).forEach(skill => {
      const key = `${country}|||${region}|||${skill.toLowerCase()}`;
      skillDemandMap[key] = skillDemandMap[key] || { country, region, skillName: skill, opportunitiesCount: 0, skillMentions: 0 };
      skillDemandMap[key].skillMentions += 1;
      skillDemandMap[key].opportunitiesCount += 1;
    });
    const applicationsReceived = (state.applications || []).filter(a => typeof a === 'object' ? a.opportunityId === job.id : a === job.id).length;
    employerBottlenecks.push({
      opportunityTitle: job.title,
      organizationName: job.org,
      country,
      region,
      applicationsReceived,
      bottleneckSignal: applicationsReceived === 0 ? 'Low Applications' : applicationsReceived <= 2 ? 'Thin Pipeline' : 'Active Pipeline'
    });
  });
  (state.courses || []).filter(course => (course.status || '') === 'Verified').forEach(course => {
    const country = course.country || 'Unspecified';
    const region = course.region || 'Unspecified';
    countryMap[country] = countryMap[country] || { country, youthProfiles: 0, employers: 0, institutions: 0, verifiedOpportunities: 0, verifiedCourses: 0, applicationsTotal: 0 };
    countryMap[country].verifiedCourses += 1;
    splitSkillsSimple(course.skills).forEach(skill => {
      const key = `${country}|||${region}|||${skill.toLowerCase()}`;
      trainingSupplyMap[key] = trainingSupplyMap[key] || { country, region, skillName: skill, verifiedCoursesCoveringSkill: 0 };
      trainingSupplyMap[key].verifiedCoursesCoveringSkill += 1;
    });
  });
  (state.employerCandidates || []).forEach(candidate => {
    const country = candidate.country || 'Unspecified';
    countryMap[country] = countryMap[country] || { country, youthProfiles: 0, employers: 0, institutions: 0, verifiedOpportunities: 0, verifiedCourses: 0, applicationsTotal: 0 };
    countryMap[country].applicationsTotal += 1;
  });
  const profile = state.profile || {};
  if (profile.country) {
    const country = profile.country || 'Unspecified';
    countryMap[country] = countryMap[country] || { country, youthProfiles: 0, employers: 0, institutions: 0, verifiedOpportunities: 0, verifiedCourses: 0, applicationsTotal: 0 };
    if (state.role === 'youth') countryMap[country].youthProfiles += 1;
    if (state.role === 'employer') countryMap[country].employers += 1;
    if (state.role === 'institution') countryMap[country].institutions += 1;
  }
  splitSkillsSimple(profile.skills).forEach(skill => {
    const country = profile.country || 'Unspecified';
    const region = profile.region || 'Unspecified';
    const key = `${country}|||${region}|||${skill.toLowerCase()}`;
    skillSupplyMap[key] = skillSupplyMap[key] || { country, region, skillName: skill, youthWithSkill: 0 };
    skillSupplyMap[key].youthWithSkill += 1;
  });
  if (state.role === 'youth') {
    const key = `${profile.country || 'Unspecified'}|||${profile.region || 'Unspecified'}|||${profile.education || 'Unspecified'}|||${profile.experience || 'Unspecified'}`;
    underservedMap[key] = underservedMap[key] || {
      country: profile.country || 'Unspecified',
      region: profile.region || 'Unspecified',
      educationLevel: profile.education || 'Unspecified',
      experienceLevel: profile.experience || 'Unspecified',
      youthProfiles: 0,
      profilesWithoutSkills: 0,
      profilesWithoutInterests: 0,
      profilesWithoutCareerGoal: 0,
      averageProfileStrength: 0
    };
    underservedMap[key].youthProfiles += 1;
    if (!String(profile.skills || '').trim()) underservedMap[key].profilesWithoutSkills += 1;
    if (!String(profile.interests || '').trim()) underservedMap[key].profilesWithoutInterests += 1;
    if (!String(profile.careerGoal || '').trim()) underservedMap[key].profilesWithoutCareerGoal += 1;
    const strength = [profile.skills, profile.interests, profile.education, profile.country, profile.region].filter(v => String(v || '').trim()).length / 5 * 100;
    underservedMap[key].averageProfileStrength = strength;
  }
  const skillDemand = Object.values(skillDemandMap).sort((a,b) => b.opportunitiesCount - a.opportunitiesCount);
  const skillSupply = Object.values(skillSupplyMap).sort((a,b) => b.youthWithSkill - a.youthWithSkill);
  const trainingGap = Object.values(skillDemandMap).map(item => {
    const key = `${item.country}|||${item.region}|||${item.skillName.toLowerCase()}`;
    const supply = trainingSupplyMap[key]?.verifiedCoursesCoveringSkill || 0;
    return { ...item, verifiedCoursesCoveringSkill: supply, trainingGapCount: Math.max(item.opportunitiesCount - supply, 0) };
  }).sort((a,b) => b.trainingGapCount - a.trainingGapCount);
  const skillGap = Object.values(skillDemandMap).map(item => {
    const key = `${item.country}|||${item.region}|||${item.skillName.toLowerCase()}`;
    const supply = skillSupplyMap[key]?.youthWithSkill || 0;
    return { ...item, youthSupply: supply, gapCount: Math.max(item.opportunitiesCount - supply, 0) };
  }).sort((a,b) => b.gapCount - a.gapCount);
  state.signalLayer = {
    skillDemand,
    skillSupply,
    skillGap,
    trainingGap,
    employerBottlenecks: employerBottlenecks.sort((a,b) => a.applicationsReceived - b.applicationsReceived),
    underservedSegments: Object.values(underservedMap).sort((a,b) => a.averageProfileStrength - b.averageProfileStrength),
    countrySignals: Object.values(countryMap).sort((a,b) => b.verifiedOpportunities - a.verifiedOpportunities)
  };
}
async function loadSignalLayerFromSupabase() {
  state.signalLayer = { skillDemand: [], skillSupply: [], skillGap: [], trainingGap: [], employerBottlenecks: [], underservedSegments: [], countrySignals: [] };
  if (!isConfigured || !supabase || !currentUser) {
    deriveSignalLayerLocally();
    return;
  }
  try {
    const [dem, sup, gap, tgap, bottlenecks, underserved, countrySignals] = await Promise.all([
      supabase.from('v_skill_demand_signals').select('*').order('opportunities_count', { ascending: false }).limit(20),
      supabase.from('v_skill_supply_signals').select('*').order('youth_with_skill', { ascending: false }).limit(20),
      supabase.from('v_skill_gap_signals').select('*').order('gap_count', { ascending: false }).limit(20),
      supabase.from('v_training_gap_signals').select('*').order('training_gap_count', { ascending: false }).limit(20),
      supabase.from('v_employer_hiring_bottlenecks').select('*').order('applications_received', { ascending: true }).limit(12),
      supabase.from('v_underserved_youth_segments').select('*').order('average_profile_strength', { ascending: true }).limit(12),
      supabase.from('v_country_activity_signals').select('*').order('verified_opportunities', { ascending: false }).limit(20)
    ]);
    state.signalLayer = {
      skillDemand: dem.error ? [] : (dem.data || []).map(item => ({ country: item.country, region: item.region, skillName: item.skill_name, opportunitiesCount: item.opportunities_count, skillMentions: item.skill_mentions })),
      skillSupply: sup.error ? [] : (sup.data || []).map(item => ({ country: item.country, region: item.region, skillName: item.skill_name, youthWithSkill: item.youth_with_skill })),
      skillGap: gap.error ? [] : (gap.data || []).map(item => ({ country: item.country, region: item.region, skillName: item.skill_name, demandOpportunities: item.demand_opportunities, youthSupply: item.youth_supply, gapCount: item.gap_count, gapPercent: item.gap_percent })),
      trainingGap: tgap.error ? [] : (tgap.data || []).map(item => ({ country: item.country, region: item.region, skillName: item.skill_name, demandOpportunities: item.demand_opportunities, verifiedCoursesCoveringSkill: item.verified_courses_covering_skill, trainingGapCount: item.training_gap_count })),
      employerBottlenecks: bottlenecks.error ? [] : (bottlenecks.data || []).map(item => ({ opportunityTitle: item.title, organizationName: item.organization_name, country: item.country, region: item.region, applicationsReceived: item.applications_received, bottleneckSignal: item.bottleneck_signal, pipelineAgeDays: item.pipeline_age_days })),
      underservedSegments: underserved.error ? [] : (underserved.data || []).map(item => ({ country: item.country, region: item.region, educationLevel: item.education_level, experienceLevel: item.experience_level, youthProfiles: item.youth_profiles, profilesWithoutSkills: item.profiles_without_skills, profilesWithoutInterests: item.profiles_without_interests, profilesWithoutCareerGoal: item.profiles_without_career_goal, averageProfileStrength: item.average_profile_strength })),
      countrySignals: countrySignals.error ? [] : (countrySignals.data || []).map(item => ({ country: item.country, youthProfiles: item.youth_profiles, employers: item.employers, institutions: item.institutions, verifiedOpportunities: item.verified_opportunities, verifiedCourses: item.verified_courses, applicationsTotal: item.applications_total }))
    };
  } catch (error) {
    console.warn('Signal layer load warning:', error);
    deriveSignalLayerLocally();
  }
}
function signalTopItems(list, count = 5) {
  return [...(list || [])].slice(0, count);
}
function signalMetricCard(titleText, value, bodyText) {
  return `<div class="card span-3"><div class="label">${escapeHtml(titleText)}</div><div class="metric">${escapeHtml(String(value))}</div><div class="label">${escapeHtml(bodyText)}</div></div>`;
}
function signalListCard(titleText, items, renderItem, emptyText = 'No signal data available yet.') {
  return `
    <div class="card span-6">
      <div class="section-title"><h3>${escapeHtml(titleText)}</h3><span class="pill pill-trust">Live signal</span></div>
      ${items.length ? `<div class="mini-grid single-column">${items.map(renderItem).join('')}</div>` : `<div class="empty-card"><h4>No signal data yet</h4><p class="label">${escapeHtml(emptyText)}</p></div>`}
    </div>
  `;
}


function navItems() {
  if (!currentUser) return ['home', 'opportunities', 'training', 'champions', 'universities', 'impact', 'about', 'privacy', 'terms', 'contact'];
  if (state.role === 'youth') return ['dashboard', 'opportunities', 'training', 'shortlist', 'champions', 'impact', 'profile', 'notifications', 'about', 'privacy', 'terms', 'contact'];
  if (state.role === 'employer') return ['dashboard', 'post opportunity', 'candidates', 'universities', 'impact', 'profile', 'notifications', 'about', 'privacy', 'terms', 'contact'];
  if (state.role === 'institution') return ['dashboard', 'post training', 'courses', 'universities', 'impact', 'profile', 'notifications', 'about', 'privacy', 'terms', 'contact'];
  return ['dashboard', 'verification', 'insights', 'impact', 'launch toolkit', 'notifications', 'about', 'privacy', 'terms', 'contact'];
}



function desc() {
  if (state.view === 'home') return 'Discover verified youth opportunities, training pathways and trusted partners across Africa.';
  if (state.view === 'about') return 'Learn what Jobs4Youth is, who it serves, and why it exists.';
  if (state.view === 'privacy') return 'Understand how Jobs4Youth collects, uses and protects user information.';
  if (state.view === 'terms') return 'Review the rules, responsibilities and conditions for using Jobs4Youth.';
  if (state.view === 'contact') return 'Get in touch for support, partnerships and platform enquiries.';
  if (state.view === 'impact') return 'Track youth reach, young women inclusion, applications, verified opportunities, skills gaps and country intelligence.';
  if (state.view === 'champions') return 'Invite youth, track Champion progress and grow the Jobs4Youth movement.';
  if (state.view === 'universities') return 'Onboard universities, TVETs and career offices into Jobs4Youth.';
  if (state.view === 'launch toolkit') return 'Access partner pitch wording, concept note summary and social campaign copy.';
  if (state.view === 'notifications') return 'Track platform alerts, queued email notifications and verification decision messages in one place.';
  if (state.view === 'shortlist') return 'Review saved opportunities and training before deciding what to apply for.';
  if (state.view === 'opportunity detail') return 'Review the full opportunity details before saving or starting a guided application.';
  if (state.view === 'application wizard') return 'Complete a guided, step-by-step application before final submission.';
  if (state.role === 'youth') return 'Find relevant jobs, internships and training matched to your skills and goals.';
  if (state.role === 'employer') return 'Post opportunities, review candidates, upload verification documents and receive decision messages professionally.';
  if (state.role === 'institution') return 'Publish courses, upload verification documents and receive clear verification and moderation messaging.';
  return 'Verify partners, monitor activity and generate labour market intelligence.';
}


function setView(v) {
  state.view = v;
  render();
}

function setRole(r) {
  if (currentUser) return;
  state.role = r;
  state.view = r === 'admin' ? 'dashboard' : 'home';
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
    gender: profile.gender || '',
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
  let profileMap = {}, oppMap = {}, courseMap = {}, documentMap = {};
  if (profileIds.length) {
    const { data } = await supabase.from('profiles').select('id, full_name, email, role, organization_name, country, region, verified').in('id', profileIds);
    profileMap = Object.fromEntries((data || []).map(p => [p.id, p]));
    const { data: docs, error: docsError } = await supabase.from('verification_documents').select('*').in('profile_id', profileIds).order('created_at', { ascending: false });
    if (!docsError) {
      documentMap = (docs || []).reduce((acc, doc) => {
        const item = {
          id: doc.id,
          profileId: doc.profile_id,
          fileName: doc.file_name || 'Document',
          storagePath: doc.storage_path || '',
          mimeType: doc.mime_type || '',
          fileSize: doc.file_size || 0,
          documentType: doc.document_type || 'Other Supporting Document',
          reviewStatus: doc.review_status || 'Pending',
          adminNotes: doc.admin_notes || '',
          createdAt: doc.created_at || null,
          updatedAt: doc.updated_at || null
        };
        acc[doc.profile_id] = acc[doc.profile_id] || [];
        acc[doc.profile_id].push(item);
        return acc;
      }, {});
    }
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
    documents: documentMap[item.profile_id] || [],
    opportunity: item.item_type === 'opportunity' ? oppMap[item.item_id] || null : null,
    course: item.item_type === 'course' ? courseMap[item.item_id] || null : null
  }));
}


async function loadVerificationDocumentsFromSupabase() {
  state.verificationDocuments = [];
  if (!isConfigured || !currentUser || !['employer','institution','admin'].includes(state.role)) return;
  let query = supabase.from('verification_documents').select('*').order('created_at', { ascending: false });
  if (state.role !== 'admin') query = query.eq('profile_id', currentUser.id);
  const { data, error } = await query;
  if (error) {
    console.error('Error loading verification documents:', error);
    return;
  }
  state.verificationDocuments = (data || []).map(doc => ({
    id: doc.id,
    profileId: doc.profile_id,
    fileName: doc.file_name || 'Document',
    storagePath: doc.storage_path || '',
    mimeType: doc.mime_type || '',
    fileSize: doc.file_size || 0,
    documentType: doc.document_type || 'Other Supporting Document',
    reviewStatus: doc.review_status || 'Pending',
    adminNotes: doc.admin_notes || '',
    createdAt: doc.created_at || null,
    updatedAt: doc.updated_at || null
  }));
}

async function loadNotificationsFromSupabase() {
  state.notifications = [];
  if (!isConfigured || !currentUser) return;
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, actor_id, title, body, notification_type, related_entity_type, related_entity_id, is_read, created_at')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error loading notifications:', error);
    return;
  }
  let emailStatusMap = {};
  const { data: emails, error: emailError } = await supabase
    .from('email_queue')
    .select('related_entity_type, related_entity_id, queue_status, created_at')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });
  if (!emailError) {
    emailStatusMap = (emails || []).reduce((acc, item) => {
      const key = `${item.related_entity_type || 'platform'}:${item.related_entity_id || item.created_at}`;
      acc[key] = item.queue_status || 'Queued';
      return acc;
    }, {});
  }
  state.notifications = (data || []).map(item => ({
    id: item.id,
    userId: item.user_id,
    actorId: item.actor_id,
    title: item.title || 'Notification',
    body: item.body || '',
    notificationType: item.notification_type || 'platform_update',
    relatedEntityType: item.related_entity_type || null,
    relatedEntityId: item.related_entity_id || null,
    isRead: !!item.is_read,
    createdAt: item.created_at || null,
    emailStatus: emailStatusMap[`${item.related_entity_type || 'platform'}:${item.related_entity_id || item.created_at}`] || ''
  }));
}

window.markNotificationRead = async function(notificationId) {
  if (!isConfigured || !currentUser || !notificationId) return;
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId).eq('user_id', currentUser.id);
  if (error) {
    console.error('Notification mark-read error:', error);
    return alert(`Failed to update notification: ${error.message}`);
  }
  await loadNotificationsFromSupabase();
  render();
};




function renderShell() {
  document.getElementById('nav').innerHTML = navItems().map(v => {
    const unread = currentUser && v === 'notifications' ? latestUnreadCount() : 0;
    return `<button class="${state.view === v ? 'active' : ''}" onclick="setView('${v}')">${title(v)}${unread ? ` <span class="nav-badge">${unread}</span>` : ''}</button>`;
  }).join('');
  const roles = currentUser ? [state.role] : ['youth', 'employer', 'institution', 'admin'];
  document.getElementById('roleSwitch').innerHTML = roles.map(r => `<button class="${state.role === r ? 'active' : ''}" onclick="setRole('${r}')">${title(r)}</button>`).join('');
  document.getElementById('kicker').textContent = currentUser ? 'Active workspace' : 'Jobs4Youth';
  document.getElementById('pageTitle').textContent = state.view === 'home' ? 'Home' : title(state.view);
  document.getElementById('pageDesc').textContent = desc();
  const authStatus = document.getElementById('authStatus');
  const signInBtn = document.getElementById('btnSignIn');
  const signOutBtn = document.getElementById('btnSignOut');
  const displayName = state.profile?.name || currentUser?.user_metadata?.full_name || currentUser?.email || '';
  if (authStatus) authStatus.textContent = currentUser ? displayName : '';
  if (signInBtn) signInBtn.style.display = currentUser ? 'none' : '';
  if (signOutBtn) signOutBtn.style.display = currentUser ? '' : 'none';
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
  const score = matchScore(j);
  const status = j.status || 'Pending';
  const isVerified = status === 'Verified';
  const trustNote = isVerified
    ? 'Publicly visible verified listing'
    : status === 'Pending'
      ? 'Awaiting review before wider visibility'
      : status === 'Closed'
        ? 'Listing no longer open for active applications'
        : 'Status updated by platform moderation';
  return `
    <div class="job ${isVerified ? 'job-verified' : ''}">
      <div>
        <div class="job-header-row">
          <h3>${escapeHtml(j.title)}</h3>
          <div class="job-badges">
            ${statusBadge(status)}
            ${isVerified ? '<span class="pill pill-verified">Trust checked</span>' : ''}
          </div>
        </div>
        <p><b>${escapeHtml(j.org)}</b> • ${escapeHtml(j.region)}, ${escapeHtml(j.country)} • ${escapeHtml(j.type)} • ${escapeHtml(j.experience)}</p>
        <p>${escapeHtml(j.desc)}</p>
        <div>${(j.skills || '').split(',').filter(Boolean).map(x => `<span class="pill">${escapeHtml(x.trim())}</span>`).join('')}</div>
        <div class="trust-inline">${escapeHtml(trustNote)}</div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">${action ? `<button class="secondary" onclick="viewOpportunity('${j.id}')">View details</button><button class="secondary" onclick="saveOpportunity('${j.id}')">Save</button><button class="secondary" onclick="reportOpportunity('${j.id}')">Report suspicious</button><button class="primary" onclick="startApplication('${j.id}')">Start application</button>` : ''}${statusBadge(status)}</div>
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
  await loadApplicationsFromSupabase();
  alert('✅ Application saved successfully!');
  render();
};

function showUserMessage(message) {
  // Small, safe feedback helper. Uses alert for maximum compatibility with the current static app.
  alert(message);
}

function getJobById(id) {
  return (state.jobs || []).find(job => String(job.id) === String(id)) || null;
}

function getCourseById(id) {
  return (state.courses || []).find(course => String(course.id) === String(id)) || null;
}

function isOpportunitySaved(id) {
  return (state.savedOpportunities || []).some(item => String(item.opportunityId || item.opportunity_id) === String(id));
}

function isCourseSaved(id) {
  return (state.savedCourses || []).some(item => String(item.courseId || item.course_id) === String(id));
}

async function requireYouthUser() {
  if (!isConfigured || !supabase) {
    showUserMessage('Supabase is not connected. Check config.js.');
    return null;
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    showUserMessage('Please sign in first.');
    return null;
  }
  const profile = await ensureProfile(user);
  if (!profile || profile.role !== 'youth') {
    showUserMessage('Only youth accounts can use this youth application workflow.');
    return null;
  }
  return { user, profile };
}

async function loadSavedItemsFromSupabase() {
  state.savedOpportunities = [];
  state.savedCourses = [];
  if (!isConfigured || !supabase || !currentUser || state.role !== 'youth') return;
  try {
    const [savedOpps, savedCourses] = await Promise.all([
      supabase.from('saved_opportunities').select('id, opportunity_id, created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
      supabase.from('saved_courses').select('id, course_id, created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false })
    ]);
    if (!savedOpps.error) {
      state.savedOpportunities = (savedOpps.data || []).map(item => ({
        id: item.id,
        opportunityId: item.opportunity_id,
        createdAt: item.created_at
      }));
    } else {
      console.warn('Saved opportunities load warning:', savedOpps.error);
    }
    if (!savedCourses.error) {
      state.savedCourses = (savedCourses.data || []).map(item => ({
        id: item.id,
        courseId: item.course_id,
        createdAt: item.created_at
      }));
    } else {
      console.warn('Saved courses load warning:', savedCourses.error);
    }
  } catch (error) {
    console.warn('Saved items load warning:', error);
  }
}

window.viewOpportunity = function(opportunityId) {
  selectedOpportunityId = opportunityId;
  state.view = 'opportunity detail';
  render();
};

window.saveOpportunity = async function(opportunityId) {
  const auth = await requireYouthUser();
  if (!auth) return;
  if (isOpportunitySaved(opportunityId)) {
    showUserMessage('This opportunity is already in your shortlist.');
    return;
  }
  const { error } = await supabase.from('saved_opportunities').insert([{ user_id: auth.user.id, opportunity_id: opportunityId }]);
  if (error) {
    console.error('Save opportunity error:', error);
    if ((error.message || '').toLowerCase().includes('duplicate') || error.code === '23505') {
      showUserMessage('This opportunity is already in your shortlist.');
      await loadSavedItemsFromSupabase();
      render();
      return;
    }
    showUserMessage(`Could not save opportunity: ${error.message}`);
    return;
  }
  await loadSavedItemsFromSupabase();
  showUserMessage('Opportunity saved to My Shortlist.');
  render();
};

window.removeSavedOpportunity = async function(opportunityId) {
  const auth = await requireYouthUser();
  if (!auth) return;
  const { error } = await supabase.from('saved_opportunities').delete().eq('user_id', auth.user.id).eq('opportunity_id', opportunityId);
  if (error) {
    console.error('Remove saved opportunity error:', error);
    showUserMessage(`Could not remove saved opportunity: ${error.message}`);
    return;
  }
  await loadSavedItemsFromSupabase();
  render();
};

window.saveCourse = async function(courseId) {
  const auth = await requireYouthUser();
  if (!auth) return;
  if (isCourseSaved(courseId)) {
    showUserMessage('This training is already in your shortlist.');
    return;
  }
  const { error } = await supabase.from('saved_courses').insert([{ user_id: auth.user.id, course_id: courseId }]);
  if (error) {
    console.error('Save course error:', error);
    if ((error.message || '').toLowerCase().includes('duplicate') || error.code === '23505') {
      showUserMessage('This training is already in your shortlist.');
      await loadSavedItemsFromSupabase();
      render();
      return;
    }
    showUserMessage(`Could not save training: ${error.message}`);
    return;
  }
  await loadSavedItemsFromSupabase();
  showUserMessage('Training saved to My Shortlist.');
  render();
};

window.removeSavedCourse = async function(courseId) {
  const auth = await requireYouthUser();
  if (!auth) return;
  const { error } = await supabase.from('saved_courses').delete().eq('user_id', auth.user.id).eq('course_id', courseId);
  if (error) {
    console.error('Remove saved course error:', error);
    showUserMessage(`Could not remove saved training: ${error.message}`);
    return;
  }
  await loadSavedItemsFromSupabase();
  render();
};

window.startApplication = async function(opportunityId) {
  const auth = await requireYouthUser();
  if (!auth) return;
  const job = getJobById(opportunityId);
  if (!job) {
    showUserMessage('Opportunity not found. Please refresh and try again.');
    return;
  }
  const readinessScore = Math.min(100, Math.max(0, matchScore(job)));
  applicationWizard = {
    opportunityId,
    draftId: null,
    step: 1,
    readinessScore,
    motivationNote: '',
    screeningAnswers: {},
    documentState: { cvReady: false, certificateReady: false, referencesReady: false }
  };
  try {
    const { data: existingDraft, error: existingError } = await supabase
      .from('opportunity_application_drafts')
      .select('id,current_step,motivation_note,document_state,screening_answers,readiness_score')
      .eq('opportunity_id', opportunityId)
      .eq('applicant_id', auth.user.id)
      .maybeSingle();
    if (!existingError && existingDraft) {
      applicationWizard.draftId = existingDraft.id;
      applicationWizard.step = existingDraft.current_step || 1;
      applicationWizard.motivationNote = existingDraft.motivation_note || '';
      applicationWizard.documentState = existingDraft.document_state || applicationWizard.documentState;
      applicationWizard.screeningAnswers = existingDraft.screening_answers || {};
      applicationWizard.readinessScore = Number(existingDraft.readiness_score || readinessScore);
    } else {
      const { data: createdDraft, error: createError } = await supabase.from('opportunity_application_drafts').insert([{
        opportunity_id: opportunityId,
        applicant_id: auth.user.id,
        current_step: 1,
        draft_status: 'In Progress',
        readiness_score: readinessScore,
        readiness_band: readinessScore >= 80 ? 'Strong' : readinessScore >= 60 ? 'Progressing' : readinessScore >= 40 ? 'Emerging' : 'Early stage',
        readiness_summary: { profile_fit_score: readinessScore, opportunity_title: job.title }
      }]).select('id').single();
      if (!createError && createdDraft) applicationWizard.draftId = createdDraft.id;
      if (createError) console.warn('Draft create warning:', createError);
    }
  } catch (error) {
    console.warn('Guided application draft warning:', error);
  }
  state.view = 'application wizard';
  render();
};

async function saveApplicationDraftProgress() {
  if (!isConfigured || !supabase || !currentUser || !applicationWizard.draftId) return;
  const payload = {
    current_step: applicationWizard.step,
    readiness_score: applicationWizard.readinessScore,
    motivation_note: applicationWizard.motivationNote,
    document_state: applicationWizard.documentState,
    screening_answers: applicationWizard.screeningAnswers,
    draft_status: applicationWizard.step >= 5 ? 'Ready to Submit' : 'In Progress',
    draft_payload: { saved_from_frontend: true, saved_at: new Date().toISOString() }
  };
  const { error } = await supabase.from('opportunity_application_drafts').update(payload).eq('id', applicationWizard.draftId);
  if (error) console.warn('Draft update warning:', error);
}

window.updateWizardField = function(field, value) {
  if (field === 'motivationNote') applicationWizard.motivationNote = value;
  if (field === 'cvReady') applicationWizard.documentState.cvReady = !!value;
  if (field === 'certificateReady') applicationWizard.documentState.certificateReady = !!value;
  if (field === 'referencesReady') applicationWizard.documentState.referencesReady = !!value;
  if (field.startsWith('screening_')) applicationWizard.screeningAnswers[field] = value;
};

window.goWizardStep = async function(nextStep) {
  applicationWizard.step = Math.max(1, Math.min(6, Number(nextStep || 1)));
  await saveApplicationDraftProgress();
  render();
};

window.submitGuidedApplication = async function() {
  const auth = await requireYouthUser();
  if (!auth) return;
  const opportunityId = applicationWizard.opportunityId;
  if (!opportunityId) return showUserMessage('No opportunity selected.');
  const { data: appRow, error: appError } = await supabase
    .from('applications')
    .upsert([{ opportunity_id: opportunityId, applicant_id: auth.user.id, application_status: 'Submitted' }], { onConflict: 'opportunity_id,applicant_id' })
    .select('id')
    .single();
  if (appError) {
    console.error('Guided application submit error:', appError);
    showUserMessage(`Application could not be submitted: ${appError.message}`);
    return;
  }
  try {
    if (applicationWizard.draftId) {
      await supabase.from('opportunity_application_drafts').update({
        current_step: 6,
        draft_status: 'Submitted',
        submitted_at: new Date().toISOString(),
        motivation_note: applicationWizard.motivationNote,
        document_state: applicationWizard.documentState,
        screening_answers: applicationWizard.screeningAnswers
      }).eq('id', applicationWizard.draftId);
    }
    await supabase.from('application_submission_payloads').upsert([{
      application_id: appRow.id,
      opportunity_id: opportunityId,
      applicant_id: auth.user.id,
      readiness_score: applicationWizard.readinessScore,
      readiness_band: applicationWizard.readinessScore >= 80 ? 'Strong' : applicationWizard.readinessScore >= 60 ? 'Progressing' : applicationWizard.readinessScore >= 40 ? 'Emerging' : 'Early stage',
      readiness_summary: { profile_fit_score: applicationWizard.readinessScore },
      motivation_note: applicationWizard.motivationNote,
      document_state: applicationWizard.documentState,
      screening_answers: applicationWizard.screeningAnswers,
      submitted_at: new Date().toISOString()
    }], { onConflict: 'application_id' });
  } catch (payloadError) {
    console.warn('Submission payload warning:', payloadError);
  }
  await loadApplicationsFromSupabase();
  await loadSavedItemsFromSupabase();
  applicationWizard.step = 6;
  render();
  showUserMessage('Application submitted successfully. You can track it from your dashboard.');
};

function opportunityDetailPage() {
  const job = getJobById(selectedOpportunityId);
  if (!job) {
    return `<div class="grid"><div class="card span-12"><h3>Opportunity not found</h3><p class="label">Please return to the marketplace and open the opportunity again.</p><button class="secondary" onclick="setView('opportunities')">Back to opportunities</button></div></div>`;
  }
  const score = matchScore(job);
  return `
    <div class="grid">
      <div class="card span-12 opportunity-detail-hero">
        <div class="opportunity-detail-main">
          <div class="kicker">Verified opportunity detail</div>
          <h3>${escapeHtml(job.title)}</h3>
          <p><b>${escapeHtml(job.org)}</b> • ${escapeHtml(job.region)}, ${escapeHtml(job.country)} • ${escapeHtml(job.type)}</p>
          <p class="opportunity-detail-description">${escapeHtml(job.desc || 'No detailed description has been provided yet.')}</p>
          <div class="pathway-summary-row">
            ${statusBadge(job.status || 'Pending')}
            <span class="pathway-summary-item">Education: ${escapeHtml(job.education || 'Not specified')}</span>
            <span class="pathway-summary-item">Experience: ${escapeHtml(job.experience || 'Not specified')}</span>
          </div>
          <div class="opportunity-actions-row">
            <button class="secondary" onclick="setView('opportunities')">Back</button>
            <button class="secondary" onclick="saveOpportunity('${escapeHtml(job.id)}')">${isOpportunitySaved(job.id) ? 'Saved' : 'Save to shortlist'}</button>
            <button class="secondary" onclick="reportOpportunity('${escapeHtml(job.id)}')">Report suspicious</button>
            <button class="primary" onclick="startApplication('${escapeHtml(job.id)}')">Start guided application</button>
          </div>
        </div>
        <div class="detail-score-shell ${score >= 75 ? 'score-strong' : score >= 55 ? 'score-medium' : 'score-emerging'}">
          <div class="fit" style="--score:${score}; margin:0 auto 12px;"><span>${score}%</span></div>
          <h4>Profile fit estimate</h4>
          <p class="label">This score uses your current profile, skills, location and education fields. Complete your profile to improve matching.</p>
        </div>
      </div>
      <div class="card span-6 detail-box">
        <h4>Required skills</h4>
        <p>${escapeHtml(job.skills || 'Skills not specified yet.')}</p>
      </div>
      <div class="card span-6 detail-box">
        <h4>Application guidance</h4>
        <p class="label">Review the opportunity, confirm your readiness, prepare your motivation note, answer screening questions and submit only when ready.</p>
      </div>
    </div>
  `;
}

function shortlistPage() {
  const savedJobs = (state.savedOpportunities || []).map(item => ({ item, job: getJobById(item.opportunityId) })).filter(x => x.job);
  const savedTraining = (state.savedCourses || []).map(item => ({ item, course: getCourseById(item.courseId) })).filter(x => x.course);
  return `
    <div class="grid">
      <div class="card span-12 shortlist-shell">
        <div class="section-title"><div><div class="kicker">My Shortlist</div><h3>Saved opportunities and training</h3><p class="label">Save first, compare calmly, then apply when ready.</p></div><button class="secondary" onclick="setView('opportunities')">Browse more</button></div>
      </div>
      <div class="card span-6">
        <div class="section-title"><h3>Saved opportunities</h3><span class="pill">${savedJobs.length}</span></div>
        ${savedJobs.length ? savedJobs.map(({ job, item }) => `
          <div class="shortlist-item-card">
            <div><h4>${escapeHtml(job.title)}</h4><p class="label"><b>${escapeHtml(job.org)}</b> • ${escapeHtml(job.region)}, ${escapeHtml(job.country)} • Saved ${item.createdAt ? escapeHtml(new Date(item.createdAt).toLocaleDateString()) : ''}</p>${statusBadge(job.status || 'Pending')}</div>
            <div class="shortlist-item-actions"><button class="secondary" onclick="viewOpportunity('${escapeHtml(job.id)}')">View</button><button class="primary" onclick="startApplication('${escapeHtml(job.id)}')">Apply</button><button class="secondary" onclick="removeSavedOpportunity('${escapeHtml(job.id)}')">Remove</button></div>
          </div>
        `).join('') : `<div class="empty-card"><h4>No saved opportunities yet</h4><p class="label">Open opportunities and click Save to create your shortlist.</p><button class="secondary" onclick="setView('opportunities')">Browse opportunities</button></div>`}
      </div>
      <div class="card span-6">
        <div class="section-title"><h3>Saved training</h3><span class="pill">${savedTraining.length}</span></div>
        ${savedTraining.length ? savedTraining.map(({ course, item }) => `
          <div class="shortlist-item-card">
            <div><h4>${escapeHtml(course.title)}</h4><p class="label"><b>${escapeHtml(course.provider)}</b> • ${escapeHtml(course.mode)} • Saved ${item.createdAt ? escapeHtml(new Date(item.createdAt).toLocaleDateString()) : ''}</p>${statusBadge(course.status || 'Pending')}</div>
            <div class="shortlist-item-actions"><button class="secondary" onclick="setView('training')">View training</button><button class="secondary" onclick="removeSavedCourse('${escapeHtml(course.id)}')">Remove</button></div>
          </div>
        `).join('') : `<div class="empty-card"><h4>No saved training yet</h4><p class="label">Open training offers and save those that help close your skill gaps.</p><button class="secondary" onclick="setView('training')">Browse training</button></div>`}
      </div>
    </div>
  `;
}

function wizardStepChip(step, label) {
  const cls = applicationWizard.step === step ? 'active' : applicationWizard.step > step ? 'complete' : '';
  return `<div class="wizard-step-chip ${cls}"><span>${step}</span><b>${escapeHtml(label)}</b></div>`;
}

function applicationWizardPage() {
  const job = getJobById(applicationWizard.opportunityId);
  if (!job) return `<div class="card"><h3>No opportunity selected</h3><button class="secondary" onclick="setView('opportunities')">Back to opportunities</button></div>`;
  const step = applicationWizard.step || 1;
  const checks = [
    { label: 'Profile name', ok: !!state.profile.name },
    { label: 'Country and region', ok: !!state.profile.country && !!state.profile.region },
    { label: 'Education', ok: !!state.profile.education },
    { label: 'Skills', ok: !!state.profile.skills },
    { label: 'Availability', ok: !!state.profile.availability }
  ];
  let body = '';
  if (step === 1) body = `<h3>Review opportunity</h3><p><b>${escapeHtml(job.title)}</b> at ${escapeHtml(job.org)}</p><p class="label">${escapeHtml(job.desc || '')}</p><div class="pathway-summary-row"><span class="pathway-summary-item">${escapeHtml(job.region)}, ${escapeHtml(job.country)}</span><span class="pathway-summary-item">${escapeHtml(job.type)}</span><span class="pathway-summary-item">${escapeHtml(job.experience || 'Experience not specified')}</span></div>`;
  if (step === 2) body = `<h3>Profile readiness</h3><div class="detail-score-shell"><div class="fit" style="--score:${applicationWizard.readinessScore}; margin:0 auto 12px;"><span>${applicationWizard.readinessScore}%</span></div><p class="label">Estimated readiness based on available profile and opportunity fields.</p></div><div class="criteria-list" style="margin-top:14px;">${checks.map(c => `<div class="criteria-item ${c.ok ? 'criteria-pass' : 'criteria-watch'}"><div class="criteria-icon">${c.ok ? '✓' : '!'}</div><div><b>${escapeHtml(c.label)}</b><p class="label">${c.ok ? 'Completed' : 'Needs attention'}</p></div></div>`).join('')}</div>`;
  if (step === 3) body = `<h3>Application package</h3><p class="label">Confirm what you have ready. This version records readiness; full file attachments can be added in the next document sprint.</p><div class="form"><label class="full">Motivation note<textarea oninput="updateWizardField('motivationNote', this.value)" placeholder="Why are you interested in this opportunity?">${escapeHtml(applicationWizard.motivationNote || '')}</textarea></label><label><input type="checkbox" ${applicationWizard.documentState.cvReady ? 'checked' : ''} onchange="updateWizardField('cvReady', this.checked)"/> CV ready</label><label><input type="checkbox" ${applicationWizard.documentState.certificateReady ? 'checked' : ''} onchange="updateWizardField('certificateReady', this.checked)"/> Certificates ready</label><label><input type="checkbox" ${applicationWizard.documentState.referencesReady ? 'checked' : ''} onchange="updateWizardField('referencesReady', this.checked)"/> References ready</label></div>`;
  if (step === 4) body = `<h3>Screening questions</h3><div class="form"><label class="full">Why do you think you are a good fit?<textarea oninput="updateWizardField('screening_fit', this.value)">${escapeHtml(applicationWizard.screeningAnswers.screening_fit || '')}</textarea></label><label class="full">Are you available for this opportunity?<select onchange="updateWizardField('screening_available', this.value)"><option value="">Select</option><option ${applicationWizard.screeningAnswers.screening_available === 'Yes' ? 'selected' : ''}>Yes</option><option ${applicationWizard.screeningAnswers.screening_available === 'No' ? 'selected' : ''}>No</option></select></label></div>`;
  if (step === 5) body = `<h3>Final review</h3><p><b>Opportunity:</b> ${escapeHtml(job.title)}</p><p><b>Employer:</b> ${escapeHtml(job.org)}</p><p><b>Readiness:</b> ${applicationWizard.readinessScore}%</p><p><b>Motivation note:</b> ${escapeHtml(applicationWizard.motivationNote || 'Not provided')}</p><div class="notice"><b>Almost done:</b> Click Submit Application only when you are ready. This is the point where your application is officially submitted.</div>`;
  if (step === 6) body = `<div class="success-state"><div class="success-icon">✓</div><h3>Application submitted</h3><p class="lead">Your application has been submitted successfully. You can continue browsing opportunities or return to your dashboard.</p><div class="hero-actions"><button class="primary" onclick="setView('dashboard')">Go to dashboard</button><button class="secondary" onclick="setView('opportunities')">Browse more opportunities</button></div></div>`;
  return `
    <div class="grid">
      <div class="card span-12 wizard-shell-card">
        <div class="section-title"><div><div class="kicker">Guided application</div><h3>${escapeHtml(job.title)}</h3><p class="label">Complete each step before final submission.</p></div><button class="secondary" onclick="viewOpportunity('${escapeHtml(job.id)}')">Back to details</button></div>
        <div class="wizard-step-row">${wizardStepChip(1,'Review')}${wizardStepChip(2,'Readiness')}${wizardStepChip(3,'Package')}${wizardStepChip(4,'Questions')}${wizardStepChip(5,'Confirm')}${wizardStepChip(6,'Submitted')}</div>
        <div class="wizard-stage-panel">${body}</div>
        ${step < 6 ? `<div class="wizard-footer-actions"><button class="secondary" onclick="goWizardStep(${Math.max(1, step - 1)})">Back</button><div class="wizard-footer-main-actions">${step < 5 ? `<button class="primary" onclick="goWizardStep(${step + 1})">Continue</button>` : `<button class="primary" onclick="submitGuidedApplication()">Submit application</button>`}</div></div>` : ''}
      </div>
    </div>
  `;
}

function actionSelect(label, id, options, selected, placeholder='Select option') {
  return `
    <label>
      ${label}
      <select id="${id}">${renderOptions(options, selected, placeholder)}</select>
    </label>
  `;
}
function statusBadge(status) {
  const safe = escapeHtml(status || 'Pending');
  const key = String(status || 'Pending').toLowerCase();
  let cls = 'status-neutral';
  if (key === 'verified' || key === 'approved' || key === 'placed') cls = 'status-verified';
  else if (key === 'pending' || key === 'submitted' || key === 'saved' || key === 'shortlisted') cls = 'status-pending';
  else if (key === 'rejected' || key === 'closed') cls = 'status-rejected';
  return `<span class="status-badge ${cls}">${safe}</span>`;
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

function featuredJobs(limit = 3) {
  return [...state.jobs]
    .filter(job => job.status === 'Verified')
    .sort((a, b) => matchScore(b) - matchScore(a))
    .slice(0, limit);
}
function featuredCourses(limit = 3) {
  return [...state.courses]
    .filter(course => course.status === 'Verified')
    .slice(0, limit);
}
function publicJobTeaser(job) {
  return `
    <div class="mini-card">
      <div class="mini-top">
        ${statusBadge('Verified')}
        <span class="pill pill-trust">Public trust</span>
        <span class="pill">${escapeHtml(job.type || 'Opportunity')}</span>
      </div>
      <h4>${escapeHtml(job.title)}</h4>
      <p><b>${escapeHtml(job.org)}</b></p>
      <p class="label">${escapeHtml(job.region || 'Location flexible')}, ${escapeHtml(job.country || 'Multi-country')}</p>
      <p class="label">${escapeHtml(job.experience || 'Open to early-career applicants')}</p>
      <div class="trust-inline">Verified listing highlighted for safe public browsing</div>
      <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="secondary" onclick="setView('opportunities')">View opportunity</button>
        <span class="pill">${matchScore(job)}% profile-fit ready</span>
      </div>
    </div>
  `;
}
function publicCourseTeaser(course) {
  return `
    <div class="mini-card">
      <div class="mini-top">
        ${statusBadge('Verified')}
        <span class="pill pill-trust">Skills pathway</span>
        <span class="pill">${escapeHtml(course.mode || 'Training')}</span>
      </div>
      <h4>${escapeHtml(course.title)}</h4>
      <p><b>${escapeHtml(course.provider)}</b></p>
      <p class="label">${escapeHtml(course.region || 'Remote')}, ${escapeHtml(course.country || 'Multi-country')}</p>
      <p class="label">${escapeHtml(course.duration || 'Flexible duration')}</p>
      <div class="trust-inline">Verified learning offer for public browsing</div>
      <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="secondary" onclick="setView('training')">View training</button>
        <span class="pill">Skills pathway</span>
      </div>
    </div>
  `;
}
function homeSectionEmpty(titleText, bodyText, actionLabel, viewName) {
  return `
    <div class="empty-card">
      <h4>${escapeHtml(titleText)}</h4>
      <p class="label">${escapeHtml(bodyText)}</p>
      <button class="secondary" onclick="setView('${escapeHtml(viewName)}')">${escapeHtml(actionLabel)}</button>
    </div>
  `;
}
function home() {
  const jobs = featuredJobs(3);
  const courses = featuredCourses(3);
  const verifiedJobs = state.jobs.filter(j => j.status === 'Verified').length;
  const verifiedCourses = state.courses.filter(c => c.status === 'Verified').length;
  return `
    <div class="grid home-grid award-home">
      ${launchBanner()}
      <div class="card span-8 hero-card hero-card-award">
        <div class="hero-copy">
          <div class="kicker">Africa's youth career operating system</div>
          <h3 class="hero-title">Build your Career Passport. Find verified opportunities. Move from potential to paid work.</h3>
          <p class="hero-text">Jobs4Youth helps young people discover trusted jobs, internships, apprenticeships and training pathways while building a visible career profile that employers and partners can trust.</p>
          <div class="hero-actions">
            <button class="primary" onclick="openSignup()">Start my Career Passport</button>
            <button class="secondary" onclick="setView('opportunities')">Browse verified jobs</button>
            <button class="secondary" onclick="setView('training')">Find skills pathways</button>
            <button class="secondary" onclick="openLogin()">I already have an account</button>
          </div>
          <div class="hero-points">
            <span class="pill pill-verified">Verified listings</span>
            <span class="pill">Career readiness score</span>
            <span class="pill">Skills gap guidance</span>
            <span class="pill pill-trust">Youth-first design</span>
          </div>
        </div>
      </div>

      <div class="card span-4 hero-panel career-passport-preview">
        <div class="kicker">Your Career Passport</div>
        <h3>One profile. Many doors.</h3>
        <div class="feature-stat"><span class="metric">${verifiedJobs}</span><span class="label">verified opportunities visible now</span></div>
        <div class="feature-stat"><span class="metric">${verifiedCourses}</span><span class="label">verified learning pathways available</span></div>
        <div class="feature-stat"><span class="metric">100</span><span class="label">readiness points to unlock better matching</span></div>
        <div class="soft-note">Create an account, complete your profile, save opportunities, close skill gaps and apply with confidence.</div>
      </div>

      <div class="card span-12 youth-movement-strip">
        <div class="section-title">
          <div>
            <div class="kicker">The Jobs4Youth promise</div>
            <h3>Not just a job board. A youth opportunity movement.</h3>
            <p class="label">The platform connects youth, employers and training institutions so young people can see where they stand, what to improve and where to apply next.</p>
          </div>
          <button class="primary" onclick="openSignup()">Join the movement</button>
        </div>
        <div class="trust-grid">
          <div class="trust-card"><h4>Discover</h4><p class="label">Browse verified jobs, internships, apprenticeships and training pathways without guessing what is credible.</p></div>
          <div class="trust-card"><h4>Build</h4><p class="label">Create a Career Passport that turns your skills, education, location and goals into a readiness profile.</p></div>
          <div class="trust-card"><h4>Improve</h4><p class="label">Use CareerGPS to identify profile gaps, missing skills and training pathways that can improve your employability.</p></div>
          <div class="trust-card"><h4>Apply</h4><p class="label">Save opportunities, prepare stronger applications and track your journey from interest to submission.</p></div>
        </div>
      </div>

      <div class="card span-12">
        ${onboardingPanel()}
      </div>

      ${employerConversionPanel()}

      <div class="card span-7 flagship-card">
        <div class="section-title">
          <div>
            <div class="kicker">Flagship feature</div>
            <h3>CareerGPS: your personal pathway coach</h3>
            <p class="label">CareerGPS turns a youth profile into practical guidance: readiness score, target opportunity fit, skills gaps, recommended training and next best action.</p>
          </div>
          <span class="pill pill-verified">Award-ready feature</span>
        </div>
        <div class="detail-two-column">
          <div class="detail-box">
            <h4>Readiness score</h4>
            <p class="label">Know whether your profile is strong enough for matching and what information is missing.</p>
          </div>
          <div class="detail-box">
            <h4>Opportunity fit</h4>
            <p class="label">Compare your skills against real opportunity requirements before applying.</p>
          </div>
          <div class="detail-box">
            <h4>Skills gap map</h4>
            <p class="label">See the skills to strengthen and the training pathways that can help close the gap.</p>
          </div>
          <div class="detail-box">
            <h4>Next best action</h4>
            <p class="label">Get a simple action to take today instead of feeling lost in the job search.</p>
          </div>
        </div>
        <div class="hero-actions" style="margin-top:16px;">
          <button class="primary" onclick="openSignup()">Create account to unlock CareerGPS</button>
          <button class="secondary" onclick="setView('opportunities')">Preview opportunities</button>
        </div>
      </div>

      <div class="card span-5 youth-badges-card">
        <div class="section-title"><h3>Earn employability badges</h3><span class="pill">Coming alive through your activity</span></div>
        <div class="pathway-list">
          <span class="pill pill-verified">Profile Complete</span>
          <span class="pill">Job Ready</span>
          <span class="pill">Skills Builder</span>
          <span class="pill">First Application</span>
          <span class="pill">Interview Ready</span>
          <span class="pill">Women in Work Pathway</span>
          <span class="pill">Digital Skills Ready</span>
          <span class="pill">Green Jobs Ready</span>
        </div>
        <div class="notice" style="margin-top:14px;"><b>Why badges matter:</b> they make progress visible to youth and create clearer signals for employers, institutions and partners.</div>
      </div>

      <div class="card span-7">
        <div class="section-title"><h3>Featured verified opportunities</h3><button class="secondary" onclick="setView('opportunities')">View all opportunities</button></div>
        <p class="label">Only public-facing verified listings are highlighted here to improve trust and relevance.</p>
        <div class="mini-grid">
          ${jobs.length ? jobs.map(publicJobTeaser).join('') : homeSectionEmpty('No verified opportunities yet', 'Once reviewed opportunities are published, featured roles will appear here for public browsing.', 'Open opportunity marketplace', 'opportunities')}
        </div>
      </div>

      <div class="card span-5">
        <div class="section-title"><h3>Training pathways that close gaps</h3><button class="secondary" onclick="setView('training')">View all training</button></div>
        <p class="label">Verified learning offers help youth respond to market demand and strengthen their Career Passport.</p>
        <div class="mini-grid single-column">
          ${courses.length ? courses.map(publicCourseTeaser).join('') : homeSectionEmpty('No verified training yet', 'Verified courses and skills programmes will appear here once institutions publish and admins approve them.', 'Browse training catalogue', 'training')}
        </div>
      </div>

      <div class="card span-12 partner-proof-card">
        <div class="section-title">
          <div>
            <div class="kicker">Built for scale, trust and funding readiness</div>
            <h3>A platform youth use, employers trust and partners can measure</h3>
            <p class="label">Jobs4Youth is designed to generate real-time evidence on youth demand, skills gaps, applications, training coverage and underserved segments.</p>
          </div>
          <button class="secondary" onclick="setView('about')">Why this matters</button>
        </div>
        <div class="trust-grid">
          <div class="trust-card"><h4>Youth value</h4><p class="label">Personalised matches, progress tracking, shortlists, applications and career guidance.</p></div>
          <div class="trust-card"><h4>Employer value</h4><p class="label">Better candidate visibility, structured applications and trust-checked recruitment workflows.</p></div>
          <div class="trust-card"><h4>Institution value</h4><p class="label">Training providers can see where skills demand is rising and align programmes accordingly.</p></div>
          <div class="trust-card"><h4>Funder value</h4><p class="label">Partners can monitor youth reach, readiness, skills gaps, opportunity density and labour-market signals.</p></div>
        </div>
      </div>

      <div class="card span-12 impact-preview-card">
        <div class="section-title">
          <div><div class="kicker">Impact evidence</div><h3>Built to show funders what is changing</h3><p class="label">Track youth reached, young women inclusion, applications, verified opportunities, training pathways, skills gaps and country intelligence.</p></div>
          <button class="primary" onclick="setView('impact')">Open Impact Evidence</button>
        </div>
      </div>

      <div class="card span-12 final-cta final-cta-award">
        <div>
          <div class="kicker">Ready to build your future?</div>
          <h3>Join Jobs4Youth and start your Career Passport today</h3>
          <p class="label">Create an account to get matched, save opportunities, build your readiness score and apply to verified pathways.</p>
        </div>
        <div class="hero-actions">
          <button class="primary" onclick="openSignup()">Create my free account</button>
          <button class="secondary" onclick="setView('opportunities')">Browse first</button>
          <button class="secondary" onclick="setView('contact')">Partner with us</button>
        </div>
      </div>
    </div>
  `;
}

function youthDash() {
  const ranked = [...state.jobs].sort((a, b) => matchScore(b) - matchScore(a));
  const completion = youthProfileCompletion();
  const verifiedMatches = ranked.filter(j => j.status === 'Verified');
  const savedCount = (state.savedOpportunities || []).length + (state.savedCourses || []).length;
  const applicationsCount = state.applications.length;
  const readinessBand = completion >= 85 ? 'Leader' : completion >= 70 ? 'Job ready' : completion >= 45 ? 'Building' : 'Getting started';
  const nextActionTitle = completion < 75 ? 'Complete your Career Passport' : applicationsCount === 0 ? 'Apply to your strongest match' : 'Keep building momentum';
  const nextActionText = completion < 75
    ? `Your profile is ${completion}% complete. Add missing skills, location, education, interests and availability so Jobs4Youth can improve your matching.`
    : applicationsCount === 0
      ? 'You have enough profile information to start applying. Open your best match and use the guided application flow.'
      : 'You have started your journey. Save more pathways, update skills and continue applying to verified opportunities.';
  return `
    <div class="grid youth-command-centre">
      <div class="card span-12 youth-dashboard-hero">
        <div class="section-title">
          <div>
            <div class="kicker">My Career Passport</div>
            <h3>Welcome back, ${escapeHtml(state.profile.name || 'future leader')}</h3>
            <p class="label">This is your daily career cockpit: track readiness, discover matched opportunities, close skills gaps and move toward dignified work with confidence.</p>
          </div>
          <div class="fit ${completion >= 75 ? 'readiness-strong' : completion >= 50 ? 'readiness-medium' : 'readiness-emerging'}" style="--score:${completion}"><span>${completion}%</span></div>
        </div>
        <div class="pathway-summary-row">
          <span class="pathway-summary-item"><strong>Status:</strong>&nbsp;${escapeHtml(readinessBand)}</span>
          <span class="pathway-summary-item"><strong>Country:</strong>&nbsp;${escapeHtml(state.profile.country || 'Not added')}</span>
          <span class="pathway-summary-item"><strong>Skills:</strong>&nbsp;${splitSkillsSimple(state.profile.skills).length || 0} listed</span>
          <span class="pathway-summary-item"><strong>Applications:</strong>&nbsp;${applicationsCount}</span>
          <span class="pathway-summary-item"><strong>Saved:</strong>&nbsp;${savedCount}</span>
        </div>
        <div class="hero-actions" style="margin-top:16px;">
          <button class="primary" onclick="setView('opportunities')">Find my best match</button>
          <button class="secondary" onclick="setView('profile')">Improve my passport</button>
          <button class="secondary" onclick="document.getElementById('careerTwinNavBtn')?.click()">Open CareerGPS</button>
          <button class="secondary" onclick="setView('shortlist')">View shortlist</button>
        </div>
      </div>

      ${safetyCenterCard(false)}

      <div class="card span-8 next-action-card">
        <div class="section-title">
          <div>
            <div class="kicker">Today's next best action</div>
            <h3>${escapeHtml(nextActionTitle)}</h3>
            <p class="label">${escapeHtml(nextActionText)}</p>
          </div>
          <span class="pill pill-verified">Take action today</span>
        </div>
        <div class="chartbar"><div style="width:${completion}%"></div></div>
        <div class="hero-actions" style="margin-top:14px;">
          ${completion < 75 ? `<button class="primary" onclick="setView('profile')">Complete missing fields</button>` : `<button class="primary" onclick="setView('opportunities')">Apply to a verified opportunity</button>`}
          <button class="secondary" onclick="setView('training')">Strengthen skills</button>
        </div>
      </div>

      <div class="card span-4 achievement-card">
        <div class="section-title"><h3>My badges</h3><span class="pill">Progress signals</span></div>
        <div class="pathway-list">
          <span class="pill ${completion >= 70 ? 'pill-verified' : ''}">Profile Builder</span>
          <span class="pill ${completion >= 85 ? 'pill-verified' : ''}">Career Passport Ready</span>
          <span class="pill ${savedCount > 0 ? 'pill-verified' : ''}">Opportunity Shortlister</span>
          <span class="pill ${applicationsCount > 0 ? 'pill-verified' : ''}">First Application</span>
          <span class="pill ${splitSkillsSimple(state.profile.skills).length >= 5 ? 'pill-verified' : ''}">Skills Builder</span>
        </div>
        <div class="soft-note" style="margin-top:12px;">Badges help you see progress and will become stronger employer-facing signals as the platform grows.</div>
      </div>

      <div class="card span-3"><div class="label">Career Passport</div><div class="metric">${completion}%</div><div class="label">Profile readiness score</div></div>
      <div class="card span-3"><div class="label">Verified matches</div><div class="metric">${verifiedMatches.length}</div><div class="label">Opportunities available to explore</div></div>
      <div class="card span-3"><div class="label">Saved pathways</div><div class="metric">${savedCount}</div><div class="label">Opportunities and training saved</div></div>
      <div class="card span-3"><div class="label">Applications</div><div class="metric">${applicationsCount}</div><div class="label">Submitted opportunities</div></div>

      <div class="card span-8">
        <div class="section-title"><div><h3>Best matches for you</h3><p class="label">Ranked using your skills, interests, education and location.</p></div><button class="secondary" onclick="setView('opportunities')">View all</button></div>
        ${verifiedMatches.slice(0, 3).length ? verifiedMatches.slice(0, 3).map(j => jobCard(j, true)).join('') : `
          <div class="empty-card"><h4>No verified matches yet</h4><p class="label">Once verified opportunities are available, your strongest matches will appear here automatically.</p><button class="secondary" onclick="setView('opportunities')">Browse opportunities</button></div>
        `}
      </div>

      <div class="card span-4 careergps-card">
        <div class="section-title"><h3>CareerGPS quick guide</h3><span class="pill pill-trust">Personal coach</span></div>
        <p class="label">Use CareerGPS to understand your readiness score, target opportunity fit, skills gaps and recommended training pathways.</p>
        <div class="criteria-list" style="margin-top:14px;">
          <div class="criteria-item ${state.profile.skills ? 'criteria-pass' : 'criteria-watch'}"><div class="criteria-icon">${state.profile.skills ? '✓' : '!'}</div><div><b>Skills added</b><p class="label">${state.profile.skills ? 'Your skills are visible for matching.' : 'Add skills to improve matching.'}</p></div></div>
          <div class="criteria-item ${state.profile.education ? 'criteria-pass' : 'criteria-watch'}"><div class="criteria-icon">${state.profile.education ? '✓' : '!'}</div><div><b>Education added</b><p class="label">${state.profile.education ? 'Education helps filter relevant roles.' : 'Add education level.'}</p></div></div>
          <div class="criteria-item ${state.profile.availability ? 'criteria-pass' : 'criteria-watch'}"><div class="criteria-icon">${state.profile.availability ? '✓' : '!'}</div><div><b>Availability added</b><p class="label">${state.profile.availability ? 'Employers can see readiness.' : 'Add when you can start.'}</p></div></div>
        </div>
        <button class="primary full" style="margin-top:14px;" onclick="document.getElementById('careerTwinNavBtn')?.click()">Open CareerGPS</button>
      </div>

      <div class="card span-6">
        <div class="section-title"><h3>Recommended skills pathways</h3><button class="secondary" onclick="setView('training')">View training</button></div>
        ${state.courses.length ? state.courses.slice(0,4).map(c => `<p><b>${escapeHtml(c.title)}</b><br><span class="label">${escapeHtml(c.provider)} • ${escapeHtml(c.mode)} • ${escapeHtml(c.duration)}</span></p>`).join('') : `<div class="empty-card"><h4>No verified training offers yet</h4><p class="label">Training pathways will appear here as verified institutions publish relevant offers.</p><button class="secondary" onclick="setView('training')">Browse training</button></div>`}
      </div>

      <div class="card span-6 invite-card">
        ${socialSharingCentre(true)}
      </div>

      <div class="card span-6 invite-card">
        <div class="section-title"><h3>Grow the youth movement</h3><span class="pill">Coming soon: referrals</span></div>
        <p class="label">Jobs4Youth becomes more powerful when youth, employers and institutions join together. Invite classmates, colleagues, training providers and youth groups to build a stronger opportunity network.</p>
        <div class="notice"><b>Growth idea:</b> every youth who invites 3 verified users can earn a Community Builder badge once referral tracking is activated.</div>
        <div class="hero-actions" style="margin-top:14px;"><button class="secondary" onclick="setView('contact')">Suggest a partner</button><button class="secondary" onclick="setView('about')">Learn about Jobs4Youth</button></div>
      </div>
    </div>
  `;
}

function opportunities() {
  const list = filteredJobs();
  const f = browseFilters.jobs;
  const controls = `
    <label>
      Keyword
      <input value="${escapeHtml(f.keyword)}" placeholder="Search title, organisation, skills" oninput="setOpportunityFilter('keyword', this.value)" />
    </label>
    ${actionSelect('Country', 'oppFilterCountry', OPTION_SETS.countries, f.country, 'All countries').replace('<select id="oppFilterCountry"', `<select id="oppFilterCountry" onchange="setOpportunityFilter('country', this.value)"`)}
    <label>
      Region / City
      <input value="${escapeHtml(f.region)}" placeholder="e.g. Nairobi" oninput="setOpportunityFilter('region', this.value)" />
    </label>
    ${actionSelect('Opportunity type', 'oppFilterType', OPTION_SETS.opportunityTypes, f.type, 'All opportunity types').replace('<select id="oppFilterType"', `<select id="oppFilterType" onchange="setOpportunityFilter('type', this.value)"`)}
    ${actionSelect('Education requirement', 'oppFilterEducation', OPTION_SETS.educationLevels, f.education, 'All education levels').replace('<select id="oppFilterEducation"', `<select id="oppFilterEducation" onchange="setOpportunityFilter('education', this.value)"`)}
    ${actionSelect('Experience requirement', 'oppFilterExperience', OPTION_SETS.experienceLevels, f.experience, 'All experience levels').replace('<select id="oppFilterExperience"', `<select id="oppFilterExperience" onchange="setOpportunityFilter('experience', this.value)"`)}
  `;
  return `
    <div class="grid">
      <div class="card span-12">
        ${onboardingPanel()}
        ${filtersPanel('Search the opportunity marketplace', 'Use structured filters to quickly find roles by keyword, country, location, type and requirements.', controls, 'clearOpportunityFilters')}
        <div class="results-meta">
          <span class="pill pill-verified">${list.length} result${list.length === 1 ? '' : 's'}</span>
          <span class="pill">Verified and visible listings only</span>
          <span class="pill pill-trust">Platform-moderated public marketplace</span>
        </div>
        <div class="notice trust-notice"><b>Trust signal:</b> Jobs4Youth highlights moderated, structured listings to improve public confidence and reduce misleading vacancies.</div>
        <div class="notice"><b>Before you apply:</b> never pay application or interview fees. Use the Report suspicious button if a listing asks for money, requests unusual documents, or redirects you to unsafe channels.</div>
        <div style="margin-top:14px;">
          ${list.length ? list.map(j => jobCard(j, true)).join('') : `
            <div class="empty-card">
              <h4>No opportunities matched your search</h4>
              <p class="label">Try removing one or more filters, widening the location field, or browsing all verified listings.</p>
              <div class="hero-actions">
                <button class="secondary" onclick="clearOpportunityFilters()">Reset opportunity filters</button>
                <button class="secondary" onclick="setView('home')">Return home</button>
              </div>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

function training() {
  const list = filteredCourses();
  const f = browseFilters.courses;
  const controls = `
    <label>
      Keyword
      <input value="${escapeHtml(f.keyword)}" placeholder="Search title, provider, skills" oninput="setCourseFilter('keyword', this.value)" />
    </label>
    ${actionSelect('Country', 'courseFilterCountry', OPTION_SETS.countries, f.country, 'All countries').replace('<select id="courseFilterCountry"', `<select id="courseFilterCountry" onchange="setCourseFilter('country', this.value)"`)}
    <label>
      Region / City
      <input value="${escapeHtml(f.region)}" placeholder="e.g. Remote or Nairobi" oninput="setCourseFilter('region', this.value)" />
    </label>
    ${actionSelect('Delivery mode', 'courseFilterMode', OPTION_SETS.deliveryModes, f.mode, 'All delivery modes').replace('<select id="courseFilterMode"', `<select id="courseFilterMode" onchange="setCourseFilter('mode', this.value)"`)}
  `;
  return `
    <div class="grid">
      <div class="card span-12">
        ${onboardingPanel()}
        ${filtersPanel('Search training and skills pathways', 'Use keyword, location and delivery-mode filters to find relevant verified learning offers.', controls, 'clearCourseFilters')}
        <div class="results-meta">
          <span class="pill pill-verified">${list.length} result${list.length === 1 ? '' : 's'}</span>
          <span class="pill">Curated training catalogue</span>
          <span class="pill pill-trust">Verified learning pathways</span>
        </div>
      </div>
      <div class="card span-12 trust-banner-card"><div class="notice trust-notice"><b>Trust signal:</b> Training offers shown here are intended to support relevant, structured and more credible skills pathways for young people.</div></div>
      ${list.length ? list.map(c => `
        <div class="card span-4 course-card-public ${c.status === 'Verified' ? 'job-verified' : ''}">
          <div class="mini-top">
            ${statusBadge(c.status || 'Verified')}
            ${c.mode ? `<span class="pill">${escapeHtml(c.mode)}</span>` : ''}
          </div>
          <h3>${escapeHtml(c.title)}</h3>
          <p><b>${escapeHtml(c.provider)}</b></p>
          <p class="label">${escapeHtml(c.region || 'Remote')}, ${escapeHtml(c.country || 'Multi-country')}</p>
          <p class="label">${escapeHtml(c.duration || 'Duration available on listing')}</p>
          <div>${(c.skills || '').split(',').filter(Boolean).map(x => `<span class="pill">${escapeHtml(x.trim())}</span>`).join('')}</div>
          <div class="trust-inline">Verified learning offer for public browsing</div>
          <div class="hero-actions" style="margin-top:12px;"><button class="secondary" onclick="saveCourse('${escapeHtml(c.id)}')">${isCourseSaved(c.id) ? 'Saved' : 'Save training'}</button></div>
        </div>
      `).join('') : `
        <div class="card span-12">
          <div class="empty-card">
            <h4>No training matched your search</h4>
            <p class="label">Adjust country, region or delivery mode — or clear filters to browse all visible verified training offers.</p>
            <div class="hero-actions">
              <button class="secondary" onclick="clearCourseFilters()">Reset training filters</button>
              <button class="secondary" onclick="setView('home')">Return home</button>
            </div>
          </div>
        </div>
      `}
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
      ${actionSelect('Young women inclusion indicator','profileGender', OPTION_SETS.genderOptions, state.profile.gender, 'Choose optional indicator')}
      ${actionSelect('Experience level','profileExperience', OPTION_SETS.experienceLevels, state.profile.experience, 'Choose experience')}
      <label class="full">Skills<textarea id="profileSkills">${escapeHtml(state.profile.skills || '')}</textarea></label>
      <label class="full">Interests<textarea id="profileInterests">${escapeHtml(state.profile.interests || '')}</textarea></label>
      <button class="primary full" onclick="saveProfile()">Save profile</button>
    </div>
  `;
}


function organizationProfileForm(label) {
  const verificationState = state.profile.verified ? 'Verified organisation profile' : 'Pending admin verification';
  const verificationText = state.profile.verified
    ? 'Your organisation profile has passed platform verification and can participate with stronger public trust signals.'
    : 'Your organisation profile is saved, and uploaded verification documents plus admin review messages will help complete verification more professionally.';
  const docs = state.verificationDocuments || [];
  const latestDecision = latestVerificationNotification();
  const decisionMessage = latestDecision ? `
    <div class="decision-message-card ${latestDecision.notificationType.includes('rejected') ? 'decision-message-negative' : 'decision-message-positive'}">
      <div class="section-title">
        <div>
          <h4>${escapeHtml(latestDecision.title)}</h4>
          <p class="label">${escapeHtml(latestDecision.body)}</p>
        </div>
        <span class="pill">${escapeHtml(new Date(latestDecision.createdAt).toLocaleDateString())}</span>
      </div>
    </div>
  ` : '';
  const docSummary = docs.length
    ? `<div class="results-meta"><span class="pill pill-verified">${docs.length} uploaded document${docs.length === 1 ? '' : 's'}</span><span class="pill">${docs.filter(d => d.reviewStatus === 'Approved').length} approved</span><span class="pill">${docs.filter(d => d.reviewStatus === 'Pending').length} pending</span></div>`
    : `<div class="soft-note">No verification documents uploaded yet. Upload at least one supporting document to strengthen verification review.</div>`;
  return `
    <div class="form">
      <label>Contact person / name<input id="orgProfileName" value="${escapeHtml(state.profile.name || '')}"/></label>
      <label>${escapeHtml(label)}<input id="orgName" value="${escapeHtml(state.profile.organizationName || '')}"/></label>
      ${actionSelect('Sector','orgSector', OPTION_SETS.sectors, state.profile.sector, 'Choose sector')}
      ${actionSelect('Country','orgCountry', OPTION_SETS.countries, state.profile.country, 'Choose country')}
      <label>Region / City<input id="orgRegion" value="${escapeHtml(state.profile.region || '')}"/></label>
      <div class="full verification-panel ${state.profile.verified ? 'verification-panel-verified' : 'verification-panel-pending'}">
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">${statusBadge(verificationState)} ${state.profile.verified ? '<span class="pill pill-verified">Public trust enabled</span>' : '<span class="pill">Review in progress</span>'}</div>
        <div class="label" style="margin-top:8px;">${escapeHtml(verificationText)}</div>
      </div>
      ${decisionMessage}
      <button class="primary full" onclick="saveOrganizationProfile()">Save organisation profile</button>
      <div class="full verification-docs-panel">
        <div class="section-title"><div><h3>Verification documents</h3><p class="label">${escapeHtml(documentUploadGuidance(state.role))}</p></div><span class="pill">Private upload</span></div>
        ${docSummary}
        <div class="soft-note" style="margin-top:12px;">Verification decisions now also create in-app notifications and email-ready queue records for clearer communication.</div>
        <div class="document-upload-grid">
          <label>
            Document type
            <select id="verificationDocumentType">${renderOptions(OPTION_SETS.verificationDocumentTypes, '', 'Choose document type')}</select>
          </label>
          <label>
            Upload file
            <input id="verificationDocumentFile" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" />
          </label>
        </div>
        <div class="hero-actions" style="margin-top:12px;">
          <button class="primary" onclick="uploadVerificationDocument()">Upload verification document</button>
        </div>
        <div class="label" id="verificationDocumentMessage" style="margin-top:10px;"></div>
        <div class="document-list" style="margin-top:14px;">
          ${docs.length ? docs.map(doc => documentReviewCard(doc, false)).join('') : `<div class="empty-card"><h4>No verification documents uploaded yet</h4><p class="label">Upload registration, tax, licence or authorisation evidence so the admin team can review your organisation faster.</p></div>`}
        </div>
      </div>
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
  const completion = state.role === 'youth' ? youthProfileCompletion() : organisationProfileCompletion();
  const guidance = state.role === 'youth'
    ? completionCard('Youth profile readiness', completion, 'Complete your core profile fields to improve matching and application readiness.', 'Complete youth profile')
    : completionCard('Organisation profile readiness', completion, 'Complete your organisation details to strengthen public trust and moderation readiness.', 'Complete organisation profile');
  return `<div class="grid"><div class="card span-12">${onboardingPanel()}</div><div class="card span-12">${guidance}</div><div class="card span-12"><h3>${heading}</h3>${content}</div></div>`;
}




function getReferralState() {
  try {
    return JSON.parse(localStorage.getItem('jobs4youth_referral_state') || '{}');
  } catch (error) {
    return {};
  }
}
function saveReferralState(data) {
  try {
    localStorage.setItem('jobs4youth_referral_state', JSON.stringify(data || {}));
  } catch (error) {
    console.warn('Could not save referral state:', error);
  }
}
function getReferralCode() {
  const existing = getReferralState();
  if (existing.referralCode) return existing.referralCode;
  const base = (state.profile?.name || currentUser?.email || 'J4Y').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'J4Y';
  const code = `${base}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  saveReferralState({ ...existing, referralCode: code, friendsInvited: existing.friendsInvited || 0, signupsTracked: existing.signupsTracked || 0 });
  return code;
}
function getReferralUrl() {
  const code = getReferralCode();
  const baseUrl = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://jobs4youth.org';
  return `${baseUrl}${window.location.pathname || '/'}?ref=${encodeURIComponent(code)}`;
}
function getChampionStats() {
  const data = getReferralState();
  const friendsInvited = Number(data.friendsInvited || 0);
  const signupsTracked = Number(data.signupsTracked || 0);
  const points = friendsInvited * 5 + signupsTracked * 25;
  let level = 'Starter Champion';
  let nextTarget = 50;
  if (friendsInvited >= 1000 || signupsTracked >= 250) { level = 'Platinum Champion'; nextTarget = 1000; }
  else if (friendsInvited >= 500 || signupsTracked >= 100) { level = 'Gold Champion'; nextTarget = 1000; }
  else if (friendsInvited >= 200 || signupsTracked >= 40) { level = 'Silver Champion'; nextTarget = 500; }
  else if (friendsInvited >= 50 || signupsTracked >= 10) { level = 'Bronze Champion'; nextTarget = 200; }
  return { friendsInvited, signupsTracked, points, level, nextTarget, referralCode: getReferralCode(), referralUrl: getReferralUrl() };
}
function trackInviteClick(channel = 'Share') {
  const data = getReferralState();
  saveReferralState({ ...data, friendsInvited: Number(data.friendsInvited || 0) + 1, lastInviteChannel: channel, lastInviteAt: new Date().toISOString() });
}
window.shareJobs4Youth = function(channel = 'whatsapp') {
  const url = getReferralUrl();
  const message = `Join me on Jobs4Youth. Build your Career Passport, discover verified jobs and internships, access training pathways and use CareerGPS to improve your readiness: ${url}`;
  trackInviteClick(channel);
  if (channel === 'whatsapp') {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    return;
  }
  if (channel === 'facebook') {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener');
    return;
  }
  if (navigator.clipboard) {
    navigator.clipboard.writeText(message).then(() => showUserMessage('Invite message copied. Share it with classmates, youth groups, employers or training providers.'));
  } else {
    prompt('Copy your Jobs4Youth invite message:', message);
  }
};
window.copyReferralLink = function() {
  const url = getReferralUrl();
  trackInviteClick('copy-link');
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => showUserMessage('Referral link copied.'));
  } else {
    prompt('Copy your referral link:', url);
  }
};
window.trackChampionSignup = function() {
  const data = getReferralState();
  saveReferralState({ ...data, signupsTracked: Number(data.signupsTracked || 0) + 1, lastTrackedSignupAt: new Date().toISOString() });
  showUserMessage('Signup tracked locally for your Champion progress. In production this should be connected to live referral signups.');
  render();
};
function launchBanner() {
  return `
    <div class="card span-12 launch-banner-card">
      <div class="section-title">
        <div>
          <div class="kicker">Jobs4Youth is live</div>
          <h3>Build your Career Passport and invite others to join Africa's youth opportunity movement</h3>
          <p class="label">Discover verified opportunities, access training pathways, use CareerGPS and help classmates or youth groups find safer routes to work.</p>
        </div>
        <div class="hero-actions">
          <button class="primary" onclick="openSignup()">Create account</button>
          <button class="secondary" onclick="shareJobs4Youth('whatsapp')">Share on WhatsApp</button>
        </div>
      </div>
    </div>
  `;
}
function socialSharingCentre(compact = false) {
  const stats = getChampionStats();
  return `
    <div class="card ${compact ? '' : 'span-12'} social-sharing-centre">
      <div class="section-title">
        <div>
          <div class="kicker">Growth engine</div>
          <h3>Invite youth, employers and training providers</h3>
          <p class="label">Use your referral link to bring classmates, youth groups and partners into Jobs4Youth. Your Champion progress is tracked locally in this version.</p>
        </div>
        <span class="pill pill-verified">${escapeHtml(stats.level)}</span>
      </div>
      <div class="pathway-summary-row">
        <span class="pathway-summary-item"><strong>Referral code:</strong>&nbsp;${escapeHtml(stats.referralCode)}</span>
        <span class="pathway-summary-item"><strong>Friends invited:</strong>&nbsp;${stats.friendsInvited}</span>
        <span class="pathway-summary-item"><strong>Tracked signups:</strong>&nbsp;${stats.signupsTracked}</span>
        <span class="pathway-summary-item"><strong>Champion points:</strong>&nbsp;${stats.points}</span>
      </div>
      <div class="hero-actions" style="margin-top:14px;">
        <button class="primary" onclick="shareJobs4Youth('whatsapp')">Share on WhatsApp</button>
        <button class="secondary" onclick="shareJobs4Youth('facebook')">Share on Facebook</button>
        <button class="secondary" onclick="copyReferralLink()">Copy referral link</button>
        <button class="secondary" onclick="trackChampionSignup()">Track signup manually</button>
      </div>
    </div>
  `;
}
function campusChampions() {
  const stats = getChampionStats();
  const progressWidth = Math.min(100, Math.round((stats.friendsInvited / Math.max(stats.nextTarget, 1)) * 100));
  return `
    <div class="grid campus-champions-page">
      <div class="card span-12 champion-hero-card">
        <div class="section-title">
          <div>
            <div class="kicker">Jobs4Youth Campus Champions</div>
            <h3>Lead. Connect. Inspire. Empower.</h3>
            <p class="label">Campus Champions help students and young people join Jobs4Youth, build Career Passports, discover verified opportunities and connect with training pathways.</p>
          </div>
          <div class="hero-actions"><button class="primary" onclick="shareJobs4Youth('whatsapp')">Invite youth now</button><button class="secondary" onclick="setView('universities')">University onboarding</button></div>
        </div>
      </div>
      ${socialSharingCentre(false)}
      <div class="card span-6">
        <div class="section-title"><h3>Your Champion progress</h3><span class="pill pill-verified">${escapeHtml(stats.level)}</span></div>
        <div class="metric">${stats.points}</div>
        <p class="label">Champion points from invites and tracked signups.</p>
        <div class="chartbar"><div style="width:${progressWidth}%"></div></div>
        <p class="label" style="margin-top:10px;">Progress to next invite milestone: ${stats.friendsInvited}/${stats.nextTarget}</p>
      </div>
      <div class="card span-6">
        <div class="section-title"><h3>Champion levels</h3><span class="pill">Recognition pathway</span></div>
        <div class="criteria-list">
          <div class="criteria-item ${stats.friendsInvited >= 50 ? 'criteria-pass' : 'criteria-watch'}"><div class="criteria-icon">1</div><div><b>Bronze Champion</b><p class="label">50 youth invited or 10 tracked signups.</p></div></div>
          <div class="criteria-item ${stats.friendsInvited >= 200 ? 'criteria-pass' : 'criteria-watch'}"><div class="criteria-icon">2</div><div><b>Silver Champion</b><p class="label">200 youth invited or 40 tracked signups.</p></div></div>
          <div class="criteria-item ${stats.friendsInvited >= 500 ? 'criteria-pass' : 'criteria-watch'}"><div class="criteria-icon">3</div><div><b>Gold Champion</b><p class="label">500 youth invited or 100 tracked signups.</p></div></div>
          <div class="criteria-item ${stats.friendsInvited >= 1000 ? 'criteria-pass' : 'criteria-watch'}"><div class="criteria-icon">4</div><div><b>Platinum Champion</b><p class="label">1,000 youth invited or 250 tracked signups.</p></div></div>
        </div>
      </div>
      <div class="card span-12">
        <div class="section-title"><h3>What Campus Champions do</h3><span class="pill pill-trust">Launch playbook</span></div>
        <div class="trust-grid">
          <div class="trust-card"><h4>Recruit youth</h4><p class="label">Invite classmates, WhatsApp groups, youth clubs and alumni networks to create Career Passports.</p></div>
          <div class="trust-card"><h4>Host onboarding sessions</h4><p class="label">Run short demos showing how to complete profiles, use CareerGPS, save opportunities and apply safely.</p></div>
          <div class="trust-card"><h4>Source opportunities</h4><p class="label">Identify employers and training providers that can post verified opportunities or learning pathways.</p></div>
          <div class="trust-card"><h4>Share feedback</h4><p class="label">Collect youth feedback on barriers, missing sectors, trust concerns and new features needed.</p></div>
        </div>
      </div>
      <div class="card span-12 champion-badge-card">
        <div class="section-title">
          <div><h3>Proud to be a Jobs4Youth Champion</h3><p class="label">Use this badge text on LinkedIn, WhatsApp status or student group announcements.</p></div>
          <button class="secondary" onclick="copyReferralLink()">Copy my referral link</button>
        </div>
        <div class="notice"><b>Badge text:</b> I am a Jobs4Youth Campus Champion, helping young people build Career Passports, access verified opportunities and move toward dignified work.</div>
      </div>
    </div>
  `;
}
function universitiesPage() {
  return `
    <div class="grid university-page">
      <div class="card span-12">
        <div class="section-title">
          <div>
            <div class="kicker">University and TVET onboarding</div>
            <h3>The Career Passport platform for students and graduates</h3>
            <p class="label">Jobs4Youth helps universities, TVETs and agricultural colleges connect students to verified opportunities, skills pathways and employability intelligence.</p>
          </div>
          <div class="hero-actions"><button class="primary" onclick="setView('contact')">Request onboarding</button><button class="secondary" onclick="shareJobs4Youth('whatsapp')">Share with a student group</button></div>
        </div>
      </div>
      <div class="card span-6">
        <h3>Onboarding plan</h3>
        <div class="criteria-list" style="margin-top:14px;">
          <div class="criteria-item criteria-pass"><div class="criteria-icon">1</div><div><b>Launch demo</b><p class="label">Run a 30-minute orientation for students and career offices.</p></div></div>
          <div class="criteria-item criteria-pass"><div class="criteria-icon">2</div><div><b>Profile completion sprint</b><p class="label">Help students complete Career Passports and add skills, interests and availability.</p></div></div>
          <div class="criteria-item criteria-pass"><div class="criteria-icon">3</div><div><b>Opportunity matching week</b><p class="label">Guide students to save opportunities, training pathways and submit stronger applications.</p></div></div>
          <div class="criteria-item criteria-pass"><div class="criteria-icon">4</div><div><b>Insights report</b><p class="label">Share skills demand, training gaps and student readiness insights with the institution.</p></div></div>
        </div>
      </div>
      <div class="card span-6">
        <h3>Value for institutions</h3>
        <div class="trust-grid single-column">
          <div class="trust-card"><h4>Graduate employability analytics</h4><p class="label">Understand student readiness, skills gaps and opportunity interests.</p></div>
          <div class="trust-card"><h4>Employer connections</h4><p class="label">Invite employers to post internships, apprenticeships and entry-level opportunities.</p></div>
          <div class="trust-card"><h4>Training alignment</h4><p class="label">Use demand signals to improve short courses, bootcamps and career services.</p></div>
        </div>
      </div>
      <div class="card span-12">
        <div class="section-title"><h3>Employer recruitment email template</h3><button class="secondary" onclick="copyEmployerEmailTemplate()">Copy template</button></div>
        <div class="support-admin-note"><b>Subject:</b> Find Job-Ready Youth Faster with Jobs4Youth<br><br>Hello,<br><br>Jobs4Youth is helping employers connect with verified, job-ready young talent. Through the platform, employers can post vacancies, receive structured applications, use candidate match scores and build youth talent pipelines. Participation is free during our growth phase. We would be delighted to onboard your organisation.<br><br>Register here: ${escapeHtml(window.location.origin || 'https://jobs4youth.org')}<br><br>Best regards,<br>Jobs4Youth Team</div>
      </div>
    </div>
  `;
}
window.copyEmployerEmailTemplate = function() {
  const body = `Subject: Find Job-Ready Youth Faster with Jobs4Youth\n\nHello,\n\nJobs4Youth is helping employers connect with verified, job-ready young talent. Through the platform, employers can post vacancies, receive structured applications, use candidate match scores and build youth talent pipelines. Participation is free during our growth phase. We would be delighted to onboard your organisation.\n\nRegister here: ${window.location.origin || 'https://jobs4youth.org'}\n\nBest regards,\nJobs4Youth Team`;
  if (navigator.clipboard) navigator.clipboard.writeText(body).then(() => showUserMessage('Employer recruitment email copied.'));
  else prompt('Copy employer email template:', body);
};
function launchToolkit() {
  return `
    <div class="grid launch-toolkit-page">
      <div class="card span-12">
        <div class="section-title">
          <div><div class="kicker">Launch toolkit</div><h3>Ready-to-use growth copy for Jobs4Youth</h3><p class="label">Use these messages for partners, funders and youth sign-up campaigns.</p></div>
          <button class="primary" onclick="shareJobs4Youth('whatsapp')">Share Jobs4Youth</button>
        </div>
      </div>
      <div class="card span-6"><h3>Partner and funder pitch</h3><p>Jobs4Youth is Africa's digital youth employment infrastructure, connecting young people to verified work, skills pathways and labour-market intelligence.</p><div class="notice"><b>30-second pitch:</b> Jobs4Youth helps youth build Career Passports, assess readiness through CareerGPS, identify skills gaps, access verified opportunities and progress toward meaningful work while generating labour-market intelligence for employers, institutions and funders.</div></div>
      <div class="card span-6"><h3>Mastercard-style concept note summary</h3><p><b>Title:</b> Accelerating Youth Employment Through Digital Career Pathways and Labour Market Intelligence.</p><p class="label"><b>Solution:</b> Career Passport, CareerGPS, Opportunity Marketplace, Skills Pathways and Labour Market Signal Layer.</p><p class="label"><b>Expected results:</b> increased youth access to work, improved employability, stronger training alignment and better labour-market intelligence.</p></div>
      <div class="card span-12"><div class="section-title"><h3>Social media campaign copy</h3><span class="pill">Youth sign-ups</span></div><div class="mini-grid"><div class="mini-card"><h4>Post 1</h4><p class="label">The problem is not that young people lack potential. The problem is that opportunities are scattered, hidden and difficult to trust. Jobs4Youth changes that with verified jobs, internships, skills pathways, CareerGPS and Career Passports.</p></div><div class="mini-card"><h4>Post 2</h4><p class="label">Stop applying blindly. Build your Career Passport, know your readiness score, identify skills gaps and find opportunities matched to you. That is Jobs4Youth.</p></div><div class="mini-card"><h4>Post 3</h4><p class="label">Africa does not have a youth problem. Africa has an opportunity connection problem. Jobs4Youth is building the bridge.</p></div></div></div>
    </div>
  `;
}

function isYoungWomanProfile(profile = state.profile, role = state.role) {
  return role === 'youth' && String(profile?.gender || '').toLowerCase().includes('woman');
}
function getImpactMetrics() {
  const verifiedOpportunities = (state.jobs || []).filter(job => job.status === 'Verified').length;
  const verifiedTraining = (state.courses || []).filter(course => course.status === 'Verified').length;
  const applicationsSubmitted = (state.applications || []).length + (state.employerCandidates || []).length;
  const visibleYouthReached = Number((state.signalLayer?.countrySignals || []).reduce((sum, item) => sum + Number(item.youthProfiles || 0), 0)) || (state.role === 'youth' ? 1 : 0);
  const youngWomenReached = isYoungWomanProfile() ? 1 : 0;
  const skillGapCount = Number((state.signalLayer?.skillGap || []).reduce((sum, item) => sum + Number(item.gapCount || 0), 0)) || 0;
  const trainingGapCount = Number((state.signalLayer?.trainingGap || []).reduce((sum, item) => sum + Number(item.trainingGapCount || 0), 0)) || 0;
  const savedLearning = (state.savedCourses || []).length;
  const skillsGapsClosedProxy = Math.max(0, savedLearning + Math.min(applicationsSubmitted, verifiedTraining));
  return {
    visibleYouthReached,
    youngWomenReached,
    applicationsSubmitted,
    verifiedOpportunities,
    verifiedTraining,
    skillGapCount,
    trainingGapCount,
    skillsGapsClosedProxy,
    countriesTracked: (state.signalLayer?.countrySignals || []).length || new Set([...(state.jobs || []).map(j => j.country), ...(state.courses || []).map(c => c.country)].filter(Boolean)).size
  };
}
function impactMetricCard(titleText, value, bodyText, badge = '') {
  return `
    <div class="card span-3 impact-metric-card">
      <div class="section-title"><div class="label">${escapeHtml(titleText)}</div>${badge ? `<span class="pill">${escapeHtml(badge)}</span>` : ''}</div>
      <div class="metric">${escapeHtml(String(value))}</div>
      <div class="label">${escapeHtml(bodyText)}</div>
    </div>
  `;
}
function countryIntelligencePanel() {
  const countries = signalTopItems(state.signalLayer?.countrySignals || [], 8);
  const fallbackCountries = Object.values([...(state.jobs || []), ...(state.courses || [])].reduce((acc, item) => {
    const country = item.country || 'Unspecified';
    acc[country] = acc[country] || { country, youthProfiles: 0, employers: 0, institutions: 0, verifiedOpportunities: 0, verifiedCourses: 0, applicationsTotal: 0 };
    if (item.title && item.org && item.status === 'Verified') acc[country].verifiedOpportunities += 1;
    if (item.provider && item.status === 'Verified') acc[country].verifiedCourses += 1;
    return acc;
  }, {}));
  const list = countries.length ? countries : fallbackCountries;
  return `
    <div class="card span-12 country-intelligence-card">
      <div class="section-title">
        <div>
          <div class="kicker">Country-level labour-market intelligence</div>
          <h3>Where youth demand, opportunities and training pathways are emerging</h3>
          <p class="label">This view helps funders, governments and delivery partners identify activity patterns by country and spot where ecosystem support is needed.</p>
        </div>
        <span class="pill pill-trust">Partner intelligence view</span>
      </div>
      <div class="mini-grid ${list.length > 3 ? '' : 'single-column'}">
        ${list.length ? list.map(item => `
          <div class="mini-card">
            <div class="section-title">
              <div><h4>${escapeHtml(item.country || 'Unspecified')}</h4><p class="label">Youth: ${item.youthProfiles || 0} • Employers: ${item.employers || 0} • Institutions: ${item.institutions || 0}</p></div>
              <span class="pill pill-verified">${item.verifiedOpportunities || 0} opportunities</span>
            </div>
            <p class="label">Training pathways: ${item.verifiedCourses || 0} • Applications: ${item.applicationsTotal || 0}</p>
          </div>
        `).join('') : `<div class="empty-card"><h4>No country intelligence yet</h4><p class="label">Country intelligence will populate as youth profiles, opportunities, training offers and applications grow.</p></div>`}
      </div>
    </div>
  `;
}
function impactEvidence() {
  const m = getImpactMetrics();
  const topDemand = signalTopItems(state.signalLayer?.skillDemand || [], 5);
  const topGaps = signalTopItems(state.signalLayer?.skillGap || [], 5);
  const trainingGaps = signalTopItems(state.signalLayer?.trainingGap || [], 5);
  return `
    <div class="grid impact-evidence-page">
      <div class="card span-12 impact-hero-card">
        <div class="section-title">
          <div>
            <div class="kicker">Funder-ready impact evidence</div>
            <h3>Jobs4Youth impact dashboard</h3>
            <p class="label">A live evidence layer for tracking youth reach, young women inclusion, applications, verified opportunities, training pathways, skills gaps and country-level labour-market intelligence.</p>
          </div>
          <div class="hero-actions"><button class="primary" onclick="openSignup()">Join the platform</button><button class="secondary" onclick="setView('contact')">Discuss partnership</button></div>
        </div>
        <div class="notice"><b>Evidence principle:</b> Jobs4Youth is being designed to move beyond counting vacancies. It tracks the pathway from youth profile creation to readiness, skills development, applications and market intelligence.</div>
      </div>

      ${impactMetricCard('Youth reached', m.visibleYouthReached, 'Visible youth profile count from signal layer, or current youth profile where aggregate data is not yet available.', 'Reach')}
      ${impactMetricCard('Young women reached', m.youngWomenReached, 'Gender-responsive indicator based on visible youth profile gender information. Expand after adding aggregate gender reporting.', 'Inclusion')}
      ${impactMetricCard('Applications submitted', m.applicationsSubmitted, 'Applications visible to the current user or employer workspace.', 'Work pathway')}
      ${impactMetricCard('Verified opportunities', m.verifiedOpportunities, 'Moderated roles publicly visible to youth.', 'Trust')}
      ${impactMetricCard('Training pathways', m.verifiedTraining, 'Verified learning offers that can close skills gaps.', 'Skills')}
      ${impactMetricCard('Skills gaps closed', m.skillsGapsClosedProxy, 'Proxy indicator using saved training and applications until completion tracking is added.', 'Proxy')}
      ${impactMetricCard('Open skill gaps', m.skillGapCount, 'Unmet demand signals from opportunity requirements versus visible youth skills.', 'Market signal')}
      ${impactMetricCard('Countries tracked', m.countriesTracked, 'Countries with visible platform activity across opportunities, training or signal data.', 'Scale')}

      <div class="card span-4">
        <div class="section-title"><h3>Most requested skills</h3><span class="pill pill-verified">Demand</span></div>
        ${topDemand.length ? topDemand.map(item => `<p><b>${escapeHtml(item.skillName)}</b><br><span class="label">${escapeHtml(item.country || '')}${item.region ? ' • ' + escapeHtml(item.region) : ''} • ${item.opportunitiesCount || 0} opportunities</span></p>`).join('') : `<div class="empty-card"><h4>No demand signals yet</h4><p class="label">Verified opportunity skill requirements will populate this panel.</p></div>`}
      </div>
      <div class="card span-4">
        <div class="section-title"><h3>Largest youth skill gaps</h3><span class="pill">Supply gap</span></div>
        ${topGaps.length ? topGaps.map(item => `<p><b>${escapeHtml(item.skillName)}</b><br><span class="label">Demand: ${item.demandOpportunities || 0} • Youth supply: ${item.youthSupply || 0} • Gap: ${item.gapCount || 0}</span></p>`).join('') : `<div class="empty-card"><h4>No skill gap data yet</h4><p class="label">Skill gaps will strengthen as youth profiles and opportunity requirements grow.</p></div>`}
      </div>
      <div class="card span-4">
        <div class="section-title"><h3>Training gaps</h3><span class="pill">Institution signal</span></div>
        ${trainingGaps.length ? trainingGaps.map(item => `<p><b>${escapeHtml(item.skillName)}</b><br><span class="label">Demand: ${item.demandOpportunities || 0} • Courses: ${item.verifiedCoursesCoveringSkill || 0} • Gap: ${item.trainingGapCount || 0}</span></p>`).join('') : `<div class="empty-card"><h4>No training gap data yet</h4><p class="label">Training gaps will show where institutions can create new pathways.</p></div>`}
      </div>

      ${countryIntelligencePanel()}

      <div class="card span-12 partner-proof-card">
        <div class="section-title">
          <div>
            <div class="kicker">Why funders should care</div>
            <h3>Jobs4Youth converts platform activity into measurable youth employment evidence</h3>
            <p class="label">The dashboard is structured around a funder logic model: reach youth, include young women, verify opportunities, connect applications, guide training pathways, close skills gaps and generate country intelligence.</p>
          </div>
          <span class="pill pill-verified">Impact evidence layer</span>
        </div>
        <div class="trust-grid">
          <div class="trust-card"><h4>Reach</h4><p class="label">Track how many young people are visible in the system and where activity is growing.</p></div>
          <div class="trust-card"><h4>Inclusion</h4><p class="label">Add gender-responsive reporting so partners can monitor young women reached and supported.</p></div>
          <div class="trust-card"><h4>Pathways</h4><p class="label">Connect youth profiles to applications, training pathways and readiness improvements.</p></div>
          <div class="trust-card"><h4>Systems change</h4><p class="label">Use country and skills intelligence to improve decisions by employers, institutions, governments and donors.</p></div>
        </div>
      </div>
    </div>
  `;
}

function getEmployerShortlist() {
  try {
    return JSON.parse(localStorage.getItem('jobs4youth_employer_shortlist') || '[]');
  } catch (error) {
    return [];
  }
}
function saveEmployerShortlist(items) {
  try {
    localStorage.setItem('jobs4youth_employer_shortlist', JSON.stringify(items || []));
  } catch (error) {
    console.warn('Could not save employer shortlist:', error);
  }
}
function isCandidateShortlisted(candidateId) {
  return getEmployerShortlist().some(item => String(item.candidateId) === String(candidateId));
}
window.shortlistCandidate = function(candidateId) {
  const candidate = (state.employerCandidates || []).find(item => String(item.id) === String(candidateId));
  if (!candidate) return showUserMessage('Candidate not found. Please refresh and try again.');
  const current = getEmployerShortlist();
  if (current.some(item => String(item.candidateId) === String(candidateId))) {
    showUserMessage('This candidate is already in your shortlist.');
    return;
  }
  current.unshift({
    candidateId: candidate.id,
    applicantName: candidate.applicantName,
    opportunityTitle: candidate.opportunityTitle,
    candidateEmail: candidate.applicantEmail || '',
    matchScore: candidateMatchScore(candidate),
    createdAt: new Date().toISOString()
  });
  saveEmployerShortlist(current.slice(0, 100));
  showUserMessage('Candidate added to employer shortlist.');
  render();
};
window.removeShortlistedCandidate = function(candidateId) {
  const next = getEmployerShortlist().filter(item => String(item.candidateId) !== String(candidateId));
  saveEmployerShortlist(next);
  render();
};
function candidateMatchScore(candidate) {
  const matchingJob = (state.jobs || []).find(job => String(job.title || '').toLowerCase() === String(candidate.opportunityTitle || '').toLowerCase()) || {};
  const candidateWords = new Set(words([candidate.skills, candidate.education, candidate.experience, candidate.region, candidate.country].join(' ')));
  const jobWords = words([matchingJob.skills, matchingJob.education, matchingJob.experience, matchingJob.region, matchingJob.country, matchingJob.type].join(' '));
  let hits = 0;
  jobWords.forEach(item => { if (candidateWords.has(item)) hits += 1; });
  let score = jobWords.length ? Math.round((hits / Math.max(jobWords.length, 1)) * 65) + 25 : 55;
  if (candidate.country && matchingJob.country && candidate.country === matchingJob.country) score += 8;
  if (candidate.region && matchingJob.region && candidate.region === matchingJob.region) score += 7;
  if (candidate.skills) score += 5;
  if (candidate.education) score += 3;
  return Math.min(98, Math.max(35, score));
}
function employerTrustBadge() {
  if (state.profile.verified) return `<span class="pill pill-verified">Verified employer trust badge</span>`;
  return `<span class="pill">Verification pending</span>`;
}
function employerConversionPanel() {
  return `
    <div class="card span-12 employer-conversion-panel">
      <div class="section-title">
        <div>
          <div class="kicker">For employers</div>
          <h3>Find job-ready youth faster, with better signals and less noise</h3>
          <p class="label">Post verified opportunities, receive structured applications, compare candidate match scores and shortlist promising youth through a more trusted hiring workflow.</p>
        </div>
        <button class="primary" onclick="openSignup()">Create employer account</button>
      </div>
      <div class="trust-grid">
        <div class="trust-card"><h4>Verified employer presence</h4><p class="label">Build confidence with organisation profiles, verification documents and trust badges.</p></div>
        <div class="trust-card"><h4>Candidate match score</h4><p class="label">Quickly see which applicants best align with role skills, location, education and experience needs.</p></div>
        <div class="trust-card"><h4>Shortlist faster</h4><p class="label">Save promising candidates into a structured shortlist for follow-up and interviews.</p></div>
        <div class="trust-card"><h4>Hiring intelligence</h4><p class="label">Track posted roles, applications received, thin pipelines and candidate readiness signals.</p></div>
      </div>
    </div>
  `;
}

function employerDash() {
  const myJobs = currentUser ? state.jobs.filter(j => j.postedBy === currentUser.id) : [];
  const completion = organisationProfileCompletion();
  const activeJobs = myJobs.filter(j => j.status === 'Verified').length;
  const pendingJobs = myJobs.filter(j => j.status === 'Pending').length;
  const candidates = state.employerCandidates || [];
  const shortlist = getEmployerShortlist();
  const strongMatches = candidates.filter(candidate => candidateMatchScore(candidate) >= 75).length;
  const thinPipelines = myJobs.filter(job => !candidates.some(candidate => candidate.opportunityTitle === job.title)).length;
  return `
    <div class="grid employer-command-centre">
      <div class="card span-12 employer-hero-card">
        <div class="section-title">
          <div>
            <div class="kicker">Employer hiring cockpit</div>
            <h3>Find job-ready youth faster</h3>
            <p class="label">Post trusted opportunities, receive structured applications, compare candidate match scores and build a shortlist of promising young talent.</p>
          </div>
          <div class="job-badges">${employerTrustBadge()}<span class="pill">${completion}% profile complete</span></div>
        </div>
        <div class="hero-actions" style="margin-top:14px;">
          <button class="primary" onclick="setView('post opportunity')">Post a real opportunity</button>
          <button class="secondary" onclick="setView('candidates')">Review candidates</button>
          <button class="secondary" onclick="setView('profile')">Strengthen trust badge</button>
        </div>
      </div>

      <div class="card span-3"><div class="label">Posted roles</div><div class="metric">${myJobs.length}</div><div class="label">All opportunities created by your account</div></div>
      <div class="card span-3"><div class="label">Verified live roles</div><div class="metric">${activeJobs}</div><div class="label">Publicly visible after moderation</div></div>
      <div class="card span-3"><div class="label">Candidate applications</div><div class="metric">${candidates.length}</div><div class="label">Structured applications received</div></div>
      <div class="card span-3"><div class="label">Shortlisted youth</div><div class="metric">${shortlist.length}</div><div class="label">Saved for follow-up review</div></div>

      <div class="card span-8">
        <div class="section-title"><div><h3>Your hiring pipeline</h3><p class="label">Track which vacancies are live, pending, receiving candidates or need more promotion.</p></div><button class="secondary" onclick="setView('post opportunity')">Post new</button></div>
        <div class="detail-two-column">
          <div class="detail-box"><h4>Strong candidate matches</h4><div class="metric">${strongMatches}</div><p class="label">Applicants scoring 75% or higher against role signals.</p></div>
          <div class="detail-box"><h4>Thin pipelines</h4><div class="metric">${thinPipelines}</div><p class="label">Posted roles with no visible applications yet.</p></div>
          <div class="detail-box"><h4>Pending review</h4><div class="metric">${pendingJobs}</div><p class="label">Roles waiting for admin verification before stronger visibility.</p></div>
          <div class="detail-box"><h4>Trust readiness</h4><div class="metric">${completion}%</div><p class="label">Organisation profile completeness and employer credibility signal.</p></div>
        </div>
        <div class="notice" style="margin-top:14px;"><b>Conversion message:</b> Employers win on Jobs4Youth by posting clear, verified roles and using match scores to focus on the most relevant youth first.</div>
      </div>

      <div class="card span-4">
        <div class="section-title"><h3>Employer trust badge</h3>${employerTrustBadge()}</div>
        <p class="label">Youth are more likely to apply when an employer profile looks complete, verified and professional.</p>
        ${completionCard('Employer profile readiness', completion, 'Complete organisation details and upload verification documents to strengthen public trust.', 'Complete employer profile')}
      </div>

      <div class="card span-7">
        <div class="section-title"><h3>Your posted opportunities</h3><button class="secondary" onclick="setView('post opportunity')">Post new</button></div>
        ${myJobs.length ? myJobs.map(j => jobCard(j, false)).join('') : `<div class="empty-card"><h4>No opportunities posted yet</h4><p class="label">Post your first clear, youth-friendly opportunity to start attracting matched candidates.</p><button class="primary" onclick="setView('post opportunity')">Post your first opportunity</button></div>`}
      </div>

      <div class="card span-5">
        <div class="section-title"><h3>Shortlisted candidates</h3><button class="secondary" onclick="setView('candidates')">Open candidates</button></div>
        ${shortlist.length ? shortlist.slice(0, 5).map(item => `
          <div class="shortlist-item-card">
            <div><h4>${escapeHtml(item.applicantName || 'Candidate')}</h4><p class="label">${escapeHtml(item.opportunityTitle || 'Opportunity')} • Match ${item.matchScore || 0}%</p></div>
            <button class="secondary" onclick="removeShortlistedCandidate('${escapeHtml(item.candidateId)}')">Remove</button>
          </div>
        `).join('') : `<div class="empty-card"><h4>No shortlisted candidates yet</h4><p class="label">Open candidate applications and shortlist promising youth for follow-up.</p><button class="secondary" onclick="setView('candidates')">Review candidates</button></div>`}
      </div>
    </div>
  `;
}

function postOpportunity() {
  return `
    <div class="card">
      <div class="section-title"><h3>Post a new opportunity</h3><span class="pill">Professional form</span></div>
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
  await loadJobsFromSupabase();
  alert('✅ Opportunity posted successfully! It is now pending admin verification.');
  setView('dashboard');
};

function candidates() {
  const candidates = state.employerCandidates || [];
  return `
    <div class="grid candidate-review-page">
      <div class="card span-12">
        <div class="section-title">
          <div>
            <div class="kicker">Candidate review</div>
            <h3>Prioritise the most relevant youth first</h3>
            <p class="label">Use candidate match scores, profile signals and shortlisting to move faster from application volume to hiring quality.</p>
          </div>
          <button class="primary" onclick="setView('post opportunity')">Post another opportunity</button>
        </div>
        <div class="notice"><b>Hiring tip:</b> Start with candidates above 75%, then review motivation and availability before inviting candidates for the next step.</div>
      </div>
      <div class="card span-12">
        ${candidates.length ? candidates.map(c => {
          const score = candidateMatchScore(c);
          const shortlisted = isCandidateShortlisted(c.id);
          const scoreClass = score >= 75 ? 'readiness-strong' : score >= 55 ? 'readiness-medium' : 'readiness-emerging';
          return `
            <div class="job candidate-match-card ${shortlisted ? 'job-verified' : ''}">
              <div>
                <div class="job-header-row">
                  <h3>${escapeHtml(c.applicantName)}</h3>
                  <div class="job-badges">
                    ${statusBadge(c.status)}
                    ${shortlisted ? '<span class="pill pill-verified">Shortlisted</span>' : '<span class="pill">Not shortlisted</span>'}
                  </div>
                </div>
                <p><b>${escapeHtml(c.opportunityTitle)}</b> • ${escapeHtml(c.region)}, ${escapeHtml(c.country)} • ${escapeHtml(c.education || 'Education not provided')}</p>
                <p>${escapeHtml(c.skills || 'No skills listed.')}</p>
                <div class="pathway-summary-row">
                  ${c.applicantEmail ? `<span class="pathway-summary-item">${escapeHtml(c.applicantEmail)}</span>` : ''}
                  ${c.experience ? `<span class="pathway-summary-item">Experience: ${escapeHtml(c.experience)}</span>` : ''}
                  <span class="pathway-summary-item">Match band: ${score >= 75 ? 'Strong' : score >= 55 ? 'Possible' : 'Needs review'}</span>
                </div>
                <div class="hero-actions" style="margin-top:12px;">
                  ${shortlisted ? `<button class="secondary" onclick="removeShortlistedCandidate('${escapeHtml(c.id)}')">Remove from shortlist</button>` : `<button class="primary" onclick="shortlistCandidate('${escapeHtml(c.id)}')">Shortlist candidate</button>`}
                  ${c.applicantEmail ? `<a class="secondary" href="mailto:${escapeHtml(c.applicantEmail)}?subject=Jobs4Youth application follow-up">Contact candidate</a>` : ''}
                </div>
              </div>
              <div class="fit ${scoreClass}" style="--score:${score}"><span>${score}%</span></div>
            </div>
          `;
        }).join('') : `<div class="empty-card"><h4>No applications received yet</h4><p class="label">Once candidates apply to your opportunities, they will appear here with profile details, match scores and shortlist actions.</p><button class="secondary" onclick="setView('post opportunity')">Post opportunity</button></div>`}
      </div>
    </div>
  `;
}

function institutionDash() {
  const myCourses = currentUser ? state.courses.filter(c => c.postedBy === currentUser.id) : [];
  const completion = organisationProfileCompletion();
  return `
    ${onboardingPanel()}
    ${completionCard('Institution profile readiness', completion, 'Complete your provider information to strengthen learner confidence and training discoverability.', 'Complete institution profile')}
    ${metrics()}
    <div class="grid" style="margin-top:18px">
      <div class="card span-6"><div class="section-title"><h3>Your training catalogue</h3><button class="secondary" onclick="setView('post training')">Post training</button></div>${myCourses.length ? myCourses.map(c => `<p><b>${escapeHtml(c.title)}</b><br><span class="label">${escapeHtml(c.provider)} • ${escapeHtml(c.mode)} • ${escapeHtml(c.duration)} • ${escapeHtml(c.region)}, ${escapeHtml(c.country)}</span><br>${statusBadge(c.status)}</p>`).join('') : `<div class="empty-card"><h4>No courses posted yet</h4><p class="label">Publish your first training offer to begin building a visible learning catalogue on the platform.</p><button class="secondary" onclick="setView('post training')">Post first training</button></div>`}</div>
      <div class="card span-6"><div class="section-title"><h3>Demand signals</h3><button class="secondary" onclick="setView('insights')">Open signal layer</button></div>${signalTopItems(state.signalLayer.trainingGap, 4).length ? signalTopItems(state.signalLayer.trainingGap, 4).map(item => `<p><b>${escapeHtml(item.skillName)}</b><br><span class="label">${escapeHtml(item.country)} • training gap ${item.trainingGapCount || 0} • demand ${item.demandOpportunities || 0}</span></p>`).join('') : `${bar('Food safety', 92)}${bar('Record keeping', 78)}${bar('Mechanization', 61)}${bar('Quality control', 57)}`}</div>
    </div>
  `;
}

function postTraining() {
  return `
    <div class="card">
      <div class="section-title"><h3>Post training course</h3><span class="pill">Professional form</span></div>
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
  await loadCoursesFromSupabase();
  alert('✅ Training course posted successfully! It is now pending admin verification.');
  setView('dashboard');
};

function courses() { return training(); }


function verificationCard(item) {
  const docSection = ['employer','institution'].includes(item.itemType)
    ? `
      <div class="verification-docs-inline">
        <h4 style="margin:12px 0 8px;">Verification documents</h4>
        ${item.documents && item.documents.length ? item.documents.map(doc => documentReviewCard(doc, true)).join('') : `<div class="soft-note">No verification documents uploaded yet for this organisation.</div>`}
      </div>
    `
    : '';
  const details = item.itemType === 'opportunity' && item.opportunity ? `
    <p><b>${escapeHtml(item.opportunity.title)}</b></p>
    <p class="label">${escapeHtml(item.opportunity.organization_name || '')} • ${escapeHtml(item.opportunity.region || '')}, ${escapeHtml(item.opportunity.country || '')}</p>
  ` : item.itemType === 'course' && item.course ? `
    <p><b>${escapeHtml(item.course.title)}</b></p>
    <p class="label">${escapeHtml(item.course.provider_name || '')} • ${escapeHtml(item.course.region || '')}, ${escapeHtml(item.course.country || '')}</p>
  ` : `
    <p><b>${escapeHtml(title(item.itemType))} verification</b></p>
    <p class="label">${escapeHtml(item.ownerName)} ${item.ownerEmail ? '• ' + escapeHtml(item.ownerEmail) : ''}</p>
    ${item.ownerOrg ? `<p class="label">${escapeHtml(item.ownerOrg)} • ${escapeHtml(item.ownerRegion || '')}, ${escapeHtml(item.ownerCountry || '')}</p>` : ''}
  `;
  return `
    <div class="job verification-job">
      <div>
        <h3>${escapeHtml(title(item.itemType))} • ${escapeHtml(item.reviewStatus)}</h3>
        ${details}
        ${docSection}
        <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;">${item.reviewStatus === 'Pending' ? `<button class="primary" onclick="reviewVerification('${item.id}','Approved')">Approve</button><button class="secondary" onclick="reviewVerification('${item.id}','Rejected')">Reject</button>` : ''}</div>
      </div>
      <div class="fit" style="--score:${item.reviewStatus === 'Approved' ? 100 : item.reviewStatus === 'Rejected' ? 30 : 60}"><span>${item.reviewStatus === 'Approved' ? '✓' : item.reviewStatus === 'Rejected' ? '✕' : '…'}</span></div>
    </div>
  `;
}



function adminDash() {
  const pendingCount = state.verificationItems.filter(i => i.reviewStatus === 'Pending').length;
  const unread = latestUnreadCount();
  const topSkill = state.signalLayer.skillDemand[0]?.skillName || 'No demand signal yet';
  const topGap = state.signalLayer.skillGap[0]?.skillName || 'No gap signal yet';
  return `
    ${metrics()}
    <div class="grid" style="margin-top:18px">
      <div class="card span-3"><div class="label">Pending verification items</div><div class="metric">${pendingCount}</div></div>
      <div class="card span-3"><div class="label">Unread notifications</div><div class="metric">${unread}</div></div>
      <div class="card span-3"><div class="label">Top requested skill</div><div class="metric" style="font-size:24px;">${escapeHtml(topSkill)}</div></div>
      <div class="card span-3"><div class="label">Top unmet gap</div><div class="metric" style="font-size:24px;">${escapeHtml(topGap)}</div></div>
    </div>
    <div class="grid" style="margin-top:18px">
      <div class="card span-7">
        <div class="section-title"><h3>Verification queue</h3><button class="secondary" onclick="setView('verification')">Open queue</button></div>
        <p class="label">Approve organisations, opportunities and courses from one place with document evidence and queued decision notifications.</p>
        <div class="soft-note" style="margin-top:10px;">The new Labour Market Signal Layer now turns platform behaviour into institution-grade intelligence for governments, donors and market actors.</div>
      </div>
      <div class="card span-5">
        <div class="section-title"><h3>Signal layer highlights</h3><button class="secondary" onclick="setView('insights')">Open insights dashboard</button></div>
        <p class="label">• requested skills by geography<br>• youth skill supply vs demand<br>• training gaps for institutions<br>• employer hiring bottlenecks<br>• under-served youth segments</p>
      </div>
    </div>
  `;
}


function verification() {
  const pending = state.verificationItems.filter(i => i.reviewStatus === 'Pending');
  const reviewed = state.verificationItems.filter(i => i.reviewStatus !== 'Pending');
  return `<div class="grid"><div class="card span-12"><div class="section-title"><h3>Admin verification queue</h3><button class="secondary" onclick="refreshAdminQueue()">Refresh queue</button></div><div class="label" id="verificationMessage"></div><h4 style="margin-top:12px;">Pending items</h4>${pending.length ? pending.map(verificationCard).join('') : '<p class="label">No pending verification items.</p>'}<h4 style="margin-top:18px;">Reviewed items</h4>${reviewed.length ? reviewed.map(verificationCard).join('') : '<p class="label">No reviewed items yet.</p>'}</div></div>`;
}



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
    const updates = { updated_at: new Date().toISOString(), status: approved ? 'Verified' : 'Rejected' };
    const { error } = await supabase.from('opportunities').update(updates).eq('id', item.itemId);
    if (error) { if (msg) msg.textContent = `Failed to update opportunity: ${error.message}`; return; }
  }
  if (item.itemType === 'course' && item.itemId) {
    const updates = { updated_at: new Date().toISOString(), status: approved ? 'Verified' : 'Rejected' };
    const { error } = await supabase.from('courses').update(updates).eq('id', item.itemId);
    if (error) { if (msg) msg.textContent = `Failed to update course: ${error.message}`; return; }
  }
  const { error: queueError } = await supabase.from('verification_queue').update({ review_status: approved ? 'Approved' : 'Rejected', reviewer_id: currentUser.id, review_notes: note, updated_at: new Date().toISOString() }).eq('id', queueId);
  if (queueError) { if (msg) msg.textContent = `Failed to update verification queue: ${queueError.message}`; return; }

  const subject = approved
    ? `${title(item.itemType)} verification approved`
    : `${title(item.itemType)} verification requires attention`;
  const body = approved
    ? `Your ${item.itemType} verification has been approved on Jobs4Youth.${note ? ' Admin note: ' + note : ''}`
    : `Your ${item.itemType} verification was not approved yet.${note ? ' Admin note: ' + note : ' Please review your submission and update your information as needed.'}`;
  await enqueuePlatformNotification({
    userId: item.profileId,
    actorId: currentUser.id,
    recipientEmail: item.ownerEmail || '',
    title: subject,
    body,
    notificationType: approved ? 'verification_approved' : 'verification_rejected',
    relatedEntityType: item.itemType,
    relatedEntityId: item.itemId || item.profileId
  });

  await loadJobsFromSupabase();
  await loadCoursesFromSupabase();
  await loadVerificationDocumentsFromSupabase();
  await loadVerificationQueueFromSupabase();
  await loadNotificationsFromSupabase();
  alert(`✅ ${decision} successfully. Notification and email queue records were created.`);
  render();
};



window.refreshAdminQueue = async function() {
  await loadVerificationQueueFromSupabase();
  await loadVerificationDocumentsFromSupabase();
  render();
};

window.openVerificationDocument = async function(storagePath) {
  if (!isConfigured || !supabase || !storagePath) return alert('Document path is missing.');
  const { data, error } = await supabase.storage.from('verification-documents').createSignedUrl(storagePath, 60);
  if (error || !data?.signedUrl) {
    console.error('Signed URL error:', error);
    return alert(`Unable to open document: ${error?.message || 'Signed URL failed.'}`);
  }
  window.open(data.signedUrl, '_blank', 'noopener');
};

window.updateVerificationDocumentStatus = async function(documentId, nextStatus) {
  if (!isConfigured || !currentUser || state.role !== 'admin') return alert('Only admins can review verification documents.');
  const note = prompt(`Optional admin note for ${nextStatus.toLowerCase()}:`, '') || '';
  const { error } = await supabase.from('verification_documents').update({ review_status: nextStatus, admin_notes: note, updated_at: new Date().toISOString() }).eq('id', documentId);
  if (error) {
    console.error('Verification document update error:', error);
    return alert(`Failed to update document review status: ${error.message}`);
  }
  await loadVerificationDocumentsFromSupabase();
  await loadVerificationQueueFromSupabase();
  render();
  alert(`✅ Document marked as ${nextStatus}.`);
};

window.uploadVerificationDocument = async function() {
  const msg = document.getElementById('verificationDocumentMessage');
  if (msg) msg.textContent = '';
  if (!isConfigured || !supabase) {
    if (msg) msg.textContent = 'Supabase is not connected yet.';
    return;
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    if (msg) msg.textContent = 'Please sign in first.';
    return;
  }
  const profile = await ensureProfile(user);
  if (!profile || !['employer','institution','admin'].includes(profile.role)) {
    if (msg) msg.textContent = 'Only employer, institution or admin accounts can upload verification documents.';
    return;
  }
  const type = document.getElementById('verificationDocumentType')?.value || '';
  const fileInput = document.getElementById('verificationDocumentFile');
  const file = fileInput?.files?.[0];
  if (!type || !file) {
    if (msg) msg.textContent = 'Please choose a document type and select a file.';
    return;
  }
  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    if (msg) msg.textContent = 'Please upload a file smaller than 10 MB.';
    return;
  }
  const safeName = sanitizeFileName(file.name);
  const storagePath = `${user.id}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from('verification-documents').upload(storagePath, file, { upsert: false });
  if (uploadError) {
    console.error('Verification document upload error:', uploadError);
    if (msg) msg.textContent = `Failed to upload document: ${uploadError.message}`;
    return;
  }
  const { error: insertError } = await supabase.from('verification_documents').insert([{
    profile_id: user.id,
    file_name: file.name,
    storage_path: storagePath,
    mime_type: file.type || 'application/octet-stream',
    file_size: file.size || 0,
    document_type: type,
    review_status: 'Pending'
  }]);
  if (insertError) {
    console.error('Verification document metadata insert error:', insertError);
    if (msg) msg.textContent = `Document uploaded, but metadata save failed: ${insertError.message}`;
    return;
  }
  await ensureVerificationRequest(profile, profile.role);
  if (fileInput) fileInput.value = '';
  const typeEl = document.getElementById('verificationDocumentType');
  if (typeEl) typeEl.value = '';
  if (msg) msg.textContent = 'Verification document uploaded successfully and is now pending admin review.';
  await loadVerificationDocumentsFromSupabase();
  if (state.role === 'admin') await loadVerificationQueueFromSupabase();
  render();
};

function notificationsCenter() {
  const items = state.notifications || [];
  const unread = items.filter(item => !item.isRead).length;
  return `
    <div class="grid">
      <div class="card span-12">
        <div class="section-title"><h3>Notifications centre</h3><span class="pill pill-verified">${unread} unread</span></div>
        <p class="label">View in-app alerts, email-queue status, and verification decision messages from one place.</p>
        <div class="notice trust-notice"><b>Email workflow note:</b> platform actions now queue email-ready notifications for operational sending, while users immediately see the same message inside the app.</div>
      </div>
      <div class="card span-12">
        ${items.length ? items.map(notificationCard).join('') : `<div class="empty-card"><h4>No notifications yet</h4><p class="label">Once the platform creates updates for your account, they will appear here with in-app and email queue visibility.</p></div>`}
      </div>
    </div>
  `;
}

function insights() {
  const demand = signalTopItems(state.signalLayer.skillDemand, 6);
  const gap = signalTopItems(state.signalLayer.skillGap, 6);
  const trainingGap = signalTopItems(state.signalLayer.trainingGap, 6);
  const bottlenecks = signalTopItems(state.signalLayer.employerBottlenecks, 5);
  const underserved = signalTopItems(state.signalLayer.underservedSegments, 5);
  const countries = signalTopItems(state.signalLayer.countrySignals, 6);
  const totalDemand = (state.signalLayer.skillDemand || []).reduce((sum, item) => sum + Number(item.opportunitiesCount || 0), 0);
  const totalGap = (state.signalLayer.skillGap || []).reduce((sum, item) => sum + Number(item.gapCount || 0), 0);
  const totalTrainingGap = (state.signalLayer.trainingGap || []).reduce((sum, item) => sum + Number(item.trainingGapCount || 0), 0);
  return `
    <div class="grid">
      ${signalMetricCard('Demanded skill signals', totalDemand || 0, 'Total visible skill demand captured across verified opportunities.')}
      ${signalMetricCard('Skill gap count', totalGap || 0, 'Demand not yet matched by visible youth skill supply.')}
      ${signalMetricCard('Training gap count', totalTrainingGap || 0, 'Demand not yet covered by enough verified training pathways.')}
      ${signalMetricCard('Employer bottlenecks', bottlenecks.length || 0, 'Open or thin pipelines requiring intervention.')}
      ${signalListCard('Most requested skills', demand, item => `<div class="mini-card"><div class="section-title"><div><h4>${escapeHtml(item.skillName)}</h4><p class="label">${escapeHtml(item.country)}${item.region ? ' • ' + escapeHtml(item.region) : ''}</p></div><div class="job-badges"><span class="pill pill-verified">${item.opportunitiesCount || 0} opportunities</span></div></div><div class="chartbar"><div style="width:${Math.min(100, (item.opportunitiesCount || 0) * 10)}%"></div></div></div>`, 'Run Build 8 views in Supabase or create more verified opportunity data to populate this dashboard.')}
      ${signalListCard('Skill gaps by geography', gap, item => `<div class="mini-card"><div class="section-title"><div><h4>${escapeHtml(item.skillName)}</h4><p class="label">${escapeHtml(item.country)}${item.region ? ' • ' + escapeHtml(item.region) : ''}</p></div><div class="job-badges"><span class="pill">Gap ${item.gapCount || 0}</span></div></div><p class="label">Demand: ${item.demandOpportunities || 0} • Youth supply: ${item.youthSupply || 0}${item.gapPercent !== undefined ? ' • Gap ' + item.gapPercent + '%' : ''}</p></div>`, 'Once pathways and normalized skill maps are active, the platform will calculate structural gap signals here.')}
      ${signalListCard('Training gaps for institutions', trainingGap, item => `<div class="mini-card"><div class="section-title"><div><h4>${escapeHtml(item.skillName)}</h4><p class="label">${escapeHtml(item.country)}${item.region ? ' • ' + escapeHtml(item.region) : ''}</p></div><div class="job-badges"><span class="pill">Gap ${item.trainingGapCount || 0}</span></div></div><p class="label">Demand: ${item.demandOpportunities || 0} • Verified courses covering skill: ${item.verifiedCoursesCoveringSkill || 0}</p></div>`, 'Institutions can use this to identify where new courses or modules are most needed.')}
      ${signalListCard('Employer hiring bottlenecks', bottlenecks, item => `<div class="mini-card"><div class="section-title"><div><h4>${escapeHtml(item.opportunityTitle)}</h4><p class="label">${escapeHtml(item.organizationName || 'Employer')} • ${escapeHtml(item.country)}</p></div><div class="job-badges">${statusBadge(item.bottleneckSignal || 'Signal')}</div></div><p class="label">Applications received: ${item.applicationsReceived || 0}${item.pipelineAgeDays ? ' • Pipeline age: ' + item.pipelineAgeDays + ' days' : ''}</p></div>`, 'This panel becomes stronger as employers post more opportunities and applications accumulate over time.')}
      ${signalListCard('Under-served youth segments', underserved, item => `<div class="mini-card"><div class="section-title"><div><h4>${escapeHtml(item.country)}${item.region ? ' • ' + escapeHtml(item.region) : ''}</h4><p class="label">${escapeHtml(item.educationLevel || 'Education not set')} • ${escapeHtml(item.experienceLevel || 'Experience not set')}</p></div><div class="job-badges"><span class="pill">Strength ${Math.round(item.averageProfileStrength || 0)}%</span></div></div><p class="label">Youth profiles: ${item.youthProfiles || 0} • Without skills: ${item.profilesWithoutSkills || 0} • Without career goal: ${item.profilesWithoutCareerGoal || 0}</p></div>`, 'This helps governments and donors target support to segments with weaker profile strength and pathway visibility.')}
      <div class="card span-12">
        <div class="section-title"><h3>Country activity overview</h3><span class="pill pill-trust">Government and donor view</span></div>
        <div class="mini-grid ${countries.length > 3 ? '' : 'single-column'}">
          ${countries.length ? countries.map(item => `<div class="mini-card"><div class="section-title"><div><h4>${escapeHtml(item.country)}</h4><p class="label">Youth: ${item.youthProfiles || 0} • Employers: ${item.employers || 0} • Institutions: ${item.institutions || 0}</p></div><div class="job-badges"><span class="pill pill-verified">${item.verifiedOpportunities || 0} opportunities</span></div></div><p class="label">Verified courses: ${item.verifiedCourses || 0} • Applications: ${item.applicationsTotal || 0}</p></div>`).join('') : '<div class="empty-card"><h4>No country-level activity yet</h4><p class="label">Once profiles, opportunities, courses and applications grow, country dashboards will populate automatically.</p></div>'}
        </div>
      </div>
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
          <li>A foundation for labour market analytics and youth employment reporting</li>
        </ul>
      </div>
      <div class="card span-6">
        <h3>Professional standards</h3>
        <p>Jobs4Youth is being built as a professional public service platform. That means the platform prioritises structured forms, verification, responsible moderation, consistent data capture and clear governance.</p>
        <p class="label">Public launch readiness will also include a custom domain, legal pages, support contacts and stronger user guidance.</p>
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
    <h4>Suggested contact details</h4>
    <p><b>Email:</b> info@jobs4youth.org</p>
    <p><b>Support:</b> support@jobs4youth.org</p>
    <p class="label">For support, partnerships and platform enquiries, contact the Jobs4Youth team using the details above.</p>
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
  if (state.view === 'home') c = home();
  else if (state.view === 'about') c = about();
  else if (state.view === 'privacy') c = privacy();
  else if (state.view === 'terms') c = terms();
  else if (state.view === 'contact') c = contact();
  else if (state.view === 'impact') c = impactEvidence();
  else if (state.view === 'champions') c = campusChampions();
  else if (state.view === 'universities') c = universitiesPage();
  else if (state.view === 'launch toolkit') c = launchToolkit();
  else if (state.view === 'notifications') c = notificationsCenter();
  else if (state.role === 'youth') c = state.view === 'dashboard' ? youthDash() : state.view === 'opportunities' ? opportunities() : state.view === 'training' ? training() : state.view === 'shortlist' ? shortlistPage() : state.view === 'opportunity detail' ? opportunityDetailPage() : state.view === 'application wizard' ? applicationWizardPage() : profile();
  else if (state.role === 'employer') c = state.view === 'dashboard' ? employerDash() : state.view === 'post opportunity' ? postOpportunity() : state.view === 'candidates' ? candidates() : profile();
  else if (state.role === 'institution') c = state.view === 'dashboard' ? institutionDash() : state.view === 'post training' ? postTraining() : state.view === 'courses' ? courses() : profile();
  else if (state.role === 'admin') c = state.view === 'dashboard' ? adminDash() : state.view === 'verification' ? verification() : state.view === 'insights' ? insights() : state.view === 'about' ? about() : state.view === 'privacy' ? privacy() : state.view === 'terms' ? terms() : state.view === 'notifications' ? notificationsCenter() : contact();
  document.getElementById('content').innerHTML = c;
}


function openAuthModal(mode = 'login') {
  authMode = mode;
  document.getElementById('authModal')?.classList.remove('hidden');
  updateAuthModal();
}

function openAuthSuccessModal(titleText, bodyText) {
  const modal = document.getElementById('authSuccessModal');
  if (!modal) return;
  document.getElementById('authSuccessTitle').textContent = titleText || 'Confirm your email';
  document.getElementById('authSuccessText').textContent = bodyText || 'Please open your email and click the confirmation link to conclude the sign up process.';
  modal.classList.remove('hidden');
}
window.closeAuthSuccessModal = function() {
  document.getElementById('authSuccessModal')?.classList.add('hidden');
};

function closeAuthModal() {
  document.getElementById('authModal')?.classList.add('hidden');
  document.getElementById('authMessage').textContent = '';
  const ids = ['authEmail','authPassword','authConfirmPassword','authFullName'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function updateAuthModal() {
  const isSignup = authMode === 'signup';
  document.getElementById('authTitle').textContent = isSignup ? 'Create your Jobs4Youth account' : 'Sign in to Jobs4Youth';
  document.getElementById('authSubmitBtn').textContent = isSignup ? 'Create account' : 'Sign In';
  document.getElementById('fullNameWrap').style.display = isSignup ? 'block' : 'none';
  document.getElementById('roleWrap').style.display = isSignup ? 'block' : 'none';
  const confirmWrap = document.getElementById('confirmPasswordWrap');
  if (confirmWrap) confirmWrap.style.display = isSignup ? 'block' : 'none';
  document.getElementById('tabLogin').classList.toggle('active', !isSignup);
  document.getElementById('tabSignup').classList.toggle('active', isSignup);
  document.getElementById('authMessage').textContent = isSignup ? 'You will need to confirm your email before the first sign in.' : '';
}

function demoSignIn() { openAuthModal('login'); }
window.openLogin = () => openAuthModal('login');
window.openSignup = () => openAuthModal('signup');


async function handlePasswordReset() {
  const msg = document.getElementById('authMessage');
  const resetBtn = document.getElementById('btnResetPassword');
  const email = document.getElementById('authEmail')?.value.trim() || '';

  if (msg) {
    msg.textContent = '';
    msg.style.color = '';
  }

  if (!isConfigured || !supabase) {
    if (msg) msg.textContent = 'Supabase is not connected yet. Check config.js.';
    return;
  }

  if (!email) {
    if (msg) msg.textContent = 'Please enter your email address first.';
    return;
  }

  if (resetBtn) {
    resetBtn.disabled = true;
    resetBtn.textContent = 'Sending reset email...';
  }

  try {
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });

    console.log('Jobs4Youth password reset response:', { data, error, redirectUrl });

    if (error) {
      const errorMessage =
        error.message ||
        error.error_description ||
        error.details ||
        error.hint ||
        'Password reset failed. Please check Supabase Auth SMTP settings and Resend configuration, then try again.';

      if (msg) msg.textContent = errorMessage;
      console.error('Jobs4Youth password reset error:', error);
      return;
    }

    if (msg) {
      msg.style.color = '#36702b';
      msg.textContent = 'Password reset email sent. Please check your inbox or spam folder.';
    }
    alert('Password reset email sent. Please check your inbox or spam folder.');
  } catch (err) {
    console.error('Jobs4Youth password reset exception:', err);
    const errorMessage =
      err?.message ||
      err?.error_description ||
      err?.details ||
      'Unexpected error while sending password reset email. Open the browser console for details.';

    if (msg) msg.textContent = errorMessage;
  } finally {
    if (resetBtn) {
      resetBtn.disabled = false;
      resetBtn.textContent = 'Reset password';
    }
  }
}

function hasPasswordRecoveryParams() {
  const urlState = `${window.location.search || ''} ${window.location.hash || ''}`;
  return urlState.includes('type=recovery') || urlState.includes('type%3Drecovery');
}

async function completePasswordRecovery() {
  if (!isConfigured || !supabase) return;

  const newPassword = prompt('Enter your new Jobs4Youth password. Use at least 6 characters.');
  if (!newPassword) return;

  if (newPassword.length < 6) {
    alert('Password must be at least 6 characters. Please try the reset link again.');
    return;
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) {
    console.error('Password update error:', error);
    alert(`Password update failed: ${error.message}`);
    return;
  }

  try {
    window.history.replaceState(null, '', `${window.location.origin}${window.location.pathname}`);
  } catch (historyError) {
    console.warn('Could not clean password recovery URL:', historyError);
  }

  alert('Password updated successfully. You are now signed in.');
}

async function handleAuthSubmit() {
  if (!isConfigured) return alert('Add config.js with your Supabase URL and anon key first.');
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  const confirmPassword = document.getElementById('authConfirmPassword')?.value.trim() || '';
  const fullName = document.getElementById('authFullName').value.trim();
  const role = document.getElementById('authRole').value;
  const msg = document.getElementById('authMessage');
  msg.textContent = '';
  if (!email || !password) { msg.textContent = 'Please enter email and password.'; return; }
  if (authMode === 'signup' && password !== confirmPassword) { msg.textContent = 'Passwords do not match.'; return; }
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
  if (authMode === 'signup' && !authResult.data.session) {
    closeAuthModal();
    openAuthSuccessModal(
      'Confirm your email to conclude sign up',
      'Your account has been created successfully. Please open your email and click the confirmation link before signing in to Jobs4Youth.'
    );
    return;
  }
  currentUser = authResult.data.session?.user || authResult.data.user || null;
  if (currentUser) {
    const profile = await ensureProfile(currentUser);
    syncProfileToState(profile);
  }
  await loadJobsFromSupabase();
  await loadCoursesFromSupabase();
  await loadApplicationsFromSupabase();
  await loadSavedItemsFromSupabase();
  await loadSignalLayerFromSupabase();
  await loadVerificationQueueFromSupabase();
  await loadVerificationDocumentsFromSupabase();
  await loadNotificationsFromSupabase();
  closeAuthModal();
  state.view = 'dashboard';
  alert(authMode === 'signup' ? 'Account created successfully.' : 'Signed in successfully.');
  render();
}


async function signOut() {
  if (isConfigured && supabase) await supabase.auth.signOut();
  currentUser = null;
  state = structuredClone(demoState);
  selectedOpportunityId = null;
  selectedCourseId = null;
  applicationWizard = { opportunityId: null, draftId: null, step: 1, readinessScore: 0, motivationNote: '', screeningAnswers: {}, documentState: { cvReady: false, certificateReady: false, referencesReady: false } };
  browseFilters.jobs = { keyword: '', country: '', region: '', type: '', education: '', experience: '' };
  browseFilters.courses = { keyword: '', country: '', region: '', mode: '' };
  state.view = 'home';
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
    gender: document.getElementById('profileGender')?.value || '',
    skills: document.getElementById('profileSkills')?.value || '',
    interests: document.getElementById('profileInterests')?.value || '',
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
  if (error) {
    console.warn('Profile save with gender failed, retrying without optional gender field:', error);
    const { gender, ...fallbackUpdates } = updates;
    const retry = await supabase.from('profiles').update(fallbackUpdates).eq('id', user.id);
    if (retry.error) return alert(`❌ Failed to save profile: ${retry.error.message}`);
  }
  state.profile = { ...state.profile, name: updates.full_name, country: updates.country, region: updates.region, education: updates.education, availability: updates.availability, experience: updates.experience_level, gender: updates.gender, skills: updates.skills, interests: updates.interests };
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
  alert('✅ Organisation profile saved successfully!');
  render();
};


async function initializeApp() {
  state.view = 'home';
  if (isConfigured && supabase) {
    const { data: sessionData, error } = await supabase.auth.getSession();
    if (!error && sessionData?.session?.user) {
      currentUser = sessionData.session.user;
      const profile = await ensureProfile(currentUser);
      syncProfileToState(profile);
      state.view = 'dashboard';
      if (hasPasswordRecoveryParams()) {
        setTimeout(() => completePasswordRecovery(), 100);
      }
    }
    await loadJobsFromSupabase();
    await loadCoursesFromSupabase();
    await loadApplicationsFromSupabase();
    await loadSavedItemsFromSupabase();
    await loadSignalLayerFromSupabase();
    await loadVerificationQueueFromSupabase();
    await loadVerificationDocumentsFromSupabase();
    await loadNotificationsFromSupabase();
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setTimeout(() => completePasswordRecovery(), 100);
      }
      currentUser = session?.user || null;
      if (currentUser) {
        const profile = await ensureProfile(currentUser);
        syncProfileToState(profile);
        state.view = 'dashboard';
      } else {
        state = structuredClone(demoState);
        browseFilters.jobs = { keyword: '', country: '', region: '', type: '', education: '', experience: '' };
        browseFilters.courses = { keyword: '', country: '', region: '', mode: '' };
        state.view = 'home';
      }
      await loadJobsFromSupabase();
      await loadCoursesFromSupabase();
      await loadApplicationsFromSupabase();
      await loadSignalLayerFromSupabase();
      await loadVerificationQueueFromSupabase();
      await loadVerificationDocumentsFromSupabase();
      await loadNotificationsFromSupabase();
      render();
    });
  }
  render();
}


document.getElementById('btnSignIn').addEventListener('click', demoSignIn);
document.getElementById('btnSignOut').addEventListener('click', signOut);
document.getElementById('closeAuthModal').addEventListener('click', closeAuthModal);
document.getElementById('authSubmitBtn').addEventListener('click', handleAuthSubmit);
document.getElementById('btnResetPassword').addEventListener('click', handlePasswordReset);
document.getElementById('tabLogin').addEventListener('click', () => { authMode = 'login'; updateAuthModal(); });
document.getElementById('tabSignup').addEventListener('click', () => { authMode = 'signup'; updateAuthModal(); });

initializeApp();
