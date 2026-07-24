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

  // tools/importer/import-dosing-administration.js
  var import_dosing_administration_exports = {};
  __export(import_dosing_administration_exports, {
    default: () => import_dosing_administration_default
  });

  // tools/importer/parsers/embed.js
  function parse(element, { document, params }) {
    const bc = element.querySelector("video-js[data-account], [data-account][data-video-id]");
    let brightcove = "";
    if (bc) {
      const account = bc.getAttribute("data-account");
      const player = bc.getAttribute("data-player") || "default";
      const videoId = bc.getAttribute("data-video-id");
      const embed = bc.getAttribute("data-embed") || "default";
      if (account && videoId) {
        brightcove = `https://players.brightcove.com/${account}/${player}_${embed}/index.html?videoId=${videoId}`;
      }
    }
    const existingIframe = element.querySelector("iframe[src]");
    const pageUrl = params && params.originalURL || document && document.location && document.location.href || document && document.baseURI || "";
    const href = brightcove || existingIframe && existingIframe.getAttribute("src") || pageUrl;
    if (!href) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const a = document.createElement("a");
    a.setAttribute("href", href);
    a.textContent = href;
    const block = WebImporter.Blocks.createBlock(document, {
      name: "embed",
      cells: [[a]]
    });
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
    const teasers = Array.from(element.querySelectorAll(".cmp-teaser"));
    const rowCells = [];
    teasers.forEach((teaser) => {
      const src = teaser.querySelector(".cmp-teaser__action-link, .cmp-teaser__description a, a[href]");
      if (!src) {
        rowCells.push("");
        return;
      }
      const link = document.createElement("a");
      link.href = src.getAttribute("href") || "#";
      if (src.getAttribute("target")) link.setAttribute("target", src.getAttribute("target"));
      link.textContent = src.textContent.replace(/\s+/g, " ").trim();
      const p = document.createElement("p");
      p.append(link);
      rowCells.push([p]);
    });
    if (rowCells.length === 0 || rowCells.every((c) => c === "")) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const cells = [rowCells];
    const block = WebImporter.Blocks.createBlock(document, { name: "Columns (arrow-nav)", cells });
    element.replaceWith(block);
  }
  function parse2(element, { document }) {
    const isArrowNav = !!(element.closest(".arrow-navigation") || element.querySelector(".arrow-navigation__left-section, .arrow-navigation__right-section") || element.id && element.id === "container-9fd6cb2014");
    if (isArrowNav) {
      parseArrowNav(element, document);
      return;
    }
    parseDoseCallout(element, document);
  }

  // tools/importer/parsers/isi.js
  function parse3(element, { document }) {
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

  // tools/importer/import-dosing-administration.js
  var parsers = {
    embed: parse,
    columns: parse2,
    isi: parse3
  };
  var PAGE_TEMPLATE = {
    name: "dosing-administration",
    description: "Dosing & administration page: hero, dosing detail with patient image, admin-guide download + how-to Brightcove video, patient testimonial Brightcove video, arrow-nav CTA band, ISI, reference.",
    urls: [
      "https://www.vyeptihcp.com/dosing-and-administration"
    ],
    blocks: [
      {
        name: "embed",
        instances: ["div.video:has(video-js)", "div.video"]
      },
      {
        name: "columns",
        instances: ["div.container.responsivegrid.arrow-navigation"]
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
        id: "section-dosing",
        name: "Dosing detail + patient image",
        selector: ["#dosing"],
        style: "light",
        blocks: [],
        defaultContent: ["#dosing"]
      },
      {
        id: "section-guide-video",
        name: "Admin guide download + how-to video",
        selector: ["div.container.responsivegrid.dosing-guide-video"],
        style: "light",
        blocks: ["embed"],
        defaultContent: []
      },
      {
        id: "section-testimonial",
        name: "Patient testimonial video",
        selector: ["#patient-iv-experience"],
        style: "light",
        blocks: ["embed"],
        defaultContent: []
      },
      {
        id: "section-cta-arrow-nav",
        name: "Arrow-nav CTA band",
        selector: ["div.container.responsivegrid.arrow-navigation"],
        style: "teal",
        blocks: ["columns"],
        defaultContent: []
      },
      {
        id: "section-isi",
        name: "Important Safety Information",
        selector: ["div.cmp-experiencefragment--isi", "#SafetyPanelInfo"],
        style: "grey",
        blocks: ["isi"],
        defaultContent: []
      },
      {
        id: "section-references",
        name: "References",
        selector: ["div.text.reference-section #text-9d2dfaccc0", "div.reference-section"],
        style: null,
        blocks: [],
        defaultContent: ["div.text.reference-section #text-9d2dfaccc0"]
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
  var import_dosing_administration_default = {
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
      const seen = /* @__PURE__ */ new Set();
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
  return __toCommonJS(import_dosing_administration_exports);
})();
