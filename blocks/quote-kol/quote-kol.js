import { getBlockId, ensureDOMPurify } from '../../scripts/scripts.js';
import { DOMPURIFY } from '../../scripts/aem.js';

/**
 * KOL quote variant: a physician headshot sits alongside a pull-quotation and
 * attribution. Row order authored as: [image] / [quotation] / [attribution].
 * The image row is optional; when absent this behaves like the base quote block.
 * @param {Element} block
 */
export default async function decorate(block) {
  const blockId = getBlockId('quote-kol');
  block.setAttribute('id', blockId);
  block.setAttribute('aria-label', `quote-kol-${blockId}`);
  block.setAttribute('role', 'region');
  block.setAttribute('aria-roledescription', 'Quote');

  const rows = [...block.children].map((c) => c.firstElementChild);

  // Detect a leading headshot image row.
  let headshot = null;
  if (rows[0] && rows[0].querySelector('picture, img')) {
    [headshot] = rows.splice(0, 1);
  }

  const [quotation, attribution] = rows;

  const blockquote = document.createElement('blockquote');

  if (quotation) {
    quotation.className = 'quote-kol-quotation';
    blockquote.append(quotation);
  }

  if (attribution) {
    attribution.className = 'quote-kol-attribution';
    blockquote.append(attribution);
    await ensureDOMPurify();
    attribution.querySelectorAll('em').forEach((em) => {
      const cite = document.createElement('cite');
      cite.innerHTML = window.DOMPurify.sanitize(em.innerHTML, DOMPURIFY);
      em.replaceWith(cite);
    });
  }

  block.innerHTML = '';

  if (headshot) {
    const figure = headshot.querySelector('picture') || headshot.querySelector('img');
    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'quote-kol-image';
    imageWrapper.append(figure || headshot);
    block.append(imageWrapper);
  }

  const content = document.createElement('div');
  content.className = 'quote-kol-content';
  content.append(blockquote);
  block.append(content);
}
