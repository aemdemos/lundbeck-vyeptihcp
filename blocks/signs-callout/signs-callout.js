/**
 * signs-callout — a standalone filled teal stat callout (e.g. the patient-profiles
 * "82%" survey figure) that follows the icon-feature cards. Content is a short run
 * of paragraphs; all presentation is handled in signs-callout.css. The block exists
 * so EDS decorates the wrapper (rather than treating the div as default content) and
 * the scoped styles apply.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  block.setAttribute('role', 'note');
}
