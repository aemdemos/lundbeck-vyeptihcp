import { getBlockId } from '../../scripts/scripts.js';

const TICK_ICON_SRC = '/media-da/patient-profiles/tick-icon-90771810.png';

function cellText(cell) {
  return cell ? cell.textContent.trim() : '';
}

/**
 * @param {Element} block
 * @param {Element} tablist
 */
function ensureTablistClickDelegation(block, tablist) {
  if (tablist.dataset.clickDelegated === 'true') return;
  tablist.dataset.clickDelegated = 'true';
  tablist.addEventListener('click', (e) => {
    const button = e.target.closest('button.case-study-tabs-tab');
    if (!button || !tablist.contains(button)) return;
    const panelId = button.getAttribute('aria-controls');
    const panel = panelId && document.getElementById(panelId);
    if (!panel || !block.contains(panel)) return;

    block.querySelectorAll('.case-study-tabs-panel').forEach((p) => {
      p.setAttribute('aria-hidden', 'true');
    });
    tablist.querySelectorAll('button.case-study-tabs-tab').forEach((btn) => {
      btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('tabindex', '-1');
    });
    panel.setAttribute('aria-hidden', 'false');
    button.setAttribute('aria-selected', 'true');
    button.setAttribute('tabindex', '0');
  });
}

/**
 * Builds the tab selector button (profile image, name, age, description).
 * @param {Element} cell authored cell containing a picture, heading (name), and
 *   two paragraphs (age, description) as sibling elements
 * @returns {Element}
 */
function buildTab(cell) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'case-study-tabs-tab';
  button.setAttribute('role', 'tab');

  const selector = document.createElement('span');
  selector.className = 'case-study-tabs-selector';

  const img = cell && cell.querySelector('img');
  if (img) {
    img.classList.add('case-study-tabs-avatar');
    selector.append(img);
  }

  const headingEl = cell && cell.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6');
  const [ageEl, descEl] = cell ? [...cell.querySelectorAll(':scope > p')] : [];

  const info = document.createElement('span');
  info.className = 'case-study-tabs-selector-info';

  const name = document.createElement('span');
  name.className = 'case-study-tabs-name';
  name.textContent = cellText(headingEl);

  const age = document.createElement('span');
  age.className = 'case-study-tabs-age';
  age.textContent = cellText(ageEl);

  const desc = document.createElement('span');
  desc.className = 'case-study-tabs-desc';
  desc.textContent = cellText(descEl);

  info.append(name, age, desc);
  selector.append(info);
  button.append(selector);

  button.setAttribute('aria-label', [name.textContent, age.textContent, desc.textContent].filter(Boolean).join(', '));

  return button;
}

/**
 * Splits a column's children on the authored <hr> into heading elements (before
 * the rule) and content elements (after it).
 * @param {Element} cell
 * @returns {[Element[], Element[]]}
 */
function splitOnRule(cell) {
  const children = cell ? [...cell.children] : [];
  const hrIndex = children.findIndex((el) => el.tagName === 'HR');
  if (hrIndex === -1) return [[], children];
  return [children.slice(0, hrIndex), children.slice(hrIndex + 1)];
}

/**
 * Builds the "Previous treatment experience" box. The heading precedes an <hr>;
 * each paragraph after it becomes one column, with the bold lead as the label
 * and the rest as the value.
 * @param {Element} cell authored column: heading, <hr>, then one <p> per treatment column
 */
function buildExperience(cell) {
  const box = document.createElement('div');
  box.className = 'case-study-tabs-experience';

  const [headingEls, contentEls] = splitOnRule(cell);
  const headingText = headingEls.map((el) => el.textContent.trim()).join(' ');
  if (headingText) {
    const heading = document.createElement('h3');
    heading.className = 'case-study-tabs-experience-heading';
    heading.textContent = headingText;
    box.append(heading);
  }

  const cols = document.createElement('div');
  cols.className = 'case-study-tabs-experience-cols';

  const paragraphs = contentEls.filter((el) => el.tagName === 'P');
  paragraphs.forEach((p) => {
    const col = document.createElement('div');
    col.className = 'case-study-tabs-experience-col';
    const lead = p.querySelector(':scope > strong, :scope > b');
    if (lead) {
      const strong = document.createElement('strong');
      strong.textContent = lead.textContent.trim();
      col.append(strong);
      const value = p.textContent.replace(lead.textContent, '').trim();
      if (value) {
        const span = document.createElement('span');
        span.textContent = value;
        col.append(span);
      }
    } else {
      const span = document.createElement('span');
      span.textContent = p.textContent.trim();
      col.append(span);
    }
    cols.append(col);
  });

  box.append(cols);
  return box;
}

export default function decorate(block) {
  const blockId = getBlockId('case-study-tabs');
  block.id = blockId;
  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'Case study tabs');

  const tablist = document.createElement('div');
  tablist.className = 'case-study-tabs-list';
  tablist.setAttribute('role', 'tablist');

  const panels = document.createDocumentFragment();

  const rows = [...block.children];
  rows.forEach((row, i) => {
    const [infoCell, caseCell, expCell, goalsCell] = [...row.children];

    const tabId = `${blockId}-tab-${i}`;
    const panelId = `${blockId}-panel-${i}`;
    const selected = i === 0;

    const button = buildTab(infoCell);
    button.id = tabId;
    button.setAttribute('aria-controls', panelId);
    button.setAttribute('aria-selected', String(selected));
    button.setAttribute('tabindex', selected ? '0' : '-1');
    tablist.append(button);

    // Reuse the authored row as the panel so Universal Editor instrumentation is preserved.
    const panel = row;
    panel.className = 'case-study-tabs-panel';
    panel.id = panelId;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tabId);
    panel.setAttribute('aria-hidden', String(!selected));

    const caseStudy = document.createElement('div');
    caseStudy.className = 'case-study-tabs-case';
    if (caseCell) while (caseCell.firstChild) caseStudy.append(caseCell.firstChild);

    const experience = buildExperience(expCell);

    const goals = document.createElement('div');
    goals.className = 'case-study-tabs-goals';

    // Icon, heading and bullets are direct grid children so their placement can
    // change per breakpoint (icon+heading row on mobile; heading on top with
    // icon beside the bullets on desktop).
    const goalsIcon = document.createElement('img');
    goalsIcon.className = 'case-study-tabs-goals-icon';
    goalsIcon.src = TICK_ICON_SRC;
    goalsIcon.alt = '';
    goalsIcon.setAttribute('loading', 'lazy');
    goals.append(goalsIcon);

    const [goalsHeadEls, goalsContentEls] = splitOnRule(goalsCell);
    const goalsHeadText = goalsHeadEls.map((el) => el.textContent.trim()).join(' ');
    if (goalsHeadText) {
      const heading = document.createElement('h3');
      heading.className = 'case-study-tabs-goals-heading';
      heading.textContent = goalsHeadText;
      goals.append(heading);
    }

    const goalsContent = document.createElement('div');
    goalsContent.className = 'case-study-tabs-goals-content';
    goalsContentEls.forEach((el) => goalsContent.append(el));
    goals.append(goalsContent);

    panel.replaceChildren(caseStudy, experience, goals);
    panels.append(panel);
  });

  ensureTablistClickDelegation(block, tablist);

  block.replaceChildren(tablist, panels);
}
