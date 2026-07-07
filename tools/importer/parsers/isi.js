/* eslint-disable */
/* global WebImporter */
/**
 * Parser for isi. Base: isi (custom block — no library convention).
 * Source: https://vyeptihcp-stage.d.lundbeckus.com/
 *
 * The isi block (blocks/isi/isi.js) expects two authored rows:
 *   Row 1 – abbreviated content shown in the persistent fixed bottom bar:
 *           the title ("IMPORTANT SAFETY INFORMATION AND INDICATION") + the
 *           CONTRAINDICATIONS lead paragraph.
 *   Row 2 – the full inline content: every heading + paragraph, including the
 *           INDICATION section with its two external PDF links.
 *
 * Both rows are single-cell (1-column) rows. Nodes are cloned so the same source
 * content can appear in both the abbreviated bar and the full inline body.
 */
export default function parse(element, { document }) {
  // The full content lives in .isi-full (fall back to the element itself).
  const source = element.querySelector('.isi-full') || element;
  const nodes = Array.from(source.children).filter(
    (n) => n.textContent.trim() || n.querySelector('img, a'),
  );

  // Empty-block guard.
  if (nodes.length === 0) {
    element.replaceWith(...element.childNodes);
    return;
  }

  // ── Row 1: abbreviated bar content ────────────────────────────
  // Title = first heading. CONTRAINDICATIONS lead = the heading whose text is
  // "CONTRAINDICATIONS" plus the paragraph immediately following it.
  const abbreviated = [];
  const title = nodes.find((n) => /^h[1-6]$/i.test(n.tagName));
  if (title) abbreviated.push(title.cloneNode(true));

  const contraIdx = nodes.findIndex(
    (n) => /^h[1-6]$/i.test(n.tagName) && n.textContent.trim().toUpperCase() === 'CONTRAINDICATIONS',
  );
  if (contraIdx !== -1) {
    abbreviated.push(nodes[contraIdx].cloneNode(true));
    const lead = nodes[contraIdx + 1];
    if (lead && lead.tagName.toLowerCase() === 'p') abbreviated.push(lead.cloneNode(true));
  }

  // Fallback: if we could not isolate the CONTRAINDICATIONS lead, use the first
  // paragraph after the title so the bar is never empty.
  if (abbreviated.length <= 1) {
    const firstP = nodes.find((n) => n.tagName.toLowerCase() === 'p');
    if (firstP) abbreviated.push(firstP.cloneNode(true));
  }

  // ── Row 2: full inline content ────────────────────────────────
  const full = nodes.map((n) => n.cloneNode(true));

  const cells = [
    [abbreviated],
    [full],
  ];

  const block = WebImporter.Blocks.createBlock(document, { name: 'isi', cells });
  element.replaceWith(block);
}
