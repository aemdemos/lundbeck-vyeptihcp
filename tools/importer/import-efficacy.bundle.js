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

  // tools/importer/import-efficacy.js
  var import_efficacy_exports = {};
  __export(import_efficacy_exports, {
    default: () => import_efficacy_default
  });

  // tools/importer/parsers/section-title.js
  function parse(element, { document }) {
    let heading = element.querySelector(".cmp-title__text, h1, h2, h3, h4, h5, h6");
    if (!heading && /^h[1-6]$/i.test(element.tagName)) {
      heading = element;
    }
    if (!heading) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const headingClone = heading.cloneNode(true);
    const cells = [[[headingClone]]];
    const block = WebImporter.Blocks.createBlock(document, { name: "section-title", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/tabs.js
  function buildAccordionPanelBody(panel, document) {
    const body = [];
    const nestedAccordions = Array.from(panel.querySelectorAll(".cmp-accordion"));
    if (nestedAccordions.length === 0) {
      const content = panel.querySelector(".cmp-container, .cmp-text, .cmp-experiencefragment") || panel;
      Array.from(content.childNodes).forEach((n) => {
        if (n.nodeType === Node.ELEMENT_NODE || n.textContent && n.textContent.trim()) {
          body.push(n.cloneNode(true));
        }
      });
      return body;
    }
    const topNested = nestedAccordions.find(
      (a) => !nestedAccordions.some((other) => other !== a && other.contains(a))
    ) || nestedAccordions[0];
    const nestedWrapper = topNested.closest(".accordion.panelcontainer") || topNested;
    const contentRoot = nestedWrapper.parentElement || panel;
    Array.from(contentRoot.children).forEach((child) => {
      if (child === nestedWrapper || child.contains(topNested)) return;
      if (child.querySelector && child.querySelector(".cmp-accordion")) return;
      if (child.textContent && child.textContent.trim() || child.querySelector("img, picture")) {
        body.push(child.cloneNode(true));
      }
    });
    const nestedBlock = buildAccordionBlock(topNested, document);
    if (nestedBlock) body.push(nestedBlock);
    return body;
  }
  function buildAccordionBlock(accordion, document) {
    const items = Array.from(accordion.children).filter((c) => c.classList && c.classList.contains("cmp-accordion__item"));
    if (items.length === 0) return null;
    const cells = [];
    items.forEach((item) => {
      const titleEl = item.querySelector(".cmp-accordion__title, .cmp-accordion__header, button");
      const titleP = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = (titleEl ? titleEl.textContent : "").replace(/\s+/g, " ").trim();
      titleP.append(strong);
      const panel = item.querySelector(".cmp-accordion__panel");
      const bodyNodes = panel ? buildAccordionPanelBody(panel, document) : [];
      cells.push([[titleP], bodyNodes.length ? bodyNodes : [""]]);
    });
    return WebImporter.Blocks.createBlock(document, { name: "accordion", cells });
  }
  function buildTabPanelCell(panel, document) {
    const cell = [];
    const grid = panel.querySelector(".cmp-container > .aem-Grid") || panel;
    const columns = Array.from(grid.children).filter(
      (c) => c.nodeType === Node.ELEMENT_NODE && c.classList.contains("aem-GridColumn")
    );
    const iter = columns.length ? columns : Array.from(grid.children);
    iter.forEach((col) => {
      const accordion = col.classList && col.classList.contains("accordion") ? col.querySelector(":scope > .cmp-accordion, .cmp-accordion") : null;
      if (accordion) {
        const block = buildAccordionBlock(accordion, document);
        if (block) cell.push(block);
        return;
      }
      if (col.textContent && col.textContent.trim() || col.querySelector("img, picture")) {
        cell.push(col.cloneNode(true));
      }
    });
    return cell;
  }
  function parse2(element, { document }) {
    const tabs = Array.from(element.querySelectorAll(".cmp-tabs__tablist > .cmp-tabs__tab, ol.cmp-tabs__tablist li"));
    const panels = Array.from(element.querySelectorAll(":scope > .cmp-tabs__tabpanel, .cmp-tabs__tabpanel"));
    if (tabs.length === 0 || panels.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const cells = [];
    tabs.forEach((tab, i) => {
      const label = (tab.textContent || "").replace(/\s+/g, " ").trim();
      const panel = panels[i];
      const panelCell = panel ? buildTabPanelCell(panel, document) : [];
      cells.push([label, panelCell.length ? panelCell : [""]]);
    });
    const block = WebImporter.Blocks.createBlock(document, { name: "tabs", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/accordion.js
  function buildAccordionPanelBody2(panel, document) {
    const body = [];
    const nestedAccordions = Array.from(panel.querySelectorAll(".cmp-accordion"));
    if (nestedAccordions.length === 0) {
      const content = panel.querySelector(".cmp-container, .cmp-text, .cmp-experiencefragment") || panel;
      Array.from(content.childNodes).forEach((n) => {
        if (n.nodeType === Node.ELEMENT_NODE || n.textContent && n.textContent.trim()) {
          body.push(n.cloneNode(true));
        }
      });
      return body;
    }
    const topNested = nestedAccordions.find(
      (a) => !nestedAccordions.some((other) => other !== a && other.contains(a))
    ) || nestedAccordions[0];
    const nestedWrapper = topNested.closest(".accordion.panelcontainer") || topNested;
    const contentRoot = nestedWrapper.parentElement || panel;
    Array.from(contentRoot.children).forEach((child) => {
      if (child === nestedWrapper || child.contains(topNested)) return;
      if (child.querySelector && child.querySelector(".cmp-accordion")) return;
      if (child.textContent && child.textContent.trim() || child.querySelector("img, picture")) {
        body.push(child.cloneNode(true));
      }
    });
    const nestedBlock = buildAccordionBlock2(topNested, document);
    if (nestedBlock) body.push(nestedBlock);
    return body;
  }
  function buildAccordionBlock2(accordion, document) {
    const items = Array.from(accordion.children).filter((c) => c.classList && c.classList.contains("cmp-accordion__item"));
    if (items.length === 0) return null;
    const cells = [];
    items.forEach((item) => {
      const titleEl = item.querySelector(".cmp-accordion__title, .cmp-accordion__header, button");
      const titleP = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = (titleEl ? titleEl.textContent : "").replace(/\s+/g, " ").trim();
      titleP.append(strong);
      const panel = item.querySelector(".cmp-accordion__panel");
      const bodyNodes = panel ? buildAccordionPanelBody2(panel, document) : [];
      cells.push([[titleP], bodyNodes.length ? bodyNodes : [""]]);
    });
    return WebImporter.Blocks.createBlock(document, { name: "accordion", cells });
  }
  function parse3(element, { document }) {
    const hasItems = element.querySelector(".cmp-accordion__item");
    if (!hasItems) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = buildAccordionBlock2(element, document);
    if (!block) {
      element.replaceWith(...element.childNodes);
      return;
    }
    element.replaceWith(block);
  }

  // tools/importer/parsers/quote-kol.js
  function parse4(element, { document }) {
    const cells = [];
    const imageWrap = element.querySelector(".cmp-teaser__image");
    const figure = (imageWrap || element).querySelector("picture, img");
    if (figure) cells.push([[figure]]);
    const quoteEl = element.querySelector(".cmp-teaser__title");
    let quotation = null;
    if (quoteEl) {
      quotation = document.createElement("p");
      quotation.textContent = quoteEl.textContent.replace(/\s+/g, " ").trim().replace(/^["“”]+/, "").replace(/["“”]+$/, "").trim();
    }
    if (quotation) cells.push([[quotation]]);
    const description = element.querySelector(".cmp-teaser__description");
    const attributionNodes = [];
    if (description) {
      Array.from(description.children).forEach((child) => {
        if (/^(P|DIV|SPAN)$/i.test(child.tagName) && child.textContent.trim()) {
          attributionNodes.push(child.cloneNode(true));
        }
      });
    }
    if (attributionNodes.length) cells.push([attributionNodes]);
    if (cells.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const block = WebImporter.Blocks.createBlock(document, { name: "quote-kol", cells });
    element.replaceWith(block);
  }

  // tools/importer/parsers/columns.js
  function parseDoseCallout(element, document) {
    const imageCell = [];
    const imageWrap = element.querySelector(".cmp-teaser__image");
    const figure = (imageWrap || element).querySelector("picture, img");
    if (figure) imageCell.push(figure);
    const textCell = [];
    const description = element.querySelector(".cmp-teaser__description");
    if (description) {
      Array.from(description.children).forEach((child) => {
        if (child.textContent && child.textContent.trim()) textCell.push(child.cloneNode(true));
      });
      if (textCell.length === 0 && description.textContent.trim()) {
        textCell.push(description.cloneNode(true));
      }
    }
    if (imageCell.length === 0 && textCell.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const cells = [[
      imageCell.length ? imageCell : "",
      textCell.length ? textCell : ""
    ]];
    const block = WebImporter.Blocks.createBlock(document, { name: "Columns", cells });
    element.replaceWith(block);
  }
  function parseArrowNav(element, document) {
    let teasers = Array.from(element.querySelectorAll(
      ".arrow-navigation__left-section, .arrow-navigation__right-section"
    ));
    if (teasers.length === 0) teasers = Array.from(element.querySelectorAll(".cmp-teaser"));
    if (teasers.length === 0) teasers = [element];
    const rowCells = [];
    teasers.forEach((teaser) => {
      const cellNodes = [];
      const heading = teaser.querySelector("h1, h2, h3, h4, h5, h6");
      if (heading && heading.textContent.trim()) cellNodes.push(heading.cloneNode(true));
      const src = teaser.querySelector(".cmp-teaser__action-link") || teaser.querySelector(".cmp-teaser__description a[href]") || teaser.querySelector("a[href]");
      if (src) {
        const link = document.createElement("a");
        link.href = src.getAttribute("href") || "#";
        if (src.getAttribute("target")) link.setAttribute("target", src.getAttribute("target"));
        link.textContent = src.textContent.replace(/\s+/g, " ").trim();
        const p = document.createElement("p");
        p.append(link);
        cellNodes.push(p);
      }
      if (cellNodes.length) rowCells.push(cellNodes);
    });
    if (rowCells.length === 0) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const cells = [rowCells];
    const block = WebImporter.Blocks.createBlock(document, { name: "Columns (arrow-nav)", cells });
    element.replaceWith(block);
  }
  function parse5(element, { document }) {
    const isArrowNav = !!(element.closest(".arrow-navigation, .coverage-footer-navigation") || element.matches(".arrow-navigation__left-section, .arrow-navigation__right-section") || element.querySelector(".arrow-navigation__left-section, .arrow-navigation__right-section") || element.id && element.id === "container-9fd6cb2014");
    if (isArrowNav) {
      parseArrowNav(element, document);
      return;
    }
    parseDoseCallout(element, document);
  }

  // tools/importer/parsers/isi.js
  function parse6(element, { document }) {
    const isiFull = element.querySelector(".isi-full");
    let nodes;
    if (isiFull) {
      nodes = Array.from(isiFull.children).filter(
        (n) => n.textContent.trim() || n.querySelector("img, a")
      );
    } else {
      const picked = [...element.querySelectorAll("h1, h2, h3, h4, h5, h6, p")];
      nodes = picked.filter((n) => !picked.some((other) => other !== n && other.contains(n)));
    }
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
        // Efficacy (and other non-homepage templates): back-to-top sticky decorative image.
        // Distinct from the homepage rule above — this is its own #back-to-top cmp-container that
        // sits as a body-level sibling AFTER </main> (cleaned.html line 3113), not inside an
        // article.home-page columncontainer. Site chrome, empty alt, not authorable.
        "div#back-to-top",
        // Efficacy external-link interstitial modal ("You are now leaving…" gate). Body-level
        // sibling after </main> (cleaned.html line 3129, div.interstitialmodal > #external-link-modal).
        // Injected by the site shell; an author never creates it, so remove it.
        "div.interstitialmodal",
        // ISI persistent fixed bottom bar (#isiFixedBottom). It is a sibling of the inline
        // ISI panel (#SafetyPanelInfo) inside the ISI experience fragment and carries a FULL
        // duplicate of the safety copy. The isi block (blocks/isi/isi.js) builds its own fixed
        // bar from the parsed block's abbreviated row, so this source bar is redundant — left
        // in place it renders the entire ISI a second time as raw default content just before
        // the isi block. Remove it so the ISI appears exactly once (as the isi block).
        "div#isiFixedBottom",
        // Empty ISI anchor stub (#isi.grey-bg) — the section boundary/background hook; carries
        // no content and would otherwise leave an empty grey div in the flow.
        "div#isi.grey-bg",
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
      element.querySelectorAll('a[href="#"]').forEach((a) => {
        if (/^_*$/.test(a.textContent.trim())) {
          const p = a.parentElement;
          a.remove();
          if (p && p.tagName === "P" && !p.textContent.trim() && !p.querySelector("img, picture")) {
            p.remove();
          }
        }
      });
    }
  }

  // tools/importer/transformers/vyeptihcp-sections.js
  var TransformHook2 = { beforeTransform: "beforeTransform", afterTransform: "afterTransform" };
  function resolveFirst(root, selector) {
    if (!selector) return null;
    const candidates = Array.isArray(selector) ? selector : [selector];
    for (let i = 0; i < candidates.length; i += 1) {
      const sel = candidates[i];
      if (typeof sel === "string" && sel.trim()) {
        const el = root.querySelector(sel);
        if (el) return el;
      }
    }
    return null;
  }
  function mediaWidth(media) {
    if (!media) return Infinity;
    const m = media.match(/(?:max-width|min-width|width)\s*:\s*(\d+(?:\.\d+)?)/i);
    return m ? parseFloat(m[1]) : Infinity;
  }
  function extractRenditionImgs(container, doc) {
    const picture = container.matches("picture") ? container : container.querySelector("picture");
    const fallbackImg = picture && picture.querySelector("img") || (container.matches("img") ? container : container.querySelector("img"));
    const alt = fallbackImg ? fallbackImg.getAttribute("alt") || "" : "";
    const entries = [];
    const addEntry = (rawSrcset, media) => {
      if (!rawSrcset) return;
      rawSrcset.split(",").forEach((candidate) => {
        const url = candidate.trim().split(/\s+/)[0];
        if (url) entries.push({ url, width: mediaWidth(media) });
      });
    };
    if (picture) {
      picture.querySelectorAll("source").forEach((s) => addEntry(s.getAttribute("srcset"), s.getAttribute("media")));
      if (fallbackImg) entries.push({ url: fallbackImg.getAttribute("src"), width: Infinity });
    } else if (fallbackImg) {
      entries.push({ url: fallbackImg.getAttribute("src"), width: Infinity });
    }
    const byUrl = /* @__PURE__ */ new Map();
    entries.forEach(({ url, width }) => {
      if (!url) return;
      if (!byUrl.has(url) || width < byUrl.get(url)) byUrl.set(url, width);
    });
    return [...byUrl.entries()].sort((a, b) => a[1] - b[1]).map(([url]) => {
      const im = doc.createElement("img");
      im.setAttribute("src", url);
      if (alt) im.setAttribute("alt", alt);
      return im;
    });
  }
  function transform2(hookName, element, payload) {
    if (hookName !== TransformHook2.beforeTransform) return;
    const sections = payload && payload.template && payload.template.sections;
    if (!Array.isArray(sections) || sections.length < 2) return;
    const doc = element.ownerDocument;
    const resolved = [];
    sections.forEach((section) => {
      if (!section || !section.selector) return;
      const el = resolveFirst(element, section.selector);
      if (el) resolved.push({ section, el });
    });
    for (let i = resolved.length - 1; i >= 1; i -= 1) {
      const hr = doc.createElement("hr");
      resolved[i].el.parentNode.insertBefore(hr, resolved[i].el);
      resolved[i].hr = hr;
    }
    resolved.forEach(({ section }, i) => {
      let bgRenditions = [];
      if (section.backgroundImage) {
        const bgSource = resolveFirst(element, section.backgroundImage);
        if (bgSource) {
          bgRenditions = extractRenditionImgs(bgSource, doc);
          bgSource.remove();
        }
      }
      if (!section.style && bgRenditions.length === 0) return;
      const rows = [];
      if (section.style) rows.push(["Style", section.style]);
      if (bgRenditions.length > 0) {
        const cell = doc.createElement("div");
        bgRenditions.forEach((im) => {
          const p = doc.createElement("p");
          p.appendChild(im);
          cell.appendChild(p);
        });
        rows.push(["background-image", cell]);
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

  // tools/importer/import-efficacy.js
  var parsers = {
    "section-title": parse,
    tabs: parse2,
    accordion: parse3,
    "quote-kol": parse4,
    columns: parse5,
    isi: parse6
  };
  var PAGE_TEMPLATE = {
    name: "efficacy",
    description: "Efficacy/clinical-data page: banner hero, section title, 4-tab clinical data component (Primary Endpoint, 75% Fewer Migraine Days, Fast Onset, Reduction in Acute Med Use) each with graph callout + accordion study-design rows, KOL quote, product-dose callout, arrow-navigation CTA band, ISI, references.",
    urls: [
      "https://www.vyeptihcp.com/efficacy-and-patient-outcomes"
    ],
    blocks: [
      {
        name: "section-title",
        instances: ["div.title #title-91637d360f h2.cmp-title__text", "#title-91637d360f"]
      },
      {
        name: "tabs",
        instances: ["div.tabs #tabs-b3c889fa96.cmp-tabs", "#tabs-b3c889fa96"]
      },
      {
        name: "accordion",
        instances: ["#tabs-b3c889fa96 .cmp-accordion"]
      },
      {
        name: "quote-kol",
        instances: ["div.kol-quotes-cmp .cmp-teaser", "#container-0463e97b86 .cmp-teaser"]
      },
      {
        name: "columns",
        instances: [".teaser.dose-100mg .cmp-teaser", "div.arrow-navigation #container-9fd6cb2014"]
      },
      {
        name: "isi",
        instances: ["#SafetyPanelInfo"]
      }
    ],
    sections: [
      {
        id: "section-banner",
        name: "Hero banner",
        selector: ["div.hero-component", ".hero.aem-GridColumn"],
        style: "banner",
        blocks: [],
        defaultContent: [".banner-content h1"],
        backgroundImage: "div.hero-component div.banner-img picture"
      },
      {
        id: "section-clinical-data",
        name: "VYEPTI pivotal trial data",
        selector: ["div.clinical-tabs", "#vyepti-pivotal-trial-data"],
        style: "light",
        blocks: ["section-title", "tabs", "accordion"],
        defaultContent: []
      },
      {
        id: "section-kol-quote",
        name: "KOL quote (Brad Klein)",
        selector: ["div.kol-quotes-cmp", "#container-0463e97b86"],
        style: "light",
        blocks: ["quote-kol"],
        defaultContent: []
      },
      {
        id: "section-product-callout",
        name: "Product dose callout + fine print + arrow-nav CTA",
        selector: ["#container-bba3c7fda1"],
        style: "light",
        blocks: ["columns"],
        defaultContent: ["#text-fa982214d4 p.hanging-indent"]
      },
      {
        id: "section-isi",
        name: "Important Safety Information",
        selector: ["div.cmp-experiencefragment--isi", "div.experiencefragment .isi", "#isi"],
        style: "grey",
        blocks: ["isi"],
        defaultContent: []
      },
      {
        id: "section-references",
        name: "References",
        selector: ["div.reference-section #text-f8ba31121c", "#text-f8ba31121c"],
        style: null,
        blocks: [],
        defaultContent: ["div.reference-section #text-f8ba31121c"]
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
  var import_efficacy_default = {
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
  return __toCommonJS(import_efficacy_exports);
})();
