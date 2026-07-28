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
 *
 * NOTE: efficacy section selectors are ARRAYS (tried in order); the sections
 * transformer resolves the first match. The clinical-data section's `tabs` block
 * contains the nested `accordion` inside each tab panel — the tabs parser emits those
 * accordions inline, so the standalone accordion parser never runs on this page (its
 * target lives inside the already-replaced tabs element). It is still registered for
 * correctness/reuse.
 */

// PARSER IMPORTS
import sectionTitleParser from './parsers/section-title.js';
import tabsParser from './parsers/tabs.js';
import accordionParser from './parsers/accordion.js';
import quoteKolParser from './parsers/quote-kol.js';
import columnsParser from './parsers/columns.js';
import isiParser from './parsers/isi.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/vyeptihcp-cleanup.js';
import sectionsTransformer from './transformers/vyeptihcp-sections.js';

// PARSER REGISTRY
const parsers = {
  'section-title': sectionTitleParser,
  tabs: tabsParser,
  accordion: accordionParser,
  'quote-kol': quoteKolParser,
  columns: columnsParser,
  isi: isiParser,
};

// PAGE TEMPLATE CONFIGURATION - embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'efficacy',
  description: 'Efficacy/clinical-data page: banner hero, section title, 4-tab clinical data component (Primary Endpoint, 75% Fewer Migraine Days, Fast Onset, Reduction in Acute Med Use) each with graph callout + accordion study-design rows, KOL quote, product-dose callout, arrow-navigation CTA band, ISI, references.',
  urls: [
    'https://www.vyeptihcp.com/efficacy-and-patient-outcomes',
  ],
  blocks: [
    {
      name: 'section-title',
      instances: ['div.title #title-91637d360f h2.cmp-title__text', '#title-91637d360f'],
    },
    {
      name: 'tabs',
      instances: ['div.tabs #tabs-b3c889fa96.cmp-tabs', '#tabs-b3c889fa96'],
    },
    {
      name: 'accordion',
      instances: ['#tabs-b3c889fa96 .cmp-accordion'],
    },
    {
      name: 'quote-kol',
      instances: ['div.kol-quotes-cmp .cmp-teaser', '#container-0463e97b86 .cmp-teaser'],
    },
    {
      name: 'columns',
      instances: ['.teaser.dose-100mg .cmp-teaser', 'div.arrow-navigation #container-9fd6cb2014'],
    },
    {
      name: 'isi',
      instances: ['#SafetyPanelInfo'],
    },
  ],
  sections: [
    {
      id: 'section-banner',
      name: 'Hero banner',
      selector: ['div.hero-component', '.hero.aem-GridColumn'],
      style: 'banner',
      blocks: [],
      defaultContent: ['.banner-content h1'],
      backgroundImage: 'div.hero-component div.banner-img picture',
    },
    {
      id: 'section-clinical-data',
      name: 'VYEPTI pivotal trial data',
      selector: ['div.clinical-tabs', '#vyepti-pivotal-trial-data'],
      style: 'light',
      blocks: ['section-title', 'tabs', 'accordion'],
      defaultContent: [],
    },
    {
      id: 'section-kol-quote',
      name: 'KOL quote (Brad Klein)',
      selector: ['div.kol-quotes-cmp', '#container-0463e97b86'],
      style: 'light',
      blocks: ['quote-kol'],
      defaultContent: [],
    },
    {
      id: 'section-product-callout',
      name: 'Product dose callout + fine print + arrow-nav CTA',
      selector: ['#container-bba3c7fda1'],
      style: 'light',
      blocks: ['columns'],
      defaultContent: ['#text-fa982214d4 p.hanging-indent'],
    },
    {
      id: 'section-isi',
      name: 'Important Safety Information',
      selector: ['div.cmp-experiencefragment--isi', 'div.experiencefragment .isi', '#isi'],
      style: 'grey',
      blocks: ['isi'],
      defaultContent: [],
    },
    {
      id: 'section-references',
      name: 'References',
      selector: ['div.reference-section #text-f8ba31121c', '#text-f8ba31121c'],
      style: null,
      blocks: [],
      defaultContent: ['div.reference-section #text-f8ba31121c'],
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
