
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
  verificationDocumentTypes: ['Business Registration Certificate','Tax Compliance Certificate','Accreditation or Licence','Organisation Profile','Authorisation Letter','Other Supporting Document']
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
  if (!currentUser) return ['home', 'opportunities', 'training', 'about', 'privacy', 'terms', 'contact'];
  if (state.role === 'youth') return ['dashboard', 'opportunities', 'training', 'profile', 'notifications', 'about', 'privacy', 'terms', 'contact'];
  if (state.role === 'employer') return ['dashboard', 'post opportunity', 'candidates', 'profile', 'notifications', 'about', 'privacy', 'terms', 'contact'];
  if (state.role === 'institution') return ['dashboard', 'post training', 'courses', 'profile', 'notifications', 'about', 'privacy', 'terms', 'contact'];
  return ['dashboard', 'verification', 'insights', 'notifications', 'about', 'privacy', 'terms', 'contact'];
}



function desc() {
  if (state.view === 'home') return 'Discover verified youth opportunities, training pathways and trusted partners across Africa.';
  if (state.view === 'about') return 'Learn what Jobs4Youth is, who it serves, and why it exists.';
  if (state.view === 'privacy') return 'Understand how Jobs4Youth collects, uses and protects user information.';
  if (state.view === 'terms') return 'Review the rules, responsibilities and conditions for using Jobs4Youth.';
  if (state.view === 'contact') return 'Get in touch for support, partnerships and platform enquiries.';
  if (state.view === 'notifications') return 'Track platform alerts, queued email notifications and verification decision messages in one place.';
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
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">${action ? `<button class="primary" onclick="applyJob('${j.id}')">Apply / Save</button>` : ''}${statusBadge(status)}</div>
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
  return `
    <div class="grid home-grid">
      <div class="card span-8 hero-card">
        <div class="hero-copy">
          <div class="kicker">Public continental platform</div>
          <h3 class="hero-title">Verified youth opportunities, internships and skills pathways in one trusted platform</h3>
          <p class="hero-text">Jobs4Youth helps young people discover credible opportunities, supports employers to reach job-ready talent, and enables institutions to publish relevant training offers across African labour markets.</p>
          <div class="hero-actions">
            <button class="primary" onclick="setView('opportunities')">Browse opportunities</button>
            <button class="secondary" onclick="setView('training')">Browse training</button>
            <button class="secondary" onclick="openSignup()">Create account</button>
            <button class="secondary" onclick="openLogin()">Sign in</button>
          </div>
          <div class="hero-points">
            <span class="pill pill-verified">Verified listings</span>
            <span class="pill">Trusted employer and institution workflows</span>
            <span class="pill">Career pathways and skills visibility</span>
          </div>
        </div>
      </div>
      <div class="card span-4 hero-panel">
        <h3>Why Jobs4Youth</h3>
        <div class="feature-stat"><span class="metric">${state.jobs.filter(j => j.status === 'Verified').length}</span><span class="label">verified opportunities currently visible</span></div>
        <div class="feature-stat"><span class="metric">${state.courses.filter(c => c.status === 'Verified').length}</span><span class="label">verified training offers and skills pathways</span></div>
        <div class="feature-stat"><span class="metric">4</span><span class="label">connected user groups: youth, employers, institutions and admins</span></div>
        <div class="soft-note">Public listings are moderated through platform governance and role-based review workflows.</div>
      </div>

      <div class="card span-12">${onboardingPanel()}</div>

      <div class="card span-12">
        <div class="section-title"><h3>Choose your pathway</h3><span class="pill">Public quick start</span></div>
        <div class="feature-grid">
          <div class="feature-card">
            <h4>For youth</h4>
            <p>Find jobs, internships, apprenticeships and training offers that match your location, education and skills interests.</p>
            <button class="secondary" onclick="setView('opportunities')">Explore opportunities</button>
          </div>
          <div class="feature-card">
            <h4>For employers</h4>
            <p>Publish opportunities, review candidate applications and participate in a more trusted, moderated recruitment workflow.</p>
            <button class="secondary" onclick="openSignup()">Create employer account</button>
          </div>
          <div class="feature-card">
            <h4>For institutions</h4>
            <p>Promote training programmes that respond to labour-market demand and help young people close skills gaps faster.</p>
            <button class="secondary" onclick="openSignup()">Create institution account</button>
          </div>
          <div class="feature-card">
            <h4>For partners and administrators</h4>
            <p>Support transparent verification, moderation and labour-market visibility across the platform ecosystem.</p>
            <button class="secondary" onclick="setView('about')">Learn more</button>
          </div>
        </div>
      </div>

      <div class="card span-7">
        <div class="section-title"><h3>Featured verified opportunities</h3><button class="secondary" onclick="setView('opportunities')">View all opportunities</button></div>
        <p class="label">Only public-facing verified listings are highlighted here to improve trust and relevance.</p>
        <div class="mini-grid">
          ${jobs.length ? jobs.map(publicJobTeaser).join('') : homeSectionEmpty('No verified opportunities yet', 'Once reviewed opportunities are published, featured roles will appear here for public browsing.', 'Open opportunity marketplace', 'opportunities')}
        </div>
      </div>

      <div class="card span-5">
        <div class="section-title"><h3>Featured training pathways</h3><button class="secondary" onclick="setView('training')">View all training</button></div>
        <p class="label">Training providers can publish moderated learning offers aligned to market demand and youth pathways.</p>
        <div class="mini-grid single-column">
          ${courses.length ? courses.map(publicCourseTeaser).join('') : homeSectionEmpty('No verified training yet', 'Verified courses and skills programmes will appear here once institutions publish and admins approve them.', 'Browse training catalogue', 'training')}
        </div>
      </div>

      <div class="card span-12 trust-strip">
        <div class="section-title"><h3>Built for public trust and real world use</h3><span class="pill pill-verified">Moderated platform</span></div>
        <div class="trust-grid">
          <div class="trust-card">
            <h4>Verification-first publishing</h4>
            <p class="label">Employer and institution participation is supported by verification workflows, while new opportunities and courses go through review before they are promoted.</p>
          </div>
          <div class="trust-card">
            <h4>Structured profiles and cleaner data</h4>
            <p class="label">The platform already uses role-based profiles, structured fields and protected access rules to support safer public use and better matching.</p>
          </div>
          <div class="trust-card">
            <h4>Actionable pathways for youth</h4>
            <p class="label">Jobs4Youth is not only a vacancy site, it also connects opportunities, training and labour market signals in one evolving ecosystem.</p>
          </div>
        </div>
      </div>

      <div class="card span-12 final-cta">
        <div>
          <div class="kicker">Ready to get started?</div>
          <h3>Join the Jobs4Youth network</h3>
          <p class="label">Create an account to apply for opportunities, publish vacancies, share training offers or manage verification workflows.</p>
        </div>
        <div class="hero-actions">
          <button class="primary" onclick="openSignup()">Create account</button>
          <button class="secondary" onclick="openLogin()">Sign in</button>
          <button class="secondary" onclick="setView('contact')">Contact platform team</button>
        </div>
      </div>
    </div>
  `;
}


function youthDash() {
  const ranked = [...state.jobs].sort((a, b) => matchScore(b) - matchScore(a));
  const completion = youthProfileCompletion();
  return `
    ${onboardingPanel()}
    <div class="notice"><b>Professional guidance:</b> verified public listings, profile completeness prompts and skills pathways are now visible to help first-time users navigate the platform more confidently.</div>
    ${completionCard('Profile completeness', completion, 'A fuller profile improves match quality, trust and opportunity relevance.', 'Complete youth profile')}
    ${metrics()}
    <div class="grid" style="margin-top:18px">
      <div class="card span-8">
        <div class="section-title"><h3>Best matches for ${escapeHtml(state.profile.name || 'you')}</h3><button class="secondary" onclick="setView('opportunities')">View all</button></div>
        ${ranked.slice(0, 3).length ? ranked.slice(0, 3).map(j => jobCard(j, true)).join('') : `<div class="empty-card"><h4>No verified opportunities yet</h4><p class="label">Once moderated listings are available, your strongest matches will appear here automatically.</p><button class="secondary" onclick="setView('opportunities')">Browse all opportunities</button></div>`}
      </div>
      <div class="card span-4">
        <h3>Recommended skills pathway</h3>
        ${state.courses.length ? state.courses.slice(0,4).map(c => `<p><b>${escapeHtml(c.title)}</b><br><span class="label">${escapeHtml(c.provider)} • ${escapeHtml(c.mode)} • ${escapeHtml(c.duration)}</span></p>`).join('') : `<div class="empty-card"><h4>No verified training offers yet</h4><p class="label">Training pathways will appear here as verified institutions publish relevant offers.</p><button class="secondary" onclick="setView('training')">Browse training</button></div>`}
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

function employerDash() {
  const myJobs = currentUser ? state.jobs.filter(j => j.postedBy === currentUser.id) : [];
  const completion = organisationProfileCompletion();
  return `
    ${onboardingPanel()}
    ${completionCard('Employer profile readiness', completion, 'A stronger employer profile improves confidence before candidates engage with your opportunities.', 'Complete employer profile')}
    ${metrics()}
    <div class="grid" style="margin-top:18px">
      <div class="card span-7"><div class="section-title"><h3>Your posted opportunities</h3><button class="secondary" onclick="setView('post opportunity')">Post new</button></div>${myJobs.length ? myJobs.map(j => jobCard(j, false)).join('') : `<div class="empty-card"><h4>No opportunities posted yet</h4><p class="label">Complete your organisation profile, then publish your first moderated opportunity to start attracting candidates.</p><button class="secondary" onclick="setView('post opportunity')">Post your first opportunity</button></div>`}</div>
      <div class="card span-5"><h3>Applications received</h3><div class="metric">${state.employerCandidates.length}</div><p class="label">Candidates who applied to your posted opportunities.</p><button class="secondary" onclick="setView('candidates')">Open candidates</button></div>
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
  return `
    <div class="card"><div class="section-title"><h3>Candidate applications</h3><button class="secondary" onclick="setView('post opportunity')">Post another opportunity</button></div>${state.employerCandidates.length ? state.employerCandidates.map(c => `
      <div class="job"><div><h3>${escapeHtml(c.applicantName)}</h3><p><b>${escapeHtml(c.opportunityTitle)}</b> • ${escapeHtml(c.region)}, ${escapeHtml(c.country)} • ${escapeHtml(c.education || 'Education not provided')}</p><p>${escapeHtml(c.skills || 'No skills listed.')}</p><div><span class="pill">${escapeHtml(c.status)}</span>${c.applicantEmail ? `<span class="pill">${escapeHtml(c.applicantEmail)}</span>` : ''}${c.experience ? `<span class="pill">${escapeHtml(c.experience)}</span>` : ''}</div></div><div class="fit" style="--score:76"><span>76%</span></div></div>
    `).join('') : `<div class="empty-card"><h4>No applications received yet</h4><p class="label">Once candidates apply to your opportunities, they will appear here with profile details for review.</p><button class="secondary" onclick="setView('post opportunity')">Post opportunity</button></div>`}</div>
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
  else if (state.view === 'notifications') c = notificationsCenter();
  else if (state.role === 'youth') c = state.view === 'dashboard' ? youthDash() : state.view === 'opportunities' ? opportunities() : state.view === 'training' ? training() : profile();
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
    skills: document.getElementById('profileSkills')?.value || '',
    interests: document.getElementById('profileInterests')?.value || '',
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
  if (error) return alert(`❌ Failed to save profile: ${error.message}`);
  state.profile = { ...state.profile, name: updates.full_name, country: updates.country, region: updates.region, education: updates.education, availability: updates.availability, experience: updates.experience_level, skills: updates.skills, interests: updates.interests };
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
    }
    await loadJobsFromSupabase();
    await loadCoursesFromSupabase();
    await loadApplicationsFromSupabase();
    await loadSignalLayerFromSupabase();
    await loadVerificationQueueFromSupabase();
    await loadVerificationDocumentsFromSupabase();
    await loadNotificationsFromSupabase();
    supabase.auth.onAuthStateChange(async (_event, session) => {
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
document.getElementById('tabLogin').addEventListener('click', () => { authMode = 'login'; updateAuthModal(); });
document.getElementById('tabSignup').addEventListener('click', () => { authMode = 'signup'; updateAuthModal(); });

initializeApp();
/* --------------------------------------------------------------------------
   Build 11 — Guided Opportunity Experience Enhancement Layer
   Adds: shortlist, dedicated opportunity detail view, readiness check,
   guided application wizard, in-app toasts, and richer youth dashboard flows.
   -------------------------------------------------------------------------- */

function ensureEnhancedState() {
  if (!demoState.shortlist) demoState.shortlist = { opportunities: [], courses: [] };
  if (!demoState.applicationDrafts) demoState.applicationDrafts = [];
  if (!('selectedOpportunityId' in demoState)) demoState.selectedOpportunityId = null;
  if (!('readinessCheck' in demoState)) demoState.readinessCheck = null;
  if (!demoState.applicationWizard) demoState.applicationWizard = { opportunityId: null, step: 1, draftId: null, success: null };
  if (!demoState.screeningQuestions) demoState.screeningQuestions = {};

  if (!state.shortlist) state.shortlist = { opportunities: [], courses: [] };
  if (!Array.isArray(state.applicationDrafts)) state.applicationDrafts = [];
  if (!('selectedOpportunityId' in state)) state.selectedOpportunityId = null;
  if (!('readinessCheck' in state)) state.readinessCheck = null;
  if (!state.applicationWizard) state.applicationWizard = { opportunityId: null, step: 1, draftId: null, success: null };
  if (!state.screeningQuestions) state.screeningQuestions = {};
}

function ensureToastRoot() {
  let root = document.getElementById('toastRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toastRoot';
    root.className = 'toast-root';
    document.body.appendChild(root);
  }
  return root;
}

function pushToast(message, tone = 'success') {
  const root = ensureToastRoot();
  const toast = document.createElement('div');
  toast.className = `toast-card toast-${tone}`;
  toast.textContent = message;
  root.appendChild(toast);
  setTimeout(() => toast.classList.add('toast-show'), 10);
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 260);
  }, 3200);
}

function splitCsv(value) {
  return String(value || '').split(/[;,\n]/).map(item => item.trim()).filter(Boolean);
}

function readinessBand(score) {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Progressing';
  if (score >= 40) return 'Emerging';
  return 'Early Stage';
}

function applicationStepLabels() {
  return [
    'Review opportunity',
    'Readiness check',
    'Application package',
    'Screening questions',
    'Confirm and submit'
  ];
}

function getOpportunityById(id) {
  return (state.jobs || []).find(item => item.id === id) || null;
}

function getSavedOpportunityIds() {
  ensureEnhancedState();
  return new Set((state.shortlist?.opportunities || []).map(item => item.opportunityId));
}

function getDraftByOpportunityId(opportunityId) {
  ensureEnhancedState();
  return (state.applicationDrafts || []).find(item => item.opportunityId === opportunityId) || null;
}

function youthApplicationCount() {
  return Array.isArray(state.applications) ? state.applications.length : 0;
}

function calculateOpportunityReadiness(job) {
  const profile = state.profile || {};
  const requiredSkills = splitCsv(job?.skills);
  const profileSkills = new Set(splitCsv(profile.skills).map(item => item.toLowerCase()));
  const matchedSkills = requiredSkills.filter(item => profileSkills.has(item.toLowerCase()));
  const missingSkills = requiredSkills.filter(item => !profileSkills.has(item.toLowerCase()));
  const completeness = youthProfileCompletion();
  const educationMatch = profile.education && job?.education && profile.education === job.education;
  const experienceMatch = profile.experience && job?.experience && profile.experience === job.experience;
  const countryMatch = profile.country && job?.country && profile.country === job.country;
  const regionMatch = profile.region && job?.region && profile.region.toLowerCase() === job.region.toLowerCase();
  const skillsScore = requiredSkills.length ? Math.round((matchedSkills.length / requiredSkills.length) * 34) : 22;
  const score = Math.min(98, Math.round(
    (completeness * 0.30) +
    skillsScore +
    (educationMatch ? 14 : profile.education ? 7 : 0) +
    (experienceMatch ? 12 : profile.experience ? 6 : 0) +
    (countryMatch ? 6 : 2) +
    (regionMatch ? 4 : 0)
  ));
  const checklist = [
    {
      label: 'Profile completeness looks sufficient',
      passed: completeness >= 75,
      detail: completeness >= 75
        ? `Your profile is ${completeness}% complete.`
        : `Your profile is ${completeness}% complete. Add more detail before submitting.`
    },
    {
      label: 'Education requirement appears aligned',
      passed: !!educationMatch,
      detail: educationMatch
        ? `Your profile education matches ${job?.education || 'the stated requirement'}.`
        : `This role expects ${job?.education || 'specific education details'}. Your current profile shows ${profile.education || 'no education selected yet'}.`
    },
    {
      label: 'Experience requirement appears aligned',
      passed: !!experienceMatch,
      detail: experienceMatch
        ? `Your experience level matches ${job?.experience || 'the role requirement'}.`
        : `This role expects ${job?.experience || 'specific experience details'}. Your current profile shows ${profile.experience || 'no experience level selected yet'}.`
    },
    {
      label: 'Location signal is aligned',
      passed: !!(countryMatch || regionMatch),
      detail: countryMatch || regionMatch
        ? `Your profile location aligns with ${job?.region || job?.country || 'the opportunity location'}.`
        : `Your current location (${profile.region || profile.country || 'not yet set'}) may need confirmation for this role.`
    },
    {
      label: 'Core skills overlap is visible',
      passed: missingSkills.length <= Math.max(1, Math.floor(requiredSkills.length / 3)),
      detail: matchedSkills.length
        ? `You already match ${matchedSkills.length} of ${requiredSkills.length || 0} listed skills.`
        : 'The platform cannot yet see strong overlap between your listed skills and this role.'
    }
  ];
  const nextActions = [];
  if (completeness < 75) nextActions.push('Complete your profile before you submit.');
  if (!educationMatch) nextActions.push('Check the education requirement carefully.');
  if (!experienceMatch) nextActions.push('Clarify your experience level and practical exposure.');
  if (missingSkills.length) nextActions.push(`Strengthen or better evidence these skills: ${missingSkills.slice(0, 4).join(', ')}.`);
  if (!nextActions.length) nextActions.push('You appear ready to proceed to a full application session.');
  return {
    score,
    band: readinessBand(score),
    completeness,
    matchedSkills,
    missingSkills,
    checklist,
    nextActions,
    learningSignal: missingSkills.length
      ? `Suggested upskilling focus: ${missingSkills.slice(0, 3).join(', ')}`
      : 'Your current profile looks broadly aligned to this role.'
  };
}

function normalizeQuestions(raw) {
  return (raw || []).map((item, index) => ({
    id: item.id,
    text: item.question_text || item.questionText || `Screening question ${index + 1}`,
    type: item.question_type || item.questionType || 'Short Text',
    optionsText: item.options_text || item.optionsText || '',
    required: item.is_required !== false,
    sortOrder: item.sort_order || item.sortOrder || (index + 1)
  })).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

async function loadSavedOpportunitiesFromSupabase() {
  ensureEnhancedState();
  state.shortlist.opportunities = [];
  if (!isConfigured || !supabase || !currentUser || state.role !== 'youth') return;
  const { data, error } = await supabase
    .from('saved_opportunities')
    .select('id, opportunity_id, created_at')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error loading saved opportunities:', error);
    return;
  }
  state.shortlist.opportunities = (data || []).map(item => ({
    id: item.id,
    opportunityId: item.opportunity_id,
    createdAt: item.created_at
  }));
}

async function loadApplicationDraftsFromSupabase() {
  ensureEnhancedState();
  state.applicationDrafts = [];
  if (!isConfigured || !supabase || !currentUser || state.role !== 'youth') return;
  const { data, error } = await supabase
    .from('opportunity_application_drafts')
    .select('*')
    .eq('applicant_id', currentUser.id)
    .order('updated_at', { ascending: false });
  if (error) {
    console.warn('Application drafts load warning:', error);
    return;
  }
  state.applicationDrafts = (data || []).map(item => ({
    id: item.id,
    opportunityId: item.opportunity_id,
    currentStep: item.current_step || 1,
    readinessScore: item.readiness_score || 0,
    readinessBand: item.readiness_band || 'Early Stage',
    readinessSummary: item.readiness_summary || {},
    motivationNote: item.motivation_note || '',
    documentState: item.document_state || {},
    screeningAnswers: item.screening_answers || {},
    draftPayload: item.draft_payload || {},
    draftStatus: item.draft_status || 'In Progress',
    createdAt: item.created_at,
    updatedAt: item.updated_at,
    submittedAt: item.submitted_at || null
  }));
}

async function ensureOpportunityQuestions(opportunityId) {
  ensureEnhancedState();
  if (state.screeningQuestions[opportunityId]) return state.screeningQuestions[opportunityId];
  if (!isConfigured || !supabase) {
    state.screeningQuestions[opportunityId] = [];
    return [];
  }
  const { data, error } = await supabase
    .from('opportunity_screening_questions')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .order('sort_order', { ascending: true });
  if (error) {
    console.warn('Opportunity questions load warning:', error);
    state.screeningQuestions[opportunityId] = [];
    return [];
  }
  const normalized = normalizeQuestions(data || []);
  state.screeningQuestions[opportunityId] = normalized;
  return normalized;
}

async function upsertOpportunityDraft(opportunityId, changes = {}) {
  ensureEnhancedState();
  if (!isConfigured || !supabase || !currentUser) return null;
  const existing = getDraftByOpportunityId(opportunityId);
  const readiness = changes.readinessSummary || existing?.readinessSummary || calculateOpportunityReadiness(getOpportunityById(opportunityId));
  const payload = {
    opportunity_id: opportunityId,
    applicant_id: currentUser.id,
    current_step: changes.currentStep || existing?.currentStep || state.applicationWizard.step || 1,
    draft_status: changes.draftStatus || existing?.draftStatus || 'In Progress',
    readiness_score: readiness?.score || existing?.readinessScore || 0,
    readiness_band: readiness?.band || existing?.readinessBand || 'Early Stage',
    readiness_summary: readiness,
    motivation_note: changes.motivationNote !== undefined ? changes.motivationNote : (existing?.motivationNote || ''),
    document_state: changes.documentState !== undefined ? changes.documentState : (existing?.documentState || {}),
    screening_answers: changes.screeningAnswers !== undefined ? changes.screeningAnswers : (existing?.screeningAnswers || {}),
    draft_payload: changes.draftPayload !== undefined ? changes.draftPayload : (existing?.draftPayload || {})
  };
  const { data, error } = await supabase
    .from('opportunity_application_drafts')
    .upsert([payload], { onConflict: 'opportunity_id,applicant_id' })
    .select()
    .single();
  if (error) {
    console.warn('Opportunity draft save warning:', error);
    return null;
  }
  await loadApplicationDraftsFromSupabase();
  state.applicationWizard.draftId = data?.id || getDraftByOpportunityId(opportunityId)?.id || null;
  return data;
}

function collectWizardFormState(opportunityId) {
  const existing = getDraftByOpportunityId(opportunityId);
  const motivation = document.getElementById('applicationMotivation')?.value || existing?.motivationNote || '';
  const documentState = {
    cvReady: !!document.getElementById('docCvReady')?.checked,
    coverNoteReady: !!document.getElementById('docCoverReady')?.checked,
    evidenceReady: !!document.getElementById('docEvidenceReady')?.checked
  };
  const questions = state.screeningQuestions[opportunityId] || [];
  const screeningAnswers = {};
  questions.forEach(question => {
    const input = document.getElementById(`screening_${question.id}`);
    if (input) screeningAnswers[question.id] = input.value || '';
  });
  return {
    motivationNote: motivation,
    documentState,
    screeningAnswers
  };
}

function saveOpportunityLocally(opportunityId, savedId = null) {
  ensureEnhancedState();
  if (!state.shortlist.opportunities.some(item => item.opportunityId === opportunityId)) {
    state.shortlist.opportunities.unshift({ id: savedId || `local-${opportunityId}`, opportunityId, createdAt: new Date().toISOString() });
  }
}

function removeSavedOpportunityLocally(opportunityId) {
  ensureEnhancedState();
  state.shortlist.opportunities = (state.shortlist.opportunities || []).filter(item => item.opportunityId !== opportunityId);
}

async function saveOpportunityToSupabase(opportunityId) {
  ensureEnhancedState();
  if (!isConfigured || !supabase || !currentUser) return { ok: false, reason: 'auth' };
  const { data, error } = await supabase
    .from('saved_opportunities')
    .upsert([{ user_id: currentUser.id, opportunity_id: opportunityId }], { onConflict: 'user_id,opportunity_id' })
    .select('id, opportunity_id, created_at')
    .single();
  if (error) {
    console.error('Save opportunity error:', error);
    return { ok: false, reason: error.message || 'save_failed' };
  }
  saveOpportunityLocally(opportunityId, data?.id || null);
  return { ok: true };
}

async function removeSavedOpportunityFromSupabase(opportunityId) {
  ensureEnhancedState();
  if (!isConfigured || !supabase || !currentUser) return { ok: false, reason: 'auth' };
  const { error } = await supabase
    .from('saved_opportunities')
    .delete()
    .eq('user_id', currentUser.id)
    .eq('opportunity_id', opportunityId);
  if (error) {
    console.error('Remove saved opportunity error:', error);
    return { ok: false, reason: error.message || 'remove_failed' };
  }
  removeSavedOpportunityLocally(opportunityId);
  return { ok: true };
}

function fitClass(score) {
  if (score >= 80) return 'readiness-strong';
  if (score >= 60) return 'readiness-medium';
  return 'readiness-emerging';
}

function renderOpportunityActionBar(job) {
  const saved = getSavedOpportunityIds().has(job.id);
  const draft = getDraftByOpportunityId(job.id);
  return `
    <div class="opportunity-actions-row">
      <button class="secondary" onclick="toggleOpportunitySave('${escapeHtml(job.id)}')">${saved ? 'Saved to shortlist' : 'Save'}</button>
      <button class="secondary" onclick="viewOpportunityDetail('${escapeHtml(job.id)}')">View details</button>
      <button class="secondary" onclick="runOpportunityReadiness('${escapeHtml(job.id)}')">Readiness check</button>
      <button class="primary" onclick="startOpportunityApplication('${escapeHtml(job.id)}')">${draft ? 'Continue application' : 'Apply now'}</button>
    </div>
  `;
}

function renderMetaPill(value, fallback = '') {
  if (!String(value || '').trim()) return '';
  return `<span class="pill">${escapeHtml(value || fallback)}</span>`;
}

function renderRichJobSkills(job) {
  return splitCsv(job.skills).map(skill => `<span class="pill">${escapeHtml(skill)}</span>`).join('');
}

function renderRelatedOpportunities(currentJob) {
  const related = (state.jobs || [])
    .filter(item => item.id !== currentJob.id && item.status === 'Verified')
    .sort((a, b) => matchScore(b) - matchScore(a))
    .slice(0, 3);
  if (!related.length) {
    return `<div class="empty-card"><h4>No related opportunities yet</h4><p class="label">As more verified listings are published, related opportunities will appear here.</p></div>`;
  }
  return related.map(item => `
    <div class="micro-opportunity-card">
      <div>
        <h4>${escapeHtml(item.title)}</h4>
        <p class="label">${escapeHtml(item.org)} • ${escapeHtml(item.region || 'Location flexible')}, ${escapeHtml(item.country || 'Multi-country')}</p>
      </div>
      <div class="micro-opportunity-actions">
        <span class="pill">${matchScore(item)}% fit</span>
        <button class="secondary" onclick="viewOpportunityDetail('${escapeHtml(item.id)}')">Open</button>
      </div>
    </div>
  `).join('');
}

function renderSuggestedTraining(readiness) {
  const courses = (state.courses || []).filter(item => item.status === 'Verified').slice(0, 3);
  if (!courses.length) {
    return `<div class="empty-card"><h4>No suggested training yet</h4><p class="label">Verified courses will appear here when institutions publish aligned learning offers.</p></div>`;
  }
  return courses.map(course => `
    <div class="mini-card pathway-recommendation-card">
      <div class="mini-top">
        ${statusBadge(course.status || 'Verified')}
        <span class="pill">${escapeHtml(course.mode || 'Training')}</span>
      </div>
      <h4>${escapeHtml(course.title)}</h4>
      <p class="label">${escapeHtml(course.provider)} • ${escapeHtml(course.duration || 'Flexible duration')}</p>
      <p class="label">${escapeHtml(readiness.missingSkills.length ? 'Helpful for: ' + readiness.missingSkills.slice(0, 3).join(', ') : 'Broad relevance for this pathway.')}</p>
    </div>
  `).join('');
}

function jobCard(job, action) {
  ensureEnhancedState();
  const score = matchScore(job);
  const status = job.status || 'Pending';
  const isVerified = status === 'Verified';
  const saved = getSavedOpportunityIds().has(job.id);
  const draft = getDraftByOpportunityId(job.id);
  const trustNote = isVerified
    ? 'Verified listing visible to the public opportunity marketplace.'
    : status === 'Pending'
      ? 'Awaiting moderation before wider visibility.'
      : status === 'Closed'
        ? 'This opportunity is no longer accepting active applications.'
        : 'Status updated through platform moderation.';
  return `
    <div class="job ${isVerified ? 'job-verified' : ''}">
      <div>
        <div class="job-header-row">
          <div>
            <h3>${escapeHtml(job.title)}</h3>
            <p><b>${escapeHtml(job.org)}</b> • ${escapeHtml(job.region || 'Location flexible')}, ${escapeHtml(job.country || 'Multi-country')} • ${escapeHtml(job.type || 'Opportunity')} • ${escapeHtml(job.experience || 'Experience not stated')}</p>
          </div>
          <div class="job-badges">
            ${statusBadge(status)}
            ${saved ? '<span class="pill pill-verified">Saved</span>' : ''}
            ${draft ? `<span class="pill pill-trust">Step ${escapeHtml(String(draft.currentStep || 1))} in progress</span>` : ''}
          </div>
        </div>
        <p>${escapeHtml(job.desc || 'Role details will appear on the structured opportunity page.')}</p>
        <div>${renderRichJobSkills(job)}</div>
        <div class="trust-inline">${escapeHtml(trustNote)}</div>
        ${action ? renderOpportunityActionBar(job) : `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">${statusBadge(status)}</div>`}
      </div>
      <div class="fit ${fitClass(score)}" style="--score:${score}"><span>${score}%</span></div>
    </div>
  `;
}

function shortlistView() {
  ensureEnhancedState();
  const savedItems = (state.shortlist.opportunities || []).map(item => getOpportunityById(item.opportunityId)).filter(Boolean);
  return `
    <div class="grid">
      <div class="card span-12 shortlist-hero">
        <div>
          <div class="kicker">My shortlist</div>
          <h3>Saved opportunities for later review</h3>
          <p class="label">Save keeps opportunities in your shortlist. Apply launches a guided application session with readiness support and structured steps.</p>
        </div>
        <div class="pathway-summary-row">
          <span class="pathway-summary-item">${savedItems.length} saved opportunities</span>
          <span class="pathway-summary-item">${state.applicationDrafts.length} applications in progress</span>
          <button class="secondary" onclick="setView('opportunities')">Browse more opportunities</button>
        </div>
      </div>
      <div class="card span-12">
        <div class="section-title"><h3>Saved opportunities</h3><span class="pill pill-verified">Shortlist</span></div>
        ${savedItems.length ? savedItems.map(item => `
          <div class="shortlist-item-card">
            <div>
              <h4>${escapeHtml(item.title)}</h4>
              <p class="label">${escapeHtml(item.org)} • ${escapeHtml(item.region || 'Location flexible')}, ${escapeHtml(item.country || 'Multi-country')}</p>
              <div class="results-meta">
                ${renderMetaPill(item.type)}
                ${renderMetaPill(item.education)}
                ${renderMetaPill(item.experience)}
              </div>
            </div>
            <div class="shortlist-item-actions">
              <button class="secondary" onclick="viewOpportunityDetail('${escapeHtml(item.id)}')">View details</button>
              <button class="secondary" onclick="runOpportunityReadiness('${escapeHtml(item.id)}')">Readiness check</button>
              <button class="primary" onclick="startOpportunityApplication('${escapeHtml(item.id)}')">${getDraftByOpportunityId(item.id) ? 'Continue applying' : 'Apply now'}</button>
              <button class="secondary" onclick="toggleOpportunitySave('${escapeHtml(item.id)}')">Remove</button>
            </div>
          </div>
        `).join('') : `<div class="empty-card"><h4>Your shortlist is empty</h4><p class="label">Save interesting opportunities first, then return here to compare, review and apply with more intention.</p><button class="secondary" onclick="setView('opportunities')">Explore opportunities</button></div>`}
      </div>
    </div>
  `;
}

function opportunityDetailView() {
  ensureEnhancedState();
  const job = getOpportunityById(state.selectedOpportunityId);
  if (!job) {
    return `<div class="grid"><div class="card span-12"><div class="empty-card"><h4>Opportunity not found</h4><p class="label">Return to the marketplace and open another verified opportunity.</p><button class="secondary" onclick="setView('opportunities')">Back to opportunities</button></div></div></div>`;
  }
  const readiness = calculateOpportunityReadiness(job);
  const saved = getSavedOpportunityIds().has(job.id);
  return `
    <div class="grid">
      <div class="card span-12 opp-detail-hero">
        <div class="opp-detail-main">
          <div class="kicker">Opportunity detail</div>
          <h3>${escapeHtml(job.title)}</h3>
          <p class="label"><b>${escapeHtml(job.org)}</b> • ${escapeHtml(job.region || 'Location flexible')}, ${escapeHtml(job.country || 'Multi-country')} • ${escapeHtml(job.type || 'Opportunity')}</p>
          <div class="results-meta">
            ${statusBadge(job.status || 'Verified')}
            ${saved ? '<span class="pill pill-verified">Saved to shortlist</span>' : '<span class="pill">Not yet saved</span>'}
            ${renderMetaPill(job.workArrangement)}
            ${renderMetaPill(job.duration)}
            ${renderMetaPill(job.compensation)}
            ${job.deadline ? `<span class="pill">Deadline ${escapeHtml(job.deadline)}</span>` : ''}
          </div>
          <p class="opp-detail-description">${escapeHtml(job.desc || 'Structured opportunity details will expand here as employers publish richer metadata.')}</p>
          <div class="opportunity-actions-row">
            <button class="secondary" onclick="setView('opportunities')">Back to marketplace</button>
            <button class="secondary" onclick="toggleOpportunitySave('${escapeHtml(job.id)}')">${saved ? 'Remove from shortlist' : 'Save to shortlist'}</button>
            <button class="secondary" onclick="runOpportunityReadiness('${escapeHtml(job.id)}')">Open readiness check</button>
            <button class="primary" onclick="startOpportunityApplication('${escapeHtml(job.id)}')">${getDraftByOpportunityId(job.id) ? 'Continue application' : 'Start guided application'}</button>
          </div>
        </div>
        <div class="opp-detail-fit-rail">
          <div class="fit ${fitClass(readiness.score)}" style="--score:${readiness.score}"><span>${readiness.score}%</span></div>
          <div class="label" style="text-align:center;">${escapeHtml(readiness.band)} readiness</div>
        </div>
      </div>
      <div class="card span-8">
        <div class="section-title"><h3>About this role</h3><span class="pill pill-trust">Structured detail page</span></div>
        <div class="opp-detail-grid">
          <div class="detail-list-card">
            <h4>Eligibility and role criteria</h4>
            <ul>
              <li><b>Education:</b> ${escapeHtml(job.education || 'Not specified')}</li>
              <li><b>Experience:</b> ${escapeHtml(job.experience || 'Not specified')}</li>
              <li><b>Required skills:</b> ${escapeHtml(job.skills || 'Not specified')}</li>
              <li><b>Work arrangement:</b> ${escapeHtml(job.workArrangement || 'Not specified')}</li>
              <li><b>Duration:</b> ${escapeHtml(job.duration || 'Not specified')}</li>
            </ul>
          </div>
          <div class="detail-list-card">
            <h4>What the applicant may gain</h4>
            <p class="label">${escapeHtml(job.learningOutcomes || job.benefits || 'The employer has not yet published detailed learning outcomes or benefits for this opportunity.')}</p>
            <h4 style="margin-top:16px;">Why this role matters</h4>
            <p class="label">${escapeHtml(job.benefits || 'Use this opportunity page to communicate what the job offers beyond a vacancy title: exposure, practical learning, mentorship, income or pathway progression.')}</p>
          </div>
        </div>
      </div>
      <div class="card span-4">
        <div class="section-title"><h3>Profile fit guidance</h3><span class="pill">Live</span></div>
        <div class="fit-panel-list">
          <div class="fit-panel-block"><b>${readiness.matchedSkills.length}</b><span class="label">criteria signals matched</span></div>
          <div class="fit-panel-block"><b>${readiness.missingSkills.length}</b><span class="label">skills still missing</span></div>
          <div class="fit-panel-block"><b>${readiness.completeness}%</b><span class="label">profile completeness</span></div>
        </div>
        <div class="soft-note" style="margin-top:12px;">${escapeHtml(readiness.learningSignal)}</div>
        <div class="results-meta" style="margin-top:12px;">
          ${(readiness.missingSkills.length ? readiness.missingSkills : ['No major skill gaps surfaced']).map(skill => `<span class="pill">${escapeHtml(skill)}</span>`).join('')}
        </div>
      </div>
      <div class="card span-6">
        <div class="section-title"><h3>Suggested training before or during application</h3><button class="secondary" onclick="setView('training')">See training catalogue</button></div>
        ${renderSuggestedTraining(readiness)}
      </div>
      <div class="card span-6">
        <div class="section-title"><h3>Related opportunities</h3><button class="secondary" onclick="setView('opportunities')">Browse all</button></div>
        ${renderRelatedOpportunities(job)}
      </div>
    </div>
  `;
}

function readinessCheckView() {
  ensureEnhancedState();
  const opportunityId = state.readinessCheck?.opportunityId || state.selectedOpportunityId;
  const job = getOpportunityById(opportunityId);
  const readiness = state.readinessCheck?.result || (job ? calculateOpportunityReadiness(job) : null);
  if (!job || !readiness) return opportunityDetailView();
  return `
    <div class="grid">
      <div class="card span-12 readiness-hero">
        <div>
          <div class="kicker">Readiness check</div>
          <h3>${escapeHtml(job.title)}</h3>
          <p class="label">This is where Save and Apply become meaningfully different: first understand how ready you are, then decide whether to proceed.</p>
        </div>
        <div class="readiness-score-hero ${fitClass(readiness.score)}">
          <div class="metric">${readiness.score}%</div>
          <div class="label">${escapeHtml(readiness.band)} readiness</div>
        </div>
      </div>
      <div class="card span-8">
        <div class="section-title"><h3>Self-assessment against listed criteria</h3><span class="pill pill-trust">Dynamic fit guidance</span></div>
        <div class="criteria-check-list">
          ${readiness.checklist.map(item => `
            <div class="criteria-check-item ${item.passed ? 'criteria-check-pass' : 'criteria-check-watch'}">
              <div class="criteria-check-state">${item.passed ? '✓' : '!'}</div>
              <div>
                <h4>${escapeHtml(item.label)}</h4>
                <p class="label">${escapeHtml(item.detail)}</p>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="card span-4">
        <div class="section-title"><h3>Next best actions</h3><span class="pill">Action path</span></div>
        <div class="next-action-stack">
          ${readiness.nextActions.map(action => `<div class="next-action-item">${escapeHtml(action)}</div>`).join('')}
        </div>
        <div class="soft-note" style="margin-top:14px;">${escapeHtml(readiness.learningSignal)}</div>
        <div class="hero-actions" style="margin-top:14px;">
          <button class="secondary" onclick="viewOpportunityDetail('${escapeHtml(job.id)}')">Back to details</button>
          <button class="primary" onclick="startOpportunityApplication('${escapeHtml(job.id)}')">Proceed to guided application</button>
        </div>
      </div>
    </div>
  `;
}

function renderScreeningInput(question, value) {
  const safeId = `screening_${question.id}`;
  if (question.type === 'Long Text') {
    return `<textarea id="${safeId}" placeholder="Write your response here">${escapeHtml(value || '')}</textarea>`;
  }
  if (question.type === 'Yes/No') {
    return `
      <select id="${safeId}">
        ${renderOptions(['Yes', 'No'], value || '', 'Select response')}
      </select>
    `;
  }
  if (question.type === 'Single Select') {
    const options = splitCsv(question.optionsText || '').length ? splitCsv(question.optionsText || '') : ['Option 1', 'Option 2'];
    return `<select id="${safeId}">${renderOptions(options, value || '', 'Select option')}</select>`;
  }
  return `<input id="${safeId}" value="${escapeHtml(value || '')}" placeholder="Write your response" />`;
}

function applicationWizardView() {
  ensureEnhancedState();
  const opportunityId = state.applicationWizard?.opportunityId || state.selectedOpportunityId;
  const job = getOpportunityById(opportunityId);
  if (!job) return opportunityDetailView();
  const draft = getDraftByOpportunityId(opportunityId) || {};
  const readiness = draft.readinessSummary || calculateOpportunityReadiness(job);
  const step = Math.min(5, Math.max(1, Number(state.applicationWizard?.step || draft.currentStep || 1)));
  const labels = applicationStepLabels();
  const screeningQuestions = state.screeningQuestions[opportunityId] || [];
  let body = '';
  if (step === 1) {
    body = `
      <div class="wizard-pane-grid">
        <div class="detail-list-card">
          <h4>Review the opportunity first</h4>
          <p class="label">Read the role carefully before committing to a full application session.</p>
          <ul>
            <li><b>Organisation:</b> ${escapeHtml(job.org)}</li>
            <li><b>Location:</b> ${escapeHtml(job.region || 'Location flexible')}, ${escapeHtml(job.country || 'Multi-country')}</li>
            <li><b>Type:</b> ${escapeHtml(job.type || 'Opportunity')}</li>
            <li><b>Required skills:</b> ${escapeHtml(job.skills || 'Not specified')}</li>
          </ul>
        </div>
        <div class="detail-list-card">
          <h4>Before you proceed</h4>
          <p class="label">Use the next steps to assess your fit, prepare your package, respond to screening questions and only then submit formally.</p>
          <div class="soft-note">This avoids the current shallow one-click behaviour and turns application into a more intentional session.</div>
        </div>
      </div>
    `;
  } else if (step === 2) {
    body = `
      <div class="wizard-pane-grid">
        <div class="detail-list-card">
          <h4>Your readiness score</h4>
          <div class="wizard-score-shell ${fitClass(readiness.score)}">
            <div class="metric">${readiness.score}%</div>
            <div class="label">${escapeHtml(readiness.band)} readiness</div>
          </div>
          <div class="results-meta" style="margin-top:12px;">
            ${(readiness.missingSkills.length ? readiness.missingSkills : ['No major skill gaps surfaced']).map(skill => `<span class="pill">${escapeHtml(skill)}</span>`).join('')}
          </div>
        </div>
        <div class="detail-list-card">
          <h4>Recommendation</h4>
          <p class="label">${escapeHtml(readiness.nextActions[0] || 'Proceed carefully and make sure your application package is strong.')}</p>
          <p class="label">${escapeHtml(readiness.learningSignal)}</p>
        </div>
      </div>
    `;
  } else if (step === 3) {
    const documents = draft.documentState || {};
    body = `
      <div class="wizard-pane-grid">
        <div class="detail-list-card">
          <h4>Application package</h4>
          <label class="full">Motivation note
            <textarea id="applicationMotivation" placeholder="Why are you interested in this opportunity, and why are you a strong fit?">${escapeHtml(draft.motivationNote || '')}</textarea>
          </label>
        </div>
        <div class="detail-list-card">
          <h4>Readiness of your documents</h4>
          <div class="check-toggle-list">
            <label><input id="docCvReady" type="checkbox" ${documents.cvReady ? 'checked' : ''} /> My CV/resume is ready</label>
            <label><input id="docCoverReady" type="checkbox" ${documents.coverNoteReady ? 'checked' : ''} /> My cover note or motivation statement is ready</label>
            <label><input id="docEvidenceReady" type="checkbox" ${documents.evidenceReady ? 'checked' : ''} /> I have supporting evidence or references if requested</label>
          </div>
          <div class="soft-note">This step keeps the application session lively and reflective instead of instantly declaring success after one click.</div>
        </div>
      </div>
    `;
  } else if (step === 4) {
    body = `
      <div class="detail-list-card">
        <h4>Screening questions</h4>
        <p class="label">Employer-defined screening questions appear here if they exist. If none exist yet, the platform still records your application package and readiness state.</p>
        ${screeningQuestions.length ? screeningQuestions.map(question => `
          <div class="screening-question-card">
            <label class="full">
              ${escapeHtml(question.text)}${question.required ? ' *' : ''}
              ${renderScreeningInput(question, draft.screeningAnswers?.[question.id] || '')}
            </label>
          </div>
        `).join('') : `<div class="empty-card"><h4>No screening questions were configured for this opportunity</h4><p class="label">You can still continue to confirmation with your readiness summary and motivation note.</p></div>`}
      </div>
    `;
  } else {
    const packageSummary = collectWizardFormState(opportunityId);
    const answeredCount = Object.values(packageSummary.screeningAnswers || {}).filter(value => String(value || '').trim()).length;
    body = `
      <div class="wizard-pane-grid">
        <div class="detail-list-card">
          <h4>Final review</h4>
          <ul>
            <li><b>Opportunity:</b> ${escapeHtml(job.title)}</li>
            <li><b>Readiness score:</b> ${escapeHtml(String(readiness.score || 0))}% (${escapeHtml(readiness.band || 'Early Stage')})</li>
            <li><b>Motivation note prepared:</b> ${packageSummary.motivationNote.trim() ? 'Yes' : 'No'}</li>
            <li><b>Document package ready:</b> ${(packageSummary.documentState.cvReady || packageSummary.documentState.coverNoteReady || packageSummary.documentState.evidenceReady) ? 'Partly or fully ready' : 'Not yet confirmed'}</li>
            <li><b>Screening questions answered:</b> ${answeredCount}</li>
          </ul>
        </div>
        <div class="detail-list-card">
          <h4>What happens after submission</h4>
          <p class="label">The application will move to <b>Submitted</b>, the opportunity will remain visible in your dashboard history, and this wizard draft will be marked as submitted.</p>
          <div class="soft-note">This is the moment where Apply becomes a deliberate final action rather than a premature one-click popup.</div>
        </div>
      </div>
    `;
  }
  return `
    <div class="grid">
      <div class="card span-12 wizard-shell-card">
        <div class="section-title">
          <div>
            <div class="kicker">Guided application session</div>
            <h3>${escapeHtml(job.title)}</h3>
            <p class="label">Step ${step} of 5 — ${escapeHtml(labels[step - 1])}</p>
          </div>
          <div class="results-meta">
            ${statusBadge(draft.draftStatus || 'In Progress')}
            <span class="pill">Readiness ${escapeHtml(String(readiness.score || 0))}%</span>
          </div>
        </div>
        <div class="wizard-steps-row">
          ${labels.map((label, index) => `<div class="wizard-step-chip ${index + 1 === step ? 'active' : ''} ${index + 1 < step ? 'complete' : ''}"><span>${index + 1}</span><b>${escapeHtml(label)}</b></div>`).join('')}
        </div>
        <div class="wizard-stage-panel">
          ${body}
        </div>
        <div class="wizard-footer-actions">
          <button class="secondary" onclick="viewOpportunityDetail('${escapeHtml(job.id)}')">Exit to details</button>
          <div class="wizard-footer-main-actions">
            ${step > 1 ? `<button class="secondary" onclick="changeApplicationStep(-1)">Back</button>` : ''}
            ${step < 5 ? `<button class="primary" onclick="changeApplicationStep(1)">Save and continue</button>` : `<button class="primary" onclick="submitOpportunityApplication()">Submit application</button>`}
          </div>
        </div>
      </div>
    </div>
  `;
}

function applicationSuccessView() {
  ensureEnhancedState();
  const success = state.applicationWizard?.success || null;
  if (!success) return opportunities();
  return `
    <div class="grid">
      <div class="card span-12 application-success-shell">
        <div class="success-icon">✓</div>
        <div class="kicker">Application submitted</div>
        <h3>${escapeHtml(success.title || 'Application submitted successfully')}</h3>
        <p class="label">${escapeHtml(success.message || 'Your guided application was submitted and tracked successfully.')}</p>
        <div class="pathway-summary-row" style="justify-content:center;">
          <span class="pathway-summary-item">Opportunity ${escapeHtml(success.opportunityTitle || '')}</span>
          <span class="pathway-summary-item">Status Submitted</span>
          <span class="pathway-summary-item">Readiness ${escapeHtml(String(success.readinessScore || 0))}%</span>
        </div>
        <div class="hero-actions" style="justify-content:center; margin-top:18px;">
          <button class="secondary" onclick="setView('dashboard')">Return to dashboard</button>
          <button class="secondary" onclick="setView('shortlist')">Go to shortlist</button>
          <button class="primary" onclick="setView('opportunities')">Browse more opportunities</button>
        </div>
      </div>
    </div>
  `;
}

function youthDash() {
  ensureEnhancedState();
  const ranked = [...state.jobs].filter(item => item.status === 'Verified').sort((a, b) => matchScore(b) - matchScore(a));
  const completion = youthProfileCompletion();
  const savedCount = state.shortlist.opportunities.length;
  const inProgressCount = state.applicationDrafts.filter(item => item.draftStatus !== 'Submitted').length;
  const submittedCount = youthApplicationCount();
  return `
    ${onboardingPanel()}
    <div class="notice"><b>Guided product upgrade:</b> Save now stores opportunities in your shortlist, View Details opens a structured opportunity page, Readiness Check runs a self-assessment, and Apply launches a real guided session.</div>
    <div class="grid" style="margin-top:18px;">
      <div class="card span-3"><div class="label">Profile completeness</div><div class="metric">${completion}%</div><div class="label">Improve this to strengthen readiness and relevance.</div></div>
      <div class="card span-3"><div class="label">Saved opportunities</div><div class="metric">${savedCount}</div><div class="label">Your shortlist for later comparison and action.</div></div>
      <div class="card span-3"><div class="label">Applications in progress</div><div class="metric">${inProgressCount}</div><div class="label">Guided application sessions not yet submitted.</div></div>
      <div class="card span-3"><div class="label">Submitted applications</div><div class="metric">${submittedCount}</div><div class="label">Formal applications already sent to employers.</div></div>
    </div>
    ${completionCard('Youth profile readiness', completion, 'A fuller profile improves readiness checks, fit explanations and employer confidence.', 'Complete youth profile')}
    <div class="grid" style="margin-top:18px;">
      <div class="card span-8">
        <div class="section-title"><h3>Recommended opportunities</h3><div class="hero-actions"><button class="secondary" onclick="setView('shortlist')">Open shortlist</button><button class="secondary" onclick="setView('opportunities')">View all</button></div></div>
        ${ranked.slice(0, 3).length ? ranked.slice(0, 3).map(item => jobCard(item, true)).join('') : `<div class="empty-card"><h4>No verified opportunities yet</h4><p class="label">Once moderated listings are available, your strongest matches will appear here automatically.</p><button class="secondary" onclick="setView('opportunities')">Browse all opportunities</button></div>`}
      </div>
      <div class="card span-4">
        <div class="section-title"><h3>Current action path</h3><span class="pill pill-trust">Lively workflow</span></div>
        <div class="next-action-stack">
          <div class="next-action-item">1. Save promising roles to your shortlist.</div>
          <div class="next-action-item">2. Open details and review what the opportunity really offers.</div>
          <div class="next-action-item">3. Run your readiness check before applying.</div>
          <div class="next-action-item">4. Complete the guided application session instead of one-click submission.</div>
        </div>
      </div>
    </div>
  `;
}

function opportunities() {
  ensureEnhancedState();
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
      <div class="card span-12 browse-hero-card">
        <div>
          <div class="kicker">Dynamic opportunity marketplace</div>
          <h3>Explore, save, assess, then apply</h3>
          <p class="label">The marketplace is no longer limited to a static list. Each opportunity now supports a shortlist action, a rich detail page, a readiness check and a guided application session.</p>
        </div>
        <div class="pathway-summary-row">
          <span class="pathway-summary-item">${list.length} visible result${list.length === 1 ? '' : 's'}</span>
          <span class="pathway-summary-item">${state.shortlist.opportunities.length} saved</span>
          <span class="pathway-summary-item">${state.applicationDrafts.length} in progress</span>
        </div>
      </div>
      <div class="card span-12">
        ${filtersPanel('Search the opportunity marketplace', 'Filter by keyword, country, location, type and requirements, then move from static browse to live guided action.', controls, 'clearOpportunityFilters')}
        <div class="results-meta">
          <span class="pill pill-verified">Verified and visible listings only</span>
          <span class="pill pill-trust">Shortlist + readiness + guided apply enabled</span>
        </div>
        <div class="notice trust-notice"><b>Experience upgrade:</b> Save keeps opportunities for later, while Apply starts a proper application journey. They are now treated as different actions.</div>
        <div style="margin-top:14px;">
          ${list.length ? list.map(item => jobCard(item, true)).join('') : `
            <div class="empty-card">
              <h4>No opportunities matched your search</h4>
              <p class="label">Try removing or widening some filters, then explore again.</p>
              <div class="hero-actions">
                <button class="secondary" onclick="clearOpportunityFilters()">Reset filters</button>
                <button class="secondary" onclick="setView('home')">Return home</button>
              </div>
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

function navItems() {
  ensureEnhancedState();
  if (!currentUser) return ['home', 'opportunities', 'training', 'about', 'privacy', 'terms', 'contact'];
  if (state.role === 'youth') return ['dashboard', 'opportunities', 'shortlist', 'training', 'profile', 'notifications', 'about', 'privacy', 'terms', 'contact'];
  if (state.role === 'employer') return ['dashboard', 'post opportunity', 'candidates', 'profile', 'notifications', 'about', 'privacy', 'terms', 'contact'];
  if (state.role === 'institution') return ['dashboard', 'post training', 'courses', 'profile', 'notifications', 'about', 'privacy', 'terms', 'contact'];
  return ['dashboard', 'verification', 'insights', 'notifications', 'about', 'privacy', 'terms', 'contact'];
}

function desc() {
  if (state.view === 'home') return 'Discover verified youth opportunities, training pathways and trusted partners across Africa.';
  if (state.view === 'shortlist') return 'Review saved opportunities, compare them deliberately and launch guided applications when you are ready.';
  if (state.view === 'opportunity detail') return 'Structured opportunity page with trust, fit, suggested training and richer employer detail.';
  if (state.view === 'readiness check') return 'Run a self-assessment before deciding whether to apply.';
  if (state.view === 'application wizard') return 'A true guided application session with structured steps instead of one-click submission.';
  if (state.view === 'application success') return 'Your guided application has been submitted and tracked successfully.';
  if (state.view === 'about') return 'Learn what Jobs4Youth is, who it serves, and why it exists.';
  if (state.view === 'privacy') return 'Understand how Jobs4Youth collects, uses and protects user information.';
  if (state.view === 'terms') return 'Review the rules, responsibilities and conditions for using Jobs4Youth.';
  if (state.view === 'contact') return 'Get in touch for support, partnerships and platform enquiries.';
  if (state.view === 'notifications') return 'Track platform alerts, queued email notifications and verification decision messages in one place.';
  if (state.role === 'youth') return 'Find relevant jobs, internships and training matched to your skills and goals.';
  if (state.role === 'employer') return 'Post opportunities, review candidates, upload verification documents and receive decision messages professionally.';
  if (state.role === 'institution') return 'Publish courses, upload verification documents and receive clear verification and moderation messaging.';
  return 'Verify partners, monitor activity and generate labour market intelligence.';
}

async function loadJobsFromSupabase() {
  if (!isConfigured || !supabase) return;
  const { data, error } = await supabase.from('opportunities').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Error loading jobs:', error);
    return;
  }
  state.jobs = (data || []).map(job => ({
    id: job.id,
    title: job.title || 'No title',
    org: job.organization_name || 'Unknown organisation',
    country: job.country || '',
    region: job.region || '',
    type: job.opportunity_type || '',
    skills: job.required_skills || '',
    education: job.education_requirement || '',
    experience: job.experience_requirement || '',
    status: job.status || 'Pending',
    desc: job.description || '',
    postedBy: job.posted_by || null,
    deadline: job.deadline || '',
    compensation: job.compensation || '',
    workArrangement: job.work_arrangement || '',
    duration: job.duration || '',
    benefits: job.benefits || '',
    learningOutcomes: job.learning_outcomes || ''
  }));
}

async function loadApplicationsFromSupabase() {
  ensureEnhancedState();
  state.applications = [];
  state.employerCandidates = [];
  if (!isConfigured || !currentUser || !supabase) return;
  if (state.role === 'youth') {
    const { data, error } = await supabase
      .from('applications')
      .select('id, opportunity_id, application_status, created_at')
      .eq('applicant_id', currentUser.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error loading youth applications:', error);
      return;
    }
    state.applications = (data || []).map(item => ({
      id: item.id,
      opportunityId: item.opportunity_id,
      status: item.application_status || 'Submitted',
      createdAt: item.created_at
    }));
    return;
  }
  if (state.role === 'employer' || state.role === 'admin') {
    const { data: myOpps, error: oppError } = await supabase.from('opportunities').select('id,title').eq('posted_by', currentUser.id);
    if (oppError) {
      console.error('Error loading employer opportunities:', oppError);
      return;
    }
    const opportunityIds = (myOpps || []).map(item => item.id);
    if (!opportunityIds.length) return;
    const { data: apps, error: appError } = await supabase
      .from('applications')
      .select('id, opportunity_id, applicant_id, application_status, created_at')
      .in('opportunity_id', opportunityIds)
      .order('created_at', { ascending: false });
    if (appError) {
      console.error('Error loading employer applications:', appError);
      return;
    }
    const applicantIds = [...new Set((apps || []).map(item => item.applicant_id).filter(Boolean))];
    let profileMap = {};
    if (applicantIds.length) {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, country, region, skills, education, experience_level')
        .in('id', applicantIds);
      if (!profileError) profileMap = Object.fromEntries((profiles || []).map(item => [item.id, item]));
    }
    const oppMap = Object.fromEntries((myOpps || []).map(item => [item.id, item]));
    state.employerCandidates = (apps || []).map(item => ({
      id: item.id,
      opportunityTitle: oppMap[item.opportunity_id]?.title || 'Opportunity',
      applicantName: profileMap[item.applicant_id]?.full_name || 'Applicant',
      applicantEmail: profileMap[item.applicant_id]?.email || '',
      country: profileMap[item.applicant_id]?.country || '',
      region: profileMap[item.applicant_id]?.region || '',
      skills: profileMap[item.applicant_id]?.skills || '',
      education: profileMap[item.applicant_id]?.education || '',
      experience: profileMap[item.applicant_id]?.experience_level || '',
      status: item.application_status || 'Submitted'
    }));
  }
}

async function handleAuthSubmit() {
  if (!isConfigured) {
    pushToast('Add config.js with your Supabase URL and anon key first.', 'warning');
    return;
  }
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
  await loadSavedOpportunitiesFromSupabase();
  await loadApplicationDraftsFromSupabase();
  await loadSignalLayerFromSupabase();
  await loadVerificationQueueFromSupabase();
  await loadVerificationDocumentsFromSupabase();
  await loadNotificationsFromSupabase();
  closeAuthModal();
  state.view = 'dashboard';
  pushToast(authMode === 'signup' ? 'Account created successfully.' : 'Signed in successfully.');
  render();
}

async function signOut() {
  if (isConfigured && supabase) await supabase.auth.signOut();
  currentUser = null;
  state = structuredClone(demoState);
  ensureEnhancedState();
  browseFilters.jobs = { keyword: '', country: '', region: '', type: '', education: '', experience: '' };
  browseFilters.courses = { keyword: '', country: '', region: '', mode: '' };
  state.view = 'home';
  render();
  pushToast('Signed out.', 'neutral');
}

window.toggleOpportunitySave = async function(opportunityId) {
  ensureEnhancedState();
  if (!currentUser) {
    openLogin();
    pushToast('Please sign in first to use your shortlist.', 'warning');
    return;
  }
  const profile = await ensureProfile(currentUser);
  if (!profile || profile.role !== 'youth') {
    pushToast('Only youth accounts can save opportunities to a shortlist.', 'warning');
    return;
  }
  const saved = getSavedOpportunityIds().has(opportunityId);
  const result = saved
    ? await removeSavedOpportunityFromSupabase(opportunityId)
    : await saveOpportunityToSupabase(opportunityId);
  if (!result.ok) {
    pushToast(saved ? 'Unable to remove this opportunity from shortlist.' : 'Unable to save this opportunity right now.', 'warning');
    return;
  }
  render();
  pushToast(saved ? 'Removed from shortlist.' : 'Saved to shortlist.');
};

window.viewOpportunityDetail = async function(opportunityId) {
  ensureEnhancedState();
  state.selectedOpportunityId = opportunityId;
  state.view = 'opportunity detail';
  await ensureOpportunityQuestions(opportunityId);
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.runOpportunityReadiness = async function(opportunityId) {
  ensureEnhancedState();
  if (!currentUser) {
    openLogin();
    pushToast('Please sign in first to run a readiness check.', 'warning');
    return;
  }
  const profile = await ensureProfile(currentUser);
  if (!profile || profile.role !== 'youth') {
    pushToast('Only youth accounts can run a readiness check for opportunities.', 'warning');
    return;
  }
  const job = getOpportunityById(opportunityId);
  if (!job) {
    pushToast('Opportunity not found.', 'warning');
    return;
  }
  const readiness = calculateOpportunityReadiness(job);
  state.selectedOpportunityId = opportunityId;
  state.readinessCheck = { opportunityId, result: readiness };
  state.view = 'readiness check';
  await upsertOpportunityDraft(opportunityId, { currentStep: 2, readinessSummary: readiness });
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.startOpportunityApplication = async function(opportunityId) {
  ensureEnhancedState();
  if (!currentUser) {
    openLogin();
    pushToast('Please sign in first to start an application.', 'warning');
    return;
  }
  const profile = await ensureProfile(currentUser);
  if (!profile || profile.role !== 'youth') {
    pushToast('Only youth accounts can apply for opportunities.', 'warning');
    return;
  }
  const job = getOpportunityById(opportunityId);
  if (!job) {
    pushToast('Opportunity not found.', 'warning');
    return;
  }
  await ensureOpportunityQuestions(opportunityId);
  const readiness = calculateOpportunityReadiness(job);
  const existing = getDraftByOpportunityId(opportunityId);
  state.selectedOpportunityId = opportunityId;
  state.applicationWizard = {
    opportunityId,
    step: existing?.currentStep || 1,
    draftId: existing?.id || null,
    success: null
  };
  await upsertOpportunityDraft(opportunityId, {
    currentStep: existing?.currentStep || 1,
    readinessSummary: readiness,
    draftStatus: existing?.draftStatus || 'In Progress'
  });
  state.view = 'application wizard';
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.changeApplicationStep = async function(direction) {
  ensureEnhancedState();
  const opportunityId = state.applicationWizard?.opportunityId;
  if (!opportunityId) return;
  let step = Number(state.applicationWizard.step || 1);
  const packageState = collectWizardFormState(opportunityId);
  const job = getOpportunityById(opportunityId);
  const readiness = calculateOpportunityReadiness(job);
  if (direction > 0 && step === 3 && !packageState.motivationNote.trim()) {
    pushToast('Add a short motivation note before you continue.', 'warning');
    return;
  }
  if (direction > 0 && step === 4) {
    const questions = state.screeningQuestions[opportunityId] || [];
    const missingRequired = questions.some(question => question.required && !String(packageState.screeningAnswers?.[question.id] || '').trim());
    if (missingRequired) {
      pushToast('Please answer all required screening questions before continuing.', 'warning');
      return;
    }
  }
  step = Math.min(5, Math.max(1, step + direction));
  state.applicationWizard.step = step;
  await upsertOpportunityDraft(opportunityId, {
    currentStep: step,
    draftStatus: step >= 5 ? 'Ready to Submit' : 'In Progress',
    readinessSummary: readiness,
    motivationNote: packageState.motivationNote,
    documentState: packageState.documentState,
    screeningAnswers: packageState.screeningAnswers,
    draftPayload: {
      profileName: state.profile.name || '',
      updatedAt: new Date().toISOString()
    }
  });
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.submitOpportunityApplication = async function() {
  ensureEnhancedState();
  const opportunityId = state.applicationWizard?.opportunityId;
  if (!opportunityId || !currentUser || !supabase) return;
  const job = getOpportunityById(opportunityId);
  const readiness = calculateOpportunityReadiness(job);
  const packageState = collectWizardFormState(opportunityId);
  if (!packageState.motivationNote.trim()) {
    pushToast('Add a motivation note before submitting.', 'warning');
    return;
  }
  let applicationRecord = null;
  let applicationError = null;
  const existingApplication = (state.applications || []).find(item => item.opportunityId === opportunityId);
  if (existingApplication?.id) {
    const update = await supabase
      .from('applications')
      .update({ application_status: 'Submitted' })
      .eq('id', existingApplication.id)
      .eq('applicant_id', currentUser.id)
      .select()
      .single();
    applicationRecord = update.data;
    applicationError = update.error;
  } else {
    const insert = await supabase
      .from('applications')
      .insert([{ opportunity_id: opportunityId, applicant_id: currentUser.id, application_status: 'Submitted' }])
      .select()
      .single();
    applicationRecord = insert.data;
    applicationError = insert.error;
    if (applicationError && (applicationError.code === '23505' || String(applicationError.message || '').toLowerCase().includes('duplicate'))) {
      const fallback = await supabase
        .from('applications')
        .update({ application_status: 'Submitted' })
        .eq('opportunity_id', opportunityId)
        .eq('applicant_id', currentUser.id)
        .select()
        .single();
      applicationRecord = fallback.data;
      applicationError = fallback.error;
    }
  }
  if (applicationError) {
    console.error('Application submission error:', applicationError);
    pushToast(`Unable to submit the application: ${applicationError.message || 'unknown error'}`, 'warning');
    return;
  }
  if (applicationRecord?.id) {
    const payloadInsert = await supabase
      .from('application_submission_payloads')
      .upsert([{
        application_id: applicationRecord.id,
        draft_id: state.applicationWizard.draftId || null,
        opportunity_id: opportunityId,
        applicant_id: currentUser.id,
        readiness_score: readiness.score,
        readiness_band: readiness.band,
        readiness_summary: readiness,
        motivation_note: packageState.motivationNote,
        document_state: packageState.documentState,
        screening_answers: packageState.screeningAnswers,
        submitted_at: new Date().toISOString()
      }], { onConflict: 'application_id' });
    if (payloadInsert.error) console.warn('Application submission payload warning:', payloadInsert.error);
  }
  await upsertOpportunityDraft(opportunityId, {
    currentStep: 5,
    draftStatus: 'Submitted',
    readinessSummary: readiness,
    motivationNote: packageState.motivationNote,
    documentState: packageState.documentState,
    screeningAnswers: packageState.screeningAnswers,
    draftPayload: { submittedAt: new Date().toISOString() }
  });
  await loadApplicationsFromSupabase();
  await loadApplicationDraftsFromSupabase();
  state.applicationWizard.success = {
    title: 'Your application has been submitted',
    message: 'You reviewed the opportunity, assessed your fit, prepared your package and completed the guided application session successfully.',
    readinessScore: readiness.score,
    opportunityTitle: job?.title || 'Opportunity'
  };
  state.view = 'application success';
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  pushToast('Application submitted successfully.');
};

window.applyJob = async function(opportunityId) {
  await window.startOpportunityApplication(opportunityId);
};

function render() {
  ensureEnhancedState();
  renderShell();
  let c = '';
  if (state.view === 'home') c = home();
  else if (state.view === 'about') c = about();
  else if (state.view === 'privacy') c = privacy();
  else if (state.view === 'terms') c = terms();
  else if (state.view === 'contact') c = contact();
  else if (state.view === 'notifications') c = notificationsCenter();
  else if (state.role === 'youth') {
    if (state.view === 'dashboard') c = youthDash();
    else if (state.view === 'opportunities') c = opportunities();
    else if (state.view === 'shortlist') c = shortlistView();
    else if (state.view === 'opportunity detail') c = opportunityDetailView();
    else if (state.view === 'readiness check') c = readinessCheckView();
    else if (state.view === 'application wizard') c = applicationWizardView();
    else if (state.view === 'application success') c = applicationSuccessView();
    else if (state.view === 'training') c = training();
    else c = profile();
  } else if (state.role === 'employer') {
    c = state.view === 'dashboard' ? employerDash() : state.view === 'post opportunity' ? postOpportunity() : state.view === 'candidates' ? candidates() : profile();
  } else if (state.role === 'institution') {
    c = state.view === 'dashboard' ? institutionDash() : state.view === 'post training' ? postTraining() : state.view === 'courses' ? courses() : profile();
  } else if (state.role === 'admin') {
    c = state.view === 'dashboard' ? adminDash() : state.view === 'verification' ? verification() : state.view === 'insights' ? insights() : state.view === 'about' ? about() : state.view === 'privacy' ? privacy() : state.view === 'terms' ? terms() : state.view === 'notifications' ? notificationsCenter() : contact();
  }
  document.getElementById('content').innerHTML = c;
}

window.saveProfile = async function () {
  if (!isConfigured || !supabase) { pushToast('Supabase not connected.', 'warning'); return; }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user) { pushToast('Please sign in first.', 'warning'); return; }
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
  if (error) { pushToast(`Failed to save profile: ${error.message}`, 'warning'); return; }
  state.profile = { ...state.profile, name: updates.full_name, country: updates.country, region: updates.region, education: updates.education, availability: updates.availability, experience: updates.experience_level, skills: updates.skills, interests: updates.interests };
  render();
  pushToast('Profile saved successfully.');
};

window.saveOrganizationProfile = async function () {
  if (!isConfigured || !supabase) { pushToast('Supabase not connected.', 'warning'); return; }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;
  if (userError || !user) { pushToast('Please sign in first.', 'warning'); return; }
  const updates = {
    full_name: document.getElementById('orgProfileName')?.value || '',
    organization_name: document.getElementById('orgName')?.value || '',
    sector: document.getElementById('orgSector')?.value || '',
    country: document.getElementById('orgCountry')?.value || '',
    region: document.getElementById('orgRegion')?.value || '',
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
  if (error) { pushToast(`Failed to save organisation profile: ${error.message}`, 'warning'); return; }
  state.profile = { ...state.profile, name: updates.full_name, organizationName: updates.organization_name, sector: updates.sector, country: updates.country, region: updates.region };
  render();
  pushToast('Organisation profile saved successfully.');
};

async function initializeApp() {
  ensureEnhancedState();
  state.view = 'home';
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
    await loadApplicationsFromSupabase();
    await loadSavedOpportunitiesFromSupabase();
    await loadApplicationDraftsFromSupabase();
    await loadSignalLayerFromSupabase();
    await loadVerificationQueueFromSupabase();
    await loadVerificationDocumentsFromSupabase();
    await loadNotificationsFromSupabase();
    supabase.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || null;
      if (currentUser) {
        const profile = await ensureProfile(currentUser);
        syncProfileToState(profile);
        ensureEnhancedState();
        state.view = 'dashboard';
      } else {
        state = structuredClone(demoState);
        ensureEnhancedState();
        browseFilters.jobs = { keyword: '', country: '', region: '', type: '', education: '', experience: '' };
        browseFilters.courses = { keyword: '', country: '', region: '', mode: '' };
        state.view = 'home';
      }
      await loadJobsFromSupabase();
      await loadCoursesFromSupabase();
      await loadApplicationsFromSupabase();
      await loadSavedOpportunitiesFromSupabase();
      await loadApplicationDraftsFromSupabase();
      await loadSignalLayerFromSupabase();
      await loadVerificationQueueFromSupabase();
      await loadVerificationDocumentsFromSupabase();
      await loadNotificationsFromSupabase();
      render();
    });
  }
  render();
}
