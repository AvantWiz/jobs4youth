(function () {
  const FEATURE_ID = 'careerTwinFeature';

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getSupabaseClient() {
    if (!window.supabase || !window.JOBS4YOUTH_CONFIG) {
      console.warn('Career Twin: Supabase or config not ready.');
      return null;
    }

    const { supabaseUrl, supabaseAnonKey } = window.JOBS4YOUTH_CONFIG;
    return window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  }

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^\w\s,.-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function splitSkills(value) {
    return normalizeText(value)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  function uniqueList(items) {
    return [...new Set(items.filter(Boolean))];
  }

  function scoreProfile(profile) {
    const checks = [
      { key: 'full_name', label: 'Full name', points: 10 },
      { key: 'country', label: 'Country', points: 10 },
      { key: 'region', label: 'Region', points: 10 },
      { key: 'education', label: 'Education', points: 15 },
      { key: 'skills', label: 'Skills', points: 20 },
      { key: 'interests', label: 'Career interests', points: 10 },
      { key: 'availability', label: 'Availability', points: 10 },
      { key: 'experience_level', label: 'Experience level', points: 15 }
    ];

    let score = 0;

    const breakdown = checks.map(check => {
      const hasValue = Boolean(String(profile?.[check.key] || '').trim());
      if (hasValue) score += check.points;

      return {
        label: check.label,
        points: check.points,
        status: hasValue ? 'complete' : 'missing'
      };
    });

    return {
      score: Math.min(score, 100),
      breakdown
    };
  }

  function getReadinessClass(score) {
    if (score >= 75) return 'readiness-strong';
    if (score >= 50) return 'readiness-medium';
    return 'readiness-emerging';
  }

  function getTargetRoles(opportunities) {
    const titles = opportunities
      .map(item => item.title)
      .filter(Boolean);

    return uniqueList(titles).slice(0, 12);
  }

  function computeTargetFit(profile, targetOpportunity) {
    const userSkills = splitSkills(profile?.skills);
    const requiredSkills = splitSkills(targetOpportunity?.required_skills);

    const matched = requiredSkills.filter(skill =>
      userSkills.some(userSkill =>
        userSkill.includes(skill) || skill.includes(userSkill)
      )
    );

    const missing = requiredSkills.filter(skill => !matched.includes(skill));

    const skillScore = requiredSkills.length
      ? Math.round((matched.length / requiredSkills.length) * 60)
      : 20;

    let profileBase = 0;
    if (profile?.education) profileBase += 15;
    if (profile?.experience_level) profileBase += 10;
    if (profile?.availability) profileBase += 10;
    if (profile?.country) profileBase += 5;

    const fitScore = Math.min(100, skillScore + profileBase);

    return {
      fitScore,
      matched,
      missing,
      requiredSkills
    };
  }

  function recommendCourses(courses, missingSkills) {
    if (!missingSkills.length) return courses.slice(0, 3);

    return courses
      .map(course => {
        const courseSkills = normalizeText(course.skills_covered);
        const matchCount = missingSkills.filter(skill =>
          courseSkills.includes(skill)
        ).length;

        return {
          ...course,
          matchCount
        };
      })
      .filter(course => course.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 4);
  }

  function safeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function renderProfileBreakdown(breakdown) {
    return breakdown.map(item => {
      const icon = item.status === 'complete' ? '✓' : '!';
      const className = item.status === 'complete' ? 'criteria-pass' : 'criteria-watch';
      const statusText = item.status === 'complete' ? 'Completed' : 'Needs update';

      return `
        <div class="criteria-item ${className}">
          <div class="criteria-icon">${icon}</div>
          <div>
            <strong>${safeHtml(item.label)}</strong>
            <p class="label">${safeHtml(statusText)} · ${item.points} points</p>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderSkillPills(skills, emptyText) {
    if (!skills.length) {
      return `<p class="label">${safeHtml(emptyText)}</p>`;
    }

    return skills.map(skill => `<span class="pill">${safeHtml(skill)}</span>`).join('');
  }

  async function renderCareerTwin() {
    const content = document.getElementById('content');
    const pageTitle = document.getElementById('pageTitle');
    const pageDesc = document.getElementById('pageDesc');
    const kicker = document.getElementById('kicker');

    if (!content) return;

    const client = getSupabaseClient();

    if (!client) {
      content.innerHTML = `
        <div class="card span-12">
          <h3>Career Twin is not ready</h3>
          <p class="label">Supabase configuration was not found. Please check config.js.</p>
        </div>
      `;
      return;
    }

    if (pageTitle) pageTitle.textContent = 'Career Readiness & Pathway Twin';
    if (pageDesc) {
      pageDesc.textContent = 'See your career readiness score, skills gaps, recommended training, and next best action.';
    }
    if (kicker) kicker.textContent = 'Youth career companion';

    content.innerHTML = `
      <div class="grid">
        <div class="card span-12">
          <h3>Loading your Career Twin...</h3>
          <p class="label">Checking your profile, opportunities, training pathways and skills gaps.</p>
        </div>
      </div>
    `;

    const { data: authData } = await client.auth.getUser();
    const user = authData?.user;

    if (!user) {
      content.innerHTML = `
        <div class="grid">
          <div class="card span-12 pathway-card">
            <div class="section-title">
              <div>
                <h3>Career Twin is for signed-in youth</h3>
                <p class="label">Please sign in or create a youth profile to see your readiness score and pathway recommendations.</p>
              </div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const [
      profileResponse,
      opportunitiesResponse,
      coursesResponse
    ] = await Promise.all([
      client.from('profiles').select('*').eq('id', user.id).single(),
      client.from('opportunities').select('*').eq('status', 'Verified').limit(50),
      client.from('courses').select('*').eq('status', 'Verified').limit(50)
    ]);

    const profile = profileResponse.data || {};
    const opportunities = opportunitiesResponse.data || [];
    const courses = coursesResponse.data || [];

    const profileScore = scoreProfile(profile);
    const targetRoles = getTargetRoles(opportunities);
    const defaultTargetTitle = targetRoles[0] || '';
    const selectedOpportunity = opportunities.find(item => item.title === defaultTargetTitle) || opportunities[0] || {};
    const targetFit = computeTargetFit(profile, selectedOpportunity);
    const recommendedCourses = recommendCourses(courses, targetFit.missing);
    const readinessClass = getReadinessClass(profileScore.score);

    content.innerHTML = `
      <div class="grid" id="${FEATURE_ID}">
        <div class="card span-12 pathway-card">
          <div class="pathway-head">
            <div>
              <div class="kicker">Your career passport</div>
              <h3>Welcome to your Career Twin</h3>
              <p class="label">
                This is your personalised career dashboard. It turns your profile into a practical pathway: where you are now, what is missing, and what to do next.
              </p>
            </div>
            <div class="fit ${readinessClass}" style="--score:${profileScore.score}">
              <span>${profileScore.score}%</span>
            </div>
          </div>

          <div class="pathway-summary-row">
            <span class="pathway-summary-item"><strong>Readiness:</strong>&nbsp;${profileScore.score}/100</span>
            <span class="pathway-summary-item"><strong>Country:</strong>&nbsp;${safeHtml(profile.country || 'Not added')}</span>
            <span class="pathway-summary-item"><strong>Region:</strong>&nbsp;${safeHtml(profile.region || 'Not added')}</span>
            <span class="pathway-summary-item"><strong>Skills:</strong>&nbsp;${splitSkills(profile.skills).length || 0} listed</span>
          </div>
        </div>

        <div class="card span-5 readiness-hero-card">
          <h3>Career Readiness Score</h3>
          <p class="label">Your score improves when you complete your profile and add employability information.</p>

          <div style="margin-top:18px;">
            <div class="chartbar">
              <div style="width:${profileScore.score}%"></div>
            </div>
          </div>

          <div class="criteria-list" style="margin-top:18px;">
            ${renderProfileBreakdown(profileScore.breakdown)}
          </div>
        </div>

        <div class="card span-7 pathway-card">
          <div class="section-title">
            <div>
              <h3>Target Pathway</h3>
              <p class="label">Choose a target opportunity and see your fit.</p>
            </div>
          </div>

          <label class="full label">
            Target role
            <select id="careerTwinTarget" style="width:100%;padding:12px;border:1px solid var(--line);border-radius:14px;margin-top:8px;">
              ${targetRoles.map(title => `
                <option value="${safeHtml(title)}">${safeHtml(title)}</option>
              `).join('')}
            </select>
          </label>

          <div id="careerTwinTargetPanel" style="margin-top:18px;">
            ${renderTargetPanel(profile, selectedOpportunity, courses)}
          </div>
        </div>

        <div class="card span-6">
          <h3>Your strongest assets</h3>
          <p class="label">These are the skills currently visible in your profile.</p>
          <div class="pathway-list">
            ${renderSkillPills(splitSkills(profile.skills), 'No skills added yet. Add skills to improve your readiness score.')}
          </div>
        </div>

        <div class="card span-6 pathway-recommendation-card">
          <h3>Next best action</h3>
          ${renderNextBestAction(profileScore.score, targetFit.missing)}
        </div>
      </div>
    `;

    const select = document.getElementById('careerTwinTarget');
    const panel = document.getElementById('careerTwinTargetPanel');

    if (select && panel) {
      select.addEventListener('change', () => {
        const selected = opportunities.find(item => item.title === select.value) || opportunities[0] || {};
        panel.innerHTML = renderTargetPanel(profile, selected, courses);
      });
    }
  }

  function renderTargetPanel(profile, opportunity, courses) {
    const targetFit = computeTargetFit(profile, opportunity);
    const recommendedCourses = recommendCourses(courses, targetFit.missing);
    const readinessClass = getReadinessClass(targetFit.fitScore);

    return `
      <div class="detail-two-column">
        <div class="detail-box">
          <div class="pathway-head">
            <div>
              <h4>${safeHtml(opportunity.title || 'No opportunity selected')}</h4>
              <p class="label">${safeHtml(opportunity.organization_name || 'Verified opportunity')} · ${safeHtml(opportunity.country || '')}</p>
            </div>
            <div class="fit ${readinessClass}" style="--score:${targetFit.fitScore}">
              <span>${targetFit.fitScore}%</span>
            </div>
          </div>

          <p class="label">Required skills</p>
          <div class="pathway-list">
            ${renderSkillPills(targetFit.requiredSkills, 'No required skills listed for this opportunity.')}
          </div>
        </div>

        <div class="detail-box">
          <h4>Skills gap</h4>
          <p class="label">These are the skills you should strengthen for this target pathway.</p>
          <div class="pathway-list">
            ${renderSkillPills(targetFit.missing, 'Great. Your listed skills cover this opportunity well.')}
          </div>
        </div>
      </div>

      <div class="detail-box" style="margin-top:16px;">
        <h4>Recommended training to close gaps</h4>
        <div class="pathway-course-stack">
          ${
            recommendedCourses.length
              ? recommendedCourses.map(course => `
                <div class="pathway-course-item">
                  <strong>${safeHtml(course.title)}</strong>
                  <span class="label">${safeHtml(course.provider_name || 'Training provider')} · ${safeHtml(course.delivery_mode || 'Mode not specified')}</span>
                  <span class="label">Skills: ${safeHtml(course.skills_covered || 'Not specified')}</span>
                </div>
              `).join('')
              : `<p class="label">No matching training found yet. Add more verified courses or broaden course skill descriptions.</p>`
          }
        </div>
      </div>
    `;
  }

  function renderNextBestAction(score, missingSkills) {
    if (score < 50) {
      return `
        <p>Your most important action is to complete your profile.</p>
        <div class="notice">
          Add your education, skills, location, interests, availability and experience level. This will make your profile more visible and improve your readiness score.
        </div>
      `;
    }

    if (missingSkills.length) {
      return `
        <p>Your next best action is to close your top skills gap.</p>
        <div class="notice">
          Focus on: <strong>${safeHtml(missingSkills.slice(0, 3).join(', '))}</strong>. After updating your skills or completing relevant training, your opportunity match score should improve.
        </div>
      `;
    }

    return `
      <p>Your profile is in good shape for the selected pathway.</p>
      <div class="notice">
        Your next best action is to apply to a verified opportunity or save the most relevant opportunities to your shortlist.
      </div>
    `;
  }

  function addCareerTwinNav() {
    const nav = document.getElementById('nav');
    if (!nav) return;

    if (document.getElementById('careerTwinNavBtn')) return;

    const button = document.createElement('button');
    button.id = 'careerTwinNavBtn';
    button.type = 'button';
    button.textContent = 'Career Twin';

    button.addEventListener('click', () => {
      document.querySelectorAll('#nav button').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');
      renderCareerTwin();
    });

    nav.appendChild(button);
  }

  async function bootCareerTwin() {
    await wait(1200);
    addCareerTwinNav();

    const nav = document.getElementById('nav');
    if (nav) {
      const observer = new MutationObserver(() => {
        addCareerTwinNav();
      });

      observer.observe(nav, { childList: true, subtree: true });
    }
  }

  document.addEventListener('DOMContentLoaded', bootCareerTwin);
})();