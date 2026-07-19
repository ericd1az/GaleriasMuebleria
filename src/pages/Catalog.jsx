import { useState, useEffect, useMemo } from 'react';
import { Search, SlidersHorizontal, ArrowUpDown, Tag, Sofa, Loader2, ArrowRight, ChevronRight, Building2 } from 'lucide-react';
import { getProductPriceLabel } from '../lib/catalogApi';
import coasterLogo from '../assets/providers/coaster.png';

const PROVIDER_DETAILS = {
  coaster: {
    logo: coasterLogo,
    name: 'Coaster Furniture',
    location: 'Estados Unidos',
    description:
      'Proveedor de mobiliario residencial con una amplia variedad de recamaras, comedores, salas, acentos y piezas para el hogar.',
  },
};

const BadgeTag = ({ tag }) => {
  if (!tag) return null;
  return (
    <span className="text-[8px] font-medium uppercase tracking-widest px-2 py-1 bg-[#F2F2F2] text-[#0A0A0A] border border-[#E8E8E8]">
      {tag}
    </span>
  );
};

function simularCargaProductos(productos) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(productos || []);
    }, 700);
  });
}

function getProviderKey(product) {
  return product.providerKey || product.providerName || 'sin-proveedor';
}

function getCatalogSearchText(product, includeProvider) {
  return [
    product.name,
    product.sku,
    includeProvider ? product.providerName : null,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export default function Catalog({ products, catalogStatus, setView, setSelectedProduct }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [sortBy, setSortBy] = useState('default');
  const [selectedProviderKey, setSelectedProviderKey] = useState(null);
  const [catalogoCargado, setCatalogoCargado] = useState(false);
  const [errorCatalogo, setErrorCatalogo] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadTimer = setTimeout(() => {
      setCatalogoCargado(false);
      setErrorCatalogo('');
      simularCargaProductos(products)
        .then(() => {
          if (!cancelled) setCatalogoCargado(true);
        })
        .catch((err) => {
          if (!cancelled) {
            setErrorCatalogo(err.message);
            setCatalogoCargado(true);
          }
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(loadTimer);
    };
  }, [products]);

  const providerSummaries = useMemo(() => {
    const providers = new Map();

    products.forEach((product) => {
      const key = getProviderKey(product);
      const details = PROVIDER_DETAILS[key] || {};
      const current = providers.get(key) || {
        key,
        name: details.name || product.providerName || 'Proveedor',
        logo: details.logo || null,
        location: details.location || 'Proveedor de catálogo',
        description:
          details.description ||
          'Colección de productos seleccionados por Galerias Muebles y Decoraciones para ampliar las opciones del catálogo.',
        total: 0,
        categories: new Set(),
      };

      current.total += 1;
      if (product.category) current.categories.add(product.category);
      providers.set(key, current);
    });

    return [...providers.values()]
      .map((provider) => ({
        ...provider,
        categories: [...provider.categories].sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const selectedProviderExists =
    selectedProviderKey === 'all' ||
    providerSummaries.some((provider) => provider.key === selectedProviderKey);
  const activeProviderKey = selectedProviderKey && selectedProviderExists ? selectedProviderKey : null;
  const selectedProvider = providerSummaries.find((provider) => provider.key === activeProviderKey);
  const isAllProductsView = activeProviderKey === 'all';
  const scopedProducts = activeProviderKey && !isAllProductsView
    ? products.filter((product) => getProviderKey(product) === activeProviderKey)
    : products;

  const categories = ['Todos', ...new Set(scopedProducts.map((p) => p.category))];

  const filteredProducts = scopedProducts
    .filter((prod) => {
      const matchSearch = getCatalogSearchText(prod, isAllProductsView).includes(searchTerm.toLowerCase());
      const matchCat = selectedCategory === 'Todos' || prod.category === selectedCategory;
      return matchSearch && matchCat;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0;
    });

  const openProviderCatalog = (providerKey) => {
    setSelectedProviderKey(providerKey);
    setSelectedCategory('Todos');
    setSearchTerm('');
    setSortBy('default');
  };

  const openProviderPicker = () => {
    setSelectedProviderKey(null);
    setSelectedCategory('Todos');
    setSearchTerm('');
    setSortBy('default');
  };

  if (!catalogoCargado) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
        <Loader2 className="w-10 h-10 animate-spin text-[#0A0A0A]" />
        <p className="text-[#888888] text-sm font-light tracking-wide">Cargando el catálogo...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="animate-fade-in-up max-w-7xl mx-auto px-6 pb-24">
        <div className="text-left py-8 sm:py-10 space-y-4 border-b border-[#E8E8E8] mb-8">
          <span className="text-[10px] font-medium uppercase tracking-widest block text-[#888888]">
            Catálogo
          </span>
          <h1 className="font-display text-5xl sm:text-6xl font-light text-[#0A0A0A] leading-none">
            Catálogo no disponible
          </h1>
          <p className="text-[#3D3D3D] font-light text-sm max-w-2xl leading-7">
            No hay productos reales cargados para mostrar en este momento.
          </p>
        </div>

        <div className="border border-[#E8E8E8] p-12 text-center space-y-5 max-w-lg mx-auto">
          <div className="w-14 h-14 border border-[#C8C8C8] flex items-center justify-center mx-auto text-[#0A0A0A]">
            <Tag className="w-6 h-6" />
          </div>
          <h2 className="font-display text-3xl font-light text-[#0A0A0A]">Sin productos cargados</h2>
          <p className="text-[#888888] text-xs leading-relaxed">
            {catalogStatus?.error || 'Revisa la conexión con Supabase o importa productos desde el proveedor.'}
          </p>
          <button
            type="button"
            onClick={() => setView('home')}
            className="btn-primary px-6 py-3 font-medium text-xs uppercase tracking-widest focus:outline-none"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (!activeProviderKey) {
    return (
      <div className="animate-fade-in-up max-w-7xl mx-auto px-6 pb-24">
        <div className="text-left py-8 sm:py-10 space-y-4 border-b border-[#E8E8E8] mb-8">
          <span className="text-[10px] font-medium uppercase tracking-widest block text-[#888888]">
            Catálogo
          </span>
          <h1 className="font-display text-5xl sm:text-6xl font-light text-[#0A0A0A] leading-none">
            Catálogo de proveedores
          </h1>
          <p className="text-[#3D3D3D] font-light text-sm max-w-2xl leading-7">
            Explora el catálogo por proveedor para ver sus productos y categorías, o consulta toda la colección en una sola vista.
          </p>
          {catalogStatus?.source === 'supabase' && (
            <p className="text-[10px] uppercase tracking-widest text-[#888888]">
              Catálogo de proveedores actualizado
            </p>
          )}
          {catalogStatus?.error && (
            <p className="text-xs text-[#888888]">
              No se pudo actualizar el catálogo desde Supabase.
            </p>
          )}
        </div>

        <div className="space-y-6">
          <button
            type="button"
            onClick={() => openProviderCatalog('all')}
            className="group w-full bg-[#0A0A0A] text-white px-5 py-4 sm:px-6 text-left flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 focus:outline-none"
          >
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-11 h-11 border border-white/25 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-[9px] uppercase tracking-widest text-white/55">Vista completa</p>
                <h2 className="font-display text-2xl sm:text-3xl font-light leading-tight">Todos los productos</h2>
                <p className="text-white/65 text-xs sm:text-sm leading-6">
                  Ver toda la colección sin separar por proveedor.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest font-medium whitespace-nowrap">
              Ver colección completa
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {providerSummaries.map((provider) => (
              <button
                key={provider.key}
                type="button"
                onClick={() => openProviderCatalog(provider.key)}
                className="group border border-[#E8E8E8] bg-white text-left p-7 min-h-72 hover:border-[#0A0A0A] transition-colors focus:outline-none flex flex-col justify-between"
              >
                <div className="space-y-6">
                  <div className="h-20 w-28 border border-[#E8E8E8] bg-[#F7F7F7] flex items-center justify-center overflow-hidden">
                    {provider.logo ? (
                      <img src={provider.logo} alt={provider.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-3xl font-light text-[#0A0A0A]">
                        {provider.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-[#888888] mb-2">{provider.location}</p>
                    <h2 className="font-display text-4xl font-light text-[#0A0A0A] leading-tight">{provider.name}</h2>
                    <p className="text-[#3D3D3D] text-sm leading-7 font-light mt-4">{provider.description}</p>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-[#E8E8E8] flex flex-col gap-3">
                  <p className="text-[10px] uppercase tracking-widest text-[#888888]">
                    {provider.total} productos · {provider.categories.length} categorías
                  </p>
                  <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest font-medium text-[#0A0A0A]">
                    Ver catálogo
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up max-w-7xl mx-auto px-6 pb-24">
      <div className="pt-4 flex flex-wrap items-center gap-2 text-xs text-[#888888]">
        <button onClick={openProviderPicker} className="hover:text-[#0A0A0A] transition-colors focus:outline-none">
          Proveedores
        </button>
        <ChevronRight className="w-4 h-4 text-[#C8C8C8]" />
        <span className="text-[#0A0A0A]">
          {isAllProductsView ? 'Todos los productos' : selectedProvider?.name}
        </span>
      </div>

      <div className="text-left py-5 sm:py-6 space-y-3 border-b border-[#E8E8E8] mb-6">
        <span className="text-[10px] font-medium uppercase tracking-widest block text-[#888888]">
          {isAllProductsView ? 'Colección completa' : 'Catálogo de proveedor'}
        </span>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div className="space-y-3">
            <h1 className="font-display text-4xl sm:text-5xl font-light text-[#0A0A0A] leading-none">
              {isAllProductsView ? 'Catálogo' : selectedProvider?.name}
            </h1>
            <p className="text-[#3D3D3D] font-light text-sm max-w-3xl leading-7">
              {filteredProducts.length} piezas encontradas
              {isAllProductsView
                ? '. Todos los proveedores reunidos en una sola colección.'
                : `. ${selectedProvider?.description || 'Productos seleccionados de este proveedor.'}`}
            </p>
          </div>
          <button
            type="button"
            onClick={openProviderPicker}
            className="self-start lg:self-auto border border-[#C8C8C8] px-5 py-3 text-[10px] font-medium uppercase tracking-widest text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white transition-colors focus:outline-none"
          >
            {isAllProductsView ? 'Regresar a proveedores' : 'Cambiar proveedor'}
          </button>
        </div>
        {catalogStatus?.source === 'supabase' && (
          <p className="text-[10px] uppercase tracking-widest text-[#888888]">
            Catálogo de proveedores actualizado
          </p>
        )}
        {catalogStatus?.error && (
          <p className="text-xs text-[#888888]">
            No se pudo actualizar el catálogo desde Supabase.
          </p>
        )}
      </div>

      <div className="bg-transparent mb-10 border-b border-[#E8E8E8] pb-6 space-y-6">
        <div className="flex flex-col lg:flex-row gap-8 items-end justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="w-4 h-4 text-[#888888] absolute left-0 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={isAllProductsView ? 'Buscar por nombre, SKU o proveedor' : 'Buscar por nombre o SKU'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-4 py-3 w-full text-xs"
            />
          </div>

          <div className="flex items-center gap-4 w-full lg:w-auto justify-end">
            <span className="text-[10px] font-medium uppercase tracking-widest text-[#888888] flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5" />Ordenar
            </span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="py-3 px-0 text-xs font-light cursor-pointer min-w-44">
              <option value="default">Recomendados</option>
              <option value="name">Alfabético</option>
            </select>
          </div>
        </div>

        <div className="pt-2">
          <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-[#888888] mb-4">
            <SlidersHorizontal className="w-3.5 h-3.5" />Categorías
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2 border text-[10px] font-medium uppercase tracking-widest transition-all focus:outline-none ${
                  selectedCategory === cat
                    ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                    : 'bg-white text-[#888888] border-[#E8E8E8] hover:text-[#0A0A0A] hover:border-[#0A0A0A]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-14">
          {filteredProducts.map((prod) => (
            <button
              key={prod.id}
              onClick={() => { setSelectedProduct(prod); setView('product-detail'); }}
              className="product-card cursor-pointer group flex flex-col text-left focus:outline-none"
            >
              <div className="relative h-72 overflow-hidden bg-[#F2F2F2]">
                {prod.image ? (
                  <img src={prod.image} alt={prod.name} className="product-img object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[#F2F2F2] text-[#C8C8C8]">
                    <Sofa className="w-12 h-12 stroke-[1.5]" />
                  </div>
                )}

                <div className="absolute top-3 left-3 flex flex-col gap-1">
                  <BadgeTag tag={prod.tag} />
                </div>

                {prod.stock !== undefined && prod.stock <= 5 && (
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-1 bg-white text-[#0A0A0A] border border-[#E8E8E8] text-[8px] font-medium tracking-widest uppercase">
                      Stock {prod.stock}
                    </span>
                  </div>
                )}

                <div className="absolute inset-x-3 bottom-3 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                  <span className="block w-full bg-white text-[#0A0A0A] py-3 text-center text-[9px] font-medium uppercase tracking-widest">
                    Ver Producto
                  </span>
                </div>
              </div>

              <div className="py-5 flex flex-col flex-grow text-left space-y-3">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-[#888888] mb-2">{prod.category}</p>
                  <h3 className="font-display text-2xl font-light text-[#0A0A0A] leading-tight">{prod.name}</h3>
                  <p className="text-[#888888] text-xs font-light mt-1 line-clamp-1">{prod.subtitle}</p>
                  {(prod.sku || prod.providerName) && (
                    <p className="text-[9px] uppercase tracking-widest text-[#888888] mt-3">
                      {[prod.providerName, prod.sku ? `SKU ${prod.sku}` : null].filter(Boolean).join(' / ')}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-[#E8E8E8] mt-auto">
                  <span className="text-sm font-medium text-[#0A0A0A]">{getProductPriceLabel(prod)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="border border-[#E8E8E8] p-16 text-center space-y-5 max-w-sm mx-auto">
          <div className="w-14 h-14 border border-[#C8C8C8] flex items-center justify-center mx-auto text-[#0A0A0A]">
            <Tag className="w-6 h-6" />
          </div>
          <h3 className="font-display text-3xl font-light text-[#0A0A0A]">Sin resultados</h3>
          <p className="text-[#888888] text-xs leading-relaxed">No encontramos muebles con esos criterios. Prueba otra búsqueda.</p>
          {errorCatalogo && <p className="text-[#3D3D3D] text-xs">{errorCatalogo}</p>}
          <button onClick={() => { setSearchTerm(''); setSelectedCategory('Todos'); }}
            className="btn-primary px-6 py-3 font-medium text-xs uppercase tracking-widest focus:outline-none">
            Limpiar filtros
          </button>
        </div>
      )}
    </div>
  );
}
