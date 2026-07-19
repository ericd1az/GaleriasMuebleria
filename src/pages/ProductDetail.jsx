import { useState, useEffect } from 'react';
import { ShoppingBag, ArrowLeft, Heart, Sparkles, Package, CheckCircle, Sofa, Loader2, MessageCircle, ExternalLink } from 'lucide-react';
import { buildWhatsAppLink, getProductPriceLabel } from '../lib/catalogApi';
import { createProductInquiry } from '../lib/inquiryApi';

const BadgeTag = ({ tag }) => {
  if (!tag) return null;
  return <span className="text-[10px] font-medium uppercase tracking-widest px-2.5 py-1 bg-white text-[#0A0A0A] border border-[#E8E8E8]">{tag}</span>;
};

function cargarDetalleProducto(producto) {
  return new Promise((resolve, reject) => {
    if (!producto) {
      reject(new Error('Producto no encontrado.'));
      return;
    }
    setTimeout(() => {
      resolve(producto);
    }, 500);
  });
}

export default function ProductDetail({ selectedProduct, currentUser, setView, addToCart, favorites = [], toggleFavorite }) {
  const [quantity, setQuantity] = useState(1);
  const [addedAnimation, setAddedAnimation] = useState(false);
  const [detalleCargado, setDetalleCargado] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadTimer = setTimeout(() => {
      setDetalleCargado(false);
      cargarDetalleProducto(selectedProduct)
        .then(() => {
          if (!cancelled) setDetalleCargado(true);
        })
        .catch(() => {
          if (!cancelled) setDetalleCargado(true);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(loadTimer);
    };
  }, [selectedProduct]);

  if (!selectedProduct) {
    return (
      <div className="text-center py-20 animate-fade-in-up">
        <p className="text-[#888888] mb-4">No se ha seleccionado ningún producto.</p>
        <button onClick={() => setView('catalog')}
          className="btn-primary px-6 py-3 text-xs font-medium uppercase tracking-widest focus:outline-none">
          Volver al Catálogo
        </button>
      </div>
    );
  }

  if (!detalleCargado) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in">
        <Loader2 className="animate-spin w-10 h-10 text-[#0A0A0A]" />
        <p className="text-[#888888] text-sm font-light tracking-wide">Cargando detalles del producto...</p>
      </div>
    );
  }

  const isFavorite = favorites.includes(selectedProduct.id);
  const whatsappLink = buildWhatsAppLink(selectedProduct);

  const handleAddToCart = () => {
    addToCart(selectedProduct, quantity);
    setAddedAnimation(true);
    setTimeout(() => setAddedAnimation(false), 1500);
  };

  const handleWhatsAppInquiry = () => {
    createProductInquiry({ product: selectedProduct, currentUser })
      .catch((error) => {
        console.error('No se pudo registrar la consulta:', error.message);
      });
  };

  const stockStatus = () => {
    if (!selectedProduct.stock && selectedProduct.stock !== 0) return null;
    if (selectedProduct.stock === 0) return { text: 'Sin stock' };
    if (selectedProduct.stock <= 5) return { text: `Solo ${selectedProduct.stock} disponibles` };
    return { text: `${selectedProduct.stock} en stock` };
  };
  const stock = stockStatus();

  return (
    <div className="animate-fade-in-up max-w-7xl mx-auto px-6 pb-20 pt-5">
      <button onClick={() => setView('catalog')}
        className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-[#888888] hover:text-[#0A0A0A] mb-8 transition-colors focus:outline-none">
        <ArrowLeft className="w-4 h-4" />
        Volver al catálogo
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
        <div className="lg:col-span-7">
          <div className="relative overflow-hidden aspect-[4/3] border border-[#E8E8E8] bg-[#F2F2F2]">
            {selectedProduct.image ? (
              <img
                src={selectedProduct.image}
                alt={selectedProduct.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#F2F2F2] text-[#C8C8C8]">
                <Sofa className="w-24 h-24 stroke-[1]" />
              </div>
            )}

            <button onClick={() => toggleFavorite(selectedProduct.id)}
              className="absolute top-5 right-5 w-11 h-11 bg-white border border-[#E8E8E8] flex items-center justify-center hover:scale-105 active:scale-95 transition-all focus:outline-none"
              aria-label="Favorito">
              <Heart className={`w-5 h-5 transition-colors ${isFavorite ? 'fill-[#0A0A0A] text-[#0A0A0A]' : 'text-[#888888]'}`} />
            </button>

            {selectedProduct.tag && (
              <div className="absolute top-5 left-5">
                <BadgeTag tag={selectedProduct.tag} />
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 text-left flex flex-col space-y-9">
          <div className="space-y-5">
            <span className="inline-block text-[10px] font-medium uppercase tracking-widest text-[#888888]">
              {[selectedProduct.category, selectedProduct.providerName, selectedProduct.sku ? `SKU ${selectedProduct.sku}` : null].filter(Boolean).join(' / ')}
            </span>

            <h1 className="font-display text-4xl sm:text-6xl font-light text-[#0A0A0A] leading-none">
              {selectedProduct.name}
            </h1>

            <p className="text-[#888888] text-xs font-light uppercase tracking-widest">{selectedProduct.subtitle}</p>

            <div className="flex flex-wrap items-end gap-4">
              <span className="text-3xl font-medium text-[#0A0A0A]">
                {getProductPriceLabel(selectedProduct)}
              </span>
              {stock && (
                <span className="text-[10px] font-medium uppercase tracking-widest px-2.5 py-1 border border-[#E8E8E8] text-[#3D3D3D]">
                  <Package className="w-3 h-3 inline mr-1" />
                  {stock.text}
                </span>
              )}
            </div>

            <div className="border-t border-[#E8E8E8] pt-7">
              <h3 className="text-[10px] font-medium uppercase tracking-widest text-[#888888] mb-4">Descripción</h3>
              <p className="text-[#3D3D3D] text-sm leading-8 font-light">
                {selectedProduct.description || 'Producto de proveedor disponible para consulta. Un asesor puede confirmar disponibilidad, medidas, acabados y opciones antes de continuar.'}
              </p>
            </div>
          </div>

          <div className="border-t border-[#E8E8E8] pt-7 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center border border-[#C8C8C8] bg-white h-14 w-32 justify-between px-4">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="text-[#888888] hover:text-[#0A0A0A] text-xl font-light focus:outline-none w-7 h-7 flex items-center justify-center">-</button>
                <span className="text-[#0A0A0A] font-medium text-base">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)}
                  className="text-[#888888] hover:text-[#0A0A0A] text-xl font-light focus:outline-none w-7 h-7 flex items-center justify-center">+</button>
              </div>

              <button onClick={handleAddToCart}
                className={`btn-primary flex-grow inline-flex items-center justify-center gap-2 h-14 text-[10px] font-medium uppercase tracking-widest focus:outline-none transition-all ${addedAnimation ? 'scale-95' : ''}`}>
                {addedAnimation ? (
                  <><CheckCircle className="w-4 h-4" /><span>Añadido</span></>
                ) : (
                  <><ShoppingBag className="w-4 h-4" /><span>Añadir al Carrito</span></>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {whatsappLink ? (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={handleWhatsAppInquiry}
                  className="btn-primary inline-flex items-center justify-center gap-2 h-14 text-[10px] font-medium uppercase tracking-widest"
                >
                  <MessageCircle className="w-4 h-4" />
                  Consultar por WhatsApp
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="btn-outline inline-flex items-center justify-center gap-2 h-14 text-[10px] font-medium uppercase tracking-widest opacity-50 cursor-not-allowed"
                >
                  <MessageCircle className="w-4 h-4" />
                  Consultar disponibilidad
                </button>
              )}

              {selectedProduct.productUrl && (
                <a
                  href={selectedProduct.productUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-outline inline-flex items-center justify-center gap-2 h-14 text-[10px] font-medium uppercase tracking-widest"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver proveedor
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-0 border border-[#E8E8E8]">
            {[
              { icon: <MessageCircle className="w-5 h-5" />, label: 'Consulta directa' },
              { icon: <CheckCircle className="w-5 h-5" />, label: 'Disponibilidad a confirmar' },
              { icon: <Sparkles className="w-5 h-5" />, label: 'Asesoría personalizada' },
            ].map((f, i) => (
              <div key={i} className="flex flex-col items-center text-center p-4 gap-2 border-r last:border-r-0 border-[#E8E8E8]">
                <div className="text-[#0A0A0A]">{f.icon}</div>
                <span className="text-[9px] text-[#888888] font-medium uppercase tracking-widest">{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
