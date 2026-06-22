
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
  notifications: []
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
      text: `Your employer profile is ${completion}% complete. Add organisation details before posting to present a stronger public-facing profile.`,
      action: `<button class="secondary" onclick="setView('profile')">Complete profile</button>`
    };
    if (!state.profile.verified) return {
      title: 'Verification improves public trust',
      text: 'Your organisation can still save content, but verified organisations present stronger public trust signals to jobseekers.',
      action: `<button class="secondary" onclick="setView('profile')">Review organisation profile</button>`
    };
    return {
      title: 'Your employer profile is public-ready',
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
  document.getElementById('kicker').textContent = isConfigured ? 'Connected workspace' : 'Starter workspace';
  document.getElementById('pageTitle').textContent = state.view === 'home' ? 'Home' : title(state.view);
  document.getElementById('pageDesc').textContent = desc();
  if (!isConfigured) document.getElementById('authStatus').textContent = 'Add config.js to go live';
  else if (currentUser) document.getElementById('authStatus').textContent = `Signed in: ${currentUser.email}${latestUnreadCount() ? ` • ${latestUnreadCount()} unread notification${latestUnreadCount() === 1 ? '' : 's'}` : ''}`;
  else document.getElementById('authStatus').textContent = 'Supabase configured';
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
          <div class="kicker">Public launch platform</div>
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
        <div class="section-title"><h3>Built for public trust and real-world use</h3><span class="pill pill-verified">Moderated platform</span></div>
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
            <p class="label">Jobs4Youth is not only a vacancy site — it also connects opportunities, training and labour market signals in one evolving ecosystem.</p>
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
      <div class="card span-6"><h3>Demand signals</h3>${bar('Food safety', 92)}${bar('Record keeping', 78)}${bar('Mechanization', 61)}${bar('Quality control', 57)}</div>
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
  return `
    ${metrics()}
    <div class="grid" style="margin-top:18px">
      <div class="card span-4"><div class="label">Pending verification items</div><div class="metric">${pendingCount}</div></div>
      <div class="card span-4"><div class="label">Unread notifications</div><div class="metric">${unread}</div></div>
      <div class="card span-4"><div class="label">Decision messaging active</div><div class="metric">Yes</div></div>
    </div>
    <div class="grid" style="margin-top:18px"><div class="card span-7"><div class="section-title"><h3>Verification queue</h3><button class="secondary" onclick="setView('verification')">Open queue</button></div><p class="label">Approve organisations, opportunities and courses from one place with document evidence and queued decision notifications.</p></div><div class="card span-5"><h3>Notification workflow</h3><p class="label">• in-app notifications<br>• email-ready message queue<br>• verification decision messaging<br>• user-facing notifications centre</p></div></div>
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
  return trustPageShell('Insights', 'Skills demand dashboard', `${bar('Food safety', 92)}${bar('Packaging', 78)}${bar('Record keeping', 74)}${bar('Dairy', 63)}${bar('Mechanization', 58)}${bar('Quality control', 57)}`);
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
    <p class="label">You can replace these placeholder contact addresses with your organisation’s official support email addresses before public launch.</p>
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

function demoSignIn() { openAuthModal('login'); }
window.openLogin = () => openAuthModal('login');
window.openSignup = () => openAuthModal('signup');


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
  await loadApplicationsFromSupabase();
  await loadVerificationQueueFromSupabase();
  await loadVerificationDocumentsFromSupabase();
  await loadNotificationsFromSupabase();
  closeAuthModal();
  state.view = 'dashboard';
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
