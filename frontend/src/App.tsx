import { useState, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import './index.css';

// Layout Components
import Sidebar from './components/Sidebar/Sidebar';
import ChatInterface from './components/Chat/ChatInterface';
import AuthPage from './components/Auth/AuthPage';
import NeuralBackground from './components/NeuralBackground';
import PortalDashboard from './components/Dashboard/PortalDashboard';
import SentinelNexus from './components/Governance/SentinelNexus';
import TeamManagementView from './components/Governance/TeamManagementView';
import AboutUs from './components/Dashboard/AboutUs';
import { AuthAPI } from './services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandingConfig {
  primary_color?: string;
  secondary_color?: string;
}

interface AuthUser {
  id: string;
  email?: string;
  role: string;
  tenant_id: string;
  branding_config?: BrandingConfig;
}

type ViewKey =
  | 'about'
  | 'dashboard'
  | 'csv'
  | 'sql'
  | 'pdf'
  | 'json'
  | 'sentinel'
  | 'team';

type PortalType = Extract<ViewKey, 'csv' | 'sql' | 'pdf' | 'json'>;

const PORTAL_TYPES: PortalType[] = ['csv', 'sql', 'pdf', 'json'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a hex color string to HSL CSS-variable values on :root */
function applyHexToHSLVars(hex: string): void {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  const root = document.documentElement.style;
  root.setProperty('--p-h', (h * 360).toString());
  root.setProperty('--p-s', `${s * 100}%`);
  root.setProperty('--p-l', `${l * 100}%`);
}

/** Apply branding colours from a BrandingConfig object */
function applyBranding(config: BrandingConfig): void {
  const root = document.documentElement.style;
  if (config.primary_color) {
    root.setProperty('--primary', config.primary_color);
    applyHexToHSLVars(config.primary_color);
  }
  if (config.secondary_color) {
    root.setProperty('--secondary', config.secondary_color);
  }
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  token: 'auth_token',
  refresh: 'auth_refresh_token',
  user: 'auth_user',
} as const;

function saveAuth(token: string, refreshToken: string, user: AuthUser): void {
  localStorage.setItem(STORAGE_KEYS.token, token);
  localStorage.setItem(STORAGE_KEYS.refresh, refreshToken);
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

function clearAuthStorage(): void {
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
}

function loadAuthFromStorage(): { token: string; user: AuthUser } | null {
  const token = localStorage.getItem(STORAGE_KEYS.token);
  const refresh = localStorage.getItem(STORAGE_KEYS.refresh);
  const rawUser = localStorage.getItem(STORAGE_KEYS.user);

  if (!token || !refresh || !rawUser) return null;

  try {
    const user = JSON.parse(rawUser) as AuthUser;
    if (user && typeof user === 'object') return { token, user };
  } catch {
    // malformed JSON — treat as missing
  }
  return null;
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [activeSourceIds, setActiveSourceIds] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<ViewKey>('about');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const {
    isAuthenticated,
    user: auth0User,
    getAccessTokenSilently,
    logout: auth0Logout,
    isLoading: auth0Loading,
  } = useAuth0();

  // ── Commit login state (single source of truth) ──────────────────────────

  const handleLogin = useCallback(
    (newToken: string, newRefreshToken: string, newUser: AuthUser) => {
      setToken(newToken);
      setUser(newUser);
      saveAuth(newToken, newRefreshToken, newUser);
      if (newUser.branding_config) applyBranding(newUser.branding_config);
    },
    [],
  );

  const clearAuth = useCallback(() => {
    clearAuthStorage();
    setToken(null);
    setUser(null);
  }, []);

  // ── Bootstrap authentication on mount ────────────────────────────────────

  useEffect(() => {
    if (auth0Loading) return;

    const init = async () => {
      if (isAuthenticated && auth0User) {
        try {
          const accessToken = await getAccessTokenSilently();
          const newUser: AuthUser = {
            id: auth0User.sub ?? '',
            email: auth0User.email,
            role: 'admin',
            tenant_id: 'auto-provisioned',
          };
          handleLogin(accessToken, 'auth0-refresh-token', newUser);
        } catch (e) {
          console.error('Error getting Auth0 access token', e);
        }
      } else {
        const saved = loadAuthFromStorage();
        if (saved) {
          setToken(saved.token);
          setUser(saved.user);
          if (saved.user.branding_config) applyBranding(saved.user.branding_config);
        } else {
          clearAuth();
        }
      }

      setIsInitializing(false);
    };

    init();
  }, [auth0Loading, isAuthenticated, auth0User, getAccessTokenSilently, handleLogin, clearAuth]);

  // ── Logout ────────────────────────────────────────────────────────────────

  const handleLogout = useCallback(async () => {
    try {
      if (isAuthenticated) {
        auth0Logout({ logoutParams: { returnTo: window.location.origin } });
      } else {
        await AuthAPI.logout();
      }
    } catch (e) {
      console.error('Logout failed', e);
    } finally {
      clearAuth();
    }
  }, [isAuthenticated, auth0Logout, clearAuth]);

  // ── Source selection helpers ──────────────────────────────────────────────

  const handleToggleSource = useCallback((id: string | null) => {
    if (!id) { setActiveSourceIds([]); return; }
    setActiveSourceIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  }, []);

  const handleSelectSource = useCallback(
    (id: string | null, view: ViewKey = 'dashboard') => {
      if (id) {
        setActiveSourceIds([id]);
        setCurrentView(view);
      } else {
        setActiveSourceIds([]);
      }
    },
    [],
  );

  // ── View renderer ─────────────────────────────────────────────────────────

  const renderContent = () => {
    if (currentView === 'dashboard') {
      return <ChatInterface activeSourceIds={activeSourceIds} />;
    }

    if ((PORTAL_TYPES as string[]).includes(currentView)) {
      return (
        <PortalDashboard
          type={currentView as PortalType}
          onSelectSource={(id) => handleSelectSource(id ?? undefined)}
        />
      );
    }

    switch (currentView) {
      case 'sentinel': return <SentinelNexus />;
      case 'team':     return <TeamManagementView />;
      case 'about':    return <AboutUs />;
      default:         return <ChatInterface activeSourceIds={activeSourceIds} />;
    }
  };

  // ── Loading screen ────────────────────────────────────────────────────────

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#0a041f] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────

  if (!token || !user) {
    return (
      <div className="min-h-screen bg-[#0a041f] relative overflow-hidden">
        <NeuralBackground />
        <AuthPage onLogin={handleLogin} />
      </div>
    );
  }

  // ── Main shell ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-transparent text-slate-200 flex overflow-hidden relative">
      <NeuralBackground />

      <Sidebar
        activeSourceIds={activeSourceIds}
        onToggleSource={handleToggleSource}
        onSelectSource={handleSelectSource}
        currentView={currentView}
        onViewChange={(v) => setCurrentView(v as ViewKey)}
        user={user}
        onLogout={handleLogout}
      />

      <main className="flex-1 flex flex-col relative overflow-hidden bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5">
        {renderContent()}
      </main>
    </div>
  );
}

export default App;