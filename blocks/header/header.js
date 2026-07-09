import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

const SESSION_HCP_DISMISSED = 'vyepti-hcp-bar-dismissed';

/**
 * Marks a link as opening in a new tab and appends the source's visually-hidden
 * "opens in a new tab" hint (a11y parity with the source header).
 */
function markNewTab(link) {
  link.setAttribute('target', '_blank');
  link.setAttribute('rel', 'noopener');
  const hint = document.createElement('span');
  hint.className = 'nav-visually-hidden';
  hint.textContent = 'opens in a new tab';
  link.append(hint);
}

function isDesktop() {
  return window.matchMedia('(min-width: 900px)').matches;
}

/**
 * Wires hover (desktop) + click (all) open/close behavior on a dropdown container.
 * @param {HTMLElement} item The <li>/wrapper holding the trigger + menu
 * @param {HTMLElement} menu The dropdown menu element
 */
function wireDropdown(item, menu) {
  item.setAttribute('aria-expanded', 'false');
  const close = () => item.setAttribute('aria-expanded', 'false');
  const open = () => {
    // Single-open: collapse any sibling dropdown in the same list before opening.
    if (item.parentElement) {
      item.parentElement.querySelectorAll(':scope > .nav-dropdown[aria-expanded="true"]')
        .forEach((s) => { if (s !== item) s.setAttribute('aria-expanded', 'false'); });
    }
    item.setAttribute('aria-expanded', 'true');
  };
  item.addEventListener('mouseenter', () => { if (isDesktop()) open(); });
  item.addEventListener('mouseleave', () => { if (isDesktop()) close(); });
  const trigger = item.querySelector(':scope > button, :scope > span, :scope > a');
  if (trigger) {
    trigger.addEventListener('click', (e) => {
      // A dropdown trigger with no real href toggles; a real link navigates.
      const isRealLink = trigger.tagName === 'A' && trigger.getAttribute('href') && trigger.getAttribute('href') !== '#';
      if (isRealLink) return;
      e.preventDefault();
      e.stopPropagation();
      const expanded = item.getAttribute('aria-expanded') === 'true';
      if (expanded) close(); else open();
    });
  }
  menu.setAttribute('role', 'menu');
}

/**
 * Builds a dropdown from a source <li> that contains a nested <ul>.
 * The li's leading text (before the nested ul) becomes the trigger label.
 * @returns {HTMLElement} decorated <li> dropdown
 */
function buildDropdownItem(sourceLi) {
  const li = document.createElement('li');
  li.className = 'nav-dropdown';

  const subUl = sourceLi.querySelector(':scope > ul');
  // Trigger label = the li's leading content before the nested <ul>. The DA/EDS
  // pipeline wraps this in a <p> (`<li><p>Label</p><ul>…`), while the local raw
  // fragment has bare text — so take the first non-<ul> child's text, falling
  // back to direct text nodes.
  const labelNode = [...sourceLi.children].find((c) => c.tagName !== 'UL');
  const labelText = labelNode
    ? labelNode.textContent.trim()
    : Array.from(sourceLi.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent.trim())
      .filter(Boolean)
      .join(' ');

  const trigger = document.createElement('button');
  trigger.className = 'nav-dropdown-trigger';
  trigger.type = 'button';
  trigger.textContent = labelText;
  li.append(trigger);

  const menu = document.createElement('div');
  menu.className = 'nav-dropdown-menu';
  const menuList = document.createElement('ul');
  [...subUl.querySelectorAll(':scope > li > a')].forEach((a) => {
    const mi = document.createElement('li');
    const link = a.cloneNode(true);
    if (/^https?:\/\//.test(link.getAttribute('href') || '')) {
      markNewTab(link);
    }
    mi.append(link);
    menuList.append(mi);
  });
  menu.append(menuList);
  li.append(menu);

  wireDropdown(li, menu);
  return li;
}

/**
 * Decorates the HCP notification bar (row 0). CONTINUE dismisses the bar for the
 * session; GO TO PATIENT SITE navigates out.
 * @returns {HTMLElement|null}
 */
function decorateHcpBar(section) {
  if (!section) return null;
  if (sessionStorage.getItem(SESSION_HCP_DISMISSED) === 'true') return null;

  const bar = document.createElement('div');
  bar.className = 'nav-hcp-bar';
  const container = document.createElement('div');
  container.className = 'nav-hcp-container';

  const msg = section.querySelector('p');
  if (msg) {
    const msgEl = document.createElement('p');
    msgEl.className = 'nav-hcp-message';
    msgEl.textContent = msg.textContent.trim();
    container.append(msgEl);
  }

  const actions = document.createElement('div');
  actions.className = 'nav-hcp-actions';
  const links = [...section.querySelectorAll('ul > li > a')];
  links.forEach((a) => {
    const label = a.textContent.trim();
    const href = a.getAttribute('href') || '#';
    if (/^continue$/i.test(label) || href === '#') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-hcp-continue';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        // Non-sensitive UI flag (a boolean marking the HCP notice as dismissed
        // for this tab). No tokens or personal data — safe in sessionStorage.
        // eslint-disable-next-line browser-security/no-sensitive-localstorage
        sessionStorage.setItem(SESSION_HCP_DISMISSED, 'true');
        bar.remove();
      });
      actions.append(btn);
    } else {
      const link = a.cloneNode(true);
      link.className = 'nav-hcp-link';
      if (/^https?:\/\//.test(href)) {
        markNewTab(link);
      }
      actions.append(link);
    }
  });
  container.append(actions);
  bar.append(container);
  return bar;
}

/**
 * Decorates the utility bar (row 1): indication tagline + PI/Patient Info dropdowns
 * + View patient site.
 * @returns {HTMLElement|null}
 */
function decorateUtilityBar(section) {
  if (!section) return null;
  const bar = document.createElement('div');
  bar.className = 'nav-utility';
  const container = document.createElement('div');
  container.className = 'nav-utility-container';

  const contentRoot = section.querySelector('.default-content-wrapper') || section;
  const tagline = contentRoot.querySelector(':scope > p');
  if (tagline) {
    const t = document.createElement('span');
    t.className = 'nav-utility-tagline';
    t.textContent = tagline.textContent.trim();
    container.append(t);
  }

  const linksWrap = document.createElement('ul');
  linksWrap.className = 'nav-utility-links';
  const topUl = contentRoot.querySelector(':scope > ul');
  if (topUl) {
    const items = [...topUl.querySelectorAll(':scope > li')];
    items.forEach((li) => {
      if (li.querySelector(':scope > ul')) {
        linksWrap.append(buildDropdownItem(li));
      } else {
        // Plain link: direct child on local, or wrapped in <p> on published DA.
        const a = li.querySelector(':scope > a, :scope > p > a');
        if (a) {
          const outer = document.createElement('li');
          const link = a.cloneNode(true);
          link.className = 'nav-utility-link';
          if (/^https?:\/\//.test(link.getAttribute('href') || '')) {
            markNewTab(link);
          }
          outer.append(link);
          linksWrap.append(outer);
        }
      }
    });
  }
  container.append(linksWrap);
  bar.append(container);
  return bar;
}

/**
 * Builds the tools cluster (CTA pills) from the brand section.
 * @returns {HTMLElement} .nav-tools
 */
function buildTools(section) {
  const tools = document.createElement('div');
  tools.className = 'nav-tools';
  const contentRoot = section.querySelector('.default-content-wrapper') || section;
  const toolUl = contentRoot.querySelector(':scope > ul');
  if (toolUl) {
    [...toolUl.querySelectorAll(':scope > li > a')].forEach((a) => {
      const cta = a.cloneNode(true);
      cta.className = 'nav-tool-cta';
      tools.append(cta);
    });
  }
  return tools;
}

/**
 * Builds the mobile hamburger toggle (icon + persistent "Menu" label, as source).
 * @returns {HTMLElement} button.nav-hamburger
 */
function buildHamburger() {
  const hamburger = document.createElement('button');
  hamburger.type = 'button';
  hamburger.className = 'nav-hamburger';
  hamburger.setAttribute('aria-label', 'Toggle Menu');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.innerHTML = '<span class="nav-hamburger-icon"></span><span class="nav-hamburger-label">Menu</span>';
  return hamburger;
}

/**
 * Builds the primary nav links list from the nav-links section.
 * @returns {HTMLElement} ul.nav-links-list
 */
function buildNavLinksList(section) {
  const list = document.createElement('ul');
  list.className = 'nav-links-list';
  const contentRoot = section.querySelector('.default-content-wrapper') || section;
  const topUl = contentRoot.querySelector(':scope > ul');
  if (topUl) {
    const items = [...topUl.querySelectorAll(':scope > li')];
    items.forEach((li) => {
      if (li.querySelector(':scope > ul')) {
        list.append(buildDropdownItem(li));
      } else {
        // Plain link: direct child on local, or wrapped in <p> on published DA.
        const a = li.querySelector(':scope > a, :scope > p > a');
        if (a) {
          const outer = document.createElement('li');
          outer.className = 'nav-link-item';
          outer.append(a.cloneNode(true));
          list.append(outer);
        }
      }
    });
  }
  return list;
}

/**
 * Builds the LuMi AI Assistant widget: a circular avatar + label that toggles a
 * small popup ("Let LuMi help you today!" + Start chatting / Try later + close).
 * All copy/media come from the nav fragment's LuMi section (content-first).
 * @param {HTMLElement} section The LuMi fragment section
 * @returns {HTMLElement|null}
 */
function buildLumi(section) {
  if (!section) return null;
  const contentRoot = section.querySelector('.default-content-wrapper') || section;
  const paragraphs = [...contentRoot.querySelectorAll(':scope > p')];
  const avatarImg = contentRoot.querySelector('p img');
  if (!avatarImg) return null;
  // p[0]=avatar image, p[1]=button label, p[2]=popup title.
  const labelText = paragraphs[1] ? paragraphs[1].textContent.trim() : 'LuMi AI Assistant';
  const popupTitle = paragraphs[2] ? paragraphs[2].textContent.trim() : '';
  const popupLinks = [...contentRoot.querySelectorAll(':scope > ul > li > a')];

  const wrapper = document.createElement('div');
  wrapper.className = 'nav-lumi';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'nav-lumi-button';
  trigger.setAttribute('aria-expanded', 'false');
  const avatar = document.createElement('span');
  avatar.className = 'nav-lumi-avatar';
  avatar.append(avatarImg.cloneNode(true));
  const label = document.createElement('span');
  label.className = 'nav-lumi-label';
  label.textContent = labelText;
  trigger.append(avatar, label);
  wrapper.append(trigger);

  const popup = document.createElement('div');
  popup.className = 'nav-lumi-popup';
  popup.setAttribute('role', 'dialog');
  const header = document.createElement('div');
  header.className = 'nav-lumi-popup-header';
  const title = document.createElement('span');
  title.className = 'nav-lumi-popup-title';
  title.textContent = popupTitle;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'nav-lumi-popup-close';
  closeBtn.setAttribute('aria-label', 'Close');
  header.append(title, closeBtn);
  const actions = document.createElement('div');
  actions.className = 'nav-lumi-popup-actions';
  popupLinks.forEach((a) => {
    const btn = a.cloneNode(true);
    btn.className = 'nav-lumi-popup-btn';
    actions.append(btn);
  });
  popup.append(header, actions);
  wrapper.append(popup);

  const close = () => trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const open = trigger.getAttribute('aria-expanded') === 'true';
    trigger.setAttribute('aria-expanded', open ? 'false' : 'true');
  });
  closeBtn.addEventListener('click', (e) => { e.preventDefault(); close(); });
  const tryLater = actions.querySelector('a[href="#lumi-later"]');
  if (tryLater) tryLater.addEventListener('click', (e) => { e.preventDefault(); close(); });

  return wrapper;
}

/**
 * Builds the teal brand band as it appears on source: the logo sits on the left
 * and spans two stacked right-hand rows — tool CTAs on top, primary nav below.
 * @returns {HTMLElement|null}
 */
function decorateBrandBand(brandSection, navLinksSection, lumiSection) {
  if (!brandSection && !navLinksSection) return null;
  const band = document.createElement('div');
  band.className = 'nav-brand-row';
  const container = document.createElement('div');
  container.className = 'nav-brand-container';

  if (brandSection) {
    const contentRoot = brandSection.querySelector('.default-content-wrapper') || brandSection;
    const logoLink = contentRoot.querySelector('p a');
    if (logoLink) {
      const brand = document.createElement('div');
      brand.className = 'nav-brand';
      const link = logoLink.cloneNode(true);
      // Source swaps logos by breakpoint: white logo on the teal desktop band,
      // full-colour logo on the white mobile band. Keep the authored (white) img
      // for desktop and add a colour variant shown on mobile. The mobile <img>
      // must live OUTSIDE the authored <picture> — inside it the picture's
      // <source srcset> (the white PNG) would override the img's src. The SVG is
      // served from /icons/ (the only asset dir served on both local and EDS;
      // /content/images is not served on published EDS).
      const desktopImg = link.querySelector('img');
      if (desktopImg) {
        desktopImg.classList.add('nav-brand-logo-desktop');
        const mobileImg = document.createElement('img');
        mobileImg.className = 'nav-brand-logo-mobile';
        mobileImg.src = '/icons/logo-vyepti-mobile.svg';
        mobileImg.alt = desktopImg.alt || '';
        mobileImg.loading = desktopImg.loading || 'lazy';
        const picture = desktopImg.closest('picture');
        (picture || desktopImg).after(mobileImg);
      }
      brand.append(link);
      container.append(brand);
    }
  }

  const right = document.createElement('div');
  right.className = 'nav-brand-right';

  if (brandSection) {
    const toolsRow = document.createElement('div');
    toolsRow.className = 'nav-tools-row';
    toolsRow.append(buildTools(brandSection));
    right.append(toolsRow);
  }

  if (navLinksSection) {
    const linksRow = document.createElement('div');
    linksRow.className = 'nav-links-row';
    linksRow.append(buildNavLinksList(navLinksSection));
    // LuMi AI Assistant sits to the right of the primary nav links (as on source).
    const lumi = buildLumi(lumiSection);
    if (lumi) linksRow.append(lumi);
    right.append(linksRow);
  }

  container.append(right);
  // Hamburger lives on the top bar (beside the logo) on mobile; the right column
  // (CTAs + nav links) becomes the collapsible menu it toggles.
  container.append(buildHamburger());
  band.append(container);
  return band;
}

/**
 * loads and decorates the header
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const navMeta = getMetadata('nav');
  // Local (aem up) serves the nav fragment under /content; DA/EDS production serves
  // it at /nav. Try the metadata-provided path first, then /content/nav (local),
  // then /nav (production) — first one that loads wins.
  const candidates = [];
  if (navMeta) candidates.push(new URL(navMeta, window.location).pathname);
  candidates.push('/content/nav', '/nav');
  let fragment = null;
  for (let i = 0; i < candidates.length && !fragment; i += 1) {
     
    fragment = await loadFragment(candidates[i]);
  }

  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Main navigation');

  const sections = [...fragment.children];
  // Fragment order: [0] HCP bar, [1] utility bar, [2] brand+tools, [3] primary nav,
  // [4] LuMi AI Assistant. Brand + primary nav combine into one teal band.
  const [hcpSection, utilitySection, brandSection, navLinksSection, lumiSection] = sections;

  const hcpBar = decorateHcpBar(hcpSection);
  if (hcpBar) nav.append(hcpBar);
  const utilityBar = decorateUtilityBar(utilitySection);
  if (utilityBar) nav.append(utilityBar);
  // Source renders the teal band as ONE row: logo on the left spanning two
  // stacked right-hand rows (tool CTAs over primary nav links + LuMi widget).
  const brandBand = decorateBrandBand(brandSection, navLinksSection, lumiSection);
  if (brandBand) nav.append(brandBand);

  // Hamburger toggles the mobile nav-links drawer.
  const hamburger = nav.querySelector('.nav-hamburger');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      const expanded = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      nav.classList.toggle('nav-mobile-open', !expanded);
    });
  }

  // Close dropdowns on Escape / outside click.
  const closeAll = () => nav.querySelectorAll('[aria-expanded="true"]').forEach((el) => {
    if (el.classList.contains('nav-dropdown')) el.setAttribute('aria-expanded', 'false');
  });
  window.addEventListener('keydown', (e) => { if (e.code === 'Escape') closeAll(); });
  document.addEventListener('click', (e) => { if (!nav.contains(e.target)) closeAll(); });

  // LuMi lives in the primary-nav row on desktop; on mobile that row collapses
  // into the hamburger drawer, so move the LuMi avatar onto the top bar (just
  // left of the hamburger) as the source does. Keep a marker of its desktop home.
  const lumi = nav.querySelector('.nav-lumi');
  const lumiDesktopHome = lumi ? lumi.parentElement : null;
  const desktopMq = window.matchMedia('(min-width: 900px)');
  const placeLumi = (atDesktop) => {
    if (!lumi) return;
    if (atDesktop) {
      if (lumiDesktopHome && lumi.parentElement !== lumiDesktopHome) lumiDesktopHome.append(lumi);
    } else if (hamburger && lumi.nextElementSibling !== hamburger) {
      hamburger.before(lumi);
    }
  };
  placeLumi(desktopMq.matches);

  // Reset mobile state when resizing up to desktop.
  desktopMq.addEventListener('change', (mq) => {
    placeLumi(mq.matches);
    if (mq.matches) {
      nav.classList.remove('nav-mobile-open');
      if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    }
  });

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
