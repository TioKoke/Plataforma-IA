import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Search, ChevronDown, LogOut, LayoutDashboard, Settings, Inbox, Plug } from 'lucide-react';
import { BRAND } from '../brand';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  // El chat va full-height (sin footer ni padding extra). Aprende sí muestra footer.
  const hideFooter = location.pathname === '/chat';

  // Aplica el color primario al <html data-primary="..."> una sola vez al mount.
  useEffect(() => {
    document.documentElement.setAttribute('data-primary', BRAND.primary);
  }, []);

  // En el chat necesitamos altura FIJA al viewport para que el scroll interno
  // del panel de mensajes funcione sin generar scroll del body. En el resto
  // de las páginas usamos min-h-screen porque el contenido puede ser largo.
  return (
    <div
      className={`flex flex-col bg-bg ${hideFooter ? 'h-screen overflow-hidden' : 'min-h-screen'}`}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]
                   focus:px-4 focus:py-2 focus:rounded-md focus:text-white focus:font-medium focus:shadow-lg
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        style={{ background: 'var(--primary-ck)' }}
      >
        Saltar al contenido
      </a>
      <TopNav />
      <main
        id="main-content"
        className={`flex-1 flex flex-col ${hideFooter ? 'min-h-0' : ''}`}
        tabIndex={-1}
      >
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
};

export default Layout;

/* ─────────────────── Top navigation ─────────────────── */

function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const items = [
    { to: '/',        label: 'Inicio',   end: true },
    { to: '/aprende', label: 'Aprende' },
    { to: '/agentes', label: 'Agentes' },
    { to: '/chat',    label: 'Chat IA' },
  ];

  return (
    <header
      className="sticky top-0 z-30 border-b border-border-soft backdrop-blur-md"
      style={{ background: 'color-mix(in oklab, var(--bg) 80%, transparent)' }}
    >
      {/* 3-col grid: logo flush left, nav perfectamente centrado, avatar flush right */}
      <div className="w-full h-16 px-8 grid grid-cols-[auto_1fr_auto] items-center gap-4">
        <BrandLogo />

        <nav className="justify-self-center flex items-center gap-0.5 bg-bg-inset p-1 rounded-full border border-border-soft">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                  isActive
                    ? 'bg-bg-elev text-ink shadow-[0_1px_2px_oklch(0.18_0.02_255/0.06),0_0_0_1px_var(--border-soft)]'
                    : 'text-ink-muted hover:text-ink-2'
                }`
              }
            >
              {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="justify-self-end flex items-center gap-3">
          <button className="ck-btn ck-btn-ghost !p-2" aria-label="Buscar">
            <Search className="size-4" />
          </button>
          <span className="h-5 w-px bg-border-soft" />
          <UserAvatar onClick={() => setMenuOpen((o) => !o)} />
        </div>
      </div>

      <UserMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}

function BrandLogo() {
  return (
    <NavLink to="/" className="flex items-center gap-3.5">
      <img
        src="/brand/ibm-logo.png"
        alt="IBM"
        className="h-9 w-auto"
      />
      <span className="h-8 w-px bg-border-strong" />
      <span className="flex flex-col leading-none">
        <span className="ck-display text-[16px]">{BRAND.name}</span>
        <span className="ck-mono text-[10.5px] text-ink-muted mt-1.5 tracking-wider">
          {BRAND.tag.toUpperCase()}
        </span>
      </span>
    </NavLink>
  );
}

function UserAvatar({ onClick }: { onClick: () => void }) {
  const { userName, userEmail } = useAuth();
  const initials =
    userName?.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() ||
    (userEmail || 'UD').slice(0, 2).toUpperCase();
  const displayName = userName || userEmail?.split('@')[0] || 'Usuario';

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-border-soft bg-bg-elev hover:border-border-strong transition-colors"
    >
      <span
        className="size-7 rounded-full grid place-items-center text-[11px] font-semibold ck-mono tracking-wider"
        style={{ background: 'var(--primary-ck)', color: 'var(--primary-fg)' }}
      >
        {initials}
      </span>
      <span className="text-[13px] font-medium text-ink-2">{displayName}</span>
      <ChevronDown className="size-3.5 text-ink-muted" />
    </button>
  );
}

function UserMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userName, userEmail, logout, isAdmin } = useAuth();
  const nav = useNavigate();
  if (!open) return null;

  // Items condicionales por rol — admin ve más cosas.
  const items: { icon: typeof LayoutDashboard; label: string; hint: string; to: string; adminOnly?: boolean }[] = [
    { icon: LayoutDashboard, label: 'Dashboard',         hint: 'Métricas y KPIs de adopción', to: '/dashboard', adminOnly: true },
    { icon: Settings,        label: 'Administración',    hint: 'Gestión de agentes y backlogs', to: '/admin', adminOnly: true },
    { icon: Inbox,           label: 'Mis requerimientos', hint: 'Propuestas de agentes IA', to: '/backlog' },
    { icon: Plug,            label: 'Conectores',        hint: 'Gestiona tus integraciones', to: '/conectores', adminOnly: true },
  ];
  const visible = items.filter((i) => !i.adminOnly || isAdmin);

  const initials =
    userName?.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() ||
    (userEmail || 'UD').slice(0, 2).toUpperCase();

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40" />
      <div className="fixed top-[60px] right-8 z-50 w-80 rounded-xl bg-bg-elev border border-border-soft shadow-pop overflow-hidden">
        <div className="px-4 pt-4 pb-3 flex gap-3 items-center border-b border-border-soft">
          <span
            className="size-10 rounded-full grid place-items-center ck-mono text-sm font-semibold"
            style={{ background: 'var(--primary-ck)', color: 'var(--primary-fg)' }}
          >
            {initials}
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-ink">
              {userName || 'Usuario Demo'}
            </div>
            <div className="text-xs text-ink-muted ck-mono truncate">
              {userEmail || 'demo@plataforma-ia.example'}
            </div>
          </div>
        </div>
        <div className="p-1.5">
          {visible.map((it) => {
            const Icon = it.icon;
            return (
              <button
                key={it.label}
                onClick={() => {
                  onClose();
                  nav(it.to);
                }}
                className="flex w-full items-center gap-3 px-2.5 py-2.5 rounded-lg text-left hover:bg-bg-inset transition-colors"
              >
                <Icon className="size-4 text-ink-2 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium text-ink">{it.label}</span>
                  <span className="block text-[11.5px] text-ink-muted">{it.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-border-soft p-1.5">
          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="flex w-full items-center gap-3 px-2.5 py-2.5 rounded-lg text-left text-ink-2 hover:bg-bg-inset transition-colors"
          >
            <LogOut className="size-4" />
            <span className="text-[13px] font-medium">Cerrar sesión</span>
          </button>
        </div>
      </div>
    </>
  );
}

/* ─────────────────── Footer ─────────────────── */

function Footer() {
  const cols = [
    { title: 'Producto', items: ['Agentes', 'Chat IA', 'Centro de aprendizaje', 'API'] },
    { title: 'Compañía', items: ['Acerca de', 'Equipo', 'Contacto', 'Blog'] },
    { title: 'Recursos', items: ['Documentación', 'Cambios', 'Estado', 'Seguridad'] },
  ];
  return (
    <footer className="border-t border-border-soft bg-bg-muted pt-10 pb-8">
      <div className="ck-container grid grid-cols-[2fr_1fr_1fr_1fr] gap-12">
        <div>
          <BrandLogo />
          <p className="mt-4 text-[13px] text-ink-muted max-w-[320px] leading-relaxed">
            Plataforma corporativa de inteligencia artificial. Agentes, aprendizaje y chat,
            integrados de forma segura.
          </p>
        </div>
        {cols.map((col) => (
          <div key={col.title}>
            <div className="ck-mono text-[11px] text-ink-muted tracking-wider mb-3.5">
              {col.title.toUpperCase()}
            </div>
            <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
              {col.items.map((it) => (
                <li key={it}>
                  <a href="#" className="text-[13px] text-ink-2 hover:text-ink">
                    {it}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="ck-container mt-10 pt-6 border-t border-border-soft flex justify-between items-center text-xs text-ink-muted">
        <span>© 2026 {BRAND.name}. Todos los derechos reservados.</span>
        <div className="flex gap-4">
          <a href="#" className="hover:text-ink-2">Privacidad</a>
          <a href="#" className="hover:text-ink-2">Términos</a>
          <a href="#" className="hover:text-ink-2">Cookies</a>
        </div>
      </div>
    </footer>
  );
}
