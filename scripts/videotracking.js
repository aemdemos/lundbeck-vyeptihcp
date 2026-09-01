/**
 * Video analytics for EDS. Fires videoPlay + videoProgress
 * milestone events to the Adobe Data Layer for Brightcove/video.js players.
 *
 * EDS embeds Brightcove in-page (blocks/embed + utils.createBrightcovePlayer),
 * so the video.js global and player registry are reachable on window — the AMS
 * tracking logic ports directly. But the embed block creates players lazily
 * (IntersectionObserver / click-to-play), so we watch for <video-js> elements
 * as they appear and instrument each once its player is ready, rather than a
 * one-shot registry scan. Event names, payload, milestones, and player
 * metadata match AMS.
 */

import { pushVideoEventToDataLayer, DATA_LAYER_CONFIG } from './datalayer.js';

const instrumented = new WeakSet();

/**
 * Resolves the video title from the EDS DOM. AMS used .current-video-title
 * (absent in EDS); here each Brightcove embed's title is the heading immediately
 * preceding its .embed block. Falls back to any ancestor heading, then ''.
 */
function getVideoName(el) {
  const embedBlock = el.closest('.embed') || el;

  // Preferred: the heading directly before the embed block (e.g. the authored <h3>).
  let sib = embedBlock.previousElementSibling;
  while (sib) {
    if (/^H[1-6]$/.test(sib.tagName)) return sib.textContent.trim();
    sib = sib.previousElementSibling;
  }

  // Fallback: nearest heading within the surrounding section.
  const section = embedBlock.closest('.section, .columns, main');
  const heading = section && section.querySelector('h1, h2, h3, h4, h5, h6');
  return heading ? heading.textContent.trim() : '';
}

/** Wires play / ended / seeked / timeupdate analytics onto one video.js player. */
function instrumentPlayer(player, el) {
  const videoId = el.getAttribute('data-video-id');
  if (!videoId) return;

  const playerAttr = el.getAttribute('data-player');
  const { videojs } = window;
  let videoName = '';
  let videoPlayFired = false;
  let hasSeeked = false;
  let videoEnded = false;
  const milestonesFired = {};

  const resetMilestones = () => {
    DATA_LAYER_CONFIG.videoMeta.milestones.forEach((m) => { milestonesFired[m] = false; });
  };
  resetMilestones();

  const firePlay = () => {
    videoPlayFired = true;
    videoName = getVideoName(el);
    pushVideoEventToDataLayer({
      eventType: DATA_LAYER_CONFIG.videoEvents.VIDEO_PLAY,
      videoId,
      videoName,
      duration: player.duration(),
      playerId: playerAttr,
      playerName: DATA_LAYER_CONFIG.videoMeta.playerName,
      playerVendor: DATA_LAYER_CONFIG.videoMeta.playerVendor,
      playerVersion: videojs.VERSION,
    });
  };

  player.on('play', function onPlay() {
    videoName = getVideoName(el);
    if (videoEnded) videoEnded = false;
    if (!videoPlayFired && this.currentTime() < 1 && !hasSeeked) firePlay();
  });

  player.on('ended', () => {
    videoPlayFired = false;
    videoEnded = true;
    hasSeeked = false;
    resetMilestones();
  });

  player.on('seeked', function onSeeked() {
    if (!videoEnded) hasSeeked = true;
    if (this.currentTime() < 1) resetMilestones();
  });

  player.on('timeupdate', () => {
    const duration = player.duration();
    if (!duration) return;
    const percentage = (player.currentTime() / duration) * 100;
    DATA_LAYER_CONFIG.videoMeta.milestones.forEach((milestone) => {
      if (!milestonesFired[milestone] && percentage >= milestone) {
        milestonesFired[milestone] = true;
        pushVideoEventToDataLayer({
          eventType: DATA_LAYER_CONFIG.videoEvents.VIDEO_PROGRESS,
          videoId,
          videoName,
          duration,
          progressPercentage: milestone,
          playerId: playerAttr,
          playerName: DATA_LAYER_CONFIG.videoMeta.playerName,
          playerVendor: DATA_LAYER_CONFIG.videoMeta.playerVendor,
          playerVersion: videojs.VERSION,
        });
      }
    });
  });

  // Retroactively fire videoPlay if playback began before handlers attached.
  if (!videoPlayFired && !player.paused() && !hasSeeked) firePlay();
}

/** Initializes video.js on a <video-js> element once, then instruments it. */
function tryInstrument(el) {
  const { videojs } = window;
  if (!videojs || instrumented.has(el)) return;
  // Only instrument elements video.js has initialized (Brightcove calls bc(el)).
  if (!el.classList.contains('vjs-tech') && !el.player && !videojs.getPlayer(el.id)) return;
  instrumented.add(el);
  const player = videojs.getPlayer(el.id) || videojs(el);
  player.ready(() => instrumentPlayer(player, el));
}

/**
 * Watches for Brightcove <video-js> players appearing in the DOM (eager, lazy,
 * or click-to-play) and instruments each once. No-op if video.js never loads.
 */
export default function initVideoTracking() {
  // Instrument any players already present.
  document.querySelectorAll('video-js[data-video-id]').forEach(tryInstrument);

  // Watch for players added later by the lazy embed block.
  const observer = new MutationObserver(() => {
    document.querySelectorAll('video-js[data-video-id]').forEach(tryInstrument);
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
}
