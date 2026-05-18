import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, LogIn, LayoutDashboard, ClipboardList, Mail, Building2, Briefcase, Settings, Plug } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, login, logout, userName, userEmail, userDivision, userJobTitle, userPhoto, isAdmin } = useAuth();
  const profileRef = useRef<HTMLDivElement>(null);

  const isHome = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allNavigation = [
    { name: 'Inicio', path: '/', public: true },
    { name: 'Aprende', path: '/aprende', public: false },
    { name: 'Agentes', path: '/agentes', public: false },
    { name: 'Chat IA', path: '/chat', public: false },
  ];

  const navigation = isAuthenticated
    ? allNavigation
    : allNavigation.filter(item => item.public);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    setIsOpen(false);
    setProfileOpen(false);
    logout();
  };

  const handleLogin = () => {
    setIsOpen(false);
    login();
  };

  const handleProfileNavigate = (path: string) => {
    setProfileOpen(false);
    setIsOpen(false);
    navigate(path);
  };

  // Transparent mode: on home page when not scrolled
  const isTransparent = isHome && !scrolled;

  const initials = getInitials(userName);

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isTransparent
          ? 'bg-transparent'
          : 'bg-white border-b border-gray-200 shadow-sm'
        }`}>
        <nav className="w-full px-6 lg:px-16" aria-label="Navegación principal">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center">
              <img
                src="/logo.svg"
                alt="Plataforma IA"
                className={`h-10 transition-all duration-300 ${isTransparent ? 'brightness-0 invert' : ''}`}
              />
            </Link>

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`px-4 py-2 text-sm font-medium transition-colors relative ${isTransparent
                      ? isActive(item.path)
                        ? 'text-plataforma-naranja'
                        : 'text-white hover:text-plataforma-naranja'
                      : isActive(item.path)
                        ? 'text-plataforma-naranja'
                        : 'text-plataforma-gris-oscuro hover:text-plataforma-naranja'
                    }`}
                >
                  {item.name}
                  {isActive(item.path) && (
                    <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-plataforma-naranja"></span>
                  )}
                </Link>
              ))}

              {/* Desktop Auth / Profile */}
              <div className={`ml-4 pl-4 border-l ${isTransparent ? 'border-white/30' : 'border-gray-200'}`}>
                {isAuthenticated ? (
                  <div className="relative" ref={profileRef}>
                    <button
                      onClick={() => setProfileOpen(!profileOpen)}
                      className="w-9 h-9 rounded-full bg-plataforma-naranja text-white text-sm font-bold flex items-center justify-center hover:ring-2 hover:ring-plataforma-naranja/40 transition-all overflow-hidden"
                      title={userName ?? 'Perfil'}
                    >
                      {userPhoto ? (
                        <img src={userPhoto} alt={userName ?? 'Perfil'} className="w-full h-full object-cover" />
                      ) : (
                        initials
                      )}
                    </button>

                    {/* Profile Dropdown */}
                    {profileOpen && (
                      <div className="absolute right-0 top-11 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                        {/* User info header */}
                        <div className="px-4 py-4 bg-gradient-to-br from-plataforma-gris-oscuro to-gray-700">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-plataforma-naranja text-white text-lg font-bold flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {userPhoto ? (
                                <img src={userPhoto} alt={userName ?? 'Perfil'} className="w-full h-full object-cover" />
                              ) : (
                                initials
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-white font-semibold text-sm truncate">{userName}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Mail size={11} className="text-white/60 flex-shrink-0" />
                                <p className="text-white/70 text-xs truncate">{userEmail}</p>
                              </div>
                              {userJobTitle && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Briefcase size={11} className="text-white/60 flex-shrink-0" />
                                  <p className="text-white/70 text-xs truncate">{userJobTitle}</p>
                                </div>
                              )}
                              {userDivision && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Building2 size={11} className="text-white/60 flex-shrink-0" />
                                  <p className="text-white/70 text-xs truncate">{userDivision}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Menu items */}
                        <div className="p-2">
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleProfileNavigate('/dashboard')}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${isActive('/dashboard')
                                    ? 'bg-orange-50 text-plataforma-naranja'
                                    : 'text-plataforma-gris-oscuro hover:bg-gray-50'
                                  }`}
                              >
                                <LayoutDashboard size={16} className="text-plataforma-naranja flex-shrink-0" />
                                <div>
                                  <p className="font-medium">Dashboard</p>
                                  <p className="text-xs text-gray-500">Métricas y KPIs de adopción</p>
                                </div>
                              </button>

                              <button
                                onClick={() => handleProfileNavigate('/admin')}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${isActive('/admin')
                                    ? 'bg-orange-50 text-plataforma-naranja'
                                    : 'text-plataforma-gris-oscuro hover:bg-gray-50'
                                  }`}
                              >
                                <Settings size={16} className="text-plataforma-naranja flex-shrink-0" />
                                <div>
                                  <p className="font-medium">Administración</p>
                                  <p className="text-xs text-gray-500">Gestión de agentes y backlogs</p>
                                </div>
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => handleProfileNavigate('/backlog')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${isActive('/backlog')
                                ? 'bg-orange-50 text-plataforma-naranja'
                                : 'text-plataforma-gris-oscuro hover:bg-gray-50'
                              }`}
                          >
                            <ClipboardList size={16} className="text-plataforma-naranja flex-shrink-0" />
                            <div>
                              <p className="font-medium">Mis requerimientos</p>
                              <p className="text-xs text-gray-500">Propuestas de agentes IA</p>
                            </div>
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() => handleProfileNavigate('/conectores')}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${isActive('/conectores')
                                  ? 'bg-orange-50 text-plataforma-naranja'
                                  : 'text-plataforma-gris-oscuro hover:bg-gray-50'
                                }`}
                            >
                              <Plug size={16} className="text-plataforma-naranja flex-shrink-0" />
                              <div>
                                <p className="font-medium">Conectores</p>
                                <p className="text-xs text-gray-500">Gestiona tus integraciones</p>
                              </div>
                            </button>
                          )}
                        </div>

                        <div className="px-2 pb-2 border-t border-gray-100 mt-1 pt-2">
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <LogOut size={16} />
                            Cerrar sesión
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={handleLogin}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-plataforma-naranja rounded-lg hover:bg-plataforma-naranja/90 transition-colors"
                  >
                    <LogIn size={16} />
                    Ingresar
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`md:hidden p-2 rounded-lg transition-colors ${isTransparent
                  ? 'text-white hover:bg-white/10'
                  : 'text-plataforma-gris-oscuro hover:bg-gray-100'
                }`}
              aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-lg animate-fadeIn">
            <nav className="px-6 py-4 space-y-1">
              {isAuthenticated && (
                <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-plataforma-naranja text-white text-sm font-bold flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {userPhoto ? (
                      <img src={userPhoto} alt={userName ?? 'Perfil'} className="w-full h-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-plataforma-gris-oscuro truncate">{userName}</p>
                    <p className="text-xs text-gray-500 truncate">{userEmail}</p>
                    {userJobTitle && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Briefcase size={11} className="text-gray-400 flex-shrink-0" />
                        <p className="text-xs text-gray-500 truncate">{userJobTitle}</p>
                      </div>
                    )}
                    {userDivision && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Building2 size={11} className="text-gray-400 flex-shrink-0" />
                        <p className="text-xs text-gray-500 truncate">{userDivision}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive(item.path)
                      ? 'bg-gray-50 text-plataforma-naranja'
                      : 'text-plataforma-gris-oscuro hover:bg-gray-50'
                    }`}
                >
                  {item.name}
                </Link>
              ))}

              {isAuthenticated && (
                <>
                  {isAdmin && (
                    <>
                      <Link
                        to="/dashboard"
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive('/dashboard') ? 'bg-gray-50 text-plataforma-naranja' : 'text-plataforma-gris-oscuro hover:bg-gray-50'
                          }`}
                      >
                        <LayoutDashboard size={16} />
                        Dashboard
                      </Link>
                      <Link
                        to="/admin"
                        onClick={() => setIsOpen(false)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive('/admin') ? 'bg-gray-50 text-plataforma-naranja' : 'text-plataforma-gris-oscuro hover:bg-gray-50'
                          }`}
                      >
                        <Settings size={16} />
                        Administración
                      </Link>
                    </>
                  )}
                  <Link
                    to="/backlog"
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive('/backlog') ? 'bg-gray-50 text-plataforma-naranja' : 'text-plataforma-gris-oscuro hover:bg-gray-50'
                      }`}
                  >
                    <ClipboardList size={16} />
                    Mis requerimientos
                  </Link>

                  {isAdmin && (
                    <Link
                      to="/conectores"
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive('/conectores') ? 'bg-gray-50 text-plataforma-naranja' : 'text-plataforma-gris-oscuro hover:bg-gray-50'
                        }`}
                    >
                      <Plug size={16} />
                      Conectores
                    </Link>
                  )}
                </>
              )}

              <div className="pt-3 mt-3 border-t border-gray-200">
                {isAuthenticated ? (
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={16} />
                    Cerrar sesión
                  </button>
                ) : (
                  <button
                    onClick={handleLogin}
                    className="w-full flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium text-plataforma-naranja hover:bg-orange-50 transition-colors"
                  >
                    <LogIn size={16} />
                    Iniciar sesión
                  </button>
                )}
              </div>
            </nav>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
