/* eslint-disable */
/* global WebImporter */

/*
 * VYEPTIHCP BANNER (HERO) CONVENTION — read before adding pages:
 * Page "heroes" are NOT mapped as a `hero` block. Instead the top-of-page hero is a
 * SECTION with style `banner`: the hero graphic becomes the section background via a
 * `backgroundImage` selector (the sections transformer lifts it into the section's
 * metadata), and hero text (H1–H3) rides along as default content.
 *
 * 3RD-PARTY TOOL CONVENTION: the live coverage-finder widget (MMIT web component) is
 * embedded via an iframe using the `embed` block (embed parser emits the tool URL).
 * ISI is the shared `isi` block mapped to the inline #SafetyPanelInfo panel only.
 */

// PARSER IMPORTS
import coverageFinderParser from './parsers/coverage-finder.js';
import columnsParser from './parsers/columns.js';
import isiParser from './parsers/isi.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/vyeptihcp-cleanup.js';
import sectionsTransformer from './transformers/vyeptihcp-sections.js';

// PARSER REGISTRY
const parsers = {
  'coverage-finder': coverageFinderParser,
  columns: columnsParser,
  isi: isiParser,
};

// PAGE TEMPLATE CONFIGURATION - embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'coverage-finder',
  description: 'Interactive coverage lookup tool page: banner hero, embedded coverage-finder tool (iframe), disclaimer, arrow-nav CTA to infusion locator, ISI, footnote.',
  urls: [
    'https://www.vyeptihcp.com/coverage-finder',
  ],
  blocks: [
    {
      name: 'coverage-finder',
      instances: ['div.cmp-embed.coverage-embed'],
    },
    {
      name: 'columns',
      instances: ['div.coverage-footer-navigation .arrow-navigation__right-section'],
    },
    {
      name: 'isi',
      instances: ['#SafetyPanelInfo'],
    },
  ],
  sections: [
    {
      id: 'section-banner',
      name: 'Banner hero',
      selector: ['main div.container.coverage-teaser div.teaser div.cmp-teaser', 'div.coverage-teaser'],
      style: 'banner',
      blocks: [],
      defaultContent: ['div.coverage-teaser .cmp-teaser__content'],
      backgroundImage: 'main div.container.coverage-teaser div.cmp-teaser__image picture',
    },
    {
      id: 'section-coverage-tool',
      name: 'Coverage finder tool',
      selector: ['main div.embed div.cmp-embed.coverage-embed', 'div.cmp-embed.coverage-embed'],
      style: 'light',
      blocks: ['coverage-finder'],
      defaultContent: [],
    },
    {
      id: 'section-footnote',
      name: 'Disclaimer/footnote',
      selector: ['main div.text.coverage-foot-note div.cmp-text', 'div.coverage-foot-note'],
      style: 'light',
      blocks: [],
      defaultContent: ['main div.text.coverage-foot-note div.cmp-text'],
    },
    {
      id: 'section-cta-arrow-nav',
      name: 'Arrow-nav CTA band',
      selector: ['main div.container.coverage-footer-navigation'],
      style: 'teal',
      blocks: ['columns'],
      defaultContent: [],
    },
    {
      id: 'section-isi',
      name: 'Important Safety Information',
      selector: ['div.cmp-experiencefragment--isi', '#SafetyPanelInfo'],
      style: 'grey',
      blocks: ['isi'],
      defaultContent: [],
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
