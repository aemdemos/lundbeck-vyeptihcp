/* eslint-disable */
/* global WebImporter */

/*
 * safety-and-tolerability page: banner hero (with in-page anchor mini-tab links as default
 * content) → pivotal-trials adverse-reaction table → PREVAIL 2-year TEAE table → 2-year
 * narrative + PREVAIL study-design accordion → persistency banner → dosing CTA teaser →
 * arrow-nav CTA band → ISI → references. Reuses existing blocks: table, accordion, columns
 * (+arrow-nav), isi. Banner-hero + references follow the shared default-content convention.
 */

// PARSER IMPORTS
import tableParser from './parsers/table.js';
import accordionParser from './parsers/accordion.js';
import columnsParser from './parsers/columns.js';
import isiParser from './parsers/isi.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/vyeptihcp-cleanup.js';
import sectionsTransformer from './transformers/vyeptihcp-sections.js';

// PARSER REGISTRY
const parsers = {
  table: tableParser,
  accordion: accordionParser,
  columns: columnsParser,
  isi: isiParser,
};

// PAGE TEMPLATE CONFIGURATION - embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'safety-tolerability',
  description: 'Safety page: banner hero with anchor mini-tab links, adverse-reaction data tables (pivotal + PREVAIL), 2-year narrative with PREVAIL study-design accordion, persistency banner, dosing CTA teaser, arrow-nav CTA band, ISI, references.',
  urls: [
    'https://www.vyeptihcp.com/safety-and-tolerability',
  ],
  blocks: [
    {
      name: 'table',
      instances: [
        '#pivotal-trials div.dosing-safety-table-wrapper',
        '#prevail div.dosing-safety-table-wrapper',
      ],
    },
    {
      name: 'accordion',
      instances: ['[id="2-year-data"] .cmp-accordion'],
    },
    {
      name: 'columns',
      instances: ['div.container.responsivegrid.arrow-navigation'],
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
      id: 'section-pivotal-trials',
      name: 'Pivotal trials adverse reactions',
      selector: ['#pivotal-trials'],
      style: 'light',
      blocks: ['table'],
      defaultContent: [],
    },
    {
      id: 'section-prevail-teaes',
      name: 'PREVAIL 2-year TEAEs',
      selector: ['#prevail'],
      style: 'light',
      blocks: ['table'],
      defaultContent: [],
    },
    {
      id: 'section-2year-data',
      name: '2-year data + study design',
      selector: ['[id="2-year-data"]'],
      style: 'light',
      blocks: ['accordion'],
      defaultContent: [],
    },
    {
      id: 'section-persistency',
      name: 'Treatment persistency banner',
      selector: ['#treatment-persistency'],
      style: 'light',
      blocks: [],
      defaultContent: ['#treatment-persistency'],
    },
    {
      id: 'section-cta-arrow-nav',
      name: 'Arrow-nav CTA band',
      selector: ['div.container.responsivegrid.arrow-navigation'],
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
    {
      id: 'section-references',
      name: 'References',
      selector: ['div.text.reference-section #text-ac23bc66d0', 'div.reference-section'],
      style: null,
      blocks: [],
      defaultContent: ['div.text.reference-section #text-ac23bc66d0'],
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
