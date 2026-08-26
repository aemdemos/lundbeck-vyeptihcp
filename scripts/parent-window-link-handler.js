/**
 * Parent Window Link Handler
 *
 * Handles link opening requests from the Lumi iframe.
 */

(() => {
  'use strict';

  const ALLOWED_ORIGINS = [
    'https://lumiwebavatar.norta.ai',
    'https://lumiwebavatarstage.norta.ai',
    'https://lumiwebavatar.dev.norta.ai',
    'https://lumichat.norta.ai',
  ];

  function isOriginAllowed(origin) {
    return (
      ALLOWED_ORIGINS.includes('*')
      || ALLOWED_ORIGINS.includes(origin)
    );
  }

  function isValidUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      const parsedUrl = new URL(url);
      return Boolean(parsedUrl);
    } catch (error) {
      console.error('Invalid URL:', error);
      return false;
    }
  }

  function createBackgroundTabEvent() {
    return new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
      button: 1,
      buttons: 4,
      ctrlKey: false,
      metaKey: false,
    });
  }

  function createCtrlClickEvent() {
    return new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: 1,
      ctrlKey: true,
      metaKey:
        navigator.platform.toUpperCase().indexOf('MAC') >= 0,
    });
  }

  function removeLinkElement(link) {
    setTimeout(() => {
      try {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      } catch (error) {
        console.warn(
          'Failed to remove temporary link element:',
          error,
        );
      }
    }, 100);
  }

  function dispatchLinkEvents(link) {
    try {
      link.dispatchEvent(createBackgroundTabEvent());
    } catch (middleClickError) {
      console.warn(
        'Background tab click failed. Falling back to Ctrl+Click.',
        middleClickError,
      );

      try {
        link.dispatchEvent(createCtrlClickEvent());
      } catch (ctrlClickError) {
        console.warn(
          'Ctrl+Click failed. Falling back to standard click.',
          ctrlClickError,
        );

        link.click();
      }
    }
  }

  function openLinkUsingAnchor(url) {
    const link = document.createElement('a');

    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';

    document.body.appendChild(link);

    dispatchLinkEvents(link);
    removeLinkElement(link);
  }

  function fallbackOpenLink(url) {
    try {
      window.open(
        url,
        '_blank',
        'noopener,noreferrer',
      );
    } catch (fallbackError) {
      console.error(
        'Fallback window.open failed:',
        fallbackError,
      );
    }
  }

  function openLink(url) {
    try {
      openLinkUsingAnchor(url);
    } catch (error) {
      console.warn(
        'Anchor-based link opening failed. Using fallback.',
        error,
      );

      fallbackOpenLink(url);
    }
  }

  function handleOpenLinkMessage(data) {
    const { url } = data;

    if (!isValidUrl(url)) {
      return;
    }

    openLink(url);
  }

  function handleMessage(event) {
    if (!isOriginAllowed(event.origin)) {
      return;
    }

    const { data } = event;

    if (
      !data
      || data.type !== 'OPEN_LINK_IN_NEW_TAB'
    ) {
      return;
    }

    handleOpenLinkMessage(data);
  }

  function initializeHandler() {
    window.addEventListener('message', handleMessage);
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => {
        initializeHandler();
      },
    );
  } else {
    initializeHandler();
  }
})();