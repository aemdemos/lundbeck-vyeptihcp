import { moveInstrumentation } from '../../scripts/scripts.js';
import { setupVideoPlayer } from '../video/video.js';

/** Detects links the video player can embed (YouTube, Vimeo, or a direct video file). */
function isVideoLink(href) {
  return /youtube\.com|youtu\.be|vimeo\.com|\.(mp4|webm|ogv|mov)(\?|#|$)/i.test(href);
}

/**
 * Replaces a card cell that holds a video link with an embedded player. Uses any
 * <picture> in the cell as the click-to-play thumbnail.
 * @param {Element} cell - the card body/image div containing the video link
 */
function decorateVideoCell(cell) {
  const anchor = [...cell.querySelectorAll('a[href]')].find((a) => isVideoLink(a.href));
  if (!anchor) return false;
  const link = anchor.href;
  const placeholder = cell.querySelector('picture');
  cell.textContent = '';
  cell.className = 'cards-card-video';
  setupVideoPlayer(cell, link, { placeholder });
  return true;
}

/**
 * Builds a single card (li) from a block row: moves content into the li and applies
 * cards-card-image / cards-card-body classes to its children.
 * @param {Element} row - A direct child of the cards block (author row)
 * @param {Object} [options]
 * @param {boolean} [options.video=false] - detect a video link in a cell and embed a player
 * @returns {Element} The card li element
 */
/* eslint-disable import/prefer-default-export */
export function createCard(row, { video = false } = {}) {
  const li = document.createElement('li');
  moveInstrumentation(row, li);
  while (row.firstElementChild) li.append(row.firstElementChild);
  [...li.children].forEach((div) => {
    if (video && decorateVideoCell(div)) return;
    if (div.children.length === 1 && div.querySelector('picture')) div.className = 'cards-card-image';
    else div.className = 'cards-card-body';
  });
  return li;
}
