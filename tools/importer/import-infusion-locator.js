/* eslint-disable */
/* global WebImporter */

/*
 * infusion-locator page: interactive Google-Maps location finder + disclaimer + arrow-nav
 * CTA (to /coverage-finder) + ISI. No banner hero. The locator tool (Vue SPA wired by the
 * PICL clientlib + Google Maps API) is reproduced by the infusion-locator block; its parser
 * captures the vendor origin + Maps key. ISI is the shared `isi` block on #SafetyPanelInfo.
 */

// PARSER IMPORTS
import infusionLocatorParser from './parsers/infusion-locator.js';
import columnsParser from './parsers/columns.js';
import isiParser from './parsers/isi.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/vyeptihcp-cleanup.js';
import sectionsTransformer from './transformers/vyeptihcp-sections.js';

// PARSER REGISTRY
const parsers = {
  'infusion-locator': infusionLocatorParser,
  columns: columnsParser,
  isi: isiParser,
};

// PAGE TEMPLATE CONFIGURATION - embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'infusion-locator',
  description: 'Interactive infusion locator tool page: Google-Maps location finder (infusion-locator block), disclaimer, arrow-nav CTA to coverage finder, ISI.',
  urls: [
    'https://www.vyeptihcp.com/infusion-locator',
  ],
  blocks: [
    {
      name: 'infusion-locator',
      instances: ['main #infusion-locator-page-wrapper .picllocater'],
    },
    {
      name: 'columns',
      instances: ['div.coverage-footer-navigation .arrow-navigation'],
    },
    {
      name: 'isi',
      instances: ['#SafetyPanelInfo'],
    },
  ],
  sections: [
    {
      id: 'section-locator',
      name: 'Infusion locator tool',
      selector: ['main #infusion-locator-page-wrapper .picllocater', 'div.picllocater'],
      style: 'light',
      blocks: ['infusion-locator'],
      defaultContent: [],
    },
    {
      id: 'section-disclaimer',
      name: 'Disclaimer',
      selector: ['main div.infusion-locator-disclaimer', 'div.infusion-locator-disclaimer'],
      style: 'light',
      blocks: [],
      defaultContent: ['main div.infusion-locator-disclaimer'],
    },
    {
      id: 'section-cta-arrow-nav',
      name: 'Arrow-nav CTA band',
      selector: ['main div.coverage-footer-navigation'],
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

    executeTransformers('beforeTransform', main, payload);

    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);

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
