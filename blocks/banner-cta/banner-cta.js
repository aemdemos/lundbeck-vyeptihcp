/**
 * Splits the authored icon from the text/CTA content into two sibling
 * elements, so CSS can lay them out side by side (matching source) instead
 * of stacked (the default from a single authored cell).
 * @param {Element} row
 */
function splitIconFromContent(row) {
  const cell = row.querySelector(':scope > div');
  if (!cell) return;

  const iconPara = [...cell.children].find((p) => p.querySelector('picture'));
  if (!iconPara) return;

  const icon = document.createElement('div');
  icon.className = 'banner-cta-icon';
  icon.append(iconPara.querySelector('picture'));

  const content = document.createElement('div');
  content.className = 'banner-cta-content';
  content.append(...[...cell.children].filter((el) => el !== iconPara));

  cell.replaceChildren(icon, content);
}

/**
 * Appends an arrow-button div after the content, reusing the first link found
 * in the block for its href/label. If no link exists, no arrow div is added.
 * @param {Element} block
 */
export default function decorate(block) {
  const row = block.querySelector(':scope > div') || block;
  splitIconFromContent(row);

  const link = block.querySelector('a[href]');
  if (!link) return;

  const arrow = document.createElement('div');
  arrow.className = 'banner-cta-arrow';

  const arrowLink = document.createElement('a');
  arrowLink.href = link.href;
  if (link.title) arrowLink.title = link.title;
  const label = link.getAttribute('aria-label') || link.textContent.trim();
  if (label) arrowLink.setAttribute('aria-label', label);

  arrow.append(arrowLink);
  row.append(arrow);
}
