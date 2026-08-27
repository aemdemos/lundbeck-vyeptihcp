/**
 * Parent Window Link Handler
 * 
 * This script should be included in the parent window (the page that hosts the iframe)
 * to handle link opening requests from the iframe.
 * 
 * Usage:
 *   <script src="https://lumichat.norta.ai/parent-window-link-handler.js"></script>
 * 
 * Or copy the code below directly into your parent page's JavaScript.
 */

/* eslint-disable*/

(function() {
  'use strict';

  // Configuration: Set the allowed origin(s) for security
  // Replace with your actual iframe origin(s) or use '*' to allow all origins (less secure)
  const ALLOWED_ORIGINS = [
    'https://lumiwebavatar.norta.ai',
    'https://lumiwebavatarstage.norta.ai',
    'https://lumiwebavatar.dev.norta.ai',
    'https://lumichat.norta.ai',
    'http://localhost:3000', // For local development
    // Add more origins as needed
  ];

  /**
   * Check if the origin is allowed
   * @param {string} origin - The origin of the message
   * @returns {boolean} - True if origin is allowed
   */
  function isOriginAllowed(origin) {
    if (ALLOWED_ORIGINS.includes('*')) {
      return true; // Allow all origins (less secure, use with caution)
    }
    return ALLOWED_ORIGINS.includes(origin);
  }

  /**
   * Handle messages from the iframe
   * @param {MessageEvent} event - The message event
   */
  function handleMessage(event) {
    // Verify the origin for security
    if (!isOriginAllowed(event.origin)) {
      //console.warn('Blocked message from unauthorized origin:', event.origin);
      return;
    }

    // Check if the message is the expected type
    if (event.data && event.data.type === 'OPEN_LINK_IN_NEW_TAB') {
      const url = event.data.url;
      
      // Validate URL
      if (!url || typeof url !== 'string') {
        console.error('Invalid URL received:', url);
        return;
      }

      // Validate URL format (basic check)
      try {
        new URL(url);
      } catch (e) {
        console.error('Invalid URL format:', url);
        return;
      }

      // Open the link in a new tab (background)
      // Use a temporary anchor element with middle-click simulation to open in background
      // This is more reliable than window.open() + refocus for keeping current tab active
      try {
        // Create a temporary anchor element
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.display = 'none';
        
        // Append to body temporarily
        document.body.appendChild(link);
        
        // Try to simulate middle-click (button 1) which opens in background tab
        // This is the most reliable way to open a link in background
        try {
          const clickEvent = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
            button: 1, // Middle mouse button (opens in background)
            buttons: 4, // Middle button pressed
            ctrlKey: false,
            metaKey: false
          });
          
          link.dispatchEvent(clickEvent);
          console.debug('Opened link in new tab (background via middle-click simulation):', url);
        } catch (middleClickError) {
          // If middle-click simulation fails, try Ctrl+click (Cmd+click on Mac)
          console.debug('Middle-click simulation failed, trying Ctrl+click:', middleClickError);
          
          try {
            const ctrlClickEvent = new MouseEvent('click', {
              view: window,
              bubbles: true,
              cancelable: true,
              button: 0, // Left mouse button
              buttons: 1,
              ctrlKey: true, // Ctrl key (Cmd on Mac)
              metaKey: navigator.platform.toUpperCase().indexOf('MAC') >= 0 // Cmd on Mac
            });
            
            link.dispatchEvent(ctrlClickEvent);
            console.debug('Opened link in new tab (background via Ctrl+click simulation):', url);
          } catch (ctrlClickError) {
            // Fallback to regular click if both fail
            console.debug('Ctrl+click simulation failed, using regular click:', ctrlClickError);
            link.click();
          }
        }
        
        // Remove the temporary link element after a short delay
        setTimeout(() => {
          try {
            if (link.parentNode) {
              link.parentNode.removeChild(link);
            }
          } catch (removeError) {
            // Ignore removal errors
          }
        }, 100);
        
      } catch (error) {
        console.error('Failed to open link:', error);
        // Fallback to window.open if anchor method fails
        try {
          const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
          if (!newWindow) {
            console.warn('Popup blocked. Please allow popups for this site.');
          }
        } catch (fallbackError) {
          console.error('Fallback window.open also failed:', fallbackError);
        }
      }
    }
  }

  // Add event listener when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      window.addEventListener('message', handleMessage);
      console.log('Parent window link handler initialized');
    });
  } else {
    // DOM is already ready
    window.addEventListener('message', handleMessage);
    console.log('Parent window link handler initialized');
  }
})();