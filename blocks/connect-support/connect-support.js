import { getBlockId } from '../../scripts/scripts.js';

/**
 * Connect support — the bespoke "VYEPTI CONNECT tailored support" composite
 * widget: a pale-blue box (lead sentence + 4 icon items), directly followed
 * by an attached two-tone banner (enrollment CTA line on teal, then a note +
 * 2-col contact info + fine print on pale blue). Kept as one block because
 * the three sub-panels are visually fused (no gap between enroll and note —
 * same rounded pill).
 *
 * Authoring rows (positional):
 *   1. lead sentence cell
 *   2-5. one row per icon item — 2 cells: [icon], [description]
 *   6. enroll cell — "download the enrollment form" paragraph
 *   7. note cell — intro + "Note:" paragraphs
 *   8. contact-info row — 2 cells: [fax], [call]
 *   9. fine print cell
 *
 * @param {HTMLElement} block
 */
function cellsOf(row) {
  return row ? [...row.children] : [];
}

export default function decorate(block) {
  const blockId = getBlockId('connect-support');
  block.setAttribute('id', blockId);
  block.setAttribute('aria-label', `connect-support-${blockId}`);
  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'Connect support');

  const rows = [...block.children];
  const [leadRow, r1, r2, r3, r4, enrollRow, noteRow, colsRow, fineRow] = rows;
  const itemRows = [r1, r2, r3, r4];

  const box = document.createElement('div');
  box.className = 'connect-support-box';

  if (leadRow) {
    const cell = leadRow.firstElementChild;
    const src = cell?.querySelector('h1, h2, h3, h4, h5, h6') || cell;
    const lead = document.createElement('h5');
    lead.className = 'connect-support-lead';
    if (src) lead.append(...src.childNodes);
    box.append(lead);
  }

  const grid = document.createElement('div');
  grid.className = 'connect-support-grid';
  itemRows.forEach((row) => {
    if (!row) return;
    const [iconCell, textCell] = cellsOf(row);
    const item = document.createElement('div');
    item.className = 'connect-support-item';
    const pic = iconCell?.querySelector('picture, img');
    if (pic) item.append(pic);
    if (textCell) {
      textCell.className = 'connect-support-item-text';
      item.append(textCell);
    }
    grid.append(item);
  });
  box.append(grid);

  const enroll = document.createElement('div');
  enroll.className = 'connect-support-enroll';
  if (enrollRow?.firstElementChild) enroll.append(...enrollRow.firstElementChild.childNodes);

  const note = document.createElement('div');
  note.className = 'connect-support-note';
  if (noteRow?.firstElementChild) note.append(...noteRow.firstElementChild.childNodes);

  if (colsRow) {
    const cols = document.createElement('div');
    cols.className = 'connect-support-cols';
    cellsOf(colsRow).forEach((cell) => {
      cell.classList.add('connect-support-col');
      cols.append(cell);
    });
    note.append(cols);
  }

  if (fineRow?.firstElementChild) {
    const fine = fineRow.firstElementChild;
    fine.classList.add('connect-support-fine');
    note.append(fine);
  }

  block.replaceChildren(box, enroll, note);
}
