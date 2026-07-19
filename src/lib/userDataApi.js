import { mapProductFromSupabase } from './catalogApi';
import { isSupabaseConfigured, supabase } from './supabaseClient';

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistableProductId(productId) {
  return typeof productId === 'string' && UUID_PATTERN.test(productId);
}

function normalizeQuantity(value) {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
}

async function getActiveCart(createIfMissing = false, userId = null) {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('carts')
    .select('id')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data || !createIfMissing) return data;

  const { data: insertedCart, error: insertError } = await supabase
    .from('carts')
    .insert({ user_id: userId, status: 'active' })
    .select('id')
    .single();

  if (insertError) throw insertError;
  return insertedCart;
}

export async function fetchRemoteFavorites() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('favorites')
    .select('product_id')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => row.product_id).filter(isPersistableProductId);
}

export async function saveRemoteFavorites(user, favoriteIds) {
  if (!isSupabaseConfigured || !user?.id) return;

  const uniqueIds = [...new Set(favoriteIds.filter(isPersistableProductId))];

  const { error: deleteError } = await supabase
    .from('favorites')
    .delete()
    .eq('user_id', user.id);

  if (deleteError) throw deleteError;
  if (uniqueIds.length === 0) return;

  const rows = uniqueIds.map((productId) => ({
    user_id: user.id,
    product_id: productId,
  }));

  const { error: insertError } = await supabase.from('favorites').insert(rows);
  if (insertError) throw insertError;
}

export async function fetchRemoteCart() {
  if (!isSupabaseConfigured) return [];

  const activeCart = await getActiveCart(false);
  if (!activeCart?.id) return [];

  const { data, error } = await supabase
    .from('cart_items')
    .select(`quantity, products (${PRODUCT_SELECT})`)
    .eq('cart_id', activeCart.id)
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || [])
    .filter((item) => item.products?.id && isPersistableProductId(item.products.id))
    .map((item) => ({
      product: mapProductFromSupabase(item.products),
      quantity: normalizeQuantity(item.quantity),
    }));
}

export async function saveRemoteCart(user, cartItems) {
  if (!isSupabaseConfigured || !user?.id) return;

  const rows = cartItems
    .filter((item) => isPersistableProductId(item.product?.id))
    .map((item) => ({
      product_id: item.product.id,
      quantity: normalizeQuantity(item.quantity),
      unit_price: null,
    }));

  const activeCart = await getActiveCart(rows.length > 0, user.id);
  if (!activeCart?.id) return;

  const { error: deleteError } = await supabase
    .from('cart_items')
    .delete()
    .eq('cart_id', activeCart.id);

  if (deleteError) throw deleteError;
  if (rows.length === 0) return;

  const { error: insertError } = await supabase
    .from('cart_items')
    .insert(rows.map((row) => ({ ...row, cart_id: activeCart.id })));

  if (insertError) throw insertError;
}
