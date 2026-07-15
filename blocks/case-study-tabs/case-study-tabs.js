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
 * @param {Element} imgCell
 * @param {Element} nameCell
 * @param {Element} ageCell
 * @param {Element} descCell
 * @returns {Element}
 */
function buildTab(imgCell, nameCell, ageCell, descCell) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'case-study-tabs-tab';
  button.setAttribute('role', 'tab');

  const selector = document.createElement('span');
  selector.className = 'case-study-tabs-selector';

  const img = imgCell && imgCell.querySelector('img');
  if (img) {
    img.classList.add('case-study-tabs-avatar');
    selector.append(img);
  }

  const info = document.createElement('span');
  info.className = 'case-study-tabs-selector-info';

  const name = document.createElement('span');
  name.className = 'case-study-tabs-name';
  name.textContent = cellText(nameCell);

  const age = document.createElement('span');
  age.className = 'case-study-tabs-age';
  age.textContent = cellText(ageCell);

  const desc = document.createElement('span');
  desc.className = 'case-study-tabs-desc';
  desc.textContent = cellText(descCell);

  info.append(name, age, desc);
  selector.append(info);
  button.append(selector);

  button.setAttribute('aria-label', [name.textContent, age.textContent, desc.textContent].filter(Boolean).join(', '));

  return button;
}

/**
 * Builds the "Previous treatment experience" box. Each paragraph in the authored
 * rich text becomes one column; the bold lead is the label, the rest is the value.
 * @param {string} headingText
 * @param {Element} contentCell authored rich text (one <p> per treatment column)
 */
function buildExperience(headingText, contentCell) {
  const box = document.createElement('div');
  box.className = 'case-study-tabs-experience';

  if (headingText) {
    const heading = document.createElement('h3');
    heading.className = 'case-study-tabs-experience-heading';
    heading.textContent = headingText;
    box.append(heading);
  }

  const cols = document.createElement('div');
  cols.className = 'case-study-tabs-experience-cols';

  const paragraphs = contentCell ? [...contentCell.querySelectorAll(':scope > p')] : [];
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
    const [
      imgCell, nameCell, ageCell, descCell, caseCell,
      expHeadCell, expContentCell,
      goalsHeadCell, goalsCell,
    ] = [...row.children];

    const tabId = `${blockId}-tab-${i}`;
    const panelId = `${blockId}-panel-${i}`;
    const selected = i === 0;

    const button = buildTab(imgCell, nameCell, ageCell, descCell);
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

    const experience = buildExperience(cellText(expHeadCell), expContentCell);

    const goals = document.createElement('div');
    goals.className = 'case-study-tabs-goals';

    // Header row: tick icon + heading side by side (icon hidden on desktop, per source).
    const goalsHeader = document.createElement('div');
    goalsHeader.className = 'case-study-tabs-goals-header';
    const goalsIcon = document.createElement('img');
    goalsIcon.className = 'case-study-tabs-goals-icon';
    goalsIcon.src = TICK_ICON_SRC;
    goalsIcon.alt = '';
    goalsIcon.setAttribute('loading', 'lazy');
    goalsHeader.append(goalsIcon);
    const goalsHeadText = cellText(goalsHeadCell);
    if (goalsHeadText) {
      const heading = document.createElement('h3');
      heading.className = 'case-study-tabs-goals-heading';
      heading.textContent = goalsHeadText;
      goalsHeader.append(heading);
    }
    goals.append(goalsHeader);

    const goalsContent = document.createElement('div');
    goalsContent.className = 'case-study-tabs-goals-content';
    if (goalsCell) while (goalsCell.firstChild) goalsContent.append(goalsCell.firstChild);
    goals.append(goalsContent);

    panel.replaceChildren(caseStudy, experience, goals);
    panels.append(panel);
  });

  ensureTablistClickDelegation(block, tablist);

  block.replaceChildren(tablist, panels);
}
