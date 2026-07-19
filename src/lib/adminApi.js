import { mapProductFromSupabase } from './catalogApi';
import { isSupabaseConfigured, supabase } from './supabaseClient';

const PAGE_SIZE = 1000;
const ADMIN_PRODUCT_SELECT = `
  id,
  provider_id,
  sku,
  name,
  subtitle,
  description,
  category,
  category_key,
  image_url,
  gallery,
  product_url,
  specs,
  tags,
  stock_quantity,
  status,
  source_hash,
  last_seen_at,
  metadata,
  providers (
    provider_key,
    name
  )
`;

const ADMIN_INQUIRY_SELECT = `
  id,
  customer_name,
  customer_email,
  customer_phone,
  message,
  preferred_channel,
  status,
  created_at,
  metadata,
  products (
    sku,
    name
  ),
  providers (
    name
  )
`;

export async function fetchAdminProducts() {
  if (!isSupabaseConfigured) return [];

  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('products')
      .select(ADMIN_PRODUCT_SELECT)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    rows.push(...(data || []));

    if (!data || data.length < PAGE_SIZE) break;
  }

  return rows.map(mapProductFromSupabase);
}

export async function fetchProductInquiries() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('product_inquiries')
    .select(ADMIN_INQUIRY_SELECT)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return (data || []).map((inquiry) => ({
    id: inquiry.id,
    customerName: inquiry.customer_name,
    customerEmail: inquiry.customer_email,
    message: inquiry.message,
    channel: inquiry.preferred_channel,
    status: inquiry.status,
    createdAt: inquiry.created_at,
    productName: inquiry.products?.name || inquiry.metadata?.productName || 'Producto',
    sku: inquiry.products?.sku || inquiry.metadata?.sku || '',
    providerName: inquiry.providers?.name || inquiry.metadata?.providerName || 'Proveedor',
  }));
}
