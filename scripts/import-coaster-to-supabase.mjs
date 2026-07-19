import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_INPUT = path.join(process.cwd(), 'data', 'imports', 'coaster-products.json');
const DEFAULT_BATCH_SIZE = 200;

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    batchSize: DEFAULT_BATCH_SIZE,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') args.input = path.resolve(argv[++i]);
    else if (arg === '--batch-size') args.batchSize = Number(argv[++i]);
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return args;
}

function printHelp() {
  console.log(`
Usage:
  npm run import:coaster -- --dry-run
  npm run import:coaster

Environment variables:
  SUPABASE_URL                 Example: https://abc123.supabase.co
  SUPABASE_SERVICE_ROLE_KEY    Secret service role key. Never expose it in the frontend.

Options:
  --input <path>       JSON catalog input. Default: data/imports/coaster-products.json.
  --batch-size <n>     Products per request. Default: ${DEFAULT_BATCH_SIZE}.
  --dry-run            Read and summarize the JSON without sending anything to Supabase.
`);
}

async function readCatalog(filePath) {
  const content = await readFile(filePath, 'utf8');
  return JSON.parse(content);
}

function getProducts(catalog) {
  return [
    ...(Array.isArray(catalog.products) ? catalog.products : []),
    ...(Array.isArray(catalog.inactiveProducts) ? catalog.inactiveProducts : []),
  ];
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function createSupabaseClient() {
  const supabaseUrl = requireEnv('SUPABASE_URL').replace(/\/$/, '');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  async function request(endpoint, options = {}) {
    const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
      ...options,
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        'content-type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Supabase request failed ${response.status}: ${body}`);
    }

    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  return { request };
}

function uniqueBy(values, getKey) {
  const map = new Map();
  for (const value of values) {
    const key = getKey(value);
    if (key && !map.has(key)) map.set(key, value);
  }
  return [...map.values()];
}

function toProviderPayload(catalog) {
  return {
    provider_key: catalog.providerKey || 'coaster',
    name: catalog.provider || 'Coaster Furniture',
    initials: 'CF',
    website_url: catalog.source || 'https://www.coasterfurniture.com',
    location: 'United States',
    country: 'US',
    specialty: 'Furniture catalog supplier',
    notes: 'Imported by SKU scraper from coasterfurniture.com',
    status: 'active',
    last_sync_at: catalog.scrapedAt || new Date().toISOString(),
    metadata: {
      importSource: 'coaster-products.json',
      totalProducts: catalog.totalProducts,
      storedProducts: catalog.storedProducts,
    },
  };
}

function toCategoryPayloads(products, providerId) {
  return uniqueBy(products, (product) => product.categoryKey || product.category)
    .map((product, index) => ({
      provider_id: providerId,
      slug: product.categoryKey || product.category,
      name: product.category || product.categoryKey,
      display_order: index,
      status: 'active',
    }));
}

function normalizeStatus(status) {
  return status === 'inactive' ? 'inactive' : 'active';
}

function toProductPayload(product, providerId, categoryMap) {
  const categoryId = categoryMap.get(product.categoryKey || product.category) || null;

  return {
    provider_id: providerId,
    category_id: categoryId,
    sku: product.sku,
    name: product.name || product.sku,
    subtitle: product.category || null,
    description: null,
    category: product.category || null,
    category_key: product.categoryKey || null,
    image_url: product.image || null,
    gallery: product.image ? [product.image] : [],
    product_url: product.productUrl || null,
    specs: product.specs || {},
    tags: [],
    price: null,
    currency: 'MXN',
    stock_quantity: null,
    status: normalizeStatus(product.status),
    source: product.source || null,
    source_hash: product.sourceHash || null,
    imported_at: product.importedAt || null,
    created_at: product.createdAt || new Date().toISOString(),
    updated_at: product.updatedAt || new Date().toISOString(),
    last_seen_at: product.lastSeenAt || null,
    inactive_at: product.inactiveAt || null,
    missing_runs: Number(product.missingRuns || 0),
    metadata: {
      originalProvider: product.provider || null,
      importedFrom: 'coaster-products.json',
    },
  };
}

async function upsertRows(client, table, rows, onConflict, { select = '*', returning = true } = {}) {
  if (!rows.length) return [];

  const endpoint = returning
    ? `${table}?on_conflict=${encodeURIComponent(onConflict)}&select=${encodeURIComponent(select)}`
    : `${table}?on_conflict=${encodeURIComponent(onConflict)}`;

  const prefer = returning
    ? 'resolution=merge-duplicates,return=representation'
    : 'resolution=merge-duplicates,return=minimal';

  const result = await client.request(endpoint, {
    method: 'POST',
    headers: {
      Prefer: prefer,
    },
    body: JSON.stringify(rows),
  });

  return result || [];
}

async function insertSyncRun(client, providerId, catalog, products, inputPath) {
  const activeCount = products.filter((product) => product.status !== 'inactive').length;
  const inactiveCount = products.length - activeCount;

  await client.request('sync_runs', {
    method: 'POST',
    headers: {
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      provider_id: providerId,
      status: 'completed',
      mode: 'initial-json-import',
      scoped_categories: catalog.categories || [],
      scraped_count: products.length,
      new_count: products.length,
      updated_count: 0,
      reactivated_count: 0,
      inactive_count: inactiveCount,
      started_at: catalog.scrapedAt || new Date().toISOString(),
      finished_at: new Date().toISOString(),
      report: {
        sourceFile: path.relative(process.cwd(), inputPath),
        activeCount,
        inactiveCount,
      },
    }),
  });
}

function chunkRows(rows, size) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalog = await readCatalog(args.input);
  const products = getProducts(catalog);
  const categories = uniqueBy(products, (product) => product.categoryKey || product.category);

  console.log(`Input: ${args.input}`);
  console.log(`Provider: ${catalog.provider || 'Coaster Furniture'}`);
  console.log(`Products: ${products.length}`);
  console.log(`Categories: ${categories.length}`);

  if (args.dryRun) {
    console.log('\nDry run only. Nothing was sent to Supabase.');
    console.log('Sample product:');
    console.log(JSON.stringify(products[0], null, 2));
    return;
  }

  const client = createSupabaseClient();
  const [provider] = await upsertRows(client, 'providers', [toProviderPayload(catalog)], 'provider_key', {
    select: 'id,provider_key,name',
  });

  if (!provider?.id) {
    throw new Error('Could not create or find provider.');
  }

  console.log(`Provider ready: ${provider.name} (${provider.id})`);

  const categoryRows = toCategoryPayloads(products, provider.id);
  const upsertedCategories = await upsertRows(client, 'product_categories', categoryRows, 'provider_id,slug', {
    select: 'id,slug,name',
  });
  const categoryMap = new Map(upsertedCategories.map((category) => [category.slug, category.id]));

  console.log(`Categories upserted: ${upsertedCategories.length}`);

  const productRows = products.map((product) => toProductPayload(product, provider.id, categoryMap));
  const chunks = chunkRows(productRows, args.batchSize);

  for (let index = 0; index < chunks.length; index += 1) {
    await upsertRows(client, 'products', chunks[index], 'provider_id,sku', { returning: false });
    console.log(`Products batch ${index + 1}/${chunks.length}: ${chunks[index].length}`);
  }

  await insertSyncRun(client, provider.id, catalog, products, args.input);

  console.log('\nDone. Coaster products imported to Supabase.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
