// scrape-smugmug.js
//
// Usage:
//   npm install playwright
//   node scrape-smugmug.js
//
// This will:
//   1. Open each SmugMug gallery in headless Chrome
//   2. Scrape image URLs + filenames
//   3. Save data to assets/js/data/bofe-photos.json and assets/js/data/bofe-photos.js
//
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const galleries = [
  {
    look: 'Look 1',
    url: 'https://www.bobwilliams.photography/Music/Band-of-Echos/n-VkXbjR/BofE-Look-1',
  },
  {
    look: 'Look 2',
    url: 'https://www.bobwilliams.photography/Music/Band-of-Echos/n-VkXbjR/BofE-Look-2',
  },
  {
    look: 'Look 3',
    url: 'https://www.bobwilliams.photography/Music/Band-of-Echos/n-VkXbjR/BofE-Look-3',
  },
  {
    look: 'Look 4',
    url: 'https://www.bobwilliams.photography/Music/Band-of-Echos/n-VkXbjR/B-of-E-Look-4',
  },
  {
    look: 'Look 5',
    url: 'https://www.bobwilliams.photography/Music/Band-of-Echos/n-VkXbjR/B-of-E-Look-5',
  },
];

// Adjust this selector if needed after inspecting the gallery DOM in DevTools.
const IMG_SELECTOR = 'img';

async function expandAllOnPage(page) {
  // Try to reveal all images (handles infinite scroll or "load more")
  let stableRounds = 0;
  let lastCount = 0;
  for (let i = 0; i < 30; i++) {
    // Scroll to bottom to trigger lazy load
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // Try clicking common load-more buttons if present
    const candidates = [
      'text=/^(Load more|Show more|More photos|More images)$/i',
      '[aria-label*="Load more" i]',
      '[data-testid*="load"]',
      'button:has-text("Load more")',
    ];
    for (const sel of candidates) {
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 200 })) {
          await btn.click({ timeout: 2000 });
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(800);
        }
      } catch {}
    }

    // Count currently visible gallery images
    const count = await page.evaluate((IMG_SELECTOR) => {
      return Array.from(document.querySelectorAll(IMG_SELECTOR))
        .map(img => img.currentSrc || img.src || '')
        .filter(src => /\/i-/.test(src)).length;
    }, IMG_SELECTOR);

    if (count === lastCount) {
      stableRounds++;
    } else {
      stableRounds = 0;
      lastCount = count;
    }

    if (stableRounds >= 3) break; // No new images after a few attempts
  }
}

async function collectFromPage(page, look) {
  return await page.evaluate(
    ({ look, IMG_SELECTOR }) => {
      const imgs = Array.from(document.querySelectorAll(IMG_SELECTOR));
      const results = [];
      for (const img of imgs) {
        const src = img.currentSrc || img.src || '';
        if (!src) continue;
        if (!/\/i-/.test(src)) continue;
        const cleanSrc = src.split('?')[0];
        let filename = '';
        const alt = img.alt || '';
        const fileFromSrcMatch = cleanSrc.match(/\/([^\/]+)\.(jpe?g|png|webp)$/i);
        if (fileFromSrcMatch) {
          filename = fileFromSrcMatch[1];
        } else if (alt) {
          filename = alt.trim();
        } else {
          filename = cleanSrc;
        }
        const id = filename;
        results.push({ id, filename, url: cleanSrc, look });
      }
      const dedup = {};
      for (const r of results) dedup[r.id] = r;
      return Object.values(dedup);
    },
    { look, IMG_SELECTOR }
  );
}

async function findNextPageUrl(page) {
  // Look for a rel=next link first
  const relNext = await page.locator('a[rel="next"]').first();
  if (await relNext.count()) {
    try {
      const href = await relNext.getAttribute('href');
      if (href) return new URL(href, page.url()).href;
    } catch {}
  }
  // Fallback: anchors that look like next
  const href = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a[href]'));
    const isNextText = (t) => /^(next|older|›|»|more)$/i.test(t.trim());
    for (const a of anchors) {
      const label = (a.getAttribute('aria-label') || '').trim();
      const text = (a.textContent || '').trim();
      if (isNextText(label) || isNextText(text)) {
        return a.getAttribute('href');
      }
    }
    return null;
  });
  return href ? new URL(href, page.url()).href : null;
}

async function scrapeGallery(browser, gallery) {
  console.log(`Scraping ${gallery.look} from ${gallery.url}`);
  const page = await browser.newPage();
  await page.goto(gallery.url, { waitUntil: 'networkidle', timeout: 0 });

  const seen = new Set();
  const items = [];
  const visited = new Set();
  let pageNum = 1;

  while (true) {
    await expandAllOnPage(page);
    const chunk = await collectFromPage(page, gallery.look);
    let added = 0;
    for (const it of chunk) {
      if (!seen.has(it.id)) { seen.add(it.id); items.push(it); added++; }
    }
    console.log(`  Page ${pageNum}: +${added} (total ${items.length})`);

    visited.add(page.url());
    if (pageNum >= 30) break; // safety cap

    const nextUrl = await findNextPageUrl(page);
    if (!nextUrl || visited.has(nextUrl)) break;

    await page.goto(nextUrl, { waitUntil: 'networkidle', timeout: 0 });
    pageNum++;
  }

  console.log(`  Found ${items.length} images for ${gallery.look}`);
  await page.close();
  return items;
}

async function main() {
  const browser = await chromium.launch();
  const allPhotos = [];

  for (const gallery of galleries) {
    const photos = await scrapeGallery(browser, gallery);
    allPhotos.push(...photos);
  }

  await browser.close();

  if (!allPhotos.length) {
    console.error('No photos scraped. Check IMG_SELECTOR or gallery URLs.');
    process.exit(1);
  }

  // Sort by look then filename to keep it tidy
  allPhotos.sort((a, b) => {
    if (a.look !== b.look) return a.look.localeCompare(b.look);
    return a.filename.localeCompare(b.filename);
  });

  // Ensure data directory exists
  const dataDir = path.join(__dirname, 'assets', 'js', 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  // Write JSON data (raw)
  const jsonPath = path.join(dataDir, 'bofe-photos.json');
  fs.writeFileSync(jsonPath, JSON.stringify(allPhotos, null, 2), 'utf8');

  // Write JS data (global window variable for easy use in HTML)
  const jsPath = path.join(dataDir, 'bofe-photos.js');
  const jsContent = `// Auto-generated by scrape-smugmug.js\nwindow.BOE_PHOTOS = ${JSON.stringify(
    allPhotos,
    null,
    2
  )};\n`;
  fs.writeFileSync(jsPath, jsContent, 'utf8');

  console.log(
    `Wrote ${allPhotos.length} photos to:\n  - ${path.relative(
      __dirname,
      jsonPath
    )}\n  - ${path.relative(__dirname, jsPath)}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
