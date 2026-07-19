import { ShoppingBag, ArrowRight, Trash2, Sofa, MessageCircle, ExternalLink } from 'lucide-react';
import { buildWhatsAppLink, getProductPriceLabel } from '../lib/catalogApi';
import { createProductInquiry } from '../lib/inquiryApi';

export default function Cart({ cart, currentUser, updateCartQuantity, removeFromCart, setView }) {
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleWhatsAppInquiry = (product) => {
    createProductInquiry({ product, currentUser })
      .catch((error) => {
        console.error('No se pudo registrar la consulta:', error.message);
      });
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto px-6 pb-20">
      <div className="text-left py-8 sm:py-10 space-y-3 border-b border-[#E8E8E8] mb-8">
        <h1 className="font-display text-5xl sm:text-6xl font-light text-[#0A0A0A]">Carrito</h1>
        <p className="text-[#888888] font-light">Revisa tus piezas seleccionadas para consultarlas por WhatsApp.</p>
      </div>

      {cart.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-10">
            <div className="border-y border-[#E8E8E8] divide-y divide-[#E8E8E8]">
              {cart.map((item) => {
                const whatsappLink = buildWhatsAppLink(item.product);

                return (
                  <div key={item.product.id} className="py-6 grid grid-cols-1 sm:grid-cols-[96px_1fr_auto] items-center gap-6">
                    <div className="w-24 h-24 overflow-hidden bg-[#F2F2F2] flex items-center justify-center relative flex-shrink-0">
                      {item.product.image ? (
                        <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Sofa className="w-10 h-10 text-[#C8C8C8] stroke-[1.5]" />
                      )}
                    </div>

                    <div className="text-left">
                      <p className="text-[10px] text-[#888888] font-light uppercase tracking-widest mb-2">{item.product.category}</p>
                      <h3 className="font-display text-3xl font-light text-[#0A0A0A]">{item.product.name}</h3>
                      {(item.product.providerName || item.product.sku) && (
                        <p className="text-[9px] text-[#888888] uppercase tracking-widest mt-2">
                          {[item.product.providerName, item.product.sku ? `SKU ${item.product.sku}` : null].filter(Boolean).join(' / ')}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-5 mt-5">
                        <div className="flex items-center border border-[#C8C8C8] bg-white h-10 w-28 justify-between px-3">
                          <button
                            onClick={() => updateCartQuantity(item.product.id, Math.max(1, item.quantity - 1))}
                            className="text-[#888888] hover:text-[#0A0A0A] focus:outline-none"
                          >
                            -
                          </button>
                          <span className="text-[#0A0A0A] font-medium text-sm">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                            className="text-[#888888] hover:text-[#0A0A0A] focus:outline-none"
                          >
                            +
                          </button>
                        </div>
                        <span className="text-[#0A0A0A] font-medium text-sm whitespace-nowrap">
                          {getProductPriceLabel(item.product)}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-4">
                        {whatsappLink ? (
                          <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => handleWhatsAppInquiry(item.product)}
                            className="btn-outline inline-flex items-center justify-center gap-2 px-4 h-10 text-[9px] font-medium uppercase tracking-widest"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Preguntar por WhatsApp
                          </a>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="btn-outline inline-flex items-center justify-center gap-2 px-4 h-10 text-[9px] font-medium uppercase tracking-widest opacity-50 cursor-not-allowed"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp no configurado
                          </button>
                        )}

                        {item.product.productUrl && (
                          <a
                            href={item.product.productUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-outline inline-flex items-center justify-center gap-2 px-4 h-10 text-[9px] font-medium uppercase tracking-widest"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Ver proveedor
                          </a>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-2.5 text-[#888888] hover:text-[#0A0A0A] hover:bg-[#F2F2F2] transition-all focus:outline-none justify-self-start sm:justify-self-end"
                      title="Eliminar producto"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border border-[#E8E8E8] p-6 text-left">
              <h3 className="text-sm font-medium text-[#0A0A0A] mb-4 flex items-center gap-2 uppercase tracking-widest">
                <MessageCircle className="w-5 h-5" />
                Consulta de productos
              </h3>
              <p className="text-[#888888] text-sm leading-7 font-light">
                La atencion se coordina directamente con Galerias por WhatsApp o en tienda. Usa el boton de cada producto para preguntar por precio, disponibilidad y tiempos de entrega.
              </p>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="border border-[#E8E8E8] p-6 text-left space-y-6 sticky top-28">
              <h3 className="text-sm font-medium text-[#0A0A0A] border-b border-[#E8E8E8] pb-4 uppercase tracking-widest">
                Resumen de Consulta
              </h3>

              <div className="space-y-4 text-sm text-[#888888]">
                <div className="flex justify-between">
                  <span>Productos</span>
                  <span className="text-[#0A0A0A] font-medium">{totalItems}</span>
                </div>
                <div className="bg-[#F2F2F2] border border-[#E8E8E8] p-3 text-xs text-[#3D3D3D] font-light leading-6">
                  Este carrito funciona como lista de consulta y no procesa pagos dentro del sitio.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setView('catalog')}
                className="btn-primary w-full inline-flex items-center justify-center gap-2 py-4 font-medium text-xs uppercase tracking-widest focus:outline-none"
              >
                Seguir explorando
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-[#E8E8E8] p-16 text-center space-y-6 max-w-md mx-auto">
          <div className="w-16 h-16 border border-[#C8C8C8] flex items-center justify-center mx-auto text-[#0A0A0A]">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h3 className="font-display text-4xl font-light text-[#0A0A0A]">El carrito está vacío</h3>
            <p className="text-[#888888] text-sm leading-relaxed">
              No tienes ningún mueble seleccionado para consulta actualmente.
            </p>
          </div>
          <button onClick={() => setView('catalog')} className="btn-primary px-6 py-3 font-medium text-xs uppercase tracking-widest focus:outline-none">
            Explorar Catálogo
          </button>
        </div>
      )}
    </div>
  );
}
