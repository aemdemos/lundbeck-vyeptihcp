import { moveInstrumentation } from '../../scripts/scripts.js';
import { pushAccordionExpansionEventToDataLayer } from '../../scripts/datalayer.js';

function isEmpty(cell) {
  return !cell || (!cell.firstElementChild && !cell.textContent.trim());
}

/** Reads the label text of an accordion item. */
function getAccordionName(li) {
  const label = li.querySelector(':scope > .accordion-item-label');
  return label ? label.textContent.trim() : '';
}

/** Nearest enclosing accordion item's name, or null if not nested. */
function getParentAccordionName(li) {
  const parentItem = li.parentElement && li.parentElement.closest('.accordion-item');
  return parentItem ? getAccordionName(parentItem) : null;
}

function buildAccordionItem(row, label, body) {
  const li = document.createElement('li');
  li.className = 'accordion-item';
  moveInstrumentation(row, li);
  if (label) li.append(label);
  if (body) li.append(body);

  if (label) {
    label.className = 'accordion-item-label';

    // Convention: author bolds the lead phrase; the remaining inline content
    // becomes the "detail", which is collapsed on mobile and revealed on tablet up.
    const labelText = label.querySelector('p') || label;
    const lead = labelText.querySelector(':scope > strong, :scope > b');
    if (lead && lead.nextSibling) {
      const detail = document.createElement('span');
      detail.className = 'accordion-item-label-detail';
      let node = lead.nextSibling;
      while (node) {
        const next = node.nextSibling;
        detail.append(node);
        node = next;
      }
      if (detail.textContent.trim()) labelText.append(detail);
    }
  }
  if (body) body.className = 'accordion-item-body';

  // The whole card toggles the item; clicks inside the open body are ignored
  // so links stay clickable and body text stays selectable.
  li.addEventListener('click', (e) => {
    if (body && body.contains(e.target)) return;
    li.classList.toggle('active');
    // Analytics: fire only when the item was just expanded (matches AMS aria-expanded guard).
    if (li.classList.contains('active')) {
      pushAccordionExpansionEventToDataLayer({
        clickedAccordionName: getAccordionName(li),
        parentAccordionName: getParentAccordionName(li),
      });
    }
  });

  return li;
}

// Drops any tracked depth >= the given depth, since a new item at that depth
// starts a fresh nesting branch and stale deeper tracking no longer applies.
function truncateDepth(map, depth) {
  [...map.keys()].filter((k) => k >= depth).forEach((k) => map.delete(k));
}

export default function decorate(block) {
  const rootUl = document.createElement('ul');
  const sublistAtDepth = new Map();
  const lastItemAtDepth = new Map();

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    const depth = cells.findIndex((cell) => !isEmpty(cell));
    if (depth === -1) return;

    const li = buildAccordionItem(row, cells[depth], cells[depth + 1]);
    const parentItem = depth > 0 ? lastItemAtDepth.get(depth - 1) : null;
    const parentBody = parentItem?.querySelector(':scope > .accordion-item-body');

    if (depth === 0 || !parentBody) {
      // depth 0, or malformed authoring (nested row with no parent) — top level.
      rootUl.append(li);
      sublistAtDepth.clear();
      lastItemAtDepth.clear();
      lastItemAtDepth.set(0, li);
    } else {
      let ul = sublistAtDepth.get(depth);
      if (!ul || !parentBody.contains(ul)) {
        ul = document.createElement('ul');
        ul.className = 'accordion-sublist';
        parentBody.append(ul);
        sublistAtDepth.set(depth, ul);
      }
      ul.append(li);
      truncateDepth(lastItemAtDepth, depth);
      lastItemAtDepth.set(depth, li);
    }
  });

  block.textContent = '';
  block.append(rootUl);
}
