/* eslint-disable */
/* global WebImporter */

/*
 * VYEPTIHCP BANNER (HERO) CONVENTION — read before adding pages:
 * Page "heroes" are NOT mapped as a `hero` block. Instead the top-of-page hero is a
 * SECTION with style `banner`:
 *   - the former hero image becomes the section background — declared via a
 *     `backgroundImage` field on the section entry; the sections transformer lifts it
 *     into a `background-image` row of that section's Section Metadata table (scripts.js
 *     applySectionBackgroundDecorations renders it as a .bg-image layer).
 *   - hero text (H1–H6) rides along as default content in the section.
 *   - blocks (cards, columns, etc.) sit inside the same banner section for rich heroes.
 * Never add a `hero` block to a Vyepti import. Follow this pattern for every page.
 */

// PARSER IMPORTS
import columnsBannerTextParser from './parsers/columns-banner-text.js';
import cardsQuicklinkParser from './parsers/cards-quicklink.js';
import cardsPromoParser from './parsers/cards-promo.js';
import columnsTeaserCtaParser from './parsers/columns-teaser-cta.js';
import isiParser from './parsers/isi.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/vyeptihcp-cleanup.js';
import sectionsTransformer from './transformers/vyeptihcp-sections.js';

// PARSER REGISTRY
const parsers = {
  'columns-banner-text': columnsBannerTextParser,
  'cards-quicklink': cardsQuicklinkParser,
  'cards-promo': cardsPromoParser,
  'columns-teaser-cta': columnsTeaserCtaParser,
  isi: isiParser,
};

// PAGE TEMPLATE CONFIGURATION - embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'homepage',
  description: 'Landing page: hero banner with quick-link cards, two-card promo section, image+text CTA rows, references, and sticky ISI safety block. Header and footer are experience fragments handled separately.',
  urls: [
    'https://vyeptihcp-stage.d.lundbeckus.com/',
  ],
  blocks: [
    {
      name: 'columns-banner-text',
      instances: ['article.home-page div.herocomponent div.banner-content div.columncontainer:nth-of-type(1)'],
    },
    {
      name: 'cards-quicklink',
      instances: ['article.home-page div.herocomponent div.banner-content div.columncontainer:nth-of-type(2)'],
    },
    {
      name: 'cards-promo',
      instances: ['article.home-page div.columncontainer.home-two-card-section'],
    },
    {
      name: 'columns-teaser-cta',
      instances: [
        'article.home-page div.teaser.image-teaser-cta.home-image-content-wrapper-1',
        'article.home-page div.columncontainer div.container.coverage-finder-section-two',
        'article.home-page div.teaser.image-teaser-cta.home-image-content-wrapper-3',
      ],
    },
    {
      name: 'isi',
      instances: ['div.experiencefragment:nth-of-type(2) .isi', '#isi'],
    },
  ],
  sections: [
    // Banner (hero) section: the H5 columncontainer is the section's first element,
    // wrapped as a Columns (banner-text) block for richer styling; the
    // cards-quicklink block follows. The former hero image (div.banner-img) is
    // lifted by the sections transformer into a `background-image` row of this
    // section's metadata (style: banner).
    {
      id: 'section-banner',
      name: 'Hero banner',
      selector: 'article.home-page div.herocomponent div.banner-content div.columncontainer:nth-of-type(1)',
      style: 'banner',
      blocks: ['columns-banner-text', 'cards-quicklink'],
      defaultContent: [],
      backgroundImage: 'article.home-page div.herocomponent div.banner-img',
    },
    // One "light" section contains the promo cards followed by all three teaser-cta
    // columns. `selector` is the section's FIRST element (the promo block).
    {
      id: 'section-light-cta', name: 'Promo + CTA rows', selector: 'article.home-page div.columncontainer.home-two-card-section', style: 'light', blocks: ['cards-promo', 'columns-teaser-cta'], defaultContent: [],
    },
    {
      id: 'section-isi', name: 'Important Safety Information', selector: 'div.experiencefragment:nth-of-type(2) .isi', style: 'grey', blocks: ['isi'], defaultContent: [],
    },
    {
      id: 'section-references', name: 'References', selector: 'div.rte div.rteComponent div.container.reference-section', style: null, blocks: [], defaultContent: ['div.rte div.container.reference-section > p', 'div.rte div.container.reference-section > ol'],
    },
  ],
};

// TRANSFORMER REGISTRY - cleanup runs first, sections last (adds <hr> + metadata)
const transformers = [
  cleanupTransformer,
  ...(PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [sectionsTransformer] : []),
];

/**
 * Execute all page transformers for a specific hook
 */
function executeTransformers(hookName, element, payload) {
  const enhancedPayload = { ...payload, template: PAGE_TEMPLATE };
  transformers.forEach((transformerFn) => {
    try {
      transformerFn.call(null, hookName, element, enhancedPayload);
    } catch (e) {
      console.error(`Transformer failed at ${hookName}:`, e);
    }
  });
}

/**
 * Find all blocks on the page based on the embedded template configuration
 */
function findBlocksOnPage(document, template) {
  const pageBlocks = [];
  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      if (elements.length === 0) {
        console.warn(`Block "${blockDef.name}" selector not found: ${selector}`);
      }
      elements.forEach((element) => {
        pageBlocks.push({
          name: blockDef.name, selector, element, section: blockDef.section || null,
        });
      });
    });
  });
  console.log(`Found ${pageBlocks.length} block instances on page`);
  return pageBlocks;
}

export default {
  transform: (payload) => {
    const {
      document, url, html, params,
    } = payload;

    const main = document.body;

    // 1. beforeTransform (initial cleanup)
    executeTransformers('beforeTransform', main, payload);

    // 2. Find blocks on page
    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);

    // 3. Parse each block (skip elements already replaced by an earlier parser)
    pageBlocks.forEach((block) => {
      if (!block.element.parentNode) return;
      const parser = parsers[block.name];
      if (parser) {
        try {
          parser(block.element, { document, url, params });
        } catch (e) {
          console.error(`Failed to parse ${block.name} (${block.selector}):`, e);
        }
      } else {
        console.warn(`No parser found for block: ${block.name}`);
      }
    });

    // 4. afterTransform (final cleanup + section breaks/metadata)
    executeTransformers('afterTransform', main, payload);

    // 5. WebImporter built-in rules
    const hr = document.createElement('hr');
    main.appendChild(hr);
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    // 6. Generate sanitized path
    const path = WebImporter.FileUtils.sanitizePath(
      new URL(params.originalURL).pathname.replace(/\/$/, '').replace(/\.html$/, '') || '/index',
    );

    return [{
      element: main,
      path,
      report: {
        title: document.title,
        template: PAGE_TEMPLATE.name,
        blocks: pageBlocks.map((b) => b.name),
      },
    }];
  },
};
