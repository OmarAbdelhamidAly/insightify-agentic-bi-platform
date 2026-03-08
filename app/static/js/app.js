/**
 * App — SPA router, page rendering, and UI logic.
 */

// ── Toast System ───────────────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span class="toast-message">${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ── Plotly Loader ──────────────────────────────────────
let plotlyPromise = null;
function loadPlotly() {
  if (window.Plotly) return Promise.resolve(window.Plotly);
  if (plotlyPromise) return plotlyPromise;

  plotlyPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.plot.ly/plotly-2.27.0.min.js';
    script.onload = () => resolve(window.Plotly);
    script.onerror = () => reject(new Error('Failed to load Plotly'));
    document.head.appendChild(script);
  });
  return plotlyPromise;
}

// ── SPA Router ─────────────────────────────────────────
const routes = {
  dashboard: renderDashboard,
  'data-sources': renderDataSources,
  analysis: renderAnalysis,
  users: renderUsers,
  'source-dashboard': renderSourceDashboard,
  knowledge: renderKnowledge,
  'kb-detail': renderKBDetail,
  policies: renderPolicies,
  enrichment: renderEnrichment,
  about: renderAbout,
};

function navigate(page, params) {
  if (!getAccessToken()) {
    renderAuth();
    return;
  }
  if (params) window._pageParams = params;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const activeNav = document.querySelector(`[data-page="${page}"]`);
  if (activeNav) activeNav.classList.add('active');

  const mainContent = document.getElementById('main-content');
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');

  if (routes[page]) {
    renderPageWithSkeleton(page, mainContent);
  } else {
    renderPageWithSkeleton('dashboard', mainContent);
  }
}

async function renderPageWithSkeleton(page, container) {
  container.innerHTML = `
    <div class="skeleton-loader">
      <div class="skeleton-header"></div>
      <div class="skeleton-content">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line medium"></div>
        <div class="skeleton-line"></div>
      </div>
    </div>
  `;
  try {
    await routes[page](container);
  } catch (e) {
    console.error(`Error rendering page ${page}:`, e);
    container.innerHTML = `<div class="error-state">Failed to load page: ${e.message}</div>`;
  }
}

// ── Auth Page ──────────────────────────────────────────
function renderAuth() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="logo-icon">📊</div>
          <h1>DataAnalyst.AI</h1>
          <p>Enterprise Business Intelligence</p>
        </div>
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login" id="tab-login">Sign In</button>
          <button class="auth-tab" data-tab="register" id="tab-register">Register</button>
        </div>
        <div id="auth-form-login">
          <div class="form-group">
            <label class="form-label">Work Email</label>
            <input type="email" class="form-input" id="login-email" placeholder="name@company.com">
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" class="form-input" id="login-password" placeholder="••••••••">
          </div>
          <button class="btn btn-primary btn-full" id="btn-login">Sign In</button>
        </div>
        <div id="auth-form-register" class="hidden">
          <div class="form-group">
            <label class="form-label">Organization</label>
            <input type="text" class="form-input" id="reg-tenant" placeholder="Acme Corp">
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="reg-email" placeholder="name@company.com">
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" class="form-input" id="reg-password" placeholder="Min. 8 characters">
          </div>
          <button class="btn btn-primary btn-full" id="btn-register">Create Account</button>
        </div>
      </div>
    </div>
  `;

  // Tab switching
  document.getElementById('tab-login').onclick = () => {
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
    document.getElementById('auth-form-login').classList.remove('hidden');
    document.getElementById('auth-form-register').classList.add('hidden');
  };
  document.getElementById('tab-register').onclick = () => {
    document.getElementById('tab-register').classList.add('active');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('auth-form-register').classList.remove('hidden');
    document.getElementById('auth-form-login').classList.add('hidden');
  };

  // Login
  document.getElementById('btn-login').onclick = async () => {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    if (!email || !password) return showToast('Please fill in all fields', 'error');
    try {
      const data = await api.login(email, password);
      setTokens(data.access_token, data.refresh_token);
      const payload = JSON.parse(atob(data.access_token.split('.')[1]));
      setUser({ id: payload.sub, email, role: payload.role, tenant_id: payload.tenant_id });
      showToast('Welcome back! 🎉', 'success');
      renderApp();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  // Register
  document.getElementById('btn-register').onclick = async () => {
    const tenant = document.getElementById('reg-tenant').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    if (!tenant || !email || !password) return showToast('Please fill in all fields', 'error');
    try {
      const data = await api.register(tenant, email, password);
      setTokens(data.access_token, data.refresh_token);
      const payload = JSON.parse(atob(data.access_token.split('.')[1]));
      setUser({ id: payload.sub, email, role: payload.role, tenant_id: payload.tenant_id });
      showToast('Account created! 🚀', 'success');
      renderApp();
    } catch (e) {
      showToast(e.message, 'error');
    }
  };

  // Enter key support
  document.querySelectorAll('.auth-card input').forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const loginVisible = !document.getElementById('auth-form-login').classList.contains('hidden');
        if (loginVisible) document.getElementById('btn-login').click();
        else document.getElementById('btn-register').click();
      }
    });
  });
}

// ── App Shell ──────────────────────────────────────────
function renderApp() {
  const user = getUser();
  if (!user) return renderAuth();

  const initials = user.email.substring(0, 2).toUpperCase();
  const isAdmin = user.role === 'admin';

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-layout">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-brand-icon">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0-2 4.41V16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2.59A5 5 0 0 0 17 9V7a5 5 0 0 0-5-5z"/></svg>
          </div>
          <span class="sidebar-brand-text">DATAANALYST.AI</span>
        </div>
        <nav class="sidebar-nav">
          <div class="nav-section">Insights</div>
          <button class="nav-item active" data-page="dashboard" onclick="navigate('dashboard')">
            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M21 12H3"/><path d="M12 3v18"/></svg></span> Overview
          </button>
          <button class="nav-item" data-page="analysis" onclick="navigate('analysis')">
            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span> Deep Analysis
          </button>
          <button class="nav-item" data-page="enrichment" onclick="navigate('enrichment')">
            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg></span> Metrics & Rules
          </button>
          <div class="nav-section">Data Hub</div>
          <button class="nav-item" data-page="data-sources" onclick="navigate('data-sources')">
            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span> Data Sources
          </button>
          ${isAdmin ? `
          <button class="nav-item" data-page="users" onclick="navigate('users')">
            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span> Team Access
          </button>
          ` : ''}
          <div class="nav-section">System</div>
          <button class="nav-item" data-page="about" onclick="navigate('about')">
            <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span> About
          </button>
        </nav>
        <div class="sidebar-user">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <div class="sidebar-avatar">${initials}</div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">${user.email.split('@')[0]}</div>
              <div class="sidebar-user-role">${user.role.toUpperCase()}</div>
            </div>
          </div>
          <button class="btn-icon" onclick="logout()" title="Sign out" style="border:none;background:transparent;color:rgba(255,255,255,0.4);">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </aside>
      <main class="main-content" id="main-content"></main>
    </div>
  `;
  navigate('dashboard');
}

function logout() {
  clearTokens();
  showToast('Signed out', 'info');
  renderAuth();
}

// ── Dashboard ──────────────────────────────────────────
async function renderDashboard(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Executive Summary</h1>
        <p class="page-subtitle">Platform health and intelligence across all data streams</p>
      </div>
    </div>
    <div class="stats-grid" id="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Connected Data</div>
        <div class="stat-value" id="stat-sources">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Jobs</div>
        <div class="stat-value" id="stat-analyses">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Success Rate</div>
        <div class="stat-value" id="stat-success">—</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Collaborators</div>
        <div class="stat-value" id="stat-users">—</div>
      </div>
    </div>
    <div style="display:grid; grid-template-columns: 2fr 1fr; gap: 2rem;">
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Activity</span></div>
        <div class="card-body" id="recent-analyses" style="padding:0;">
          <div class="empty-state" style="padding:4rem;">
            <h3>No data to display</h3>
            <p>Initiate an analysis to populate this view.</p>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Quick Actions</span></div>
        <div class="card-body">
          <div style="display:flex;flex-direction:column;gap:0.75rem;">
            <button class="btn btn-primary btn-full" onclick="navigate('analysis')">Initiate Strategic Analysis</button>
            <button class="btn btn-secondary btn-full" onclick="navigate('data-sources')">Audit Data Inventory</button>
            ${getUser()?.role === 'admin' ? '<button class="btn btn-secondary btn-full" onclick="navigate(\'users\')">Identity & Access Control</button>' : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  // Load stats
  try {
    const [sources, history] = await Promise.allSettled([
      api.listDataSources(),
      api.getAnalysisHistory(),
    ]);
    if (sources.status === 'fulfilled') {
      document.getElementById('stat-sources').textContent = sources.value.data_sources?.length || 0;
    }
    if (history.status === 'fulfilled') {
      const jobs = history.value.jobs || [];
      document.getElementById('stat-analyses').textContent = jobs.length;
      const done = jobs.filter(j => j.status === 'done').length;
      const rate = jobs.length > 0 ? Math.round((done / jobs.length) * 100) : 0;
      document.getElementById('stat-success').textContent = `${rate}%`;

      // Render recent
      if (jobs.length > 0) {
        const recent = jobs.slice(0, 5);
        document.getElementById('recent-analyses').innerHTML = `
          <div class="table-wrapper"><table class="data-table">
            <thead><tr><th>Question</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>${recent.map(j => `<tr>
              <td>${j.question?.substring(0, 50) || '—'}${j.question?.length > 50 ? '...' : ''}</td>
              <td><span class="badge badge-${j.status === 'done' ? 'success' : j.status === 'error' ? 'error' : 'warning'}">${j.status === 'awaiting_approval' ? 'Pending Review' : j.status.replace('_', ' ').toUpperCase()}</span></td>
              <td>${new Date(j.created_at || Date.now()).toLocaleDateString()}</td>
            </tr>`).join('')}</tbody>
          </table></div>`;
      }
    }
    // Load user count (admin only)
    if (getUser()?.role === 'admin') {
      try {
        const users = await api.listUsers();
        document.getElementById('stat-users').textContent = users.users?.length || 0;
      } catch { document.getElementById('stat-users').textContent = '—'; }
    } else {
      document.getElementById('stat-users').textContent = '—';
    }
  } catch { }
}

// ── Data Sources Page ──────────────────────────────────
async function renderDataSources(container) {
  const isAdmin = getUser()?.role === 'admin';
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Data Inventory</h1>
        <p class="page-subtitle">Manage enterprise data assets and analytical connections</p>
      </div>
      ${isAdmin ? `<div style="display:flex;gap:0.75rem;">
        <button class="btn btn-secondary" onclick="showSQLModal()">🔗 Connect SQL</button>
        <button class="btn btn-primary" onclick="document.getElementById('file-input').click()">📤 Upload File</button>
        <input type="file" id="file-input" accept=".csv,.xlsx,.sqlite,.db,.sql" class="hidden">
      </div>` : ''}
    </div>

    ${isAdmin ? `
    <div class="card" style="margin-bottom:2rem; padding:3rem; border-style:dashed; background:var(--bg-surface);">
      <div class="upload-zone" id="upload-zone" style="border:none; background:transparent; padding:0;">
        <div class="upload-icon" style="font-size:3rem; margin-bottom:1rem;">📂</div>
        <div class="upload-text" style="font-size:1.1rem; color:var(--text-dim);">Drag & drop enterprise files here, or <span style="color:var(--accent-blue); font-weight:700; text-decoration:underline;">browse</span></div>
      </div>
      
      <!-- Upload Progress Card -->
      <div class="upload-status-card" id="upload-status-card" style="margin-top:2rem; max-width:500px; margin-left:auto; margin-right:auto;">
        <div class="upload-status-header">
          <span id="upload-filename">File name</span>
          <span id="upload-percentage">0%</span>
        </div>
        <div class="progress-container" style="display: block; margin: 0;">
          <div class="progress-bar" id="upload-progress-bar"></div>
        </div>
      </div>
    </div>
    ` : ''}

    <div class="card">
      <div class="card-header"><span class="card-title">Connected Sources</span></div>
      <div class="card-body" id="sources-list" style="padding:1.5rem;">
        <div style="text-align:center;padding:4rem;"><div class="spinner" style="margin:0 auto;"></div></div>
      </div>
    </div>
    <!-- SQL Modal -->
    <div class="modal-overlay" id="sql-modal">
      <div class="modal">
        <div class="modal-header"><h3 class="modal-title">Register SQL Connection</h3><button class="btn-icon" onclick="closeSQLModal()">✕</button></div>
        <div class="modal-body">
          <div class="form-group"><label class="form-label">Resource Name</label><input class="form-input" id="sql-name" placeholder="e.g. Production Data Lake"></div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
              <div class="form-group"><label class="form-label">Engine</label>
                <select class="form-select" id="sql-engine"><option value="postgresql">PostgreSQL</option><option value="mysql">MySQL</option><option value="mssql">MS SQL Server</option></select>
              </div>
              <div class="form-group"><label class="form-label">Database Name</label><input class="form-input" id="sql-database" placeholder="analytics_db"></div>
          </div>
          <div style="display:grid; grid-template-columns: 2fr 1fr; gap:1.5rem;">
              <div class="form-group"><label class="form-label">Host / IP</label><input class="form-input" id="sql-host" placeholder="db.company.com"></div>
              <div class="form-group"><label class="form-label">Port</label><input class="form-input" type="number" id="sql-port" value="5432"></div>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1.5rem;">
              <div class="form-group"><label class="form-label">Username</label><input class="form-input" id="sql-username" placeholder="read_user"></div>
              <div class="form-group"><label class="form-label">Password</label><input class="form-input" type="password" id="sql-password"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeSQLModal()">Cancel</button>
          <button class="btn btn-primary" id="btn-connect-sql">Initialize Connection</button>
        </div>
      </div>
    </div>
  `;

  // Setup file upload
  if (isAdmin) {
    const fileInput = document.getElementById('file-input');
    const uploadZone = document.getElementById('upload-zone');
    if (fileInput) fileInput.onchange = async (e) => {
      if (e.target.files[0]) await handleUpload(e.target.files[0]);
    };
    if (uploadZone) {
      uploadZone.onclick = () => fileInput.click();
      uploadZone.ondragover = (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); };
      uploadZone.ondragleave = () => uploadZone.classList.remove('dragover');
      uploadZone.ondrop = async (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files[0]) await handleUpload(e.dataTransfer.files[0]);
      };
    }
    // SQL modal
    const connectBtn = document.getElementById('btn-connect-sql');
    if (connectBtn) connectBtn.onclick = async () => {
      try {
        await api.connectSQL({
          name: document.getElementById('sql-name').value,
          engine: document.getElementById('sql-engine').value,
          host: document.getElementById('sql-host').value,
          port: parseInt(document.getElementById('sql-port').value),
          database: document.getElementById('sql-database').value,
          username: document.getElementById('sql-username').value,
          password: document.getElementById('sql-password').value,
        });
        closeSQLModal();
        showToast('SQL database connected! ✓', 'success');
        loadSources();
        navigate('enrichment');
      } catch (e) { showToast(e.message, 'error'); }
    };
  }
  loadSources();
}

async function handleUpload(file) {
  const statusCard = document.getElementById('upload-status-card');
  const progressBar = document.getElementById('upload-progress-bar');
  const percentageTxt = document.getElementById('upload-percentage');
  const filenameTxt = document.getElementById('upload-filename');

  if (statusCard) {
    statusCard.style.display = 'block';
    filenameTxt.textContent = `Uploading ${file.name}...`;
    progressBar.style.width = '0%';
    percentageTxt.textContent = '0%';
  }

  try {
    await api.uploadFile(file, (percent) => {
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (percentageTxt) percentageTxt.textContent = `${percent}%`;
    });

    if (statusCard) {
      filenameTxt.textContent = `Processing ${file.name}...`;
      progressBar.style.width = '100%';
    }

    showToast(`"${file.name}" uploaded successfully!`, 'success');
    loadSources();
    navigate('enrichment');

    // Hide progress bar after a short delay
    setTimeout(() => {
      if (statusCard) statusCard.style.display = 'none';
    }, 2000);
  } catch (e) {
    showToast(e.message, 'error');
    if (statusCard) statusCard.style.display = 'none';
  }
}

async function loadSources() {
  try {
    const data = await api.listDataSources();
    const list = document.getElementById('sources-list');
    if (!data.data_sources?.length) {
      list.innerHTML = `<div class="empty-state" style="padding:4rem;"><div class="empty-icon">📂</div><h3>Ready for Data</h3><p>Upload a file or connect a database to begin analysis</p></div>`;
      return;
    }
    list.innerHTML = data.data_sources.map(s => {
      let meta = 'Connected';
      if (s.type === 'csv' && s.schema_json?.row_count) {
        meta = `${s.schema_json.row_count.toLocaleString()} rows · ${s.schema_json.column_count} cols`;
      } else if (s.type === 'sql' && s.schema_json?.table_count) {
        meta = `${s.schema_json.table_count} tables · ${s.schema_json.total_columns || 'DB'} cols`;
      }

      const statusIcon = {
        pending: '⏳',
        running: '<div class="spinner-sm"></div>',
        done: '✅',
        failed: '⚠️',
      }[s.auto_analysis_status] || '⏳';

      const statusLabel = {
        pending: 'Wait..',
        running: 'Analysing...',
        done: 'AI Insights Ready',
        failed: 'AI Failed',
      }[s.auto_analysis_status] || '';

      return `
        <div class="source-item" style="display:flex; align-items:center; padding:1.25rem; margin-bottom:0.75rem; gap:1.25rem; background:var(--primary-50); border:1px solid var(--border-light); border-radius:var(--radius-md); transition:var(--transition);">
          <div class="source-icon ${s.type}" style="width:40px; height:40px; background:var(--bg-card); border:1px solid var(--border-light); border-radius:var(--radius-md); display:flex; align-items:center; justify-content:center; font-size:1.25rem; box-shadow:var(--shadow-sm);">
            ${s.type === 'csv' ? '📄' : '🗄️'}
          </div>
          <div class="source-info" style="flex:1;">
            <div class="source-name" style="font-weight:700; font-size:1rem; color:var(--text-main); margin-bottom:0.15rem;">${s.name}</div>
            <div class="source-meta" style="font-size:0.8rem; color:var(--text-muted); font-weight:500;"> ${s.type.toUpperCase()} • ${meta}</div>
          </div>
          <div class="source-status">
            <span class="badge ${s.auto_analysis_status === 'done' ? 'badge-success' : s.auto_analysis_status === 'failed' ? 'badge-error' : 'badge-warning'}">
                ${statusIcon} ${statusLabel || s.auto_analysis_status.toUpperCase()}
            </span>
          </div>
          <div style="display:flex; gap:0.5rem;">
            ${s.auto_analysis_status === 'done' ? `<button class="btn btn-sm btn-primary" onclick="openSourceDashboard('${s.id}')">Metrics</button>` : ''}
            <button class="btn btn-sm btn-secondary" onclick="navigateToAnalysis('${s.id}')">Query</button>
            ${getUser()?.role === 'admin' ? `<button class="btn btn-sm btn-secondary" style="color:var(--error);" onclick="deleteSource('${s.id}')">Delete</button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Poll running sources
    const running = data.data_sources.filter(s => s.auto_analysis_status === 'running' || s.auto_analysis_status === 'pending');
    if (running.length > 0) {
      setTimeout(loadSources, 5000);
    }
  } catch (e) {
    showToast('Failed to load data sources', 'error');
  }
}

function openSourceDashboard(sourceId) {
  window._dashboardSourceId = sourceId;
  navigate('source-dashboard');
}

function navigateToAnalysis(sourceId) {
  window._preselectedSourceId = sourceId;
  navigate('analysis');
}

async function deleteSource(id) {
  if (!confirm('Delete this data source?')) return;
  try {
    await api.deleteDataSource(id);
    showToast('Data source deleted', 'success');
    loadSources();
  } catch (e) { showToast(e.message, 'error'); }
}

function showSQLModal() { document.getElementById('sql-modal').classList.add('open'); }
function closeSQLModal() { document.getElementById('sql-modal').classList.remove('open'); }

// ── Analysis Page ──────────────────────────────────────
async function renderAnalysis(container) {
  let initialSourceId = window._preselectedSourceId || '';
  window._preselectedSourceId = null;
  let qText = window._pageParams?.q || '';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Autonomous Analyst</h1>
        <p class="page-subtitle">Collaborate with the AI to extract deep insights from your data hub</p>
      </div>
    </div>

    <!-- Professional Analysis Control -->
    <div class="card" style="margin-bottom:2rem; border-color:var(--accent-blue);">
      <div class="card-header" style="background:var(--primary-100); border-bottom-color:var(--accent-blue);">
        <span class="card-title" style="color:var(--accent-indigo);">NEW RESEARCH TASK</span>
      </div>
      <div class="card-body">
        <div style="display:grid; grid-template-columns: 1fr 2fr; gap: 2rem; margin-bottom: 2rem;">
            <div class="form-group">
                <label class="form-label">Data Hub Source</label>
                <select class="form-select" id="analysis-source"></select>
            </div>
            <div class="form-group">
                <label class="form-label">Total Insights to Generate</label>
                <div class="pill-group" id="insight-count-pills">
                    <button class="pill-btn" data-value="1">1 (Single)</button>
                    <button class="pill-btn active" data-value="3">3 (Balanced)</button>
                    <button class="pill-btn" data-value="5">5 (Comprehensive)</button>
                </div>
            </div>
        </div>
        
        <div class="form-group">
          <label class="form-label">Natural Language Inquiry</label>
          <textarea class="form-input" id="analysis-q" rows="4" placeholder="e.g. Provide a quarterly breakdown of sales performance compared to our business metrics...">${qText}</textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; padding-top:1rem; border-top:1px solid var(--border-light);">
          <button class="btn btn-primary" id="btn-analyze" style="min-width:200px;">
             Execute Analysis
          </button>
        </div>
      </div>
    </div>
    
    <div id="pbi-results-grid" style="display:none; grid-template-columns: repeat(auto-fit, minmax(480px, 1fr)); gap:1.5rem; margin-bottom:3rem;">
    </div>
  `;

  try {
    const data = await api.listDataSources();
    const select = document.getElementById('analysis-source');
    if (data.data_sources?.length) {
      select.innerHTML = data.data_sources.map(s => `< option value = "${s.id}" > ${s.name} (${s.type})</option > `).join('');
      if (initialSourceId) select.value = initialSourceId;
    } else {
      select.innerHTML = '<option value="">No data sources available</option>';
    }
  } catch (e) { }

  // Pill selector logic
  const pills = document.querySelectorAll('#insight-count-pills .pill-btn');
  const hint = document.getElementById('insight-count-hint');
  let selectedCount = 3;
  pills.forEach(p => {
    p.onclick = () => {
      pills.forEach(btn => btn.classList.remove('active'));
      p.classList.add('active');
      selectedCount = parseInt(p.dataset.value);
      hint.textContent = selectedCount === 1 ? 'Generates 1 detailed chart' : `Generates ${selectedCount} distinct charts`;
    };
  });

  document.getElementById('btn-analyze').onclick = submitCustomAnalysis;
}

function navigateToAnalysisWithQ(sourceId, q) {
  navigate('analysis', { q, sourceId });
}

async function submitCustomAnalysis() {
  const sourceId = document.getElementById('analysis-source').value;
  const q = document.getElementById('analysis-q').value;
  if (!sourceId || !q.trim()) return showToast('Please select source and enter a question', 'error');

  const btn = document.getElementById('btn-analyze');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  const grid = document.getElementById('pbi-results-grid');
  grid.style.display = 'grid';
  grid.innerHTML = '';

  const countEl = document.querySelector('#insight-count-pills .pill-btn.active');
  const count = countEl ? parseInt(countEl.dataset.value) : 3;
  if (count === 1) grid.style.gridTemplateColumns = '1fr';
  else if (count === 2) grid.style.gridTemplateColumns = '1fr 1fr';
  else grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(480px, 1fr))';

  try {
    const payloads = [];
    for (let i = 0; i < count; i++) {
      payloads.push(api.post('/analysis/query', {
        source_id: sourceId, question: q, context_id: count > 1 ? `Insight ${i + 1}/${count}` : null
      }));
    }

    showToast(`Coordinating analytical resources for ${count} workstreams...`, 'info');
    const results = await Promise.all(payloads);
    btn.textContent = '🚀 Run Analysis';
    btn.disabled = false;

    // Create a panel for each job
    for (let i = 0; i < results.length; i++) {
      const jobId = results[i].job_id;
      const panelHtml = `
          <div class="pbi-panel" id="pbi-panel-${jobId}">
            <div class="pbi-panel-header">
              <span class="pbi-panel-title">Insight ${i + 1}</span>
              <span class="pbi-panel-status badge badge-primary" id="pbi-status-${jobId}">Initializing...</span>
            </div>
            <div class="pbi-panel-chart" id="pbi-chart-${jobId}">
              <div class="spinner"></div>
            </div>
            <div class="pbi-panel-insight" id="pbi-insight-${jobId}"></div>
          </div>
        `;
      grid.insertAdjacentHTML('beforeend', panelHtml);

      pollPBIPanel(jobId, sourceId);
    }
  } catch (e) {
    showToast(e.message, 'error');
    btn.disabled = false;
    btn.textContent = '🚀 Run Analysis';
  }
}

async function pollPBIPanel(jobId, sourceId) {
  let attempts = 0;
  while (attempts < 90) {
    try {
      const st = await api.get(`/analysis/${jobId}`);
      const s = st.status;
      const statusEl = document.getElementById(`pbi-status-${jobId}`);
      if (statusEl) {
        if (s === 'done') {
          return _renderPBIPanel(jobId, await api.get(`/analysis/${jobId}/result`), sourceId);
        } else if (s === 'failed') {
          return _setPBIPanelError(jobId, st.error || 'Failed to complete analysis');
        } else if (s === 'awaiting_approval') {
          return _renderApprovalState(jobId, st.sql_query, st.explanation);
        } else if (s === 'reflection') {
          statusEl.className = 'pbi-panel-status badge badge-info';
          statusEl.innerHTML = '<span class="pulse-loader"><span class="pulse-dot"></span><span class="pulse-dot"></span><span class="pulse-dot"></span></span> Introspecting...';
        } else if (s === 'data_discovery') {
          statusEl.className = 'pbi-panel-status badge badge-info';
          statusEl.textContent = 'Exploring Patterns...';
        } else {
          statusEl.textContent = s.replace('_', ' ').toUpperCase();
        }
      }
    } catch (e) { console.warn('Poll error', e); }
    await new Promise(r => setTimeout(r, 3000));
    attempts++;
  }
  _setPBIPanelError(jobId, 'Analysis timed out');
}

function _renderApprovalState(jobId, sql, intent) {
  const statusEl = document.getElementById(`pbi-status-${jobId}`);
  const chartEl = document.getElementById(`pbi-chart-${jobId}`);
  const panelEl = document.getElementById(`pbi-panel-${jobId}`);

  if (statusEl) { statusEl.className = 'pbi-panel-status badge badge-warning'; statusEl.textContent = 'Awaiting Review'; }
  if (panelEl) panelEl.style.borderColor = 'var(--warning)';

  if (chartEl) {
    chartEl.innerHTML = `
      <div style="padding:1rem; height:100%; display:flex; flex-direction:column;">
        <h4 style="color:var(--warning); margin-bottom:0.5rem; display:flex; align-items:center; gap:0.5rem;">⚠️ Strategic Signal Required</h4>
        <p style="font-size:0.85rem; color:var(--text-dim); margin-bottom:0.75rem;"><strong>AI Reasoning:</strong> ${intent || 'To securely fetch your data.'}</p>
        <div style="background:rgba(0,0,0,0.3); padding:0.75rem; border-radius:6px; flex:1; overflow-y:auto; overflow-x:auto; margin-bottom:1rem; border:1px solid rgba(255,255,255,0.05);">
          <code style="color:#60A5FA; font-size:0.8rem; white-space:pre;">${sql || 'SELECT * FROM ...'}</code>
        </div>
        <div style="display:flex; gap:0.75rem; justify-content:flex-end;">
          <button class="btn btn-sm btn-secondary" onclick="cancelJob('${jobId}')" style="color:var(--error); border-color:var(--error);">Cancel Task</button>
          <button class="btn btn-sm btn-primary" onclick="approveJob('${jobId}')" style="background:var(--success); border-color:var(--success);">✓ Validate & Execute</button>
        </div>
      </div>
    `;
  }
}

async function approveJob(jobId) {
  try {
    await api.post(`/analysis/${jobId}/approve`, {});
    const statusEl = document.getElementById(`pbi-status-${jobId}`);
    const panelEl = document.getElementById(`pbi-panel-${jobId}`);
    const chartEl = document.getElementById(`pbi-chart-${jobId}`);
    if (statusEl) { statusEl.className = 'pbi-panel-status badge badge-primary'; statusEl.textContent = 'Resuming...'; }
    if (panelEl) panelEl.style.borderColor = '';
    if (chartEl) chartEl.innerHTML = '<div class="spinner"></div>';

    pollPBIPanel(jobId, null);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function cancelJob(jobId) {
  const panelEl = document.getElementById(`pbi-panel-${jobId}`);
  if (panelEl) panelEl.style.borderColor = '';
  _setPBIPanelError(jobId, 'Analysis cancelled by user');
  showToast('Analysis cancelled', 'info');
}

async function _renderPBIPanel(jobId, result, sourceId) {
  const statusEl = document.getElementById(`pbi-status-${jobId}`);
  const chartEl = document.getElementById(`pbi-chart-${jobId}`);
  const insightEl = document.getElementById(`pbi-insight-${jobId}`);
  const panelEl = document.getElementById(`pbi-panel-${jobId}`);

  if (statusEl) {
    statusEl.className = 'pbi-panel-status badge badge-success';
    statusEl.textContent = '✓ Ready';
    if (result.reflection_count > 0) {
      statusEl.innerHTML += ' <span style="font-size:0.7rem; opacity:0.8; margin-left:0.4rem; font-weight:500;">(Auto-Adjusted)</span>';
    }
  }
  if (panelEl) panelEl.classList.add('done');

  // Render chart
  if (chartEl && result.chart_json) {
    try {
      const Plotly = await loadPlotly();
      chartEl.innerHTML = '';
      const layout = {
        ...(result.chart_json.layout || {}),
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(241,245,249,0.4)',
        font: { color: 'var(--text-main)', family: 'Outfit, sans-serif', size: 12 },
        margin: { t: 28, b: 40, l: 50, r: 16 },
        legend: { bgcolor: 'rgba(0,0,0,0)', font: { color: 'var(--text-dim)' } },
        xaxis: { ...(result.chart_json.layout?.xaxis || {}), gridcolor: 'var(--primary-100)', linecolor: 'var(--primary-200)' },
        yaxis: { ...(result.chart_json.layout?.yaxis || {}), gridcolor: 'var(--primary-100)', linecolor: 'var(--primary-200)' },
      };
      Plotly.newPlot(chartEl, result.chart_json.data, layout, { responsive: true, displayModeBar: false });
    } catch (e) {
      chartEl.innerHTML = '<div class="pbi-no-chart">Chart unavailable</div>';
    }
  } else if (chartEl) {
    chartEl.innerHTML = '<div class="pbi-no-chart">No chart generated</div>';
  }

  // Render insight
  if (insightEl) {
    const text = result.executive_summary || result.insight_report || '';
    insightEl.innerHTML = text
      ? `<div class="pbi-insight-text">${text}</div>`
      : `<div class="pbi-insight-text" style="color:var(--text-muted)">No insight summary returned.</div>`;
  }
}

function _setPBIPanelError(jobId, msg) {
  const statusEl = document.getElementById(`pbi-status-${jobId}`);
  const chartEl = document.getElementById(`pbi-chart-${jobId}`);
  if (statusEl) { statusEl.className = 'pbi-panel-status badge badge-danger'; statusEl.textContent = 'Error'; }
  if (chartEl) chartEl.innerHTML = `<div class="pbi-no-chart" style="color:var(--error-500)">${msg}</div>`;
}
// ── Users Page ─────────────────────────────────────────
async function renderUsers(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Identity & Access</h1>
        <p class="page-subtitle">Manage organization-level permissions and team collaboration</p>
      </div>
      <button class="btn btn-primary" onclick="showInviteModal()">Invite Contributor</button>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Authorized Personnel</span></div>
      <div class="card-body" id="users-list" style="padding:1.5rem;">
        <div style="text-align:center;padding:3rem;"><div class="spinner" style="margin:0 auto;"></div></div>
      </div>
    </div>
    <!-- Invite Modal -->
    <div class="modal-overlay" id="invite-modal">
      <div class="modal">
        <div class="modal-header"><h3 class="modal-title">Authorize New Member</h3><button class="btn-icon" onclick="closeInviteModal()">✕</button></div>
        <div class="modal-body">
          <div class="form-group"><label class="form-label">Corporate Email</label><input class="form-input" id="invite-email" placeholder="name@company.com"></div>
          <div class="form-group"><label class="form-label">Initial Access Code</label><input class="form-input" type="password" id="invite-password" placeholder="System password"></div>
          <div class="form-group"><label class="form-label">Privilege Level</label>
            <select class="form-select" id="invite-role"><option value="viewer">Viewer</option><option value="admin">Administrator</option></select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeInviteModal()">Cancel</button>
          <button class="btn btn-primary" id="btn-invite">Dispatch Invitation</button>
        </div>
      </div>
    </div>
  `;

  loadUsers();

  const btnInvite = document.getElementById('btn-invite');
  if (btnInvite) {
    btnInvite.onclick = async () => {
      try {
        await api.inviteUser(
          document.getElementById('invite-email').value,
          document.getElementById('invite-password').value,
          document.getElementById('invite-role').value,
        );
        closeInviteModal();
        showToast('Invitation sent! ✓', 'success');
        loadUsers();
      } catch (e) { showToast(e.message, 'error'); }
    };
  }
}

async function loadUsers() {
  try {
    const data = await api.listUsers();
    const list = document.getElementById('users-list');
    if (!data.users?.length) {
      list.innerHTML = '<div class="empty-state"><h3>No team members</h3></div>';
      return;
    }
    list.innerHTML = data.users.map(u => `
      <div class="user-item" style="display:flex; align-items:center; padding:1.25rem 1.5rem; margin-bottom:0.75rem; gap:1.5rem; background:var(--primary-50); border:1px solid var(--border-light); border-radius:var(--radius-md);">
        <div class="sidebar-avatar" style="width:40px; height:40px; flex-shrink:0;">${u.email.substring(0, 2).toUpperCase()}</div>
        <div class="source-info" style="flex:1;">
          <div class="source-name" style="font-weight:700; color:var(--text-main);">${u.email}</div>
          <div class="source-meta" style="font-size:0.8rem; color:var(--text-muted); font-weight:500;">Authorized ${new Date(u.created_at).toLocaleDateString()}</div>
        </div>
        <span class="badge ${u.role === 'admin' ? 'badge-info' : 'badge-success'}">${u.role.toUpperCase()}</span>
        ${u.id !== getUser()?.id ? `<button class="btn btn-sm btn-secondary" style="color:var(--error);" onclick="removeUser('${u.id}')">Revoke Access</button>` : ''}
      </div>
    `).join('');
  } catch (e) { showToast('Failed to load users', 'error'); }
}

async function removeUser(id) {
  if (!confirm('Remove this team member?')) return;
  try {
    await api.removeUser(id);
    showToast('User removed', 'success');
    loadUsers();
  } catch (e) { showToast(e.message, 'error'); }
}

function showInviteModal() { document.getElementById('invite-modal').classList.add('open'); }
function closeInviteModal() { document.getElementById('invite-modal').classList.remove('open'); }

// ── Boot ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (getAccessToken()) {
    renderApp();
  } else {
    renderAuth();
  }
});


// ══════════════════════════════════════════════════════
// ── SOURCE DASHBOARD (CSV & SQL) ──────────────────────
// ══════════════════════════════════════════════════════

async function renderSourceDashboard(container) {
  const sourceId = window._dashboardSourceId;
  if (!sourceId) { navigate('data-sources'); return; }

  // Loading state
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Executive Insight Hub</h1>
        <p class="page-subtitle">Auto-generated specialized intelligence dashboards</p>
      </div>
      <button class="btn btn-secondary" onclick="navigate('data-sources')">← Back to Assets</button>
    </div>
    <div class="dashboard-loading" style="background:var(--bg-surface); border-radius:var(--radius-lg); border:1px solid var(--border-light); padding:5rem 2rem;">
      <div class="spinner" style="width:48px; height:48px; margin:0 auto 2rem;"></div>
      <h3 style="font-family:'Outfit';">Initializing Data Synthesis...</h3>
      <p style="color:var(--text-dim);">Please wait while the AI identifies business patterns.</p>
    </div>
  `;

  try {
    let source = await api.getDashboard(sourceId);

    // If still running, poll and show spinner
    if (source.auto_analysis_status === 'running' || source.auto_analysis_status === 'pending') {
      container.innerHTML = `
        <div class="page-header">
          <div>
            <h1 class="page-title">Executive Insight Hub</h1>
            <p class="page-subtitle">Synthesizing autonomous reasoning for your data assets</p>
          </div>
          <button class="btn btn-secondary" onclick="navigate('data-sources')">← Back</button>
        </div>
        <div class="dashboard-loading" style="background:var(--bg-surface); border-radius:var(--radius-lg); border:1px solid var(--border-light); padding:5rem 2rem;">
          <div class="spinner" style="width:48px; height:48px; margin:0 auto 2rem; border-color:var(--accent-blue); border-top-color:transparent;"></div>
          <h3 style="font-family:'Outfit';">Autonomous Reasoning in Progress...</h3>
          <p style="color:var(--text-dim); max-width:500px; margin:0 auto 2rem;">The agent is traversing your data to generate a multi-dimensional intelligence report. This typically concludes within 45 seconds.</p>
          <div class="analysis-progress" style="max-width:400px; margin:0 auto;">
            <div class="progress-container" style="display:block; height:8px;"><div class="progress-bar" id="progress-fill"></div></div>
            <span id="progress-label" style="display:block; margin-top:1rem; font-size:0.85rem; font-weight:700; color:var(--accent-indigo); text-transform:uppercase; letter-spacing:0.05em;">Introspecting Schema...</span>
          </div>
        </div>
      `;

      // Animate progress bar + poll
      const steps = [
        'Detecting data domain…',
        'Generating smart questions…',
        'Running analysis 1/5…',
        'Running analysis 2/5…',
        'Running analysis 3/5…',
        'Running analysis 4/5…',
        'Running analysis 5/5…',
        'Finalising insights…',
      ];
      let stepIdx = 0;
      const interval = setInterval(() => {
        if (stepIdx < steps.length - 1) stepIdx++;
        const fill = document.getElementById('progress-fill');
        const label = document.getElementById('progress-label');
        if (fill) fill.style.width = `${Math.round(((stepIdx + 1) / steps.length) * 100)}%`;
        if (label) label.textContent = steps[stepIdx];
      }, 4000);

      // Poll until done
      let attempts = 0;
      while ((source.auto_analysis_status === 'running' || source.auto_analysis_status === 'pending') && attempts < 30) {
        await new Promise(r => setTimeout(r, 4000));
        source = await api.getDashboard(sourceId);
        attempts++;
      }
      clearInterval(interval);
    }

    // Render the right dashboard based on source type
    if (source.type === 'csv') {
      await renderCSVDashboard(container, source);
    } else {
      await renderSQLDashboard(container, source);
    }
  } catch (e) {
    container.innerHTML = `<div class="error-state">Failed to load dashboard: ${e.message}</div>`;
  }
}


// ── CSV Dashboard ──────────────────────────────────────
async function renderCSVDashboard(container, source) {
  const schema = source.schema_json || {};
  const autoData = source.auto_analysis_json || {};
  const results = autoData.results || [];
  const domain = source.domain_type || autoData.domain_type || 'data';

  const cols = schema.columns || [];
  const numCols = cols.filter(c => ['float64', 'int64', 'int32', 'float32'].includes(c.dtype));
  const catCols = cols.filter(c => c.dtype === 'object');
  const dateCols = cols.filter(c => c.dtype.includes('date') || c.name.toLowerCase().includes('date') || c.name.toLowerCase().includes('time'));

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Resource Analysis</h1>
        <p class="page-subtitle">${source.name} • <span class="badge badge-info" style="text-transform:capitalize;">${domain}</span></p>
      </div>
      <div style="display:flex; gap:0.75rem;">
        <button class="btn btn-primary" onclick="navigateToAnalysis('${source.id}')">🔍 New Query</button>
        <button class="btn btn-secondary" onclick="navigate('data-sources')">← Back</button>
      </div>
    </div>

    <!-- Stats row -->
    <div class="stats-grid" style="margin-bottom:2rem;">
      <div class="stat-card">
        <div class="stat-label">Inventory Size</div>
        <div class="stat-value">${(schema.row_count || 0).toLocaleString()} <span style="font-size:0.85rem; font-weight:500; color:var(--text-dim);">Rows</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Schema Breadth</div>
        <div class="stat-value">${schema.column_count || 0} <span style="font-size:0.85rem; font-weight:500; color:var(--text-dim);">Cols</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Analytics Potential</div>
        <div class="stat-value">${numCols.length} <span style="font-size:0.85rem; font-weight:500; color:var(--text-dim);">Metrics</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Stability Score</div>
        <div class="stat-value" style="color:var(--accent-blue);">${Math.round((source.auto_analysis_json?.quality_score || 1) * 100)}%</div>
      </div>
    </div>

    <!-- Column profile -->
    <div class="card" style="margin-bottom:2rem;">
      <div class="card-header"><span class="card-title">Structural Metadata</span></div>
      <div class="card-body" style="padding:0; overflow-x:auto;">
        <table class="data-table">
          <thead><tr><th>Identity</th><th>Data Protocol</th><th>Sample Observations</th></tr></thead>
          <tbody>
            ${cols.slice(0, 10).map(c => `
              <tr>
                <td style="font-weight:700; color:var(--text-main);">${c.name}</td>
                <td><span class="badge ${numCols.find(n => n.name === c.name) ? 'badge-info' : dateCols.find(d => d.name === c.name) ? 'badge-warning' : 'badge-neutral'}">${c.dtype.toUpperCase()}</span></td>
                <td style="color:var(--text-dim); font-size:0.85rem; font-family:'Inter';">${(c.sample_values || []).slice(0, 3).join(', ')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- AI Insights grid -->
    <div class="section-title">🤖 AI-Generated Insights <span style="font-size:0.8rem;color:var(--text-muted);font-weight:400;">— ${results.length} analyses · auto-generated once</span></div>
    <div class="ai-insights-grid" id="insights-grid"></div>
  `;

  // Render cards with staggered animation
  await renderInsightCards(results, 'insights-grid', source.id);
}


// ── SQL Dashboard ──────────────────────────────────────
async function renderSQLDashboard(container, source) {
  const schema = source.schema_json || {};
  const autoData = source.auto_analysis_json || {};
  const results = autoData.results || [];
  const domain = source.domain_type || autoData.domain_type || 'database';
  const tables = schema.tables || [];

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Relational Intelligence</h1>
        <p class="page-subtitle">${source.name} • <span class="badge badge-success" style="text-transform:capitalize;">${domain}</span></p>
      </div>
      <div style="display:flex; gap:0.75rem;">
        <button class="btn btn-primary" onclick="navigateToAnalysis('${source.id}')">🔍 New Query</button>
        <button class="btn btn-secondary" onclick="navigate('data-sources')">← Back</button>
      </div>
    </div>

    <!-- Stats row -->
    <div class="stats-grid" style="margin-bottom:2rem;">
      <div class="stat-card">
        <div class="stat-label">Schema Depth</div>
        <div class="stat-value">${schema.table_count || tables.length} <span style="font-size:0.85rem; font-weight:500; color:var(--text-dim);">Tables</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Relational Scope</div>
        <div class="stat-value">${schema.total_columns || '—'} <span style="font-size:0.85rem; font-weight:500; color:var(--text-dim);">Attributes</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Protocol</div>
        <div class="stat-value" style="font-size:1rem; color:var(--accent-blue);">${(schema.dialect || schema.source_type || 'SQL').toUpperCase()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Autonomous Health</div>
        <div class="stat-value" style="color:var(--success);">${results.filter(r => r.status === 'done').length}/${results.length || 5}</div>
      </div>
    </div>

    <!-- Schema explorer -->
    ${tables.length > 0 ? `
    <div class="card" style="margin-bottom:2rem;">
      <div class="card-header"><span class="card-title">Relational Map</span></div>
      <div class="card-body">
        <div class="tables-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:1.25rem;">
          ${tables.map(t => `
            <div class="table-card" style="background:var(--primary-50); border:1px solid var(--border-light); border-radius:var(--radius-md); padding:1.25rem; transition:var(--transition); cursor:default;">
              <div class="table-card-name" style="font-weight:700; color:var(--text-main); font-size:1rem; margin-bottom:0.15rem;">📋 ${t.table}</div>
              <div class="table-card-meta" style="font-size:0.8rem; color:var(--text-muted); font-weight:500; margin-bottom:0.75rem;">${t.column_count} COLUMNS ${t.row_count != null ? ' • ' + Number(t.row_count).toLocaleString() + ' ROWS' : ''}</div>
              <div class="table-card-cols" style="display:flex; flex-wrap:wrap; gap:0.4rem;">
                ${(t.columns || []).slice(0, 4).map(c => `<span class="badge badge-neutral" style="font-size:0.7rem; padding:0.2rem 0.5rem; text-transform:none;">${c.name}</span>`).join('')}
                ${t.columns?.length > 4 ? `<span class="badge badge-neutral" style="font-size:0.7rem; padding:0.2rem 0.5rem; opacity:0.6;">+${t.columns.length - 4} MORE</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>` : ''}

    <!-- AI Insights grid -->
    <div class="section-title">🤖 AI-Generated Insights <span style="font-size:0.8rem;color:var(--text-muted);font-weight:400;">— ${results.length} analyses · auto-generated once</span></div>
    <div class="ai-insights-grid" id="insights-grid"></div>
  `;

  // Render cards with staggered animation
  await renderInsightCards(results, 'insights-grid', source.id);
}


// ── Animated Insight Cards ─────────────────────────────
async function renderInsightCards(results, containerId, sourceId) {
  const grid = document.getElementById(containerId);
  if (!grid) return;

  if (!results || results.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">🤖</div><h3>No insights yet</h3><p>Auto-analysis may still be running.</p></div>`;
    return;
  }

  // Render each card with a stagger delay
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const card = document.createElement('div');
    card.className = 'insight-card';
    card.style.animationDelay = `${i * 0.12}s`;

    const statusBadge = r.status === 'done'
      ? `<span class="badge badge-success">✓ Done</span>`
      : `<span class="badge badge-error">⚠ Failed</span>`;

    card.innerHTML = `
      <div class="insight-card-header">
        <span class="insight-index">#${i + 1}</span>
        ${statusBadge}
      </div>
      <div class="insight-question">"${r.question}"</div>
      ${r.status === 'done' ? `
        <div class="insight-summary">${r.executive_summary || ''}</div>
        ${r.chart_json ? `<div class="insight-chart" id="chart-${sourceId}-${i}"></div>` : ''}
        <div class="insight-footer">
          <button class="btn btn-sm btn-secondary" onclick="navigateToAnalysisWithQ('${sourceId}', ${JSON.stringify(r.question).replace(/"/g, '&quot;')})">🔍 Ask follow-up</button>
        </div>
      ` : `<div style="color:var(--error-400);font-size:0.85rem;">${r.error || 'Analysis failed'}</div>`}
    `;

    grid.appendChild(card);

    // Render chart after DOM append
    if (r.status === 'done' && r.chart_json) {
      await loadPlotly().then(Plotly => {
        const chartEl = document.getElementById(`chart-${sourceId}-${i}`);
        if (chartEl) {
          Plotly.newPlot(chartEl, r.chart_json.data, r.chart_json.layout, {
            responsive: true, displayModeBar: false
          });
        }
      }).catch(() => { });
    }
  }
}

function navigateToAnalysisWithQ(sourceId, question) {
  window._preselectedSourceId = sourceId;
  window._prefilledQuestion = question;
  navigate('analysis');
}

// ── Metrics Page ───────────────────────────────────────
async function renderMetrics(container) {
  const isAdmin = getUser()?.role === 'admin';
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Semantic Intelligence</h1>
        <p class="page-subtitle">Define organizational metrics to guide AI reasoning and context</p>
      </div>
      ${isAdmin ? `<button class="btn btn-primary" onclick="showMetricModal()">Define Metric</button>` : ''}
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Corporate Metric Dictionary</span></div>
      <div class="card-body" id="metrics-list" style="padding:0;">
        <div style="text-align:center;padding:4rem;"><div class="spinner" style="margin:0 auto;"></div></div>
      </div>
    </div>
    <!-- Metric Modal -->
    <div class="modal-overlay" id="metric-modal">
      <div class="modal">
        <div class="modal-header"><h3 class="modal-title">Define Strategic Metric</h3><button class="btn-icon" onclick="closeMetricModal()">✕</button></div>
        <div class="modal-body">
          <div class="form-group"><label class="form-label">Metric Label</label><input class="form-input" id="metric-name" placeholder="e.g. Net Revenue Retention"></div>
          <div class="form-group"><label class="form-label">Business Logic Definition</label><textarea class="form-input" id="metric-def" rows="3" placeholder="Explain the calculation logic and business intent..."></textarea></div>
          <div class="form-group"><label class="form-label">Calculated Formula</label><input class="form-input" id="metric-formula" placeholder="e.g. sum(rev_current) / sum(rev_previous)"></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeMetricModal()">Cancel</button>
          <button class="btn btn-primary" id="btn-save-metric">Register Metric</button>
        </div>
      </div>
    </div>
  `;

  loadMetrics();

  if (isAdmin) {
    document.getElementById('btn-save-metric').onclick = async () => {
      try {
        await api.createMetric({
          name: document.getElementById('metric-name').value,
          definition: document.getElementById('metric-def').value,
          formula: document.getElementById('metric-formula').value,
        });
        closeMetricModal();
        showToast('Metric defined! 📖', 'success');
        loadMetrics();
      } catch (e) { showToast(e.message, 'error'); }
    };
  }
}

async function loadMetrics() {
  try {
    const data = await api.listMetrics();
    const list = document.getElementById('metrics-list');
    if (!data.metrics?.length) {
      list.innerHTML = `<div class="empty-state" style="padding:4rem;"><div class="empty-icon">📖</div><h3>Dictionary is empty</h3><p>Defining metrics helps the AI provide more accurate business insights.</p></div>`;
      return;
    }
    list.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>Metric Property</th><th>Calculation Intent</th><th>Semantic Formula</th><th style="text-align:right;">Control</th></tr></thead>
          <tbody>${data.metrics.map(m => `
            <tr>
              <td style="font-weight:700; color:var(--text-main);">${m.name}</td>
              <td style="max-width:350px; white-space:normal; font-size:0.85rem; color:var(--text-dim); line-height:1.5;">${m.definition}</td>
              <td><code style="background:var(--primary-100); color:var(--accent-indigo); padding:0.2rem 0.5rem; border-radius:4px; font-size:0.8rem;">${m.formula || 'DYNAMIC'}</code></td>
              <td style="text-align:right;">
                ${getUser()?.role === 'admin' ? `<button class="btn btn-sm btn-secondary" style="color:var(--error);" onclick="handleMetricDelete('${m.id}')">Delete</button>` : '—'}
              </td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    `;
  } catch (e) { showToast('Failed to load metrics', 'error'); }
}

async function handleMetricDelete(id) {
  if (!confirm('Remove this metric definition?')) return;
  try {
    await api.deleteMetric(id);
    showToast('Metric removed', 'info');
    loadMetrics();
  } catch (e) { showToast(e.message, 'error'); }
}

function showMetricModal() { document.getElementById('metric-modal').classList.add('open'); }
function closeMetricModal() { document.getElementById('metric-modal').classList.remove('open'); }

// ── Knowledge Base Page ──────────────────────────────────
async function renderKnowledge(container) {
  const isAdmin = getUser()?.role === 'admin';
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Knowledge Repositories</h1>
        <p class="page-subtitle">Index enterprise documentation to enhance autonomous context</p>
      </div>
      ${isAdmin ? `<button class="btn btn-primary" onclick="showKBModal()">Create Repository</button>` : ''}
    </div>
    <div class="kb-grid" id="kb-list" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap:2rem;">
      <div style="text-align:center; padding:5rem; grid-column:1/-1;"><div class="spinner" style="margin:0 auto;"></div></div>
    </div>
    <!-- KB Modal -->
    <div class="modal-overlay" id="kb-modal">
      <div class="modal">
        <div class="modal-header"><h3 class="modal-title">Initialize Knowledge Asset</h3><button class="btn-icon" onclick="closeKBModal()">✕</button></div>
        <div class="modal-body">
          <div class="form-group"><label class="form-label">Collection Name</label><input class="form-input" id="kb-name" placeholder="e.g. Global Compliance Guidelines"></div>
          <div class="form-group"><label class="form-label">Scope Description</label><textarea class="form-input" id="kb-desc" rows="3" placeholder="Define the utility and dataset classification..."></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeKBModal()">Cancel</button>
          <button class="btn btn-primary" id="btn-save-kb">Initialize Collection</button>
        </div>
      </div>
    </div>
  `;

  loadKnowledgeBases();

  if (isAdmin) {
    document.getElementById('btn-save-kb').onclick = async () => {
      try {
        await api.createKB({
          name: document.getElementById('kb-name').value,
          description: document.getElementById('kb-desc').value,
        });
        closeKBModal();
        showToast('Knowledge Base created! 🧠', 'success');
        loadKnowledgeBases();
      } catch (e) { showToast(e.message, 'error'); }
    };
  }
}

async function loadKnowledgeBases() {
  try {
    const data = await api.listKBs();
    const list = document.getElementById('kb-list');
    if (!data.knowledge_bases?.length) {
      list.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:4rem;"><div class="empty-icon">🧠</div><h3>No collections yet</h3><p>Create a collection to start indexing your documents.</p></div>`;
      return;
    }
    list.innerHTML = data.knowledge_bases.map(kb => `
      <div class="card kb-card" onclick="navigate('kb-detail', { id: '${kb.id}', name: '${kb.name}' })" style="cursor:pointer; transition:var(--transition); border-top: 3px solid var(--accent-blue);">
        <div class="card-body" style="padding:1.5rem;">
          <div style="font-size:2rem; margin-bottom:1.25rem;">📂</div>
          <h3 style="margin:0 0 0.5rem 0; font-family:'Outfit'; color:var(--text-main); font-weight:700;">${kb.name}</h3>
          <p style="font-size:0.85rem; color:var(--text-dim); margin-bottom:1.5rem; line-height:1.6; height:3rem; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${kb.description || 'No specialized description provided.'}</p>
          <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; padding-top:1.25rem; border-top:1px solid var(--border-light);">
            <span class="badge badge-neutral" style="font-weight:700;">${kb.document_count} DOCUMENTS</span>
            <span style="color:var(--accent-blue); font-weight:700; font-size:0.75rem; letter-spacing:0.05em;">EXPLORE ASSET →</span>
          </div>
        </div>
      </div>
    `).join('');
  } catch (e) { showToast('Failed to load collections', 'error'); }
}

function showKBModal() { document.getElementById('kb-modal').classList.add('open'); }
function closeKBModal() { document.getElementById('kb-modal').classList.remove('open'); }

// ── KB Detail Page ──────────────────────────────────────
async function renderKBDetail(container) {
  const kb = window._pageParams;
  if (!kb || !kb.id) { navigate('knowledge'); return; }

  const isAdmin = getUser()?.role === 'admin';
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">
          <button class="btn-icon" onclick="navigate('knowledge')" style="padding:0;">←</button>
          <span style="color:var(--text-muted);">Knowledge Base</span>
        </div>
        <h1 class="page-title">📂 ${kb.name}</h1>
      </div>
      ${isAdmin ? `
      <div style="display:flex;gap:0.75rem;">
        <label class="btn btn-primary" style="margin:0;cursor:pointer;">
          ➕ Upload Document
          <input type="file" id="kb-file-upload" style="display:none;" onchange="handleKBFileUpload('${kb.id}')">
        </label>
        <button class="btn btn-secondary" style="color:#EF4444;" onclick="handleKBDelete('${kb.id}')">Delete Collection</button>
      </div>
      ` : ''}
    </div>

    <!-- Upload Progress Card -->
    <div id="kb-upload-card" class="card" style="display:none;margin-bottom:1.5rem;background:rgba(255,255,255,0.02);border:1px solid var(--glass-border);">
      <div class="card-body" style="padding:1rem;">
        <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
          <span id="kb-upload-filename" style="font-weight:600;">document.pdf</span>
          <span id="kb-upload-percent">0%</span>
        </div>
        <div class="progress-bar-container"><div id="kb-upload-progress" class="progress-bar" style="width:0%;"></div></div>
        <div id="kb-upload-status" style="font-size:0.75rem;margin-top:0.5rem;color:var(--text-muted);">Uploading to secure vault...</div>
      </div>
    </div>

    <div class="card">
      <div class="card-body" id="document-list">
        <div style="text-align:center;padding:3rem;"><div class="spinner" style="margin:0 auto;"></div></div>
      </div>
    </div>
  `;

  loadDocuments(kb.id);
}

async function loadDocuments(kbId) {
  try {
    const data = await api.listDocuments(kbId);
    const list = document.getElementById('document-list');
    if (!list) return;
    if (!data.documents?.length) {
      list.innerHTML = `<div class="empty-state" style="padding:4rem;"><div class="empty-icon">📄</div><h3>Empty Collection</h3><p>Upload PDFs or text files to add context for the AI.</p></div>`;
      return;
    }
    list.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>Name</th><th>Status</th><th>Added</th><th>Actions</th></tr></thead>
          <tbody>${data.documents.map(doc => {
      let statusBadge = '';
      if (doc.status === 'indexed') statusBadge = '<span class="badge badge-success">✓ Indexed</span>';
      else if (doc.status === 'error') statusBadge = '<span class="badge badge-error">⚠ Error</span>';
      else statusBadge = '<span class="badge badge-info">⌛ Processing</span>';

      return `
              <tr>
                <td style="font-weight:600;">${doc.name}</td>
                <td>${statusBadge}</td>
                <td style="font-size:0.85rem;">${new Date(doc.created_at).toLocaleDateString()}</td>
                <td>
                  ${getUser()?.role === 'admin' ? `
                    <button class="btn btn-sm btn-icon" title="Delete" onclick="deleteDocument('${kbId}', '${doc.id}')">🗑️</button>
                  ` : '—'}
                </td>
              </tr>
            `;
    }).join('')}</tbody>
        </table>
      </div>
    `;
  } catch (e) { showToast('Failed to load documents', 'error'); }
}

async function handleKBFileUpload(kbId) {
  const input = document.getElementById('kb-file-upload');
  const file = input.files[0];
  if (!file) return;

  const card = document.getElementById('kb-upload-card');
  const bar = document.getElementById('kb-upload-progress');
  const percentText = document.getElementById('kb-upload-percent');
  const nameText = document.getElementById('kb-upload-filename');
  const statusText = document.getElementById('kb-upload-status');

  nameText.innerText = file.name;
  card.style.display = 'block';
  bar.style.width = '0%';
  percentText.innerText = '0%';
  statusText.innerText = 'Uploading...';

  try {
    await api.uploadDocument(kbId, file, (percent) => {
      bar.style.width = `${percent}%`;
      percentText.innerText = `${percent}%`;
    });

    statusText.innerText = 'File saved. Indexing in progress...';
    setTimeout(() => {
      card.style.display = 'none';
      loadDocuments(kbId);
      showToast('Document uploaded! Indexing started.', 'success');
    }, 1500);
  } catch (e) {
    showToast(e.message, 'error');
    card.style.display = 'none';
  }
}

async function handleKBDelete(kbId) {
  if (!confirm('This will delete the entire collection and all its vectors. Continue?')) return;
  try {
    await api.deleteKB(kbId);
    showToast('Collection deleted', 'info');
    navigate('knowledge');
  } catch (e) { showToast('Delete failed', 'error'); }
}

async function renderPolicies(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Safety & Governance</h1>
        <p class="page-subtitle">Define guardrails to control AI behavior and data access</p>
      </div>
      <button class="btn btn-primary" onclick="showPolicyModal()">🛡️ Add Policy</button>
    </div>
    <div class="card">
      <div class="card-body">
        <table class="data-table">
          <thead>
            <tr>
              <th>Policy Name</th>
              <th>Type</th>
              <th>Description</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="policy-list">
            <tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--text-muted);">Loading policies...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Policy Modal -->
    <div id="policy-modal" class="modal">
      <div class="modal-content card" style="max-width:500px;">
        <div class="card-header">🛡️ Define New Policy</div>
        <div class="card-body">
          <form id="policy-form" onsubmit="event.preventDefault(); handlePolicyCreate();">
            <div class="form-group" style="margin-bottom:1.5rem;">
              <label class="form-label">Policy Name</label>
              <input type="text" id="policy-name" class="form-input" placeholder="e.g. No PII Data" required>
            </div>
            <div class="form-group" style="margin-bottom:1.5rem;">
              <label class="form-label">Rule Type</label>
              <select id="policy-type" class="form-select">
                <option value="compliance">Compliance (Data access rules)</option>
                <option value="security">Security (Query restrictions)</option>
                <option value="cleaning">Data Quality (Processing rules)</option>
              </select>
            </div>
            <div class="form-group" style="margin-bottom:1.5rem;">
              <label class="form-label">Description (The AI Rule)</label>
              <textarea id="policy-desc" class="form-input" style="min-height:100px;" placeholder="e.g. Never allow the AI to select columns containing SSN, Credit Card info, or personal addresses." required></textarea>
            </div>
            <div style="display:flex;gap:1rem;justify-content:flex-end;">
              <button type="button" class="btn" onclick="closePolicyModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">Create Policy</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
  loadPolicies();
}

async function loadPolicies() {
  try {
    const data = await api.listPolicies();
    const list = document.getElementById('policy-list');
    if (list && data.policies?.length) {
      list.innerHTML = data.policies.map(p => `
        <tr>
          <td><span style="font-weight:500;">${p.name}</span></td>
          <td><span class="badge badge-${p.rule_type === 'security' ? 'error' : 'secondary'}">${p.rule_type}</span></td>
          <td style="color:var(--text-dim);font-size:0.9rem;max-width:300px;">${p.description}</td>
          <td><button class="btn btn-icon" onclick="handlePolicyDelete('${p.id}')">🗑️</button></td>
        </tr>
      `).join('');
    } else if (list) {
      list.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:3rem;color:var(--text-muted);">No policies defined yet.</td></tr>';
    }
  } catch (e) {
    showToast('Failed to load policies', 'error');
  }
}

async function handlePolicyCreate() {
  const data = {
    name: document.getElementById('policy-name').value,
    rule_type: document.getElementById('policy-type').value,
    description: document.getElementById('policy-desc').value,
  };
  try {
    await api.createPolicy(data);
    showToast('Policy active', 'success');
    closePolicyModal();
    loadPolicies();
  } catch (e) { showToast(e.message, 'error'); }
}

async function handlePolicyDelete(id) {
  if (!confirm('Are you sure you want to remove this guardrail?')) return;
  try {
    await api.deletePolicy(id);
    showToast('Policy removed', 'info');
    loadPolicies();
  } catch (e) { showToast('Delete failed', 'error'); }
}

function showPolicyModal() { document.getElementById('policy-modal').classList.add('open'); }
function closePolicyModal() { document.getElementById('policy-modal').classList.remove('open'); }


// ── Enrichment Page ───────────────────────────────────────
async function renderEnrichment(container) {
  const isAdmin = getUser()?.role === 'admin';
  container.innerHTML = `
    <div class="page-header" style="margin-bottom:2rem;">
      <div>
        <h1 class="page-title">Data Enrichment & Rules</h1>
        <p class="page-subtitle">Define business logic, organizational context, and safety guardrails.</p>
      </div>
      <button class="btn btn-primary" onclick="navigate('dashboard')" style="background:var(--primary-600); border:none; box-shadow:0 4px 12px rgba(99,102,241,0.3);">
        Finish & View Dashboard 👉
      </button>
    </div>

    <!-- Modals (hidden by default) -->
    <div class="modal-overlay" id="metric-modal">
      <div class="modal">
        <div class="modal-header"><h3 class="modal-title">Define Business Metric</h3><button class="btn-icon" onclick="closeMetricModal()">✕</button></div>
        <div class="modal-body">
          <div class="form-group"><label class="form-label">Metric Name</label><input class="form-input" id="metric-name" placeholder="e.g. MRR"></div>
          <div class="form-group"><label class="form-label">Calculation Logic</label><textarea class="form-input" id="metric-logic" rows="4" placeholder="Sum of active subscriptions..."></textarea></div>
        </div>
        <div class="modal-footer"><button class="btn btn-secondary" onclick="closeMetricModal()">Cancel</button><button class="btn btn-primary" id="btn-save-metric">Save</button></div>
      </div>
    </div>

    <div class="modal-overlay" id="kb-modal">
      <div class="modal">
        <div class="modal-header"><h3 class="modal-title">Upload Knowledge Document</h3><button class="btn-icon" onclick="closeKBModal()">✕</button></div>
        <div class="modal-body">
          <div class="form-group"><label class="form-label">Title / Subject</label><input class="form-input" id="kb-title" placeholder="e.g. Q3 Marketing Plan"></div>
          <div class="form-group"><label class="form-label">Upload File</label><input type="file" id="kb-file" class="form-input" accept=".txt,.md,.pdf,.csv"></div>
        </div>
        <div class="modal-footer"><button class="btn btn-secondary" onclick="closeKBModal()">Cancel</button><button class="btn btn-primary" id="btn-upload-kb">Upload</button></div>
      </div>
    </div>

    <div class="modal-overlay" id="policy-modal">
      <div class="modal">
        <div class="modal-header"><h3 class="modal-title">Create Data Policy</h3><button class="btn-icon" onclick="closePolicyModal()">✕</button></div>
        <div class="modal-body">
          <div class="form-group"><label class="form-label">Policy Title</label><input class="form-input" id="policy-title" placeholder="e.g. PII Masking"></div>
          <div class="form-group"><label class="form-label">Rules</label><textarea class="form-input" id="policy-content" rows="4" placeholder="Never expose SSN..."></textarea></div>
        </div>
        <div class="modal-footer"><button class="btn btn-secondary" onclick="closePolicyModal()">Cancel</button><button class="btn btn-primary" id="btn-save-policy">Save</button></div>
      </div>
    </div>

    <div class="enrichment-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.5rem;">
      <div class="card enrichment-card">
        <div class="card-header">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <span class="card-title">📖 Metric Dictionary</span>
            ${isAdmin ? `<button class="btn btn-sm btn-primary" onclick="showMetricModal()">➕ Add</button>` : ''}
          </div>
          <div class="card-context" style="font-size:0.85rem; padding:0.75rem; background:rgba(255,255,255,0.03); border-radius:8px; border-left:3px solid var(--primary-500);">
            <div style="margin-bottom:0.4rem;"><strong>Description:</strong> Define business KPIs and calculation logic.</div>
            <div style="color:var(--primary-400); font-weight:600;">✨ Importance: Ensures the AI uses your formulas, preventing calculation errors.</div>
          </div>
        </div>
        <div class="card-body" id="metrics-list" style="max-height:400px; overflow-y:auto;">
          <div style="text-align:center;padding:2rem;"><div class="spinner" style="margin:0 auto;"></div></div>
        </div>
      </div>

      <div class="card enrichment-card">
        <div class="card-header">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <span class="card-title">🧠 Knowledge Base</span>
            ${isAdmin ? `<button class="btn btn-sm btn-primary" onclick="showKBModal()">➕ New</button>` : ''}
          </div>
          <div class="card-context" style="font-size:0.85rem; padding:0.75rem; background:rgba(255,255,255,0.03); border-radius:8px; border-left:3px solid var(--accent-500);">
            <div style="margin-bottom:0.4rem;"><strong>Description:</strong> Upload documents for contextual background.</div>
            <div style="color:var(--accent-400); font-weight:600;">✨ Importance: Provides company-specific context (PDFs, guides) that isn't in your db.</div>
          </div>
        </div>
        <div class="card-body" id="kb-list" style="display:grid; grid-template-columns:1fr; gap:1rem; max-height:400px; overflow-y:auto;">
          <div style="text-align:center;padding:2rem;"><div class="spinner" style="margin:0 auto;"></div></div>
        </div>
      </div>

      <div class="card enrichment-card">
        <div class="card-header">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <span class="card-title">🛡️ Safety & Governance</span>
            ${isAdmin ? `<button class="btn btn-sm btn-primary" onclick="showPolicyModal()">🛡️ Add</button>` : ''}
          </div>
          <div class="card-context" style="font-size:0.85rem; padding:0.75rem; background:rgba(255,255,255,0.03); border-radius:8px; border-left:3px solid #EF4444;">
            <div style="margin-bottom:0.4rem;"><strong>Description:</strong> Set rules for data access and behavior.</div>
            <div style="color:#EF4444; font-weight:600;">✨ Importance: Maintains enterprise-grade security and compliance.</div>
          </div>
        </div>
        <div class="card-body" id="policies-list" style="display:grid; grid-template-columns:1fr; gap:1rem; max-height:400px; overflow-y:auto;">
          <div style="text-align:center;padding:2rem;"><div class="spinner" style="margin:0 auto;"></div></div>
        </div>
      </div>
    </div>
  `;

  if (window.loadMetrics) loadMetrics();
  if (window.loadDocuments) loadDocuments();
  if (window.loadPolicies) loadPolicies();

  const saveMetricBtn = document.getElementById('btn-save-metric');
  if (saveMetricBtn) {
    saveMetricBtn.onclick = async () => {
      try {
        await api.createMetric({ name: document.getElementById('metric-name').value, logic: document.getElementById('metric-logic').value, source_id: null });
        closeMetricModal();
        showToast('Metric created', 'success');
        if (window.loadMetrics) loadMetrics();
      } catch (e) { showToast(e.message, 'error'); }
    };
  }

  const uploadKbBtn = document.getElementById('btn-upload-kb');
  if (uploadKbBtn) {
    uploadKbBtn.onclick = async () => {
      const file = document.getElementById('kb-file').files[0];
      const title = document.getElementById('kb-title').value;
      if (!file || !title) return showToast('Title and file required', 'error');
      try {
        await handleKBFileUpload(file, title);
        closeKBModal();
        if (window.loadDocuments) loadDocuments();
      } catch (e) { showToast(e.message, 'error'); }
    };
  }

  const savePolicyBtn = document.getElementById('btn-save-policy');
  if (savePolicyBtn) {
    savePolicyBtn.onclick = async () => {
      try {
        await api.post('/policies', { name: document.getElementById('policy-title').value, rules: document.getElementById('policy-content').value, description: document.getElementById('policy-content').value });
        closePolicyModal();
        showToast('Policy created', 'success');
        if (window.loadPolicies) loadPolicies();
      } catch (e) { showToast(e.message, 'error'); }
    };
  }
}

window.showMetricModal = window.showMetricModal || function () { document.getElementById('metric-modal')?.classList.add('open'); };
window.closeMetricModal = window.closeMetricModal || function () { document.getElementById('metric-modal')?.classList.remove('open'); };
window.showKBModal = window.showKBModal || function () { document.getElementById('kb-modal')?.classList.add('open'); };
window.closeKBModal = window.closeKBModal || function () { document.getElementById('kb-modal')?.classList.remove('open'); };
window.showPolicyModal = window.showPolicyModal || function () { document.getElementById('policy-modal')?.classList.add('open'); };
window.closePolicyModal = window.closePolicyModal || function () { document.getElementById('policy-modal')?.classList.remove('open'); };

// ── About Page ──────────────────────────────────────────
async function renderAbout(container) {
  container.innerHTML = `
    <div class="page-header" style="margin-bottom:2.5rem; text-align:center;">
      <div>
        <h1 class="page-title" style="font-size:2.5rem; letter-spacing:-0.5px; background: linear-gradient(to right, #ffffff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">DATAANALYST.AI</h1>
        <p class="page-subtitle" style="font-size:1.1rem; max-width:600px; margin:0 auto; color:var(--text-muted);">The intelligent engine transforming raw data into actionable enterprise insights.</p>
      </div>
    </div>

    <div style="max-width:900px; margin:0 auto;">
      
      <!-- Hero Section -->
      <div class="card" style="margin-bottom:3rem; padding:3.5rem 2.5rem; text-align:center; background: var(--glass-bg); backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); border-top: 2px solid var(--primary-500); box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
        <h2 style="font-size:1.75rem; font-weight:500; margin-bottom:1.5rem; color:var(--text-light); letter-spacing: -0.5px;">Democratizing Data Science</h2>
        <p style="font-size:1.05rem; color:var(--text-muted); max-width:650px; margin:0 auto; line-height:1.75;">
          DataAnalyst.AI empowers teams to make targeted, data-driven decisions without requiring a dedicated engineering department. By establishing secure, direct connections to your databases and contextual documents, we transition complex analytical workloads into intuitive conversations.
        </p>
      </div>

      <!-- Core Capabilities Grid -->
      <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1.5rem;">
        <h3 style="margin:0; font-size:1.25rem; font-weight:500; color:var(--text-light);">Core Architecture</h3>
        <div style="flex:1; height:1px; background:var(--glass-border);"></div>
      </div>
      
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:1.5rem; margin-bottom:4rem;">
        
        <div class="card" style="padding:2rem 1.5rem; background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.05); transition:transform 0.2s;">
          <div style="height:48px; width:48px; border-radius:12px; background:rgba(99,102,241,0.1); display:flex; align-items:center; justify-content:center; margin-bottom:1.25rem; color:var(--primary-400);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M21 12H3"/><path d="M12 3v18"/></svg>
          </div>
          <h4 style="margin-bottom:0.75rem; color:var(--text-light); font-weight:500; font-size:1.1rem;">Multi-Insight Generation</h4>
          <p style="font-size:0.9rem; color:var(--text-muted); line-height:1.6; margin:0;">
            Produce comprehensive dashboards through a single natural language prompt. Specialized agents analyze inputs to compute optimal visual representation, rendering discrete, dynamic Plotly components.
          </p>
        </div>

        <div class="card" style="padding:2rem 1.5rem; background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.05); transition:transform 0.2s;">
          <div style="height:48px; width:48px; border-radius:12px; background:rgba(245,158,11,0.1); display:flex; align-items:center; justify-content:center; margin-bottom:1.25rem; color:var(--warning-400);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <h4 style="margin-bottom:0.75rem; color:var(--text-light); font-weight:500; font-size:1.1rem;">HITL Security Model</h4>
          <p style="font-size:0.9rem; color:var(--text-muted); line-height:1.6; margin:0;">
            Maintain strict governance overhead with Human-in-the-Loop workflows. AI-generated SQL execution intent is suspended, requiring explicit manual sign-off before hitting production workloads.
          </p>
        </div>

        <div class="card" style="padding:2rem 1.5rem; background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.05); transition:transform 0.2s;">
          <div style="height:48px; width:48px; border-radius:12px; background:rgba(16,185,129,0.1); display:flex; align-items:center; justify-content:center; margin-bottom:1.25rem; color:var(--success-400);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>
          </div>
          <h4 style="margin-bottom:0.75rem; color:var(--text-light); font-weight:500; font-size:1.1rem;">Unified Context Engine</h4>
          <p style="font-size:0.9rem; color:var(--text-muted); line-height:1.6; margin:0;">
            Automatically harmonize structured rule ingestion (SQL logic and formulas) with unstructured Retrieval-Augmented Generation (RAG docs) for deeply contextual, highly-accurate AI formulation.
          </p>
        </div>

      </div>

      <!-- Tech Stack -->
      <div class="card" style="padding:2.5rem; margin-bottom:3rem; background:var(--glass-bg); border:1px solid var(--glass-border);">
        <h3 style="margin:0 0 1.5rem 0; font-size:1.25rem; font-weight:500; color:var(--text-light);">Deployment Stack</h3>
        <p style="color:var(--text-muted); line-height:1.6; margin-bottom:2rem; max-width:700px; font-size:0.95rem;">
          At its core, DataAnalyst.AI utilizes a scalable multi-agent infrastructure. Independent worker agents collaborate seamlessly to map logical database relationships (ERD discovery), synthesize optimized sequential queries, and assemble final state reporting blocks.
        </p>
        <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
          <span class="badge" style="background:rgba(255,255,255,0.03); color:var(--text-light); padding:0.5rem 1rem; font-size:0.8rem; border:1px solid rgba(255,255,255,0.1); border-radius:20px; font-weight:400; letter-spacing:0.5px;">AUTONOMOUS AGENTS</span>
          <span class="badge" style="background:rgba(255,255,255,0.03); color:var(--text-light); padding:0.5rem 1rem; font-size:0.8rem; border:1px solid rgba(255,255,255,0.1); border-radius:20px; font-weight:400; letter-spacing:0.5px;">RAG VECTORIZATION</span>
          <span class="badge" style="background:rgba(255,255,255,0.03); color:var(--text-light); padding:0.5rem 1rem; font-size:0.8rem; border:1px solid rgba(255,255,255,0.1); border-radius:20px; font-weight:400; letter-spacing:0.5px;">SEMANTIC SQL LAYER</span>
          <span class="badge" style="background:rgba(255,255,255,0.03); color:var(--text-light); padding:0.5rem 1rem; font-size:0.8rem; border:1px solid rgba(255,255,255,0.1); border-radius:20px; font-weight:400; letter-spacing:0.5px;">ENTERPRISE GOVERNANCE</span>
          <span class="badge" style="background:rgba(255,255,255,0.03); color:var(--text-light); padding:0.5rem 1rem; font-size:0.8rem; border:1px solid rgba(255,255,255,0.1); border-radius:20px; font-weight:400; letter-spacing:0.5px;">INTERACTIVE PLOTLY JS</span>
        </div>
      </div>
    </div>
  `;
}
