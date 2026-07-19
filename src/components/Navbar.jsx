import { useEffect, useState } from 'react';
import { ShoppingBag, User, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { companyInfo } from '../data/companyInfo';
import logoEmpresa from '../assets/branding/logoempresa.png';

export default function Navbar({ currentView, setView, cart, currentUser, logout }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isOverHero, setIsOverHero] = useState(currentView === 'home');
  const cartCount = cart.reduce((t, i) => t + i.quantity, 0);

  useEffect(() => {
    const handleScroll = () => {
      setIsOverHero(currentView === 'home' && window.scrollY < window.innerHeight - 96);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [currentView]);

  const navLinks = [
    { label: 'Inicio', view: 'home' },
    { label: 'Catálogo', view: 'catalog' },
  ];

  const handleNav = (view) => {
    if (view === 'admin-dashboard') {
      window.location.href = '/eric_diaz/admin/';
      return;
    }

    setView(view);
    setIsOpen(false);
  };

  const iconButtonClass = isOverHero
    ? 'text-white hover:bg-white/10'
    : 'text-[#0A0A0A] hover:bg-[#F2F2F2]';

  return (
    <header className={`floating-navbar ${isOverHero ? 'navbar-over-hero' : ''}`}>
      <div className="px-6 sm:px-10 h-20 flex items-center justify-between">
        <button onClick={() => handleNav('home')} className="flex items-center gap-3 focus:outline-none">
          <span className="flex h-16 w-20 items-center justify-center">
            <img src={logoEmpresa} alt={companyInfo.displayName} className="h-full w-full object-contain drop-shadow-sm" />
          </span>
          <span className="sr-only">{companyInfo.displayName}</span>
        </button>

        <nav className="hidden md:flex items-center space-x-9">
          {navLinks.map((link) => (
            <button
              key={link.view}
              onClick={() => handleNav(link.view)}
              className={`text-[10px] font-medium uppercase tracking-widest nav-link-premium focus:outline-none ${
                currentView === link.view ? 'nav-link-active' : 'opacity-70 hover:opacity-100'
              }`}
            >
              {link.label}
            </button>
          ))}
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => handleNav('admin-dashboard')}
              className={`flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest nav-link-premium focus:outline-none ${
                currentView === 'admin-dashboard' ? 'nav-link-active' : 'opacity-70 hover:opacity-100'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </button>
          )}
        </nav>

        <div className="hidden md:flex items-center space-x-3">
          <button
            onClick={() => handleNav('cart')}
            className={`relative p-2.5 transition-all focus:outline-none ${iconButtonClass}`}
            aria-label="Carrito"
          >
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className={`absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-medium border ${
                isOverHero ? 'bg-white text-[#0A0A0A] border-white' : 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
              }`}>
                {cartCount}
              </span>
            )}
          </button>

          <button
            onClick={() => handleNav('account')}
            className={`flex items-center gap-2 px-4 py-2 border text-[10px] font-medium uppercase tracking-widest transition-all focus:outline-none ${
              isOverHero
                ? 'border-white/40 text-white hover:bg-white hover:text-[#0A0A0A]'
                : 'border-[#C8C8C8] text-[#0A0A0A] hover:border-[#0A0A0A]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            {currentUser ? (currentUser.role === 'admin' ? 'Admin' : 'Cuenta') : 'Acceso'}
          </button>

          {currentUser && (
            <button onClick={logout} className={`p-2 transition-all focus:outline-none ${iconButtonClass}`} aria-label="Cerrar sesión">
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="md:hidden flex items-center gap-3">
          <button onClick={() => handleNav('cart')} className={`relative p-1.5 focus:outline-none ${iconButtonClass}`} aria-label="Carrito">
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className={`absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full text-[8px] ${
                isOverHero ? 'bg-white text-[#0A0A0A]' : 'bg-[#0A0A0A] text-white'
              }`}>
                {cartCount}
              </span>
            )}
          </button>
          <button onClick={() => setIsOpen(!isOpen)} className={`p-1.5 focus:outline-none ${iconButtonClass}`} aria-label="Menú">
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden bg-white border-t border-[#E8E8E8] px-6 py-5 space-y-4 absolute w-full left-0 top-20 z-40 text-[#0A0A0A]">
          {navLinks.map((link) => (
            <button
              key={link.view}
              onClick={() => handleNav(link.view)}
              className={`block w-full text-left py-2.5 text-xs font-medium uppercase tracking-widest ${
                currentView === link.view ? 'text-[#0A0A0A]' : 'text-[#888888]'
              }`}
            >
              {link.label}
            </button>
          ))}
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => handleNav('admin-dashboard')}
              className="block w-full text-left py-2.5 text-xs font-medium uppercase tracking-widest flex items-center gap-2 text-[#888888]"
            >
              <LayoutDashboard className="w-4 h-4" />Panel Admin
            </button>
          )}
          <div className="border-t border-[#E8E8E8] pt-4 space-y-3">
            <button
              onClick={() => handleNav('account')}
              className="flex items-center justify-center gap-2 w-full py-2.5 border border-[#C8C8C8] text-[#0A0A0A] text-xs font-medium uppercase tracking-widest"
            >
              <User className="w-4 h-4" />
              {currentUser ? 'Mi Perfil' : 'Iniciar Sesión'}
            </button>
            {currentUser && (
              <button
                onClick={() => { logout(); setIsOpen(false); }}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#0A0A0A] text-white text-xs font-medium uppercase tracking-widest"
              >
                <LogOut className="w-4 h-4" />Cerrar Sesión
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
