import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const BASE_URL = 'https://www.coasterfurniture.com';
const PROVIDER = 'Coaster Furniture';
const PROVIDER_KEY = 'coaster';

const CATEGORIES = [
  { key: 'bedroom', name: 'Bedroom', pid: 'NA%3D%3D' },
  { key: 'living-room', name: 'Living Room', pid: 'MTE%3D' },
  { key: 'dining-room', name: 'Dining Room', pid: 'Ng%3D%3D' },
  { key: 'home-office', name: 'Home Office', pid: 'MTI%3D' },
  { key: 'entryway-decor', name: 'Entryway & Decor', pid: 'MTE5OQ%3D%3D' },
];

const DEFAULT_OUT = path.join(process.cwd(), 'data', 'imports', 'coaster-products.json');
const DEFAULT_CSV_OUT = path.join(process.cwd(), 'data', 'imports', 'coaster-products.csv');
const DEFAULT_REPORT_OUT = path.join(process.cwd(), 'data', 'imports', 'coaster-sync-report.json');

function parseArgs(argv) {
  const args = {
    category: null,
    all: false,
    delayMs: 900,
    maxPages: null,
    out: DEFAULT_OUT,
    csv: DEFAULT_CSV_OUT,
    report: DEFAULT_REPORT_OUT,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') args.all = true;
    else if (arg === '--category') args.category = argv[++i];
    else if (arg === '--delay-ms') args.delayMs = Number(argv[++i]);
    else if (arg === '--max-pages') args.maxPages = Number(argv[++i]);
    else if (arg === '--out') args.out = path.resolve(argv[++i]);
    else if (arg === '--csv') args.csv = path.resolve(argv[++i]);
    else if (arg === '--report') args.report = path.resolve(argv[++i]);
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
  npm run scrape:coaster -- --category bedroom --max-pages 2
  npm run scrape:coaster -- --all

Options:
  --all                 Scrape every configured Coaster category.
  --category <key>      Scrape one category: ${CATEGORIES.map((c) => c.key).join(', ')}.
  --max-pages <n>       Limit pages per category for testing. Does not mark missing products inactive.
  --delay-ms <n>        Delay between requests. Default: 900.
  --out <path>          JSON output path. Default: data/imports/coaster-products.json.
  --csv <path>          CSV output path. Default: data/imports/coaster-products.csv.
  --report <path>       Sync report path. Default: data/imports/coaster-sync-report.json.
`);
}

function decodeHtml(value = '') {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&nbsp;', ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripTags(value = '') {
  return decodeHtml(value.replace(/<[^>]*>/g, ' '));
}

function absoluteUrl(url) {
  if (!url) return '';
  const cleanUrl = decodeHtml(url).trim();
  if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) return cleanUrl;
  return new URL(cleanUrl, BASE_URL).toString();
}

function categoryUrl(category) {
  const c = encodeURIComponent(category.name);
  return `${BASE_URL}/furniture/shopall?PId=${category.pid}&c=${c}`;
}

function categoryPostUrl(category) {
  return `${BASE_URL}/furniture/shopall?PId=${category.pid}`;
}

async function fetchHtml(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': 'GaleriasCatalogImporter/0.1 (+https://2.25.174.243/eric_diaz/)',
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} ${response.statusText}: ${url}`);
  }

  return response.text();
}

async function fetchCategoryPage(category, page) {
  if (page === 1) {
    return fetchHtml(categoryUrl(category));
  }

  const body = new URLSearchParams({
    PageNum: String(page),
    SortBy: '0',
    MainMaterialIds: '',
    ColorIds: '',
    StyleIds: '',
    ShapeIds: '',
    SizeIds: '',
    PieceIds: '',
  });

  return fetchHtml(categoryPostUrl(category), {
    method: 'POST',
    body,
  });
}

function parseTotalPages(html) {
  const hidden = html.match(/id=["']txtTotalPage["'][^>]*value=["'](\d+)["']/i);
  if (hidden) return Number(hidden[1]);

  const numbers = [...html.matchAll(/Pagination\(['"](\d+)['"]\)/g)].map((match) => Number(match[1]));
  return numbers.length ? Math.max(...numbers) : 1;
}

function parseShowing(html) {
  return stripTags(html.match(/<p[^>]*>\s*Showing\s+([\s\S]*?)<\/p>/i)?.[1] || '');
}

function splitProductCards(html) {
  const chunks = html.split(/<div[^>]*\bcard-shop-box\b[^>]*>/i);
  chunks.shift();
  return chunks.map((chunk) => chunk.split(/<div[^>]*\bcard-shop-box\b[^>]*>/i)[0]);
}

function parseSpecs(cardHtml) {
  const specs = {};
  const rows = cardHtml.matchAll(/<tr\b[^>]*>\s*<th\b[^>]*>([\s\S]*?)<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi);

  for (const row of rows) {
    const key = stripTags(row[1]);
    const value = stripTags(row[2]);
    if (key && value) specs[key] = value;
  }

  return specs;
}

function parseProductCard(cardHtml, category) {
  const sku =
    decodeHtml(cardHtml.match(/\bdata-sku=["']([^"']+)["']/i)?.[1] || '') ||
    decodeHtml(cardHtml.match(/SKU:\s*([A-Z0-9-]+)/i)?.[1] || '');

  if (!sku) return null;

  const name =
    decodeHtml(cardHtml.match(/\bdata-name=["']([^"']+)["']/i)?.[1] || '') ||
    stripTags(cardHtml.match(/<h[1-6][^>]*\bshop-card\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] || '') ||
    stripTags(cardHtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] || '');

  const image =
    absoluteUrl(cardHtml.match(/\bdata-image=["']([^"']+)["']/i)?.[1] || '') ||
    absoluteUrl(cardHtml.match(/<img[^>]+\bsrc=["']([^"']+)["'][^>]*>/i)?.[1] || '');

  const href =
    cardHtml.match(/<a[^>]+\bhref=["']([^"']+)["'][^>]*\bproduct-main-link\b/i)?.[1] ||
    cardHtml.match(/<a[^>]+\bhref=["']([^"']+)["'][^>]*>\s*<h[1-6]/i)?.[1] ||
    cardHtml.match(/<a[^>]+\bhref=["']([^"']+)["'][^>]*>/i)?.[1] ||
    '';

  return {
    provider: PROVIDER,
    providerKey: PROVIDER_KEY,
    sku,
    name,
    category: category.name,
    categoryKey: category.key,
    image,
    productUrl: absoluteUrl(href),
    specs: parseSpecs(cardHtml),
    source: BASE_URL,
    importedAt: new Date().toISOString(),
  };
}

function parseProducts(html, category) {
  return splitProductCards(html)
    .map((card) => parseProductCard(card, category))
    .filter(Boolean);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function productKey(product) {
  return `${product.providerKey}:${product.sku}`;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = stableValue(value[key]);
      return result;
    }, {});
}

function productComparable(product) {
  return stableValue({
    providerKey: product.providerKey,
    sku: product.sku,
    name: product.name,
    category: product.category,
    categoryKey: product.categoryKey,
    image: product.image,
    productUrl: product.productUrl,
    specs: product.specs || {},
  });
}

function sourceHash(product) {
  return createHash('sha256').update(JSON.stringify(productComparable(product))).digest('hex');
}

function diffProduct(previous, next) {
  const previousComparable = productComparable(previous);
  const nextComparable = productComparable(next);
  const changes = [];

  for (const field of Object.keys(nextComparable)) {
    if (JSON.stringify(previousComparable[field]) !== JSON.stringify(nextComparable[field])) {
      changes.push(field);
    }
  }

  return changes;
}

function normalizePreviousProduct(product) {
  const knownTime = product.createdAt || product.importedAt || product.lastSeenAt || null;

  return {
    ...product,
    provider: product.provider || PROVIDER,
    providerKey: product.providerKey || PROVIDER_KEY,
    status: product.status || 'active',
    createdAt: product.createdAt || knownTime,
    updatedAt: product.updatedAt || knownTime,
    lastSeenAt: product.lastSeenAt || knownTime,
    inactiveAt: product.inactiveAt || null,
    missingRuns: Number(product.missingRuns || 0),
    specs: product.specs || {},
    sourceHash: product.sourceHash || sourceHash(product),
  };
}

async function readPreviousCatalog(filePath) {
  try {
    const content = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    const products = [
      ...(Array.isArray(parsed.products) ? parsed.products : []),
      ...(Array.isArray(parsed.inactiveProducts) ? parsed.inactiveProducts : []),
    ];

    return {
      catalog: parsed,
      products: products.map(normalizePreviousProduct),
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        catalog: null,
        products: [],
      };
    }

    throw error;
  }
}

function createChangeSummary(product, changes = []) {
  return {
    sku: product.sku,
    name: product.name,
    category: product.category,
    productUrl: product.productUrl,
    changes,
  };
}

function mergeCatalog({ previousProducts, scrapedProducts, selectedCategories, canMarkMissing }) {
  const now = new Date().toISOString();
  const selectedCategoryKeys = new Set(selectedCategories.map((category) => category.key));
  const previousMap = new Map(previousProducts.map((product) => [productKey(product), product]));
  const scrapedMap = new Map(scrapedProducts.map((product) => [productKey(product), product]));
  const mergedMap = new Map();

  const summary = {
    mode: canMarkMissing ? 'sync' : 'partial',
    scopedCategories: selectedCategories.map((category) => category.name),
    scrapedProducts: scrapedProducts.length,
    newProducts: [],
    updatedProducts: [],
    reactivatedProducts: [],
    inactiveProducts: [],
    unchangedProducts: 0,
    carriedProducts: 0,
  };

  for (const scrapedProduct of scrapedProducts) {
    const key = productKey(scrapedProduct);
    const previousProduct = previousMap.get(key);
    const nextHash = sourceHash(scrapedProduct);

    if (!previousProduct) {
      const nextProduct = {
        ...scrapedProduct,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        lastSeenAt: now,
        inactiveAt: null,
        missingRuns: 0,
        sourceHash: nextHash,
      };

      mergedMap.set(key, nextProduct);
      summary.newProducts.push(createChangeSummary(nextProduct, ['created']));
      continue;
    }

    const changes = previousProduct.sourceHash === nextHash ? [] : diffProduct(previousProduct, scrapedProduct);
    const wasInactive = previousProduct.status === 'inactive';
    const nextProduct = {
      ...previousProduct,
      ...scrapedProduct,
      status: 'active',
      createdAt: previousProduct.createdAt || previousProduct.importedAt || now,
      updatedAt: changes.length || wasInactive ? now : previousProduct.updatedAt || previousProduct.importedAt || now,
      lastSeenAt: now,
      inactiveAt: null,
      missingRuns: 0,
      sourceHash: nextHash,
    };

    mergedMap.set(key, nextProduct);

    if (wasInactive) {
      summary.reactivatedProducts.push(createChangeSummary(nextProduct, ['status']));
    } else if (changes.length) {
      summary.updatedProducts.push(createChangeSummary(nextProduct, changes));
    } else {
      summary.unchangedProducts += 1;
    }
  }

  for (const previousProduct of previousProducts) {
    const key = productKey(previousProduct);
    if (mergedMap.has(key)) continue;

    const isInScope = selectedCategoryKeys.has(previousProduct.categoryKey);

    if (canMarkMissing && isInScope) {
      const missingRuns = Number(previousProduct.missingRuns || 0) + 1;
      const nextProduct = {
        ...previousProduct,
        status: 'inactive',
        updatedAt: previousProduct.status === 'inactive' ? previousProduct.updatedAt : now,
        inactiveAt: previousProduct.inactiveAt || now,
        missingRuns,
      };

      mergedMap.set(key, nextProduct);

      if (previousProduct.status !== 'inactive') {
        summary.inactiveProducts.push(createChangeSummary(nextProduct, ['status']));
      }

      continue;
    }

    mergedMap.set(key, previousProduct);
    summary.carriedProducts += 1;
  }

  const products = [...mergedMap.values()].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return a.category.localeCompare(b.category) || a.sku.localeCompare(b.sku);
  });

  const activeProducts = products.filter((product) => product.status !== 'inactive');
  const inactiveProducts = products.filter((product) => product.status === 'inactive');

  return {
    products: activeProducts,
    inactiveProducts,
    summary: {
      ...summary,
      activeProducts: activeProducts.length,
      inactiveProductsTotal: inactiveProducts.length,
      storedProducts: products.length,
    },
  };
}

function toCsv(products) {
  const columns = ['provider', 'sku', 'name', 'category', 'status', 'lastSeenAt', 'image', 'productUrl'];
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [
    columns.join(','),
    ...products.map((product) => columns.map((column) => escape(product[column])).join(',')),
  ].join('\n');
}

async function scrapeCategory(category, options) {
  console.log(`\n[${category.name}] Fetching page 1`);
  const firstHtml = await fetchCategoryPage(category, 1);
  const totalPages = parseTotalPages(firstHtml);
  const pagesToFetch = options.maxPages ? Math.min(totalPages, options.maxPages) : totalPages;
  const products = parseProducts(firstHtml, category);

  console.log(`[${category.name}] ${parseShowing(firstHtml) || `${products.length} products on page 1`}`);
  console.log(`[${category.name}] Total pages detected: ${totalPages}. Fetching: ${pagesToFetch}`);

  for (let page = 2; page <= pagesToFetch; page += 1) {
    await sleep(options.delayMs);
    console.log(`[${category.name}] Fetching page ${page}/${pagesToFetch}`);
    const html = await fetchCategoryPage(category, page);
    const pageProducts = parseProducts(html, category);
    console.log(`[${category.name}] Page ${page}: ${pageProducts.length} products`);
    products.push(...pageProducts);
  }

  return products;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const selectedCategories = args.all
    ? CATEGORIES
    : CATEGORIES.filter((category) => category.key === args.category);

  if (!selectedCategories.length) {
    console.error('Choose --all or one valid --category.');
    printHelp();
    process.exit(1);
  }

  const productMap = new Map();

  for (const category of selectedCategories) {
    const products = await scrapeCategory(category, args);
    for (const product of products) {
      const key = productKey(product);
      if (!productMap.has(key)) productMap.set(key, product);
    }
  }

  const scrapedProducts = [...productMap.values()].sort((a, b) => a.category.localeCompare(b.category) || a.sku.localeCompare(b.sku));
  const previous = await readPreviousCatalog(args.out);
  const canMarkMissing = !args.maxPages;
  const merged = mergeCatalog({
    previousProducts: previous.products,
    scrapedProducts,
    selectedCategories,
    canMarkMissing,
  });

  const result = {
    provider: PROVIDER,
    providerKey: PROVIDER_KEY,
    source: BASE_URL,
    scrapedAt: new Date().toISOString(),
    syncMode: merged.summary.mode,
    totalProducts: merged.summary.activeProducts,
    inactiveProductsTotal: merged.summary.inactiveProductsTotal,
    storedProducts: merged.summary.storedProducts,
    categories: selectedCategories.map((category) => category.name),
    syncSummary: merged.summary,
    products: merged.products,
    inactiveProducts: merged.inactiveProducts,
  };

  const report = {
    provider: PROVIDER,
    providerKey: PROVIDER_KEY,
    source: BASE_URL,
    generatedAt: result.scrapedAt,
    previousScrapedAt: previous.catalog?.scrapedAt || null,
    output: path.relative(process.cwd(), args.out),
    summary: merged.summary,
  };

  await mkdir(path.dirname(args.out), { recursive: true });
  await mkdir(path.dirname(args.report), { recursive: true });
  await writeFile(args.out, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await writeFile(args.report, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(args.csv, `${toCsv(merged.products)}\n`, 'utf8');

  console.log(`\nDone. Active products: ${merged.summary.activeProducts}`);
  console.log(`New: ${merged.summary.newProducts.length}`);
  console.log(`Updated: ${merged.summary.updatedProducts.length}`);
  console.log(`Reactivated: ${merged.summary.reactivatedProducts.length}`);
  console.log(`Marked inactive: ${merged.summary.inactiveProducts.length}`);
  console.log(`JSON: ${args.out}`);
  console.log(`CSV:  ${args.csv}`);
  console.log(`Report: ${args.report}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
