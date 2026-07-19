import { buildProductInquiryMessage } from './catalogApi';
import { isSupabaseConfigured, supabase } from './supabaseClient';

export async function createProductInquiry({ product, currentUser, channel = 'whatsapp' }) {
  if (!isSupabaseConfigured || !product?.id) return null;

  const message = buildProductInquiryMessage(product);
  const customerName = currentUser?.name || currentUser?.email || 'Visitante web';

  const { error } = await supabase
    .from('product_inquiries')
    .insert({
      product_id: product.id,
      provider_id: product.providerId || null,
      user_id: currentUser?.id || null,
      customer_name: customerName,
      customer_email: currentUser?.email || null,
      message,
      preferred_channel: channel,
      status: 'new',
      metadata: {
        sku: product.sku || null,
        productName: product.name || null,
        providerName: product.providerName || null,
        productUrl: product.productUrl || null,
        pageUrl: window.location.href,
      },
    });

  if (error) throw error;
  return true;
}
