/* eslint-disable */
var CustomImportScript = (() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // tools/importer/import-homepage.js
  var import_homepage_exports = {};
  __export(import_homepage_exports, {
    default: () => import_homepage_default
  });

  // tools/importer/parsers/columns-banner-text.js
  function parse(element, { document }) {
    const cell = [];
    const heading = element.querySelector("h1, h2, h3, h4, h5, h6");
    if (heading) {
      const rte = heading.closest(".rteComponent, .rte") || heading.parentElement;
      const nodes = rte ? Array.from(rte.children) : [heading];
      nodes.forEach((n) => {
        if (/^(H[1-6]|P|UL|OL)$/.test(n.tagName)) cell.push(n);
      });
      if (cell.length === 0) cell.push(heading);
    } else {
      Array.from(element.querySelectorAll("p")).forEach((p) => cell.push(p));
    }
    if (cell.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document, {
      name: "Columns (banner-text)",
      cells: [[cell]]
    });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-quicklink.js
  function parse2(element, { document }) {
    const cards = Array.from(element.querySelectorAll(".teaser")).filter(
      (t) => t.querySelector(".cmp-teaser__description") || t.querySelector(".cmp-teaser__image")
    );
    const cells = [];
    cards.forEach((card) => {
      const img = card.querySelector(".cmp-teaser__image img, img");
      const imageCell = img || "";
      const heading = card.querySelector(".cmp-teaser__description h1, .cmp-teaser__description h2, .cmp-teaser__description h3, .cmp-teaser__description h4, .cmp-teaser__description h5, .cmp-teaser__description h6, h1, h2, h3, h4, h5, h6");
      const bodyCell = [];
      if (heading) bodyCell.push(heading);
      if (img || bodyCell.length) {
        cells.push([imageCell, bodyCell.length ? bodyCell : ""]);
      }
    });
    if (cells.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "Cards (quicklink)", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/cards-promo.js
  function parse3(element, { document }) {
    const cards = Array.from(element.querySelectorAll(".teaser")).filter(
      (t) => t.querySelector(".cmp-teaser__description") || t.querySelector(".cmp-teaser__image")
    );
    const cells = [];
    cards.forEach((card) => {
      const img = card.querySelector(".cmp-teaser__image img, img");
      const imageCell = img || "";
      const heading = card.querySelector(".cmp-teaser__description h1, .cmp-teaser__description h2, .cmp-teaser__description h3, .cmp-teaser__description h4, .cmp-teaser__description h5, .cmp-teaser__description h6, h1, h2, h3, h4, h5, h6");
      const bodyCell = [];
      if (heading) bodyCell.push(heading);
      if (img || bodyCell.length) {
        cells.push([imageCell, bodyCell.length ? bodyCell : ""]);
      }
    });
    if (cells.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "Cards (promo)", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/columns-teaser-cta.js
  function parse4(element, { document }) {
    const imageRight = element.classList.contains("toggle--right");
    const imageCell = [];
    const imageWrap = element.querySelector(".coverage-finder-image, .cmp-teaser__image");
    const img = (imageWrap || element).querySelector("img");
    if (img) imageCell.push(img);
    const caption = element.querySelector(".cmp-image__title");
    if (caption) {
      const capP = document.createElement("p");
      capP.append(...caption.childNodes.length ? [...caption.childNodes] : [document.createTextNode(caption.textContent)]);
      imageCell.push(capP);
    }
    const textCell = [];
    const description = element.querySelector(".coverage-finder-text .cmp-teaser__description, .cmp-teaser__content .cmp-teaser__description, .cmp-teaser__description");
    if (description) {
      Array.from(description.children).forEach((child) => {
        if (!child.classList.contains("cmp-teaser__description__secondary")) {
          textCell.push(child);
        }
      });
    }
    const actionContainer = element.querySelector(".coverage-finder-text .cmp-teaser__action-container, .cmp-teaser__content .cmp-teaser__action-container, .cmp-teaser__action-container");
    let cta = null;
    if (actionContainer) {
      cta = actionContainer.querySelector(":scope > a.cmp-teaser__action-link, :scope > a");
    }
    if (!cta) {
      cta = element.querySelector("a.cmp-teaser__action-link");
    }
    if (cta) {
      const ctaP = document.createElement("p");
      const strong = document.createElement("strong");
      const ctaLink = document.createElement("a");
      ctaLink.href = cta.getAttribute("href") || "#";
      if (cta.getAttribute("target")) ctaLink.setAttribute("target", cta.getAttribute("target"));
      ctaLink.textContent = cta.textContent.trim();
      strong.append(ctaLink);
      ctaP.append(strong);
      textCell.push(ctaP);
    }
    const footnote = element.querySelector(".cmp-teaser__description__secondary");
    if (footnote) {
      Array.from(footnote.children).forEach((child) => textCell.push(child));
    }
    if (imageCell.length === 0 && textCell.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const imgCellOut = imageCell.length ? imageCell : "";
    const txtCellOut = textCell.length ? textCell : "";
    const cells = [imageRight ? [txtCellOut, imgCellOut] : [imgCellOut, txtCellOut]];
    const block = WebImporter.Blocks.createBlock(document, { name: "Columns (teaser-cta)", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/isi.js
  function parse5(element, { document }) {
    const source = element.querySelector(".isi-full") || element;
    const nodes = Array.from(source.children).filter(
      (n) => n.textContent.trim() || n.querySelector("img, a")
    );
    if (nodes.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const abbreviated = [];
    const title = nodes.find((n) => /^h[1-6]$/i.test(n.tagName));
    if (title) abbreviated.push(title.cloneNode(true));
    const contraIdx = nodes.findIndex(
      (n) => /^h[1-6]$/i.test(n.tagName) && n.textContent.trim().toUpperCase() === "CONTRAINDICATIONS"
    );
    if (contraIdx !== -1) {
      abbreviated.push(nodes[contraIdx].cloneNode(true));
      const lead = nodes[contraIdx + 1];
      if (lead && lead.tagName.toLowerCase() === "p") abbreviated.push(lead.cloneNode(true));
    }
    if (abbreviated.length <= 1) {
      const firstP = nodes.find((n) => n.tagName.toLowerCase() === "p");
      if (firstP) abbreviated.push(firstP.cloneNode(true));
    }
    const full = nodes.map((n) => n.cloneNode(true));
    const cells = [
      [abbreviated],
      [full]
    ];
    const block = WebImporter.Blocks.createBlock(document, { name: "isi", cells });
    element.replaceWith(block);
  }

  // tools/importer/transformers/vyeptihcp-cleanup.js
  var TransformHook = { beforeTransform: "beforeTransform", afterTransform: "afterTransform" };
  function transform(hookName, element, payload) {
    if (hookName === TransformHook.beforeTransform) {
      WebImporter.DOMUtils.remove(element, [
        // Cookie banner (cleaned.html line 2) — includes its internal .modal-close-button / .close-button.
        "#cookie-information-template-wrapper",
        // LuMi AI chatbot: launcher nav item (line 498), css clientlib link (line 512),
        // and the full chat widget + backdrop injected after the footer XF (lines 1054, 1056).
        "li.desktop-lumi-nav-item",
        "#lumi-assistant-btn",
        "div.lumi-chat-backdrop",
        "div.lumi-assistant-widget"
      ]);
    }
    if (hookName === TransformHook.afterTransform) {
      WebImporter.DOMUtils.remove(element, [
        // Header experience fragment (cleaned.html line 284). Also carries the HCP interstitial
        // "This website is intended for US healthcare professionals only" gate / CONTINUE link (line 293+).
        "div.cmp-experiencefragment--header",
        // Footer experience fragment (line 1006).
        "div.cmp-experiencefragment--footer",
        // Trailing empty AEM spacer columncontainer (page-structure section 6 = "omit"):
        // an empty wide column + a sticky-top decorative image with empty alt (line 871/884).
        // Targeted by its distinguishing .sticky-top child (NOT :last-of-type, which is
        // fragile: after the cards-quicklink parser replaces banner-content's teaser
        // columncontainer, the banner H5 columncontainer would wrongly become last-of-type).
        "article.home-page div.columncontainer:has(> div.container > div.row > div.sticky-top)",
        // Tracking pixels / martech iframes injected near end of body (lines 1050-1053, 1217, 1223).
        "iframe#destination_publishing_iframe_lundbeck_0",
        'iframe[src*="demdex.net"]',
        'iframe[src*="doubleclick.net"]',
        "iframe#lumi-avatar-iframe",
        'img[src*="googleadservices.com"]',
        'img[src*="px.deepintent.com"]',
        // Residual head-injected refs the scraper left behind.
        "script",
        "style",
        "noscript",
        "link"
      ]);
    }
  }

  // tools/importer/transformers/vyeptihcp-sections.js
  var TransformHook2 = { beforeTransform: "beforeTransform", afterTransform: "afterTransform" };
  function transform2(hookName, element, payload) {
    if (hookName !== TransformHook2.beforeTransform) return;
    const sections = payload && payload.template && payload.template.sections;
    if (!Array.isArray(sections) || sections.length < 2) return;
    const doc = element.ownerDocument;
    const resolved = [];
    sections.forEach((section) => {
      if (!section || !section.selector) return;
      const el = element.querySelector(section.selector);
      if (el) resolved.push({ section, el });
    });
    for (let i = resolved.length - 1; i >= 1; i -= 1) {
      const hr = doc.createElement("hr");
      resolved[i].el.parentNode.insertBefore(hr, resolved[i].el);
      resolved[i].hr = hr;
    }
    resolved.forEach(({ section }, i) => {
      let bgImageEl = null;
      if (section.backgroundImage) {
        const bgSource = element.querySelector(section.backgroundImage);
        if (bgSource) {
          bgImageEl = bgSource.matches("img") ? bgSource : bgSource.querySelector("img");
        }
      }
      if (!section.style && !bgImageEl) return;
      const rows = [];
      if (section.style) rows.push(["Style", section.style]);
      if (bgImageEl) {
        rows.push(["background-image", bgImageEl]);
      }
      const meta = WebImporter.Blocks.createBlock(doc, {
        name: "Section Metadata",
        cells: rows
      });
      const next = resolved[i + 1];
      if (next && next.hr) {
        next.hr.parentNode.insertBefore(meta, next.hr);
      } else {
        element.appendChild(meta);
      }
    });
  }

  // tools/importer/import-homepage.js
  var parsers = {
    "columns-banner-text": parse,
    "cards-quicklink": parse2,
    "cards-promo": parse3,
    "columns-teaser-cta": parse4,
    isi: parse5
  };
  var PAGE_TEMPLATE = {
    name: "homepage",
    description: "Landing page: hero banner with quick-link cards, two-card promo section, image+text CTA rows, references, and sticky ISI safety block. Header and footer are experience fragments handled separately.",
    urls: [
      "https://vyeptihcp-stage.d.lundbeckus.com/"
    ],
    blocks: [
      {
        name: "columns-banner-text",
        instances: ["article.home-page div.herocomponent div.banner-content div.columncontainer:nth-of-type(1)"]
      },
      {
        name: "cards-quicklink",
        instances: ["article.home-page div.herocomponent div.banner-content div.columncontainer:nth-of-type(2)"]
      },
      {
        name: "cards-promo",
        instances: ["article.home-page div.columncontainer.home-two-card-section"]
      },
      {
        name: "columns-teaser-cta",
        instances: [
          "article.home-page div.teaser.image-teaser-cta.home-image-content-wrapper-1",
          "article.home-page div.columncontainer div.container.coverage-finder-section-two",
          "article.home-page div.teaser.image-teaser-cta.home-image-content-wrapper-3"
        ]
      },
      {
        name: "isi",
        instances: ["div.experiencefragment:nth-of-type(2) .isi", "#isi"]
      }
    ],
    sections: [
      // Banner (hero) section: the H5 columncontainer is the section's first element,
      // wrapped as a Columns (banner-text) block for richer styling; the
      // cards-quicklink block follows. The former hero image (div.banner-img) is
      // lifted by the sections transformer into a `background-image` row of this
      // section's metadata (style: banner).
      {
        id: "section-banner",
        name: "Hero banner",
        selector: "article.home-page div.herocomponent div.banner-content div.columncontainer:nth-of-type(1)",
        style: "banner",
        blocks: ["columns-banner-text", "cards-quicklink"],
        defaultContent: [],
        backgroundImage: "article.home-page div.herocomponent div.banner-img"
      },
      // One "light" section contains the promo cards followed by all three teaser-cta
      // columns. `selector` is the section's FIRST element (the promo block).
      {
        id: "section-light-cta",
        name: "Promo + CTA rows",
        selector: "article.home-page div.columncontainer.home-two-card-section",
        style: "light",
        blocks: ["cards-promo", "columns-teaser-cta"],
        defaultContent: []
      },
      {
        id: "section-isi",
        name: "Important Safety Information",
        selector: "div.experiencefragment:nth-of-type(2) .isi",
        style: "grey",
        blocks: ["isi"],
        defaultContent: []
      },
      {
        id: "section-references",
        name: "References",
        selector: "div.rte div.rteComponent div.container.reference-section",
        style: null,
        blocks: [],
        defaultContent: ["div.rte div.container.reference-section > p", "div.rte div.container.reference-section > ol"]
      }
    ]
  };
  var transformers = [
    transform,
    ...PAGE_TEMPLATE.sections && PAGE_TEMPLATE.sections.length > 1 ? [transform2] : []
  ];
  function executeTransformers(hookName, element, payload) {
    const enhancedPayload = __spreadProps(__spreadValues({}, payload), { template: PAGE_TEMPLATE });
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
            name: blockDef.name,
            selector,
            element,
            section: blockDef.section || null
          });
        });
      });
    });
    console.log(`Found ${pageBlocks.length} block instances on page`);
    return pageBlocks;
  }
  var import_homepage_default = {
    transform: (payload) => {
      const {
        document,
        url,
        html,
        params
      } = payload;
      const main = document.body;
      executeTransformers("beforeTransform", main, payload);
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
      executeTransformers("afterTransform", main, payload);
      const hr = document.createElement("hr");
      main.appendChild(hr);
      WebImporter.rules.createMetadata(main, document);
      WebImporter.rules.transformBackgroundImages(main, document);
      WebImporter.rules.adjustImageUrls(main, url, params.originalURL);
      const path = WebImporter.FileUtils.sanitizePath(
        new URL(params.originalURL).pathname.replace(/\/$/, "").replace(/\.html$/, "") || "/index"
      );
      return [{
        element: main,
        path,
        report: {
          title: document.title,
          template: PAGE_TEMPLATE.name,
          blocks: pageBlocks.map((b) => b.name)
        }
      }];
    }
  };
  return __toCommonJS(import_homepage_exports);
})();
