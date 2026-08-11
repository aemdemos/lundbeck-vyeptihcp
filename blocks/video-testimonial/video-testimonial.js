/*
 * Video Testimonial Block
 * A patient testimonial laid out as two columns: a text column (heading, quote,
 * call-to-action, disclaimer) beside an embedded Brightcove video. Stacks to a
 * single column on mobile (heading → video → quote → CTA → disclaimer).
 */

import { getBrightcoveIds, getBrightcoveScriptTag } from '../../scripts/utils.js';

/**
 * Builds a Brightcove <video-js> player element for the given ids.
 * @param {{accountId: string, playerId: string, videoId: string}} ids
 * @returns {HTMLElement}
 */
function createBrightcovePlayer({ accountId, playerId, videoId }) {
  const player = document.createElement('video-js');
  player.className = 'video-js';
  player.id = `bc-${accountId}-${videoId}`;
  player.setAttribute('controls', '');
  player.setAttribute('playsinline', '');
  player.setAttribute('data-account', accountId);
  player.setAttribute('data-player', playerId);
  player.setAttribute('data-video-id', videoId);
  player.setAttribute('data-embed', 'default');
  return player;
}

/**
 * @param {Element} block The block element
 */
export default async function decorate(block) {
  const content = block.querySelector(':scope > div > div') ?? block;

  const title = content.querySelector('h3');
  const quote = content.querySelector('h4');
  const smallText = content.querySelector('.small-text');
  const disclaimer = smallText ? smallText.closest('p') : null;

  const anchors = [...content.querySelectorAll('a[href]')];
  const isBrightcove = (a) => {
    try {
      return new URL(a.href).hostname.includes('brightcove');
    } catch {
      return false;
    }
  };
  // The CTA link carries the "watch the video" label; the plain URL-display link is the source.
  const watchLink = anchors.find((a) => /watch the video/i.test(a.textContent));
  const videoAnchor = anchors.find((a) => isBrightcove(a) && a !== watchLink)
    ?? anchors.find(isBrightcove);

  // Media column — embed the Brightcove player (poster + play button), matching the source.
  const media = document.createElement('div');
  media.className = 'video-testimonial-media';
  let playerEl = null;
  if (videoAnchor) {
    const ids = getBrightcoveIds(new URL(videoAnchor.href));
    if (ids) {
      playerEl = createBrightcovePlayer(ids);
      media.append(playerEl);
      getBrightcoveScriptTag(ids.accountId, ids.playerId);
    } else {
      // Unknown provider — keep the original link so the video stays reachable.
      media.append(videoAnchor);
    }
  }

  // Tag the text elements so CSS can place them via the grid areas.
  if (title) title.classList.add('video-testimonial-title');
  if (quote) quote.classList.add('video-testimonial-quote');
  if (disclaimer) disclaimer.classList.add('video-testimonial-disclaimer');
  if (watchLink) {
    // Use the site's global primary button styling; the block only adds layout.
    watchLink.classList.add('button', 'primary', 'video-testimonial-cta');
    // Normalise the label (drops the authored <strong>); the button styles handle weight.
    watchLink.textContent = watchLink.textContent.trim();
  }

  // Flat DOM order = mobile stacking order: title, video, quote, CTA, disclaimer.
  block.textContent = '';
  if (title) block.append(title);
  block.append(media);
  if (quote) block.append(quote);
  if (watchLink) block.append(watchLink);
  if (disclaimer) block.append(disclaimer);

  // Progressive enhancement: the CTA plays the embedded player instead of leaving the page.
  if (watchLink && playerEl) {
    watchLink.addEventListener('click', (e) => {
      e.preventDefault();
      media.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const bigPlay = playerEl.querySelector('.vjs-big-play-button');
      if (bigPlay) {
        bigPlay.click();
        return;
      }
      const player = window.videojs?.getPlayer?.(playerEl.id);
      if (player) player.play();
    });
  }
}
