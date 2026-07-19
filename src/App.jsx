import { useCallback, useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Breadcrumbs from './components/Breadcrumbs';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Account from './pages/Account';
import { AtSign, MapPin, Phone, Smartphone, Sparkles, UsersRound } from 'lucide-react';
import { fetchCatalogProducts } from './lib/catalogApi';
import {
  getCurrentAuthUser,
  signInWithSupabase,
  signOutFromSupabase,
  signUpWithSupabase,
} from './lib/authApi';
import { isSupabaseConfigured } from './lib/supabaseClient';
import {
  fetchRemoteCart,
  fetchRemoteFavorites,
  saveRemoteCart,
  saveRemoteFavorites,
} from './lib/userDataApi';
import { clearAdminAccessVerified, hasAdminAccessVerified } from './lib/adminAccess';
import { companyInfo } from './data/companyInfo';
import logoEmpresa from './assets/branding/logoempresa.png';


const EMAIL_CONFIRMED_MESSAGE = 'Correo confirmado correctamente. Ya puedes iniciar sesión con tu correo y contraseña.';

function getAuthRedirectNotice() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashValue = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  const hashQuery = hashValue.includes('?') ? hashValue.slice(hashValue.indexOf('?') + 1) : hashValue;
  const hashParams = new URLSearchParams(hashQuery);
  const authFlag = searchParams.get('auth') || hashParams.get('auth');
  const authType = searchParams.get('type') || hashParams.get('type');

  if (authFlag === 'confirmed' || authType === 'signup') {
    return EMAIL_CONFIRMED_MESSAGE;
  }

  return '';
}

function clearAuthRedirectFromUrl(targetView = 'account') {
  const url = new URL(window.location.href);
  const hadAuthParams = url.searchParams.has('auth') || url.searchParams.has('type');

  url.searchParams.delete('auth');
  url.searchParams.delete('type');

  const currentHash = window.location.hash;
  const hashHasAuthParams = currentHash.includes('auth=') || currentHash.includes('type=');
  const nextHash = hadAuthParams || hashHasAuthParams || !currentHash ? `#/${targetView}` : currentHash;
  const nextSearch = url.searchParams.toString();
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${nextHash}`;

  window.history.replaceState(null, '', nextUrl);
}

function getStorageOwner(user) {
  return user?.email || null;
}

function getCartKey(owner) {
  return owner ? `lh_cart_${owner}` : null;
}

function getFavoritesKey(owner) {
  return owner ? `lh_favorites_${owner}` : null;
}

function readJsonStorage(key, fallback) {
  if (!key) return fallback;

  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function readStoredUser() {
  try {
    const saved = localStorage.getItem('lh_user');
    const user = saved ? JSON.parse(saved) : null;
    if (user?.role === 'admin' && !hasAdminAccessVerified()) {
      localStorage.removeItem('lh_user');
      return null;
    }
    if (user?.id && user?.email) return user;
    if (saved) localStorage.removeItem('lh_user');
    return null;
  } catch {
    localStorage.removeItem('lh_user');
    return null;
  }
}

function readLocalCart(owner) {
  return readJsonStorage(getCartKey(owner), []);
}

function readLocalFavorites(owner) {
  return readJsonStorage(getFavoritesKey(owner), []);
}

function mergeCartItems(remoteItems, localItems) {
  const merged = new Map();

  [...remoteItems, ...localItems].forEach((item) => {
    if (!item?.product?.id) return;
    const current = merged.get(item.product.id);
    const quantity = Math.max(1, Number(item.quantity) || 1);

    merged.set(item.product.id, {
      product: item.product,
      quantity: current ? Math.max(current.quantity, quantity) : quantity,
    });
  });

  return [...merged.values()];
}

function SplashScreen() {
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('galerias_splash_seen') === 'true');

  useEffect(() => {
    if (hidden) return;
    const timer = setTimeout(() => {
      sessionStorage.setItem('galerias_splash_seen', 'true');
      setHidden(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, [hidden]);

  return (
    <div className={`splash-screen ${hidden ? 'is-hidden pointer-events-none' : ''}`} aria-hidden={hidden}>
      <div className="text-center space-y-8 px-6">
        <div className="mx-auto flex h-32 w-32 items-center justify-center">
          <img src={logoEmpresa} alt={companyInfo.displayName} className="h-full w-full object-contain" />
        </div>
        <div className="splash-progress mx-auto"><span /></div>
      </div>
    </div>
  );
}

export default function App() {
  const initialAuthNotice = getAuthRedirectNotice();
  const authRedirectHandledRef = useRef(Boolean(initialAuthNotice));
  const [currentView, setCurrentView] = useState(() => (initialAuthNotice ? 'account' : 'home'));
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [authNotice, setAuthNotice] = useState(initialAuthNotice);

  const setView = (viewName) => {
    if (viewName !== 'account') {
      setAuthNotice('');
    }

    setCurrentView(viewName);
    window.location.hash = `#/${viewName}`;
  };

  useEffect(() => {
    const handleHashChange = () => {
      const notice = getAuthRedirectNotice();
      if (notice) {
        clearAuthRedirectFromUrl('account');

        if (!authRedirectHandledRef.current) {
          authRedirectHandledRef.current = true;
          setAuthNotice(notice);
        }

        setCurrentView('account');
        return;
      }

      const hash = window.location.hash.replace('#/', '');
      const validViews = ['home', 'catalog', 'product-detail', 'cart', 'account'];
      if (validViews.includes(hash)) {
        if (hash !== 'account') {
          setAuthNotice('');
        }
        setCurrentView(hash);
      } else if (!hash) {
        setAuthNotice('');
        setCurrentView('home');
        window.location.hash = '#/home';
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [products, setProducts] = useState([]);
  const [catalogStatus, setCatalogStatus] = useState({
    loading: true,
    source: 'supabase',
    error: null,
  });

  const [currentUser, setCurrentUser] = useState(() => {
    return readStoredUser();
  });

  const [cart, setCart] = useState(() => {
    const user = readStoredUser();
    return readLocalCart(getStorageOwner(user));
  });

  const [favorites, setFavorites] = useState(() => {
    const user = readStoredUser();
    return readLocalFavorites(getStorageOwner(user));
  });

  const [storageOwner, setStorageOwner] = useState(() => {
    const user = readStoredUser();
    return getStorageOwner(user);
  });

  const [toastMessage, setToastMessage] = useState('');
  const remoteSyncReadyRef = useRef(false);
  const remoteSyncRunRef = useRef(0);

  const syncUserDataFromRemote = useCallback(async (user, localCart, localFavorites) => {
    if (!isSupabaseConfigured || !user?.id) return;

    const runId = ++remoteSyncRunRef.current;
    remoteSyncReadyRef.current = false;

    try {
      const [remoteCart, remoteFavorites] = await Promise.all([
        fetchRemoteCart(),
        fetchRemoteFavorites(),
      ]);

      if (runId !== remoteSyncRunRef.current) return;

      const mergedCart = mergeCartItems(remoteCart, localCart);
      const mergedFavorites = [...new Set([...remoteFavorites, ...localFavorites])];

      setCart(mergedCart);
      setFavorites(mergedFavorites);

      await Promise.all([
        saveRemoteCart(user, mergedCart),
        saveRemoteFavorites(user, mergedFavorites),
      ]);
    } catch (err) {
      console.error('Error sincronizando datos del usuario:', err.message);
    } finally {
      if (runId === remoteSyncRunRef.current) {
        remoteSyncReadyRef.current = true;
      }
    }
  }, []);

  const applySessionUser = useCallback((user) => {
    remoteSyncRunRef.current += 1;
    remoteSyncReadyRef.current = false;

    const owner = getStorageOwner(user);
    const localCart = readLocalCart(owner);
    const localFavorites = readLocalFavorites(owner);

    if (user) {
      localStorage.setItem('lh_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('lh_user');
      localStorage.removeItem('lh_cart_guest');
      localStorage.removeItem('lh_favorites_guest');
    }

    setCurrentUser(user);
    setStorageOwner(owner);
    setCart(localCart);
    setFavorites(localFavorites);

    if (user?.id && isSupabaseConfigured) {
      syncUserDataFromRemote(user, localCart, localFavorites);
    }
  }, [syncUserDataFromRemote]);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setCatalogStatus((current) => ({ ...current, loading: true, error: null }));

      try {
        const result = await fetchCatalogProducts();
        if (cancelled) return;

        if (result.products.length > 0) {
          setProducts(result.products);
          setCatalogStatus({ loading: false, source: result.source, error: null });
          return;
        }

        setProducts([]);
        setCatalogStatus({
          loading: false,
          source: result.source,
          error: 'No hay productos activos disponibles en el catálogo.',
        });
      } catch (err) {
        if (cancelled) return;
        console.error('Error cargando productos desde Supabase:', err.message);
        setProducts([]);
        setCatalogStatus({ loading: false, source: 'supabase', error: err.message });
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;

    async function restoreSession() {
      try {
        const user = await getCurrentAuthUser();
        if (cancelled) return;

        if (user?.role === 'admin' && !hasAdminAccessVerified()) {
          await signOutFromSupabase();
          clearAdminAccessVerified();
          if (!cancelled) applySessionUser(null);
          return;
        }

        applySessionUser(user || null);
      } catch (err) {
        console.error('Error restaurando sesión de Supabase:', err.message);
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, [applySessionUser]);

  useEffect(() => {
    const cartKey = getCartKey(storageOwner);
    if (!cartKey) return;
    localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, storageOwner]);

  useEffect(() => {
    const favKey = getFavoritesKey(storageOwner);
    if (!favKey) return;
    localStorage.setItem(favKey, JSON.stringify(favorites));
  }, [favorites, storageOwner]);

  useEffect(() => {
    if (!currentUser?.id || !isSupabaseConfigured || !remoteSyncReadyRef.current) return;

    saveRemoteCart(currentUser, cart).catch((err) => {
      console.error('Error guardando carrito remoto:', err.message);
    });
  }, [cart, currentUser]);

  useEffect(() => {
    if (!currentUser?.id || !isSupabaseConfigured || !remoteSyncReadyRef.current) return;

    saveRemoteFavorites(currentUser, favorites).catch((err) => {
      console.error('Error guardando favoritos remotos:', err.message);
    });
  }, [favorites, currentUser]);

  useEffect(() => {
    localStorage.removeItem('lh_sales');
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentView, selectedProduct]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  const toggleFavorite = (productId) => {
    const listaActualizada = favorites.includes(productId)
      ? favorites.filter((id) => id !== productId)
      : [...favorites, productId];

    setFavorites(listaActualizada);
    showToast(favorites.includes(productId) ? 'Eliminado de tus favoritos.' : 'Añadido a tus favoritos.');
  };

  const addToCart = (product, quantity) => {
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.product.id === product.id);
      if (idx > -1) {
        return prev.map((item, index) =>
          index === idx
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
    const message = `Añadiste ${quantity} ${product.name} al carrito de consulta.`;
    showToast(message);
  };

  const updateCartQuantity = (productId, quantity) => {
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    showToast('Producto eliminado del carrito.');
  };

  const login = async (email, password, captchaToken = '') => {
    if (!isSupabaseConfigured) {
      throw new Error('El inicio de sesion requiere Supabase configurado.');
    }

    const user = await signInWithSupabase(email, password, {
      scope: 'customer',
      captchaToken,
    });

    if (user.role === 'admin') {
      await signOutFromSupabase();
      clearAdminAccessVerified();
      applySessionUser(null);
      throw new Error('Credenciales inválidas o usuario no confirmado.');
    }

    applySessionUser(user);
    showToast('Sesión iniciada.');
    setView('catalog');

    return true;
  };

  const register = async ({ fullName, email, password, captchaToken }) => {
    if (!isSupabaseConfigured) {
      throw new Error('El registro real requiere Supabase configurado.');
    }

    await signUpWithSupabase({
      fullName,
      email,
      password,
      captchaToken,
    });

    return true;
  };

  const logout = async () => {
    try {
      await signOutFromSupabase();
    } catch (err) {
      console.error('Error cerrando sesión de Supabase:', err.message);
    }

    clearAdminAccessVerified();
    applySessionUser(null);
    showToast('Sesión cerrada.');
    setView('home');
  };

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <Home setView={setView} products={products} setSelectedProduct={setSelectedProduct} />;
      case 'catalog':
        return <Catalog products={products} catalogStatus={catalogStatus} setView={setView} setSelectedProduct={setSelectedProduct} />;
      case 'product-detail':
        return (
          <ProductDetail
            selectedProduct={selectedProduct}
            currentUser={currentUser}
            setView={setView}
            addToCart={addToCart}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
          />
        );
      case 'cart':
        return (
          <Cart
            cart={cart}
            currentUser={currentUser}
            updateCartQuantity={updateCartQuantity}
            removeFromCart={removeFromCart}
            setView={setView}
          />
        );
      case 'account':
        return (
          <Account
            currentUser={currentUser}
            authNotice={authNotice}
            login={login}
            register={register}
            logout={logout}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            products={products}
            setView={setView}
            setSelectedProduct={setSelectedProduct}
          />
        );
      default:
        return <Home setView={setView} products={products} setSelectedProduct={setSelectedProduct} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-white text-[#0A0A0A]">
      <SplashScreen />
      <div className={currentView === 'home' ? '' : 'pt-24'}>
        <Navbar
          currentView={currentView}
          setView={setView}
          cart={cart}
          currentUser={currentUser}
          logout={logout}
        />

        {currentView !== 'catalog' && (
          <Breadcrumbs
            currentView={currentView}
            setView={setView}
            selectedProduct={selectedProduct}
          />
        )}

        <main className="transition-all duration-300">
          {renderView()}
        </main>
      </div>

      <footer className="bg-white border-t border-[#E8E8E8] py-9 px-6 mt-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.25fr_0.45fr] gap-8 text-left">
            <div className="space-y-3 max-w-md">
              <div className="flex h-20 w-20 items-center justify-center">
                <img src={logoEmpresa} alt={companyInfo.displayName} className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-[#888888]">
                  {companyInfo.specialtyLine}
                </p>
                <h3 className="font-display text-2xl font-light text-[#0A0A0A] mt-2">
                  {companyInfo.displayName}
                </h3>
              </div>
              <p className="text-[#888888] text-[11px] font-light leading-relaxed">
                {companyInfo.advisors} [{companyInfo.advisoryLabel}]
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-[#0A0A0A] text-[10px] font-medium uppercase tracking-widest">Información de contacto</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-[#3D3D3D]">
                <a
                  href={`tel:${companyInfo.primaryPhone.replace(/[^0-9]/g, '')}`}
                  className="flex items-start gap-3 border border-[#E8E8E8] p-3 hover:border-[#0A0A0A] transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 mt-0.5 text-[#888888]" />
                  <span>
                    <span className="block text-[9px] uppercase tracking-widest text-[#888888] mb-1">Teléfono</span>
                    {companyInfo.primaryPhone}
                  </span>
                </a>
                <div className="flex items-start gap-3 border border-[#E8E8E8] p-3">
                  <Smartphone className="w-3.5 h-3.5 mt-0.5 text-[#888888]" />
                  <span>
                    <span className="block text-[9px] uppercase tracking-widest text-[#888888] mb-1">Celulares</span>
                    {companyInfo.secondaryPhones.join(' / ')}
                  </span>
                </div>
                <a
                  href={`mailto:${companyInfo.email}`}
                  className="flex items-start gap-3 border border-[#E8E8E8] p-3 hover:border-[#0A0A0A] transition-colors"
                >
                  <AtSign className="w-3.5 h-3.5 mt-0.5 text-[#888888]" />
                  <span>
                    <span className="block text-[9px] uppercase tracking-widest text-[#888888] mb-1">Correo</span>
                    {companyInfo.email}
                  </span>
                </a>
                <div className="flex items-start gap-3 border border-[#E8E8E8] p-3">
                  <UsersRound className="w-3.5 h-3.5 mt-0.5 text-[#888888]" />
                  <span>
                    <span className="block text-[9px] uppercase tracking-widest text-[#888888] mb-1">Facebook</span>
                    {companyInfo.facebookProfiles.join(' / ')}
                  </span>
                </div>
                <a
                  href={companyInfo.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="sm:col-span-2 flex items-start gap-3 border border-[#E8E8E8] p-3 hover:border-[#0A0A0A] transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 mt-0.5 text-[#888888] shrink-0" />
                  <span>
                    <span className="block text-[9px] uppercase tracking-widest text-[#888888] mb-1">Ubicación</span>
                    {companyInfo.address}
                  </span>
                </a>
              </div>
            </div>

            <div className="text-[11px] font-medium uppercase tracking-widest">
              <div className="space-y-3">
                <p className="text-[#0A0A0A] text-[10px]">Tienda</p>
                <div className="space-y-1.5">
                  {['home', 'catalog', 'cart', 'account'].map((v, i) => (
                    <button key={v} onClick={() => setView(v)} className="block text-[#888888] hover:text-[#0A0A0A] transition-colors focus:outline-none">
                      {['Inicio', 'Catálogo', 'Carrito', 'Mi Cuenta'][i]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 text-white text-xs font-medium px-5 py-3.5 border border-white/10 animate-fade-in-up bg-[#0A0A0A] flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-white/70" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
