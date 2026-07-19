import { useMemo, useState } from 'react';
import {
  BarChart3,
  Building2,
  DollarSign,
  FolderOpen,
  MessageCircle,
  Search,
  Sofa,
  TableProperties,
} from 'lucide-react';
import { getProductSearchText } from '../lib/catalogApi';
import { companyInfo } from '../data/companyInfo';
import logoEmpresa from '../assets/branding/logoempresa.png';

const PAGE_SIZE = 80;

export default function AdminDashboard({ currentUser, products, inquiries = [] }) {
  const [activeSection, setActiveSection] = useState('metrics');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const providerSummaries = useMemo(() => {
    const map = new Map();

    products.forEach((product) => {
      const name = product.providerName || 'Sin proveedor';
      const current = map.get(name) || {
        name,
        total: 0,
        active: 0,
        inactive: 0,
        categories: new Set(),
      };

      current.total += 1;
      if (product.status === 'inactive') current.inactive += 1;
      else current.active += 1;
      if (product.category) current.categories.add(product.category);

      map.set(name, current);
    });

    return [...map.values()]
      .map((provider) => ({
        ...provider,
        categories: [...provider.categories].sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch = !search || getProductSearchText(product).includes(search);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && product.status !== 'inactive') ||
        (statusFilter === 'inactive' && product.status === 'inactive');

      return matchesSearch && matchesStatus;
    });
  }, [products, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleProducts = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto py-24 px-6 text-center space-y-5 animate-fade-in">
        <div className="w-16 h-16 border border-[#C8C8C8] flex items-center justify-center mx-auto text-[#0A0A0A]">
          <DollarSign className="w-8 h-8" />
        </div>
        <h1 className="font-display text-5xl font-light text-[#0A0A0A]">Acceso Denegado</h1>
        <p className="text-[#888888] text-sm leading-7">
          Debes iniciar sesion con una cuenta de administrador para visualizar esta seccion.
        </p>
      </div>
    );
  }

  const activeProductsCount = products.filter((product) => product.status !== 'inactive').length;
  const inactiveProductsCount = products.filter((product) => product.status === 'inactive').length;
  const formatInquiryDate = (value) => {
    if (!value) return '';
    return new Intl.DateTimeFormat('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  };

  const stats = [
    { label: 'Catalogo Activo', value: activeProductsCount, icon: <FolderOpen className="w-5 h-5" /> },
    { label: 'Inactivos', value: inactiveProductsCount, icon: <TableProperties className="w-5 h-5" /> },
    { label: 'Proveedores', value: providerSummaries.length, icon: <Building2 className="w-5 h-5" /> },
    { label: 'Consultas', value: inquiries.length, icon: <MessageCircle className="w-5 h-5" /> },
  ];

  const navItems = [
    { id: 'metrics', label: 'Metricas', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'inventory', label: 'Inventario', icon: <TableProperties className="w-4 h-4" /> },
    { id: 'inquiries', label: 'Consultas', icon: <MessageCircle className="w-4 h-4" /> },
    { id: 'providers', label: 'Proveedores', icon: <Building2 className="w-4 h-4" /> },
  ];

  const sectionTitles = {
    metrics: 'Metricas',
    inventory: 'Inventario',
    inquiries: 'Consultas',
    providers: 'Proveedores',
  };

  const sectionSubtitles = {
    metrics: 'Resumen general del catalogo importado y actividad reciente.',
    inventory: 'Productos importados desde los catalogos de proveedores.',
    inquiries: 'Mensajes generados por clientes desde los botones de WhatsApp.',
    providers: 'Proveedores detectados dentro del catalogo importado.',
  };

  return (
    <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] min-h-[calc(100vh-5rem)]">
      <aside className="bg-[#0A0A0A] text-white p-8 lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)] lg:self-start lg:overflow-y-auto">
        <div className="space-y-10">
          <div>
            <img src={logoEmpresa} alt={companyInfo.displayName} className="h-24 w-24 object-contain" />
            <p className="text-[10px] uppercase tracking-widest text-white/55 mt-2">Administracion</p>
          </div>
          <nav className="space-y-2 text-[10px] uppercase tracking-widest font-light">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-3 border px-4 py-3 text-left transition-colors focus:outline-none ${
                  activeSection === item.id
                    ? 'border-white bg-white text-[#0A0A0A]'
                    : 'border-white/15 text-white/80 hover:border-white/40 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
          <div className="border border-white/15 p-4">
            <p className="text-[10px] uppercase tracking-widest text-white/45">Sesion</p>
            <p className="text-sm font-light mt-2 break-all">{currentUser.email}</p>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-6 lg:px-10 py-10 bg-white text-left space-y-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-[#E8E8E8] pb-8">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#888888] mb-3">Panel de Control</p>
            <h1 className="font-display text-6xl font-light text-[#0A0A0A]">{sectionTitles[activeSection]}</h1>
            <p className="text-[#888888] text-sm mt-3">
              {sectionSubtitles[activeSection]}
            </p>
          </div>
          <div className="border border-[#E8E8E8] px-4 py-2 text-[#0A0A0A] text-[10px] font-medium uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#0A0A0A]"></span>
            Modo Administrador
          </div>
        </div>

        {activeSection === 'metrics' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-0 border border-[#E8E8E8]">
            {stats.map((stat) => (
              <div key={stat.label} className="p-6 border-b sm:border-r xl:border-b-0 xl:last:border-r-0 border-[#E8E8E8] flex items-center gap-4">
                <div className="w-11 h-11 border border-[#C8C8C8] flex items-center justify-center text-[#0A0A0A] flex-shrink-0">
                  {stat.icon}
                </div>
                <div>
                  <p className="text-[#888888] text-[10px] font-medium uppercase tracking-widest">{stat.label}</p>
                  <h3 className="text-2xl font-medium text-[#0A0A0A]">{stat.value}</h3>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'inquiries' && (
          <section className="border border-[#E8E8E8] p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-4xl font-light text-[#0A0A0A]">Consultas de usuarios</h2>
                <p className="text-xs text-[#888888] mt-2">
                  Interacciones generadas desde el boton de WhatsApp.
                </p>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-[#888888]">
                {inquiries.length} registradas
              </span>
            </div>

            {inquiries.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-[#E8E8E8]">
                {inquiries.map((inquiry) => (
                  <article key={inquiry.id} className="p-5 border-b lg:border-r even:lg:border-r-0 last:border-b-0 lg:[&:nth-last-child(-n+2)]:border-b-0 border-[#E8E8E8] space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-[#888888]">
                          {formatInquiryDate(inquiry.createdAt)}
                        </p>
                        <h3 className="font-display text-2xl font-light text-[#0A0A0A] mt-1">
                          {inquiry.productName}
                        </h3>
                      </div>
                      <span className="px-2.5 py-1 border border-[#E8E8E8] text-[10px] uppercase tracking-widest text-[#3D3D3D]">
                        {inquiry.status}
                      </span>
                    </div>

                    <p className="text-[10px] uppercase tracking-widest text-[#888888]">
                      {[inquiry.providerName, inquiry.sku ? `SKU ${inquiry.sku}` : null].filter(Boolean).join(' / ')}
                    </p>
                    <p className="text-xs text-[#3D3D3D]">
                      {inquiry.customerName}{inquiry.customerEmail ? ` - ${inquiry.customerEmail}` : ''}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="border border-[#E8E8E8] p-8 text-center text-xs text-[#888888]">
                Aun no hay consultas registradas desde WhatsApp.
              </div>
            )}
          </section>
        )}

        {activeSection === 'inventory' && (
          <section className="border border-[#E8E8E8] p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
              <div>
                <h2 className="font-display text-4xl font-light text-[#0A0A0A]">Inventario de proveedores</h2>
                <p className="text-xs text-[#888888] mt-2">
                  {filteredProducts.length} productos encontrados.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-4 w-full lg:max-w-xl">
                <label className="relative">
                  <Search className="w-4 h-4 text-[#888888] absolute left-0 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, SKU o proveedor"
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                      setPage(1);
                    }}
                    className="pl-8 text-xs"
                  />
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value);
                    setPage(1);
                  }}
                  className="text-xs"
                >
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-sm text-left divide-y divide-[#E8E8E8]">
                <thead className="text-[10px] font-medium text-[#888888] uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Producto</th>
                    <th className="px-6 py-4">Categoria</th>
                    <th className="px-6 py-4">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E8] text-[#3D3D3D]">
                  {visibleProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-[#F2F2F2] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 overflow-hidden bg-[#F2F2F2] flex items-center justify-center flex-shrink-0 border border-[#E8E8E8]">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Sofa className="w-5 h-5 text-[#C8C8C8] stroke-[1.5]" />
                            )}
                          </div>
                          <div className="min-w-[220px]">
                            <p className="font-light text-[#0A0A0A]">{product.name}</p>
                            <p className="text-[10px] text-[#888888] font-light line-clamp-1">{product.subtitle}</p>
                            <p className="text-[9px] text-[#888888] uppercase tracking-widest mt-1">
                              {[product.providerName, product.sku ? `SKU ${product.sku}` : null].filter(Boolean).join(' / ')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 border border-[#E8E8E8] text-xs font-light text-[#3D3D3D]">
                          {product.category}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 border border-[#E8E8E8] text-[10px] font-light uppercase tracking-widest text-[#3D3D3D]">
                          {product.status === 'inactive' ? 'Inactivo' : 'Activo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-[#888888]">
              <span>
                Pagina {currentPage} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="btn-outline px-4 py-2 uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  className="btn-outline px-4 py-2 uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'providers' && (
          <section className="border border-[#E8E8E8] p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-4xl font-light text-[#0A0A0A]">Proveedores del catalogo</h2>
                <p className="text-xs text-[#888888] mt-2">
                  {providerSummaries.length} proveedores encontrados.
                </p>
              </div>
            </div>

            {providerSummaries.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-0 border border-[#E8E8E8]">
                {providerSummaries.map((provider) => (
                  <article key={provider.name} className="p-6 border-b xl:border-r even:xl:border-r-0 last:border-b-0 xl:[&:nth-last-child(-n+2)]:border-b-0 border-[#E8E8E8] space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-[#888888]">Proveedor</p>
                        <h3 className="font-display text-3xl font-light text-[#0A0A0A] mt-1">{provider.name}</h3>
                      </div>
                      <span className="px-2.5 py-1 border border-[#E8E8E8] text-[10px] uppercase tracking-widest text-[#3D3D3D]">
                        {provider.active} activos
                      </span>
                    </div>

                    <div className="grid grid-cols-3 border-y border-[#E8E8E8] text-center">
                      <div className="py-4 border-r border-[#E8E8E8]">
                        <p className="text-2xl font-medium text-[#0A0A0A]">{provider.total}</p>
                        <p className="text-[9px] uppercase tracking-widest text-[#888888] mt-1">Total</p>
                      </div>
                      <div className="py-4 border-r border-[#E8E8E8]">
                        <p className="text-2xl font-medium text-[#0A0A0A]">{provider.active}</p>
                        <p className="text-[9px] uppercase tracking-widest text-[#888888] mt-1">Activos</p>
                      </div>
                      <div className="py-4">
                        <p className="text-2xl font-medium text-[#0A0A0A]">{provider.inactive}</p>
                        <p className="text-[9px] uppercase tracking-widest text-[#888888] mt-1">Inactivos</p>
                      </div>
                    </div>

                    <p className="text-xs text-[#888888] leading-6">
                      {provider.categories.slice(0, 6).join(' / ') || 'Sin categorias detectadas'}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="border border-[#E8E8E8] p-8 text-center text-xs text-[#888888]">
                Aun no hay proveedores cargados.
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
