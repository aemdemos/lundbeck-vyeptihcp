/* eslint-disable */
/* global WebImporter */
/**
 * Parser for table. Base: table (blocks/table).
 * Source: https://www.vyeptihcp.com/safety-and-tolerability (adverse-reaction data tables).
 *
 * EDS `table` convention: first block row = block name (+ optional variant), each subsequent
 * row = a data row, cells across columns hold data points/headers. The table block builds a
 * real <table> from those rows (first row → header unless the "no header" variant is set).
 *
 * Source tables are AEM "dosing-safety-table-wrapper" tables: <table><tbody> of <tr>, all
 * cells <td> (no <thead>/<th>), with EMPTY SPACER columns (…__empty-column / &nbsp;) interleaved
 * between real data columns for visual gutters. We drop the spacer cells and emit one block row
 * per source row, one cell per real column, preserving inner content (headings, <span>,
 * footnote markers). The first source row (VYEPTI 100/300/Placebo dose labels) becomes the
 * header row.
 */
function isSpacer(td) {
  if (td.classList && td.classList.contains('dosing-safety-table-wrapper__empty-column')) return true;
  const txt = (td.textContent || '').replace(/ /g, ' ').trim();
  return txt === '' && !td.querySelector('img, picture, h1, h2, h3, h4, h5, h6');
}

export default function parse(element, { document }) {
  const table = element.matches('table') ? element : element.querySelector('table');
  if (!table) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const rows = [...table.querySelectorAll(':scope > tbody > tr, :scope > tr')];
  const cells = [];
  rows.forEach((tr) => {
    const kept = [...tr.children].filter((td) => !isSpacer(td));
    if (kept.length === 0) return;
    cells.push(kept.map((td) => ({ elems: [...td.childNodes] })));
  });

  if (cells.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  const block = WebImporter.Blocks.createBlock(document, { name: 'table', cells });
  element.replaceWith(block);
}
