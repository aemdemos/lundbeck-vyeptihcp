/*
 * Video Block
 * Show a video referenced by a link
 * https://www.hlx.live/developer/block-collection/video
 */

import { ensureDOMPurify } from '../../scripts/scripts.js';
import { DOMPURIFY } from '../../scripts/aem.js';
import { getYoutubeEmbedHtml, getVimeoEmbedHtml } from '../../scripts/utils.js';

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// The shared DOMPURIFY profile strips <iframe>, which the YouTube/Vimeo embeds rely on.
const VIDEO_DOMPURIFY = {
  ...DOMPURIFY,
  ADD_TAGS: ['iframe'],
  ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling'],
};

async function htmlToElement(html) {
  await ensureDOMPurify();
  const temp = document.createElement('div');
  temp.innerHTML = window.DOMPurify.sanitize(html, VIDEO_DOMPURIFY);
  return temp.firstElementChild;
}

function getVideoElement(source, autoplay, background) {
  const video = document.createElement('video');
  video.setAttribute('controls', '');
  if (autoplay) video.setAttribute('autoplay', '');
  if (background) {
    video.setAttribute('loop', '');
    video.setAttribute('playsinline', '');
    video.removeAttribute('controls');
    video.addEventListener('canplay', () => {
      video.muted = true;
      if (autoplay) video.play();
    });
  }

  const sourceEl = document.createElement('source');
  sourceEl.setAttribute('src', source);
  sourceEl.setAttribute('type', `video/${source.split('.').pop()}`);
  video.append(sourceEl);

  return video;
}

const loadVideoEmbed = async (block, link, autoplay, background) => {
  if (block.dataset.embedLoaded === 'true') {
    return;
  }
  const url = new URL(link);

  const isYoutube = link.includes('youtube') || link.includes('youtu.be');
  const isVimeo = link.includes('vimeo');

  if (isYoutube) {
    const embedWrapper = await htmlToElement(getYoutubeEmbedHtml(url, autoplay, background));
    block.append(embedWrapper);
    embedWrapper.querySelector('iframe').addEventListener('load', () => {
      block.dataset.embedLoaded = true;
    });
  } else if (isVimeo) {
    const embedWrapper = await htmlToElement(getVimeoEmbedHtml(url, autoplay, background));
    block.append(embedWrapper);
    embedWrapper.querySelector('iframe').addEventListener('load', () => {
      block.dataset.embedLoaded = true;
    });
  } else {
    const videoEl = getVideoElement(link, autoplay, background);
    block.append(videoEl);
    videoEl.addEventListener('canplay', () => {
      block.dataset.embedLoaded = true;
    });
  }
};

/**
 * Wires a container to play a video referenced by `link`, reusing the video block's
 * placeholder → play button → lazy iframe/embed behavior. Lets other blocks (e.g. the
 * cards video variant) embed a player without nesting a video block.
 * @param {Element} container - element to host the player (its content is not cleared)
 * @param {string} link - video URL (YouTube, Vimeo, or a direct file)
 * @param {Object} [options]
 * @param {HTMLPictureElement|null} [options.placeholder] - optional thumbnail shown before play
 * @param {boolean} [options.autoplay=false] - play automatically once in view
 */
export function setupVideoPlayer(container, link, { placeholder = null, autoplay = false } = {}) {
  container.dataset.embedLoaded = false;

  if (placeholder) {
    container.classList.add('placeholder');
    const wrapper = document.createElement('div');
    wrapper.className = 'video-placeholder';
    wrapper.append(placeholder);

    if (!autoplay) {
      wrapper.insertAdjacentHTML(
        'beforeend',
        '<div class="video-placeholder-play"><button type="button" title="Play"></button></div>',
      );
      wrapper.addEventListener('click', () => {
        wrapper.remove();
        loadVideoEmbed(container, link, true, false);
      });
    }
    container.append(wrapper);
  }

  if (!placeholder || autoplay) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer.disconnect();
        const playOnLoad = autoplay && !prefersReducedMotion.matches;
        loadVideoEmbed(container, link, playOnLoad, autoplay);
      }
    });
    observer.observe(container);
  }
}

export default async function decorate(block) {
  const placeholder = block.querySelector('picture');
  const link = block.querySelector('a').href;
  block.textContent = '';

  const autoplay = block.classList.contains('autoplay');
  setupVideoPlayer(block, link, { placeholder, autoplay });
}
