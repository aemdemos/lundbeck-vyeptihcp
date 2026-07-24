/* eslint-disable */
/* global WebImporter */

/*
 * dosing-and-administration page: banner hero → dosing detail + patient image → admin-guide
 * download + how-to Brightcove video → patient testimonial Brightcove video → arrow-nav CTA
 * band → ISI → reference. Both videos are Brightcove players embedded via the `embed` block
 * (parser builds players.brightcove.com iframe URL from each <video-js>). Arrow-nav = columns
 * (arrow-nav); ISI = isi on #SafetyPanelInfo. Hero + dosing detail + references follow the
 * default-content convention (finer block-typing deferred to the styling pass).
 */

// PARSER IMPORTS
import embedParser from './parsers/embed.js';
import columnsParser from './parsers/columns.js';
import isiParser from './parsers/isi.js';

// TRANSFORMER IMPORTS
import cleanupTransformer from './transformers/vyeptihcp-cleanup.js';
import sectionsTransformer from './transformers/vyeptihcp-sections.js';

// PARSER REGISTRY
const parsers = {
  embed: embedParser,
  columns: columnsParser,
  isi: isiParser,
};

// PAGE TEMPLATE CONFIGURATION - embedded from page-templates.json
const PAGE_TEMPLATE = {
  name: 'dosing-administration',
  description: 'Dosing & administration page: hero, dosing detail with patient image, admin-guide download + how-to Brightcove video, patient testimonial Brightcove video, arrow-nav CTA band, ISI, reference.',
  urls: [
    'https://www.vyeptihcp.com/dosing-and-administration',
  ],
  blocks: [
    {
      name: 'embed',
      instances: ['div.video:has(video-js)', 'div.video'],
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
      id: 'section-dosing',
      name: 'Dosing detail + patient image',
      selector: ['#dosing'],
      style: 'light',
      blocks: [],
      defaultContent: ['#dosing'],
    },
    {
      id: 'section-guide-video',
      name: 'Admin guide download + how-to video',
      selector: ['div.container.responsivegrid.dosing-guide-video'],
      style: 'light',
      blocks: ['embed'],
      defaultContent: [],
    },
    {
      id: 'section-testimonial',
      name: 'Patient testimonial video',
      selector: ['#patient-iv-experience'],
      style: 'light',
      blocks: ['embed'],
      defaultContent: [],
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
      selector: ['div.text.reference-section #text-9d2dfaccc0', 'div.reference-section'],
      style: null,
      blocks: [],
      defaultContent: ['div.text.reference-section #text-9d2dfaccc0'],
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

    // Dedupe by element so a block listed with multiple fallback selectors is parsed once,
    // while genuinely distinct elements (e.g. two separate .video embeds) each still parse.
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
