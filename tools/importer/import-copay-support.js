/* eslint-disable */
/* global WebImporter */

/*
 * copay-support page: banner hero (with in-page anchor mini-tabs as default content) → copay
 * assistance program (copay-card image + text, accordion terms) → copay claims info (icon
 * columns) → VYEPTI CONNECT navigator feature list (accordion terms) → downloadable resources
 * (cards) → ISI. Reuses existing blocks: accordion, cards, columns, isi. Hero + narrative +
 * icon columns land as default content where finer block-typing is deferred to the styling pass.
 */

// PARSER IMPORTS
import accordionParser from './parsers/accordion.js';
import cardsParser from './parsers/cards.js';
import isiParser from './parsers/isi.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/vyeptihcp-cleanup.js';
import sectionsTransformer from './transformers/vyeptihcp-sections.js';

// PARSER REGISTRY
const parsers = {
  accordion: accordionParser,
  cards: cardsParser,
  isi: isiParser,
};

// PAGE TEMPLATE CONFIGURATION - embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'copay-support',
  description: 'Copay & support page: hero with anchor mini-tabs, copay assistance program with card image + accordion terms, claims-submission icon info, VYEPTI CONNECT navigator feature list with accordion terms, downloadable resources cards, ISI.',
  urls: [
    'https://www.vyeptihcp.com/copay-support',
  ],
  blocks: [
    {
      name: 'accordion',
      instances: [
        '#copay .cmp-accordion',
        '#vyepti-connect .cmp-accordion',
      ],
    },
    {
      name: 'cards',
      instances: ['#resources .copay-resources-button-wrapper'],
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
      selector: ['#copay-support-page-wrapper .hero', 'div.hero-component', '.hero.aem-GridColumn'],
      style: 'banner',
      blocks: [],
      defaultContent: ['.banner-content h1'],
      backgroundImage: '#copay-support-page-wrapper .hero .banner-img picture',
    },
    {
      id: 'section-copay',
      name: 'Copay assistance program',
      selector: ['#copay'],
      style: 'light',
      blocks: ['accordion'],
      defaultContent: [],
    },
    {
      id: 'section-claims',
      name: 'Copay claims info',
      selector: ['#container-e15866d7f5'],
      style: 'light',
      blocks: [],
      defaultContent: ['#container-e15866d7f5'],
    },
    {
      id: 'section-connect',
      name: 'VYEPTI CONNECT navigator',
      selector: ['#vyepti-connect'],
      style: 'light',
      blocks: ['accordion'],
      defaultContent: [],
    },
    {
      id: 'section-resources',
      name: 'Downloadable resources',
      selector: ['#resources'],
      style: 'light',
      blocks: ['cards'],
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

function findBlocksOnPage(document, template) {
  const pageBlocks = [];
  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((selector) => {
      let elements = [];
      try {
        elements = document.querySelectorAll(selector);
      } catch (e) {
        console.warn(`Invalid selector for "${blockDef.name}": ${selector}`);
        return;
      }
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

    executeTransformers('beforeTransform', main, payload);

    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);

    const seen = new Set();
    pageBlocks.forEach((block) => {
      if (!block.element.parentNode || seen.has(block.element)) return;
      seen.add(block.element);
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

    executeTransformers('afterTransform', main, payload);

    const hr = document.createElement('hr');
    main.appendChild(hr);
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

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
