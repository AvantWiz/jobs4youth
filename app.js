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
    experience: 'Entry level'
  },
  jobs: [
    {
      id: '1',
      title: 'Agri-processing Trainee',
      org: 'Rift Valley Foods Ltd',
      country: 'Kenya',
      region: 'Nakuru',
      type: 'Internship',
      skills: 'food safety, packaging, record keeping',
      education: 'Certificate',
      experience: 'Entry level',
      status: 'Verified',
      desc: 'Six-month placement in food processing, quality checks and production records.'
    },
    {
      id: '2',
      title: 'Dairy Extension Intern',
      org: 'Green Dairies Cooperative',
      country: 'Kenya',
      region: 'Eldoret',
      type: 'Internship',
      skills: 'dairy, farmer training, record keeping',
      education: 'Diploma',
      experience: 'Entry level',
      status: 'Verified',
      desc: 'Support farmer advisory, milk quality checks and digital record capture.'
    },
    {
      id: '3',
      title: 'Quality Control Assistant',
      org: 'Fresh Produce Exporters',
      country: 'Kenya',
      region: 'Thika',
      type: 'Job',
      skills: 'food safety, quality control, packaging',
      education: 'Diploma',
      experience: 'Entry level',
      status: 'Verified',
      desc: 'Assist quality team with grading, inspection and documentation.'
    }
  ],
  courses: [
    {
      id: 'c1',
      title: 'Food Safety Certification',
      provider: 'Nakuru TVET Centre',
      mode: 'Hybrid',
      duration: '2 weeks',
      skills: 'food safety, quality control'
    },
    {
      id: 'c2',
      title: 'Digital Farm Records',
      provider: 'AgriLearn Africa',
      mode: 'Online',
      duration: '5 days',
      skills: 'record keeping, mobile money'
    }
  ],
  employers: [
    { name: 'Rift Valley Foods Ltd' },
    { name: 'Green Dairies Cooperative' }
  ],
  applications: []
};

let state = structuredClone(demoState);
let supabase = null;
let isConfigured = false;
let currentUser = null;
let isSignup = false
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

function words(s) {
  return (s || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
}

function title(s) {
  return s.split(' ').map(x => x.charAt(0).toUpperCase() + x.slice(1)).join(' ');
}

function matchScore(job) {
  const ps = new Set(
    words(
      state.profile.skills + ' ' +
      state.profile.interests + ' ' +
      state.profile.region + ' ' +
      state.profile.country
    )
  );

  const js = words(
    job.skills + ' ' +
    job.region + ' ' +
    job.country + ' ' +
    job.type + ' ' +
    job.experience
  );

  let hit = 0;
  js.forEach(w => {
    if (ps.has(w)) hit++;
  });

  let base = Math.round((hit / Math.max(js.length, 1)) * 70) + 20;
  if (job.region === state.profile.region) base += 10;
  if (job.country === state.profile.country) base += 6;

  return Math.min(98, base);
}

function navItems() {
  return state.role === 'youth'
    ? ['dashboard', 'opportunities', 'training', 'profile']
    : state.role === 'employer'
    ? ['dashboard', 'post opportunity', 'candidates']
    : state.role === 'institution'
    ? ['dashboard', 'post training', 'courses']
    : ['dashboard', 'verification', 'insights'];
}

function desc() {
  if (state.role === 'youth') {
    return 'Find relevant jobs, internships and training matched to your skills and goals.';
  }
  if (state.role === 'employer') {
    return 'Post opportunities and shortlist best-fit young candidates.';
  }
  if (state.role === 'institution') {
    return 'Publish courses and align training to real market demand.';
  }
  return 'Verify partners, monitor activity and generate labour market intelligence.';
}

function setView(v) {
  state.view = v;
  render();
}

function setRole(r) {
  state.role = r;
  state.view = 'dashboard';
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
    experience: profile.experience_level || ''
  };
}

async function ensureProfile(user) {
  if (!isConfigured || !user) return null;

  const { data: existingProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (fetchError) {
    console.error('Error loading profile:', fetchError);
    return null;
  }

  if (existingProfile) return existingProfile;

  const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'New User';

  const { data: createdProfile, error: insertError } = await supabase
    .from('profiles')
    .insert([
      {
        id: user.id,
        email: user.email,
        full_name: fullName,
        role: user.user_metadata?.role || 'youth'
      }
    ])
    .select()
    .single();

  if (insertError) {
    console.error('Error creating profile:', insertError);
    return null;
  }

  return createdProfile;
}

async function loadJobsFromSupabase() {
  if (!isConfigured) return;

  const { data, error } = await supabase
    .from('opportunities')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading jobs:', error);
    return;
  }

  if (data) {
    state.jobs = data.map(job => ({
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
      desc: job.description || ''
    }));
  }
}

async function loadCoursesFromSupabase() {
  if (!isConfigured) return;

  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading courses:', error);
    return;
  }

  if (data) {
    state.courses = data.map(course => ({
      id: course.id,
      title: course.title || 'No title',
      provider: course.provider_name || 'Unknown provider',
      mode: course.delivery_mode || '',
      duration: course.duration || '',
      skills: course.skills_covered || ''
    }));
  }
}

function renderShell() {
  document.getElementById('nav').innerHTML = navItems()
    .map(v => `<button class="${state.view === v ? 'active' : ''}" onclick="setView('${v}')">${title(v)}</button>`)
    .join('');

  const roles = ['youth', 'employer', 'institution', 'admin'];

  document.getElementById('roleSwitch').innerHTML = roles
    .map(r => `<button class="${state.role === r ? 'active' : ''}" onclick="setRole('${r}')">${title(r)}</button>`)
    .join('');

  document.getElementById('kicker').textContent = isConfigured ? 'Connected workspace' : 'Starter workspace';
  document.getElementById('pageTitle').textContent = title(state.view);
  document.getElementById('pageDesc').textContent = desc();

  if (!isConfigured) {
    document.getElementById('authStatus').textContent = 'Add config.js to go live';
  } else if (currentUser) {
    document.getElementById('authStatus').textContent = `Signed in: ${currentUser.email}`;
  } else {
    document.getElementById('authStatus').textContent = 'Supabase configured';
  }
}

function metrics() {
  return `
    <div class="grid">
      <div class="card span-3">
        <div class="label">Verified opportunities</div>
        <div class="metric">${state.jobs.length}</div>
      </div>
      <div class="card span-3">
        <div class="label">Training offers</div>
        <div class="metric">${state.courses.length}</div>
      </div>
      <div class="card span-3">
        <div class="label">Employers</div>
        <div class="metric">${state.employers.length}</div>
      </div>
      <div class="card span-3">
        <div class="label">Applications</div>
        <div class="metric">${state.applications.length}</div>
      </div>
    </div>
  `;
}

function jobCard(j, action) {
  const score = matchScore(j);

  return `
    <div class="job">
      <div>
        <h3>${j.title}</h3>
        <p><b>${j.org}</b> • ${j.region}, ${j.country} • ${j.type} • ${j.experience}</p>
        <p>${j.desc}</p>
        <div>
          ${(j.skills || '')
            .split(',')
            .filter(Boolean)
            .map(x => `<span class="pill">${x.trim()}</span>`)
            .join('')}
        </div>
        ${action ? `<button class="primary" onclick="applyJob('${j.id}')">Apply / Save</button>` : ''}
      </div>
      <div class="fit" style="--score:${score}">
        <span>${score}%</span>
      </div>
    </div>
  `;
}

window.applyJob = async function(id) {
  if (!isConfigured) {
    alert('Supabase not connected');
    return;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;

  if (userError || !user) {
    alert('Please sign in first before applying.');
    return;
  }

  await ensureProfile(user);

  const { error } = await supabase
    .from('applications')
    .insert([
      {
        opportunity_id: id,
        applicant_id: user.id,
        application_status: 'Submitted'
      }
    ]);

  if (error) {
    console.error('Application error:', error);

    if ((error.message || '').toLowerCase().includes('duplicate') || error.code === '23505') {
      alert('You have already applied for this opportunity.');
    } else {
      alert(`Failed to apply: ${error.message}`);
    }
    return;
  }

  if (!state.applications.includes(id)) {
    state.applications.push(id);
  }

  alert('✅ Application saved successfully!');
  render();
};

function youthDash() {
  const ranked = [...state.jobs].sort((a, b) => matchScore(b) - matchScore(a));

  return `
    <div class="notice">
      <b>Real platform pathway:</b> connect authentication, profiles, role-based posting,
      applications and verification.
    </div>
    ${metrics()}
    <div class="grid" style="margin-top:18px">
      <div class="card span-8">
        <div class="section-title">
          <h3>Best matches for ${state.profile.name}</h3>
          <button class="secondary" onclick="setView('opportunities')">View all</button>
        </div>
        ${ranked.slice(0, 3).map(j => jobCard(j, true)).join('')}
      </div>
      <div class="card span-4">
        <h3>Recommended skills pathway</h3>
        ${state.courses.map(c => `
          <p>
            <b>${c.title}</b><br>
            <span class="label">${c.provider} • ${c.mode} • ${c.duration}</span>
          </p>
        `).join('')}
      </div>
    </div>
  `;
}

function opportunities() {
  return `
    <div class="grid">
      <div class="card span-12">
        <div class="section-title">
          <h3>Opportunity marketplace</h3>
        </div>
        ${state.jobs.sort((a, b) => matchScore(b) - matchScore(a)).map(j => jobCard(j, true)).join('')}
      </div>
    </div>
  `;
}

function training() {
  return `
    <div class="grid">
      ${state.courses.map(c => `
        <div class="card span-4">
          <h3>${c.title}</h3>
          <p>${c.provider}</p>
          <p class="label">${c.mode} • ${c.duration}</p>
          ${(c.skills || '')
            .split(',')
            .filter(Boolean)
            .map(x => `<span class="pill">${x.trim()}</span>`)
            .join('')}
        </div>
      `).join('')}
    </div>
  `;
}

function profile() {
  return `
    <div class="card">
      <h3>Youth profile</h3>
      <div class="form">
        <label>
          Name
          <input id="profileName" value="${state.profile.name || ''}"/>
        </label>

        <label>
          Region
          <input id="profileRegion" value="${state.profile.region || ''}"/>
        </label>

        <label>
          Country
          <input id="profileCountry" value="${state.profile.country || ''}"/>
        </label>

        <label>
          Education
          <input id="profileEducation" value="${state.profile.education || ''}"/>
        </label>

        <label>
          Availability
          <input id="profileAvailability" value="${state.profile.availability || ''}"/>
        </label>

        <label>
          Experience level
          <input id="profileExperience" value="${state.profile.experience || ''}"/>
        </label>

        <label class="full">
          Skills
          <textarea id="profileSkills">${state.profile.skills || ''}</textarea>
        </label>

        <label class="full">
          Interests
          <textarea id="profileInterests">${state.profile.interests || ''}</textarea>
        </label>

        <button class="primary full" onclick="saveProfile()">Save profile</button>
      </div>
    </div>
  `;
}


function employerDash() {
  return metrics() + `
    <div class="grid" style="margin-top:18px">
      <div class="card span-7">
        <h3>Your posted opportunities</h3>
        ${state.jobs.slice(0, 3).map(j => jobCard(j, false)).join('')}
      </div>
      <div class="card span-5">
        <h3>Top candidate shortlist</h3>
        <p>
          <b>${state.profile.name}</b><br>
          <span class="label">
            ${state.jobs[0] ? matchScore(state.jobs[0]) : 0}% fit for
            ${state.jobs[0] ? state.jobs[0].title : 'your vacancy'}
          </span>
        </p>
      </div>
    </div>
  `;
}

function postOpportunity() {
  return `
    <div class="card">
      <h3>Post a new opportunity</h3>
      <p class="label">Next step: wire this form to Supabase insert into public.opportunities.</p>
    </div>
  `;
}

function candidates() {
  return `
    <div class="card">
      <h3>Candidate matching preview</h3>
      ${state.jobs.slice(0, 3).map(j => `
        <div class="job">
          <div>
            <h3>${j.title}</h3>
            <p>Top matched candidate: <b>${state.profile.name}</b></p>
          </div>
          <div class="fit" style="--score:${matchScore(j)}">
            <span>${matchScore(j)}%</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function institutionDash() {
  return metrics() + `
    <div class="grid" style="margin-top:18px">
      <div class="card span-6">
        <h3>Your training catalogue</h3>
        ${state.courses.map(c => `
          <p>
            <b>${c.title}</b><br>
            <span class="label">${c.provider} • ${c.mode}</span>
          </p>
        `).join('')}
      </div>
      <div class="card span-6">
        <h3>Demand signals</h3>
        ${bar('Food safety', 92)}
        ${bar('Record keeping', 78)}
        ${bar('Mechanization', 61)}
        ${bar('Quality control', 57)}
      </div>
    </div>
  `;
}

function postTraining() {
  return `
    <div class="card">
      <h3>Post training course</h3>
      <p class="label">Next step: wire this form to Supabase insert into public.courses.</p>
    </div>
  `;
}

function courses() {
  return training();
}

function adminDash() {
  return metrics() + `
    <div class="grid" style="margin-top:18px">
      <div class="card span-6">
        <h3>Verification queue</h3>
        <p class="label">Connect to verification_queue for admin review.</p>
      </div>
      <div class="card span-6">
        <h3>Labour market insights</h3>
        ${bar('Food safety demand', 92)}
        ${bar('Dairy skills demand', 74)}
        ${bar('Training supply coverage', 55)}
        ${bar('Local match rate', 71)}
      </div>
    </div>
  `;
}

function verification() {
  return `
    <div class="card">
      <h3>Admin verification</h3>
      <p class="label">Add admin-only workflow to verify employers, institutions and postings.</p>
    </div>
  `;
}

function insights() {
  return `
    <div class="grid">
      <div class="card span-12">
        <h3>Skills demand dashboard</h3>
        ${bar('Food safety', 92)}
        ${bar('Packaging', 78)}
        ${bar('Record keeping', 74)}
        ${bar('Dairy', 63)}
        ${bar('Mechanization', 58)}
        ${bar('Quality control', 57)}
      </div>
    </div>
  `;
}

function bar(label, n) {
  return `
    <p><b>${label}</b></p>
    <div class="chartbar"><div style="width:${n}%"></div></div>
    <p class="label">${n}% relative demand signal</p>
  `;
}

function render() {
  renderShell();

  let c = '';

  if (state.role === 'youth') {
    c = state.view === 'dashboard'
      ? youthDash()
      : state.view === 'opportunities'
      ? opportunities()
      : state.view === 'training'
      ? training()
      : profile();
  }

  if (state.role === 'employer') {
    c = state.view === 'dashboard'
      ? employerDash()
      : state.view === 'post opportunity'
      ? postOpportunity()
      : candidates();
  }

  if (state.role === 'institution') {
    c = state.view === 'dashboard'
      ? institutionDash()
      : state.view === 'post training'
      ? postTraining()
      : courses();
  }

  if (state.role === 'admin') {
    c = state.view === 'dashboard'
      ? adminDash()
      : state.view === 'verification'
      ? verification()
      : insights();
  }

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

  document.getElementById('authTitle').textContent = isSignup
    ? 'Create your Jobs4Youth account'
    : 'Sign in to Jobs4Youth';

  document.getElementById('authSubmitBtn').textContent = isSignup
    ? 'Create account'
    : 'Sign In';

  document.getElementById('fullNameWrap').style.display = isSignup ? 'block' : 'none';
  document.getElementById('roleWrap').style.display = isSignup ? 'block' : 'none';

  document.getElementById('tabLogin').classList.toggle('active', !isSignup);
  document.getElementById('tabSignup').classList.toggle('active', isSignup);

  document.getElementById('authMessage').textContent = '';
}

async function demoSignIn() {
  openAuthModal('login');
}

async function handleAuthSubmit() {
  if (!isConfigured) {
    alert('Add config.js with your Supabase URL and anon key first.');
    return;
  }

  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value.trim();
  const fullName = document.getElementById('authFullName').value.trim();
  const role = document.getElementById('authRole').value;
  const msg = document.getElementById('authMessage');

  msg.textContent = '';

  if (!email || !password) {
    msg.textContent = 'Please enter email and password.';
    return;
  }

  let authResult;

  if (authMode === 'signup') {
    if (!fullName) {
      msg.textContent = 'Please enter your full name.';
      return;
    }

    authResult = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role
        }
      }
    });
  } else {
    authResult = await supabase.auth.signInWithPassword({
      email,
      password
    });
  }

  if (authResult.error) {
    console.error('Auth error:', authResult.error);
    msg.textContent = authResult.error.message;
    return;
  }

  currentUser = authResult.data.user || authResult.data.session?.user || null;

  if (currentUser) {
    let profile = await ensureProfile(currentUser);

    if (profile && authMode === 'signup') {
      const { data: updatedProfile, error: roleUpdateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          role: role
        })
        .eq('id', currentUser.id)
        .select()
        .single();

      if (!roleUpdateError && updatedProfile) {
        profile = updatedProfile;
      }
    }

    syncProfileToState(profile);
  }

  await loadJobsFromSupabase();
  await loadCoursesFromSupabase();
  closeAuthModal();
  render();
}



async function signOut() {
  if (isConfigured && supabase) {
    await supabase.auth.signOut();
  }

  currentUser = null;
  state = structuredClone(demoState);
  render();

  alert('Signed out.');
}

async function initializeApp() {
  if (isConfigured && supabase) {
    const { data: sessionData, error } = await supabase.auth.getSession();

    if (!error && sessionData?.session?.user) {
      currentUser = sessionData.session.user;
      const profile = await ensureProfile(currentUser);
      syncProfileToState(profile);
    }

    await loadJobsFromSupabase();
    await loadCoursesFromSupabase();

    supabase.auth.onAuthStateChange(async (_event, session) => {
      currentUser = session?.user || null;

      if (currentUser) {
        const profile = await ensureProfile(currentUser);
        syncProfileToState(profile);
      }

      render();
    });
  }

  render();
}

window.saveProfile = async function () {
  if (!isConfigured) {
    alert('Supabase not connected');
    return;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;

  if (userError || !user) {
    alert('Please sign in first.');
    return;
  }

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

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id);

  if (error) {
    console.error('Profile update error:', error);
    alert(`❌ Failed to save profile: ${error.message}`);
    return;
  }

  state.profile = {
    ...state.profile,
    name: updates.full_name,
    country: updates.country,
    region: updates.region,
    education: updates.education,
    availability: updates.availability,
    experience: updates.experience_level,
    skills: updates.skills,
    interests: updates.interests
  };

  alert('✅ Profile saved successfully!');
  render();
};


document.getElementById('btnSignIn').addEventListener('click', demoSignIn);
document.getElementById('btnSignOut').addEventListener('click', signOut);

document.getElementById('closeAuthModal').addEventListener('click', closeAuthModal);
document.getElementById('authSubmitBtn').addEventListener('click', handleAuthSubmit);
document.getElementById('tabLogin').addEventListener('click', () => {
  authMode = 'login';
  updateAuthModal();
});
document.getElementById('tabSignup').addEventListener('click', () => {
  authMode = 'signup';
  updateAuthModal();
});

initializeApp();