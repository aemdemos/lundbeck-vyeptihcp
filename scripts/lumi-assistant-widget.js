(function initLumiAssistantWidget() {
  'use strict';

  // Configuration
  const defaultConfig = {
    apiUrl: 'https://6wwjdoikq9.execute-api.us-east-1.amazonaws.com/prod',
    username: 'admin',
    authKey: 'changeme123',
    position: 'header-dropdown',
    useStreaming: false,
    streamingApiUrl: 'https://lumi.norta.ai/ask/stream',
    streamingAuth: 'Basic YWRtaW46Y2hhbmdlbWUxMjM=',
    enableAvatar: true,
    debug: false,
  };

  const STORAGE_KEYS = {
    SESSION_ID: 'lumi-chat-state-id',
    AVATAR_SESSION_ID: 'lumi-avatar-state-id',
    MESSAGES: 'lumi-chat-history',
    LANDING_SHOWN: 'lumi-landing-shown-state',
    CHAT_CLOSED: 'lumi-chat-closed-state',
  };

  function getRandomString(length = 16) {
    if (window.crypto && window.crypto.getRandomValues) {
      const array = new Uint8Array(length);
      window.crypto.getRandomValues(array);
      return Array.from(array, (byte) => byte.toString(36).padStart(2, '0')).join('').substring(0, length);
    }
    return Math.random().toString(36).substring(2, 2 + length);
  }

  function getSafeNumber(val, defaultVal = 0) {
    const num = parseInt(val, 10);
    return Number.isNaN(num) ? defaultVal : num;
  }

  function safeStorageGet(key) {
    try {
      return window.sessionStorage?.getItem(key) || null;
    } catch {
      return null;
    }
  }

  function safeStorageSet(key, value) {
    try {
      if (value === null || value === undefined) {
        window.sessionStorage?.removeItem(key);
      } else {
        window.sessionStorage?.setItem(key, value);
      }
    } catch {
      // Storage unavailable
    }
  }

  class LuMiAssistantWidget {
    constructor(userConfig) {
      this.environment = this.detectEnvironment();

      let defaultApiUrl = 'https://6wwjdoikq9.execute-api.us-east-1.amazonaws.com/prod';
      let defaultAvatarUrl = 'https://lumiwebavatar.norta.ai/avatar';

      if (this.environment === 'stage') {
        defaultAvatarUrl = 'https://lumiwebavatarstage.norta.ai/avatar';
      } else if (this.environment === 'dev') {
        defaultApiUrl = 'https://6wwjdoikq9.execute-api.us-east-1.amazonaws.com/prod';
        defaultAvatarUrl = 'https://lumiwebavatar.dev.norta.ai';
      }

      this.config = {
        ...defaultConfig,
        apiUrl: defaultApiUrl,
        avatarUrl: defaultAvatarUrl,
        ...userConfig,
      };

      if (this.environment === 'dev') {
        this.config.apiUrl = 'https://6wwjdoikq9.execute-api.us-east-1.amazonaws.com/prod';
        this.config.avatarUrl = 'https://lumiwebavatar.dev.norta.ai';
      }

      this.isOpen = false;
      this.buttonClickInProgress = false;
      this.sessionId = this.getSessionIdFromStorage() || this.generateSessionId();
      this.messages = this.loadMessagesFromStorage();
      this.isLoading = false;
      this.isManuallyPositioned = false;
      this.welcomeMessagesAdded = false;
      this.previousViewportWidth = window.innerWidth;
      this.iframeMessageListenerSetup = false;
      this.iframeWindow = null;
      this.parentLinkHandlerLoaded = false;
      this.bodyScrollLockCount = 0;
      this.originalBodyOverflow = '';
      this.originalBodyPaddingRight = '';
      this.cookieBannerUserOverride = false;
      this.resizeRebindTimeout = null;
      this.avatarSessionId = null;
      this.avatarTranscriptListenerSetup = false;
      this.lastAvatarUserMessageId = null;
      this.corsWarningLogged = false;
      this.buttonWasInViewport = true;
      this.chatWindowWasVisibleBeforeScroll = false;
      this.lastResourceLinkUrl = null;
      this.lastResourceLinkTime = 0;
      this.assistantButtonClickedDispatched = false;
      this.startChattingEventDispatched = false;
      this.tryLaterEventDispatched = false;
      this.landingCloseEventDispatched = false;
      this.chatWindowCloseNotifiedAt = 0;

      this.init();
    }

    debugLog(...args) {
      if (this.config.debug) {
        // eslint-disable-next-line no-console
        console.log('[LuMi Widget]', ...args);
      }
    }

    detectEnvironment() {
      const hostname = window.location.hostname.toLowerCase();
      if (hostname === 'www.vyeptihcp.com' || hostname === 'vyeptihcp.com') {
        return 'prod';
      }
      if (hostname === 'vyeptihcp-stage.d.lundbeckus.com') {
        return 'stage';
      }
      return 'dev';
    }

    isInIframe() {
      if (!window.parent) return false;
      try {
        return window.parent !== window;
      } catch (err) {
        this.debugLog('Frame access error (cross-origin):', err);
        return true;
      }
    }

    getTopWindow() {
      try {
        if (window.top) return window.top;
        if (window.parent) return window.parent;
      } catch (err) {
        this.debugLog('Top window access error:', err);
      }
      return null;
    }

    notifyParentWindow(eventType, eventData = {}) {
      try {
        if (eventType === 'resource-link-click' && eventData.url) {
          const now = Date.now();
          if (this.lastResourceLinkUrl === eventData.url && (now - this.lastResourceLinkTime) < 300) {
            return;
          }
          this.lastResourceLinkUrl = eventData.url;
          this.lastResourceLinkTime = now;
        }

        const eventPayload = {
          type: 'lumi-widget-event',
          eventType,
          data: eventData,
          timestamp: Date.now(),
        };

        const inIframe = this.isInIframe();
        const topWindow = this.getTopWindow();

        if (inIframe && topWindow) {
          const targetOrigin = window.location.origin.startsWith('http') ? window.location.origin : '*';
          topWindow.postMessage(eventPayload, targetOrigin);
        } else {
          try {
            const customEvent = new CustomEvent('lumi-widget-event', {
              detail: eventPayload,
              bubbles: true,
              cancelable: true,
            });
            window.dispatchEvent(customEvent);
          } catch (customEventError) {
            this.debugLog('CustomEvent dispatch failed:', customEventError);
          }
        }
      } catch (error) {
        this.debugLog('Error in notifyParentWindow:', error);
      }
    }

    loadParentWindowLinkHandler() {
      if (this.parentLinkHandlerLoaded) return;
      const existingScript = document.querySelector('script[src*="parent-window-link-handler.js"]');
      if (existingScript) {
        this.parentLinkHandlerLoaded = true;
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://lumichat.norta.ai/parent-window-link-handler.js';
      script.async = true;
      script.onload = () => {
        this.parentLinkHandlerLoaded = true;
      };
      script.onerror = (err) => {
        this.debugLog('Failed to load parent link handler:', err);
      };
      document.head.appendChild(script);
    }

    unlockBodyScroll(reason = 'default') {
      if (typeof document === 'undefined' || !document.body || this.bodyScrollLockCount === 0) return;
      this.bodyScrollLockCount = Math.max(0, this.bodyScrollLockCount - 1);
      this.debugLog(`Unlock scroll (${reason}): remaining=${this.bodyScrollLockCount}`);
      if (this.bodyScrollLockCount === 0) {
        document.body.style.overflow = this.originalBodyOverflow || '';
        document.body.style.paddingRight = this.originalBodyPaddingRight || '';
      }
    }

    loadMessagesFromStorage() {
      try {
        const stored = safeStorageGet(STORAGE_KEYS.MESSAGES);
        if (stored) {
          const raw = JSON.parse(stored);
          const seen = new Set();
          return raw.filter((msg) => {
            const key = `${msg.type}:${msg.content}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        }
      } catch (err) {
        this.debugLog('Error loading stored messages:', err);
      }
      return [];
    }

    saveMessagesToStorage() {
      try {
        const seen = new Set();
        const deduplicated = this.messages.filter((msg) => {
          const key = `${msg.type}:${msg.content}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        safeStorageSet(STORAGE_KEYS.MESSAGES, JSON.stringify(deduplicated));
        this.messages = deduplicated;
      } catch (err) {
        this.debugLog('Error saving messages:', err);
      }
    }

    restoreMessagesToDOM() {
      const messagesContainer = this.container.querySelector('#lumi-chat-messages');
      if (!messagesContainer) return;

      const existingMessages = messagesContainer.querySelectorAll('.lumi-chat-message');
      if (existingMessages.length >= this.messages.length) return;

      const welcomeMessages = [
        "Hi, I'm LuMi, Lundbeck's AI-assisted chatbot. I am here to answer questions about VYEPTI® (eptinezumab-jjmr). The transcript of this chat will be stored for monitoring and compliance purposes.",
        'What would you like to know? Type your question or choose from the following options.',
        '<a href="https://www.lundbeck.com/content/dam/lundbeck-com/americas/united-states/products/neurology/vyepti_pi_us_en.pdf" target="_blank">Prescribing Information</a>',
        'Ask a Question about VYEPTI',
      ];

      messagesContainer.innerHTML = '';
      welcomeMessages.forEach((msg) => this.addMessageToDOM('assistant', msg));
      this.messages.forEach((msg) => this.addMessageToDOM(msg.type, msg.content, msg.suggestedQuestions));
    }

    addMessageToDOM(type, content, suggestedQuestions = null) {
      const messagesContainer = this.container.querySelector('#lumi-chat-messages');
      if (!messagesContainer) return null;

      const messageId = `msg-${Date.now()}-${getRandomString(8)}`;
      const messageDiv = document.createElement('div');
      messageDiv.className = `lumi-chat-message ${type}`;
      messageDiv.setAttribute('data-message-id', messageId);

      const isAskQuestionButton = content === 'Ask a Question about VYEPTI';

      if (type === 'assistant') {
        const avatarWrap = document.createElement('div');
        avatarWrap.className = 'lumi-chat-avatar';
        const img = document.createElement('img');
        img.src = 'https://lumichat.norta.ai/assets/Vyepti_Logo.svg';
        img.alt = 'AI Avatar';
        avatarWrap.appendChild(img);
        messageDiv.appendChild(avatarWrap);

        const contentEl = document.createElement('div');
        contentEl.className = 'lumi-chat-message-content';

        if (isAskQuestionButton) {
          const askBtn = document.createElement('button');
          askBtn.type = 'button';
          askBtn.className = 'lumi-ask-question-btn';
          askBtn.setAttribute('data-message-id', messageId);
          askBtn.textContent = 'Ask a Question about VYEPTI';
          askBtn.addEventListener('click', () => {
            if (askBtn.disabled) return;
            askBtn.disabled = true;
            askBtn.classList.add('disabled');
            this.addMessageToDOM('assistant', "Great! Let's get started.");
          });
          contentEl.appendChild(askBtn);
        } else {
          contentEl.innerHTML = this.formatMessageContent(content);
        }
        messageDiv.appendChild(contentEl);
      } else {
        const contentEl = document.createElement('div');
        contentEl.className = 'lumi-chat-message-content';
        contentEl.textContent = content;
        messageDiv.appendChild(contentEl);
      }

      messagesContainer.appendChild(messageDiv);

      if (suggestedQuestions && suggestedQuestions.length > 0) {
        const suggestedDiv = document.createElement('div');
        suggestedDiv.className = 'lumi-suggested-questions';
        suggestedQuestions.forEach((question) => {
          const questionBtn = document.createElement('button');
          questionBtn.type = 'button';
          questionBtn.className = 'lumi-suggested-question';
          questionBtn.textContent = question;
          questionBtn.addEventListener('click', () => this.handleSuggestedQuestion(question));
          suggestedDiv.appendChild(questionBtn);
        });
        messagesContainer.appendChild(suggestedDiv);
      }

      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      return messageId;
    }

    generateSessionId() {
      return `${getRandomString(12)}${getRandomString(12)}`;
    }

    getSessionIdFromStorage() {
      return safeStorageGet(STORAGE_KEYS.SESSION_ID);
    }

    saveSessionIdToStorage(sessionId) {
      safeStorageSet(STORAGE_KEYS.SESSION_ID, sessionId);
      this.sessionId = sessionId;
    }

    getAvatarSessionIdFromStorage() {
      return safeStorageGet(STORAGE_KEYS.AVATAR_SESSION_ID);
    }

    saveAvatarSessionIdToStorage(sessionId) {
      safeStorageSet(STORAGE_KEYS.AVATAR_SESSION_ID, sessionId);
    }

    async createNewSession(communicationMode = 1) {
      try {
        const response = await fetch('https://lumisessionmgmt.norta.ai/api/Sessions', {
          method: 'POST',
          headers: {
            accept: 'text/plain',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            communicationMode,
            environment: this.environment,
          }),
        });

        if (!response.ok) {
          throw new Error(`Session HTTP error: ${response.status}`);
        }

        const data = await response.json();
        if (data.sessionId) {
          if (communicationMode === 1) {
            this.saveSessionIdToStorage(data.sessionId);
            this.notifyParentWindow('text-chat-start', {
              sessionId: data.sessionId,
              trigger: 'first-message',
            });
          }
          return data.sessionId;
        }
        throw new Error('Missing sessionId in response');
      } catch (error) {
        this.debugLog('Error creating new session:', error);
        throw error;
      }
    }

    async postMessageToSession(sessionId, from, to, body, replyTo = null) {
      try {
        const requestBody = {
          sessionId,
          from,
          to,
          body,
          environment: this.environment,
        };

        if (replyTo) {
          requestBody.replyTo = replyTo;
        }

        const response = await fetch('https://lumisessionmgmt.norta.ai/api/SessionMessages', {
          method: 'POST',
          headers: {
            accept: 'text/plain',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`Message HTTP error: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        this.debugLog('Error posting message to session:', error);
        return null;
      }
    }

    hasShownLandingWindowThisSession() {
      return safeStorageGet(STORAGE_KEYS.LANDING_SHOWN) === 'true';
    }

    getZIndexAboveNavBar(baseZIndex = 10000) {
      const navBar = document.querySelector('nav, .navbar, .navigation, header, .header');
      let navBarZIndex = 0;
      if (navBar) {
        const navStyle = window.getComputedStyle(navBar);
        const navZ = getSafeNumber(navStyle.zIndex, 0);
        if (navZ > 0) navBarZIndex = navZ;
      }
      return Math.max(baseZIndex, navBarZIndex + 1);
    }

    setHasShownLandingWindow(shown = true) {
      safeStorageSet(STORAGE_KEYS.LANDING_SHOWN, String(shown));
    }

    isIPad() {
      const ua = navigator.userAgent.toLowerCase();
      const isIPadUA = /ipad/.test(ua);
      const isIPadOS = /macintosh/.test(ua) && navigator.maxTouchPoints > 1 && !window.MSStream;
      return isIPadUA || isIPadOS;
    }

    isLandscape() {
      return window.innerWidth > window.innerHeight;
    }

    shouldHideAvatarButton() {
      return this.isIPad() && this.isLandscape();
    }

    hasChatWindowExplicitlyClosed() {
      return safeStorageGet(STORAGE_KEYS.CHAT_CLOSED) === 'true';
    }

    setChatWindowExplicitlyClosed(closed = true) {
      safeStorageSet(STORAGE_KEYS.CHAT_CLOSED, String(closed));
    }

    init() {
      const storedAvatarSessionId = this.getAvatarSessionIdFromStorage();
      if (storedAvatarSessionId) {
        this.avatarSessionId = storedAvatarSessionId;
      }

      this.loadParentWindowLinkHandler();
      this.isInitializing = true;
      this.createWidget();
      this.bindEvents();
      this.addWelcomeMessages();

      const existingButton = document.getElementById('lumi-assistant-btn');
      if (existingButton && this.shouldHideAvatarButton()) {
        existingButton.style.setProperty('display', 'none', 'important');
      }

      window.setTimeout(() => {
        const isMobile = window.innerWidth <= 768;
        const hasShown = this.hasShownLandingWindowThisSession();
        const hasMessages = this.messages.length > 0;
        const chatExplicitlyClosed = this.hasChatWindowExplicitlyClosed();

        if (hasMessages && !chatExplicitlyClosed) {
          if (isMobile) {
            this.openChat();
          } else {
            this.showChatWindowWithPolygonDesktop();
          }
        } else if (!hasShown) {
          if (isMobile) {
            this.showLandingWindowAndPolygon();
          } else {
            this.showLandingWindowAndPolygonDesktop();
          }
          this.setHasShownLandingWindow(true);
        }

        this.updatePopupPosition();
        this.switchMode(this.config.enableAvatar ? 'ai' : 'text');
        this.bindLandingWindowEvents();
        this.isInitializing = false;
      }, 100);

      this.setupDropdownMenuObserver();
      if (window.innerWidth <= 768) {
        this.setupMobileMenuObserver();
      }
      this.setupSafetyInfoObserver();
      this.setupCookieBannerObserver();
      this.setupTabVisibilityHandler();
    }

    findSafetyInfo() {
      return document.querySelector('.safetyInfo.clickable, .safetyInfo, [class*="safetyInfo"]');
    }

    isSafetyInfoExpanded(safetyInfo) {
      if (!safetyInfo) return false;
      return ['full', 'expanded', 'open', 'active', 'show'].some((c) => safetyInfo.classList.contains(c));
    }

    isElementVisible(element) {
      if (!element) return false;
      const styles = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return styles.display !== 'none'
        && styles.visibility !== 'hidden'
        && parseFloat(styles.opacity) > 0
        && rect.width > 0
        && rect.height > 0;
    }

    isPointInsideRect(rect, x, y) {
      if (!rect || typeof x !== 'number' || typeof y !== 'number') return false;
      return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    findOpenSiteDropdownPanel() {
      const candidates = document.querySelectorAll(
        '.dropdown-menus.show, .dropdown-menu.show, .nav-item.show .dropdown-menu, .nav-dropdown[aria-expanded="true"] .nav-dropdown-menu',
      );
      return Array.from(candidates).find((el) => this.isElementVisible(el)) || null;
    }

    isDropdownExpanded() {
      return Boolean(this.findOpenSiteDropdownPanel());
    }

    findCookieBanner() {
      return document.querySelector('#coiConsentBanner');
    }

    findCookieOverlay() {
      return document.querySelector('#coiOverlay');
    }

    isCookieBannerActive(banner, overlay) {
      return this.isElementVisible(banner) || this.isElementVisible(overlay);
    }

    setupDropdownMenuObserver() {
      const updateZ = () => {
        if (!this.container || this.isInitializing) return;
        const expanded = this.isDropdownExpanded();
        this.container.style.setProperty('z-index', expanded ? '10' : '10000', 'important');
      };
      const observer = new MutationObserver(updateZ);
      observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class', 'aria-expanded'] });
    }

    setupMobileMenuObserver() {
      const mobileMenu = document.querySelector('#menu-items');
      if (!mobileMenu) return;
      const observer = new MutationObserver(() => {
        if (!this.container) return;
        const expanded = mobileMenu.classList.contains('show-dropdown') && this.isElementVisible(mobileMenu);
        this.container.style.setProperty('z-index', expanded ? '10' : '10000', 'important');
      });
      observer.observe(mobileMenu, { attributes: true, attributeFilter: ['class', 'style'] });
    }

    setupSafetyInfoObserver() {
      const observeSafety = () => {
        const safetyInfo = this.findSafetyInfo();
        if (!safetyInfo) return;
        const observer = new MutationObserver(() => {
          if (!this.container) return;
          const expanded = this.isSafetyInfoExpanded(safetyInfo);
          this.container.style.setProperty('z-index', expanded ? '10' : '10000', 'important');
        });
        observer.observe(safetyInfo, { attributes: true, attributeFilter: ['class'] });
      };
      observeSafety();
    }

    setupCookieBannerObserver() {
      const evaluateState = () => {
        const active = this.isCookieBannerActive(this.findCookieBanner(), this.findCookieOverlay());
        if (window.innerWidth <= 768 && active && !this.cookieBannerUserOverride) {
          const landing = document.querySelector('#lumi-landing-window');
          if (landing) landing.style.setProperty('display', 'none', 'important');
        }
      };
      const observer = new MutationObserver(evaluateState);
      observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style', 'class', 'aria-hidden'] });
      window.addEventListener('resize', evaluateState, { passive: true });
    }

    setupTabVisibilityHandler() {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.avatarSessionId) {
          this.saveAvatarSessionIdToStorage(this.avatarSessionId);
        }
      });
    }

    createWidget() {
      this.container = document.createElement('div');
      this.container.className = 'lumi-assistant-widget';
      this.container.style.setProperty('z-index', '10000', 'important');

      this.backdrop = document.createElement('div');
      this.backdrop.className = 'lumi-chat-backdrop';

      const polygon = document.createElement('div');
      polygon.className = 'lumi-chat-polygon';
      polygon.innerHTML = '<svg width="14" height="12" viewBox="0 0 14 12" fill="none"><path d="M7 0L13.9282 12H0.0717969L7 0Z" fill="#B5D9DD"/></svg>';

      const desktopLanding = document.createElement('div');
      desktopLanding.className = 'lumi-landing-window lumi-landing-desktop';
      desktopLanding.id = 'lumi-landing-window-desktop';
      desktopLanding.innerHTML = `
        <div class="lumi-landing-header">
          <div class="lumi-landing-header-content">
            <div class="lumi-landing-title">Let LuMi help you today!</div>
            <button type="button" class="lumi-landing-close-btn" id="lumi-landing-close-btn-desktop" aria-label="Close">
              <img src="https://lumichat.norta.ai/assets/global-icon-icon-close-hover.png" alt="Close" />
            </button>
          </div>
        </div>
        <div class="lumi-landing-content">
          <div class="lumi-landing-buttons-container">
            <button type="button" class="lumi-landing-btn" id="lumi-landing-start-btn-desktop">Start chatting now</button>
            <button type="button" class="lumi-landing-btn" id="lumi-landing-later-btn-desktop">Try later</button>
          </div>
        </div>
      `;

      const chatWindow = document.createElement('div');
      chatWindow.className = 'lumi-chat-window';
      chatWindow.id = 'lumi-chat-window';
      chatWindow.innerHTML = `
        <div class="lumi-chat-header">
          <div class="lumi-chat-title">LuMi AI Agent</div>
          <button type="button" class="lumi-close-btn" id="lumi-close-btn" aria-label="Close">×</button>
        </div>
        <div class="lumi-chat-content">
          <div class="lumi-avatar-container" id="lumi-avatar-container" style="display: none;">
            <div class="lumi-avatar-wrapper">
              <iframe id="lumi-avatar-iframe" allow="microphone; camera; autoplay; fullscreen" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"></iframe>
            </div>
          </div>
          <div class="lumi-chat-messages-container" id="lumi-chat-messages-container">
            <div class="lumi-chat-messages" id="lumi-chat-messages"></div>
          </div>
          <div class="lumi-chat-input-container">
            <form class="lumi-chat-input-form" id="lumi-chat-form">
              <div class="lumi-chat-input-wrapper">
                <textarea id="lumi-chat-input" placeholder="Type message here..." rows="1" maxlength="1000"></textarea>
                <button type="submit" class="lumi-chat-send-icon" id="lumi-send-btn" aria-label="Send">
                  <div class="lumi-send-icon-inactive" id="lumi-send-inactive">
                    <img src="https://lumichat.norta.ai/assets/SendIconInActive.png" alt="Send" width="26" height="26" />
                  </div>
                  <div class="lumi-send-icon-active" id="lumi-send-active" style="display: none;">
                    <img src="https://lumichat.norta.ai/assets/SendIconActive.png" alt="Send" width="26" height="26" />
                  </div>
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

      this.container.append(polygon, desktopLanding, chatWindow);
      document.body.append(this.backdrop, this.container);
    }

    getAssistantButtonLayoutMetrics(button, cachedButtonRect = null) {
      const buttonRect = cachedButtonRect || button.getBoundingClientRect();
      const avatar = button.querySelector('.lumi-avatar');
      let avatarRect = avatar ? avatar.getBoundingClientRect() : buttonRect;

      if (!avatarRect.width || !avatarRect.height) {
        const side = 52;
        const left = buttonRect.left + buttonRect.width / 2 - side / 2;
        avatarRect = {
          left,
          width: side,
          height: side,
          top: buttonRect.top,
          bottom: buttonRect.top + side,
        };
      }

      const avatarBottom = (Number.isFinite(avatarRect.bottom) && avatarRect.height > 0)
        ? avatarRect.bottom
        : buttonRect.bottom;
      const avatarCenterX = (avatar && avatarRect.width > 0)
        ? avatarRect.left + avatarRect.width / 2
        : buttonRect.left + buttonRect.width / 2;

      return { buttonRect, avatarBottom, avatarCenterX };
    }

    getChatPolygonFixedTopY(avatarBottom) {
      return Math.round(avatarBottom - 8);
    }

    getMobileCenteredFixedRightOffset(viewportWidth, elementWidth) {
      return Math.max(0, Math.round((viewportWidth - elementWidth) / 2));
    }

    showLandingWindowAndPolygon() {
      const button = document.querySelector('#lumi-assistant-btn');
      if (!button) return;
      const buttonRect = button.getBoundingClientRect();
      if (!buttonRect.width) return;

      const { avatarBottom, avatarCenterX } = this.getAssistantButtonLayoutMetrics(button, buttonRect);
      const polygonTop = this.getChatPolygonFixedTopY(avatarBottom);
      const polygonLeft = Math.max(0, Math.round(avatarCenterX - 7));
      const windowTop = Math.round(polygonTop + 17);

      const landingWindow = this.container.querySelector('.lumi-landing-window');
      const polygon = this.container.querySelector('.lumi-chat-polygon');

      if (landingWindow) {
        landingWindow.style.setProperty('position', 'fixed', 'important');
        landingWindow.style.setProperty('top', `${windowTop}px`, 'important');
        landingWindow.style.setProperty('display', 'flex', 'important');
        landingWindow.style.setProperty('visibility', 'visible', 'important');
        landingWindow.style.setProperty('opacity', '1', 'important');
      }

      if (polygon) {
        polygon.style.setProperty('position', 'fixed', 'important');
        polygon.style.setProperty('top', `${polygonTop}px`, 'important');
        polygon.style.setProperty('left', `${polygonLeft}px`, 'important');
        polygon.style.setProperty('display', 'block', 'important');
        polygon.style.setProperty('visibility', 'visible', 'important');
        polygon.style.setProperty('opacity', '1', 'important');
      }
      this.isOpen = true;
    }

    showLandingWindowAndPolygonDesktop() {
      this.showLandingWindowAndPolygon();
    }

    showChatWindowWithPolygonDesktop() {
      this.startChatting();
    }

    bindEvents() {
      const button = document.querySelector('#lumi-assistant-btn');
      if (button) {
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleChat();
        });
      }

      const closeBtn = this.container.querySelector('#lumi-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.closeChat(false, true);
        });
      }

      const form = this.container.querySelector('#lumi-chat-form');
      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSubmit();
        });
      }

      const input = this.container.querySelector('#lumi-chat-input');
      if (input) {
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSubmit();
          }
        });
        input.addEventListener('input', () => this.updateSendButtonState());
      }

      document.addEventListener('click', (e) => {
        if (!this.isOpen) return;
        if (!this.container.contains(e.target) && !e.target.closest('#lumi-assistant-btn')) {
          this.closeChat(false);
        }
      });
    }

    bindLandingWindowEvents() {
      const startBtn = this.container.querySelector('#lumi-landing-start-btn-desktop');
      if (startBtn) {
        startBtn.onclick = (e) => {
          e.preventDefault();
          this.startChatting();
        };
      }
      const laterBtn = this.container.querySelector('#lumi-landing-later-btn-desktop');
      if (laterBtn) {
        laterBtn.onclick = (e) => {
          e.preventDefault();
          this.closeChat(false);
        };
      }
      const closeBtn = this.container.querySelector('#lumi-landing-close-btn-desktop');
      if (closeBtn) {
        closeBtn.onclick = (e) => {
          e.preventDefault();
          this.closeChat(false);
        };
      }
    }

    toggleChat() {
      if (this.isOpen) {
        this.closeChat(false);
      } else if (this.messages.length > 0) {
        this.startChatting();
      } else {
        this.showLandingWindowAndPolygon();
      }
    }

    updatePopupPosition() {
      const button = document.querySelector('#lumi-assistant-btn');
      if (!button || !this.isOpen) return;
      const buttonRect = button.getBoundingClientRect();
      const { avatarBottom, avatarCenterX } = this.getAssistantButtonLayoutMetrics(button, buttonRect);
      const polygonTop = this.getChatPolygonFixedTopY(avatarBottom);
      const polygonLeft = Math.max(0, Math.round(avatarCenterX - 7));
      const windowTop = Math.round(polygonTop + 17);
      const windowRight = Math.max(10, Math.round(window.innerWidth - buttonRect.right));

      const chatWindow = this.container.querySelector('.lumi-chat-window');
      const polygon = this.container.querySelector('.lumi-chat-polygon');
      const landing = this.container.querySelector('.lumi-landing-window');

      [chatWindow, landing].forEach((el) => {
        if (el) {
          el.style.setProperty('top', `${windowTop}px`, 'important');
          el.style.setProperty('right', `${windowRight}px`, 'important');
        }
      });

      if (polygon) {
        polygon.style.setProperty('top', `${polygonTop}px`, 'important');
        polygon.style.setProperty('left', `${polygonLeft}px`, 'important');
      }
    }

    openChat() {
      this.showLandingWindowAndPolygon();
    }

    startChatting() {
      this.isOpen = true;
      this.container.classList.add('open', 'chat-active');
      const landing = this.container.querySelector('.lumi-landing-window');
      if (landing) landing.style.setProperty('display', 'none', 'important');

      const chatWindow = this.container.querySelector('.lumi-chat-window');
      if (chatWindow) {
        chatWindow.style.setProperty('display', 'flex', 'important');
        chatWindow.style.setProperty('visibility', 'visible', 'important');
        chatWindow.style.setProperty('opacity', '1', 'important');
      }
      this.updatePopupPosition();
      this.restoreMessagesToDOM();
    }

    closeChat(clearMessages = false, explicitlyClosed = false) {
      this.isOpen = false;
      this.container.classList.remove('open', 'chat-active');
      if (this.backdrop) this.backdrop.style.display = 'none';

      const chatWindow = this.container.querySelector('.lumi-chat-window');
      if (chatWindow) chatWindow.style.setProperty('display', 'none', 'important');

      const landing = this.container.querySelector('.lumi-landing-window');
      if (landing) landing.style.setProperty('display', 'none', 'important');

      const polygon = this.container.querySelector('.lumi-chat-polygon');
      if (polygon) polygon.style.setProperty('display', 'none', 'important');

      if (explicitlyClosed) this.setChatWindowExplicitlyClosed(true);
      if (clearMessages) this.messages = [];
    }

    setLoading(loading) {
      this.isLoading = loading;
      const messagesContainer = this.container.querySelector('#lumi-chat-messages');
      if (!messagesContainer) return;
      const existing = messagesContainer.querySelector('.lumi-loading-message');
      if (existing) existing.remove();

      if (loading) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'lumi-loading-message lumi-chat-message assistant';
        loadingDiv.innerHTML = '<div class="lumi-chat-message-content">LuMi is thinking...</div>';
        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }

    async handleSubmit() {
      const input = this.container.querySelector('#lumi-chat-input');
      if (!input) return;
      const message = input.value.trim();
      if (!message) return;

      input.value = '';
      this.addMessage('user', message);
      await this.sendMessage(message);
    }

    updateSendButtonState() {
      const input = this.container.querySelector('#lumi-chat-input');
      const inactive = this.container.querySelector('#lumi-send-inactive');
      const active = this.container.querySelector('#lumi-send-active');
      if (!input || !inactive || !active) return;
      const hasText = input.value.trim().length > 0;
      inactive.style.display = hasText ? 'none' : 'block';
      active.style.display = hasText ? 'block' : 'none';
    }

    addMessage(type, content, suggestedQuestions = null) {
      this.messages.push({ type, content, suggestedQuestions });
      this.saveMessagesToStorage();
      return this.addMessageToDOM(type, content, suggestedQuestions);
    }

    async handleSuggestedQuestion(question) {
      this.addMessage('user', question);
      await this.sendMessage(question);
    }

    switchMode(mode) {
      const avatarContainer = this.container.querySelector('#lumi-avatar-container');
      const messagesContainer = this.container.querySelector('#lumi-chat-messages-container');
      const isAi = mode === 'ai' && this.config.enableAvatar;

      if (avatarContainer) avatarContainer.style.display = isAi ? 'flex' : 'none';
      if (messagesContainer) messagesContainer.style.display = isAi ? 'none' : 'flex';
    }

    formatMessageContent(rawContent) {
      let content = rawContent
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        .replace(/\n\n/g, '</p><p>');
      content = `<p>${content}</p>`;
      return content.replace(/<p>\s*<\/p>/g, '');
    }

    async sendMessage(message) {
      this.setLoading(true);
      try {
        const response = await fetch(`${this.config.apiUrl}/ask`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${btoa(`${this.config.username}:${this.config.authKey}`)}`,
          },
          body: JSON.stringify({
            message,
            session_id: this.sessionId,
          }),
        });

        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const data = await response.json();
        this.setLoading(false);
        this.addMessage('assistant', data.answer || 'I am ready to help.', data.suggested_questions || []);
      } catch (err) {
        this.setLoading(false);
        this.debugLog('Send error:', err);
        this.addMessage('assistant', 'Sorry, I encountered an error. Please try again later.');
      }
    }

    addWelcomeMessages() {
      if (this.welcomeMessagesAdded || this.messages.length > 0) return;
      this.welcomeMessagesAdded = true;
      this.restoreMessagesToDOM();
    }
  }

  // Styles setup
  const css = `
    .lumi-assistant-widget { position: relative; z-index: 10000; font-family: sans-serif; display: inline-block; }
    .lumi-chat-backdrop { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9998; display: none; }
    .lumi-assistant-button { display: flex; align-items: center; gap: 5px; background: transparent; border: none; cursor: pointer; color: white; font-weight: 700; }
    .lumi-avatar { width: 52px; height: 52px; background: #D9D9D9; border: 1px solid #B5D9DD; border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .lumi-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .lumi-chat-polygon { position: fixed !important; z-index: 10002; display: none; }
    .lumi-landing-window { position: fixed; width: 335px; height: 85px; border-radius: 10px; z-index: 10003; display: none; background: #B5D9DD; box-shadow: 0 4px 4px rgba(0,0,0,0.1); }
    .lumi-landing-header { width: 100%; padding: 10px; display: flex; justify-content: space-between; align-items: center; }
    .lumi-landing-title { color: #006186; font-size: 16px; font-weight: 700; }
    .lumi-landing-close-btn { background: none; border: none; cursor: pointer; }
    .lumi-landing-content { padding: 0 10px; }
    .lumi-landing-buttons-container { display: flex; gap: 10px; }
    .lumi-landing-btn { height: 26px; padding: 0 12px; background: white; border: 1px solid #D9D9D9; border-radius: 20px; color: #006186; cursor: pointer; font-size: 12px; }
    .lumi-chat-window { position: fixed; width: 385px; height: 470px; background: white; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); z-index: 10001; display: none; flex-direction: column; overflow: hidden; }
    .lumi-chat-header { background: #B5D9DD; color: #006186; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; }
    .lumi-close-btn { background: none; border: none; color: #006186; font-size: 20px; cursor: pointer; }
    .lumi-chat-content { flex: 1; display: flex; flex-direction: column; padding: 10px; min-height: 0; }
    .lumi-chat-messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; max-height: 320px; }
    .lumi-chat-message { display: flex; gap: 8px; }
    .lumi-chat-message.user { justify-content: flex-end; }
    .lumi-chat-message.user .lumi-chat-message-content { background: #006186; color: white; }
    .lumi-chat-message.assistant .lumi-chat-message-content { background: #EFF6F9; color: #333; }
    .lumi-chat-message-content { max-width: 80%; padding: 8px 12px; border-radius: 12px; font-size: 14px; }
    .lumi-chat-input-form { margin-top: auto; }
    .lumi-chat-input-wrapper { display: flex; border: 1px solid #D9D9D9; border-radius: 10px; padding: 4px 8px; align-items: center; }
    .lumi-chat-input-wrapper textarea { flex: 1; border: none; outline: none; resize: none; font-size: 14px; }
    .lumi-chat-send-icon { background: none; border: none; cursor: pointer; }
  `;

  if (!document.getElementById('lumi-assistant-widget-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'lumi-assistant-widget-styles';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }

  function startWidget() {
    window.lumiAssistantWidget = new LuMiAssistantWidget(defaultConfig);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startWidget);
  } else {
    startWidget();
  }
}());