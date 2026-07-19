import { isSupabaseConfigured, supabase } from './supabaseClient';

const SUPABASE_PAGE_SIZE = 1000;
const PRODUCT_SELECT = `
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

export function mapProductFromSupabase(row) {
  const provider = row.providers || {};
  const providerName = provider.name || row.metadata?.originalProvider || 'Proveedor';
  const sku = row.sku || '';

  return {
    id: row.id,
    providerId: row.provider_id,
    providerName,
    providerKey: provider.provider_key || null,
    sku,
    name: row.name || sku,
    subtitle: row.subtitle || [providerName, sku ? `SKU ${sku}` : null].filter(Boolean).join(' - '),
    price: null,
    currency: 'MXN',
    category: row.category || 'Catalogo',
    categoryKey: row.category_key || null,
    image: row.image_url || '',
    gallery: Array.isArray(row.gallery) ? row.gallery : [],
    productUrl: row.product_url || '',
    specs: row.specs || {},
    stock: row.stock_quantity,
    tag: row.tags?.[0] || providerName,
    description:
      row.description ||
      `Producto del catalogo de ${providerName}. Consulta disponibilidad, precio y tiempos de entrega con Galerias Muebles y Decoraciones.`,
    status: row.status,
    sourceHash: row.source_hash,
    lastSeenAt: row.last_seen_at,
    isSupplierProduct: true,
  };
}

export async function fetchCatalogProducts() {
  if (!isSupabaseConfigured) {
    return {
      products: [],
      source: 'unconfigured',
      error: 'Supabase no está configurado.',
    };
  }

  const rows = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('status', 'active')
      .order('category', { ascending: true })
      .order('name', { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    rows.push(...(data || []));

    if (!data || data.length < SUPABASE_PAGE_SIZE) {
      break;
    }
  }

  return {
    products: rows.map(mapProductFromSupabase),
    source: 'supabase',
    error: null,
  };
}

export function getProductPriceLabel() {
  return 'Consultar precio';
}

export function getProductSearchText(product) {
  return [
    product.name,
    product.subtitle,
    product.category,
    product.providerName,
    product.sku,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function buildProductInquiryMessage(product) {
  return [
    'Hola, me interesa este producto de Galerias Muebles y Decoraciones:',
    product.name ? `Producto: ${product.name}` : null,
    product.sku ? `SKU: ${product.sku}` : null,
    product.providerName ? `Proveedor: ${product.providerName}` : null,
    product.productUrl ? `Link proveedor: ${product.productUrl}` : null,
    'Me gustaria consultar precio, disponibilidad y tiempo de entrega.',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildWhatsAppLink(product) {
  const rawPhone = import.meta.env.VITE_STORE_WHATSAPP || '';
  const phone = rawPhone.replace(/\D/g, '');
  if (!phone) return '';

  return `https://wa.me/${phone}?text=${encodeURIComponent(buildProductInquiryMessage(product))}`;
}
