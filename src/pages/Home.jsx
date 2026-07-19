import { ArrowRight, Sparkles, ShieldCheck, HeartHandshake, Compass, MoveDown, MapPin, Layers3, Store, UsersRound, ClipboardCheck } from 'lucide-react';
import tablesImg from '../assets/tables.png';
import heroVideo from '../assets/media/elbueno.mp4';
import { companyInfo } from '../data/companyInfo';

const KNOWN_PROVIDER_DETAILS = {
  coaster: {
    initials: 'CF',
    name: 'Coaster Furniture',
    location: 'Estados Unidos',
    specialty: 'Mobiliario residencial para recamaras, comedores, salas, acentos y piezas para el hogar.',
    note: 'Catalogo activo de proveedor.',
  },
};

function getProviderKey(product) {
  return product.providerKey || product.providerName || 'proveedor';
}

function buildProviderCards(products) {
  const providers = new Map();

  products.forEach((product) => {
    const key = getProviderKey(product);
    const details = KNOWN_PROVIDER_DETAILS[key] || {};
    const current = providers.get(key) || {
      initials: details.initials || (product.providerName || 'PR').slice(0, 2).toUpperCase(),
      name: details.name || product.providerName || 'Proveedor',
      location: details.location || 'Proveedor de catalogo',
      specialty:
        details.specialty ||
        'Coleccion seleccionada para ampliar las opciones del catalogo de Galerias.',
      note: details.note || 'Proveedor detectado dentro del catalogo.',
      total: 0,
      categories: new Set(),
    };

    current.total += 1;
    if (product.category) current.categories.add(product.category);
    providers.set(key, current);
  });

  const cards = [...providers.values()].map((provider) => ({
    ...provider,
    categories: [...provider.categories],
  }));

  if (cards.length > 0) return cards;

  return Object.values(KNOWN_PROVIDER_DETAILS).map((provider) => ({
    ...provider,
    total: 0,
    categories: [],
  }));
}

export default function Home({ setView, products = [] }) {
  const values = [
    { num: '01', icon: <Sparkles className="w-5 h-5" />, title: 'Muebles de vanguardia', description: 'Diseños modernos y elegantes para salas, comedores, recamaras y piezas de acento con presencia.' },
    { num: '02', icon: <Compass className="w-5 h-5" />, title: 'Variedad para tu hogar', description: 'Opciones amplias de estilos, acabados y proveedores para encontrar piezas acordes a cada espacio.' },
    { num: '03', icon: <ShieldCheck className="w-5 h-5" />, title: 'Envios confiables', description: 'Atencion local en San Luis Rio Colorado y coordinacion de envios a distintas ciudades de Mexico.' },
    { num: '04', icon: <HeartHandshake className="w-5 h-5" />, title: 'Asesoria decorativa', description: 'Acompanamiento cercano para elegir muebles, combinar ambientes y resolver cada consulta antes de comprar.' },
  ];

  const providers = buildProviderCards(products);

  const aboutHighlights = [
    {
      icon: <Store className="w-5 h-5" />,
      title: 'Atencion en tienda',
      description: 'Recibimos a cada cliente en San Luis Rio Colorado para revisar estilos, medidas, acabados y opciones reales.'
    },
    {
      icon: <ClipboardCheck className="w-5 h-5" />,
      title: 'Pagos y seguimiento',
      description: 'Aceptamos tarjetas de credito o debito y damos seguimiento directo a cada consulta de disponibilidad.'
    },
    {
      icon: <UsersRound className="w-5 h-5" />,
      title: 'Cobertura nacional',
      description: 'Coordinamos envios confiables a diferentes puntos de la Republica Mexicana con atencion personalizada.'
    },
  ];

  return (
    <div className="animate-fade-in-up bg-white">
      <section className="relative min-h-screen overflow-hidden flex items-center justify-center text-center">
        <div className="absolute inset-0 bg-[#F2F2F2]" aria-hidden="true" />
        <video
          className="absolute inset-0 w-full h-full object-cover grayscale"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        >
          <source src={heroVideo} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/50" />

        <div className="relative z-10 px-6 max-w-5xl mx-auto text-white space-y-8">
          <h1 className="font-display font-light leading-none text-[clamp(60px,11vw,112px)]">
            {companyInfo.shortName.toUpperCase()}
          </h1>
          <p className="text-xs sm:text-sm uppercase tracking-[0.42em] font-light text-white/75">
            Espacios que inspiran. Muebles que perduran.
          </p>
          <button
            onClick={() => setView('catalog')}
            className="inline-flex items-center gap-3 px-8 py-4 border border-white text-white hover:bg-white hover:text-[#0A0A0A] transition-colors text-[10px] font-medium uppercase tracking-widest focus:outline-none"
          >
            Explorar Colección
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/70 animate-scroll-pulse">
          <MoveDown className="w-5 h-5" />
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-24 sm:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-end mb-16">
          <div className="lg:col-span-7 text-left space-y-5">
            <span className="text-[10px] font-medium uppercase tracking-widest text-[#888888] block">Filosofía</span>
            <h2 className="font-display text-5xl sm:text-7xl font-light text-[#0A0A0A] leading-none">
              Elegancia de vanguardia para vivir tu hogar.
            </h2>
          </div>
          <p className="lg:col-span-5 text-[#3D3D3D] text-sm sm:text-base leading-8 font-light">
            Galerias Muebles y Decoraciones reune mobiliario moderno, piezas de acento e ideas de interiorismo para quienes buscan amueblar con estilo, variedad y trato cercano desde San Luis Rio Colorado.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 border-y border-[#E8E8E8]">
          {values.map((val, index) => (
            <div
              key={val.num}
              className={`p-8 lg:p-10 border-b md:border-r md:last:border-r-0 lg:border-b-0 border-[#E8E8E8] text-left min-h-64 ${
                index % 2 === 0 ? 'bg-[#F7F7F7]' : 'bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-10">
                <span className="font-display text-4xl font-light text-[#C8C8C8]">{val.num}</span>
                <div className="text-[#0A0A0A]">{val.icon}</div>
              </div>
              <h3 className="text-xs font-medium text-[#0A0A0A] mb-4 uppercase tracking-widest">{val.title}</h3>
              <p className="text-[#888888] text-sm leading-7 font-light">{val.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end mb-14">
          <div className="lg:col-span-7 space-y-4 text-left">
            <span className="text-[10px] font-medium uppercase tracking-widest block text-[#888888]">Proveedores</span>
            <h2 className="font-display text-5xl sm:text-6xl font-light text-[#0A0A0A] leading-none">
              Casas aliadas de materiales y oficio.
            </h2>
          </div>
          <div className="lg:col-span-5 text-left space-y-5">
            <p className="text-[#3D3D3D] text-sm leading-8 font-light">
              Trabajamos con talleres y casas de materiales que comparten una misma idea: producir menos, elegir mejor y cuidar cada acabado.
            </p>
            <button
              onClick={() => setView('catalog')}
              className="text-[#0A0A0A] font-medium text-[10px] uppercase tracking-widest inline-flex items-center gap-2 group transition-colors focus:outline-none border-b border-[#0A0A0A] pb-1"
            >
              Ver colección final
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 border border-[#E8E8E8]">
          {providers.map((provider, index) => (
            <article
              key={provider.name}
              className={`group min-h-[300px] p-8 lg:p-10 border-b md:border-r even:md:border-r-0 last:border-b-0 md:[&:nth-last-child(-n+2)]:border-b-0 border-[#E8E8E8] text-left transition-colors hover:bg-[#EDEDED] ${
                index % 2 === 0 ? 'bg-white' : 'bg-[#F1F1F1]'
              }`}
            >
              <div className="flex items-start justify-between gap-6 mb-12">
                <div className="w-20 h-20 border border-[#0A0A0A] flex items-center justify-center bg-white">
                  <span className="font-display text-3xl font-light tracking-wide text-[#0A0A0A]">
                    {provider.initials}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-[#888888] font-light">Productos</p>
                  <p className="font-display text-3xl font-light text-[#0A0A0A]">
                    {provider.total > 0 ? provider.total : 'Activo'}
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <h3 className="font-display text-4xl font-light text-[#0A0A0A] leading-tight">{provider.name}</h3>
                  <p className="mt-3 text-[10px] uppercase tracking-widest text-[#888888] flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    {provider.location}
                  </p>
                </div>

                <div className="border-t border-[#E8E8E8] pt-5 space-y-3">
                  <p className="text-[#3D3D3D] text-sm leading-7 font-light">{provider.specialty}</p>
                  <p className="text-[#888888] text-xs leading-6 font-light flex items-start gap-2">
                    <Layers3 className="w-4 h-4 mt-0.5 text-[#0A0A0A] flex-shrink-0" />
                    <span>{provider.note}</span>
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-24 sm:pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 border-t border-[#E8E8E8] pt-24">
          <div className="lg:col-span-5">
            <div className="relative min-h-[420px] overflow-hidden bg-[#F2F2F2]">
              <img
                src={tablesImg}
                alt="Galerias Muebles y Decoraciones showroom"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/10" />
              <div className="absolute left-6 bottom-6 right-6 border border-white/40 px-5 py-4 text-white backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-widest text-white/75">Galerias Muebles y Decoraciones</p>
                <p className="font-display text-4xl font-light mt-2">Nosotros</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 text-left flex flex-col justify-between gap-12">
            <div className="space-y-6">
              <span className="text-[10px] font-medium uppercase tracking-widest block text-[#888888]">Nosotros</span>
              <h2 className="font-display text-5xl sm:text-6xl font-light text-[#0A0A0A] leading-none">
                Una muebleria elegante con atencion cercana.
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                <p className="text-[#3D3D3D] text-sm leading-8 font-light">
                  Somos una muebleria dedicada a acercar disenos modernos y de vanguardia a hogares que buscan piezas con presencia. Te ayudamos a comparar estilos, dimensiones y combinaciones para crear ambientes completos.
                </p>
                <p className="text-[#888888] text-sm leading-8 font-light">
                  Nos encuentras en Av. Kino 2da y 3ra, San Luis Rio Colorado. Atendemos por mensaje, telefono y tienda, con pagos con tarjeta y envios confiables a la Republica Mexicana.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 border-y border-[#E8E8E8]">
              {aboutHighlights.map((item) => (
                <div key={item.title} className="py-7 md:px-6 md:first:pl-0 md:last:pr-0 border-b md:border-b-0 md:border-r md:last:border-r-0 border-[#E8E8E8]">
                  <div className="text-[#0A0A0A] mb-5">{item.icon}</div>
                  <h3 className="text-xs font-medium text-[#0A0A0A] uppercase tracking-widest mb-3">{item.title}</h3>
                  <p className="text-[#888888] text-xs leading-6 font-light">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
