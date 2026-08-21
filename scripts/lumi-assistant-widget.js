(function() {
    'use strict';

    // Configuration
    const config = {
        //apiUrl: 'https://6wwjdoikq9.execute-api.us-east-1.amazonaws.com/prod',
        apiUrl: 'https://6wwjdoikq9.execute-api.us-east-1.amazonaws.com/prod',
        username: 'admin',
        password: 'changeme123',
        position: 'header-dropdown',
        useStreaming: false, // Disable streaming - debugging endpoint issues
        streamingApiUrl: 'https://lumi.norta.ai/ask/stream',
        streamingAuth: 'Basic YWRtaW46Y2hhbmdlbWUxMjM=',
        enableAvatar: true, // Feature toggle for avatar functionality
        debug: false // Enable debug logging (console.log statements)
    };

    // LuMi Assistant Widget Class
    class LuMiAssistantWidget {
        constructor(config) {
            // Detect environment first to set environment-specific URLs
            this.environment = this.detectEnvironment();
            
            // Set default URLs based on environment
            let defaultApiUrl = 'https://6wwjdoikq9.execute-api.us-east-1.amazonaws.com/prod';
            let defaultAvatarUrl = 'https://lumiwebavatar.norta.ai/avatar';

            // Use stage avatar URL for stage environment
            if (this.environment === 'stage') {
                defaultAvatarUrl = 'https://lumiwebavatarstage.norta.ai/avatar';
            }
            
            // Use dev-specific URLs when environment is dev
            if (this.environment === 'dev') {
                // Third-party embeds (e.g. Lundbeck) hit CORS on direct dev.lumi.norta.ai; Lambda proxy allows origin + adds ACAO on errors.
                defaultApiUrl = 'https://6wwjdoikq9.execute-api.us-east-1.amazonaws.com/prod';
                defaultAvatarUrl = 'https://lumiwebavatar.dev.norta.ai';
            }
            
            // Merge config, but environment-specific URLs take precedence for dev
            this.config = {
                apiUrl: defaultApiUrl,
                avatarUrl: defaultAvatarUrl,                
                streamingApiUrl: 'https://lumi.norta.ai/ask/stream',
                streamingAuth: 'Basic YWRtaW46Y2hhbmdlbWUxMjM=',
                useStreaming: false, // Configurable flag to enable/disable streaming
                debug: false, // Enable debug logging (console.log statements)
                ...config
            };
            
            // Force environment-specific URLs for dev environment (always override any passed config)
            if (this.environment === 'dev') {
                this.config.apiUrl = 'https://6wwjdoikq9.execute-api.us-east-1.amazonaws.com/prod';
                this.config.avatarUrl = 'https://lumiwebavatar.dev.norta.ai';
                // Debug log to verify environment detection (only in debug mode)
                if (this.config.debug) {
                    console.log('LuMi Widget: Dev environment detected, using dev URLs:', {
                        apiUrl: this.config.apiUrl,
                        avatarUrl: this.config.avatarUrl,
                        hostname: window.location.hostname
                    });
                }
            }
            
            // Debug logging function - only logs if debug mode is enabled
            this.debugLog = (...args) => {
                if (this.config.debug) {
                    this.debugLog(...args);
                }
            };
            this.isOpen = false;
            this.buttonClickInProgress = false;
            // Check for existing sessionId in sessionStorage, otherwise generate a new one
            const storedSessionId = this.getSessionIdFromStorage();
            this.sessionId = storedSessionId || this.generateSessionId();
            this.messages = this.loadMessagesFromStorage();
            this.isLoading = false;
            this.isManuallyPositioned = false; // prevent auto reposition when we force-show
            this.welcomeMessagesAdded = false; // Track if welcome messages have been added
            this.previousViewportWidth = window.innerWidth; // Track previous viewport width for breakpoint detection
            this.iframeMessageListenerSetup = false; // Flag to track if message listener is set up
            this.iframeWindow = null; // Reference to iframe window for message forwarding
            this.iframeMessageHandler = null; // Store message handler for potential cleanup
            this.parentLinkHandlerLoaded = false; // Flag to track if parent link handler script is loaded
            this.bodyScrollLockCount = 0;
            this.originalBodyOverflow = '';
            this.originalBodyPaddingRight = '';
            this.cookieBannerUserOverride = false;
            this.resizeRebindTimeout = null;
            // Avatar session ID will be restored from sessionStorage in init() after methods are defined
            this.avatarSessionId = null; // Session ID for avatar voice chat
            this.avatarTranscriptListenerSetup = false; // Flag to track if transcript listener is set up
            this.lastAvatarUserMessageId = null; // Track last user message ID for replyTo threading
            this.corsWarningLogged = false; // Flag to track if CORS warning has been logged (to reduce console noise)
            this.buttonWasInViewport = true; // Track if button was in viewport (for desktop scroll handling)
            this.chatWindowWasVisibleBeforeScroll = false; // Track if chat window was visible before button left viewport
            this.init();
        }
        
        /**
         * Detect the environment (prod, stage, dev) based on the current hostname
         * @returns {string} 'prod', 'stage', or 'dev'
         */
        detectEnvironment() {
            const hostname = window.location.hostname.toLowerCase();
            
            // Production environment
            if (hostname === 'www.vyeptihcp.com' || hostname === 'vyeptihcp.com') {
                return 'prod';
            }
            
            // Staging environment
            if (hostname === 'vyeptihcp-stage.d.lundbeckus.com') {
                return 'stage';
            }
            
            // Everything else defaults to dev
            return 'dev';
        }
        
        /**
         * Safely check if we're in an iframe (works for both same-origin and cross-origin)
         * @returns {boolean} - True if we're in an iframe, false otherwise
         */
        isInIframe() {
            if (!window.parent) {
                return false;
            }
            try {
                // Try to compare window.parent with window
                // In same-origin iframes, this works fine
                // In cross-origin scenarios, this will throw a SecurityError
                return window.parent !== window;
            } catch (securityError) {
                // Cross-origin iframe detected - can't compare windows due to security restrictions
                // But window.parent exists, so we're definitely in an iframe
                return true;
            }
        }
        
        /**
         * Safely get the top-level window for postMessage
         * postMessage works with window.top even in cross-origin scenarios
         * @returns {Window|null} - The top-level window, or null if not available
         */
        getTopWindow() {
            try {
                // window.top always exists when in an iframe, even cross-origin
                // postMessage doesn't require reading properties, so it works cross-origin
                if (window.top) {
                    // Try to check if we're not at the top level
                    // This comparison will throw SecurityError in cross-origin scenarios
                    // In which case we assume we're in an iframe and window.top is valid
                    try {
                        if (window.top !== window) {
                            return window.top;
                        }
                    } catch (securityError) {
                        // Cross-origin iframe - can't compare, but window.top exists and postMessage will work
                        return window.top;
                    }
                }
                // If window.top === window, we're at the top level already
                // Try window.parent as fallback for nested scenarios
                if (window.parent) {
                    try {
                        if (window.parent !== window) {
                            return window.parent;
                        }
                    } catch (securityError) {
                        // Cross-origin - can't compare, but window.parent exists
                        return window.parent;
                    }
                }
                return null;
            } catch (error) {
                // If accessing window.top fails entirely, return null
                return null;
            }
        }
        
        /**
         * Notify parent window of widget events
         * @param {string} eventType - The type of event ('start-chatting', 'landing-close', 'try-later', 'mode-switch', 'voice-chat-start', 'text-chat-start', 'chat-window-close', 'resource-link-click')
         * @param {object} eventData - Event-specific data
         */
        notifyParentWindow(eventType, eventData = {}) {
            try {
                // Dedupe resource-link-click: iframe can fire from both click listener and postMessage for same link
                if (eventType === 'resource-link-click' && eventData.url) {
                    const now = Date.now();
                    if (this._lastResourceLinkUrl === eventData.url && (now - (this._lastResourceLinkTime || 0)) < 300) {
                        return;
                    }
                    this._lastResourceLinkUrl = eventData.url;
                    this._lastResourceLinkTime = now;
                }
                const eventPayload = {
                    type: 'lumi-widget-event',
                    eventType: eventType,
                    data: eventData,
                    timestamp: Date.now()
                };
                
                // Detect embedding method
                const inIframe = this.isInIframe();
                console.log('notifyParentWindow - isInIframe:', inIframe, 'eventType:', eventType);
                
                // If embedded in iframe (same-origin or cross-origin), use postMessage
                // Use window.top to reach the top-level window even with nested iframes
                const topWindow = this.getTopWindow();
                if (inIframe && topWindow) {
                    // Send message to top-level window
                    // Use '*' as targetOrigin for cross-origin compatibility (parent should verify origin)
                    topWindow.postMessage(eventPayload, '*');
                    console.log('Event notified to top-level window (iframe, postMessage):', eventType, eventData);
                } else {
                    // If embedded directly in page (script tag), dispatch custom event
                    // This works even when script is loaded from a different domain
                    // because the script executes in the parent window's context
                    try {
                        const customEvent = new CustomEvent('lumi-widget-event', {
                            detail: eventPayload,
                            bubbles: true,
                            cancelable: true
                        });
                        window.dispatchEvent(customEvent);
                        this.debugLog('Event dispatched to window (direct embed, CustomEvent):', eventType, eventData);
                        
                        // Always log start-chatting event for debugging
                        if (eventType === 'start-chatting') {
                            console.log('[LuMi Widget] start-chatting CustomEvent dispatched:', eventPayload);
                        }
                        
                        // Also log to console for debugging (only in debug mode)
                        if (this.config && this.config.debug) {
                            console.log('[LuMi Widget] Event dispatched:', eventType, eventData);
                        }
                    } catch (customEventError) {
                        // If CustomEvent fails, try postMessage as fallback (for edge cases)
                        console.warn('CustomEvent dispatch failed, trying postMessage fallback:', customEventError);
                        const topWindow = this.getTopWindow();
                        if (this.isInIframe() && topWindow) {
                            topWindow.postMessage(eventPayload, '*');
                            this.debugLog('Event sent via postMessage fallback to top-level window:', eventType, eventData);
                        } else {
                            // If we can't use CustomEvent and we're not in an iframe, log the error
                            console.error('Failed to dispatch event - not in iframe and CustomEvent failed:', customEventError);
                        }
                    }
                }
            } catch (error) {
                // Log the error for debugging, but don't break widget functionality
                console.warn('Failed to notify parent window:', error);
                this.debugLog('Error in notifyParentWindow:', error);
            }
        }
        
        /**
         * Dynamically load the parent window link handler script
         * This script enables links clicked in the iframe to open in the parent window
         */
        loadParentWindowLinkHandler() {
            // Check if already loaded or currently loading
            if (this.parentLinkHandlerLoaded) {
                return;
            }
            
            // Check if script is already in the DOM
            const existingScript = document.querySelector('script[src*="parent-window-link-handler.js"]');
            if (existingScript) {
                this.parentLinkHandlerLoaded = true;
                this.debugLog('Parent window link handler script already loaded');
                return;
            }
            
            // Determine the script URL based on current script location
            // Try to get the base URL from the current script
            let scriptUrl = 'https://lumichat.norta.ai/parent-window-link-handler.js';
            
            // Try to detect the script source to use the same domain
            const currentScript = document.currentScript || 
                                    Array.from(document.querySelectorAll('script')).find(s => 
                                        s.src && s.src.includes('lumi-assistant-widget')
                                    );
            
            if (currentScript && currentScript.src) {
                try {
                    const url = new URL(currentScript.src);
                    scriptUrl = `https://lumichat.norta.ai/parent-window-link-handler.js`;
                } catch (e) {
                    this.debugLog('Could not parse script URL, using default:', e);
                }
            }
            
            this.debugLog('Loading parent window link handler from:', scriptUrl);
            
            // Create and load the script
            const script = document.createElement('script');
            script.src = scriptUrl;
            script.async = true;
            script.onload = () => {
                this.parentLinkHandlerLoaded = true;
                this.debugLog('Parent window link handler loaded successfully');
            };
            script.onerror = (error) => {
                console.warn('Failed to load parent window link handler:', error);
                // Don't set flag to false so we don't keep retrying
            };
            
            // Add to head
            document.head.appendChild(script);
        }
        
        // Host page scrolling stays enabled while landing/chat are open (no lockBodyScroll).
        unlockBodyScroll(reason = 'default') {
            if (typeof document === 'undefined' || !document.body || this.bodyScrollLockCount === 0) return;
            this.bodyScrollLockCount = Math.max(0, this.bodyScrollLockCount - 1);
            this.debugLog('Body scroll unlock requested:', reason, 'remaining locks:', this.bodyScrollLockCount);
            if (this.bodyScrollLockCount === 0) {
                document.body.style.overflow = this.originalBodyOverflow || '';
                document.body.style.paddingRight = this.originalBodyPaddingRight || '';
            }
        }
        
        // Load messages from sessionStorage
        loadMessagesFromStorage() {
            try {
                const stored = sessionStorage.getItem('lumiChatMessages');
                if (stored) {
                    const messages = JSON.parse(stored);
                    // Deduplicate messages by content + type
                    const seen = new Set();
                    const deduplicated = messages.filter(msg => {
                        const key = `${msg.type}:${msg.content}`;
                        if (seen.has(key)) {
                            return false;
                        }
                        seen.add(key);
                        return true;
                    });
                    this.debugLog(`Loaded ${deduplicated.length} deduplicated messages from storage (had ${messages.length})`);
                    return deduplicated;
                }
            } catch (e) {
                console.error('Error loading messages from storage:', e);
            }
            return [];
        }
        
        // Save messages to sessionStorage
        saveMessagesToStorage() {
            try {
                // Deduplicate before saving
                const seen = new Set();
                const deduplicated = this.messages.filter(msg => {
                    const key = `${msg.type}:${msg.content}`;
                    if (seen.has(key)) {
                        return false;
                    }
                    seen.add(key);
                    return true;
                });
                sessionStorage.setItem('lumiChatMessages', JSON.stringify(deduplicated));
                // Update this.messages to the deduplicated version
                this.messages = deduplicated;
            } catch (e) {
                console.error('Error saving messages to storage:', e);
            }
        }
        
        // Restore messages to DOM
        restoreMessagesToDOM() {
            const messagesContainer = this.container.querySelector('#lumi-chat-messages');
            this.debugLog('restoreMessagesToDOM called - messagesContainer found:', !!messagesContainer);
            this.debugLog('this.messages length:', this.messages ? this.messages.length : 'null');
            
            if (!messagesContainer) {
                this.debugLog('Messages container not found, returning');
                return;
            }
            
            // Check if messages already exist in DOM - but only skip if count matches
            const existingMessages = messagesContainer.querySelectorAll('.lumi-chat-message');
            this.debugLog('Existing messages in DOM:', existingMessages.length, 'Expected:', this.messages.length);
            
            // Only skip restoration if we already have the correct number of messages
            if (existingMessages.length >= this.messages.length) {
                this.debugLog('Messages already in DOM with correct count, not restoring');
                return;
            }
            
            // Define the welcome messages in order
            const welcomeMessages = [
                "Hi, I'm LuMi, Lundbeck's AI-assisted chatbot. I am here to answer questions about VYEPTI® (eptinezumab-jjmr). The transcript of this chat will be stored for monitoring and compliance purposes.",
                "What would you like to know? Type your question or choose from the following options.",
                '<a href="https://www.lundbeck.com/content/dam/lundbeck-com/americas/united-states/products/neurology/vyepti_pi_us_en.pdf" target="_blank">Prescribing Information</a>',
                "Ask a Question about VYEPTI"
            ];
            
            // Clear existing messages from DOM
            messagesContainer.innerHTML = '';
            
            // Add welcome messages first
            welcomeMessages.forEach(msg => {
                this.addMessageToDOM('assistant', msg);
            });
            
            // Then add session messages in order
            this.debugLog('Restoring', this.messages.length, 'messages to DOM');
            if (this.messages.length > 0) {
                this.messages.forEach((msg, index) => {
                    this.debugLog(`Restoring message ${index + 1}/${this.messages.length}:`, msg.type, msg.content.substring(0, 50));
                    this.addMessageToDOM(msg.type, msg.content, msg.suggestedQuestions);
                });
                this.debugLog('All messages restored to DOM');
            } else {
                this.debugLog('No messages to restore');
            }
        }
        
        // Add message to DOM only (without adding to array)
        addMessageToDOM(type, content, suggestedQuestions = null) {
            const messagesContainer = this.container.querySelector('#lumi-chat-messages');
            if (!messagesContainer) return null;

            const messageId = 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const messageDiv = document.createElement('div');
            messageDiv.className = `lumi-chat-message ${type}`;
            messageDiv.setAttribute('data-message-id', messageId);

            // Special handling for "Ask a Question about VYEPTI" - make it a clickable button
            const isAskQuestionButton = content === "Ask a Question about VYEPTI";
            
            if (type === 'assistant') {
                if (isAskQuestionButton) {
                    // Render as a button
                    messageDiv.innerHTML = `
                        <div class="lumi-chat-avatar">
                            <img src="https://lumichat.norta.ai/assets/Vyepti_Logo.svg" alt="AI Avatar" />
                        </div>
                        <div class="lumi-chat-message-content">
                            <button class="lumi-ask-question-btn" data-message-id="${messageId}">Ask a Question about VYEPTI</button>
                        </div>
                    `;
                } else {
                    messageDiv.innerHTML = `
                        <div class="lumi-chat-avatar">
                            <img src="https://lumichat.norta.ai/assets/Vyepti_Logo.svg" alt="AI Avatar" />
                        </div>
                        <div class="lumi-chat-message-content">${this.formatMessageContent(content)}</div>
                    `;
                }
            } else {
                messageDiv.innerHTML = `
                    <div class="lumi-chat-message-content">${this.formatMessageContent(content)}</div>
                `;
            }

            messagesContainer.appendChild(messageDiv);
            
            // Add click handler for the "Ask a Question about VYEPTI" button
            if (isAskQuestionButton) {
                const button = messageDiv.querySelector('.lumi-ask-question-btn');
                if (button) {
                    button.addEventListener('click', () => {
                        // Check if button is already disabled
                        if (button.disabled || button.classList.contains('disabled')) {
                            return;
                        }
                        
                        // Disable the button to prevent multiple clicks
                        button.disabled = true;
                        button.classList.add('disabled');
                        button.style.cursor = 'not-allowed';
                        button.style.opacity = '0.6';
                        
                        // Add "Great! Let's get started." message to the chat
                        this.addMessageToDOM('assistant', "Great! Let's get started.");
                    });
                }
            }

            // Add suggested questions if provided
            if (suggestedQuestions && suggestedQuestions.length > 0) {
                const suggestedDiv = document.createElement('div');
                suggestedDiv.className = 'lumi-suggested-questions';
                
                suggestedQuestions.forEach(question => {
                    const questionBtn = document.createElement('button');
                    questionBtn.className = 'lumi-suggested-question';
                    questionBtn.textContent = question;
                    questionBtn.addEventListener('click', () => {
                        this.handleSuggestedQuestion(question);
                    });
                    suggestedDiv.appendChild(questionBtn);
                });
                
                messagesContainer.appendChild(suggestedDiv);
            }

            // Smart scrolling: scroll to question bubble for assistant responses
            if (type === 'assistant') {
                const userMessages = messagesContainer.querySelectorAll('.lumi-chat-message.user');
                if (userMessages.length > 0) {
                    const lastUserMessage = userMessages[userMessages.length - 1];
                    // Calculate the position of the user message within the messages container
                    const messageRect = lastUserMessage.getBoundingClientRect();
                    const containerRect = messagesContainer.getBoundingClientRect();
                    const relativeTop = messageRect.top - containerRect.top + messagesContainer.scrollTop;
                    
                    // Scroll to the user message position within the messages container
                    messagesContainer.scrollTo({
                        top: relativeTop - 20, // Add some padding
                        behavior: 'smooth'
                    });
                } else {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }
            } else {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
            
            return messageId;
        }

        generateSessionId() {
            return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        }

        /**
         * Get or create a session ID from sessionStorage
         * Returns the existing sessionId if available, otherwise null
         */
        getSessionIdFromStorage() {
            try {
                return sessionStorage.getItem('lumiSessionId');
            } catch (e) {
                console.error('Error reading sessionId from sessionStorage:', e);
                return null;
            }
        }

        /**
         * Store session ID in sessionStorage
         */
        saveSessionIdToStorage(sessionId) {
            try {
                sessionStorage.setItem('lumiSessionId', sessionId);
                this.sessionId = sessionId;
                this.debugLog('Session ID saved to sessionStorage:', sessionId);
            } catch (e) {
                console.error('Error saving sessionId to sessionStorage:', e);
            }
        }

        /**
         * Get avatar session ID from sessionStorage
         */
        getAvatarSessionIdFromStorage() {
            try {
                return sessionStorage.getItem('lumiAvatarSessionId');
            } catch (e) {
                console.error('Error reading avatarSessionId from sessionStorage:', e);
                return null;
            }
        }

        /**
         * Store avatar session ID in sessionStorage
         */
        saveAvatarSessionIdToStorage(sessionId) {
            try {
                if (sessionId) {
                    sessionStorage.setItem('lumiAvatarSessionId', sessionId);
                    this.debugLog('Avatar session ID saved to sessionStorage:', sessionId);
                } else {
                    sessionStorage.removeItem('lumiAvatarSessionId');
                    this.debugLog('Avatar session ID removed from sessionStorage');
                }
            } catch (e) {
                console.error('Error saving avatarSessionId to sessionStorage:', e);
            }
        }

        /**
         * Create a new session via the session management API
         * @param {number} communicationMode - 2 for voice/avatar sessions, 1 for text chat sessions (default: 1)
         * @returns {Promise<string>} The sessionId from the API response
         */
        async createNewSession(communicationMode = 1) {
            try {
                this.debugLog(`Creating new session via API with communicationMode: ${communicationMode}, environment: ${this.environment}...`);
                const response = await fetch('https://lumisessionmgmt.norta.ai/api/Sessions', {
                    method: 'POST',
                    headers: {
                        'accept': 'text/plain',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        communicationMode: communicationMode,
                        environment: this.environment
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                this.debugLog('Session created:', data);
                
                if (data.sessionId) {
                    // Only save to sessionStorage for text chat sessions (mode 1)
                    // Voice sessions (mode 2) are tracked separately in avatarSessionId
                    if (communicationMode === 1) {
                        this.saveSessionIdToStorage(data.sessionId);
                        
                        // Notify parent window that text chat has started
                        // Event includes sessionId for tracking the text chat session
                        this.notifyParentWindow('text-chat-start', {
                            sessionId: data.sessionId,
                            trigger: 'first-message'
                        });
                    }
                    return data.sessionId;
                } else {
                    throw new Error('No sessionId in response');
                }
            } catch (error) {
                console.error('Error creating new session:', error);
                throw error;
            }
        }

        /**
         * Post a message to the SessionMessages endpoint
         * @param {string} sessionId - The session ID
         * @param {string} from - Message sender ('user' or 'lumi')
         * @param {string} to - Message recipient ('user' or 'lumi')
         * @param {string} body - Message body
         * @param {string|null|undefined} replyTo - Optional messageId to reply to. If not provided, replyTo field will be omitted from request.
         */
        async postMessageToSession(sessionId, from, to, body, replyTo = null) {
            try {
                // Build request body, only including replyTo if it's provided
                const requestBody = {
                    sessionId: sessionId,
                    from: from,
                    to: to,
                    body: body,
                    environment: this.environment
                };
                
                // Only include replyTo field if it's provided (not null/undefined)
                if (replyTo !== null && replyTo !== undefined && replyTo !== '') {
                    requestBody.replyTo = replyTo;
                }
                
                this.debugLog('Posting message to SessionMessages:', requestBody);
                const response = await fetch('https://lumisessionmgmt.norta.ai/api/SessionMessages', {
                    method: 'POST',
                    headers: {
                        'accept': 'text/plain',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                this.debugLog('Message posted to SessionMessages:', data);
                return data;
            } catch (error) {
                console.error('Error posting message to SessionMessages:', error);
                // Don't throw - we don't want to break the chat flow if this fails
            }
        }

        // SessionStorage helper methods for landing window shown state
        hasShownLandingWindowThisSession() {
            try {
                return sessionStorage.getItem('hasShownLandingWindow') === 'true';
            } catch (e) {
                console.error('Error reading from sessionStorage:', e);
                return false;
            }
        }

        // Helper function to get a z-index that's guaranteed to be above the nav bar
        getZIndexAboveNavBar(baseZIndex = 10000) {
            const navBar = document.querySelector('nav, .navbar, .navigation, header, .header');
            let navBarZIndex = 0;
            if (navBar) {
                const navStyle = window.getComputedStyle(navBar);
                const navZ = parseInt(navStyle.zIndex, 10);
                if (!isNaN(navZ) && navZ > 0) {
                    navBarZIndex = navZ;
                }
            }
            // Return the higher of baseZIndex or navBarZIndex + 1
            const finalZIndex = Math.max(baseZIndex, navBarZIndex + 1);
            this.debugLog('getZIndexAboveNavBar: navBarZIndex:', navBarZIndex, 'baseZIndex:', baseZIndex, 'finalZIndex:', finalZIndex);
            return finalZIndex;
        }

        setHasShownLandingWindow(shown = true) {
            try {
                sessionStorage.setItem('hasShownLandingWindow', shown.toString());
                this.debugLog('Landing window shown state saved to sessionStorage:', shown);
            } catch (e) {
                console.error('Error writing to sessionStorage:', e);
            }
        }

        /**
         * Detect if device is iPad
         * iPad detection is tricky - need to check for iPad in user agent
         * or check for touch + Macintosh user agent (newer iPads on iPadOS 13+)
         */
        isIPad() {
            const ua = navigator.userAgent.toLowerCase();
            // Check for explicit iPad in user agent
            const isIPadUA = /ipad/.test(ua);
            // Check for newer iPads (iPadOS 13+) which report as Macintosh with touch
            // Avoid deprecated navigator.platform, use user agent instead
            const isIPadOS = /macintosh/.test(ua) && navigator.maxTouchPoints > 1 && !window.MSStream;
            return isIPadUA || isIPadOS;
        }

        /**
         * Detect if device is in landscape orientation
         * Landscape: width > height
         */
        isLandscape() {
            return window.innerWidth > window.innerHeight;
        }

        /**
         * Check if avatar button should be hidden
         * Hide button ONLY if iPad AND landscape
         */
        shouldHideAvatarButton() {
            return this.isIPad() && this.isLandscape();
        }

        hasChatWindowExplicitlyClosed() {
            try {
                return sessionStorage.getItem('chatWindowExplicitlyClosed') === 'true';
            } catch (e) {
                console.error('Error reading chatWindowExplicitlyClosed from sessionStorage:', e);
                return false;
            }
        }

        setChatWindowExplicitlyClosed(closed = true) {
            try {
                sessionStorage.setItem('chatWindowExplicitlyClosed', closed.toString());
                this.debugLog('Chat window explicitly closed state saved to sessionStorage:', closed);
            } catch (e) {
                console.error('Error writing chatWindowExplicitlyClosed to sessionStorage:', e);
            }
        }

        init() {
            this.debugLog('Initializing LuMi Assistant Widget');
            
            // Restore avatar session ID from sessionStorage if it exists
            const storedAvatarSessionId = this.getAvatarSessionIdFromStorage();
            if (storedAvatarSessionId) {
                this.avatarSessionId = storedAvatarSessionId;
                this.debugLog('Restored avatar session ID from sessionStorage:', this.avatarSessionId);
            }
            
            // Load parent window link handler script dynamically
            // This enables links clicked in the iframe to open in the parent window
            this.loadParentWindowLinkHandler();
            
            // Flag to prevent z-index changes during initial widget setup
            // Menu/safetyInfo are never expanded on page load, so we should never lower z-index during initialization
            this.isInitializing = true;
            this.createWidget();
            this.bindEvents();
            this.attachExistingButtonListeners();
            this.addWelcomeMessages();
            
            // Hide existing button if iPad + landscape
            const existingButton = document.getElementById('lumi-assistant-btn');
            if (existingButton && this.shouldHideAvatarButton()) {
                existingButton.style.setProperty('display', 'none', 'important');
                existingButton.style.setProperty('visibility', 'hidden', 'important');
                this.debugLog('Hidden existing avatar button (iPad landscape mode)');
            }
            
            // Detect Edge browser - Edge may need more time for layout to settle
            const isEdge = /Edg/.test(navigator.userAgent);
            const initialDelay = isEdge ? 200 : 0; // Extra delay for Edge on initial load
            
            // Update positioning after widget is created and DOM is ready
            // Use requestAnimationFrame to ensure button is rendered before measuring
            // Add extra delay for Edge browser on initial load to allow layout to settle
            requestAnimationFrame(() => {
                setTimeout(() => {
                    // CRITICAL: Check sessionStorage FIRST and hide landing window/polygon if already shown
                    // This must happen BEFORE any other code that might show them
                    const isMobile = window.innerWidth <= 768;
                    const hasShown = this.hasShownLandingWindowThisSession();
                    
                    if (hasShown) {
                        if (isMobile) {
                            // Hide mobile landing window and polygon immediately if already shown this session
                            const landingWindow = this.container.querySelector('#lumi-landing-window') || document.querySelector('#lumi-landing-window');
                            const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                            
                            if (landingWindow) {
                                landingWindow.classList.add('lumi-landing-dismissed');
                                landingWindow.style.setProperty('display', 'none', 'important');
                                landingWindow.style.setProperty('visibility', 'hidden', 'important');
                                landingWindow.style.setProperty('opacity', '0', 'important');
                                landingWindow.style.setProperty('pointer-events', 'none', 'important');
                            }
                            if (polygon) {
                                polygon.style.setProperty('display', 'none', 'important');
                                polygon.style.setProperty('visibility', 'hidden', 'important');
                                polygon.style.setProperty('opacity', '0', 'important');
                            }
                        } else {
                            // Desktop: hide desktop landing window and polygon
                            const landingWindow = this.container.querySelector('#lumi-landing-window-desktop') || document.querySelector('#lumi-landing-window-desktop');
                            const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                            
                            if (landingWindow) {
                                landingWindow.classList.add('lumi-landing-dismissed');
                                landingWindow.style.setProperty('display', 'none', 'important');
                                landingWindow.style.setProperty('visibility', 'hidden', 'important');
                                landingWindow.style.setProperty('opacity', '0', 'important');
                                landingWindow.style.setProperty('pointer-events', 'none', 'important');
                            }
                            if (polygon) {
                                polygon.style.setProperty('display', 'none', 'important');
                                polygon.style.setProperty('visibility', 'hidden', 'important');
                                polygon.style.setProperty('opacity', '0', 'important');
                            }
                        }
                    }
                    
                    // On Edge, add additional delay before positioning on initial load
                    if (isEdge && initialDelay > 0) {
                        setTimeout(() => {
                            this.updatePopupPosition();
                            // Use text mode if avatar is disabled, otherwise use ai mode
                            this.switchMode(this.config.enableAvatar ? 'ai' : 'text');
                        }, initialDelay);
                    } else {
                        this.updatePopupPosition();
                        // Use text mode if avatar is disabled, otherwise use ai mode
                        this.switchMode(this.config.enableAvatar ? 'ai' : 'text');
                    }
                    
                    // ALWAYS bind landing window events so buttons work even if window was dismissed
                    this.bindLandingWindowEvents();
                    
                    // Initialize button viewport state (desktop only)
                    if (!isMobile) {
                        const button = document.querySelector('#lumi-assistant-btn');
                        if (button) {
                            const buttonRect = button.getBoundingClientRect();
                            const viewportHeight = window.innerHeight;
                            const viewportWidth = window.innerWidth;
                            this.buttonWasInViewport = buttonRect.bottom > 0 && 
                                                        buttonRect.top < viewportHeight &&
                                                        buttonRect.right > 0 && 
                                                        buttonRect.left < viewportWidth;
                            this.debugLog('Initial button viewport state:', this.buttonWasInViewport);
                        }
                    }
                    
                    const hasMessages = Array.isArray(this.messages) && this.messages.length > 0;
                    const chatExplicitlyClosed = this.hasChatWindowExplicitlyClosed();

                if (isMobile) {
                    // Mobile/tablet (<=768) behavior per spec
                    // Only show chat window if there are messages AND chat was not explicitly closed by user
                    if (hasMessages && !chatExplicitlyClosed) {
                        this.debugLog('Mobile: existing chat session detected - showing chat window in text mode');
                        // Show chat directly, do not flash landing
                        this.isOpen = true;
                        this.container.classList.add('open');
                        this.container.classList.add('chat-active');
                        // Recompute mobile positioning for fresh load
                        this.updatePopupPosition();
                        const landingWindow = this.container.querySelector('.lumi-landing-window');
                        if (landingWindow) landingWindow.style.setProperty('display', 'none', 'important');
                        const chatWindow = this.container.querySelector('.lumi-chat-window');
                        if (chatWindow) {
                            // Get z-index that's above nav bar
                            const chatZIndex = this.getZIndexAboveNavBar(10001);
                            chatWindow.style.setProperty('display', 'flex', 'important');
                            chatWindow.style.setProperty('visibility', 'visible', 'important');
                            chatWindow.style.setProperty('opacity', '1', 'important');
                            chatWindow.style.setProperty('z-index', `${chatZIndex}`, 'important');
                            this.restoreMessagesToDOM();
                            setTimeout(() => this.switchMode('text'), 50);
                        }
                        // Also show the polygon
                        const polygon = this.container.querySelector('.lumi-chat-polygon');
                        if (polygon) {
                            // Get z-index that's above nav bar (above chat window)
                            const polygonZIndex = this.getZIndexAboveNavBar(10002);
                            polygon.style.setProperty('display', 'block', 'important');
                            polygon.style.setProperty('visibility', 'visible', 'important');
                            polygon.style.setProperty('opacity', '1', 'important');
                            polygon.style.setProperty('z-index', `${polygonZIndex}`, 'important');
                        }
                    } else if (hasMessages && chatExplicitlyClosed) {
                        this.debugLog('Mobile: chat session exists but was explicitly closed by user - not showing on page load');
                    } else if (!hasShown) {
                        // No messages and landing window hasn't been shown this session
                        // Show polygon and landing window together as a unit
                        this.debugLog('Mobile: showing landing window and polygon on page load (first time this session)');
                        this.showLandingWindowAndPolygon();
                        // Mark that landing window was shown this session
                        this.setHasShownLandingWindow(true);
                    } else {
                        // Landing window was already shown this session - don't show polygon or landing window
                        this.debugLog('Mobile: landing window was already shown this session - not showing again');
                        const landingWindow = this.container.querySelector('.lumi-landing-window') || document.querySelector('.lumi-landing-window');
                        const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                        if (landingWindow) {
                            landingWindow.classList.add('lumi-landing-dismissed');
                            landingWindow.style.setProperty('display', 'none', 'important');
                            landingWindow.style.setProperty('visibility', 'hidden', 'important');
                            landingWindow.style.setProperty('opacity', '0', 'important');
                            landingWindow.style.setProperty('pointer-events', 'none', 'important');
                        }
                        if (polygon) {
                            polygon.style.setProperty('display', 'none', 'important');
                            polygon.style.setProperty('visibility', 'hidden', 'important');
                            polygon.style.setProperty('opacity', '0', 'important');
                        }
                    }
                } else {
                    // Desktop behavior
                    // Only show chat window if there are messages AND chat was not explicitly closed by user
                    if (hasMessages && !chatExplicitlyClosed) {
                        this.debugLog('Desktop: existing chat session detected - showing chat window in text mode');
                        // Show chat directly with polygon - wait for button to render first
                        this.showChatWindowWithPolygonDesktop();
                    } else if (hasMessages && chatExplicitlyClosed) {
                        this.debugLog('Desktop: chat session exists but was explicitly closed by user - not showing on page load');
                    } else if (!hasShown) {
                        // No messages and landing window hasn't been shown this session
                        // Show polygon and desktop landing window together as a unit
                        this.debugLog('Desktop: showing landing window and polygon on page load (first time this session)');
                        this.showLandingWindowAndPolygonDesktop();
                        // Mark that landing window was shown this session
                        this.setHasShownLandingWindow(true);
                    } else {
                        // Landing window was already shown this session - don't show again on page load
                        this.debugLog('Desktop: landing window was already shown this session - not showing again on page load');
                        const landingWindow = this.container.querySelector('#lumi-landing-window-desktop') || document.querySelector('#lumi-landing-window-desktop');
                        const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                        if (landingWindow) {
                            landingWindow.classList.add('lumi-landing-dismissed');
                            landingWindow.style.setProperty('display', 'none', 'important');
                            landingWindow.style.setProperty('visibility', 'hidden', 'important');
                            landingWindow.style.setProperty('opacity', '0', 'important');
                            landingWindow.style.setProperty('pointer-events', 'none', 'important');
                        }
                        if (polygon) {
                            polygon.style.setProperty('display', 'none', 'important');
                            polygon.style.setProperty('visibility', 'hidden', 'important');
                            polygon.style.setProperty('opacity', '0', 'important');
                        }
                    }
                }
                
                // CRITICAL: Always clear isInitializing flag after initialization completes
                // This ensures z-index lowering works even if chat window is shown directly
                // or if safetyInfo expands before landing window timeout completes
                setTimeout(() => {
                    this.isInitializing = false;
                    this.debugLog('Widget initialization complete - isInitializing flag cleared, observers can now modify z-index');
                }, 500); // Use 500ms to ensure all initialization paths have completed
                }, 100);
            });
            
            // Update positioning on window resize
            // CRITICAL: Handle breakpoint transitions to prevent duplicate windows
            window.addEventListener('resize', () => {
                // CRITICAL: Remove duplicate landing windows BEFORE any other operations
                const allMobileLandingWindows = document.querySelectorAll('#lumi-landing-window');
                const allDesktopLandingWindows = document.querySelectorAll('#lumi-landing-window-desktop');
                
                if (allMobileLandingWindows.length > 1) {
                    console.warn('Resize: Multiple mobile landing windows found! Removing duplicates:', allMobileLandingWindows.length);
                    // Keep only the first one, remove all others
                    for (let i = 1; i < allMobileLandingWindows.length; i++) {
                        console.warn(`Resize: Removing duplicate mobile landing window #${i + 1}`);
                        allMobileLandingWindows[i].remove();
                    }
                }
                
                if (allDesktopLandingWindows.length > 1) {
                    console.warn('Resize: Multiple desktop landing windows found! Removing duplicates:', allDesktopLandingWindows.length);
                    // Keep only the first one, remove all others
                    for (let i = 1; i < allDesktopLandingWindows.length; i++) {
                        console.warn(`Resize: Removing duplicate desktop landing window #${i + 1}`);
                        allDesktopLandingWindows[i].remove();
                    }
                }
                
                const currentWidth = window.innerWidth;
                const previousWidth = this.previousViewportWidth;
                const wasMobile = previousWidth <= 768;
                const isMobile = currentWidth <= 768;
                
                // Handle iPad orientation change - show/hide button
                const button = document.querySelector('#lumi-assistant-btn');
                if (button) {
                    const shouldHide = this.shouldHideAvatarButton();
                    if (shouldHide) {
                        // Hide button on iPad landscape
                        button.style.setProperty('display', 'none', 'important');
                        button.style.setProperty('visibility', 'hidden', 'important');
                        this.debugLog('Resize: Hidden avatar button (iPad landscape mode)');
                    } else {
                        // Show button (iPad portrait or other devices)
                        // Use flex to match the CSS default for .lumi-assistant-button
                        button.style.setProperty('display', 'flex', 'important');
                        button.style.setProperty('visibility', 'visible', 'important');
                        this.debugLog('Resize: Shown avatar button (iPad portrait or other device)');
                    }
                }
                
                // Detect breakpoint transition (mobile <-> desktop)
                if (wasMobile !== isMobile) {
                    this.debugLog('Breakpoint transition detected:', { wasMobile, isMobile, previousWidth, currentWidth });
                    
                    // Hide the window from the previous breakpoint to prevent duplicates
                    if (wasMobile) {
                        // Transitioning from mobile to desktop - hide mobile window
                        const mobileLanding = this.container.querySelector('#lumi-landing-window') || document.querySelector('#lumi-landing-window');
                        if (mobileLanding) {
                            mobileLanding.style.setProperty('display', 'none', 'important');
                            mobileLanding.style.setProperty('visibility', 'hidden', 'important');
                            mobileLanding.style.setProperty('opacity', '0', 'important');
                            this.debugLog('Resize: Hidden mobile landing window during transition to desktop');
                        }
                    } else {
                        // Transitioning from desktop to mobile - hide desktop window
                        const desktopLanding = this.container.querySelector('#lumi-landing-window-desktop') || document.querySelector('#lumi-landing-window-desktop');
                        if (desktopLanding) {
                            desktopLanding.style.setProperty('display', 'none', 'important');
                            desktopLanding.style.setProperty('visibility', 'hidden', 'important');
                            desktopLanding.style.setProperty('opacity', '0', 'important');
                            this.debugLog('Resize: Hidden desktop landing window during transition to mobile');
                        }
                    }
                    
                    // Check if landing window should be visible and show/position the appropriate window for new breakpoint
                    const chatWindow = this.container.querySelector('.lumi-chat-window') || document.querySelector('.lumi-chat-window');
                    const chatWindowVisible = chatWindow && window.getComputedStyle(chatWindow).display !== 'none';
                    
                    // If chat window is not visible and widget is open, show landing window for new breakpoint
                    if (this.isOpen && !chatWindowVisible) {
                        // Check if landing window was visible before transition
                        const wasLandingVisible = wasMobile 
                            ? (this.container.querySelector('#lumi-landing-window') && window.getComputedStyle(this.container.querySelector('#lumi-landing-window')).display !== 'none')
                            : (this.container.querySelector('#lumi-landing-window-desktop') && window.getComputedStyle(this.container.querySelector('#lumi-landing-window-desktop')).display !== 'none');
                        
                        if (wasLandingVisible) {
                            this.debugLog('Resize: Landing window was visible, showing and positioning for new breakpoint');
                            // Show and position the appropriate window for the new breakpoint
                            if (isMobile) {
                                this.showLandingWindowAndPolygon();
                            } else {
                                this.showLandingWindowAndPolygonDesktop();
                            }
                        }
                    }
                }
                
                // Update previous width for next resize
                this.previousViewportWidth = currentWidth;
                
                // ALWAYS recalculate positions based on current avatar button position
                // This ensures windows are positioned correctly after resize
                this.updatePopupPosition();
            });
            // Update positioning on scroll — mobile and desktop (fixed UI must follow #lumi-assistant-btn)
            let rafId = null;
            
            window.addEventListener('scroll', () => {
                const isMobile = window.innerWidth <= 768;
                
                // Handle desktop: hide chat window when button leaves viewport
                if (!isMobile) {
                    const button = document.querySelector('#lumi-assistant-btn');
                    if (button) {
                        const buttonRect = button.getBoundingClientRect();
                        const viewportHeight = window.innerHeight;
                        const viewportWidth = window.innerWidth;
                        
                        // Check if button is in viewport (with some margin for partial visibility)
                        const isButtonInViewport = buttonRect.bottom > 0 && 
                                                    buttonRect.top < viewportHeight &&
                                                    buttonRect.right > 0 && 
                                                    buttonRect.left < viewportWidth;
                        
                        const chatWindow = this.container.querySelector('.lumi-chat-window');
                        const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                        
                        if (!isButtonInViewport && this.buttonWasInViewport) {
                            // Button just left viewport - hide chat window and unlock scroll
                            if (chatWindow) {
                                const chatStyles = window.getComputedStyle(chatWindow);
                                const isChatVisible = chatStyles.display !== 'none' && 
                                                    chatStyles.visibility !== 'hidden' && 
                                                    parseFloat(chatStyles.opacity) > 0;
                                
                                if (isChatVisible) {
                                    this.chatWindowWasVisibleBeforeScroll = true;
                                    // Hide chat window
                                    chatWindow.style.setProperty('display', 'none', 'important');
                                    chatWindow.style.setProperty('visibility', 'hidden', 'important');
                                    chatWindow.style.setProperty('opacity', '0', 'important');
                                    
                                    // Hide polygon
                                    if (polygon) {
                                        polygon.style.setProperty('display', 'none', 'important');
                                        polygon.style.setProperty('visibility', 'hidden', 'important');
                                        polygon.style.setProperty('opacity', '0', 'important');
                                    }
                                    
                                    // Unlock body scroll
                                    this.unlockBodyScroll('button left viewport');
                                    
                                    this.debugLog('Button left viewport - hiding chat window and unlocking scroll');
                                } else {
                                    this.chatWindowWasVisibleBeforeScroll = false;
                                }
                            }
                            this.buttonWasInViewport = false;
                        } else if (isButtonInViewport && !this.buttonWasInViewport) {
                            // Button just came back into viewport - update state but don't restore chat window
                            // User must click the avatar button again to show the chat window
                            this.buttonWasInViewport = true;
                            this.debugLog('Button back in viewport - chat window remains hidden until user clicks avatar button');
                        }
                    }
                    
                    // Desktop landing/chat/polygon use position:fixed — recompute from button rect on scroll
                    const desktopLanding = this.container.querySelector('#lumi-landing-window-desktop') || document.querySelector('#lumi-landing-window-desktop');
                    const chatWindowForScroll = this.container.querySelector('.lumi-chat-window');
                    let desktopLandingVisible = false;
                    if (desktopLanding) {
                        const ls = window.getComputedStyle(desktopLanding);
                        desktopLandingVisible = !desktopLanding.classList.contains('lumi-landing-dismissed') &&
                            ls.display !== 'none' &&
                            ls.visibility !== 'hidden' &&
                            parseFloat(ls.opacity) > 0;
                    }
                    let chatVisibleForScroll = false;
                    if (chatWindowForScroll) {
                        const cs = window.getComputedStyle(chatWindowForScroll);
                        chatVisibleForScroll = cs.display !== 'none' &&
                            cs.visibility !== 'hidden' &&
                            parseFloat(cs.opacity) > 0;
                    }
                    const shouldRepositionDesktop = desktopLandingVisible || chatVisibleForScroll ||
                        this.isOpen ||
                        (this.container && this.container.classList.contains('open'));
                    if (shouldRepositionDesktop) {
                        if (rafId !== null) {
                            cancelAnimationFrame(rafId);
                        }
                        rafId = requestAnimationFrame(() => {
                            this.updatePopupPosition();
                            rafId = null;
                        });
                    }
                    return;
                }
                
                // CRITICAL: Remove duplicate landing windows BEFORE any other operations
                const allLandingWindows = document.querySelectorAll('#lumi-landing-window');
                if (allLandingWindows.length > 1) {
                    console.warn('Scroll: Multiple landing windows found! Removing duplicates:', allLandingWindows.length);
                    // Keep only the first one, remove all others
                    for (let i = 1; i < allLandingWindows.length; i++) {
                        console.warn(`Scroll: Removing duplicate landing window #${i + 1}`);
                        allLandingWindows[i].remove();
                    }
                }
                
                // Check actual DOM state
                const hasOpenClass = this.container && this.container.classList.contains('open');
                
                // Check for mobile landing window (should be only one now)
                const landingWindow = document.querySelector('#lumi-landing-window');
                const chatWindow = this.container.querySelector('.lumi-chat-window');
                
                // Check if landing window is visible
                let isLandingVisible = false;
                if (landingWindow) {
                    const landingStyles = window.getComputedStyle(landingWindow);
                    const hasDismissedClass = landingWindow.classList.contains('lumi-landing-dismissed');
                    const boundingRect = landingWindow.getBoundingClientRect();
                    
                    isLandingVisible = !hasDismissedClass &&
                                        landingStyles.display !== 'none' && 
                                        landingStyles.visibility !== 'hidden' && 
                                        parseFloat(landingStyles.opacity) > 0 &&
                                        boundingRect.width > 0 && 
                                        boundingRect.height > 0;
                }
                
                // Check if chat window is visible
                let isChatVisible = false;
                if (chatWindow) {
                    const chatStyles = window.getComputedStyle(chatWindow);
                    const chatRect = chatWindow.getBoundingClientRect();
                    isChatVisible = chatStyles.display !== 'none' && 
                                    chatStyles.visibility !== 'hidden' && 
                                    parseFloat(chatStyles.opacity) > 0 &&
                                    chatRect.width > 0 &&
                                    chatRect.height > 0;
                }
                
                // Update positions if landing window OR chat window is visible on mobile
                const shouldUpdate = isLandingVisible || isChatVisible || this.isOpen || hasOpenClass;
                
                if (!shouldUpdate) {
                    return;
                }
                
                // Use requestAnimationFrame for smooth, synchronized updates
                // Cancel any pending animation frame to avoid queuing multiple updates
                if (rafId !== null) {
                    cancelAnimationFrame(rafId);
                }
                
                // Schedule update for next animation frame
                rafId = requestAnimationFrame(() => {
                    this.updatePopupPosition();
                    rafId = null;
                });
            }, { passive: true });
            
            // Define shared helper functions as instance methods so they can be accessed by both observers
            this.findSafetyInfo = () => {
                const element = document.querySelector('.safetyInfo.clickable');
                if (!element) {
                    // Try alternative selectors
                    const alt1 = document.querySelector('.safetyInfo');
                    const alt2 = document.querySelector('[class*="safetyInfo"]');
                    if (alt1) {
                        return alt1;
                    }
                    if (alt2) {
                        return alt2;
                    }
                }
                return element;
            };
            
            this.isSafetyInfoExpanded = (safetyInfo) => {
                if (!safetyInfo) return false;
                
                // Check for expansion classes - 'full' is the primary indicator for safetyInfo panel
                // Also check for other common expansion indicators as backup
                return safetyInfo.classList.contains('full') ||
                        safetyInfo.classList.contains('expanded') || 
                        safetyInfo.classList.contains('open') || 
                        safetyInfo.classList.contains('active') ||
                        safetyInfo.classList.contains('show');
            };
            
            this.isElementVisible = (element) => {
                if (!element) return false;
                const styles = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                return styles.display !== 'none' &&
                        styles.visibility !== 'hidden' &&
                        parseFloat(styles.opacity) > 0 &&
                        rect.width > 0 &&
                        rect.height > 0;
            };
            
            this.isPointInsideRect = (rect, x, y) => {
                if (!rect || typeof x !== 'number' || typeof y !== 'number') {
                    return false;
                }
                return x >= rect.left &&
                        x <= rect.right &&
                        y >= rect.top &&
                        y <= rect.bottom;
            };

            /**
             * Visible open nav dropdown / megamenu root element for stacking under site menus.
             * Lundbeck / AEM / Bootstrap use `.dropdown-menu` under `.nav-item.show`; older embeds used `.dropdown-menus.show`.
             */
            this.findOpenSiteDropdownPanel = () => {
                const panelLooksOpen = (el) => {
                    if (!el || !this.isElementVisible(el)) return false;
                    if (el.classList.contains('dropdown-menus')) {
                        return el.classList.contains('show');
                    }
                    if (el.classList.contains('dropdown-menu')) {
                        if (el.classList.contains('show')) return true;
                        const host = el.closest('.nav-item, .dropdown, li');
                        if (host && host.classList.contains('show')) return true;
                        if (host && host.querySelector('.dropdown-toggle[aria-expanded="true"], [data-bs-toggle="dropdown"][aria-expanded="true"]')) {
                            return true;
                        }
                        // Lundbeck / AEM: pure CSS hover flyouts (no .show / aria-expanded on the toggle)
                        const hoverLi = el.closest('li.has-submenu, li.menu-item-has-children');
                        if (hoverLi && this.isElementVisible(el)) {
                            const r = el.getBoundingClientRect();
                            if (r.height > 6 && r.width > 10) return true;
                        }
                    }
                    return el.classList.contains('show');
                };

                const tryEl = (el) => (panelLooksOpen(el) ? el : null);

                let hit = tryEl(document.querySelector('.dropdown-menus'));
                if (hit) return hit;

                const roots = [];
                const hdr = document.querySelector('header');
                const banner = document.querySelector('[role="banner"]');
                if (hdr) roots.push(hdr);
                if (banner && banner !== hdr) roots.push(banner);

                for (const root of roots) {
                    hit = tryEl(root.querySelector('.dropdown-menus.show')) || tryEl(root.querySelector('.dropdown-menus'));
                    if (hit) return hit;
                    hit = tryEl(root.querySelector('.dropdown-menu.show'));
                    if (hit) return hit;
                    hit = tryEl(root.querySelector(
                        '.dropdown.show > .dropdown-menu, .nav-item.dropdown.show > .dropdown-menu, ' +
                        'li.nav-item.show .dropdown-menu, .nav-item.show > .dropdown-menu'
                    ));
                    if (hit) return hit;
                    for (const menu of root.querySelectorAll('.dropdown-menu')) {
                        hit = tryEl(menu);
                        if (hit) return hit;
                    }
                }

                hit = tryEl(document.querySelector('.dropdown.show .dropdown-menu'));
                if (hit) return hit;

                // Bootstrap 5 / AEM: toggles use aria-expanded + aria-controls; panel may omit .show on the UL
                const hdrNav = document.querySelector('header') || document.querySelector('[role="banner"]');
                if (hdrNav) {
                    const toggles = hdrNav.querySelectorAll(
                        'a[aria-expanded="true"], button[aria-expanded="true"], [data-bs-toggle="dropdown"][aria-expanded="true"]'
                    );
                    for (const t of toggles) {
                        const cid = t.getAttribute('aria-controls');
                        if (cid) {
                            try {
                                const byId = document.getElementById(cid);
                                if (byId && this.isElementVisible(byId)) {
                                    const r = byId.getBoundingClientRect();
                                    if (r.height > 12 && r.width > 24) return byId;
                                }
                            } catch (e) { /* invalid id */ }
                        }
                        let sib = t.nextElementSibling;
                        for (let i = 0; i < 10 && sib; i++) {
                            if (this.isElementVisible(sib)) {
                                const r = sib.getBoundingClientRect();
                                if (r.height > 20 && r.width > 40) return sib;
                            }
                            sib = sib.nextElementSibling;
                        }
                        const host = t.closest('.nav-item, .dropdown, li') || t.parentElement;
                        if (host) {
                            const subs = host.querySelectorAll(
                                '.dropdown-menu, ul[role="menu"], [class*="flyout"], [class*="Flyout"], ' +
                                '[class*="mega"], [class*="Mega"], [class*="submenu"], [class*="panel"]'
                            );
                            for (const sub of subs) {
                                if (tryEl(sub)) return sub;
                                if (this.isElementVisible(sub)) {
                                    const r = sub.getBoundingClientRect();
                                    if (r.height > 20 && r.width > 40) return sub;
                                }
                            }
                        }
                    }
                }

                // CSS :hover flyouts under li.has-submenu (no attribute / class mutations when opening)
                const hdrHover = document.querySelector('header') || document.querySelector('[role="banner"]');
                if (hdrHover) {
                    for (const li of hdrHover.querySelectorAll('li.has-submenu, li.menu-item-has-children')) {
                        const panel = li.querySelector(':scope > .submenu, :scope > .dropdown-menu, :scope > ul.submenu');
                        if (!panel) continue;
                        if (!this.isElementVisible(panel)) continue;
                        const r = panel.getBoundingClientRect();
                        if (r.height > 8 && r.width > 20) return panel;
                    }
                    for (const ul of hdrHover.querySelectorAll('ul.submenu.dropdown-menu, li.has-submenu ul.submenu')) {
                        if (!this.isElementVisible(ul)) continue;
                        const r2 = ul.getBoundingClientRect();
                        if (r2.height > 8 && r2.width > 20) return ul;
                    }
                }

                return null;
            };

            /**
             * Root-level z-index of header/nav shells that contain the open menu. Inner .dropdown-menu z-index
             * is relative to this; LuMi uses z-index 1e5 so we must sit below the shell, not just the panel.
             */
            this.getSiteNavShellZIndex = (fromEl) => {
                let maxZ = 0;
                if (!fromEl) return maxZ;
                let n = fromEl;
                while (n && n !== document.body) {
                    if (n.matches && n.matches(
                        'header, [role="banner"], nav, .navbar, .navigation, .header-block, ' +
                        '[class*="site-header"], [class*="global-header"], [class*="page-header"]'
                    )) {
                        const s = window.getComputedStyle(n);
                        const zi = parseInt(s.zIndex, 10);
                        if (!isNaN(zi) && zi > 0) maxZ = Math.max(maxZ, zi);
                    }
                    n = n.parentElement;
                }
                return maxZ;
            };

            /** Open dropdown panel (or null). Used for z-index math and “is menu open” checks. */
            this.findDropdownMenu = () => this.findOpenSiteDropdownPanel();

            /** Whether any site header/nav dropdown is expanded (argument ignored; kept for call-site compatibility). */
            this.isDropdownExpanded = () => !!this.findOpenSiteDropdownPanel();
            
            this.findCookieBanner = () => document.querySelector('#coiConsentBanner');
            this.findCookieOverlay = () => document.querySelector('#coiOverlay');
            this.isCookieBannerActive = (banner, overlay) => {
                if (!banner && !overlay) {
                    return false;
                }
                
                let bannerVisible = false;
                if (banner) {
                    const ariaHidden = banner.getAttribute('aria-hidden');
                    const bannerStyles = window.getComputedStyle(banner);
                    const bannerRect = banner.getBoundingClientRect();
                    bannerVisible = (ariaHidden !== 'true') &&
                                    bannerStyles.display !== 'none' &&
                                    bannerStyles.visibility !== 'hidden' &&
                                    parseFloat(bannerStyles.opacity) > 0 &&
                                    bannerRect.width > 0 &&
                                    bannerRect.height > 0;
                }
                
                let overlayVisible = false;
                if (overlay) {
                    const overlayStyles = window.getComputedStyle(overlay);
                    const overlayRect = overlay.getBoundingClientRect();
                    overlayVisible = overlayStyles.display !== 'none' &&
                                        overlayStyles.visibility !== 'hidden' &&
                                        parseFloat(overlayStyles.opacity) > 0 &&
                                        overlayRect.width > 0 &&
                                        overlayRect.height > 0;
                }
                
                return bannerVisible || overlayVisible;
            };
            
            // Watch for dropdown menu expansion and hide windows when menu is shown
            this.setupDropdownMenuObserver();
            
            // Set up mobile menu observer only on mobile devices
            const isMobile = window.innerWidth <= 768;
            if (isMobile) {
                this.setupMobileMenuObserver();
            }
            
            // Watch for safetyInfo expansion and lower z-index when safetyInfo is shown
            this.setupSafetyInfoObserver();
            
            // Watch for cookie consent banner appearing on mobile
            this.setupCookieBannerObserver();
            
            // Set up tab visibility change handler to keep avatar session running in background
            this.setupTabVisibilityHandler();
        }
        setupDropdownMenuObserver() {
            // Store original z-index values to restore when menu closes
            this.preMenuZIndex = {
                container: null,
                landingWindowDesktop: null,
                landingWindowMobile: null,
                chatWindow: null,
                polygon: null
            };
            
            // Function to reduce z-index of windows when menu is expanded
            // Store as instance method so it can be called from restoreZIndexAfterSafetyInfo
            this.lowerZIndexForMenu = () => {
                // Don't lower z-index during initial widget setup - menu/safetyInfo are never expanded on page load
                if (this.isInitializing) {
                    this.debugLog('Skipping menu z-index lowering during initialization');
                    return;
                }
                
                const dropdownMenu = this.findDropdownMenu();
                
                // Get the menu's actual z-index and check parent containers for stacking context
                // We need to find the highest z-index in the menu's stacking context
                let menuZIndex = 9999; // Default fallback
                let menuParentZIndex = 0;
                let loweredZIndex = 10; // Default fallback
                
                if (dropdownMenu) {
                    const menuStyle = window.getComputedStyle(dropdownMenu);
                    const menuZIndexValue = parseInt(menuStyle.zIndex, 10);
                    if (!isNaN(menuZIndexValue) && menuZIndexValue > 0) {
                        menuZIndex = menuZIndexValue;
                    }
                    
                    // Check parent containers for z-index that creates stacking context
                    // The menu might be in a parent with a higher z-index
                    let parent = dropdownMenu.parentElement;
                    while (parent && parent !== document.body) {
                        const parentStyle = window.getComputedStyle(parent);
                        const parentZ = parseInt(parentStyle.zIndex, 10);
                        if (!isNaN(parentZ) && parentZ > 0) {
                            menuParentZIndex = Math.max(menuParentZIndex, parentZ);
                        }
                        // If parent creates stacking context, use its z-index
                        if (parentStyle.position === 'fixed' || 
                            parentStyle.position === 'absolute' || 
                            parentStyle.position === 'sticky' ||
                            parentStyle.transform !== 'none' ||
                            parseFloat(parentStyle.opacity) < 1) {
                            if (menuParentZIndex > 0) {
                                break; // Found the stacking context parent
                            }
                        }
                        parent = parent.parentElement;
                    }
                    
                    // Use the higher of menu z-index or parent z-index (parent creates stacking context)
                    const effectiveMenuZIndex = Math.max(menuZIndex, menuParentZIndex);
                    
                    // Check for nav bar z-index to ensure we're above it
                    const navBar = document.querySelector('nav, .navbar, .navigation, header, .header');
                    let navBarZIndex = 0;
                    if (navBar) {
                        const navStyle = window.getComputedStyle(navBar);
                        const navZ = parseInt(navStyle.zIndex, 10);
                        if (!isNaN(navZ) && navZ > 0) {
                            navBarZIndex = navZ;
                        }
                    }
                    
                    // Set windows z-index to be just one level below the effective menu z-index
                    // But ensure it's still above the nav bar
                    loweredZIndex = Math.max(navBarZIndex + 1, effectiveMenuZIndex - 1);
                    
                    this.debugLog('Menu z-index calculation:', {
                        menuZIndex,
                        menuParentZIndex,
                        effectiveMenuZIndex,
                        navBarZIndex,
                        loweredZIndex
                    });
                } else {
                    // Fallback: set to a safe value above nav bar but below menu
                    const navBar = document.querySelector('nav, .navbar, .navigation, header, .header');
                    let navBarZIndex = 0;
                    if (navBar) {
                        const navStyle = window.getComputedStyle(navBar);
                        const navZ = parseInt(navStyle.zIndex, 10);
                        if (!isNaN(navZ) && navZ > 0) {
                            navBarZIndex = navZ;
                        }
                    }
                    loweredZIndex = Math.max(navBarZIndex + 1, menuZIndex - 1);
                }

                // LuMi is fixed on document.body with z-index 1e5; inner menu z-index is only relative to the
                // header/nav stacking context. Clamp below the shell’s root z-index so the whole menu paints above LuMi.
                let siteShellZ = dropdownMenu ? this.getSiteNavShellZIndex(dropdownMenu) : 0;
                if (siteShellZ === 0) {
                    const hdrShell = document.querySelector('header, [role="banner"]');
                    const expTg = hdrShell && hdrShell.querySelector(
                        'a[aria-expanded="true"], button[aria-expanded="true"], [data-bs-toggle="dropdown"][aria-expanded="true"]'
                    );
                    if (expTg) siteShellZ = this.getSiteNavShellZIndex(expTg);
                }
                if (siteShellZ > 0) {
                    const beforeShell = loweredZIndex;
                    loweredZIndex = Math.min(loweredZIndex, siteShellZ - 1);
                    loweredZIndex = Math.max(1, loweredZIndex);
                    this.debugLog('Adjusted LuMi z-index below site nav shell:', {
                        siteShellZ,
                        before: beforeShell,
                        loweredZIndex
                    });
                }
                
                // Temporarily lower container z-index to be just below menu (one level)
                // This makes the entire widget (including all children) appear behind the menu
                if (this.container) {
                    // Store original container z-index if not already stored
                    if (this.preMenuZIndex.container === null) {
                        const containerStyle = window.getComputedStyle(this.container);
                        const containerZIndex = parseInt(containerStyle.zIndex, 10);
                        // Store 10000 as default if z-index is auto or not set
                        if (isNaN(containerZIndex) || containerZIndex === 0) {
                            this.preMenuZIndex.container = 10000;
                        } else {
                            this.preMenuZIndex.container = containerZIndex;
                        }
                    }
                    // Lower container z-index to be just below menu
                    this.container.style.setProperty('z-index', `${loweredZIndex}`, 'important');
                    this.debugLog('Widget container z-index lowered to', loweredZIndex, 'due to dropdown menu (original: 10000, menu z-index:', menuZIndex, ')');
                }
                
                const landingWindowDesktop = document.querySelector('#lumi-landing-window-desktop');
                const landingWindowMobile = document.querySelector('#lumi-landing-window');
                const chatWindow = this.container.querySelector('.lumi-chat-window') || 
                                    document.querySelector('.lumi-chat-window') ||
                                    document.querySelector('#lumi-chat-window');
                const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                
                this.debugLog('Menu z-index:', menuZIndex, 'Setting windows to z-index:', loweredZIndex);
                
                // Lower z-index for desktop landing window if visible
                if (landingWindowDesktop) {
                    const desktopStyle = window.getComputedStyle(landingWindowDesktop);
                    const isDesktopVisible = desktopStyle.display !== 'none' && 
                                            desktopStyle.visibility !== 'hidden' &&
                                            parseFloat(desktopStyle.opacity) > 0;
                    if (isDesktopVisible) {
                        // Store original z-index if not already stored
                        if (this.preMenuZIndex.landingWindowDesktop === null) {
                            this.preMenuZIndex.landingWindowDesktop = desktopStyle.zIndex || '10003';
                        }
                        // Set z-index well below menu
                        landingWindowDesktop.style.setProperty('z-index', `${loweredZIndex}`, 'important');
                        this.debugLog('Desktop landing window z-index lowered to', loweredZIndex, 'due to dropdown menu (menu z-index:', menuZIndex, ')');
                    }
                }
                
                // Lower z-index for mobile landing window if visible
                if (landingWindowMobile) {
                    const mobileStyle = window.getComputedStyle(landingWindowMobile);
                    const isMobileVisible = mobileStyle.display !== 'none' && 
                                            mobileStyle.visibility !== 'hidden' &&
                                            parseFloat(mobileStyle.opacity) > 0;
                    if (isMobileVisible) {
                        // Store original z-index if not already stored
                        if (this.preMenuZIndex.landingWindowMobile === null) {
                            this.preMenuZIndex.landingWindowMobile = mobileStyle.zIndex || '10003';
                        }
                        // Set z-index well below menu
                        landingWindowMobile.style.setProperty('z-index', `${loweredZIndex}`, 'important');
                        this.debugLog('Mobile landing window z-index lowered to', loweredZIndex, 'due to dropdown menu (menu z-index:', menuZIndex, ')');
                    }
                }
                
                // Lower z-index for chat window if visible
                if (chatWindow) {
                    const chatStyle = window.getComputedStyle(chatWindow);
                    const isChatVisible = chatStyle.display !== 'none' && 
                                        chatStyle.visibility !== 'hidden' &&
                                        parseFloat(chatStyle.opacity) > 0;
                    if (isChatVisible) {
                        // Store original z-index if not already stored
                        if (this.preMenuZIndex.chatWindow === null) {
                            this.preMenuZIndex.chatWindow = chatStyle.zIndex || '10001';
                        }
                        // Set z-index well below menu
                        chatWindow.style.setProperty('z-index', `${loweredZIndex}`, 'important');
                        this.debugLog('Chat window z-index lowered to', loweredZIndex, 'due to dropdown menu (menu z-index:', menuZIndex, ')');
                    }
                }
                
                // Lower z-index for polygon if visible
                if (polygon) {
                    const polygonStyle = window.getComputedStyle(polygon);
                    const isPolygonVisible = polygonStyle.display !== 'none' && 
                                            polygonStyle.visibility !== 'hidden' &&
                                            parseFloat(polygonStyle.opacity) > 0;
                    if (isPolygonVisible) {
                        // Store original z-index if not already stored
                        if (this.preMenuZIndex.polygon === null) {
                            this.preMenuZIndex.polygon = polygonStyle.zIndex || '10002';
                        }
                        // Set z-index well below menu
                        polygon.style.setProperty('z-index', `${loweredZIndex}`, 'important');
                        this.debugLog('Polygon z-index lowered to', loweredZIndex, 'due to dropdown menu (menu z-index:', menuZIndex, ')');
                    }
                }
                
                this.debugLog('Lowered z-index of windows due to dropdown menu expansion');
            };
            
            // Store reference to lowerZIndexForMenu for local use
            const lowerZIndexForMenu = this.lowerZIndexForMenu;
            
            // Function to restore z-index when menu is closed
            const restoreZIndexAfterMenu = () => {
                // Check if safetyInfo is still expanded - if so, keep z-index lowered for safetyInfo
                const safetyInfo = this.findSafetyInfo();
                const isSafetyInfoStillExpanded = safetyInfo && this.isSafetyInfoExpanded(safetyInfo);
                
                if (isSafetyInfoStillExpanded) {
                    // SafetyInfo is still expanded - restore to 10000 first, then apply safetyInfo lowering
                    // This ensures we store the correct original values (10000) before applying safetyInfo lowering
                    this.debugLog('Menu closed but safetyInfo is still expanded - restoring to 10000 then applying safetyInfo lowering');
                    
                    // Clear all menu z-index tracking first
                    this.preMenuZIndex.container = null;
                    this.preMenuZIndex.landingWindowDesktop = null;
                    this.preMenuZIndex.landingWindowMobile = null;
                    this.preMenuZIndex.chatWindow = null;
                    this.preMenuZIndex.polygon = null;
                    
                    // Restore container to 10000 first
                    if (this.container) {
                        this.container.style.setProperty('z-index', '10000', 'important');
                    }
                    
                    // Restore child elements to their original values (from preSafetyInfoZIndex if available, otherwise use defaults)
                    const landingWindowDesktop = document.querySelector('#lumi-landing-window-desktop');
                    const landingWindowMobile = document.querySelector('#lumi-landing-window');
                    const chatWindow = this.container.querySelector('.lumi-chat-window') || 
                                        document.querySelector('.lumi-chat-window') ||
                                        document.querySelector('#lumi-chat-window');
                    const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                    
                    // Restore child elements - use safetyInfo stored values if available, otherwise restore to defaults
                    if (landingWindowDesktop) {
                        const restoredZ = this.preSafetyInfoZIndex.landingWindowDesktop !== null ? 
                                            this.preSafetyInfoZIndex.landingWindowDesktop : '10003';
                        landingWindowDesktop.style.setProperty('z-index', restoredZ.toString(), 'important');
                    }
                    if (landingWindowMobile) {
                        const restoredZ = this.preSafetyInfoZIndex.landingWindowMobile !== null ? 
                                            this.preSafetyInfoZIndex.landingWindowMobile : '10003';
                        landingWindowMobile.style.setProperty('z-index', restoredZ.toString(), 'important');
                    }
                    if (chatWindow) {
                        const restoredZ = this.preSafetyInfoZIndex.chatWindow !== null ? 
                                            this.preSafetyInfoZIndex.chatWindow : '10001';
                        chatWindow.style.setProperty('z-index', restoredZ.toString(), 'important');
                    }
                    if (polygon) {
                        const restoredZ = this.preSafetyInfoZIndex.polygon !== null ? 
                                            this.preSafetyInfoZIndex.polygon : '10002';
                        polygon.style.setProperty('z-index', restoredZ.toString(), 'important');
                    }
                    
                    // Clear safetyInfo stored values so lowering function will store correct original values (10000)
                    this.preSafetyInfoZIndex.container = null;
                    this.preSafetyInfoZIndex.landingWindowDesktop = null;
                    this.preSafetyInfoZIndex.landingWindowMobile = null;
                    this.preSafetyInfoZIndex.chatWindow = null;
                    this.preSafetyInfoZIndex.polygon = null;
                    
                    // Now trigger safetyInfo lowering which will store the restored values (10000) and lower them
                    requestAnimationFrame(() => {
                        this.lowerZIndexForSafetyInfo();
                    });
                    return; // Exit early
                }
                
                // Neither menu nor safetyInfo is expanded - restore to default z-index of 10000
                if (this.container) {
                    this.container.style.setProperty('z-index', '10000', 'important');
                    // Force re-render by briefly removing and re-adding the style
                    this.container.style.removeProperty('z-index');
                    // Use requestAnimationFrame to ensure re-render
                    requestAnimationFrame(() => {
                        this.container.style.setProperty('z-index', '10000', 'important');
                    });
                    this.preMenuZIndex.container = null; // Clear stored value
                    this.debugLog('Widget container z-index restored to 10000 after dropdown menu closed');
                }
                
                const landingWindowDesktop = document.querySelector('#lumi-landing-window-desktop');
                const landingWindowMobile = document.querySelector('#lumi-landing-window');
                const chatWindow = this.container.querySelector('.lumi-chat-window') || 
                                    document.querySelector('.lumi-chat-window') ||
                                    document.querySelector('#lumi-chat-window');
                const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                
                // Restore desktop landing window z-index
                if (landingWindowDesktop) {
                    if (this.preMenuZIndex.landingWindowDesktop !== null && this.preMenuZIndex.landingWindowDesktop !== undefined) {
                        landingWindowDesktop.style.setProperty('z-index', this.preMenuZIndex.landingWindowDesktop.toString(), 'important');
                        this.preMenuZIndex.landingWindowDesktop = null; // Clear stored value
                    }
                }
                
                // Restore mobile landing window z-index
                if (landingWindowMobile) {
                    if (this.preMenuZIndex.landingWindowMobile !== null && this.preMenuZIndex.landingWindowMobile !== undefined) {
                        landingWindowMobile.style.setProperty('z-index', this.preMenuZIndex.landingWindowMobile.toString(), 'important');
                        this.preMenuZIndex.landingWindowMobile = null; // Clear stored value
                    }
                }
                
                // Restore chat window z-index
                if (chatWindow) {
                    if (this.preMenuZIndex.chatWindow !== null && this.preMenuZIndex.chatWindow !== undefined) {
                        chatWindow.style.setProperty('z-index', this.preMenuZIndex.chatWindow.toString(), 'important');
                        this.preMenuZIndex.chatWindow = null; // Clear stored value
                    }
                }
                
                // Restore polygon z-index
                if (polygon) {
                    if (this.preMenuZIndex.polygon !== null && this.preMenuZIndex.polygon !== undefined) {
                        polygon.style.setProperty('z-index', this.preMenuZIndex.polygon.toString(), 'important');
                        this.preMenuZIndex.polygon = null; // Clear stored value
                    }
                }
                
                // Ignore document clicks for a short period after menu closes
                // This prevents the click that closed the menu from also closing the chat window
                this.ignoreNextDocumentClick = true;
                this.menuJustClosed = true;
                setTimeout(() => {
                    this.ignoreNextDocumentClick = false;
                    this.debugLog('ignoreNextDocumentClick flag cleared');
                }, 500);
                setTimeout(() => {
                    this.menuJustClosed = false;
                    this.debugLog('menuJustClosed flag cleared');
                }, 1000);
            };
            // Track previous dropdown state for polling fallback (use instance property for persistence)
            this.previousDropdownState = false;
            this.dropdownPollingInterval = null;
            this.ignoreNextDocumentClick = false; // Flag to ignore the click that closes the menu
            this.menuJustClosed = false; // Track if menu just closed
            
            // MutationObservers for header/nav dropdowns (legacy `.dropdown-menus`, Bootstrap `.dropdown-menu`, AEM nav)
                const observeDropdownMenu = () => {
                const observeRoot = document.querySelector('header') ||
                    document.querySelector('[role="banner"]') ||
                    document.querySelector('nav.navbar, nav[role="navigation"]') ||
                    document.querySelector('.dropdown-menus');
                if (!observeRoot) {
                    const retryCount = observeDropdownMenu.retryCount || 0;
                    if (retryCount < 10) {
                        observeDropdownMenu.retryCount = retryCount + 1;
                        this.debugLog(`Dropdown observe root not found, retry ${retryCount + 1}/10`);
                        setTimeout(observeDropdownMenu, 500);
                    } else {
                        this.debugLog('Dropdown observe root not found after 10 attempts, using polling only');
                        startPollingForDropdown();
                    }
                    return;
                }

                this.debugLog('Dropdown observers attached to:', observeRoot);
                this.previousDropdownState = false;

                let dropdownEvalRaf = null;
                const scheduleDropdownEval = () => {
                    if (dropdownEvalRaf !== null) {
                        cancelAnimationFrame(dropdownEvalRaf);
                    }
                    dropdownEvalRaf = requestAnimationFrame(() => {
                        dropdownEvalRaf = null;
                        const isExpanded = this.isDropdownExpanded();
                        if (isExpanded && !this.previousDropdownState) {
                            this.debugLog('Site nav dropdown opened — lowering LuMi z-index');
                            lowerZIndexForMenu();
                            this.previousDropdownState = true;
                        } else if (!isExpanded && this.previousDropdownState) {
                            this.debugLog('Site nav dropdown closed — restoring LuMi z-index');
                            restoreZIndexAfterMenu();
                            this.previousDropdownState = false;
                        } else {
                            this.previousDropdownState = isExpanded;
                        }
                    });
                };

                const observer = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        if (mutation.type === 'attributes' &&
                            (mutation.attributeName === 'class' || mutation.attributeName === 'aria-expanded')) {
                            scheduleDropdownEval();
                            break;
                        }
                    }
                });

                observer.observe(observeRoot, {
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'aria-expanded']
                });

                const bodyObserver = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        if (mutation.type !== 'attributes') continue;
                        const an = mutation.attributeName;
                        if (an !== 'class' && an !== 'aria-expanded') continue;
                        const t = mutation.target;
                        if (t.nodeType !== 1 || !t.closest) continue;
                        if (!t.closest('header, [role="banner"], nav, .navbar, .navigation')) continue;
                        scheduleDropdownEval();
                        break;
                    }
                });

                bodyObserver.observe(document.body, {
                    attributes: true,
                    attributeFilter: ['class', 'aria-expanded'],
                    subtree: true
                });

                // Hover-only flyouts (e.g. li.has-submenu) emit no DOM mutations; re-check on pointer activity in header/nav.
                const onPointerInSiteNav = (e) => {
                    const t = e.target;
                    if (!t || !t.closest) return;
                    if (t.closest('header, [role="banner"], .navbar, .navigation')) {
                        scheduleDropdownEval();
                    }
                };
                document.addEventListener('pointermove', onPointerInSiteNav, { capture: true, passive: true });
                document.addEventListener('pointerdown', onPointerInSiteNav, { capture: true, passive: true });
                document.addEventListener('focusin', onPointerInSiteNav, { capture: true });

                this.debugLog('Dropdown menu observers set up successfully');
                startPollingForDropdown();
            };
            
            // Polling fallback to check dropdown state periodically
            const startPollingForDropdown = () => {
                // Clear any existing polling interval
                if (this.dropdownPollingInterval) {
                    clearInterval(this.dropdownPollingInterval);
                }
                
                this.dropdownPollingInterval = setInterval(() => {
                    const isOpen = this.isDropdownExpanded();
                    if (isOpen) {
                        if (!this.previousDropdownState) {
                            this.debugLog('Polling: nav dropdown open — lowering z-index');
                        }
                        lowerZIndexForMenu();
                        this.previousDropdownState = true;
                    } else if (this.previousDropdownState) {
                        this.debugLog('Polling: nav dropdown closed — restoring z-index');
                        restoreZIndexAfterMenu();
                        this.previousDropdownState = false;
                    }
                }, 200); // Check every 200ms
            };
            
            // Start observing after DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', observeDropdownMenu);
            } else {
                observeDropdownMenu();
            }
        }
        
        setupMobileMenuObserver() {
            // MOBILE-ONLY menu observer - watches #menu-items with show-dropdown class
            // This is separate from desktop observer to avoid breaking desktop functionality
            
            // Store original z-index values to restore when menu closes (mobile-specific)
            this.preMobileMenuZIndex = {
                container: null,
                landingWindowMobile: null,
                chatWindow: null,
                polygon: null
            };
            
            // Helper function to find mobile menu element
            const findMobileMenu = () => {
                return document.querySelector('#menu-items');
            };
            
            // Helper function to check if mobile menu is expanded
            const isMobileMenuExpanded = (menuElement) => {
                if (!menuElement) return false;
                
                // Check for show-dropdown class
                const hasShowDropdownClass = menuElement.classList.contains('show-dropdown');
                
                // Check for display: block style
                const style = window.getComputedStyle(menuElement);
                const hasDisplayBlock = style.display === 'block';
                
                // Check if actually visible
                const rect = menuElement.getBoundingClientRect();
                const isVisible = hasDisplayBlock && 
                                    style.visibility !== 'hidden' &&
                                    parseFloat(style.opacity) > 0 &&
                                    rect.width > 0 &&
                                    rect.height > 0;
                
                // Menu is expanded if it has show-dropdown class OR display: block AND is visible
                return (hasShowDropdownClass || hasDisplayBlock) && isVisible;
            };
            
            // Store helper functions as instance methods for use in other methods
            this.findMobileMenu = findMobileMenu;
            this.isMobileMenuExpanded = (menuElement) => {
                if (!menuElement) {
                    menuElement = findMobileMenu();
                }
                return isMobileMenuExpanded(menuElement);
            };
            
            // Function to reduce z-index of windows when mobile menu is expanded
            // Store as instance method so it can be called from showLandingWindowAndPolygon
            this.lowerZIndexForMobileMenu = () => {
                // Don't lower z-index during initial widget setup
                if (this.isInitializing) {
                    this.debugLog('Skipping mobile menu z-index lowering during initialization');
                    return;
                }
                
                const mobileMenu = findMobileMenu();
                
                // Get the menu's actual z-index and check parent containers for stacking context
                let menuZIndex = 9999; // Default fallback
                let menuParentZIndex = 0;
                let loweredZIndex = 10; // Default fallback
                
                if (mobileMenu) {
                    const menuStyle = window.getComputedStyle(mobileMenu);
                    const menuZIndexValue = parseInt(menuStyle.zIndex, 10);
                    if (!isNaN(menuZIndexValue) && menuZIndexValue > 0) {
                        menuZIndex = menuZIndexValue;
                    }
                    
                    // Check parent containers for z-index that creates stacking context
                    let parent = mobileMenu.parentElement;
                    while (parent && parent !== document.body) {
                        const parentStyle = window.getComputedStyle(parent);
                        const parentZ = parseInt(parentStyle.zIndex, 10);
                        if (!isNaN(parentZ) && parentZ > 0) {
                            menuParentZIndex = Math.max(menuParentZIndex, parentZ);
                        }
                        // If parent creates stacking context, use its z-index
                        if (parentStyle.position === 'fixed' || 
                            parentStyle.position === 'absolute' || 
                            parentStyle.position === 'sticky' ||
                            parentStyle.transform !== 'none' ||
                            parseFloat(parentStyle.opacity) < 1) {
                            if (menuParentZIndex > 0) {
                                break; // Found the stacking context parent
                            }
                        }
                        parent = parent.parentElement;
                    }
                    
                    // Use the higher of menu z-index or parent z-index
                    const effectiveMenuZIndex = Math.max(menuZIndex, menuParentZIndex);
                    
                    // Check for nav bar z-index to ensure we're above it
                    const navBar = document.querySelector('nav, .navbar, .navigation, header, .header');
                    let navBarZIndex = 0;
                    if (navBar) {
                        const navStyle = window.getComputedStyle(navBar);
                        const navZ = parseInt(navStyle.zIndex, 10);
                        if (!isNaN(navZ) && navZ > 0) {
                            navBarZIndex = navZ;
                        }
                    }
                    
                    // Set windows z-index to be just one level below the effective menu z-index
                    loweredZIndex = Math.max(navBarZIndex + 1, effectiveMenuZIndex - 1);
                    
                    this.debugLog('Mobile menu z-index calculation:', {
                        menuZIndex,
                        menuParentZIndex,
                        effectiveMenuZIndex,
                        navBarZIndex,
                        loweredZIndex
                    });
                } else {
                    // Fallback: set to a safe value above nav bar but below menu
                    const navBar = document.querySelector('nav, .navbar, .navigation, header, .header');
                    let navBarZIndex = 0;
                    if (navBar) {
                        const navStyle = window.getComputedStyle(navBar);
                        const navZ = parseInt(navStyle.zIndex, 10);
                        if (!isNaN(navZ) && navZ > 0) {
                            navBarZIndex = navZ;
                        }
                    }
                    loweredZIndex = Math.max(navBarZIndex + 1, menuZIndex - 1);
                }
                
                // Lower container z-index
                if (this.container) {
                    if (this.preMobileMenuZIndex.container === null) {
                        const containerStyle = window.getComputedStyle(this.container);
                        const containerZIndex = parseInt(containerStyle.zIndex, 10);
                        if (isNaN(containerZIndex) || containerZIndex === 0) {
                            this.preMobileMenuZIndex.container = 10000;
                        } else {
                            this.preMobileMenuZIndex.container = containerZIndex;
                        }
                    }
                    this.container.style.setProperty('z-index', `${loweredZIndex}`, 'important');
                    this.debugLog('Widget container z-index lowered to', loweredZIndex, 'due to mobile menu (original: 10000, menu z-index:', menuZIndex, ')');
                }
                
                // Lower z-index for mobile landing window if visible
                const landingWindowMobile = document.querySelector('#lumi-landing-window');
                if (landingWindowMobile) {
                    const mobileStyle = window.getComputedStyle(landingWindowMobile);
                    const isMobileVisible = mobileStyle.display !== 'none' && 
                                            mobileStyle.visibility !== 'hidden' &&
                                            parseFloat(mobileStyle.opacity) > 0;
                    if (isMobileVisible) {
                        if (this.preMobileMenuZIndex.landingWindowMobile === null) {
                            this.preMobileMenuZIndex.landingWindowMobile = mobileStyle.zIndex || '10003';
                        }
                        landingWindowMobile.style.setProperty('z-index', `${loweredZIndex}`, 'important');
                        this.debugLog('Mobile landing window z-index lowered to', loweredZIndex, 'due to mobile menu');
                    }
                }
                
                // Lower z-index for chat window if visible
                const chatWindow = this.container.querySelector('.lumi-chat-window') || 
                                    document.querySelector('.lumi-chat-window') ||
                                    document.querySelector('#lumi-chat-window');
                if (chatWindow) {
                    const chatStyle = window.getComputedStyle(chatWindow);
                    const isChatVisible = chatStyle.display !== 'none' && 
                                        chatStyle.visibility !== 'hidden' &&
                                        parseFloat(chatStyle.opacity) > 0;
                    if (isChatVisible) {
                        if (this.preMobileMenuZIndex.chatWindow === null) {
                            this.preMobileMenuZIndex.chatWindow = chatStyle.zIndex || '10001';
                        }
                        chatWindow.style.setProperty('z-index', `${loweredZIndex}`, 'important');
                        this.debugLog('Chat window z-index lowered to', loweredZIndex, 'due to mobile menu');
                    }
                }
                
                // Lower z-index for polygon if visible
                const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                if (polygon) {
                    const polygonStyle = window.getComputedStyle(polygon);
                    const isPolygonVisible = polygonStyle.display !== 'none' && 
                                            polygonStyle.visibility !== 'hidden' &&
                                            parseFloat(polygonStyle.opacity) > 0;
                    if (isPolygonVisible) {
                        if (this.preMobileMenuZIndex.polygon === null) {
                            this.preMobileMenuZIndex.polygon = polygonStyle.zIndex || '10002';
                        }
                        polygon.style.setProperty('z-index', `${loweredZIndex}`, 'important');
                        this.debugLog('Polygon z-index lowered to', loweredZIndex, 'due to mobile menu');
                    }
                }
                
                this.debugLog('Lowered z-index of windows due to mobile menu expansion');
            };
            
            // Function to restore z-index when mobile menu is closed
            const restoreZIndexAfterMobileMenu = () => {
                // Check if safetyInfo is still expanded - if so, keep z-index lowered for safetyInfo
                const safetyInfo = this.findSafetyInfo();
                const isSafetyInfoStillExpanded = safetyInfo && this.isSafetyInfoExpanded(safetyInfo);
                
                if (isSafetyInfoStillExpanded) {
                    // SafetyInfo is still expanded - restore to 10000 first, then apply safetyInfo lowering
                    this.debugLog('Mobile menu closed but safetyInfo is still expanded - restoring to 10000 then applying safetyInfo lowering');
                    
                    // Clear all mobile menu z-index tracking first
                    this.preMobileMenuZIndex.container = null;
                    this.preMobileMenuZIndex.landingWindowMobile = null;
                    this.preMobileMenuZIndex.chatWindow = null;
                    this.preMobileMenuZIndex.polygon = null;
                    
                    // Restore container to 10000 first
                    if (this.container) {
                        this.container.style.setProperty('z-index', '10000', 'important');
                    }
                    
                    // Restore child elements - use safetyInfo stored values if available, otherwise restore to defaults
                    const landingWindowMobile = document.querySelector('#lumi-landing-window');
                    const chatWindow = this.container.querySelector('.lumi-chat-window') || 
                                        document.querySelector('.lumi-chat-window') ||
                                        document.querySelector('#lumi-chat-window');
                    const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                    
                    if (landingWindowMobile) {
                        const restoredZ = this.preSafetyInfoZIndex.landingWindowMobile !== null ? 
                                            this.preSafetyInfoZIndex.landingWindowMobile : '10003';
                        landingWindowMobile.style.setProperty('z-index', restoredZ.toString(), 'important');
                    }
                    if (chatWindow) {
                        const restoredZ = this.preSafetyInfoZIndex.chatWindow !== null ? 
                                            this.preSafetyInfoZIndex.chatWindow : '10001';
                        chatWindow.style.setProperty('z-index', restoredZ.toString(), 'important');
                    }
                    if (polygon) {
                        const restoredZ = this.preSafetyInfoZIndex.polygon !== null ? 
                                            this.preSafetyInfoZIndex.polygon : '10002';
                        polygon.style.setProperty('z-index', restoredZ.toString(), 'important');
                    }
                    
                    // Clear safetyInfo stored values so lowering function will store correct original values (10000)
                    this.preSafetyInfoZIndex.container = null;
                    this.preSafetyInfoZIndex.landingWindowMobile = null;
                    this.preSafetyInfoZIndex.chatWindow = null;
                    this.preSafetyInfoZIndex.polygon = null;
                    
                    // Now trigger safetyInfo lowering which will store the restored values (10000) and lower them
                    requestAnimationFrame(() => {
                        this.lowerZIndexForSafetyInfo();
                    });
                    return; // Exit early
                }
                
                // Neither menu nor safetyInfo is expanded - restore to default z-index of 10000
                if (this.container) {
                    this.container.style.setProperty('z-index', '10000', 'important');
                    this.preMobileMenuZIndex.container = null;
                    this.debugLog('Widget container z-index restored to 10000 after mobile menu closed');
                }
                
                const landingWindowMobile = document.querySelector('#lumi-landing-window');
                const chatWindow = this.container.querySelector('.lumi-chat-window') || 
                                    document.querySelector('.lumi-chat-window') ||
                                    document.querySelector('#lumi-chat-window');
                const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                
                // Restore mobile landing window z-index
                if (landingWindowMobile) {
                    if (this.preMobileMenuZIndex.landingWindowMobile !== null && this.preMobileMenuZIndex.landingWindowMobile !== undefined) {
                        landingWindowMobile.style.setProperty('z-index', this.preMobileMenuZIndex.landingWindowMobile.toString(), 'important');
                        this.preMobileMenuZIndex.landingWindowMobile = null;
                    }
                }
                
                // Restore chat window z-index
                if (chatWindow) {
                    if (this.preMobileMenuZIndex.chatWindow !== null && this.preMobileMenuZIndex.chatWindow !== undefined) {
                        chatWindow.style.setProperty('z-index', this.preMobileMenuZIndex.chatWindow.toString(), 'important');
                        this.preMobileMenuZIndex.chatWindow = null;
                    }
                }
                
                // Restore polygon z-index
                if (polygon) {
                    if (this.preMobileMenuZIndex.polygon !== null && this.preMobileMenuZIndex.polygon !== undefined) {
                        polygon.style.setProperty('z-index', this.preMobileMenuZIndex.polygon.toString(), 'important');
                        this.preMobileMenuZIndex.polygon = null;
                    }
                }
            };
            
            // Track previous mobile menu state (separate from desktop)
            this.previousMobileMenuState = false;
            this.mobileMenuPollingInterval = null;
            
            // Set up MutationObserver to watch for class and style changes on mobile menu
            const observeMobileMenu = () => {
                const mobileMenu = findMobileMenu();
                if (!mobileMenu) {
                    // Menu not found yet, try again after a delay (max 10 attempts)
                    const retryCount = observeMobileMenu.retryCount || 0;
                    if (retryCount < 10) {
                        observeMobileMenu.retryCount = retryCount + 1;
                        this.debugLog(`Mobile menu (#menu-items) not found, retry ${retryCount + 1}/10`);
                        setTimeout(observeMobileMenu, 500);
                    } else {
                        this.debugLog('Mobile menu not found after 10 attempts, using polling fallback');
                        startPollingForMobileMenu();
                    }
                    return;
                }
                
                this.debugLog('Mobile menu (#menu-items) found:', mobileMenu);
                
                // Initialize previous state as false (not expanded)
                this.previousMobileMenuState = false;
                
                // Create observer to watch for class and style changes
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && 
                            (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                            // Re-query the mobile menu in case it was replaced
                            const currentMobileMenu = findMobileMenu();
                            if (!currentMobileMenu) return;
                            
                            const isExpanded = isMobileMenuExpanded(currentMobileMenu);
                            this.debugLog('Mobile menu class/style changed, isExpanded:', isExpanded, 'previousState:', this.previousMobileMenuState, 'target:', mutation.target);
                            
                            if (isExpanded && !this.previousMobileMenuState) {
                                // Menu just expanded - lower z-index of windows
                                this.debugLog('Mobile menu just expanded, lowering z-index of windows');
                                this.lowerZIndexForMobileMenu();
                                this.previousMobileMenuState = true;
                            } else if (!isExpanded && this.previousMobileMenuState) {
                                // Menu just closed - restore z-index
                                this.debugLog('Mobile menu closed, restoring z-index of windows');
                                restoreZIndexAfterMobileMenu();
                                this.previousMobileMenuState = false;
                            } else {
                                // State didn't change - update tracking but don't change z-index
                                this.previousMobileMenuState = isExpanded;
                            }
                        }
                    });
                });
                
                // Start observing the mobile menu element for both class and style changes
                observer.observe(mobileMenu, {
                    attributes: true,
                    attributeFilter: ['class', 'style']
                });
                
                // Also observe document body for mobile menu elements being added dynamically
                const bodyObserver = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && 
                            (mutation.attributeName === 'class' || mutation.attributeName === 'style')) {
                            const target = mutation.target;
                            // Check if the mutated element is the mobile menu or contains it
                            if (target.id === 'menu-items' || target.querySelector('#menu-items')) {
                                const currentMobileMenu = target.id === 'menu-items' ? target : target.querySelector('#menu-items');
                                if (currentMobileMenu) {
                                    const isExpanded = isMobileMenuExpanded(currentMobileMenu);
                                    this.debugLog('Body observer: Mobile menu class/style changed, isExpanded:', isExpanded, 'previousState:', this.previousMobileMenuState);
                                    
                                    if (isExpanded && !this.previousMobileMenuState) {
                                        // Menu just expanded - lower z-index of windows
                                        this.debugLog('Body observer: Mobile menu just expanded, lowering z-index of windows');
                                        this.lowerZIndexForMobileMenu();
                                        this.previousMobileMenuState = true;
                                    } else if (!isExpanded && this.previousMobileMenuState) {
                                        // Menu just closed - restore z-index
                                        this.debugLog('Body observer: Mobile menu closed, restoring z-index of windows');
                                        restoreZIndexAfterMobileMenu();
                                        this.previousMobileMenuState = false;
                                    } else {
                                        // State didn't change - update tracking but don't change z-index
                                        this.previousMobileMenuState = isExpanded;
                                    }
                                }
                            }
                        }
                    });
                });
                
                bodyObserver.observe(document.body, {
                    attributes: true,
                    attributeFilter: ['class', 'style'],
                    subtree: true
                });
                
                this.debugLog('Mobile menu observer set up successfully');
                
                // Always set up polling as a backup
                startPollingForMobileMenu();
            };
            
            // Polling fallback to check mobile menu state periodically
            const startPollingForMobileMenu = () => {
                // Clear any existing polling interval
                if (this.mobileMenuPollingInterval) {
                    clearInterval(this.mobileMenuPollingInterval);
                }
                
                this.mobileMenuPollingInterval = setInterval(() => {
                    const mobileMenu = findMobileMenu();
                    if (mobileMenu) {
                        const isExpanded = isMobileMenuExpanded(mobileMenu);
                        
                        if (isExpanded && !this.previousMobileMenuState) {
                            // Menu just expanded - lower z-index of windows
                            this.debugLog('Polling: Mobile menu is expanded, lowering z-index of windows');
                            this.lowerZIndexForMobileMenu();
                            this.previousMobileMenuState = true;
                        } else if (!isExpanded && this.previousMobileMenuState) {
                            // Menu just closed - restore z-index
                            this.debugLog('Polling: Mobile menu closed, restoring z-index of windows');
                            restoreZIndexAfterMobileMenu();
                            this.previousMobileMenuState = false;
                        }
                    }
                }, 200); // Check every 200ms
            };
            
            // Start observing after DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', observeMobileMenu);
            } else {
                observeMobileMenu();
            }
        }
        
        setupSafetyInfoObserver() {
            // Store original z-index values to restore when safetyInfo closes
            this.preSafetyInfoZIndex = {
                container: null,
                landingWindowDesktop: null,
                landingWindowMobile: null,
                chatWindow: null,
                polygon: null
            };
            
            // Function to reduce z-index of windows when safetyInfo is expanded
            // Store as instance method so it can be called from restoreZIndexAfterMenu
            this.lowerZIndexForSafetyInfo = () => {
                // Don't lower z-index during initial widget setup - menu/safetyInfo are never expanded on page load
                if (this.isInitializing) {
                    this.debugLog('Skipping safetyInfo z-index lowering during initialization');
                    return;
                }
                
                const safetyInfo = this.findSafetyInfo();
                
                // Get the safetyInfo's actual z-index and check parent containers for stacking context
                let safetyInfoZIndex = 9999; // Default fallback
                let safetyInfoParentZIndex = 0;
                let loweredZIndex = 10; // Default fallback
                
                if (safetyInfo) {
                    const safetyInfoStyle = window.getComputedStyle(safetyInfo);
                    const safetyInfoZIndexValue = parseInt(safetyInfoStyle.zIndex, 10);
                    if (!isNaN(safetyInfoZIndexValue) && safetyInfoZIndexValue > 0) {
                        safetyInfoZIndex = safetyInfoZIndexValue;
                    }
                    
                    // Check parent containers for z-index that creates stacking context
                    let parent = safetyInfo.parentElement;
                    while (parent && parent !== document.body) {
                        const parentStyle = window.getComputedStyle(parent);
                        const parentZ = parseInt(parentStyle.zIndex, 10);
                        if (!isNaN(parentZ) && parentZ > 0) {
                            safetyInfoParentZIndex = Math.max(safetyInfoParentZIndex, parentZ);
                        }
                        // If parent creates stacking context, use its z-index
                        if (parentStyle.position === 'fixed' || 
                            parentStyle.position === 'absolute' || 
                            parentStyle.position === 'sticky' ||
                            parentStyle.transform !== 'none' ||
                            parseFloat(parentStyle.opacity) < 1) {
                            if (safetyInfoParentZIndex > 0) {
                                break; // Found the stacking context parent
                            }
                        }
                        parent = parent.parentElement;
                    }
                    
                    // Use the higher of safetyInfo z-index or parent z-index
                    const effectiveSafetyInfoZIndex = Math.max(safetyInfoZIndex, safetyInfoParentZIndex);
                    
                    // Check for nav bar z-index to ensure we're above it
                    const navBar = document.querySelector('nav, .navbar, .navigation, header, .header');
                    let navBarZIndex = 0;
                    if (navBar) {
                        const navStyle = window.getComputedStyle(navBar);
                        const navZ = parseInt(navStyle.zIndex, 10);
                        if (!isNaN(navZ) && navZ > 0) {
                            navBarZIndex = navZ;
                        }
                    }
                    
                    // Set windows z-index to be just one level below the effective safetyInfo z-index
                    // But ensure it's still above the nav bar
                    loweredZIndex = Math.max(navBarZIndex + 1, effectiveSafetyInfoZIndex - 1);
                    
                    this.debugLog('SafetyInfo z-index calculation:', {
                        safetyInfoZIndex,
                        safetyInfoParentZIndex,
                        effectiveSafetyInfoZIndex,
                        navBarZIndex,
                        loweredZIndex
                    });
                    
                } else {
                    // Fallback: set to a safe value above nav bar but below safetyInfo
                    const navBar = document.querySelector('nav, .navbar, .navigation, header, .header');
                    let navBarZIndex = 0;
                    if (navBar) {
                        const navStyle = window.getComputedStyle(navBar);
                        const navZ = parseInt(navStyle.zIndex, 10);
                        if (!isNaN(navZ) && navZ > 0) {
                            navBarZIndex = navZ;
                        }
                    }
                    loweredZIndex = Math.max(navBarZIndex + 1, safetyInfoZIndex - 1);
                }
                
                // Temporarily lower container z-index to be just below safetyInfo (one level)
                // This makes the entire widget (including all children) appear behind the safetyInfo
                if (this.container) {
                    // Store original container z-index if not already stored
                    if (this.preSafetyInfoZIndex.container === null) {
                        const containerStyle = window.getComputedStyle(this.container);
                        const containerZIndex = parseInt(containerStyle.zIndex, 10);
                        // Store 10000 as default if z-index is auto or not set
                        if (isNaN(containerZIndex) || containerZIndex === 0) {
                            this.preSafetyInfoZIndex.container = 10000;
                        } else {
                            this.preSafetyInfoZIndex.container = containerZIndex;
                        }
                    }
                    // Lower container z-index to be just below safetyInfo
                    this.container.style.setProperty('z-index', `${loweredZIndex}`, 'important');
                    this.debugLog('Widget container z-index lowered to', loweredZIndex, 'due to safetyInfo (original: 10000, safetyInfo z-index:', safetyInfoZIndex, ')');
                }
                
                const landingWindowDesktop = document.querySelector('#lumi-landing-window-desktop');
                const landingWindowMobile = document.querySelector('#lumi-landing-window');
                const chatWindow = this.container.querySelector('.lumi-chat-window') || 
                                    document.querySelector('.lumi-chat-window') ||
                                    document.querySelector('#lumi-chat-window');
                const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                
                this.debugLog('SafetyInfo z-index:', safetyInfoZIndex, 'Setting windows to z-index:', loweredZIndex);
                
                // Lower z-index for desktop landing window if visible
                if (landingWindowDesktop) {
                    const desktopStyle = window.getComputedStyle(landingWindowDesktop);
                    const isDesktopVisible = desktopStyle.display !== 'none' && 
                                            desktopStyle.visibility !== 'hidden' &&
                                            parseFloat(desktopStyle.opacity) > 0;
                    if (isDesktopVisible) {
                        // Store original z-index if not already stored
                        if (this.preSafetyInfoZIndex.landingWindowDesktop === null) {
                            this.preSafetyInfoZIndex.landingWindowDesktop = desktopStyle.zIndex || '10003';
                        }
                        // Set z-index well below safetyInfo
                        landingWindowDesktop.style.setProperty('z-index', `${loweredZIndex}`, 'important');
                        this.debugLog('Desktop landing window z-index lowered to', loweredZIndex, 'due to safetyInfo (safetyInfo z-index:', safetyInfoZIndex, ')');
                    }
                }
                
                // Lower z-index for mobile landing window if visible
                if (landingWindowMobile) {
                    const mobileStyle = window.getComputedStyle(landingWindowMobile);
                    const isMobileVisible = mobileStyle.display !== 'none' && 
                                            mobileStyle.visibility !== 'hidden' &&
                                            parseFloat(mobileStyle.opacity) > 0;
                    if (isMobileVisible) {
                        // Store original z-index if not already stored
                        if (this.preSafetyInfoZIndex.landingWindowMobile === null) {
                            this.preSafetyInfoZIndex.landingWindowMobile = mobileStyle.zIndex || '10003';
                        }
                        // Set z-index well below safetyInfo
                        landingWindowMobile.style.setProperty('z-index', `${loweredZIndex}`, 'important');
                        this.debugLog('Mobile landing window z-index lowered to', loweredZIndex, 'due to safetyInfo (safetyInfo z-index:', safetyInfoZIndex, ')');
                    }
                }
                
                // Lower z-index for chat window if visible
                if (chatWindow) {
                    const chatStyle = window.getComputedStyle(chatWindow);
                    const isChatVisible = chatStyle.display !== 'none' && 
                                        chatStyle.visibility !== 'hidden' &&
                                        parseFloat(chatStyle.opacity) > 0;
                    if (isChatVisible) {
                        // Store original z-index if not already stored
                        if (this.preSafetyInfoZIndex.chatWindow === null) {
                            this.preSafetyInfoZIndex.chatWindow = chatStyle.zIndex || '10001';
                        }
                        // Set z-index well below safetyInfo
                        chatWindow.style.setProperty('z-index', `${loweredZIndex}`, 'important');
                        this.debugLog('Chat window z-index lowered to', loweredZIndex, 'due to safetyInfo (safetyInfo z-index:', safetyInfoZIndex, ')');
                    }
                }
                
                // Lower z-index for polygon if visible
                if (polygon) {
                    const polygonStyle = window.getComputedStyle(polygon);
                    const isPolygonVisible = polygonStyle.display !== 'none' && 
                                            polygonStyle.visibility !== 'hidden' &&
                                            parseFloat(polygonStyle.opacity) > 0;
                    if (isPolygonVisible) {
                        // Store original z-index if not already stored
                        if (this.preSafetyInfoZIndex.polygon === null) {
                            this.preSafetyInfoZIndex.polygon = polygonStyle.zIndex || '10002';
                        }
                        // Set z-index well below safetyInfo
                        polygon.style.setProperty('z-index', `${loweredZIndex}`, 'important');
                        this.debugLog('Polygon z-index lowered to', loweredZIndex, 'due to safetyInfo (safetyInfo z-index:', safetyInfoZIndex, ')');
                    }
                }
                
                this.debugLog('Lowered z-index of windows due to safetyInfo expansion');
            };
            
            // Store reference to lowerZIndexForSafetyInfo for local use
            const lowerZIndexForSafetyInfo = this.lowerZIndexForSafetyInfo;
            
            // Function to restore z-index when safetyInfo is closed
            const restoreZIndexAfterSafetyInfo = () => {
                // Check if menu is still expanded - if so, keep z-index lowered for menu
                const isMenuStillExpanded = this.isDropdownExpanded();
                
                if (isMenuStillExpanded) {
                    // Menu is still expanded - restore to 10000 first, then apply menu lowering
                    // This ensures we store the correct original values (10000) before applying menu lowering
                    this.debugLog('SafetyInfo closed but menu is still expanded - restoring to 10000 then applying menu lowering');
                    
                    // Clear all safetyInfo z-index tracking first
                    this.preSafetyInfoZIndex.container = null;
                    this.preSafetyInfoZIndex.landingWindowDesktop = null;
                    this.preSafetyInfoZIndex.landingWindowMobile = null;
                    this.preSafetyInfoZIndex.chatWindow = null;
                    this.preSafetyInfoZIndex.polygon = null;
                    
                    // Restore container to 10000 first
                    if (this.container) {
                        this.container.style.setProperty('z-index', '10000', 'important');
                    }
                    
                    // Restore child elements to their original values (from preMenuZIndex if available, otherwise use defaults)
                    const landingWindowDesktop = document.querySelector('#lumi-landing-window-desktop');
                    const landingWindowMobile = document.querySelector('#lumi-landing-window');
                    const chatWindow = this.container.querySelector('.lumi-chat-window') || 
                                        document.querySelector('.lumi-chat-window') ||
                                        document.querySelector('#lumi-chat-window');
                    const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                    
                    // Restore child elements - use menu stored values if available, otherwise restore to defaults
                    if (landingWindowDesktop) {
                        const restoredZ = this.preMenuZIndex.landingWindowDesktop !== null ? 
                                            this.preMenuZIndex.landingWindowDesktop : '10003';
                        landingWindowDesktop.style.setProperty('z-index', restoredZ.toString(), 'important');
                    }
                    if (landingWindowMobile) {
                        const restoredZ = this.preMenuZIndex.landingWindowMobile !== null ? 
                                            this.preMenuZIndex.landingWindowMobile : '10003';
                        landingWindowMobile.style.setProperty('z-index', restoredZ.toString(), 'important');
                    }
                    if (chatWindow) {
                        const restoredZ = this.preMenuZIndex.chatWindow !== null ? 
                                            this.preMenuZIndex.chatWindow : '10001';
                        chatWindow.style.setProperty('z-index', restoredZ.toString(), 'important');
                    }
                    if (polygon) {
                        const restoredZ = this.preMenuZIndex.polygon !== null ? 
                                            this.preMenuZIndex.polygon : '10002';
                        polygon.style.setProperty('z-index', restoredZ.toString(), 'important');
                    }
                    
                    // Clear menu stored values so lowering function will store correct original values (10000)
                    this.preMenuZIndex.container = null;
                    this.preMenuZIndex.landingWindowDesktop = null;
                    this.preMenuZIndex.landingWindowMobile = null;
                    this.preMenuZIndex.chatWindow = null;
                    this.preMenuZIndex.polygon = null;
                    
                    // Now trigger menu lowering which will store the restored values (10000) and lower them
                    requestAnimationFrame(() => {
                        this.lowerZIndexForMenu();
                    });
                    return; // Exit early
                }
                
                // Neither menu nor safetyInfo is expanded - restore to default z-index of 10000
                if (this.container) {
                    this.container.style.setProperty('z-index', '10000', 'important');
                    // Force re-render by briefly removing and re-adding the style
                    this.container.style.removeProperty('z-index');
                    // Use requestAnimationFrame to ensure re-render
                    requestAnimationFrame(() => {
                        this.container.style.setProperty('z-index', '10000', 'important');
                    });
                    this.preSafetyInfoZIndex.container = null; // Clear stored value
                    this.debugLog('Widget container z-index restored to 10000 after safetyInfo closed');
                }
                
                const landingWindowDesktop = document.querySelector('#lumi-landing-window-desktop');
                const landingWindowMobile = document.querySelector('#lumi-landing-window');
                const chatWindow = this.container.querySelector('.lumi-chat-window') || 
                                    document.querySelector('.lumi-chat-window') ||
                                    document.querySelector('#lumi-chat-window');
                const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                
                // Restore desktop landing window z-index
                if (landingWindowDesktop) {
                    if (this.preSafetyInfoZIndex.landingWindowDesktop !== null && this.preSafetyInfoZIndex.landingWindowDesktop !== undefined) {
                        landingWindowDesktop.style.setProperty('z-index', this.preSafetyInfoZIndex.landingWindowDesktop.toString(), 'important');
                        this.preSafetyInfoZIndex.landingWindowDesktop = null;
                    }
                }
                
                // Restore mobile landing window z-index
                if (landingWindowMobile) {
                    if (this.preSafetyInfoZIndex.landingWindowMobile !== null && this.preSafetyInfoZIndex.landingWindowMobile !== undefined) {
                        landingWindowMobile.style.setProperty('z-index', this.preSafetyInfoZIndex.landingWindowMobile.toString(), 'important');
                        this.preSafetyInfoZIndex.landingWindowMobile = null;
                    }
                }
                
                // Restore chat window z-index
                if (chatWindow) {
                    if (this.preSafetyInfoZIndex.chatWindow !== null && this.preSafetyInfoZIndex.chatWindow !== undefined) {
                        chatWindow.style.setProperty('z-index', this.preSafetyInfoZIndex.chatWindow.toString(), 'important');
                        this.preSafetyInfoZIndex.chatWindow = null;
                    }
                }
                
                // Restore polygon z-index
                if (polygon) {
                    if (this.preSafetyInfoZIndex.polygon !== null && this.preSafetyInfoZIndex.polygon !== undefined) {
                        polygon.style.setProperty('z-index', this.preSafetyInfoZIndex.polygon.toString(), 'important');
                        this.preSafetyInfoZIndex.polygon = null;
                    }
                }
            };
            // Track previous safetyInfo state
            this.previousSafetyInfoState = false;
            this.safetyInfoPollingInterval = null;
            // Set up MutationObserver to watch for class changes on safetyInfo
            const observeSafetyInfo = () => {
                const safetyInfo = this.findSafetyInfo();
                if (!safetyInfo) {
                    // SafetyInfo not found yet, try again after a delay (max 10 attempts)
                    const retryCount = observeSafetyInfo.retryCount || 0;
                    if (retryCount < 10) {
                        observeSafetyInfo.retryCount = retryCount + 1;
                        setTimeout(observeSafetyInfo, 500);
                    } else {
                        startPollingForSafetyInfo();
                    }
                    return;
                }
                
                // Don't check initial state - menu/safetyInfo are never expanded on page load
                // Only lower z-index when user actually expands them (state change from collapsed to expanded)
                // Initialize previous state as false (not expanded)
                this.previousSafetyInfoState = false;
                
                // Create observer to watch for class changes
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                            const currentSafetyInfo = this.findSafetyInfo();
                            if (!currentSafetyInfo) return;
                            
                            const isExpanded = this.isSafetyInfoExpanded(currentSafetyInfo);
                            this.debugLog('SafetyInfo class changed, isExpanded:', isExpanded, 'previousState:', this.previousSafetyInfoState, 'target:', mutation.target);
                            
                            if (isExpanded && !this.previousSafetyInfoState) {
                                // SafetyInfo just expanded - lower z-index of windows
                                this.debugLog('SafetyInfo just expanded, lowering z-index of windows');
                                lowerZIndexForSafetyInfo();
                                this.previousSafetyInfoState = true;
                            } else if (!isExpanded && this.previousSafetyInfoState) {
                                // SafetyInfo just closed - restore z-index
                                this.debugLog('SafetyInfo closed, restoring z-index of windows');
                                restoreZIndexAfterSafetyInfo();
                                this.previousSafetyInfoState = false;
                            } else {
                                // State didn't change - update tracking but don't change z-index
                                this.previousSafetyInfoState = isExpanded;
                            }
                        }
                    });
                });
                
                // Start observing the safetyInfo element
                observer.observe(safetyInfo, {
                    attributes: true,
                    attributeFilter: ['class']
                });
                
                // Also observe document body for any safetyInfo elements being added dynamically
                // But only check the actual safetyInfo element found by findSafetyInfo(), not just any element with 'safetyInfo' in class name
                const bodyObserver = new MutationObserver((mutations) => {
                    // Get the actual safetyInfo element to check
                    const currentSafetyInfo = this.findSafetyInfo();
                    if (!currentSafetyInfo) return;
                    
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                            const target = mutation.target;
                            // Only process if the mutation is on the actual safetyInfo element
                            if (target === currentSafetyInfo || currentSafetyInfo.contains(target)) {
                                const isExpanded = this.isSafetyInfoExpanded(currentSafetyInfo);
                                this.debugLog('Body observer: SafetyInfo class changed, isExpanded:', isExpanded, 'previousState:', this.previousSafetyInfoState);
                                
                                if (isExpanded && !this.previousSafetyInfoState) {
                                    // SafetyInfo just expanded - lower z-index of windows
                                    this.debugLog('Body observer: SafetyInfo just expanded, lowering z-index');
                                    lowerZIndexForSafetyInfo();
                                    this.previousSafetyInfoState = true;
                                } else if (!isExpanded && this.previousSafetyInfoState) {
                                    // SafetyInfo just closed - restore z-index
                                    this.debugLog('Body observer: SafetyInfo just closed, restoring z-index');
                                    restoreZIndexAfterSafetyInfo();
                                    this.previousSafetyInfoState = false;
                                } else {
                                    // State didn't change - update tracking but don't change z-index
                                    this.previousSafetyInfoState = isExpanded;
                                }
                            }
                        }
                    });
                });
                
                // Delay starting the body observer to avoid triggers during widget initialization
                setTimeout(() => {
                    bodyObserver.observe(document.body, {
                        attributes: true,
                        attributeFilter: ['class'],
                        subtree: true
                    });
                }, 1000);
                
                // Don't set up polling - it can cause false positives on page load
                // Observers are sufficient to detect state changes when user expands/collapses safetyInfo
            };
            
            // Polling fallback to check safetyInfo state periodically
            const startPollingForSafetyInfo = () => {
                if (this.safetyInfoPollingInterval) {
                    clearInterval(this.safetyInfoPollingInterval);
                }
                
                this.safetyInfoPollingInterval = setInterval(() => {
                    const safetyInfo = this.findSafetyInfo();
                    if (safetyInfo) {
                        const hasExpandedClass = isSafetyInfoExpanded(safetyInfo);
                        
                        // Also check if safetyInfo is actually visible (not just has the class)
                        let isSafetyInfoActuallyVisible = false;
                        const safetyInfoStyle = window.getComputedStyle(safetyInfo);
                        const safetyInfoRect = safetyInfo.getBoundingClientRect();
                        isSafetyInfoActuallyVisible = safetyInfoStyle.display !== 'none' && 
                                                        safetyInfoStyle.visibility !== 'hidden' &&
                                                        parseFloat(safetyInfoStyle.opacity) > 0 &&
                                                        safetyInfoRect.width > 0 && 
                                                        safetyInfoRect.height > 0;
                        
                        // Polling is disabled - this code should never run
                        // But keeping it here in case polling is re-enabled in the future
                        // Only act on state changes to avoid excessive z-index updates
                        if (hasExpandedClass && isSafetyInfoActuallyVisible && !this.previousSafetyInfoState) {
                            // SafetyInfo just expanded - lower z-index of windows
                            lowerZIndexForSafetyInfo();
                            this.previousSafetyInfoState = true;
                        } else if ((!hasExpandedClass || !isSafetyInfoActuallyVisible) && this.previousSafetyInfoState) {
                            // SafetyInfo just closed - restore z-index
                            restoreZIndexAfterSafetyInfo();
                            this.previousSafetyInfoState = false;
                        }
                    } else {
                        // SafetyInfo element not found - if we previously had it expanded, restore z-index
                        if (this.previousSafetyInfoState) {
                            restoreZIndexAfterSafetyInfo();
                            this.previousSafetyInfoState = false;
                        }
                    }
                }, 200); // Check every 200ms
            };
            
            // Start observing after DOM is ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', observeSafetyInfo);
            } else {
                observeSafetyInfo();
            }
        }

        setupCookieBannerObserver() {
            if (this.cookieBannerObserverInitialized) {
                return;
            }
            this.cookieBannerObserverInitialized = true;

            const observeCookieBanner = () => {
        const banner = this.findCookieBanner();
        const overlay = this.findCookieOverlay();
        if (!banner) {
            const retryCount = observeCookieBanner.retryCount || 0;
            if (retryCount < 10) {
                observeCookieBanner.retryCount = retryCount + 1;
                setTimeout(observeCookieBanner, 500);
            } else {
                startCookieBannerPolling();
            }
            return;
        }

        if (this.cookieBannerMutationObserver) this.cookieBannerMutationObserver.disconnect();
        this.cookieBannerMutationObserver = new MutationObserver(() => evaluateCookieBannerState());
        this.cookieBannerMutationObserver.observe(banner, {
            attributes: true,
            attributeFilter: ['class', 'style', 'aria-hidden']
        });

        if (overlay) {
            if (this.cookieBannerOverlayObserver) this.cookieBannerOverlayObserver.disconnect();
            this.cookieBannerOverlayObserver = new MutationObserver(() => evaluateCookieBannerState());
            this.cookieBannerOverlayObserver.observe(overlay, {
                attributes: true,
                attributeFilter: ['class', 'style', 'aria-hidden']
            });
        }
        evaluateCookieBannerState();
    };

            this.cookieBannerState = {
                active: false,
                landingWasVisible: false,
                chatWasVisible: false,
                polygonWasVisible: false
            };
            this.cookieBannerPollingInterval = null;

            const hideWindowsForCookieBanner = () => {
                if (this.cookieBannerState.active) {
                    return;
                }
                if (window.innerWidth > 768) {
                    return;
                }

                const landingWindow = this.container.querySelector('#lumi-landing-window') || document.querySelector('#lumi-landing-window');
                const chatWindow = this.container.querySelector('.lumi-chat-window');
                const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');

                // Check if widget has active chat session (has messages and chat-active class)
                // This ensures we properly track chat window state even if visibility check fails due to timing
                const hasActiveChat = this.messages && this.messages.length > 0 && 
                                        this.container.classList.contains('chat-active');

                this.cookieBannerState.landingWasVisible = this.isElementVisible(landingWindow);
                this.cookieBannerState.chatWasVisible = this.isElementVisible(chatWindow) || hasActiveChat;
                this.cookieBannerState.polygonWasVisible = this.isElementVisible(polygon);
                this.cookieBannerState.active = true;
                
                if (this.cookieBannerUserOverride) {
                    this.debugLog('Cookie banner active but user override enabled - keeping LuMi windows visible');
                    return;
                }

                if (landingWindow) {
                    landingWindow.style.setProperty('display', 'none', 'important');
                    landingWindow.style.setProperty('visibility', 'hidden', 'important');
                    landingWindow.style.setProperty('opacity', '0', 'important');
                    landingWindow.style.setProperty('pointer-events', 'none', 'important');
                }

                if (chatWindow) {
                    // Don't hide chat window if there's an active chat session
                    // This ensures chat window stays visible even when cookie banner is active
                    if (!hasActiveChat) {
                        chatWindow.style.setProperty('display', 'none', 'important');
                        chatWindow.style.setProperty('visibility', 'hidden', 'important');
                        chatWindow.style.setProperty('opacity', '0', 'important');
                        chatWindow.style.setProperty('pointer-events', 'none', 'important');
                    } else {
                        // Keep chat window visible but ensure it has proper z-index and pointer-events
                        const chatZIndex = this.getZIndexAboveNavBar(10001);
                        chatWindow.style.setProperty('display', 'flex', 'important');
                        chatWindow.style.setProperty('visibility', 'visible', 'important');
                        chatWindow.style.setProperty('opacity', '1', 'important');
                        chatWindow.style.setProperty('z-index', `${chatZIndex}`, 'important');
                        chatWindow.style.setProperty('pointer-events', 'auto', 'important');
                    }
                }

                if (polygon) {
                    // Keep polygon visible if there's an active chat session
                    if (!hasActiveChat) {
                        polygon.style.setProperty('display', 'none', 'important');
                        polygon.style.setProperty('visibility', 'hidden', 'important');
                        polygon.style.setProperty('opacity', '0', 'important');
                        polygon.style.setProperty('pointer-events', 'none', 'important');
                    } else {
                        // Keep polygon visible with proper z-index
                        const polygonZIndex = this.getZIndexAboveNavBar(10002);
                        polygon.style.setProperty('display', 'block', 'important');
                        polygon.style.setProperty('visibility', 'visible', 'important');
                        polygon.style.setProperty('opacity', '1', 'important');
                        polygon.style.setProperty('z-index', `${polygonZIndex}`, 'important');
                        polygon.style.setProperty('pointer-events', 'auto', 'important');
                    }
                }

                if (hasActiveChat) {
                    this.debugLog('Cookie banner active on mobile - keeping chat window and polygon visible due to active chat session');
                } else {
                    this.debugLog('Cookie banner active on mobile - hiding LuMi windows');
                }
            };

            const restoreWindowsAfterCookieBanner = () => {
                if (!this.cookieBannerState.active) {
                    return;
                }
                
                this.cookieBannerUserOverride = false;

                const landingWindow = this.container.querySelector('#lumi-landing-window') || document.querySelector('#lumi-landing-window');
                const chatWindow = this.container.querySelector('.lumi-chat-window');
                const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');

                const landingWasVisible = this.cookieBannerState.landingWasVisible;
                const chatWasVisible = this.cookieBannerState.chatWasVisible;
                const polygonWasVisible = this.cookieBannerState.polygonWasVisible;

                this.cookieBannerState.active = false;
                this.cookieBannerState.landingWasVisible = false;
                this.cookieBannerState.chatWasVisible = false;
                this.cookieBannerState.polygonWasVisible = false;

                if (landingWindow) {
                    landingWindow.style.setProperty('pointer-events', 'auto', 'important');
                    if (landingWasVisible) {
                        landingWindow.style.setProperty('display', 'flex', 'important');
                        landingWindow.style.setProperty('visibility', 'visible', 'important');
                        landingWindow.style.setProperty('opacity', '1', 'important');
                    } else {
                        landingWindow.style.setProperty('display', 'none', 'important');
                        landingWindow.style.setProperty('visibility', 'hidden', 'important');
                        landingWindow.style.setProperty('opacity', '0', 'important');
                    }
                }

                if (chatWindow) {
                    chatWindow.style.setProperty('pointer-events', 'auto', 'important');
                    // Check if widget has active chat session (has messages and chat-active class)
                    // This ensures chat window is restored even if visibility check failed due to timing
                    const hasActiveChat = this.messages && this.messages.length > 0 && 
                                            this.container.classList.contains('chat-active');
                    if (chatWasVisible || hasActiveChat) {
                        // Restore chat window - get z-index that's above nav bar
                        const chatZIndex = this.getZIndexAboveNavBar(10001);
                        chatWindow.style.setProperty('display', 'flex', 'important');
                        chatWindow.style.setProperty('visibility', 'visible', 'important');
                        chatWindow.style.setProperty('opacity', '1', 'important');
                        chatWindow.style.setProperty('z-index', `${chatZIndex}`, 'important');
                    } else {
                        chatWindow.style.setProperty('display', 'none', 'important');
                        chatWindow.style.setProperty('visibility', 'hidden', 'important');
                        chatWindow.style.setProperty('opacity', '0', 'important');
                    }
                }

                if (polygon) {
                    polygon.style.setProperty('pointer-events', 'auto', 'important');
                    if (polygonWasVisible) {
                        polygon.style.setProperty('display', 'block', 'important');
                        polygon.style.setProperty('visibility', 'visible', 'important');
                        polygon.style.setProperty('opacity', '1', 'important');
                    } else {
                        polygon.style.setProperty('display', 'none', 'important');
                        polygon.style.setProperty('visibility', 'hidden', 'important');
                        polygon.style.setProperty('opacity', '0', 'important');
                    }
                }

                this.debugLog('Cookie banner dismissed - restoring LuMi windows');

                this.updatePopupPosition();
                if (window.innerWidth <= 768) {
                    const chatWindowElement = this.container.querySelector('.lumi-chat-window');
                    if (chatWindowElement && typeof this.handleMobileChatWindowOverlap === 'function') {
                        setTimeout(() => this.handleMobileChatWindowOverlap(chatWindowElement), 100);
                    }
                }
            };

            this.hideWindowsForCookieBanner = hideWindowsForCookieBanner;
            this.restoreWindowsAfterCookieBanner = restoreWindowsAfterCookieBanner;

            // Method to restore windows when user override is set (called when user clicks button)
            this.restoreWindowsForUserOverride = () => {
                if (window.innerWidth > 768) {
                    return; // Only needed on mobile
                }

                const landingWindow = this.container.querySelector('#lumi-landing-window') || document.querySelector('#lumi-landing-window');
                const chatWindow = this.container.querySelector('.lumi-chat-window');
                const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                const avatarContainer = this.container.querySelector('#lumi-avatar-container');
                const avatarWrapper = this.container.querySelector('.lumi-avatar-wrapper');
                const avatarIframe = this.container.querySelector('#lumi-avatar-iframe');
                const chatContent = this.container.querySelector('.lumi-chat-content');

                // Restore pointer-events so windows can be clicked
                if (landingWindow) {
                    landingWindow.style.setProperty('pointer-events', 'auto', 'important');
                }
                if (chatWindow) {
                    chatWindow.style.setProperty('pointer-events', 'auto', 'important');
                }
                if (polygon) {
                    polygon.style.setProperty('pointer-events', 'auto', 'important');
                }
                // CRITICAL: Also restore pointer-events for avatar elements so iframe buttons work
                if (avatarContainer) {
                    avatarContainer.style.setProperty('pointer-events', 'auto', 'important');
                    // Ensure container has high z-index to be above cookie banner overlay
                    avatarContainer.style.setProperty('z-index', '999999', 'important');
                }
                if (avatarWrapper) {
                    avatarWrapper.style.setProperty('pointer-events', 'auto', 'important');
                    avatarWrapper.style.setProperty('z-index', '999999', 'important');
                }
                if (avatarIframe) {
                    avatarIframe.style.setProperty('pointer-events', 'auto', 'important');
                    // Ensure iframe has very high z-index to be above cookie banner overlay
                    avatarIframe.style.setProperty('z-index', '999999', 'important');
                }
                if (chatContent) {
                    chatContent.style.setProperty('pointer-events', 'auto', 'important');
                }
                // Ensure chat window also has high z-index
                if (chatWindow) {
                    chatWindow.style.setProperty('z-index', '999999', 'important');
                }

                this.debugLog('Restored pointer-events for LuMi windows and avatar iframe due to user override');
                
                // Debug: Check cookie banner overlay z-index and pointer-events
                const cookieOverlay = this.findCookieOverlay();
                if (cookieOverlay) {
                    const overlayStyle = window.getComputedStyle(cookieOverlay);
                    this.debugLog('Cookie banner overlay styles:', {
                        zIndex: overlayStyle.zIndex,
                        pointerEvents: overlayStyle.pointerEvents,
                        position: overlayStyle.position,
                        display: overlayStyle.display
                    });
                }
            };

            const evaluateCookieBannerState = () => {
                const banner = this.findCookieBanner();
                const overlay = this.findCookieOverlay();
                const isMobile = window.innerWidth <= 768;
                const isActive = this.isCookieBannerActive(banner, overlay);

                if (!isMobile) {
                    // On desktop, don't hide windows but update positions when cookie banner state changes
                    const wasActive = this.cookieBannerState.active;
                    if (wasActive !== isActive) {
                        this.debugLog('Desktop: Cookie banner state changed:', { wasActive, isActive });
                        // Update positions when cookie banner appears or disappears
                        // Use setTimeout to ensure DOM has updated after cookie banner state change
                        setTimeout(() => {
                            this.updatePopupPosition();
                            this.debugLog('Desktop: Updated popup positions after cookie banner state change');
                        }, 100);
                    }
                    // Update state tracking
                    this.cookieBannerState.active = isActive;
                    return;
                }

                // On mobile, check user override before hiding windows
                if (isActive) {
                    if (!this.cookieBannerState.active) {
                        // Only hide if user hasn't overridden
                        if (!this.cookieBannerUserOverride) {
                            hideWindowsForCookieBanner();
                        }
                    } else {
                        // Banner is active and state is already active
                        // If user override is set, ensure pointer-events are restored
                        if (this.cookieBannerUserOverride) {
                            if (typeof this.restoreWindowsForUserOverride === 'function') {
                                this.restoreWindowsForUserOverride();
                            }
                        }
                    }
                } else if (this.cookieBannerState.active) {
                    restoreWindowsAfterCookieBanner();
                }
            };

            const startCookieBannerPolling = () => {
                if (this.cookieBannerPollingInterval) {
                    clearInterval(this.cookieBannerPollingInterval);
                }
                this.cookieBannerPollingInterval = setInterval(() => {
                    evaluateCookieBannerState();
                }, 300);
            };

            // Start polling immediately
            startCookieBannerPolling();
            
            // Also set up mutation observer for cookie banner
            observeCookieBanner();
        }

        /**
         * Set up tab visibility change handler to keep avatar session running in background
         * This ensures the avatar session continues even when the tab becomes inactive
         */
        setupTabVisibilityHandler() {
            // Listen for visibility changes (tab becomes hidden/visible)
            document.addEventListener('visibilitychange', () => {
                const isHidden = document.hidden;
                
                if (isHidden) {
                    // Tab became hidden - keep session running, don't stop it
                    this.debugLog('Tab became hidden - keeping avatar session running in background');
                    
                    // Ensure avatar session ID is persisted
                    if (this.avatarSessionId) {
                        this.saveAvatarSessionIdToStorage(this.avatarSessionId);
                    }
                } else {
                    // Tab became visible - session should continue running
                    this.debugLog('Tab became visible - avatar session should still be active');
                    
                    // Restore avatar session ID if it exists in storage but not in memory
                    if (!this.avatarSessionId) {
                        const storedAvatarSessionId = this.getAvatarSessionIdFromStorage();
                        if (storedAvatarSessionId) {
                            this.avatarSessionId = storedAvatarSessionId;
                            this.debugLog('Restored avatar session ID after tab became visible:', this.avatarSessionId);
                        }
                    }
                }
            });

            // Listen for pagehide event (when user navigates away)
            // Note: We can't prevent navigation, but we can ensure session state is saved
            window.addEventListener('pagehide', (event) => {
                // Save avatar session ID before page unloads
                if (this.avatarSessionId) {
                    this.saveAvatarSessionIdToStorage(this.avatarSessionId);
                    this.debugLog('Page hiding - saved avatar session ID to sessionStorage:', this.avatarSessionId);
                }
            });

            // Listen for pageshow event (when user returns to the page)
            window.addEventListener('pageshow', (event) => {
                // Restore avatar session ID if page was restored from cache
                if (event.persisted) {
                    const storedAvatarSessionId = this.getAvatarSessionIdFromStorage();
                    if (storedAvatarSessionId && !this.avatarSessionId) {
                        this.avatarSessionId = storedAvatarSessionId;
                        this.debugLog('Page restored from cache - restored avatar session ID:', this.avatarSessionId);
                    }
                }
            });

            this.debugLog('Tab visibility handler set up - avatar session will continue running in background');

            // const observeCookieBanner = () => {
            //     const banner = this.findCookieBanner();
            //     const overlay = this.findCookieOverlay();

            //     if (!banner) {
            //         const retryCount = observeCookieBanner.retryCount || 0;
            //         if (retryCount < 10) {
            //             observeCookieBanner.retryCount = retryCount + 1;
            //             setTimeout(observeCookieBanner, 500);
            //         } else {
            //             this.debugLog('Cookie banner not found after 10 attempts, using polling fallback');
            //             startCookieBannerPolling();
            //         }
            //         return;
            //     }

            //     if (this.cookieBannerMutationObserver) {
            //         this.cookieBannerMutationObserver.disconnect();
            //     }
            //     this.cookieBannerMutationObserver = new MutationObserver(() => {
            //         evaluateCookieBannerState();
            //     });
            //     this.cookieBannerMutationObserver.observe(banner, {
            //         attributes: true,
            //         attributeFilter: ['class', 'style', 'aria-hidden']
            //     });

            //     if (overlay) {
            //         if (this.cookieBannerOverlayObserver) {
            //             this.cookieBannerOverlayObserver.disconnect();
            //         }
            //         this.cookieBannerOverlayObserver = new MutationObserver(() => {
            //             evaluateCookieBannerState();
            //         });
            //         this.cookieBannerOverlayObserver.observe(overlay, {
            //             attributes: true,
            //             attributeFilter: ['class', 'style', 'aria-hidden']
            //         });
            //     }

            //     evaluateCookieBannerState();
            // };

            if (!this.cookieBannerResizeHandler) {
                this.cookieBannerResizeHandler = () => evaluateCookieBannerState();
                window.addEventListener('resize', this.cookieBannerResizeHandler, { passive: true });
            }

            // observeCookieBanner();
        }

        createWidget() {
            this.debugLog('Creating widget');
            // Create main container
            this.container = document.createElement('div');
            this.container.className = 'lumi-assistant-widget';
            // Set default z-index to 10000 on page load
            this.container.style.setProperty('z-index', '10000', 'important');
            this.container.innerHTML = this.getWidgetHTML();
            
            // CRITICAL: Immediately check sessionStorage and hide landing window/polygon if already shown
            // This must happen BEFORE CSS rules can show them
            const isMobile = window.innerWidth <= 768;
            const hasShown = this.hasShownLandingWindowThisSession();
            
            if (hasShown) {
                if (isMobile) {
                    const landingWindow = this.container.querySelector('#lumi-landing-window');
                    const polygon = this.container.querySelector('.lumi-chat-polygon');
                    
                    if (landingWindow) {
                        landingWindow.classList.add('lumi-landing-dismissed');
                        landingWindow.style.setProperty('display', 'none', 'important');
                        landingWindow.style.setProperty('visibility', 'hidden', 'important');
                        landingWindow.style.setProperty('opacity', '0', 'important');
                    }
                    if (polygon) {
                        polygon.style.setProperty('display', 'none', 'important');
                        polygon.style.setProperty('visibility', 'hidden', 'important');
                        polygon.style.setProperty('opacity', '0', 'important');
                    }
                } else {
                    // Desktop: hide desktop landing window and polygon
                    const landingWindow = this.container.querySelector('#lumi-landing-window-desktop');
                    const polygon = this.container.querySelector('.lumi-chat-polygon');
                    
                    if (landingWindow) {
                        landingWindow.classList.add('lumi-landing-dismissed');
                        landingWindow.style.setProperty('display', 'none', 'important');
                        landingWindow.style.setProperty('visibility', 'hidden', 'important');
                        landingWindow.style.setProperty('opacity', '0', 'important');
                    }
                    if (polygon) {
                        polygon.style.setProperty('display', 'none', 'important');
                        polygon.style.setProperty('visibility', 'hidden', 'important');
                        polygon.style.setProperty('opacity', '0', 'important');
                    }
                }
            }
            
            // Create backdrop
            this.backdrop = document.createElement('div');
            this.backdrop.className = 'lumi-chat-backdrop';
            
            // Always append to body to avoid external CSS interference
            document.body.appendChild(this.backdrop);
            document.body.appendChild(this.container);
            this.debugLog('Widget HTML created and appended to body');
            
            // Initially hide the chat window
            const chatWindow = this.container.querySelector('.lumi-chat-window');
            if (chatWindow) {
                chatWindow.style.display = 'none';
            }
        }

        /**
         * Metrics for positioning the landing/chat popup triangle: horizontally center on `.lumi-avatar`, vertically
         * anchor to the avatar circle bottom. Using `#lumi-assistant-btn` bottom is wrong when the button box is
         * taller than the circle (e.g. label beside the avatar on prod), which misaligns the triangle vs sandbox.
         */
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
                    bottom: buttonRect.top + side
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

        /**
         * Viewport `top` for fixed `.lumi-chat-polygon` (SVG vertex at y=0). Placed slightly above
         * `avatarBottom`: outlines, drop-shadows, and host CSS often extend past the border box that
         * getBoundingClientRect() uses, which otherwise reads as a gap between the circle and the tip.
         */
        getChatPolygonFixedTopY(avatarBottom) {
            const TUCK_UNDER_AVATAR_DECORATION_PX = 8;
            return Math.round(avatarBottom - TUCK_UNDER_AVATAR_DECORATION_PX);
        }

        /** `right` for `position:fixed` with `left:auto` to center a fixed-width panel (viewport width strictly below 768px). */
        getMobileCenteredFixedRightOffset(viewportWidth, elementWidth) {
            return Math.max(0, Math.round((viewportWidth - elementWidth) / 2));
        }

        showLandingWindowAndPolygon(attempt = 0) {
            this.debugLog('showLandingWindowAndPolygon() called, attempt:', attempt);
            
            // CRITICAL: Never show landing window if chat window is currently open and visible
            // Only check if chat window is actually displayed (display !== 'none')
            const chatWindow = this.container.querySelector('.lumi-chat-window') || document.querySelector('.lumi-chat-window');
            if (chatWindow) {
                const chatStyle = window.getComputedStyle(chatWindow);
                // Simple check: if display is not 'none', chat window is visible
                if (chatStyle.display !== 'none') {
                    this.debugLog('showLandingWindowAndPolygon: Chat window is visible (display:', chatStyle.display, ') - NOT showing landing window');
                    return;
                }
            }
            
            // Wait for avatar button to render
            const button = document.querySelector('#lumi-assistant-btn');
            if (!button) {
                if (attempt < 50) {
                    requestAnimationFrame(() => {
                        setTimeout(() => this.showLandingWindowAndPolygon(attempt + 1), 20);
                    });
                    return;
                } else {
                    console.error('Avatar button not found after 50 attempts');
                    return;
                }
            }
            
            // Force layout recalculation
            void button.offsetHeight;
            void button.offsetWidth;
            
            const buttonRect = button.getBoundingClientRect();
            
            // Wait for button to have dimensions
            // If button never renders, DO NOT show polygon or landing window - just return
            if (buttonRect.width === 0 || buttonRect.height === 0) {
                if (attempt < 50) {
                    if (attempt % 5 === 0) {
                        this.debugLog(`showLandingWindowAndPolygon: Waiting for button to render, attempt ${attempt + 1}`);
                    }
                    requestAnimationFrame(() => {
                        setTimeout(() => this.showLandingWindowAndPolygon(attempt + 1), 20);
                    });
                    return;
                } else {
                    console.error('Avatar button not rendered after 50 attempts - NOT showing polygon or landing window');
                    // Ensure landing window and polygon are hidden if button doesn't render
                    const landingWindow = this.container.querySelector('#lumi-landing-window') || document.querySelector('#lumi-landing-window');
                    const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                    if (landingWindow) {
                        landingWindow.style.setProperty('display', 'none', 'important');
                        landingWindow.style.setProperty('visibility', 'hidden', 'important');
                        landingWindow.style.setProperty('opacity', '0', 'important');
                    }
                    if (polygon) {
                        polygon.style.setProperty('display', 'none', 'important');
                        polygon.style.setProperty('visibility', 'hidden', 'important');
                        polygon.style.setProperty('opacity', '0', 'important');
                    }
                    return; // Exit early - don't show anything
                }
            }
            
            // Button is ready - calculate positions; triangle tip sits on avatar bottom (not full button box)
            const buttonRight = window.innerWidth - buttonRect.right;
            const { avatarBottom, avatarCenterX } = this.getAssistantButtonLayoutMetrics(button, buttonRect);
            const LANDING_POLYGON_SVG_HEIGHT = 12;
            const MOBILE_LANDING_GAP_BELOW_POLYGON = 5;

            const polygonWidth = 14;
            const polygonLeft = Math.max(0, Math.round(avatarCenterX - polygonWidth / 2));
            const polygonTop = this.getChatPolygonFixedTopY(avatarBottom);
            
            let windowRightOffset = Math.max(0, buttonRight);
            if (buttonRect.right > window.innerWidth) {
                const buttonVisibleRight = Math.min(buttonRect.right, window.innerWidth);
                windowRightOffset = Math.max(10, window.innerWidth - buttonVisibleRight);
            }
            windowRightOffset = Math.round(windowRightOffset);
            const viewportWidth = window.innerWidth;
            const MOBILE_LANDING_WINDOW_WIDTH = 335;
            // Center in full viewport only below 768px. At exactly 768 (iPad Mini portrait) keep button-based
            // `right`; viewport-centering clashes with centered-column tablet layouts.
            if (viewportWidth < 768) {
                windowRightOffset = this.getMobileCenteredFixedRightOffset(viewportWidth, MOBILE_LANDING_WINDOW_WIDTH);
            }
            const windowTop = Math.round(polygonTop + LANDING_POLYGON_SVG_HEIGHT + MOBILE_LANDING_GAP_BELOW_POLYGON);
            
            // Get elements
            const landingWindow = this.container.querySelector('#lumi-landing-window') || document.querySelector('#lumi-landing-window');
            const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
            
            if (!landingWindow || !polygon) {
                console.error('Landing window or polygon not found');
                return;
            }
            
            // Move to body if needed (for mobile fixed positioning)
            // IMPORTANT: Check for duplicates first to prevent multiple landing windows
            const allLandingWindowsOnBody = document.querySelectorAll('#lumi-landing-window');
            if (allLandingWindowsOnBody.length > 1) {
                console.warn('Multiple landing windows found on body! Removing duplicates:', allLandingWindowsOnBody.length);
                // Keep only the first one, remove the rest
                for (let i = 1; i < allLandingWindowsOnBody.length; i++) {
                    allLandingWindowsOnBody[i].remove();
                }
            }
            
            if (landingWindow && landingWindow.parentElement !== document.body) {
                document.body.appendChild(landingWindow);
            }
            if (polygon && polygon.parentElement !== document.body) {
                document.body.appendChild(polygon);
            }
            
            // Set widget state
            this.isOpen = true;
            this.container.classList.add('open');
            this.backdrop.style.display = 'block';
            this.container.classList.remove('chat-active');
            
            // Remove dismissed class
            landingWindow.classList.remove('lumi-landing-dismissed');
            
            // CRITICAL: Ensure container has z-index 10000 when showing landing window
            // This prevents the landing window from being trapped in a low stacking context
            if (this.container) {
                const containerStyle = window.getComputedStyle(this.container);
                const currentContainerZIndex = parseInt(containerStyle.zIndex, 10);
                if (isNaN(currentContainerZIndex) || currentContainerZIndex < 10000) {
                    // Container z-index was somehow lowered - restore it to 10000
                    // On page load, menu/safetyInfo are never expanded, so container should always be at 10000
                    // Observers will handle lowering only when user actually expands menu/safetyInfo
                    this.container.style.setProperty('z-index', '10000', 'important');
                    this.debugLog('Ensured container z-index is 10000 for landing window display');
                }
            }
            
            // Position and show landing window
            // Get z-index that's above nav bar - observers will lower it if menu/safetyInfo is expanded
            const landingZIndex = this.getZIndexAboveNavBar(10003);
            landingWindow.style.setProperty('position', 'fixed', 'important');
            landingWindow.style.setProperty('top', `${windowTop}px`, 'important');
            landingWindow.style.setProperty('right', `${windowRightOffset}px`, 'important');
            landingWindow.style.setProperty('left', 'auto', 'important');
            landingWindow.style.setProperty('z-index', `${landingZIndex}`, 'important');
            landingWindow.style.setProperty('display', 'flex', 'important');
            landingWindow.style.setProperty('visibility', 'visible', 'important');
            landingWindow.style.setProperty('opacity', '1', 'important');
            landingWindow.style.setProperty('pointer-events', 'auto', 'important');
            
            // Position and show polygon (above landing window)
            // Use only left positioning to center polygon at avatarCenterX
            const polygonZIndex = this.getZIndexAboveNavBar(10004);
            polygon.style.setProperty('position', 'fixed', 'important');
            polygon.style.setProperty('top', `${polygonTop}px`, 'important');
            polygon.style.setProperty('left', `${polygonLeft}px`, 'important');
            polygon.style.setProperty('right', 'auto', 'important'); // Remove right positioning
            polygon.style.setProperty('z-index', `${polygonZIndex}`, 'important');
            polygon.style.setProperty('display', 'block', 'important');
            polygon.style.setProperty('visibility', 'visible', 'important');
            polygon.style.setProperty('opacity', '1', 'important');
            polygon.style.setProperty('pointer-events', 'none', 'important');
            
            // Ensure child elements have proper z-index and pointer-events
            const landingContent = landingWindow.querySelector('.lumi-landing-content');
            if (landingContent) {
                landingContent.style.setProperty('z-index', '2147483647', 'important');
                landingContent.style.setProperty('position', 'relative', 'important');
            }
            
            const landingButtons = landingWindow.querySelectorAll('.lumi-landing-btn');
            landingButtons.forEach(btn => {
                btn.style.setProperty('z-index', '2147483647', 'important');
                btn.style.setProperty('position', 'relative', 'important');
                btn.style.setProperty('pointer-events', 'auto', 'important');
            });
            
            const closeBtn = landingWindow.querySelector('#lumi-landing-close-btn');
            if (closeBtn) {
                closeBtn.style.setProperty('z-index', '2147483647', 'important');
                closeBtn.style.setProperty('pointer-events', 'auto', 'important');
            }
            
            // Bind landing window events
            this.bindLandingWindowEvents();
            
            // Ensure container z-index is 10000 after landing window is shown (mobile)
            // Set it again here to override any observer changes that might have happened
            if (this.container) {
                this.container.style.setProperty('z-index', '10000', 'important');
                this.debugLog('Final container z-index set to 10000 after landing window shown (mobile)');
            }
            
            // MOBILE-ONLY: Check if mobile menu is currently expanded
            // If so, lower the landing window z-index to stay below the menu
            const isMobile = window.innerWidth <= 768;
            if (isMobile && this.lowerZIndexForMobileMenu) {
                const mobileMenu = this.findMobileMenu ? this.findMobileMenu() : document.querySelector('#menu-items');
                if (mobileMenu && this.isMobileMenuExpanded && this.isMobileMenuExpanded(mobileMenu)) {
                    this.debugLog('Mobile menu is expanded - lowering landing window z-index to stay below menu');
                    // Use requestAnimationFrame to ensure landing window is fully rendered first
                    requestAnimationFrame(() => {
                        this.lowerZIndexForMobileMenu();
                    });
                }
            }
            
            // Mark initialization as complete now that landing window is shown
            // But add a delay to ensure container z-index stays at 10000 even if observers try to change it
            setTimeout(() => {
                // Final enforcement: ensure container z-index is 10000
                // This overrides any observer changes that might have happened during initialization
                if (this.container) {
                    const currentZIndex = parseInt(window.getComputedStyle(this.container).zIndex, 10);
                    if (isNaN(currentZIndex) || currentZIndex < 10000) {
                        this.container.style.setProperty('z-index', '10000', 'important');
                        this.debugLog('Enforced container z-index to 10000 (final check, was:', currentZIndex, ')');
                    }
                }
                // Now allow observers to modify z-index when user actually expands menu/safetyInfo
                this.isInitializing = false;
                this.debugLog('Widget initialization complete - landing window shown, observers can now modify z-index');
            }, 100);
            
            this.debugLog('Landing window and polygon shown together:', {
                polygonTop,
                polygonLeft,
                windowTop,
                windowRightOffset
            });
        }
        showLandingWindowAndPolygonDesktop(attempt = 0) {
            this.debugLog('showLandingWindowAndPolygonDesktop() called, attempt:', attempt);
            
            // CRITICAL: Never show landing window if chat window is currently open and visible
            // Only check if chat window is actually displayed (not just exists in DOM)
            const chatWindow = this.container.querySelector('.lumi-chat-window') || document.querySelector('.lumi-chat-window');
            if (chatWindow) {
                const chatStyle = window.getComputedStyle(chatWindow);
                // Simple check: if display is not 'none', chat window is visible
                // Also check if container has 'chat-active' class which indicates active chat
                const isChatVisible = chatStyle.display !== 'none' && 
                                        chatStyle.display !== '' &&
                                        (this.container.classList.contains('chat-active') || 
                                        parseFloat(chatStyle.opacity) > 0);
                if (isChatVisible) {
                    this.debugLog('showLandingWindowAndPolygonDesktop: Chat window is visible (display:', chatStyle.display, ', chat-active:', this.container.classList.contains('chat-active'), ') - NOT showing landing window');
                    return;
                }
            }
            
            // Wait for avatar button to render
            const button = document.querySelector('#lumi-assistant-btn');
            if (!button) {
                if (attempt < 50) {
                    requestAnimationFrame(() => {
                        setTimeout(() => this.showLandingWindowAndPolygonDesktop(attempt + 1), 20);
                    });
                    return;
                } else {
                    console.error('Avatar button not found after 50 attempts');
                    return;
                }
            }
            
            // Force layout recalculation
            void button.offsetHeight;
            void button.offsetWidth;
            
            const buttonRect = button.getBoundingClientRect();
            
            // Wait for button to have dimensions
            if (buttonRect.width === 0 || buttonRect.height === 0) {
                if (attempt < 50) {
                    if (attempt % 5 === 0) {
                        this.debugLog(`showLandingWindowAndPolygonDesktop: Waiting for button to render, attempt ${attempt + 1}`);
                    }
                    requestAnimationFrame(() => {
                        setTimeout(() => this.showLandingWindowAndPolygonDesktop(attempt + 1), 20);
                    });
                    return;
                } else {
                    console.error('Avatar button not rendered after 50 attempts - NOT showing polygon or landing window');
                    // Ensure landing window and polygon are hidden if button doesn't render
                    const landingWindow = document.querySelector('#lumi-landing-window-desktop');
                    const polygon = document.querySelector('.lumi-chat-polygon');
                    if (landingWindow) {
                        landingWindow.style.setProperty('display', 'none', 'important');
                        landingWindow.style.setProperty('visibility', 'hidden', 'important');
                        landingWindow.style.setProperty('opacity', '0', 'important');
                    }
                    if (polygon) {
                        polygon.style.setProperty('display', 'none', 'important');
                        polygon.style.setProperty('visibility', 'hidden', 'important');
                        polygon.style.setProperty('opacity', '0', 'important');
                    }
                    return; // Exit early - don't show anything
                }
            }
            
            // Validate button position is reasonable (Edge may calculate positions before layout is complete)
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            // Check if button position seems valid - allow for buttons that might be slightly off-screen
            const isButtonPositionValid = buttonRect.right > 0 && 
                                        buttonRect.bottom > 0 && 
                                        buttonRect.left < viewportWidth + 200 && // Allow margin for off-screen buttons
                                        buttonRect.top < viewportHeight + 200;
            
            if (!isButtonPositionValid && attempt < 10) {
                // Button position seems invalid - retry after a longer delay (Edge may need more time)
                if (attempt % 3 === 0) {
                    this.debugLog(`showLandingWindowAndPolygonDesktop: Button position invalid, retrying (attempt ${attempt + 1}):`, {
                        buttonRect: { left: buttonRect.left, top: buttonRect.top, right: buttonRect.right, bottom: buttonRect.bottom },
                        viewport: { width: viewportWidth, height: viewportHeight }
                    });
                }
                requestAnimationFrame(() => {
                    setTimeout(() => this.showLandingWindowAndPolygonDesktop(attempt + 1), 50); // Longer delay for Edge
                });
                return;
            }
            
            // Button is ready - calculate positions directly from button's viewport position
            // DO NOT use widget container - use button position directly
            
            const { avatarBottom, avatarCenterX } = this.getAssistantButtonLayoutMetrics(button, buttonRect);
            const actualButtonHeight = buttonRect.height;
            const LANDING_POLYGON_SVG_HEIGHT = 12;
            const DESKTOP_LANDING_GAP_BELOW_POLYGON = 3;

            const polygonWidth = 14;
            const polygonLeft = Math.max(0, Math.round(avatarCenterX - polygonWidth / 2));
            const polygonTop = this.getChatPolygonFixedTopY(avatarBottom);

            const buttonRight = Math.max(0, Math.round(viewportWidth - buttonRect.right));
            const windowRightOffset = buttonRight;
            const landingWindowWidth = 335; // Desktop landing window width
            const windowLeft = Math.max(0, Math.round(buttonRect.right - landingWindowWidth));
            const windowTop = Math.round(polygonTop + LANDING_POLYGON_SVG_HEIGHT + DESKTOP_LANDING_GAP_BELOW_POLYGON);
            
            // Validate calculated positions are reasonable before applying
            // Positions should be positive and within viewport bounds
            if (polygonTop < -100 || polygonLeft < -100 || windowTop < -100 || windowRightOffset < -100 || 
                polygonTop > window.innerHeight + 1000 || polygonLeft > viewportWidth + 1000 || 
                windowTop > window.innerHeight + 1000 || windowRightOffset > viewportWidth + 1000) {
                console.error('Invalid calculated positions in showLandingWindowAndPolygonDesktop, skipping update:', {
                    polygonTop,
                    polygonLeft,
                    windowTop,
                    windowRightOffset,
                    buttonRect: { top: buttonRect.top, left: buttonRect.left, width: buttonRect.width, height: buttonRect.height, bottom: buttonRect.bottom, right: buttonRect.right },
                    avatarCenterX,
                    viewportWidth,
                    viewportHeight: window.innerHeight
                });
                // Retry if positions are invalid (might be a timing issue)
                if (attempt < 50) {
                    requestAnimationFrame(() => {
                        setTimeout(() => this.showLandingWindowAndPolygonDesktop(attempt + 1), 20);
                    });
                    return;
                }
                // If still invalid after retries, don't show
                console.error('Positions still invalid after 50 attempts - not showing landing window or polygon');
                return;
            }
            
            // Get elements
            const landingWindow = this.container.querySelector('#lumi-landing-window-desktop') || document.querySelector('#lumi-landing-window-desktop');
            const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
            
            if (!landingWindow || !polygon) {
                console.error('Desktop landing window or polygon not found');
                return;
            }
            
            // Set widget state
            this.isOpen = true;
            this.container.classList.add('open');
            this.backdrop.style.display = 'block';
            this.container.classList.remove('chat-active');
            
            // Remove dismissed class
            landingWindow.classList.remove('lumi-landing-dismissed');
            
            // CRITICAL: Ensure container has z-index 10000 when showing landing window
            // This prevents the landing window from being trapped in a low stacking context
            if (this.container) {
                const containerStyle = window.getComputedStyle(this.container);
                const currentContainerZIndex = parseInt(containerStyle.zIndex, 10);
                if (isNaN(currentContainerZIndex) || currentContainerZIndex < 10000) {
                    // Container z-index was somehow lowered - restore it to 10000
                    // On page load, menu/safetyInfo are never expanded, so container should always be at 10000
                    // Observers will handle lowering only when user actually expands menu/safetyInfo
                    this.container.style.setProperty('z-index', '10000', 'important');
                    this.debugLog('Ensured container z-index is 10000 for landing window display (desktop)');
                }
            }
            
            // Update CSS variables with calculated positions (no calc() wrapper needed, values are already in pixels)
            const root = document.documentElement;
            root.style.setProperty('--widget-button-height', `${actualButtonHeight}px`);
            root.style.setProperty('--widget-polygon-top', `${polygonTop}px`);
            root.style.setProperty('--widget-polygon-left', `${polygonLeft}px`);
            root.style.setProperty('--widget-window-top', `${windowTop}px`);
            root.style.setProperty('--widget-window-right', `${windowRightOffset}px`);
            root.style.setProperty('--widget-window-left', `${windowLeft}px`);
            
            // Position and show landing window using fixed positioning with viewport coordinates
            // Get z-index that's above nav bar - observers will lower it if menu/safetyInfo is expanded
            const landingZIndex = this.getZIndexAboveNavBar(10003);
            landingWindow.style.setProperty('position', 'fixed', 'important');
            landingWindow.style.setProperty('top', `${windowTop}px`, 'important');
            landingWindow.style.setProperty('right', `${windowRightOffset}px`, 'important');
            landingWindow.style.setProperty('left', `${windowLeft}px`, 'important');
            landingWindow.style.setProperty('display', 'flex', 'important');
            landingWindow.style.setProperty('visibility', 'visible', 'important');
            landingWindow.style.setProperty('opacity', '1', 'important');
            landingWindow.style.setProperty('z-index', `${landingZIndex}`, 'important');
            landingWindow.style.setProperty('pointer-events', 'auto', 'important');
            
            // Position and show polygon using fixed positioning with viewport coordinates (above landing window)
            // Use only left positioning to center polygon at avatarCenterX
            const polygonZIndex = this.getZIndexAboveNavBar(10004);
            polygon.style.setProperty('display', 'block', 'important');
            polygon.style.setProperty('visibility', 'visible', 'important');
            polygon.style.setProperty('opacity', '1', 'important');
            polygon.style.setProperty('position', 'fixed', 'important');
            polygon.style.setProperty('top', `${polygonTop}px`, 'important');
            polygon.style.setProperty('left', `${polygonLeft}px`, 'important');
            polygon.style.setProperty('right', 'auto', 'important'); // Remove right positioning to avoid conflicts
            polygon.style.setProperty('z-index', `${polygonZIndex}`, 'important'); // Above landing window
            
            // Force a reflow to ensure styles are applied
            void polygon.offsetHeight;
            void landingWindow.offsetHeight;
            
            // Verify landing window and polygon styles after setting
            const landingWindowStyles = window.getComputedStyle(landingWindow);
            const polygonStyles = window.getComputedStyle(polygon);
            this.debugLog('Desktop landing window styles after setting:', {
                display: landingWindowStyles.display,
                visibility: landingWindowStyles.visibility,
                opacity: landingWindowStyles.opacity,
                position: landingWindowStyles.position,
                top: landingWindowStyles.top,
                right: landingWindowStyles.right,
                zIndex: landingWindowStyles.zIndex,
                boundingRect: landingWindow.getBoundingClientRect()
            });
            this.debugLog('Desktop polygon styles after setting:', {
                display: polygonStyles.display,
                visibility: polygonStyles.visibility,
                opacity: polygonStyles.opacity,
                position: polygonStyles.position,
                zIndex: polygonStyles.zIndex,
                top: polygonStyles.top,
                right: polygonStyles.right,
                boundingRect: polygon.getBoundingClientRect()
            });
            
            // Bind landing window events
            this.bindLandingWindowEvents();
            
            // Ensure container z-index is 10000 after landing window is shown (desktop)
            // Set it again here to override any observer changes that might have happened
            if (this.container) {
                this.container.style.setProperty('z-index', '10000', 'important');
                this.debugLog('Final container z-index set to 10000 after landing window shown (desktop)');
            }
            
            // Mark initialization as complete now that landing window is shown
            // But add a delay to ensure container z-index stays at 10000 even if observers try to change it
            setTimeout(() => {
                // Final enforcement: ensure container z-index is 10000
                // This overrides any observer changes that might have happened during initialization
                if (this.container) {
                    const currentZIndex = parseInt(window.getComputedStyle(this.container).zIndex, 10);
                    if (isNaN(currentZIndex) || currentZIndex < 10000) {
                        this.container.style.setProperty('z-index', '10000', 'important');
                        this.debugLog('Enforced container z-index to 10000 (final check desktop, was:', currentZIndex, ')');
                    }
                }
                // Now allow observers to modify z-index when user actually expands menu/safetyInfo
                this.isInitializing = false;
                this.debugLog('Widget initialization complete - landing window shown, observers can now modify z-index');
            }, 100);
            
            this.debugLog('Desktop landing window and polygon shown together:', {
                polygonTop,
                polygonLeft,
                windowTop,
                windowRightOffset,
                buttonRect: { top: buttonRect.top, left: buttonRect.left, width: buttonRect.width, height: buttonRect.height, bottom: buttonRect.bottom, right: buttonRect.right },
                avatarCenterX,
                viewportWidth,
                viewportHeight: window.innerHeight,
                containerHasOpenClass: this.container.classList.contains('open'),
                containerHasChatActiveClass: this.container.classList.contains('chat-active')
            });
        }

        showLandingWindow() {
            this.debugLog('showLandingWindow() called');
            // Show the landing window on page load
            this.backdrop.style.display = 'block';
            
            // Update popup positions based on button position
            this.updatePopupPosition();
            
            const landingWindow = this.container.querySelector('.lumi-landing-window');
            const polygon = this.container.querySelector('.lumi-chat-polygon');
            
            this.debugLog('Landing window element found:', !!landingWindow);
            this.debugLog('Polygon element found:', !!polygon);
            
            if (landingWindow) {
                // Use setProperty with important flag to override CSS
                landingWindow.style.setProperty('display', 'flex', 'important');
                this.debugLog('Landing window display set to flex');
                
                // Bind landing window events now that it's displayed
                this.bindLandingWindowEvents();
            }
            
            if (polygon) {
                const isMobile = window.innerWidth <= 768;
                
                // Get CSS variable values for positioning
                const rootStyles = window.getComputedStyle(document.documentElement);
                const polygonTop = rootStyles.getPropertyValue('--widget-polygon-top').trim();
                const polygonLeft = rootStyles.getPropertyValue('--widget-polygon-left').trim();
                
                // Always show polygon when landing window is shown
                polygon.style.setProperty('display', 'block', 'important');
                polygon.style.setProperty('visibility', 'visible', 'important');
                polygon.style.setProperty('opacity', '1', 'important');
                polygon.style.setProperty('position', 'fixed', 'important');
                
                // Set position from CSS variables if available (use left positioning only)
                if (polygonTop) {
                    polygon.style.setProperty('top', polygonTop, 'important');
                }
                if (polygonLeft) {
                    polygon.style.setProperty('left', polygonLeft, 'important');
                    polygon.style.setProperty('right', 'auto', 'important'); // Remove right positioning
                }
                
                if (isMobile && landingWindow) {
                    // On mobile, use higher z-index for landing window
                    polygon.style.setProperty('z-index', '10004', 'important');
                    this.debugLog('Polygon display set to block with z-index 10004 for mobile landing window');
                } else {
                    polygon.style.setProperty('z-index', '10002', 'important');
                    this.debugLog('Polygon display set to block');
                }
                
                // Ensure polygon stays visible - use setTimeout to override any subsequent hiding
                if (isMobile) {
                    setTimeout(() => {
                        if (polygon && landingWindow) {
                            const landingStyles = window.getComputedStyle(landingWindow);
                            const isLandingStillVisible = landingStyles.display !== 'none' && 
                                                            landingStyles.visibility !== 'hidden' && 
                                                            parseFloat(landingStyles.opacity) > 0;
                            if (isLandingStillVisible) {
                                polygon.style.setProperty('display', 'block', 'important');
                                polygon.style.setProperty('visibility', 'visible', 'important');
                                polygon.style.setProperty('opacity', '1', 'important');
                            }
                        }
                    }, 100);
                }
            }
            
            // Mark as open
            this.isOpen = true;
            this.container.classList.add('open');
            
        }
        showChatWindowWithPolygonDesktop(attempt = 0) {
            this.debugLog('showChatWindowWithPolygonDesktop() called, attempt:', attempt);
            
            // User explicitly opened chat window - clear the explicitly closed flag
            this.setChatWindowExplicitlyClosed(false);
            
            // Wait for avatar button to render
            const button = document.querySelector('#lumi-assistant-btn');
            if (!button) {
                if (attempt < 50) {
                    requestAnimationFrame(() => {
                        setTimeout(() => this.showChatWindowWithPolygonDesktop(attempt + 1), 20);
                    });
                    return;
                } else {
                    console.error('Avatar button not found after 50 attempts');
                    return;
                }
            }
            
            // Force layout recalculation
            void button.offsetHeight;
            void button.offsetWidth;
            
            const buttonRect = button.getBoundingClientRect();
            
            // Wait for button to have dimensions
            if (buttonRect.width === 0 || buttonRect.height === 0) {
                if (attempt < 50) {
                    if (attempt % 5 === 0) {
                        this.debugLog(`showChatWindowWithPolygonDesktop: Waiting for button to render, attempt ${attempt + 1}`);
                    }
                    requestAnimationFrame(() => {
                        setTimeout(() => this.showChatWindowWithPolygonDesktop(attempt + 1), 20);
                    });
                    return;
                } else {
                    console.error('Avatar button not rendered after 50 attempts - NOT showing polygon or chat window');
                    return;
                }
            }
            
            // Button is ready - calculate positions dynamically (triangle tip on avatar bottom)
            const { avatarBottom, avatarCenterX } = this.getAssistantButtonLayoutMetrics(button, buttonRect);
            const actualButtonHeight = buttonRect.height;
            const viewportWidth = window.innerWidth;
            const LANDING_POLYGON_SVG_HEIGHT = 12;
            const DESKTOP_LANDING_GAP_BELOW_POLYGON = 3;

            const polygonWidth = 14;
            const polygonLeft = Math.max(0, Math.round(avatarCenterX - polygonWidth / 2));
            const polygonTop = this.getChatPolygonFixedTopY(avatarBottom);

            const buttonRight = Math.max(0, Math.round(viewportWidth - buttonRect.right));
            const windowRightOffset = buttonRight;
            const chatWindowWidth = 385; // Desktop chat window width
            const windowLeft = Math.max(0, Math.round(buttonRect.right - chatWindowWidth));
            const windowTop = Math.round(polygonTop + LANDING_POLYGON_SVG_HEIGHT + DESKTOP_LANDING_GAP_BELOW_POLYGON);
            
            // Get elements
            const landingWindow = document.querySelector('#lumi-landing-window-desktop');
            const chatWindow = this.container.querySelector('.lumi-chat-window');
            const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
            
            // Hide landing window
            if (landingWindow) {
                landingWindow.style.setProperty('display', 'none', 'important');
                landingWindow.style.setProperty('visibility', 'hidden', 'important');
                landingWindow.style.setProperty('opacity', '0', 'important');
            }
            
            // Set widget state
            this.isOpen = true;
            this.container.classList.add('open');
            this.container.classList.add('chat-active');
            this.backdrop.style.display = 'block';
            
            // Update CSS variables with calculated positions
            const root = document.documentElement;
            root.style.setProperty('--widget-button-height', `${actualButtonHeight}px`);
            root.style.setProperty('--widget-polygon-top', `${polygonTop}px`);
            root.style.setProperty('--widget-polygon-left', `${polygonLeft}px`);
            root.style.setProperty('--widget-window-top', `${windowTop}px`);
            root.style.setProperty('--widget-window-right', `${windowRightOffset}px`);
            root.style.setProperty('--widget-window-left', `${windowLeft}px`);
            
            // Show chat window
            if (chatWindow) {
                // Get z-index that's above nav bar - observers will lower it if menu/safetyInfo is expanded
                const chatZIndex = this.getZIndexAboveNavBar(10001);
                chatWindow.style.setProperty('position', 'fixed', 'important');
                chatWindow.style.setProperty('top', `${windowTop}px`, 'important');
                chatWindow.style.setProperty('right', `${windowRightOffset}px`, 'important');
                chatWindow.style.setProperty('left', `${windowLeft}px`, 'important');
                chatWindow.style.setProperty('display', 'flex', 'important');
                chatWindow.style.setProperty('visibility', 'visible', 'important');
                chatWindow.style.setProperty('opacity', '1', 'important');
                chatWindow.style.setProperty('z-index', `${chatZIndex}`, 'important');
                this.restoreMessagesToDOM();
                setTimeout(() => this.switchMode('text'), 50);
            }
            
            // Show polygon (above chat window)
            // Use only left positioning to center polygon at avatarCenterX
            if (polygon) {
                const polygonZIndex = this.getZIndexAboveNavBar(10002);
                polygon.style.setProperty('display', 'block', 'important');
                polygon.style.setProperty('visibility', 'visible', 'important');
                polygon.style.setProperty('opacity', '1', 'important');
                polygon.style.setProperty('position', 'fixed', 'important');
                polygon.style.setProperty('top', `${polygonTop}px`, 'important');
                polygon.style.setProperty('left', `${polygonLeft}px`, 'important');
                polygon.style.setProperty('right', 'auto', 'important'); // Remove right positioning to avoid conflicts
                polygon.style.setProperty('z-index', `${polygonZIndex}`, 'important');
            }
            
            // Verify chat window styles after setting
            if (chatWindow) {
                const chatWindowStyles = window.getComputedStyle(chatWindow);
                this.debugLog('Desktop chat window styles after setting:', {
                    display: chatWindowStyles.display,
                    visibility: chatWindowStyles.visibility,
                    opacity: chatWindowStyles.opacity,
                    position: chatWindowStyles.position,
                    top: chatWindowStyles.top,
                    right: chatWindowStyles.right,
                    zIndex: chatWindowStyles.zIndex,
                    boundingRect: chatWindow.getBoundingClientRect()
                });
            }
            
            this.debugLog('Desktop chat window and polygon shown together:', {
                polygonTop,
                polygonLeft,
                windowTop,
                windowRightOffset,
                buttonRect: { top: buttonRect.top, left: buttonRect.left, width: buttonRect.width, height: buttonRect.height, bottom: buttonRect.bottom, right: buttonRect.right },
                avatarCenterX,
                viewportWidth,
                viewportHeight: window.innerHeight,
                chatWindowFound: !!chatWindow
            });
        }
        getWidgetHTML() {
            // Check if button already exists in the page
            const existingButton = document.getElementById('lumi-assistant-btn');
            
            // Check if we should hide the button (iPad + landscape)
            const shouldHideButton = this.shouldHideAvatarButton();
            
            const buttonHTML = (existingButton || shouldHideButton) ? '' : `
                <!-- LuMi Assistant Button -->
                <div class="lumi-assistant-button" id="lumi-assistant-btn">
                    <div class="lumi-avatar">
                        <img src="https://lumichat.norta.ai/assets/Ellipse%2019.svg" alt="LuMi Avatar" />
                    </div>
                    <span class="lumi-button-text">LuMi AI<br/>Assistant</span>
                </div>
            `;
            
            return `
                ${buttonHTML}
                
                <div class="lumi-chat-polygon">
                    <svg width="14" height="12" viewBox="0 0 14 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7 0L13.9282 12H0.0717969L7 0Z" fill="#B5D9DD"/>
                    </svg>
                </div>
                
                <!-- Landing Div - Desktop Version -->
            <div class="lumi-landing-window lumi-landing-desktop" id="lumi-landing-window-desktop" style="background: transparent;">
                <!-- White background rounded rectangle (per Figma design) -->
                <div style="position: absolute; background: white; border-radius: 10px; left: 0px; right: 0px; top: 4.96%;bottom: 0px;"></div>
                <div class="lumi-landing-header">
                    <div class="lumi-landing-header-content">
                        <div class="lumi-landing-title">Let LuMi help you today!</div>
                        <div class="lumi-landing-close-wrapper">
                            <button class="lumi-landing-close-btn" id="lumi-landing-close-btn-desktop">
                                <img src="https://lumichat.norta.ai/assets/global-icon-icon-close-hover.png" alt="Close" />
                            </button>
                        </div>
                    </div>
                </div>
                <div class="lumi-landing-content">
                    <div class="lumi-landing-buttons-container">
                        <button class="lumi-landing-btn" id="lumi-landing-start-btn-desktop">Start chatting now</button>
                        <button class="lumi-landing-btn" id="lumi-landing-later-btn-desktop">Try later</button>
                    </div>
                </div>
            </div>
                
                <!-- Landing Div - Mobile Version -->
            <div class="lumi-landing-window lumi-landing-mobile" id="lumi-landing-window" style="width: 335px; height: 91px; position: relative; box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.10);">
                <div style="width: 335px; height: 85px; left: 0px; top: 6px; position: absolute; background: white; border-radius: 10px; pointer-events: none;"></div>
                
                <div class="lumi-landing-header" style="width: 335px; height: 38px; padding: 10px; left: 0px; top: 6px; position: absolute; background: #B5D9DD; border-top-left-radius: 10px; border-top-right-radius: 10px; flex-direction: column; justify-content: center; align-items: flex-start; gap: 10px; display: inline-flex; pointer-events: none;">
                    <div style="align-self: stretch; justify-content: flex-start; align-items: center; gap: 34px; display: inline-flex; pointer-events: none;">
                        <div style="flex: 1 1 0; justify-content: center; display: flex; flex-direction: column; color: #006186; font-size: 18px; font-family: 'Open Sans', sans-serif; font-weight: 700; line-height: 24px; word-wrap: break-word;">Let LuMi help you today!</div>
                        <button class="lumi-landing-close-btn" id="lumi-landing-close-btn" style="width: 24px; height: 24px; position: relative; background: transparent; border: none; cursor: pointer; padding: 0; margin: 0; display: flex; align-items: center; justify-content: center; z-index: 2147483647; pointer-events: auto;">
                            <div style="width: 24px; height: 24px; left: 0px; top: 0px; position: absolute; border-radius: 9999px; border: 2px var(--Headlines-body-secondary, white) solid; pointer-events: none;"></div>
                            <div style="position: absolute; color: white; font-size: 14px; font-weight: 700; line-height: 1; pointer-events: none; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">×</div>
                        </button>
                    </div>
                </div>
                
                <div class="lumi-landing-content" style="width: 288px; height: 31px; left: 21.50px; top: 52px; position: absolute; justify-content: flex-start; align-items: center; gap: 7px; display: inline-flex; pointer-events: none;">
                    <div style="flex: 1 1 0; flex-direction: column; justify-content: center; align-items: flex-start; gap: 5px; display: inline-flex; pointer-events: none;">
                        <div style="align-self: stretch; flex-direction: column; justify-content: center; align-items: flex-end; gap: 7px; display: flex; pointer-events: none;">
                            <div style="align-self: stretch; flex-direction: column; justify-content: flex-start; align-items: center; gap: 7px; display: flex; pointer-events: none;">
                                <div style="align-self: stretch; justify-content: center; align-items: center; gap: 10px; display: inline-flex; pointer-events: none;">
                                    <button class="lumi-landing-btn" id="lumi-landing-start-btn" style="height: 26px; padding-left: 12px; padding-right: 12px; padding-top: 5px; padding-bottom: 5px; background: white; border-radius: 20px; outline: 1px #D9D9D9 solid; outline-offset: -1px; justify-content: flex-start; align-items: center; gap: 10px; display: flex; border: none; cursor: pointer; position: relative; z-index: 2147483647; pointer-events: auto;">
                                        <div style="color: #006186; font-size: 14px; font-family: 'Open Sans', sans-serif; font-weight: 600; line-height: 24px; word-wrap: break-word; pointer-events: none;">Start chatting now</div>
                                    </button>
                                    <button class="lumi-landing-btn" id="lumi-landing-later-btn" style="height: 26px; padding-left: 12px; padding-right: 12px; padding-top: 5px; padding-bottom: 5px; background: white; border-radius: 20px; outline: 1px #D9D9D9 solid; outline-offset: -1px; justify-content: flex-start; align-items: center; gap: 10px; display: flex; border: none; cursor: pointer; position: relative; z-index: 2147483647; pointer-events: auto;">
                                        <div style="color: #006186; font-size: 14px; font-family: 'Open Sans', sans-serif; font-weight: 600; line-height: 24px; word-wrap: break-word; pointer-events: none;">Try later</div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
                
                <div class="lumi-chat-window" id="lumi-chat-window">
                    <div class="lumi-chat-header">
                        <div class="lumi-chat-title">LuMi AI Agent</div>
                        <button class="lumi-close-btn" id="lumi-close-btn">×</button>
                    </div>
                    
                    <div class="lumi-chat-content">
                        <!-- Avatar Container -->
                        <div class="lumi-avatar-container" id="lumi-avatar-container" style="display: none;">
                            <div class="lumi-avatar-wrapper">
                                <div class="lumi-avatar-placeholder" id="lumi-avatar-placeholder">
                                    <div class="lumi-avatar-loading">
                                        <div class="lumi-avatar-icon">🤖</div>
                                        <h3>LuMi AI Avatar</h3>
                                        <p>Avatar interface is ready for interaction</p>
                                    </div>
                                </div>
                                <iframe 
                                    id="lumi-avatar-iframe" 
                                    style="display: none;"
                                    allow="microphone; camera; autoplay; fullscreen"
                                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
                                ></iframe>
                                <div class="lumi-avatar-controls">
                                    <button class="lumi-avatar-stop-btn" id="lumi-avatar-stop-btn" style="display: none;">Stop Session</button>
                                </div>
                                <div class="lumi-avatar-status" id="lumi-avatar-status">
                                </div>
                            </div>
                        </div>
                        
                        <!-- Text Chat Messages Container -->
                        <div class="lumi-chat-messages-container" id="lumi-chat-messages-container">
                            <div class="lumi-chat-messages" id="lumi-chat-messages"></div>
                        </div>
                        
                        <div class="lumi-chat-input-container">
                            <div class="lumi-chat-input-form" id="lumi-chat-form">
                                <div class="lumi-chat-input-wrapper">
                                    <textarea 
                                        id="lumi-chat-input" 
                                        placeholder="Type message here..." 
                                        rows="1"
                                        maxlength="1000"
                                    ></textarea>
                                    <button type="submit" class="lumi-chat-send-icon" id="lumi-send-btn">
                                        <div class="lumi-send-icon-inactive" id="lumi-send-inactive">
                                            <img src="https://lumichat.norta.ai/assets/SendIconInActive.png" alt="Send" width="26" height="26" />
                                        </div>
                                        <div class="lumi-send-icon-active" id="lumi-send-active" style="display: none;">
                                            <img src="https://lumichat.norta.ai/assets/SendIconActive.png" alt="Send" width="26" height="26" />
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Mode buttons moved outside input container so they're always visible -->
                        ${this.config.enableAvatar ? `
                        <div class="lumi-chat-mode-buttons">
                            <button class="lumi-mode-btn lumi-ai-btn" id="lumi-ai-btn">
                                <div class="lumi-btn-content">
                                    <span class="lumi-btn-text">LuMi AI</span>
                                    <div class="lumi-btn-icon">
                                        <svg width="18" height="19" viewBox="0 0 18 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M0.635743 10.3277C5.85721 9.07492 7.07492 7.85721 8.32769 2.63574C8.37125 2.45475 8.62875 2.45475 8.67231 2.63574C9.92508 7.85721 11.1428 9.07492 16.3643 10.3277C16.5452 10.3713 16.5452 10.6287 16.3643 10.6723C11.1428 11.9251 9.92508 13.1428 8.67231 18.3643C8.62875 18.5452 8.37125 18.5452 8.32769 18.3643C7.07492 13.1428 5.85721 11.9251 0.635743 10.6723C0.454752 10.6287 0.454752 10.3713 0.635743 10.3277Z" fill="currentColor"/>
                                            <path d="M12.5425 2.94626C14.1741 2.55475 14.5548 2.1741 14.9463 0.542488C14.9598 0.485837 15.0402 0.485837 15.0537 0.542488C15.4452 2.1741 15.8259 2.55475 17.4575 2.94626C17.5142 2.95984 17.5142 3.04016 17.4575 3.05374C15.8259 3.44525 15.4452 3.8259 15.0537 5.45751C15.0402 5.51416 14.9598 5.51416 14.9463 5.45751C14.5548 3.8259 14.1741 3.44525 12.5425 3.05374C12.4858 3.04016 12.4858 2.95984 12.5425 2.94626Z" fill="currentColor"/>
                                        </svg>
                                    </div>
                                </div>
                            </button>
                            <button class="lumi-mode-btn lumi-text-btn active" id="lumi-text-btn">
                                <div class="lumi-btn-content">
                                    <span class="lumi-btn-text">Text chat</span>
                                </div>
                            </button>
                        </div>
                        ` : ''}
                        
                        <div class="lumi-chat-footnote">
                            Please See VYEPTI <a href="https://www.lundbeck.com/content/dam/lundbeck-com/americas/united-states/products/neurology/vyepti_pi_us_en.pdf" target="_blank">Prescribing Information</a>.  <br />This is intended for US healthcare professionals only. Patients should visit 
                            <a href="https://www.vyepti.com/" target="_blank">vyepti.com</a>. 
                            Please do not include your personal or patient information in the chat or avatar messages. EPT-B-101962
                        </div>
                    </div>
                </div>
            `;
        }

        bindEvents() {
            // Add a small delay to ensure DOM is fully rendered
            setTimeout(() => {
                this.attachEventListeners();
            }, 100);
        }
        attachEventListeners() {
            const button = document.querySelector('#lumi-assistant-btn');
            const closeBtn = this.container.querySelector('#lumi-close-btn');
            const form = this.container.querySelector('#lumi-chat-form');
            const input = this.container.querySelector('#lumi-chat-input');
            const sendBtn = this.container.querySelector('#lumi-send-btn');

            this.debugLog('Looking for button:', button);
            this.debugLog('Button found:', !!button);

            // Fire assistant-button-clicked only once per gesture (direct click + document capture can both run)
            const dispatchAssistantButtonClickedOnce = () => {
                if (this._assistantButtonClickedDispatched) return;
                this._assistantButtonClickedDispatched = true;
                this.notifyParentWindow('assistant-button-clicked', {
                    source: 'assistant-button',
                    buttonId: 'lumi-assistant-btn',
                    action: 'toggle'
                });
                setTimeout(() => { this._assistantButtonClickedDispatched = false; }, 300);
            };

            if (button) {
                this.debugLog('Button found, attaching click listener');
                button.addEventListener('click', (e) => {
                    this.debugLog('Avatar button clicked!');
                    e.stopPropagation();
                    dispatchAssistantButtonClickedOnce();
                    this.buttonClickInProgress = true;
                    this.debugLog('Button clicked, toggling chat');
                    this.debugLog('Current isOpen state:', this.isOpen);
                    this.toggleChat();
                    setTimeout(() => {
                        this.buttonClickInProgress = false;
                    }, 200);
                });
            } else {
                console.error('LuMi Assistant button not found! Make sure the HTML has id="lumi-assistant-btn"');
            }

            // Global safety net: handle clicks on the avatar button even if the node was replaced later
            // Use capture phase to ensure this runs before other bubbling handlers
            document.addEventListener('click', (e) => {
                const withinAvatarButton = e.target && (e.target.closest && e.target.closest('#lumi-assistant-btn'));
                if (withinAvatarButton) {
                    this.debugLog('Global handler (capture): Avatar button clicked');
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation(); // Prevent other handlers from running
                    dispatchAssistantButtonClickedOnce();
                    this.buttonClickInProgress = true;
                    this.toggleChat();
                    setTimeout(() => {
                        this.buttonClickInProgress = false;
                    }, 200);
                }
            }, true);

            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Stop avatar session if active
                    this.stopAvatarSession();
                    // Mark chat window as explicitly closed by user (X button click)
                    this.closeChat(false, true);
                });
            }

            // Landing window events are bound when the landing window is displayed via bindLandingWindowEvents()
            // This handles both desktop and mobile buttons correctly

            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleSubmit();
                });
            }

            if (input) {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.handleSubmit();
                    }
                });

                input.addEventListener('input', () => {
                    this.handleInputResize();
                    this.updateSendButtonState();
                });
            }

            if (sendBtn) {
                sendBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.handleSubmit();
                });
            }

            // Since backdrop has pointer-events: none, we need a different approach for click-to-close
            // Add a click handler to the document that closes when clicking on empty areas
            document.addEventListener('click', (e) => {
                this.debugLog('Document click detected:', e.target);
                this.debugLog('Button click in progress:', this.buttonClickInProgress);
                this.debugLog('Is open:', this.isOpen);
                this.debugLog('Ignore next document click:', this.ignoreNextDocumentClick);
                
                const primaryTouch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
                const clickX = typeof e.clientX === 'number' ? e.clientX : (primaryTouch ? primaryTouch.clientX : null);
                const clickY = typeof e.clientY === 'number' ? e.clientY : (primaryTouch ? primaryTouch.clientY : null);
                const isPointInsideElement = (el) => {
                    if (!el || typeof this.isPointInsideRect !== 'function') {
                        return false;
                    }
                    return this.isPointInsideRect(el.getBoundingClientRect(), clickX, clickY);
                };
                
                // Don't close if we're ignoring the next click (menu was just closed)
                if (this.ignoreNextDocumentClick) {
                    this.debugLog('Document click ignored - menu was just closed');
                    return;
                }
                
                // Don't close if a button click is in progress
                if (this.buttonClickInProgress) {
                    this.debugLog('Document click ignored - button click in progress');
                    return;
                }
                
                // Check if clicking on dropdown menu or menu-related elements
                const clickedOnDropdownMenu = e.target.closest('.dropdown-menus') ||
                                            e.target.closest('.dropdown-menu') ||
                                            e.target.closest('[class*="dropdown"]') ||
                                            e.target.closest('[class*="nav"]') ||
                                            e.target.closest('nav') ||
                                            e.target.closest('.navbar');
                
                if (clickedOnDropdownMenu) {
                    this.debugLog('Document click ignored - clicked on dropdown menu or navigation');
                    return;
                }
                
                
                // Check if clicking on the avatar button - if so, let the button handler deal with it (don't interfere)
                const clickedAvatarButton = e.target.closest('#lumi-assistant-btn') || 
                                            e.target.closest('.lumi-assistant-button') ||
                                            (e.target.id === 'lumi-assistant-btn') ||
                                            (e.target.classList && e.target.classList.contains('lumi-assistant-button'));
                
                if (clickedAvatarButton) {
                    this.debugLog('Document click ignored - avatar button click (handled by button handler)');
                    return; // Let the button handler deal with it, don't interfere
                }
                
                // Check if clicking on landing window buttons - let their handlers deal with it
                const isLandingButton = e.target.closest('#lumi-landing-start-btn') ||
                                        e.target.closest('#lumi-landing-start-btn-desktop') ||
                                        e.target.closest('#lumi-landing-later-btn') ||
                                        e.target.closest('#lumi-landing-later-btn-desktop') ||
                                        e.target.closest('.lumi-landing-btn') ||
                                        (e.target.id && (e.target.id.includes('lumi-landing-start-btn') || e.target.id.includes('lumi-landing-later-btn')));
                
                if (isLandingButton) {
                    this.debugLog('Document click ignored - landing button click (handled by button handler)');
                    return; // Let the button handler deal with it, don't interfere
                }
                
                // Only close if we're in the open state and clicked on an empty area
                // Don't close if clicking on any widget elements
                const isCloseButton = e.target.closest('.lumi-landing-close-btn') || 
                                        e.target.closest('#lumi-landing-close-btn') ||
                                        e.target.closest('#lumi-landing-close-btn-desktop') ||
                                        e.target.closest('.lumi-landing-close-wrapper');
                
                // If close button is clicked, handle it (fallback in case button handler didn't fire)
                const landingWindow = document.querySelector('.lumi-landing-window');
                const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                const landingWindowVisible = landingWindow && 
                                            window.getComputedStyle(landingWindow).display !== 'none' &&
                                            window.getComputedStyle(landingWindow).visibility !== 'hidden';
                
                if (isCloseButton && landingWindowVisible) {
                    // Prevent duplicate calls if button handler already fired
                    if (this.buttonClickInProgress) {
                        this.debugLog('Document click - close button click ignored (already processing)');
                        return;
                    }
                    this.debugLog('Document click - close button clicked (fallback handler)');
                    e.preventDefault();
                    e.stopPropagation();
                    this.buttonClickInProgress = true;
                    this.closeChat();
                    setTimeout(() => {
                        this.buttonClickInProgress = false;
                    }, 300);
                    return;
                }
                
                // Check if clicking inside the chat window or any of its children
                // Need to check for all chat window content elements
                const chatWindow = this.container.querySelector('.lumi-chat-window') || document.querySelector('.lumi-chat-window');
                let clickedInsideChatWindow = chatWindow && (
                    chatWindow.contains(e.target) ||
                    e.target.closest('.lumi-chat-window') ||
                    e.target.closest('#lumi-chat-window') ||
                    e.target.closest('.lumi-chat-header') ||
                    e.target.closest('.lumi-chat-content') ||
                    e.target.closest('.lumi-chat-messages') ||
                    e.target.closest('.lumi-chat-messages-container') ||
                    e.target.closest('.lumi-chat-message') ||
                    e.target.closest('.lumi-chat-input-container') ||
                    e.target.closest('.lumi-chat-input-form') ||
                    e.target.closest('.lumi-chat-input-wrapper') ||
                    e.target.closest('#lumi-chat-input') ||
                    e.target.closest('#lumi-chat-form') ||
                    e.target.closest('.lumi-chat-mode-buttons') ||
                    e.target.closest('.lumi-mode-btn') ||
                    e.target.closest('.lumi-chat-footnote') ||
                    e.target.closest('.lumi-avatar-container') ||
                    e.target.closest('#lumi-avatar-iframe') ||
                    e.target.closest('.lumi-close-btn') ||
                    e.target.closest('#lumi-close-btn') ||
                    e.target.closest('#lumi-send-btn') ||
                    e.target.closest('.lumi-chat-send-icon') ||
                    (e.target.tagName && e.target.tagName.toLowerCase() === 'textarea' && e.target.id === 'lumi-chat-input') ||
                    (e.target.tagName && e.target.tagName.toLowerCase() === 'input')
                );
                if (!clickedInsideChatWindow && chatWindow && typeof clickX === 'number' && typeof clickY === 'number') {
                    clickedInsideChatWindow = isPointInsideElement(chatWindow);
                }
                
                // Check if clicking inside landing window
                let clickedInsideLandingWindow = e.target.closest('.lumi-landing-window') ||
                                                    e.target.closest('#lumi-landing-window') ||
                                                    e.target.closest('#lumi-landing-window-desktop') ||
                                                    e.target.closest('.lumi-landing-btn');
                if (!clickedInsideLandingWindow && landingWindow && typeof clickX === 'number' && typeof clickY === 'number') {
                    clickedInsideLandingWindow = isPointInsideElement(landingWindow);
                }
                
                // Check if clicking on polygon
                let clickedOnPolygon = e.target.closest('.lumi-chat-polygon');
                if (!clickedOnPolygon && polygon && typeof clickX === 'number' && typeof clickY === 'number') {
                    clickedOnPolygon = isPointInsideElement(polygon);
                }
                
                const clickedInsideWidget = clickedInsideChatWindow || clickedInsideLandingWindow || clickedOnPolygon;
                
                // CRITICAL: Allow clicks on interactive page elements to proceed normally
                // Check if clicking on form elements, inputs, autocomplete, or other interactive elements
                // Only allow if NOT inside the widget (to avoid interfering with widget interactions)
                const isInteractiveElement = !clickedInsideWidget && (
                    e.target.tagName === 'INPUT' ||
                    e.target.tagName === 'TEXTAREA' ||
                    e.target.tagName === 'SELECT' ||
                    e.target.tagName === 'COVERAGE-FINDER' ||
                    e.target.tagName === 'COVERAGEFINDER' ||
                    e.target.id === 'coverageFinder' ||
                    (e.target.tagName === 'BUTTON' && !e.target.closest('.lumi-assistant-widget')) ||
                    e.target.isContentEditable ||
                    e.target.closest('coverage-finder:not(.lumi-assistant-widget coverage-finder)') ||
                    e.target.closest('coveragefinder:not(.lumi-assistant-widget coveragefinder)') ||
                    e.target.closest('#coverageFinder:not(.lumi-assistant-widget #coverageFinder)') ||
                    e.target.closest('input:not(.lumi-assistant-widget input)') ||
                    e.target.closest('textarea:not(.lumi-assistant-widget textarea)') ||
                    e.target.closest('select:not(.lumi-assistant-widget select)') ||
                    e.target.closest('form:not(.lumi-assistant-widget form)') ||
                    e.target.closest('[role="combobox"]:not(.lumi-assistant-widget [role="combobox"])') ||
                    e.target.closest('[role="textbox"]:not(.lumi-assistant-widget [role="textbox"])') ||
                    e.target.closest('[class*="Autocomplete"]:not(.lumi-assistant-widget [class*="Autocomplete"])') ||
                    e.target.closest('[class*="autocomplete"]:not(.lumi-assistant-widget [class*="autocomplete"])') ||
                    e.target.closest('[class*="MuiAutocomplete"]:not(.lumi-assistant-widget [class*="MuiAutocomplete"])') ||
                    e.target.closest('[class*="norstella-cf-MuiAutocomplete"]:not(.lumi-assistant-widget [class*="norstella-cf-MuiAutocomplete"])') ||
                    e.target.closest('[class*="MuiInputBase"]:not(.lumi-assistant-widget [class*="MuiInputBase"])') ||
                    e.target.closest('[class*="MuiTextField"]:not(.lumi-assistant-widget [class*="MuiTextField"])') ||
                    (e.target.closest('a[href]') && !e.target.closest('.lumi-assistant-widget')) ||
                    (e.target.closest('label') && !e.target.closest('.lumi-assistant-widget'))
                );
                
                if (isInteractiveElement) {
                    // Allow the click to proceed normally - don't interfere with page interactions
                    this.debugLog('Document click - allowing interaction with page element:', e.target.tagName, e.target.className);
                    return;
                }
                
                // Debug logging to help identify what's being clicked
                if (this.isOpen) {
                    this.debugLog('Document click - chat window check:', {
                        target: e.target,
                        targetTag: e.target.tagName,
                        targetId: e.target.id,
                        targetClass: e.target.className,
                        chatWindow: chatWindow ? 'found' : 'not found',
                        chatWindowContains: chatWindow ? chatWindow.contains(e.target) : false,
                        clickedInsideChatWindow: !!clickedInsideChatWindow,
                        clickedInsideWidget: !!clickedInsideWidget,
                        ignoreFlag: this.ignoreNextDocumentClick
                    });
                }
                
                if (this.isOpen && !clickedInsideWidget) {
                    // Double-check: if chatWindow exists and contains the target, don't close
                    if (chatWindow && chatWindow.contains(e.target)) {
                        this.debugLog('Document click - chatWindow.contains() detected click inside, NOT closing');
                        return;
                    }
                    
                    // Don't close if menu just closed (extra safety check)
                    if (this.menuJustClosed) {
                        this.debugLog('Document click - menu just closed, NOT closing chat window');
                        return;
                    }
                    
                    this.debugLog('Document click - closing chat (clicked outside widget)');
                    this.closeChat(false); // Don't clear messages when clicking outside - preserve chat history
                } else {
                    this.debugLog('Document click - not closing chat, clickedInsideChatWindow:', !!clickedInsideChatWindow, 'clickedInsideLandingWindow:', !!clickedInsideLandingWindow, 'clickedOnPolygon:', !!clickedOnPolygon);
                }
            });

            // Add click handler to chat window to stop propagation
            // This prevents clicks inside the chat window from bubbling to the document handler
            const chatWindow = this.container.querySelector('.lumi-chat-window') || document.querySelector('.lumi-chat-window');
            if (chatWindow) {
                chatWindow.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.debugLog('Chat window click - stopped propagation');
                });
            }
            
            // Mode button events (only bind if avatar is enabled)
            if (this.config.enableAvatar) {
                const aiBtn = this.container.querySelector('#lumi-ai-btn');
                const textBtn = this.container.querySelector('#lumi-text-btn');

                if (aiBtn) {
                    aiBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const previousMode = this.container.querySelector('#lumi-text-btn')?.classList.contains('active') ? 'text' : 'ai';
                        this.switchMode('ai', previousMode, true); // userInitiated = true
                    });
                }

                if (textBtn) {
                    textBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        // Stop avatar session when switching to text mode
                        this.stopAvatarSession();
                        const previousMode = this.container.querySelector('#lumi-ai-btn')?.classList.contains('active') ? 'ai' : 'text';
                        this.switchMode('text', previousMode, true); // userInitiated = true
                    });
                }
            }

            // Chat message link click handler - use event delegation to handle links in chat messages
            const messagesContainer = this.container.querySelector('#lumi-chat-messages');
            if (messagesContainer && !messagesContainer.dataset.linkHandlerAttached) {
                messagesContainer.dataset.linkHandlerAttached = 'true';
                messagesContainer.addEventListener('click', (e) => {
                    const link = e.target.closest('a[href]');
                    if (link && link.href) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // Find the parent message element to get message ID and type
                        const messageElement = link.closest('.lumi-chat-message');
                        const messageId = messageElement ? messageElement.getAttribute('data-message-id') : null;
                        const isUserMessage = messageElement ? messageElement.classList.contains('user') : false;
                        
                        // Notify parent window of link click event
                        this.notifyParentWindow('resource-link-click', {
                            url: link.href,
                            linkText: link.textContent || link.innerText || '',
                            messageId: messageId,
                            messageType: 'chat', // 'chat' for chat messages, 'voice' for voice/avatar iframe
                            chatMessageType: isUserMessage ? 'user' : 'assistant' // Additional info: whether it's from user or assistant message
                        });
                        
                        // Open link in new tab
                        window.open(link.href, '_blank', 'noopener,noreferrer');
                    }
                });
                this.debugLog('Chat message link click handler attached');
            }

            // Avatar control events - Stop button is now hidden, functionality moved to close and text buttons
            
            // Window resize listener to update popup positions
            window.addEventListener('resize', () => {
                if (!this.isOpen) {
                    return;
                }
                
                this.updatePopupPosition();
                
                if (this.resizeRebindTimeout) {
                    clearTimeout(this.resizeRebindTimeout);
                }
                
                this.resizeRebindTimeout = setTimeout(() => {
                    try {
                        this.bindLandingWindowEvents();
                        this.ensureLandingWindowVisibilityForViewport();
                    } catch (error) {
                        console.error('Failed to re-bind landing window events after resize:', error);
                    }
                }, 100);
            });
        }
        bindLandingWindowEvents() {
            this.debugLog('Binding landing window events...');
            
            // Find the start button - prioritize desktop on desktop, mobile on mobile
            const isMobile = window.innerWidth <= 768;
            let startBtn;
            if (isMobile) {
                // On mobile, ONLY look for mobile button, ignore desktop button
                startBtn = this.container.querySelector('#lumi-landing-start-btn') || document.querySelector('#lumi-landing-start-btn');
                // Ensure desktop landing window is hidden on mobile
                const desktopLanding = document.querySelector('#lumi-landing-window-desktop');
                if (desktopLanding) {
                    desktopLanding.style.setProperty('display', 'none', 'important');
                    desktopLanding.style.setProperty('visibility', 'hidden', 'important');
                }
            } else {
                startBtn = this.container.querySelector('#lumi-landing-start-btn-desktop') || document.querySelector('#lumi-landing-start-btn-desktop') ||
                            this.container.querySelector('#lumi-landing-start-btn') || document.querySelector('#lumi-landing-start-btn');
                // Ensure mobile landing window is hidden on desktop
                const mobileLanding = document.querySelector('#lumi-landing-window');
                if (mobileLanding && mobileLanding.classList.contains('lumi-landing-mobile')) {
                    mobileLanding.style.setProperty('display', 'none', 'important');
                    mobileLanding.style.setProperty('visibility', 'hidden', 'important');
                }
            }
            this.debugLog('Looking for start button (isMobile:', isMobile, '):', startBtn, 'ID:', startBtn ? startBtn.id : 'not found');
            
            if (startBtn) {
                // Always re-bind handlers to ensure they're attached (clone/replace clears old handlers)
                this.debugLog('Start button found, attaching click listener');
                this.debugLog('Start button element:', startBtn);
                this.debugLog('Start button display style:', startBtn.style.display);
                this.debugLog('Start button computed style:', window.getComputedStyle(startBtn).display);
                
                // Clear any existing event listeners by removing and re-adding the element
                const parent = startBtn.parentNode;
                const newStartBtn = startBtn.cloneNode(true);
                newStartBtn.dataset.eventsBound = 'true'; // Mark as bound
                parent.removeChild(startBtn);
                parent.appendChild(newStartBtn);
                
                this.debugLog('Button replaced with clone:', newStartBtn);
                this.debugLog('New button classes:', newStartBtn.className);
                this.debugLog('New button computed styles:', window.getComputedStyle(newStartBtn));
                
                // Fire start-chatting only once per gesture (mousedown + click, or touchstart + pointerdown can both fire)
                const dispatchStartChattingOnce = () => {
                    if (this._startChattingEventDispatched) return;
                    this._startChattingEventDispatched = true;
                    console.log('[LuMi Widget] Dispatching start-chatting event');
                    this.notifyParentWindow('start-chatting', {
                        source: 'landing-window',
                        buttonId: newStartBtn.id || 'lumi-landing-start-btn'
                    });
                    setTimeout(() => { this._startChattingEventDispatched = false; }, 300);
                };

                // Add multiple event listeners to ensure we catch the click
                newStartBtn.addEventListener('click', (e) => {
                    this.debugLog('Start button clicked! - Event captured');
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    dispatchStartChattingOnce();
                    this.buttonClickInProgress = true;
                    this.debugLog('Calling startChatting()...');
                    this.startChatting();
                    this.debugLog('startChatting() call completed');
                    setTimeout(() => {
                        this.buttonClickInProgress = false;
                        this.debugLog('buttonClickInProgress flag cleared');
                    }, 100);
                });
                
                // Add mousedown as backup (do not dispatch again - click will fire after)
                newStartBtn.addEventListener('mousedown', (e) => {
                    this.debugLog('Start button mousedown!');
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    dispatchStartChattingOnce();
                    this.buttonClickInProgress = true;
                    this.startChatting();
                    setTimeout(() => { this.buttonClickInProgress = false; }, 100);
                });

                // Add touchstart for iOS Safari
                newStartBtn.addEventListener('touchstart', (e) => {
                    this.debugLog('Start button touchstart!');
                    try { e.preventDefault(); } catch(_) {}
                    e.stopPropagation();
                    dispatchStartChattingOnce();
                    this.buttonClickInProgress = true;
                    this.startChatting();
                    setTimeout(() => { this.buttonClickInProgress = false; }, 100);
                }, { passive: false });

                // Add pointerdown as an additional safety (do not dispatch again - touchstart or click may also fire)
                if (window.PointerEvent) {
                    newStartBtn.addEventListener('pointerdown', (e) => {
                        this.debugLog('Start button pointerdown!');
                        e.preventDefault();
                        e.stopPropagation();
                        dispatchStartChattingOnce();
                        this.buttonClickInProgress = true;
                        this.startChatting();
                        setTimeout(() => { this.buttonClickInProgress = false; }, 100);
                    });
                }
                
                // Add direct onclick as another backup
                newStartBtn.onclick = (e) => {
                    this.debugLog('Start button onclick!');
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    // Set flag to prevent document click handler
                    this.buttonClickInProgress = true;
                    
                    this.startChatting();
                    
                    // Clear flag after a short delay
                    setTimeout(() => {
                        this.buttonClickInProgress = false;
                    }, 100);
                };
                
                // Test hover functionality
                newStartBtn.addEventListener('mouseenter', () => {
                    this.debugLog('Button hover detected!');
                });
                
                newStartBtn.addEventListener('mouseleave', () => {
                    this.debugLog('Button hover left!');
                });
                
                // Ensure button is clickable and has proper styling
                newStartBtn.style.pointerEvents = 'auto';
                newStartBtn.style.position = 'relative';
                // Use extremely high z-index to ensure button is on top (same as chat window)
                newStartBtn.style.zIndex = '2147483647';
                newStartBtn.style.cursor = 'pointer';
                newStartBtn.style.transition = 'all 0.2s ease';
                
                // On mobile, ensure landing window and its parent containers have high z-index
                if (isMobile) {
                    const landingWindow = newStartBtn.closest('.lumi-landing-window');
                    if (landingWindow) {
                        landingWindow.style.setProperty('z-index', '2147483647', 'important');
                        landingWindow.style.setProperty('position', 'fixed', 'important');
                    }
                    // Ensure parent containers also have proper z-index
                    let parent = newStartBtn.parentElement;
                    let depth = 0;
                    while (parent && depth < 5 && parent !== document.body) {
                        if (parent.classList && parent.classList.contains('lumi-landing-content')) {
                            parent.style.setProperty('z-index', '2147483647', 'important');
                            parent.style.setProperty('position', 'relative', 'important');
                        }
                        parent = parent.parentElement;
                    }
                }
                
                // Force apply the CSS class to ensure styles are applied
                newStartBtn.className = 'lumi-landing-btn';
                
                // Check if button is actually visible
                const rect = newStartBtn.getBoundingClientRect();
                this.debugLog('New button bounding rect:', rect);
                this.debugLog('New button is visible:', rect.width > 0 && rect.height > 0);
                //this.debugLog('New button computed styles:', window.getComputedStyle(newStartBtn));
                
                // Ensure button has proper z-index and pointer-events to be clickable
                // We rely on z-index stacking instead of disabling pointer-events on other elements
                // This avoids breaking interactive elements on the page
                newStartBtn.style.setProperty('pointer-events', 'auto', 'important');
                newStartBtn.style.setProperty('z-index', '2147483647', 'important');
                this.debugLog('Button configured with high z-index and pointer-events: auto');
                
                this.debugLog('Events bound successfully to start button');
            } else {
                this.debugLog('ERROR: Start button not found!');
            }

            // Desktop/Mobile later button - prioritize desktop on desktop, mobile on mobile
            let laterBtn;
            if (isMobile) {
                laterBtn = this.container.querySelector('#lumi-landing-later-btn') || document.querySelector('#lumi-landing-later-btn');
            } else {
                laterBtn = this.container.querySelector('#lumi-landing-later-btn-desktop') || document.querySelector('#lumi-landing-later-btn-desktop') ||
                            this.container.querySelector('#lumi-landing-later-btn') || document.querySelector('#lumi-landing-later-btn');
            }
            if (laterBtn) {
                // Always re-bind handlers to ensure they're attached (clone/replace clears old handlers)
                this.debugLog('Try later button found, cloning and re-attaching...');
                
                // Clone and replace like the start button to ensure clean event handlers
                const parent = laterBtn.parentNode;
                const newLaterBtn = laterBtn.cloneNode(true);
                newLaterBtn.dataset.eventsBound = 'true'; // Mark as bound
                parent.removeChild(laterBtn);
                parent.appendChild(newLaterBtn);
                
                // Fire try-later only once per gesture (mousedown + click, touchstart + pointerdown can both fire)
                const dispatchTryLaterOnce = () => {
                    if (this._tryLaterEventDispatched) return;
                    this._tryLaterEventDispatched = true;
                    this.notifyParentWindow('try-later', {
                        source: 'landing-window',
                        buttonId: newLaterBtn.id || 'lumi-landing-later-btn'
                    });
                    setTimeout(() => { this._tryLaterEventDispatched = false; }, 300);
                };

                // Handler function for try later button - JUST HIDE IT like snapshot
                const handleTryLaterClick = (e) => {
                    this.debugLog('Try later button clicked');
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    dispatchTryLaterOnce();
                    this.buttonClickInProgress = true;
                    
                    // Just hide the landing window and polygon
                    // Use correct selector for desktop vs mobile
                    const isMobile = window.innerWidth <= 768;
                    let landingWindow;
                    if (isMobile) {
                        landingWindow = this.container.querySelector('#lumi-landing-window') || document.querySelector('#lumi-landing-window');
                    } else {
                        landingWindow = this.container.querySelector('#lumi-landing-window-desktop') || document.querySelector('#lumi-landing-window-desktop');
                    }
                    const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                    
                    if (landingWindow) {
                        // Add dismissed class so CSS rules don't show it again
                        landingWindow.classList.add('lumi-landing-dismissed');
                        landingWindow.style.setProperty('display', 'none', 'important');
                        landingWindow.style.setProperty('visibility', 'hidden', 'important');
                        landingWindow.style.setProperty('opacity', '0', 'important');
                        landingWindow.style.setProperty('pointer-events', 'none', 'important');
                        this.debugLog('Landing window hidden - user can click avatar button to reopen');
                    }
                    
                    if (polygon) {
                        polygon.style.setProperty('display', 'none', 'important');
                        polygon.style.setProperty('visibility', 'hidden', 'important');
                        polygon.style.setProperty('opacity', '0', 'important');
                        this.debugLog('Polygon hidden');
                    }
                    
                    // Hide backdrop
                    if (this.backdrop) {
                        this.backdrop.style.display = 'none';
                    }
                    
                    // Set isOpen to false and remove open class so document click handler doesn't interfere
                    this.isOpen = false;
                    this.container.classList.remove('open');
                    this.container.classList.remove('chat-active');
                    this.debugLog('Chat session closed - user can click avatar button to reopen');
                    
                    // Re-enable main button clicks so user can click avatar button to reopen
                    const mainButton = document.querySelector('#lumi-assistant-btn');
                    if (mainButton) {
                        mainButton.style.pointerEvents = 'auto';
                        this.debugLog('Main button clicks re-enabled for Try later');
                    }
                    
                    // Restore body scroll
                    this.unlockBodyScroll('Try later button');
                    
                    // Mark landing window as dismissed so it won't show again this session
                    this.setHasShownLandingWindow(true);
                    
                    // Clear flag after a short delay
                    setTimeout(() => {
                        this.buttonClickInProgress = false;
                    }, 100);
                };
                
                // Add multiple event listeners to ensure we catch the click (same as start button)
                newLaterBtn.addEventListener('click', handleTryLaterClick);
                
                // Add mousedown as backup (don't set flag - let handler manage it)
                newLaterBtn.addEventListener('mousedown', (e) => {
                    this.debugLog('Try later button mousedown!');
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    handleTryLaterClick(e);
                });
                
                // Add touchstart for mobile (don't set flag - let handler manage it)
                newLaterBtn.addEventListener('touchstart', (e) => {
                    this.debugLog('Try later button touchstart!');
                    try { e.preventDefault(); } catch(_) {}
                    e.stopPropagation();
                    handleTryLaterClick(e);
                }, { passive: false });
                
                // Add pointerdown as additional safety (don't set flag - let handler manage it)
                if (window.PointerEvent) {
                    newLaterBtn.addEventListener('pointerdown', (e) => {
                        this.debugLog('Try later button pointerdown!');
                        e.preventDefault();
                        e.stopPropagation();
                        handleTryLaterClick(e);
                    });
                }
                
                // Add direct onclick as another backup
                newLaterBtn.onclick = handleTryLaterClick;
                
                // Ensure button is clickable
                newLaterBtn.style.setProperty('pointer-events', 'auto', 'important');
                newLaterBtn.style.setProperty('position', 'relative', 'important');
                // Use extremely high z-index to ensure button is on top (same as chat window)
                newLaterBtn.style.setProperty('z-index', '2147483647', 'important');
                newLaterBtn.style.setProperty('cursor', 'pointer', 'important');
                
                // On mobile, ensure landing window has high z-index
                if (isMobile) {
                    const landingWindow = newLaterBtn.closest('.lumi-landing-window');
                    if (landingWindow) {
                        landingWindow.style.setProperty('z-index', '2147483647', 'important');
                        landingWindow.style.setProperty('position', 'fixed', 'important');
                    }
                }
                
                this.debugLog('Try later button events bound successfully');
            } else {
                this.debugLog('ERROR: Try later button not found!');
            }

            // Desktop/Mobile close button - prioritize desktop on desktop, mobile on mobile
            let landingCloseBtn;
            if (isMobile) {
                landingCloseBtn = this.container.querySelector('#lumi-landing-close-btn') || document.querySelector('#lumi-landing-close-btn');
            } else {
                landingCloseBtn = this.container.querySelector('#lumi-landing-close-btn-desktop') || document.querySelector('#lumi-landing-close-btn-desktop') ||
                                    this.container.querySelector('#lumi-landing-close-btn') || document.querySelector('#lumi-landing-close-btn');
            }
            if (landingCloseBtn) {
                // Always re-bind handlers to ensure they're attached (clone/replace clears old handlers)
                this.debugLog('Close button found, cloning and re-attaching...');
                
                // Clone and replace to ensure clean event handlers
                const parent = landingCloseBtn.parentNode;
                const newCloseBtn = landingCloseBtn.cloneNode(true);
                newCloseBtn.dataset.eventsBound = 'true'; // Mark as bound
                parent.removeChild(landingCloseBtn);
                parent.appendChild(newCloseBtn);
                
                // Fire landing-close only once per gesture (mousedown + click, touch + pointer, image click can all fire)
                const dispatchLandingCloseOnce = () => {
                    if (this._landingCloseEventDispatched) return;
                    this._landingCloseEventDispatched = true;
                    this.notifyParentWindow('landing-close', {
                        source: 'landing-window',
                        buttonId: newCloseBtn.id || 'lumi-landing-close-btn'
                    });
                    setTimeout(() => { this._landingCloseEventDispatched = false; }, 300);
                };

                // Handler function for close button - SIMPLIFIED like snapshot
                const handleCloseClick = (e) => {
                    this.debugLog('Close button clicked!');
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    dispatchLandingCloseOnce();
                    this.buttonClickInProgress = true;
                    
                    // Just hide the landing window and polygon (same as Try later)
                    // Use correct selector for desktop vs mobile
                    const isMobile = window.innerWidth <= 768;
                    let landingWindow;
                    if (isMobile) {
                        landingWindow = this.container.querySelector('#lumi-landing-window') || document.querySelector('#lumi-landing-window');
                    } else {
                        landingWindow = this.container.querySelector('#lumi-landing-window-desktop') || document.querySelector('#lumi-landing-window-desktop');
                    }
                    const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                    
                    if (landingWindow) {
                        // Add dismissed class so CSS rules don't show it again
                        landingWindow.classList.add('lumi-landing-dismissed');
                        landingWindow.style.setProperty('display', 'none', 'important');
                        landingWindow.style.setProperty('visibility', 'hidden', 'important');
                        landingWindow.style.setProperty('opacity', '0', 'important');
                        landingWindow.style.setProperty('pointer-events', 'none', 'important');
                        this.debugLog('Landing window hidden - user can click avatar button to reopen');
                    }
                    
                    if (polygon) {
                        polygon.style.setProperty('display', 'none', 'important');
                        polygon.style.setProperty('visibility', 'hidden', 'important');
                        polygon.style.setProperty('opacity', '0', 'important');
                        this.debugLog('Polygon hidden');
                    }
                    
                    // Hide backdrop
                    if (this.backdrop) {
                        this.backdrop.style.display = 'none';
                    }
                    
                    // Set isOpen to false and remove open class so document click handler doesn't interfere
                    this.isOpen = false;
                    this.container.classList.remove('open');
                    this.container.classList.remove('chat-active');
                    this.debugLog('Chat session closed - user can click avatar button to reopen');
                    
                    // Re-enable main button clicks so user can click avatar button to reopen
                    const mainButton = document.querySelector('#lumi-assistant-btn');
                    if (mainButton) {
                        mainButton.style.pointerEvents = 'auto';
                        this.debugLog('Main button clicks re-enabled for Close');
                    }
                    
                    // Restore body scroll
                    this.unlockBodyScroll('Close button');
                    
                    // Mark landing window as dismissed so it won't show again this session
                    this.setHasShownLandingWindow(true);
                    this.debugLog('Landing window dismissed by user (X button) - won\'t show again this session');
                    
                    // Clear flag after a short delay
                    setTimeout(() => {
                        this.buttonClickInProgress = false;
                    }, 100);
                };
                
                // Add multiple event listeners to ensure we catch the click (same as start button)
                newCloseBtn.addEventListener('click', handleCloseClick);
                
                // Add mousedown as backup (don't set flag - let handler manage it)
                newCloseBtn.addEventListener('mousedown', (e) => {
                    this.debugLog('Close button mousedown!');
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    handleCloseClick(e);
                });
                
                // Add touchstart for mobile (don't set flag - let handler manage it)
                newCloseBtn.addEventListener('touchstart', (e) => {
                    this.debugLog('Close button touchstart!');
                    try { e.preventDefault(); } catch(_) {}
                    e.stopPropagation();
                    handleCloseClick(e);
                }, { passive: false });
                
                // Add pointerdown as additional safety (don't set flag - let handler manage it)
                if (window.PointerEvent) {
                    newCloseBtn.addEventListener('pointerdown', (e) => {
                        this.debugLog('Close button pointerdown!');
                        e.preventDefault();
                        e.stopPropagation();
                        handleCloseClick(e);
                    });
                }
                
                // Add direct onclick as another backup
                newCloseBtn.onclick = handleCloseClick;
                
                // Also handle clicks on the image inside the button
                const closeBtnImage = newCloseBtn.querySelector('img');
                if (closeBtnImage) {
                    closeBtnImage.addEventListener('click', handleCloseClick);
                    closeBtnImage.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCloseClick(e);
                    });
                }
                
                // Ensure button is clickable
                newCloseBtn.style.setProperty('pointer-events', 'auto', 'important');
                newCloseBtn.style.setProperty('position', 'relative', 'important');
                // Use extremely high z-index to ensure button is on top (same as chat window)
                newCloseBtn.style.setProperty('z-index', '2147483647', 'important');
                newCloseBtn.style.setProperty('cursor', 'pointer', 'important');
                
                // On mobile, ensure landing window has high z-index
                if (isMobile) {
                    const landingWindow = newCloseBtn.closest('.lumi-landing-window');
                    if (landingWindow) {
                        landingWindow.style.setProperty('z-index', '2147483647', 'important');
                        landingWindow.style.setProperty('position', 'fixed', 'important');
                    }
                }
                this.debugLog('Close button events bound successfully');
            } else {
                this.debugLog('ERROR: Close button not found!');
            }
        }

        ensureLandingWindowVisibilityForViewport() {
            const landingShouldBeVisible = this.isOpen && !this.container.classList.contains('chat-active');
            if (!landingShouldBeVisible) {
                return;
            }
            
            const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                const mobileLanding = this.container.querySelector('#lumi-landing-window') || document.querySelector('#lumi-landing-window');
                if (!mobileLanding || mobileLanding.classList.contains('lumi-landing-dismissed')) {
                    return;
                }
                
                mobileLanding.style.setProperty('display', 'flex', 'important');
                mobileLanding.style.setProperty('visibility', 'visible', 'important');
                mobileLanding.style.setProperty('opacity', '1', 'important');
                mobileLanding.style.setProperty('pointer-events', 'auto', 'important');
                
                if (polygon) {
                    polygon.style.setProperty('display', 'block', 'important');
                    polygon.style.setProperty('visibility', 'visible', 'important');
                    polygon.style.setProperty('opacity', '1', 'important');
                }
            } else {
                const desktopLanding = this.container.querySelector('#lumi-landing-window-desktop') || document.querySelector('#lumi-landing-window-desktop');
                if (!desktopLanding || desktopLanding.classList.contains('lumi-landing-dismissed')) {
                    return;
                }
                
                const landingZIndex = this.getZIndexAboveNavBar(10003);
                desktopLanding.style.setProperty('display', 'flex', 'important');
                desktopLanding.style.setProperty('visibility', 'visible', 'important');
                desktopLanding.style.setProperty('opacity', '1', 'important');
                desktopLanding.style.setProperty('pointer-events', 'auto', 'important');
                desktopLanding.style.setProperty('z-index', `${landingZIndex}`, 'important');
                
                if (polygon) {
                    const polygonZIndex = this.getZIndexAboveNavBar(10004);
                    polygon.style.setProperty('display', 'block', 'important');
                    polygon.style.setProperty('visibility', 'visible', 'important');
                    polygon.style.setProperty('opacity', '1', 'important');
                    polygon.style.setProperty('z-index', `${polygonZIndex}`, 'important');
                }
            }
        }

        attachExistingButtonListeners() {
            // This method is called to ensure existing buttons in the page are properly connected
            // The bindEvents method already handles this with document.querySelector('#lumi-assistant-btn')
            // This method is here for future extensibility if needed
            this.debugLog('Attaching existing button listeners');
        }
        toggleChat() {
            // On mobile, if cookie banner is active, set user override and restore windows' pointer-events
            // This ensures button clicks work even when cookie banner has hidden the windows
            const isMobile = window.innerWidth <= 768;
            if (isMobile && this.isCookieBannerActive(this.findCookieBanner(), this.findCookieOverlay())) {
                this.cookieBannerUserOverride = true;
                if (typeof this.restoreWindowsForUserOverride === 'function') {
                    this.restoreWindowsForUserOverride();
                }
                this.debugLog('Cookie banner active on mobile - user override set and windows restored for button click');
            }
            
            // Check if there's an active chat session with messages
            const hasActiveChat = this.messages && this.messages.length > 0;
            this.debugLog('Has active chat:', hasActiveChat, 'messages count:', this.messages ? this.messages.length : 'messages is null');
            
            // Check if chat window is currently displayed (if there are messages, check chat window first)
            if (hasActiveChat) {
                const chatWindow = this.container.querySelector('.lumi-chat-window');
                if (chatWindow) {
                    const computedStyle = window.getComputedStyle(chatWindow);
                    const rect = chatWindow.getBoundingClientRect();
                    const isChatVisible = computedStyle.display !== 'none' && 
                                            computedStyle.visibility !== 'hidden' && 
                                            parseFloat(computedStyle.opacity) > 0 &&
                                            rect.width > 0 && rect.height > 0;
                    this.debugLog('Chat window found, isVisible:', isChatVisible, 'display:', computedStyle.display, 'visibility:', computedStyle.visibility, 'opacity:', computedStyle.opacity);
                    
                    if (isChatVisible) {
                        // Chat window is visible - close it
                        this.debugLog('Chat window is visible - closing it');
                        this.closeChat(false);
                        return;
                    } else {
                        // Chat window exists but is hidden - show it
                        this.debugLog('Chat window is hidden - showing it');
                        
                        // User explicitly clicked avatar button to show chat - clear the explicitly closed flag
                        this.setChatWindowExplicitlyClosed(false);
                        
                        // Check if dropdown menu is expanded - if so, show window normally
                        // The z-index will be lowered automatically by the menu observer
                        const dropdownMenu = document.querySelector('.dropdown-menus');
                        const isMenuExpanded = dropdownMenu && dropdownMenu.classList.contains('show');
                        
                        // Also check computed style to see if menu is actually visible
                        let isMenuActuallyVisible = false;
                        if (dropdownMenu) {
                            const menuStyle = window.getComputedStyle(dropdownMenu);
                            const menuRect = dropdownMenu.getBoundingClientRect();
                            isMenuActuallyVisible = menuStyle.display !== 'none' && 
                                                    menuStyle.visibility !== 'hidden' &&
                                                    parseFloat(menuStyle.opacity) > 0 &&
                                                    menuRect.width > 0 && 
                                                    menuRect.height > 0;
                        }
                        
                        this.debugLog('Checking dropdown menu state - dropdownMenu found:', !!dropdownMenu, 
                                    'hasShowClass:', dropdownMenu ? dropdownMenu.classList.contains('show') : false,
                                    'isMenuExpanded:', isMenuExpanded,
                                    'isMenuActuallyVisible:', isMenuActuallyVisible,
                                    'classes:', dropdownMenu ? dropdownMenu.className : 'N/A');
                        
                        // Show chat window normally - if menu is open, the menu observer will automatically
                        // lower the z-index to put it behind the menu
                        
                        // Hide landing window
                        const desktopLw = this.container.querySelector('#lumi-landing-window-desktop') || document.querySelector('#lumi-landing-window-desktop');
                        const mobileLw = this.container.querySelector('#lumi-landing-window') || document.querySelector('#lumi-landing-window');
                        if (desktopLw) desktopLw.style.setProperty('display', 'none', 'important');
                        if (mobileLw) mobileLw.style.setProperty('display', 'none', 'important');
                        
                        this.container.classList.add('chat-active');
                        this.isOpen = true;
                        this.container.classList.add('open');
                        if (this.backdrop) {
                            this.backdrop.style.display = 'block';
                        }
                        
                        // Position and show chat window and polygon together
                        if (!isMobile) {
                            // Desktop: use showChatWindowWithPolygonDesktop to ensure both are positioned correctly
                            this.showChatWindowWithPolygonDesktop();
                        } else {
                            // Mobile: show chat window and position polygon
                            // Get z-index that's above nav bar
                            const chatZIndex = this.getZIndexAboveNavBar(10001);
                            chatWindow.style.setProperty('display', 'flex', 'important');
                            chatWindow.style.setProperty('visibility', 'visible', 'important');
                            chatWindow.style.setProperty('opacity', '1', 'important');
                            chatWindow.style.setProperty('z-index', `${chatZIndex}`, 'important');
                            
                            const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                            if (polygon) {
                                // Get z-index that's above nav bar (above chat window)
                                const polygonZIndex = this.getZIndexAboveNavBar(10002);
                                polygon.style.setProperty('display', 'block', 'important');
                                polygon.style.setProperty('z-index', `${polygonZIndex}`, 'important');
                            }
                            
                            // Update positioning for mobile
                            this.updatePopupPosition();
                            
                            // Check for overlap with safetyInfo panel and scroll if needed
                            // Use setTimeout to ensure positioning is complete before checking overlap
                            setTimeout(() => {
                                this.handleMobileChatWindowOverlap(chatWindow);
                            }, 100);
                        }
                        
                        this.restoreMessagesToDOM();
                        
                        setTimeout(() => {
                            this.switchMode('text');
                        }, 50);
                        
                        // Re-enable main button clicks
                        const mainButton = document.querySelector('#lumi-assistant-btn');
                        if (mainButton) {
                            mainButton.style.pointerEvents = 'auto';
                        }
                        
                        return;
                    }
                }
            }
            
            // Check if landing window is currently displayed
            // On desktop, use desktop landing window; on mobile, use mobile landing window
            let landingWindow;
            if (isMobile) {
                landingWindow = this.container.querySelector('#lumi-landing-window') || document.querySelector('#lumi-landing-window');
            } else {
                landingWindow = this.container.querySelector('#lumi-landing-window-desktop') || document.querySelector('#lumi-landing-window-desktop');
            }
            this.debugLog('Landing window found:', !!landingWindow, 'isMobile:', isMobile);
            if (landingWindow) {
                const computedStyle = window.getComputedStyle(landingWindow);
                const rect = landingWindow.getBoundingClientRect();
                const isActuallyVisible = computedStyle.display !== 'none' && 
                                            computedStyle.visibility !== 'hidden' && 
                                            parseFloat(computedStyle.opacity) > 0 &&
                                            rect.width > 0 && rect.height > 0;
                this.debugLog('Landing window computed style - display:', computedStyle.display, 'visibility:', computedStyle.visibility, 'opacity:', computedStyle.opacity, 'rect:', rect, 'isActuallyVisible:', isActuallyVisible);
                if (computedStyle.display === 'flex' && isActuallyVisible) {
                    // If it's open, ensure it's actually visible; if not, reposition and force show
                    const rect = landingWindow.getBoundingClientRect();
                    const vw = window.innerWidth;
                    const vh = window.innerHeight;
                    const isVisible = rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < vw && rect.top < vh;
                    if (!isVisible) {
                        this.debugLog('Landing window open but not visible; repositioning and forcing visible');
                        const repositionLandingWindow = (attempt = 0) => {
                            const btn = document.querySelector('#lumi-assistant-btn');
                            const btnRect = btn ? btn.getBoundingClientRect() : null;
                            const avatar = btn ? btn.querySelector('.lumi-avatar') : null;
                            const avatarRect = avatar ? avatar.getBoundingClientRect() : null;
                            
                            const canMeasureButton = btnRect && btnRect.width > 0 && btnRect.height > 0;
                            const canMeasureAvatar = avatarRect && avatarRect.width > 0 && avatarRect.height > 0;
                            
                            if (!canMeasureButton || !canMeasureAvatar) {
                                if (attempt < 10) {
                                    console.warn('Avatar button not measurable yet (attempt', attempt + 1, '), retrying...');
                                    requestAnimationFrame(() => {
                                        setTimeout(() => repositionLandingWindow(attempt + 1), 50);
                                    });
                                } else {
                                    console.error('Unable to measure avatar button after 10 attempts; hiding landing/chat windows and polygon.');
                                    
                                    // Hide landing window since we cannot safely position it
                                    landingWindow.style.setProperty('display', 'none', 'important');
                                    landingWindow.style.setProperty('visibility', 'hidden', 'important');
                                    landingWindow.style.setProperty('opacity', '0', 'important');
                                    landingWindow.style.setProperty('pointer-events', 'none', 'important');
                                    
                                    // Hide polygon
                                    const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                                    if (polygon) {
                                        polygon.style.setProperty('display', 'none', 'important');
                                        polygon.style.setProperty('visibility', 'hidden', 'important');
                                        polygon.style.setProperty('opacity', '0', 'important');
                                    }
                                    
                                    // Hide chat window as well (per requirement: do not show chat window if avatar cannot be measured)
                                    const chatWindow = this.container.querySelector('.lumi-chat-window');
                                    if (chatWindow) {
                                        chatWindow.style.setProperty('display', 'none', 'important');
                                        chatWindow.style.setProperty('visibility', 'hidden', 'important');
                                        chatWindow.style.setProperty('opacity', '0', 'important');
                                    }
                                    
                                    // Reset widget open state so UI reflects hidden state
                                    this.isOpen = false;
                                    this.container.classList.remove('open');
                                    this.container.classList.remove('chat-active');
                                    this.unlockBodyScroll('avatar measurement failure');
                                }
                                return;
                            }
                            
                            const topPx = Math.max(0, Math.round(btnRect.bottom + 4));
                            const rightPx = Math.max(10, Math.round(vw - btnRect.right));
                            
                            landingWindow.style.setProperty('position', 'fixed', 'important');
                            landingWindow.style.setProperty('top', `${topPx}px`, 'important');
                            landingWindow.style.setProperty('right', `${rightPx}px`, 'important');
                            landingWindow.style.setProperty('left', 'auto', 'important');
                            landingWindow.style.setProperty('display', 'flex', 'important');
                            landingWindow.style.setProperty('visibility', 'visible', 'important');
                            landingWindow.style.setProperty('opacity', '1', 'important');
                            landingWindow.style.setProperty('z-index', '100000', 'important');
                            this.isManuallyPositioned = true;
                            
                            const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                            if (polygon) {
                                const polygonWidth = 14;
                                const centerX = avatarRect.left + (avatarRect.width / 2);
                                const polyLeft = Math.max(0, Math.round(centerX - polygonWidth / 2));
                                polygon.style.setProperty('position', 'fixed', 'important');
                                polygon.style.setProperty('top', `${Math.max(0, topPx - 8)}px`, 'important');
                                polygon.style.setProperty('left', `${polyLeft}px`, 'important');
                                polygon.style.setProperty('right', 'auto', 'important'); // Remove right positioning
                                polygon.style.setProperty('display', 'block', 'important');
                                polygon.style.setProperty('z-index', '10002', 'important');
                            }

                            requestAnimationFrame(() => {
                                if (typeof this.lowerZIndexForMenu === 'function' && this.isDropdownExpanded()) {
                                    this.lowerZIndexForMenu();
                                }
                            });
                            
                            // Bind events after repositioning
                            setTimeout(() => this.bindLandingWindowEvents(), 100);
                        };
                        
                        repositionLandingWindow();
                    } else {
                        this.debugLog('Landing window visible; closing on avatar click');
                        this.closeChat(false);
                    }
                    return;
                }
            }
            
            // Check if landing window exists but is hidden (user clicked "Try later" or close button)
            // Need to check computed style to see actual display state
            let isLandingWindowHidden = false;
            if (landingWindow) {
                const computedStyle = window.getComputedStyle(landingWindow);
                isLandingWindowHidden = computedStyle.display === 'none' || 
                                        computedStyle.visibility === 'hidden' ||
                                        parseFloat(computedStyle.opacity) === 0;
                this.debugLog('Checking if landing window is hidden - display:', computedStyle.display, 'visibility:', computedStyle.visibility, 'opacity:', computedStyle.opacity, 'isHidden:', isLandingWindowHidden);
            } else {
                this.debugLog('Landing window not found, will call openChat() to show it');
            }
            // If landing window is hidden or doesn't exist, determine what to show
            // When user clicks avatar button, always show landing window (even if it was dismissed)
            // Dismissal only prevents auto-show on page load, not manual opening via button
            this.debugLog('Checking condition: !landingWindow=', !landingWindow, 'isLandingWindowHidden=', isLandingWindowHidden, 'will enter block:', (!landingWindow || isLandingWindowHidden));
            if (!landingWindow || isLandingWindowHidden) {
                const isMobile = window.innerWidth <= 768;
                
                // Check if there are existing messages - if so, show chat window directly (both mobile and desktop)
                if (hasActiveChat) {
                    // There's an active chat session, go directly to chat window
                    this.debugLog('Active chat session detected - showing chat window directly');
                    const chatWindow = this.container.querySelector('.lumi-chat-window');
                    const polygon = this.container.querySelector('.lumi-chat-polygon');
                    
                    if (chatWindow) {
                        chatWindow.style.setProperty('display', 'flex', 'important');
                        this.debugLog('Chat window displayed, restoring messages...');
                        
                        
                        // Ensure landing window is hidden when chat is shown
                        const desktopLw = this.container.querySelector('#lumi-landing-window-desktop') || document.querySelector('#lumi-landing-window-desktop');
                        const mobileLw = this.container.querySelector('#lumi-landing-window') || document.querySelector('#lumi-landing-window');
                        if (desktopLw) desktopLw.style.setProperty('display', 'none', 'important');
                        if (mobileLw) mobileLw.style.setProperty('display', 'none', 'important');
                        // Mark chat as active to hide landing window via CSS
                        this.container.classList.add('chat-active');
                        // Restore messages to the DOM if they exist
                        this.restoreMessagesToDOM();
                        
                        // Use setTimeout to ensure DOM is ready before switching modes
                        setTimeout(() => {
                            this.debugLog('Switching to text mode...');
                            // Switch to text mode since we have messages
                            this.switchMode('text');
                            this.debugLog('Mode switched to text');
                        }, 50);
                    }
                    
                    if (polygon) {
                        polygon.style.setProperty('display', 'block', 'important');
                    }
                    
                    // Set isOpen to true since we're showing the chat window
                    this.isOpen = true;
                    this.debugLog('Chat session reopened with history');
                    return;
                } else {
                    // No active chat - ALWAYS show landing window when avatar button is clicked
                    // (dismissed flag only prevents auto-show on page load, not manual opening)
                    // Use the same logic as button handlers - just show it directly
                    this.debugLog(isMobile ? 'Mobile' : 'Desktop', ': No active chat - showing landing window (avatar button clicked)');
                    this.debugLog('About to call openChat() to show landing window');
                    
                    // Remove dismissed class first so openChat() can show it
                    let landingWindow;
                    if (isMobile) {
                        landingWindow = this.container.querySelector('#lumi-landing-window') || document.querySelector('#lumi-landing-window');
                    } else {
                        landingWindow = this.container.querySelector('#lumi-landing-window-desktop') || document.querySelector('#lumi-landing-window-desktop');
                    }
                    
                    if (landingWindow) {
                        // Remove dismissed class so CSS rules don't prevent showing it
                        landingWindow.classList.remove('lumi-landing-dismissed');
                        this.debugLog('Removed dismissed class from landing window, landingWindow:', landingWindow);
                    } else {
                        this.debugLog('ERROR: Landing window not found when trying to show it!');
                    }
                    
                    // Use openChat to show landing window properly - it handles all the setup
                    this.debugLog('Calling openChat() now...');
                    this.openChat();
                    this.debugLog('openChat() call completed');
                    return;
                }
            }
            
            // Fallback: if landing window was not found or not hidden, just toggle open/close
            this.debugLog('Fallback: toggling open/close state. isOpen:', this.isOpen);
            if (this.isOpen) {
                this.closeChat();
            } else {
                this.openChat();
            }
        }


        updatePopupPosition() {
            if (this.isManuallyPositioned) {
                return;
            }
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                this.updatePopupPositionMobile();
            } else {
                this.updatePopupPositionDesktop();
            }
        }
        updatePopupPositionDesktop(attempt = 0) {
            const button = document.querySelector('#lumi-assistant-btn');
            
            if (!button) {
                console.error('Button not found in updatePopupPositionDesktop');
                return;
            }
            
            // Force layout recalculation
            void button.offsetHeight;
            void button.offsetWidth;
            
            // Get actual rendered dimensions and positions
            const buttonRect = button.getBoundingClientRect();
            
            // Wait for button to be rendered - if button has no dimensions, retry
            if (buttonRect.width === 0 || buttonRect.height === 0) {
                if (attempt < 50) {
                    if (attempt % 5 === 0) {
                        this.debugLog(`updatePopupPositionDesktop: Waiting for button to render, attempt ${attempt + 1}`);
                    }
                    requestAnimationFrame(() => {
                        setTimeout(() => this.updatePopupPositionDesktop(attempt + 1), 20);
                    });
                    return;
                } else {
                    console.warn('Button not rendered after 50 attempts in updatePopupPositionDesktop - skipping position update');
                    return;
                }
            }
            
            // Validate button position is reasonable (not at 0,0 or negative values that indicate it's not positioned yet)
            // On Edge, sometimes button position is calculated before layout is complete
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            // More lenient validation - just check that button has reasonable coordinates
            // Allow for buttons that might be slightly off-screen or at edge of viewport
            const isButtonPositionValid = buttonRect.right > -100 && // Allow some negative margin
                                        buttonRect.bottom > -100 &&
                                        buttonRect.left < viewportWidth + 200 && // Allow margin for off-screen buttons
                                        buttonRect.top < viewportHeight + 200 &&
                                        !(buttonRect.left === 0 && buttonRect.top === 0 && buttonRect.width > 0); // Not at origin with dimensions
            
            if (!isButtonPositionValid && attempt < 10) {
                // Button position seems invalid - retry after a longer delay (Edge may need more time)
                if (attempt % 3 === 0) {
                    this.debugLog(`updatePopupPositionDesktop: Button position invalid, retrying (attempt ${attempt + 1}):`, {
                        buttonRect: { left: buttonRect.left, top: buttonRect.top, right: buttonRect.right, bottom: buttonRect.bottom },
                        viewport: { width: viewportWidth, height: viewportHeight }
                    });
                }
                requestAnimationFrame(() => {
                    setTimeout(() => this.updatePopupPositionDesktop(attempt + 1), 50); // Longer delay for Edge
                });
                return;
            }
            
            const { avatarBottom, avatarCenterX } = this.getAssistantButtonLayoutMetrics(button, buttonRect);
            const actualButtonHeight = buttonRect.height;
            const LANDING_POLYGON_SVG_HEIGHT = 12;
            const DESKTOP_LANDING_GAP_BELOW_POLYGON = 3;

            const polygonWidth = 14;
            const polygonLeft = Math.max(0, Math.round(avatarCenterX - polygonWidth / 2));
            const polygonTop = this.getChatPolygonFixedTopY(avatarBottom);

            const buttonRight = Math.max(0, Math.round(viewportWidth - buttonRect.right));
            const windowRightOffset = buttonRight;
            const landingWindowWidth = 335; // Desktop landing window width
            const windowLeft = Math.max(0, Math.round(buttonRect.right - landingWindowWidth));
            const windowTop = Math.round(polygonTop + LANDING_POLYGON_SVG_HEIGHT + DESKTOP_LANDING_GAP_BELOW_POLYGON);
            
            // Validate calculated positions are reasonable before applying
            if (polygonTop < -100 || polygonLeft < -100 || windowTop < -100 || windowRightOffset < -100 || 
                polygonTop > window.innerHeight + 1000 || polygonLeft > viewportWidth + 1000 || 
                windowTop > window.innerHeight + 1000 || windowRightOffset > viewportWidth + 1000) {
                console.error('Invalid calculated positions in updatePopupPositionDesktop, skipping update:', {
                    polygonTop,
                    polygonLeft,
                    windowTop,
                    windowRightOffset,
                    buttonRect: { top: buttonRect.top, left: buttonRect.left, width: buttonRect.width, height: buttonRect.height, bottom: buttonRect.bottom, right: buttonRect.right },
                    avatarCenterX,
                    viewportWidth,
                    viewportHeight: window.innerHeight
                });
                return;
            }
            
            // Update CSS variables with actual dimensions and position (for backward compatibility)
            const root = document.documentElement;
            root.style.setProperty('--widget-button-height', `${actualButtonHeight}px`);
            root.style.setProperty('--widget-polygon-top', `${polygonTop}px`);
            root.style.setProperty('--widget-polygon-left', `${polygonLeft}px`);
            root.style.setProperty('--widget-window-top', `${windowTop}px`);
            root.style.setProperty('--widget-window-right', `${windowRightOffset}px`);
            root.style.setProperty('--widget-window-left', `${windowLeft}px`);
            
            // Get elements
            const landingWindow = this.container.querySelector('#lumi-landing-window-desktop') || document.querySelector('#lumi-landing-window-desktop');
            const chatWindow = this.container.querySelector('.lumi-chat-window');
            const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
            
            // Update positions for visible elements using fixed positioning with viewport coordinates
            // Check if landing window is visible
            if (landingWindow) {
                const landingStyles = window.getComputedStyle(landingWindow);
                const isLandingVisible = !landingWindow.classList.contains('lumi-landing-dismissed') &&
                                        landingStyles.display !== 'none' && 
                                        landingStyles.visibility !== 'hidden' && 
                                        parseFloat(landingStyles.opacity) > 0;
                
                if (isLandingVisible) {
                    landingWindow.style.setProperty('position', 'fixed', 'important');
                    landingWindow.style.setProperty('top', `${windowTop}px`, 'important');
                    landingWindow.style.setProperty('right', `${windowRightOffset}px`, 'important');
                    landingWindow.style.setProperty('left', `${windowLeft}px`, 'important');
                }
            }
            
            // Check if chat window is visible
            if (chatWindow) {
                const chatStyles = window.getComputedStyle(chatWindow);
                const isChatVisible = chatStyles.display !== 'none' && 
                                    chatStyles.visibility !== 'hidden' && 
                                    parseFloat(chatStyles.opacity) > 0;
                
                if (isChatVisible) {
                    chatWindow.style.setProperty('position', 'fixed', 'important');
                    chatWindow.style.setProperty('top', `${windowTop}px`, 'important');
                    chatWindow.style.setProperty('right', `${windowRightOffset}px`, 'important');
                    chatWindow.style.setProperty('left', 'auto', 'important');
                }
            }
            
            // Check if polygon is visible (should be visible if landing or chat window is visible)
            if (polygon) {
                const polygonStyles = window.getComputedStyle(polygon);
                const isPolygonVisible = polygonStyles.display !== 'none' && 
                                        polygonStyles.visibility !== 'hidden' && 
                                        parseFloat(polygonStyles.opacity) > 0;
                
                // Check if landing or chat window is visible
                const isLandingVisible = landingWindow && !landingWindow.classList.contains('lumi-landing-dismissed') &&
                                        window.getComputedStyle(landingWindow).display !== 'none';
                const isChatVisible = chatWindow && window.getComputedStyle(chatWindow).display !== 'none';
                const widgetIsOpen = this.container.classList.contains('open') || this.isOpen;
                
                if (isPolygonVisible || isLandingVisible || isChatVisible || widgetIsOpen) {
                    polygon.style.setProperty('position', 'fixed', 'important');
                    polygon.style.setProperty('top', `${polygonTop}px`, 'important');
                    polygon.style.setProperty('left', `${polygonLeft}px`, 'important');
                    polygon.style.setProperty('right', 'auto', 'important'); // Remove right positioning to avoid conflicts
                    
                    // Ensure polygon is visible if landing or chat window is visible
                    if (isLandingVisible || isChatVisible) {
                        polygon.style.setProperty('display', 'block', 'important');
                        polygon.style.setProperty('visibility', 'visible', 'important');
                        polygon.style.setProperty('opacity', '1', 'important');
                        polygon.style.setProperty('z-index', isLandingVisible ? '10004' : '10002', 'important');
                    }
                }
            }
            
            this.debugLog('Desktop: Positions updated with dynamic viewport coordinates:', {
                polygonTop,
                polygonLeft,
                windowTop,
                windowLeft,
                windowRightOffset,
                buttonRect: { top: buttonRect.top, left: buttonRect.left, width: buttonRect.width, height: buttonRect.height, bottom: buttonRect.bottom, right: buttonRect.right },
                avatarCenterX,
                viewportWidth,
                viewportHeight: window.innerHeight
            });
        }

        handleMobileChatWindowOverlap(chatWindow) {
            // Only handle on mobile
            if (window.innerWidth > 768) {
                return;
            }

            if (!chatWindow) {
                return;
            }

            // Find safetyInfo panel
            const safetyInfo = this.findSafetyInfo();
            if (!safetyInfo) {
                return;
            }

            // Check if safetyInfo is visible/expanded
            const safetyInfoStyles = window.getComputedStyle(safetyInfo);
            const safetyInfoRect = safetyInfo.getBoundingClientRect();
            const isSafetyInfoVisible = safetyInfoStyles.display !== 'none' && 
                                        safetyInfoStyles.visibility !== 'hidden' && 
                                        parseFloat(safetyInfoStyles.opacity) > 0 &&
                                        safetyInfoRect.width > 0 && 
                                        safetyInfoRect.height > 0;

            if (!isSafetyInfoVisible) {
                return;
            }

            // Get chat window position
            const chatWindowRect = chatWindow.getBoundingClientRect();
            
            // Calculate overlap: check if chat window bottom overlaps with safetyInfo top
            // Only calculate overlap if chat window bottom is below safetyInfo top
            // This handles cases where chat window might be partially or fully above viewport
            let overlap = 0;
            
            // If chat window bottom is below safetyInfo top, there's overlap
            if (chatWindowRect.bottom > safetyInfoRect.top) {
                // Overlap is the amount by which chat window bottom extends below safetyInfo top
                overlap = chatWindowRect.bottom - safetyInfoRect.top;
            }
            
            // Only scroll if there's actual overlap
            if (overlap > 0) {
                // Scroll page up by the overlap amount
                const currentScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
                const newScrollY = currentScrollY + overlap;
                
                this.debugLog('Mobile chat window overlaps safetyInfo panel:', {
                    overlap,
                    currentScrollY,
                    newScrollY,
                    safetyInfoRect: { top: safetyInfoRect.top, bottom: safetyInfoRect.bottom, height: safetyInfoRect.height },
                    chatWindowRect: { top: chatWindowRect.top, bottom: chatWindowRect.bottom, height: chatWindowRect.height }
                });
                
                // Scroll smoothly to the new position
                window.scrollTo({
                    top: newScrollY,
                    behavior: 'smooth'
                });
            }
        }
        updatePopupPositionMobile(attempt = 0) {
            const allButtons = document.querySelectorAll('#lumi-assistant-btn');
            if (allButtons.length > 1) {
                this.debugLog('Warning: Multiple #lumi-assistant-btn elements found, AEM may have duplicated the button');
            }
            
            // Find the visible button - check all buttons to find one with actual dimensions
            let button = allButtons[0];
            for (let i = 0; i < allButtons.length; i++) {
                const testBtn = allButtons[i];
                const testRect = testBtn.getBoundingClientRect();
                if (testRect.width > 0 && testRect.height > 0) {
                    button = testBtn;
                    this.debugLog(`Found visible button at index ${i}, rect:`, testRect);
                    break;
                }
            }
            
            const widgetContainer = this.container;
            if (!button || !widgetContainer) {
                console.error('Button or widget container not found in updatePopupPositionMobile');
                console.error('All #lumi-assistant-btn elements:', allButtons);
                return;
            }
            
            // Force layout recalculation by accessing offset properties
            // This ensures getBoundingClientRect() returns accurate values
            void button.offsetHeight;
            void button.offsetWidth;
            
            const buttonRect = button.getBoundingClientRect();
            
            // CRITICAL: Wait for button to be rendered - if button has no dimensions, retry
            // If button never renders, DO NOT show polygon or landing window - just return
            if (buttonRect.width === 0 || buttonRect.height === 0) {
                if (attempt < 50) {
                    if (attempt % 5 === 0) {
                        this.debugLog(`Waiting for button to render, attempt ${attempt + 1}`);
                    }
                    requestAnimationFrame(() => {
                        setTimeout(() => this.updatePopupPositionMobile(attempt + 1), 20);
                    });
                    return;
                } else {
                    console.warn('Button still not rendered after 50 attempts - NOT showing polygon or landing window');
                    // Ensure landing window and polygon are hidden if button doesn't render
                    const landingWindow = this.container.querySelector('#lumi-landing-window') || document.querySelector('#lumi-landing-window');
                    const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
                    if (landingWindow) {
                        landingWindow.style.setProperty('display', 'none', 'important');
                        landingWindow.style.setProperty('visibility', 'hidden', 'important');
                        landingWindow.style.setProperty('opacity', '0', 'important');
                    }
                    if (polygon) {
                        polygon.style.setProperty('display', 'none', 'important');
                        polygon.style.setProperty('visibility', 'hidden', 'important');
                        polygon.style.setProperty('opacity', '0', 'important');
                    }
                    return; // Exit early - don't show anything
                }
            }
            
            // Button is ready - calculate positions directly from button's current position
            const buttonRight = window.innerWidth - buttonRect.right;
            const { avatarBottom, avatarCenterX } = this.getAssistantButtonLayoutMetrics(button, buttonRect);
            const LANDING_POLYGON_SVG_HEIGHT = 12;
            const MOBILE_LANDING_GAP_BELOW_POLYGON = 5;

            const polygonWidth = 14;
            const polygonLeft = Math.max(0, Math.round(avatarCenterX - polygonWidth / 2));
            const polygonTop = this.getChatPolygonFixedTopY(avatarBottom);

            const viewportWidth = window.innerWidth;
            let windowRightOffset = Math.max(0, buttonRight);
            if (buttonRect.right > viewportWidth) {
                const buttonVisibleRight = Math.min(buttonRect.right, viewportWidth);
                windowRightOffset = Math.max(10, viewportWidth - buttonVisibleRight);
            }
            windowRightOffset = Math.round(windowRightOffset);
            const windowTop = Math.round(polygonTop + LANDING_POLYGON_SVG_HEIGHT + MOBILE_LANDING_GAP_BELOW_POLYGON);
            
            // Center in viewport for phones (<768). At 768px use avatar-based `right` (tablet portrait).
            let landingWindowRightOffset = windowRightOffset;
            let chatWindowRightOffset = windowRightOffset;
            if (viewportWidth < 768) {
                const landingWindowWidth = 335;
                landingWindowRightOffset = this.getMobileCenteredFixedRightOffset(viewportWidth, landingWindowWidth);
                this.debugLog('Mobile centering - Landing window (viewport < 768px):', {
                    viewportWidth,
                    landingWindowWidth,
                    landingWindowRightOffset
                });
            }
            
            // Set CSS variables for backward compatibility (but we'll use direct values for mobile)
            // Note: landingWindowRightOffset and chatWindowRightOffset will be calculated after we get the elements
            const root = document.documentElement;
            root.style.setProperty('--widget-button-height', `${buttonRect.height}px`);
            root.style.setProperty('--widget-polygon-top', `${polygonTop}px`);
            root.style.setProperty('--widget-polygon-left', `${polygonLeft}px`);
            root.style.setProperty('--widget-window-top', `${windowTop}px`);
            root.style.setProperty('--widget-window-right', `${landingWindowRightOffset}px`);
            
            // On mobile, apply positions directly to polygon and landing window (ignore CSS variables)
            // CRITICAL: Check for and remove duplicates FIRST before doing anything else
            const allLandingWindows = document.querySelectorAll('#lumi-landing-window');
            if (allLandingWindows.length > 1) {
                console.warn('Multiple landing windows found! Removing duplicates:', allLandingWindows.length);
                // Keep only the first one, remove all others
                for (let i = 1; i < allLandingWindows.length; i++) {
                    console.warn(`Removing duplicate landing window #${i + 1}`);
                    allLandingWindows[i].remove();
                }
            }
            // Get the single landing window (should be only one now)
            const landingWindow = document.querySelector('#lumi-landing-window');
            const chatWindow = this.container.querySelector('.lumi-chat-window');
            const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
            
            // Calculate chat window right offset for centering on phone-width viewports only
            if (viewportWidth < 768 && chatWindow) {
                // Get the actual rendered width, or calculate expected width based on CSS rules
                // Mobile chat window width is: min(385px, 92vw)
                const chatWindowRect = chatWindow.getBoundingClientRect();
                let chatWindowComputedWidth = chatWindowRect.width;
                
                // If width is 0 or not available, calculate expected width from CSS
                if (!chatWindowComputedWidth || chatWindowComputedWidth === 0) {
                    const computedStyle = window.getComputedStyle(chatWindow);
                    chatWindowComputedWidth = parseFloat(computedStyle.width);
                    
                    // If still not available, calculate based on CSS rule: min(385px, 92vw)
                    if (!chatWindowComputedWidth || chatWindowComputedWidth === 0) {
                        const vwWidth = viewportWidth * 0.92;
                        chatWindowComputedWidth = Math.min(385, vwWidth);
                    }
                }
                
                chatWindowRightOffset = this.getMobileCenteredFixedRightOffset(viewportWidth, chatWindowComputedWidth);
                this.debugLog('Mobile centering (viewport < 768px):', {
                    viewportWidth,
                    chatWindowWidth: chatWindowComputedWidth,
                    chatWindowRightOffset
                });
            } else {
                chatWindowRightOffset = windowRightOffset;
            }
            
            // Clear left property (only clear left, keep top/right for fixed positioning)
            [landingWindow, chatWindow, polygon].forEach(el => {
                if (!el) return;
                el.style.removeProperty('left');
            });
            
            // Apply positions directly to landing window and chat window on mobile
            // ALWAYS update positions unconditionally (like chatWindow) for smooth scrolling
            // Visibility/show/hide logic is handled separately below
            if (landingWindow) {
                // Always update position if landing window exists (like chatWindow does)
                // This ensures smooth scrolling with the avatar button
                landingWindow.style.setProperty('position', 'fixed', 'important');
                landingWindow.style.setProperty('top', `${windowTop}px`, 'important');
                landingWindow.style.setProperty('left', 'auto', 'important');
                landingWindow.style.setProperty('right', `${landingWindowRightOffset}px`, 'important');
                
                // Now handle visibility - only show/hide, don't control positioning
                const landingStyles = window.getComputedStyle(landingWindow);
                const hasDismissedClass = landingWindow.classList.contains('lumi-landing-dismissed');
                const isAlreadyVisible = !hasDismissedClass &&
                                        landingStyles.display !== 'none' && 
                                        landingStyles.visibility !== 'hidden' && 
                                        parseFloat(landingStyles.opacity) > 0;
                
                // Check if widget is open (which means landing window should be visible or was just visible)
                const widgetIsOpen = this.container.classList.contains('open') || this.isOpen;
                const hasChatActive = this.container.classList.contains('chat-active');
                
                // If widget is open but landing window appears hidden, make sure it's visible
                // (this can happen during scroll updates when visibility check temporarily fails)
                if (widgetIsOpen && !isAlreadyVisible && !hasDismissedClass && !hasChatActive) {
                    // Get z-index that's above nav bar
                    const landingZIndex = this.getZIndexAboveNavBar(10003);
                    landingWindow.style.setProperty('display', 'flex', 'important');
                    landingWindow.style.setProperty('visibility', 'visible', 'important');
                    landingWindow.style.setProperty('opacity', '1', 'important');
                    landingWindow.style.setProperty('z-index', `${landingZIndex}`, 'important');
                } else if (hasDismissedClass || hasChatActive) {
                    // Ensure it stays hidden if it's dismissed or chat is active
                    landingWindow.style.setProperty('display', 'none', 'important');
                    landingWindow.style.setProperty('visibility', 'hidden', 'important');
                    landingWindow.style.setProperty('opacity', '0', 'important');
                }
            }
            
            if (chatWindow) {
                chatWindow.style.setProperty('position', 'fixed', 'important');
                chatWindow.style.setProperty('top', `${windowTop}px`, 'important');
                chatWindow.style.setProperty('right', `${chatWindowRightOffset}px`, 'important');
                chatWindow.style.setProperty('left', 'auto', 'important');
                if (viewportWidth < 768) {
                    this.debugLog('Mobile chat window positioned (centered):', {
                        viewportWidth,
                        right: chatWindowRightOffset,
                        top: windowTop
                    });
                }
            }
            
            // Apply positions directly to polygon on mobile
            // ONLY show polygon if button is rendered (we're past the check above)
            if (polygon && buttonRect.width > 0 && buttonRect.height > 0) {
                // Check if landing window is actually visible
                let isLandingVisible = false;
                if (landingWindow) {
                    const landingStyles = window.getComputedStyle(landingWindow);
                    const landingRect = landingWindow.getBoundingClientRect();
                    const hasDismissedClass = landingWindow.classList.contains('lumi-landing-dismissed');
                    isLandingVisible = !hasDismissedClass && 
                                        landingStyles.display !== 'none' && 
                                        landingStyles.visibility !== 'hidden' && 
                                        parseFloat(landingStyles.opacity) > 0 &&
                                        landingRect.width > 0 && 
                                        landingRect.height > 0;
                }
                
                // Check if chat window is visible
                let isChatVisible = false;
                if (chatWindow) {
                    const chatStyles = window.getComputedStyle(chatWindow);
                    const chatRect = chatWindow.getBoundingClientRect();
                    isChatVisible = chatStyles.display !== 'none' && 
                                    chatStyles.visibility !== 'hidden' && 
                                    parseFloat(chatStyles.opacity) > 0 &&
                                    chatRect.width > 0 && 
                                    chatRect.height > 0;
                }
                
                // Show polygon if landing window OR chat window is visible OR widget is open
                const widgetIsOpen = this.container.classList.contains('open') || this.isOpen || this.container.classList.contains('chat-active');
                const shouldShowPolygon = isLandingVisible || isChatVisible || widgetIsOpen;
                
                // Only show polygon if button is rendered and conditions are met
                if (shouldShowPolygon || widgetIsOpen) {
                    polygon.style.setProperty('display', 'block', 'important');
                    polygon.style.setProperty('visibility', 'visible', 'important');
                    polygon.style.setProperty('opacity', '1', 'important');
                    polygon.style.setProperty('position', 'fixed', 'important');
                    polygon.style.setProperty('top', `${polygonTop}px`, 'important');
                    polygon.style.setProperty('left', `${polygonLeft}px`, 'important');
                    polygon.style.setProperty('right', 'auto', 'important'); // Remove right positioning
                    // If widget is open but landing isn't visible yet (e.g., on initial page load),
                    // assume it will be landing window and use higher z-index
                    const zIndex = (isLandingVisible || (widgetIsOpen && !isChatVisible)) ? '10004' : '10002';
                    polygon.style.setProperty('z-index', zIndex, 'important');
                    
                    this.debugLog('Polygon shown:', {
                        isLandingVisible,
                        isChatVisible,
                        widgetIsOpen,
                        polygonTop,
                        polygonLeft,
                        zIndex
                    });
                } else {
                    // Hide polygon if conditions aren't met
                    polygon.style.setProperty('display', 'none', 'important');
                    polygon.style.setProperty('visibility', 'hidden', 'important');
                    polygon.style.setProperty('opacity', '0', 'important');
                    this.debugLog('Polygon hidden:', { isLandingVisible, isChatVisible, widgetIsOpen });
                }
            } else if (polygon) {
                // Button not rendered - ensure polygon is hidden
                polygon.style.setProperty('display', 'none', 'important');
                polygon.style.setProperty('visibility', 'hidden', 'important');
                polygon.style.setProperty('opacity', '0', 'important');
            }
            

            
            // Verify landing window is actually visible after positioning
            if (landingWindow) {
                // Store values for logging in setTimeout
                const expectedTopValue = windowTop;
                const expectedRightValue = windowRightOffset;
                setTimeout(() => {
                    const rect = landingWindow.getBoundingClientRect();
                    const styles = window.getComputedStyle(landingWindow);
                    const rootStyles = window.getComputedStyle(document.documentElement);
                    const cssVarValue = rootStyles.getPropertyValue('--widget-window-top').trim();
                    
                    // Check for parent transforms that might affect fixed positioning
                    let parent = landingWindow.parentElement;
                    let transformChain = [];
                    while (parent && parent !== document.body) {
                        const parentStyles = window.getComputedStyle(parent);
                        if (parentStyles.transform !== 'none') {
                            transformChain.push({
                                element: parent.className || parent.tagName,
                                transform: parentStyles.transform
                            });
                        }
                        parent = parent.parentElement;
                    }
                    
                    this.debugLog('Mobile: Landing window final state:', {
                        boundingRect: rect,
                        computedDisplay: styles.display,
                        computedVisibility: styles.visibility,
                        computedOpacity: styles.opacity,
                        computedPosition: styles.position,
                        computedTop: styles.top,
                        computedRight: styles.right,
                        computedZIndex: styles.zIndex,
                        cssVariableValue: cssVarValue,
                        expectedTop: expectedTopValue,
                        expectedRight: expectedRightValue,
                        parentTransforms: transformChain.length > 0 ? transformChain : 'none',
                        isVisible: rect.width > 0 && rect.height > 0 && styles.display !== 'none' && styles.visibility !== 'hidden' && parseFloat(styles.opacity) > 0
                    });
                }, 100);
            }
        }
        openChat() {
            this._chatWindowCloseNotifiedAt = 0; // Allow chat-window-close to fire again on next close
            const isMobile = window.innerWidth <= 768;
            if (isMobile && this.isCookieBannerActive(this.findCookieBanner(), this.findCookieOverlay())) {
                this.cookieBannerUserOverride = true;
                this.debugLog('Cookie banner active on mobile - keeping LuMi widget visible due to user interaction');
            }
            this.isOpen = true;
            this.container.classList.add('open');
            this.backdrop.style.display = 'block';
            this.container.classList.remove('chat-active');
            this.isManuallyPositioned = false;
            
            void this.container.offsetHeight;
            
            const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
            
            // Select the appropriate landing window based on screen size
            let landingWindow;
            if (isMobile) {
                // On mobile, ALWAYS use showLandingWindowAndPolygon which waits for button and positions correctly
                // This ensures landing window is never shown before button is rendered
                landingWindow = this.container.querySelector('#lumi-landing-window') || document.querySelector('#lumi-landing-window');
                const desktopLanding = document.querySelector('#lumi-landing-window-desktop');
                if (desktopLanding) {
                    desktopLanding.style.setProperty('display', 'none', 'important');
                    desktopLanding.style.setProperty('visibility', 'hidden', 'important');
                }
                
                // On mobile, use showLandingWindowAndPolygon which waits for button and positions from button
                if (landingWindow) {
                    landingWindow.classList.remove('lumi-landing-dismissed');
                    this.showLandingWindowAndPolygon();
                    return; // showLandingWindowAndPolygon handles everything, so return early
                }
            } else {
                // On desktop, ALWAYS use showLandingWindowAndPolygonDesktop which waits for button and positions correctly
                // This ensures landing window is never shown before button is rendered
                landingWindow = this.container.querySelector('#lumi-landing-window-desktop') || document.querySelector('#lumi-landing-window-desktop');
                const mobileLanding = document.querySelector('#lumi-landing-window');
                if (mobileLanding) {
                    mobileLanding.style.setProperty('display', 'none', 'important');
                    mobileLanding.style.setProperty('visibility', 'hidden', 'important');
                }
                
                // On desktop, use showLandingWindowAndPolygonDesktop which waits for button and positions from button
                if (landingWindow) {
                    landingWindow.classList.remove('lumi-landing-dismissed');
                    this.showLandingWindowAndPolygonDesktop();
                    return; // showLandingWindowAndPolygonDesktop handles everything, so return early
                }
            }
            
            const chatWindow = this.container.querySelector('.lumi-chat-window');
            // polygon already fetched above, reuse it
            if (!polygon) {
                polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
            }
            
            // Update popup positions based on button position (for mobile path only)
            this.updatePopupPosition();
            
            // Force a reflow to ensure positions are applied
            void document.documentElement.offsetHeight;
            
            // Desktop-specific: ensure child elements have proper z-index and pointer-events
            // (Mobile is handled by showLandingWindowAndPolygon which returns early)
            if (!isMobile && landingWindow) {
                // Ensure child elements have proper z-index and pointer-events
                const landingContent = landingWindow.querySelector('.lumi-landing-content');
                if (landingContent) {
                    landingContent.style.setProperty('z-index', '2147483647', 'important');
                    landingContent.style.setProperty('position', 'relative', 'important');
                }
                
                const landingButtons = landingWindow.querySelectorAll('.lumi-landing-btn');
                landingButtons.forEach(btn => {
                    btn.style.setProperty('z-index', '2147483647', 'important');
                    btn.style.setProperty('position', 'relative', 'important');
                    btn.style.setProperty('pointer-events', 'auto', 'important');
                });
                
                const closeBtn = landingWindow.querySelector('#lumi-landing-close-btn-desktop') || landingWindow.querySelector('#lumi-landing-close-btn');
                if (closeBtn) {
                    closeBtn.style.setProperty('z-index', '2147483647', 'important');
                    closeBtn.style.setProperty('pointer-events', 'auto', 'important');
                }
            }
            
            if (landingWindow) {
                this.debugLog('Landing window displayed');
                
                // Log actual computed styles to verify positioning
                const computedStyles = window.getComputedStyle(landingWindow);
                this.debugLog('Landing window computed styles:', {
                    display: computedStyles.display,
                    visibility: computedStyles.visibility,
                    opacity: computedStyles.opacity,
                    position: computedStyles.position,
                    top: computedStyles.top,
                    right: computedStyles.right,
                    left: computedStyles.left,
                    width: computedStyles.width,
                    height: computedStyles.height,
                    zIndex: computedStyles.zIndex
                });
                this.debugLog('Landing window bounding rect:', landingWindow.getBoundingClientRect());
                
                // Temporarily disable main button clicks to prevent interference
                const mainButton = document.querySelector('#lumi-assistant-btn');
                if (mainButton) {
                    mainButton.style.pointerEvents = 'none';
                    this.debugLog('Main button clicks disabled');
                }
            }
            
            if (chatWindow) {
                this.debugLog('openChat() - Hiding chat window initially');
                chatWindow.style.display = 'none';
            }
            
            // CRITICAL: Re-enforce polygon visibility AFTER updatePopupPosition (like startChatting does)
            // This ensures polygon stays visible even if updatePopupPosition tried to hide it
            if (polygon) {
                // On mobile, polygon positioning is handled above in the mobile-specific block
                // On desktop, just show it with standard positioning
                if (!isMobile) {
                    polygon.style.setProperty('display', 'block', 'important');
                    polygon.style.setProperty('visibility', 'visible', 'important');
                    polygon.style.setProperty('opacity', '1', 'important');
                }
                
                // On mobile, positions are already applied by updatePopupPositionMobile (already set as CSS vars or inline styles)
                // Re-enforce polygon visibility after landing window is shown
                if (isMobile && landingWindow && polygon) {
                    // Always show polygon when landing window is displayed (or about to be displayed)
                    // Get positions from updatePopupPositionMobile (already set as CSS vars or inline styles)
                    const rootStyles = window.getComputedStyle(document.documentElement);
                    const polygonTop = rootStyles.getPropertyValue('--widget-polygon-top').trim();
                    const polygonLeft = rootStyles.getPropertyValue('--widget-polygon-left').trim();
                    
                    // If CSS vars have pixel values, use them; otherwise positions are already set inline
                    polygon.style.setProperty('display', 'block', 'important');
                    polygon.style.setProperty('visibility', 'visible', 'important');
                    polygon.style.setProperty('opacity', '1', 'important');
                    polygon.style.setProperty('position', 'fixed', 'important');
                    polygon.style.setProperty('z-index', '10004', 'important');
                    
                    // Ensure positions are set (they should already be set by updatePopupPositionMobile, but double-check)
                    // Use left positioning only to center polygon at avatarCenterX
                    if (polygonTop && polygonTop.includes('px')) {
                        polygon.style.setProperty('top', polygonTop, 'important');
                    }
                    if (polygonLeft && polygonLeft.includes('px')) {
                        polygon.style.setProperty('left', polygonLeft, 'important');
                        polygon.style.setProperty('right', 'auto', 'important'); // Remove right positioning
                    }
                    
                    // Double-check after a short delay to ensure polygon stays visible
                    setTimeout(() => {
                        const landingStylesAfter = window.getComputedStyle(landingWindow);
                        const isLandingVisibleAfter = landingStylesAfter.display !== 'none' && 
                                                        landingStylesAfter.visibility !== 'hidden' && 
                                                        parseFloat(landingStylesAfter.opacity) > 0;
                        if (isLandingVisibleAfter && !landingWindow.classList.contains('lumi-landing-dismissed')) {
                            polygon.style.setProperty('display', 'block', 'important');
                            polygon.style.setProperty('visibility', 'visible', 'important');
                            polygon.style.setProperty('opacity', '1', 'important');
                            polygon.style.setProperty('z-index', '10004', 'important');
                        }
                    }, 100);
                }
                
            }
            
            // Bind landing window events AFTER DOM is ready
            if (landingWindow) {
                setTimeout(() => this.bindLandingWindowEvents(), 100);
            }
            
        }
        startChatting() {
            this.debugLog('=== startChatting() method called ===');
            // User explicitly started chatting - clear the explicitly closed flag
            this.setChatWindowExplicitlyClosed(false);
            
            const isMobileViewport = window.innerWidth <= 768;
            if (isMobileViewport && this.isCookieBannerActive(this.findCookieBanner(), this.findCookieOverlay())) {
                this.cookieBannerUserOverride = true;
                this.debugLog('Cookie banner active on mobile during startChatting - honoring user override to keep chat visible');
            }
            
            // Hide landing window and show chat window
            const landingWindow = this.container.querySelector('.lumi-landing-window') || document.querySelector('.lumi-landing-window');
            const chatWindow = this.container.querySelector('.lumi-chat-window');
            const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
            
            this.debugLog('startChatting - Landing window found:', !!landingWindow);
            this.debugLog('startChatting - Chat window found:', !!chatWindow);
            this.debugLog('startChatting - Polygon found:', !!polygon);
            
            if (!chatWindow) {
                console.error('ERROR: Chat window not found in startChatting()!');
                return;
            }
            
            // Set widget state to open
            this.isOpen = true;
            this.container.classList.add('open');
            this.container.classList.add('chat-active');
            this.debugLog('Widget state set to open');
            
            if (landingWindow) {
                // Use !important to override mobile CSS
                landingWindow.style.setProperty('display', 'none', 'important');
                landingWindow.style.setProperty('visibility', 'hidden', 'important');
                landingWindow.style.setProperty('opacity', '0', 'important');
                this.debugLog('Landing window hidden');
            }

            // Extra safety: if multiple landing windows exist for any reason, hide them all
            const allLandingWindows = document.querySelectorAll('.lumi-landing-window');
            if (allLandingWindows && allLandingWindows.length > 0) {
                allLandingWindows.forEach((el) => {
                    el.style.setProperty('display', 'none', 'important');
                    el.style.setProperty('visibility', 'hidden', 'important');
                    el.style.setProperty('opacity', '0', 'important');
                });
                this.debugLog('All landing windows forced hidden');
            }
            
            if (chatWindow) {
                // Get z-index that's above nav bar
                const chatZIndex = this.getZIndexAboveNavBar(10001);
                // Use !important to override mobile CSS
                chatWindow.style.setProperty('display', 'flex', 'important');
                chatWindow.style.setProperty('visibility', 'visible', 'important');
                chatWindow.style.setProperty('opacity', '1', 'important');
                chatWindow.style.setProperty('z-index', `${chatZIndex}`, 'important');
                this.debugLog('Chat window shown with forced visibility');
                
                
                // Debug positioning and visibility
                const rect = chatWindow.getBoundingClientRect();
                this.debugLog('Chat window position:', rect);
                this.debugLog('Chat window computed display:', window.getComputedStyle(chatWindow).display);
                this.debugLog('Chat window computed visibility:', window.getComputedStyle(chatWindow).visibility);
                this.debugLog('Chat window computed opacity:', window.getComputedStyle(chatWindow).opacity);
                this.debugLog('Chat window computed z-index:', window.getComputedStyle(chatWindow).zIndex);
                
                // Check if chat window is within viewport bounds
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                this.debugLog('Viewport dimensions:', viewportWidth, 'x', viewportHeight);
                this.debugLog('Chat window bounds check:');
                this.debugLog('  Left:', rect.left, 'Right:', rect.right, 'Width:', rect.width);
                this.debugLog('  Top:', rect.top, 'Bottom:', rect.bottom, 'Height:', rect.height);
                this.debugLog('  Is within viewport horizontally:', rect.left >= 0 && rect.right <= viewportWidth);
                this.debugLog('  Is within viewport vertically:', rect.top >= 0 && rect.bottom <= viewportHeight);
                
                // Force visibility and positioning (z-index already set above with getZIndexAboveNavBar)
                chatWindow.style.visibility = 'visible';
                chatWindow.style.opacity = '1';
                
                // On desktop, position chat window using fixed positioning with viewport coordinates
                const isMobile = window.innerWidth <= 768;
                if (!isMobile) {
                    const button = document.querySelector('#lumi-assistant-btn');
                    if (button) {
                        const buttonRect = button.getBoundingClientRect();
                        const viewportWidth = window.innerWidth;
                        const buttonRight = Math.max(0, Math.round(viewportWidth - buttonRect.right));
                        const { avatarBottom } = this.getAssistantButtonLayoutMetrics(button, buttonRect);
                        const LANDING_POLYGON_SVG_HEIGHT = 12;
                        const DESKTOP_LANDING_GAP_BELOW_POLYGON = 3;
                        const polygonTop = this.getChatPolygonFixedTopY(avatarBottom);
                        const windowTop = Math.round(polygonTop + LANDING_POLYGON_SVG_HEIGHT + DESKTOP_LANDING_GAP_BELOW_POLYGON);

                        chatWindow.style.setProperty('position', 'fixed', 'important');
                        chatWindow.style.setProperty('top', `${windowTop}px`, 'important');
                        chatWindow.style.setProperty('right', `${buttonRight}px`, 'important');
                        chatWindow.style.setProperty('left', 'auto', 'important');
                        this.debugLog('Desktop chat window positioned using fixed positioning:', { windowTop, buttonRight });
                    }
                } else {
                    // On mobile, let CSS variables control positioning
                    this.debugLog('Mobile chat window will inherit position via CSS variables');
                    
                    // Update positioning for mobile
                    this.updatePopupPosition();
                    
                    // Check for overlap with safetyInfo panel and scroll if needed
                    // Use setTimeout to ensure positioning is complete before checking overlap
                    setTimeout(() => {
                        this.handleMobileChatWindowOverlap(chatWindow);
                    }, 100);
                }
            } else {
                this.debugLog('ERROR: Chat window not found!');
            }
            
            if (polygon) {
                // Get z-index that's above nav bar (above chat window)
                const polygonZIndex = this.getZIndexAboveNavBar(10002);
                polygon.style.setProperty('display', 'block', 'important');
                polygon.style.setProperty('visibility', 'visible', 'important');
                polygon.style.setProperty('opacity', '1', 'important');
                polygon.style.setProperty('z-index', `${polygonZIndex}`, 'important');
                
                // On desktop, position polygon using fixed positioning with viewport coordinates
                const isMobile = window.innerWidth <= 768;
                if (!isMobile) {
                    const button = document.querySelector('#lumi-assistant-btn');
                    if (button) {
                        const buttonRect = button.getBoundingClientRect();
                        const { avatarBottom, avatarCenterX } = this.getAssistantButtonLayoutMetrics(button, buttonRect);
                        const polygonWidth = 14;
                        const polygonLeft = Math.max(0, Math.round(avatarCenterX - polygonWidth / 2));
                        const polygonTop = this.getChatPolygonFixedTopY(avatarBottom);

                        polygon.style.setProperty('position', 'fixed', 'important');
                        polygon.style.setProperty('top', `${polygonTop}px`, 'important');
                        polygon.style.setProperty('left', `${polygonLeft}px`, 'important');
                        polygon.style.setProperty('right', 'auto', 'important'); // Remove right positioning
                        this.debugLog('Desktop polygon positioned using fixed positioning:', { polygonTop, polygonLeft, avatarCenterX });
                    }
                }
                this.debugLog('Polygon shown');
            }
            
            // Update positioning for chat window (especially important on mobile)
            this.updatePopupPosition();
            this.debugLog('Positioning updated for chat window');
            
            // CRITICAL: After updatePopupPosition, ensure polygon is still visible for chat window
            if (polygon && chatWindow) {
                const chatStyles = window.getComputedStyle(chatWindow);
                const isChatStillVisible = chatStyles.display !== 'none' && 
                                        chatStyles.visibility !== 'hidden' && 
                                        parseFloat(chatStyles.opacity) > 0;
                if (isChatStillVisible) {
                    // Get z-index that's above nav bar (above chat window)
                    const polygonZIndex = this.getZIndexAboveNavBar(10002);
                    polygon.style.setProperty('display', 'block', 'important');
                    polygon.style.setProperty('visibility', 'visible', 'important');
                    polygon.style.setProperty('opacity', '1', 'important');
                    polygon.style.setProperty('z-index', `${polygonZIndex}`, 'important');
                }
            }
            
            // Re-enable main button clicks
            const mainButton = document.querySelector('#lumi-assistant-btn');
            if (mainButton) {
                mainButton.style.pointerEvents = 'auto';
                this.debugLog('Main button clicks re-enabled');
            }
            
            // Default to avatar mode on start if enabled, otherwise use text mode
            const defaultMode = this.config.enableAvatar ? 'ai' : 'text';
            this.switchMode(defaultMode);
            this.debugLog(`Defaulting to ${defaultMode} mode`);
            
            // Focus input and initialize send button state
            const input = this.container.querySelector('#lumi-chat-input');
            if (input) {
                // Ensure input is enabled when chat window opens
                this.setInputEnabled(true);
                setTimeout(() => {
                    input.focus();
                    this.updateSendButtonState();
                }, 100);
            }
            
            this.debugLog('startChatting() completed successfully');
            
            // Verify chat window is visible after a short delay
            setTimeout(() => {
                const root = document.documentElement;
                this.debugLog('CSS variables after startChatting:', {
                    '--widget-window-top': root.style.getPropertyValue('--widget-window-top'),
                    '--widget-window-right': root.style.getPropertyValue('--widget-window-right')
                });
                
                // Verify chat window visibility
                if (chatWindow) {
                    const computedStyle = window.getComputedStyle(chatWindow);
                    const rect = chatWindow.getBoundingClientRect();
                    this.debugLog('Chat window visibility check:', {
                        display: computedStyle.display,
                        visibility: computedStyle.visibility,
                        opacity: computedStyle.opacity,
                        zIndex: computedStyle.zIndex,
                        boundingRect: rect,
                        isVisible: computedStyle.display !== 'none' && 
                                    computedStyle.visibility !== 'hidden' && 
                                    parseFloat(computedStyle.opacity) > 0 &&
                                    rect.width > 0 &&
                                    rect.height > 0
                    });
                }
            }, 200);
        }
        closeChat(clearMessages = false, explicitlyClosed = false) {
            this.debugLog('closeChat() called - clearMessages:', clearMessages, 'explicitlyClosed:', explicitlyClosed);
            this.isOpen = false;
            this.container.classList.remove('open');
            this.container.classList.remove('chat-active');
            this.backdrop.style.display = 'none';
            this.isManuallyPositioned = false;
            this.cookieBannerUserOverride = false;
            
            // Reset viewport scroll state when chat window is manually closed
            // This ensures the chat window won't be restored when button comes back into viewport
            this.chatWindowWasVisibleBeforeScroll = false;
            
            // If chat window was explicitly closed by user (X button), mark it in sessionStorage
            // This prevents it from auto-showing on next page load
            if (explicitlyClosed) {
                this.setChatWindowExplicitlyClosed(true);
            }
            
            // Clear messages if specified (e.g., when clicking outside)
            if (clearMessages) {
                this.messages = [];
                this.debugLog('Messages cleared due to external close');
            }
            
            // On mobile, landing window might be on document.body, so search both places
            // Use correct selector for desktop vs mobile
            const isMobile = window.innerWidth <= 768;
            let landingWindow;
            if (isMobile) {
                landingWindow = this.container.querySelector('#lumi-landing-window') || document.querySelector('#lumi-landing-window');
            } else {
                landingWindow = this.container.querySelector('#lumi-landing-window-desktop') || document.querySelector('#lumi-landing-window-desktop');
            }
            const chatWindow = this.container.querySelector('.lumi-chat-window');
            const polygon = this.container.querySelector('.lumi-chat-polygon') || document.querySelector('.lumi-chat-polygon');
            
            if (landingWindow) {
                // Use !important to override mobile CSS
                landingWindow.style.setProperty('display', 'none', 'important');
                landingWindow.style.setProperty('visibility', 'hidden', 'important');
                landingWindow.style.setProperty('opacity', '0', 'important');
                landingWindow.style.setProperty('pointer-events', 'none', 'important');
                
                // Add a class to mark it as hidden (but NOT dismissed - user can reopen by clicking avatar)
                // Only the "Try later" and "Close" button handlers should mark it as permanently dismissed
                landingWindow.classList.add('lumi-landing-dismissed');
                this.debugLog('Landing window closed - user can click avatar button to reopen');
            }
            
            if (chatWindow) {
                this.debugLog('closeChat() - Hiding chat window');
                chatWindow.style.setProperty('display', 'none', 'important');
                chatWindow.style.setProperty('visibility', 'hidden', 'important');
                chatWindow.style.setProperty('opacity', '0', 'important');
            }
            
            if (polygon) {
                // Use !important to override mobile CSS
                polygon.style.setProperty('display', 'none', 'important');
                polygon.style.setProperty('visibility', 'hidden', 'important');
                polygon.style.setProperty('opacity', '0', 'important');
            }
            
            // Restore body scroll
            this.unlockBodyScroll('closeChat');
            
            // Re-enable main button clicks so user can click avatar button to reopen
            const mainButton = document.querySelector('#lumi-assistant-btn');
            if (mainButton) {
                mainButton.style.pointerEvents = 'auto';
                this.debugLog('Main button clicks re-enabled in closeChat()');
            }
            
            // Notify parent window that chat window was closed (once per close - guard against double-invocation)
            if (!this._chatWindowCloseNotifiedAt || (Date.now() - this._chatWindowCloseNotifiedAt) > 400) {
                this._chatWindowCloseNotifiedAt = Date.now();
                const sessionId = this.getSessionIdFromStorage() || this.avatarSessionId || null;
                this.notifyParentWindow('chat-window-close', {
                    sessionId: sessionId,
                    explicitlyClosed: explicitlyClosed,
                    clearMessages: clearMessages
                });
            }
        }
        setLoading(loading) {
            this.isLoading = loading;
            const messagesContainer = this.container.querySelector('#lumi-chat-messages');
            if (!messagesContainer) return;

            // Remove existing loading message
            const existingLoading = messagesContainer.querySelector('.lumi-loading-message');
            if (existingLoading) {
                existingLoading.remove();
            }

            if (loading) {
                // Add loading message
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'lumi-loading-message';
                loadingDiv.innerHTML = `
                    <div class="lumi-chat-message assistant">
                        <div class="lumi-chat-avatar">
                            <img src="https://lumichat.norta.ai/assets/Vyepti_Logo.svg" alt="LuMi Avatar" />
                        </div>
                        <div class="lumi-chat-message-content">
                            <div class="lumi-loading-text">
                                <span>LuMi is thinking</span>
                                <span class="lumi-loading-dots">...</span>
                            </div>
                        </div>
                    </div>
                `;
                messagesContainer.appendChild(loadingDiv);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }

        async handleSubmit() {
            this.debugLog('Handle submit called');
            const input = this.container.querySelector('#lumi-chat-input');
            if (!input) {
                this.debugLog('Input not found');
                return;
            }

            const message = input.value.trim();
            this.debugLog('Message:', message);
            if (!message) {
                this.debugLog('No message to send');
                return;
            }

            // Disable input and send button to prevent multiple submissions
            this.setInputEnabled(false);

            // Check if we have a sessionId from sessionStorage (created via API)
            // If not, create a new session before sending the message
            let currentSessionId = this.getSessionIdFromStorage();
            if (!currentSessionId) {
                try {
                    this.debugLog('No existing session found, creating new session...');
                    currentSessionId = await this.createNewSession();
                    this.debugLog('New session created:', currentSessionId);
                } catch (error) {
                    console.error('Failed to create session, continuing with generated sessionId:', error);
                    // Continue with the generated sessionId if API call fails
                    currentSessionId = this.sessionId;
                }
            }

            // Add user message
            this.addMessage('user', message);
            
            // Post user message to SessionMessages endpoint and capture messageId
            let userMessageId = null;
            if (currentSessionId) {
                const userMessageResponse = await this.postMessageToSession(currentSessionId, 'user', 'lumi', message, null);
                if (userMessageResponse && userMessageResponse.messageId) {
                    userMessageId = userMessageResponse.messageId;
                    this.debugLog('User message ID captured:', userMessageId);
                }
            }
            
            // Clear input
            input.value = '';
            this.handleInputResize();
            this.updateSendButtonState();
            
            // Send to API, passing the userMessageId for replyTo
            this.debugLog('About to call sendMessage');
            if (this.config.useStreaming) {
                this.sendMessageStreaming(message, userMessageId);
            } else {
                this.sendMessage(message, userMessageId);
            }
        }

        handleInputResize() {
            const input = this.container.querySelector('#lumi-chat-input');
            if (!input) return;

            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 120) + 'px';
        }

        setInputEnabled(enabled) {
            const input = this.container.querySelector('#lumi-chat-input');
            const sendBtn = this.container.querySelector('#lumi-send-btn');
            
            if (input) {
                input.disabled = !enabled;
                if (enabled) {
                    input.style.opacity = '1';
                    input.style.cursor = 'text';
                } else {
                    input.style.opacity = '0.6';
                    input.style.cursor = 'not-allowed';
                }
            }
            
            if (sendBtn) {
                sendBtn.disabled = !enabled;
                if (enabled) {
                    sendBtn.style.opacity = '1';
                    sendBtn.style.cursor = 'pointer';
                } else {
                    sendBtn.style.opacity = '0.6';
                    sendBtn.style.cursor = 'not-allowed';
                }
            }
        }

        updateSendButtonState() {
            const input = this.container.querySelector('#lumi-chat-input');
            const inactiveIcon = this.container.querySelector('#lumi-send-inactive');
            const activeIcon = this.container.querySelector('#lumi-send-active');
            
            if (!input || !inactiveIcon || !activeIcon) return;
            
            const hasText = input.value.trim().length > 0;
            
            if (hasText) {
                inactiveIcon.style.display = 'none';
                activeIcon.style.display = 'block';
            } else {
                inactiveIcon.style.display = 'block';
                activeIcon.style.display = 'none';
            }
        }

        addMessage(type, content, suggestedQuestions = null) {
            // Store message in array for persistence
            this.messages.push({ type, content, suggestedQuestions });
            // Save to sessionStorage
            this.saveMessagesToStorage();
            
            // Use the shared method to add to DOM
            return this.addMessageToDOM(type, content, suggestedQuestions);
        }

        updateMessage(messageId, newContent) {
            // Update the DOM
            const messageElement = this.container.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement) {
                const contentElement = messageElement.querySelector('.lumi-chat-message-content');
                if (contentElement) {
                    contentElement.textContent = newContent;
                }
            }
        }

        async handleSuggestedQuestion(question) {
            // Disable input and send button to prevent multiple submissions
            this.setInputEnabled(false);
            
            // Check if we have a sessionId from sessionStorage (created via API)
            // If not, create a new session before sending the message
            let currentSessionId = this.getSessionIdFromStorage();
            if (!currentSessionId) {
                try {
                    this.debugLog('No existing session found, creating new session...');
                    currentSessionId = await this.createNewSession();
                    this.debugLog('New session created:', currentSessionId);
                } catch (error) {
                    console.error('Failed to create session, continuing with generated sessionId:', error);
                    // Continue with the generated sessionId if API call fails
                    currentSessionId = this.sessionId;
                }
            }
            
            this.addMessage('user', question);
            
            // Post user message to SessionMessages endpoint and capture messageId
            let userMessageId = null;
            if (currentSessionId) {
                const userMessageResponse = await this.postMessageToSession(currentSessionId, 'user', 'lumi', question, null);
                if (userMessageResponse && userMessageResponse.messageId) {
                    userMessageId = userMessageResponse.messageId;
                    this.debugLog('User message ID captured:', userMessageId);
                }
            }
            
            this.sendMessage(question, userMessageId);
        }

        switchMode(mode, previousMode = null, userInitiated = false) {
            // If avatar is disabled, force text mode
            if (!this.config.enableAvatar && mode === 'ai') {
                this.debugLog('Avatar mode is disabled via enableAvatar toggle - forcing text mode');
                mode = 'text';
            }
            
            const aiBtn = this.container.querySelector('#lumi-ai-btn');
            const textBtn = this.container.querySelector('#lumi-text-btn');
            const avatarContainer = this.container.querySelector('#lumi-avatar-container');
            const messagesContainer = this.container.querySelector('#lumi-chat-messages-container');
            const inputForm = this.container.querySelector('.lumi-chat-input-form');
            
            // Detect previous mode if not provided
            if (previousMode === null) {
                if (aiBtn && aiBtn.classList.contains('active')) {
                    previousMode = 'ai';
                } else if (textBtn && textBtn.classList.contains('active')) {
                    previousMode = 'text';
                } else {
                    previousMode = null; // No previous mode (initial state)
                }
            }
            
            // Only notify if mode actually changed AND it's user-initiated
            if (previousMode !== mode && userInitiated) {
                this.notifyParentWindow('mode-switch', {
                    mode: mode,
                    previousMode: previousMode,
                    buttonId: mode === 'ai' ? 'lumi-ai-btn' : 'lumi-text-btn'
                });
            }
            
            if (mode === 'ai') {
                if (aiBtn) aiBtn.classList.add('active');
                if (textBtn) textBtn.classList.remove('active');
                
                // Show avatar container, hide messages and input form
                if (avatarContainer) avatarContainer.style.display = 'flex';
                if (messagesContainer) messagesContainer.style.display = 'none';
                if (inputForm) inputForm.style.display = 'none';
                
                // Set up avatar iframe and transcript listener (but don't create session yet)
                // Session will be created on-demand when user clicks "Start Voice Chat" and first transcript arrives
                this.setupAvatarIframe();
                
                this.debugLog('Switched to AI mode - showing avatar video');
            } else if (mode === 'text') {
                if (aiBtn) aiBtn.classList.remove('active');
                if (textBtn) textBtn.classList.add('active');
                
                // Hide avatar container, show messages and input form
                if (avatarContainer) avatarContainer.style.display = 'none';
                if (messagesContainer) messagesContainer.style.display = 'flex';
                if (inputForm) inputForm.style.display = 'flex';
                
                // Check how many messages are in the DOM
                const messageElements = messagesContainer.querySelectorAll('.lumi-chat-message');
                this.debugLog('Switched to Text mode - showing chat messages. DOM has', messageElements.length, 'messages');
            }
        }

        /**
         * Set up avatar iframe and transcript listener (without creating session)
         * Session will be created on-demand when user clicks "Start Voice Chat" and first transcript arrives
         */
        setupAvatarIframe() {
            this.debugLog('Setting up avatar iframe...');
            
            const status = this.container.querySelector('#lumi-avatar-status');
            const placeholder = this.container.querySelector('#lumi-avatar-placeholder');
            const iframe = this.container.querySelector('#lumi-avatar-iframe');
            
            if (status) {
                status.style.display = 'none';
                status.style.setProperty('pointer-events', 'none', 'important');
            }
            
            // Hide the placeholder immediately and ensure it doesn't block clicks
            if (placeholder) {
                placeholder.style.display = 'none';
                placeholder.style.setProperty('pointer-events', 'none', 'important');
            }
            
            // Set up transcript listener first so we don't miss any messages
            // Session will be created on-demand when first transcript arrives
            this.setupAvatarTranscriptListener();
            
            try {
                // Use the configured avatar URL (environment-specific)
                const avatarUrl = this.config.avatarUrl;
                
                this.debugLog('Connecting to avatar backend:', avatarUrl);
                
                if (iframe && placeholder) {
                    // Hide placeholder and show iframe
                    placeholder.style.display = 'none';
                    
                    // Set up the iframe with proper permissions
                    iframe.src = avatarUrl;
                    iframe.style.display = 'block';
                    // Explicitly enable pointer-events so clicks work inside the iframe
                    iframe.style.setProperty('pointer-events', 'auto', 'important');
                    iframe.setAttribute('allow', 'microphone; camera; autoplay; fullscreen');
                    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-presentation allow-top-navigation');
                    
                    // Dynamically set iframe height to match container
                    const avatarContainer = this.container.querySelector('#lumi-avatar-container');
                    const avatarWrapper = this.container.querySelector('.lumi-avatar-wrapper');
                    if (avatarContainer) {
                        const containerHeight = avatarContainer.offsetHeight;
                        this.debugLog('Setting iframe height to:', containerHeight);
                        iframe.style.height = containerHeight + 'px';
                        // Ensure container and wrapper also allow pointer-events
                        avatarContainer.style.setProperty('pointer-events', 'auto', 'important');
                        if (avatarWrapper) {
                            avatarWrapper.style.setProperty('pointer-events', 'auto', 'important');
                        }
                    }
                    
                    // Handle iframe load events
                    iframe.onload = () => {
                        if (status) {
                            status.style.display = 'none';
                            status.style.setProperty('pointer-events', 'none', 'important');
                        }
                        // Ensure iframe has proper z-index and pointer-events after load
                        iframe.style.setProperty('z-index', '100', 'important');
                        iframe.style.setProperty('pointer-events', 'auto', 'important');
                        // Also ensure wrapper and container allow pointer events
                        if (avatarWrapper) {
                            avatarWrapper.style.setProperty('pointer-events', 'auto', 'important');
                            avatarWrapper.style.setProperty('z-index', '1', 'important');
                        }
                        if (avatarContainer) {
                            avatarContainer.style.setProperty('pointer-events', 'auto', 'important');
                            avatarContainer.style.setProperty('z-index', '1', 'important');
                        }
                        // Ensure chat content also allows pointer events
                        const chatContent = this.container.querySelector('.lumi-chat-content');
                        if (chatContent) {
                            chatContent.style.setProperty('pointer-events', 'auto', 'important');
                        }
                        // Ensure controls don't block the iframe
                        const avatarControls = this.container.querySelector('.lumi-avatar-controls');
                        if (avatarControls) {
                            avatarControls.style.setProperty('display', 'none', 'important');
                            avatarControls.style.setProperty('pointer-events', 'none', 'important');
                        }
                        
                        // CRITICAL: If cookie banner is active and user override is set, restore all pointer-events
                        // This ensures the iframe is clickable even when cookie banner observer might have hidden things
                        const isMobile = window.innerWidth <= 768;
                        if (isMobile && this.cookieBannerUserOverride) {
                            if (typeof this.restoreWindowsForUserOverride === 'function') {
                                this.restoreWindowsForUserOverride();
                                this.debugLog('Restored pointer-events for avatar iframe after load (cookie banner override active)');
                            }
                        }
                        
                        // Try to focus the iframe to ensure it's interactive
                        // Note: This might not work for cross-origin iframes, but worth trying
                        try {
                            iframe.focus();
                        } catch (e) {
                            // Cross-origin iframes can't be focused from parent - this is expected
                        }
                        
                        // Log computed styles for debugging
                        const iframeStyle = window.getComputedStyle(iframe);
                        this.debugLog('Direct avatar iframe loaded successfully - pointer-events enabled');
                        this.debugLog('Iframe computed styles:', {
                            pointerEvents: iframeStyle.pointerEvents,
                            zIndex: iframeStyle.zIndex,
                            display: iframeStyle.display,
                            visibility: iframeStyle.visibility,
                            opacity: iframeStyle.opacity
                        });
                        
                        // Log container and wrapper styles for debugging
                        if (avatarContainer) {
                            const containerStyle = window.getComputedStyle(avatarContainer);
                            this.debugLog('Avatar container computed styles:', {
                                pointerEvents: containerStyle.pointerEvents,
                                zIndex: containerStyle.zIndex,
                                display: containerStyle.display
                            });
                        }
                        if (avatarWrapper) {
                            const wrapperStyle = window.getComputedStyle(avatarWrapper);
                            this.debugLog('Avatar wrapper computed styles:', {
                                pointerEvents: wrapperStyle.pointerEvents,
                                zIndex: wrapperStyle.zIndex,
                                display: wrapperStyle.display
                            });
                        }
                        
                        // Try to inject CSS to remove black bars
                        try {
                            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                            if (iframeDoc) {
                                // Find or create a style element
                                let styleEl = iframeDoc.getElementById('lumi-video-fill-style');
                                if (!styleEl) {
                                    styleEl = iframeDoc.createElement('style');
                                    styleEl.id = 'lumi-video-fill-style';
                                    iframeDoc.head.appendChild(styleEl);
                                }
                                
                                // Inject CSS to make video fill the iframe and align to top
                                styleEl.textContent = `
                                    html, body, #__next {
                                        margin: 0 !important;
                                        padding: 0 !important;
                                        width: 100% !important;
                                        height: 100% !important;
                                        overflow: hidden !important;
                                    }
                                    video {
                                        width: 100% !important;
                                        height: 100% !important;
                                        object-fit: contain !important;
                                        object-position: top !important;
                                    }
                                    body * {
                                        max-width: 100% !important;
                                    }
                                `;
                                this.debugLog('Injected CSS to fill video in iframe');
                                
                                // Set up link click handler to send postMessage to parent window
                                try {
                                    // Intercept link clicks in the iframe
                                    iframeDoc.addEventListener('click', (e) => {
                                        const link = e.target.closest('a[href]');
                                        if (link && link.href) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            
                                            // Notify parent window of link click event
                                            this.notifyParentWindow('resource-link-click', {
                                                url: link.href,
                                                linkText: link.textContent || link.innerText || '',
                                                messageId: null, // Voice/avatar iframe links aren't in chat messages
                                                messageType: 'voice' // Indicate this is from voice/avatar iframe
                                            });
                                            
                                            // Send message to parent window to open the link
                                            if (this.isInIframe() && window.parent) {
                                                window.parent.postMessage({
                                                    type: 'OPEN_LINK_IN_NEW_TAB',
                                                    url: link.href
                                                }, '*'); // Use '*' for now, parent handler will validate origin
                                                this.debugLog('Sent link click message to parent window:', link.href);
                                            } else {
                                                // If no parent, open directly
                                                window.open(link.href, '_blank', 'noopener,noreferrer');
                                            }
                                        }
                                    }, true); // Use capture phase to catch all clicks
                                    
                                    this.debugLog('Link click handler attached to iframe document');
                                } catch (linkError) {
                                    this.debugLog('Could not attach link click handler to iframe:', linkError);
                                }
                            }
                        } catch (e) {
                            // CORS restriction is expected for cross-origin iframes - this is normal behavior
                            // Only log once to reduce console noise
                            if (!this.corsWarningLogged) {
                                console.debug('CORS restriction prevents direct iframe access (expected for cross-origin):', e.message);
                                this.corsWarningLogged = true;
                            }
                        }
                        
                        // Also set up a message listener to forward messages from iframe to parent
                        // This handles cases where the iframe content itself sends postMessage
                        // Use a flag to prevent multiple listeners
                        if (!this.iframeMessageListenerSetup) {
                            try {
                                const iframeWindow = iframe.contentWindow;
                                if (iframeWindow) {
                                    // Store reference to iframe window for message forwarding
                                    this.iframeWindow = iframeWindow;
                                    
                                    // Listen for messages from the iframe and forward to parent
                                    const messageHandler = (event) => {
                                        // Check if message is from our iframe
                                        if (event.source === this.iframeWindow) {
                                            // Forward messages of type OPEN_LINK_IN_NEW_TAB to parent window
                                            if (event.data && event.data.type === 'OPEN_LINK_IN_NEW_TAB') {
                                                // Notify parent window of link click event
                                                this.notifyParentWindow('resource-link-click', {
                                                    url: event.data.url,
                                                    linkText: event.data.linkText || '', // If available from iframe
                                                    messageId: null, // Voice/avatar iframe links aren't in chat messages
                                                    messageType: 'voice' // Indicate this is from voice/avatar iframe
                                                });
                                                
                                                if (this.isInIframe() && window.parent) {
                                                    window.parent.postMessage({
                                                        type: 'OPEN_LINK_IN_NEW_TAB',
                                                        url: event.data.url
                                                    }, '*'); // Parent handler will validate origin
                                                    this.debugLog('Forwarded link message from iframe to parent:', event.data.url);
                                                }
                                            }
                                        }
                                    };
                                    
                                    window.addEventListener('message', messageHandler);
                                    this.iframeMessageListenerSetup = true;
                                    this.iframeMessageHandler = messageHandler; // Store for potential cleanup
                                    this.debugLog('Message forwarder set up for iframe');
                                }
                            } catch (msgError) {
                                this.debugLog('Could not set up message forwarder:', msgError);
                            }
                        }
                    };
                    
                    iframe.onerror = (error) => {
                        console.error('Error loading avatar iframe:', error);
                        if (status) status.textContent = 'Error loading avatar. Please try again.';
                        if (startBtn) startBtn.style.display = 'inline-block';
                        if (stopBtn) stopBtn.style.display = 'none';
                        
                        // Show placeholder again with error message
                        placeholder.style.display = 'flex';
                        placeholder.querySelector('h3').textContent = 'LuMi AI Avatar - Connection Error';
                        placeholder.querySelector('p').textContent = 'Unable to load the avatar. Please try again.';
                    };
                }
                
                this.debugLog('Avatar iframe set up successfully (session will be created when user starts voice chat)');
            } catch (error) {
                console.error('Error setting up avatar iframe:', error);
                if (status) status.textContent = 'Error setting up avatar. Please try again.';
                if (startBtn) startBtn.style.display = 'inline-block';
                if (stopBtn) stopBtn.style.display = 'none';
                
                // Show error in placeholder
                if (placeholder) {
                    placeholder.style.display = 'flex';
                    placeholder.querySelector('h3').textContent = 'LuMi AI Avatar - Connection Failed';
                    placeholder.querySelector('p').textContent = 'Unable to connect to the avatar service. Please try again.';
                }
            }
        }

        /**
         * Start avatar session (legacy method - kept for backward compatibility)
         * Now just calls setupAvatarIframe()
         */
        async startAvatarSession() {
            this.setupAvatarIframe();
        }

        stopAvatarSession() {
            this.debugLog('Stopping avatar session...');
            
            const status = this.container.querySelector('#lumi-avatar-status');
            const placeholder = this.container.querySelector('#lumi-avatar-placeholder');
            const iframe = this.container.querySelector('#lumi-avatar-iframe');
            
            if (status) status.style.display = 'none';
            
            if (iframe && placeholder) {
                // Hide iframe and show placeholder
                iframe.style.display = 'none';
                iframe.src = '';
                
                // Keep placeholder hidden
                placeholder.style.display = 'none';
                
                // Clear event handlers
                iframe.onload = null;
                iframe.onerror = null;
            }
            
            // Reset avatar session tracking
            this.avatarSessionId = null;
            this.lastAvatarUserMessageId = null;
            
            // Clear from sessionStorage
            this.saveAvatarSessionIdToStorage(null);
            
            this.debugLog('Avatar session stopped');
        }

        /**
         * Set up listener for avatar transcript events
         * Listens for both 'avatarTranscript' custom events and direct postMessage events with TRANSCRIPT type
         */
        setupAvatarTranscriptListener() {
            if (this.avatarTranscriptListenerSetup) {
                this.debugLog('Avatar transcript listener already set up');
                return;
            }
            
            this.debugLog('Setting up avatar transcript listener...');
            
            const transcriptHandler = async (role, message) => {
                try {
                    // If no session ID exists, try to create one (in case transcripts arrive before session is created)
                    if (!this.avatarSessionId) {
                        console.warn('No avatar session ID available, attempting to create session...');
                        try {
                            this.avatarSessionId = await this.createNewSession(2); // 2 = voice/avatar mode
                            this.lastAvatarUserMessageId = null; // Reset message threading
                            // Save to sessionStorage for persistence across tab switches
                            this.saveAvatarSessionIdToStorage(this.avatarSessionId);
                            this.debugLog('✅ Avatar session created on-demand:', this.avatarSessionId);
                            
                            // Notify parent window that voice chat has started
                            // Event includes sessionId for tracking the voice chat session
                            this.notifyParentWindow('voice-chat-start', {
                                sessionId: this.avatarSessionId,
                                trigger: 'first-transcript'
                            });
                        } catch (error) {
                            console.error('❌ Failed to create avatar session on-demand:', error);
                            return; // Can't post without a session
                        }
                    }
                    
                    // Map role: 'USER' -> 'user', 'AVATAR' -> 'lumi'
                    const from = role === 'USER' ? 'user' : 'lumi';
                    const to = role === 'USER' ? 'lumi' : 'user';
                    
                    this.debugLog('Avatar transcript received:', { role, from, to, message: message.substring(0, 50) + '...' });
                    
                    // Post transcript to SessionMessages API
                    let replyTo = null;
                    if (role === 'AVATAR' && this.lastAvatarUserMessageId) {
                        // Avatar response should reply to the last user message
                        replyTo = this.lastAvatarUserMessageId;
                    }
                    
                    const response = await this.postMessageToSession(
                        this.avatarSessionId,
                        from,
                        to,
                        message,
                        replyTo
                    );
                    
                    // If this is a user message, store the messageId for replyTo threading
                    if (role === 'USER' && response && response.messageId) {
                        this.lastAvatarUserMessageId = response.messageId;
                        this.debugLog('Stored user message ID for replyTo:', this.lastAvatarUserMessageId);
                    }
                    
                } catch (error) {
                    console.error('Error handling avatar transcript:', error);
                    // Don't throw - we don't want to break the avatar session if transcript posting fails
                }
            };
            
            // Listen for custom avatarTranscript events (dispatched by parent-window-link-handler.js)
            const customEventHandler = (event) => {
                const { role, message } = event.detail;
                transcriptHandler(role, message);
            };
            window.addEventListener('avatarTranscript', customEventHandler);
            
            // Also listen directly to postMessage events for TRANSCRIPT messages
            // This handles cases where parent-window-link-handler.js doesn't dispatch custom events
            const postMessageHandler = (event) => {
                // Check if message is from the avatar iframe origin
                const allowedOrigins = [
                    'https://lumiwebavatar.norta.ai',
                    'https://lumiwebavatarstage.norta.ai', // Staging avatar URL
                    'https://lumiwebavatar.dev.norta.ai',
                    'http://localhost:3000'
                ];
                
                if (!allowedOrigins.includes(event.origin)) {
                    return; // Ignore messages from other origins
                }
                
                // Check if this is a TRANSCRIPT message
                if (event.data && event.data.type === 'TRANSCRIPT') {
                    const role = event.data.role;
                    const message = event.data.message;
                    
                    // Validate role and message
                    if (role && (role === 'USER' || role === 'AVATAR') && message && typeof message === 'string') {
                        this.debugLog('Received TRANSCRIPT postMessage from iframe:', { role, message: message.substring(0, 50) + '...' });
                        transcriptHandler(role, message);
                    }
                }
            };
            window.addEventListener('message', postMessageHandler);
            
            this.avatarTranscriptListenerSetup = true;
            this.avatarTranscriptHandler = customEventHandler; // Store for potential cleanup
            this.avatarPostMessageHandler = postMessageHandler; // Store for potential cleanup
            this.debugLog('Avatar transcript listener set up successfully (listening to both custom events and postMessage)');
        }

        formatMessageContent(content) {
            // Handle bold text **text**
            content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            
            // Handle italic text *text*
            content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
            
            // Handle headers # Header, ## Header, ### Header
            content = content.replace(/^### (.*$)/gm, '<h3>$1</h3>');
            content = content.replace(/^## (.*$)/gm, '<h2>$1</h2>');
            content = content.replace(/^# (.*$)/gm, '<h1>$1</h1>');
            
            // Handle unordered lists - item
            content = content.replace(/^- (.*$)/gm, '<li>$1</li>');
            content = content.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
            
            // Handle ordered lists 1. item
            content = content.replace(/^\d+\. (.*$)/gm, '<li>$1</li>');
            content = content.replace(/(<li>.*<\/li>)/s, '<ol>$1</ol>');
            
            // Handle code blocks ```code```
            content = content.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
            
            // Handle inline code `code`
            content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
            
            // Handle links [text](url)
            content = content.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
            
            // Handle line breaks - convert double newlines to paragraphs
            content = content.replace(/\n\n/g, '</p><p>');
            content = '<p>' + content + '</p>';
            
            // Clean up empty paragraphs
            content = content.replace(/<p><\/p>/g, '');
            content = content.replace(/<p>\s*<\/p>/g, '');
            
            return content;
        }

        async sendMessage(message, userMessageId = null) {
            try {
                this.setLoading(true);
                
                // Get the current sessionId (from sessionStorage if available)
                const currentSessionId = this.getSessionIdFromStorage() || this.sessionId;
                
                this.debugLog('Sending message to:', this.config.apiUrl + '/ask');
                this.debugLog('Message:', message);
                this.debugLog('Session ID:', currentSessionId);
                this.debugLog('User Message ID (for replyTo):', userMessageId);
                
                const response = await fetch(this.config.apiUrl + '/ask', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Basic ' + btoa(this.config.username + ':' + this.config.password)
                    },
                    body: JSON.stringify({
                        message: message,
                        session_id: currentSessionId
                    })
                });

                this.debugLog('Response status:', response.status);
                this.debugLog('Response headers:', response.headers);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                this.debugLog('Response data:', data);
                
                // Parse response
                let answer = data.answer;
                let suggestedQuestions = data.suggested_questions || [];

                // Handle nested JSON in answer field
                if (typeof answer === 'string' && answer.includes('{')) {
                    try {
                        const parsedAnswer = JSON.parse(answer);
                        if (parsedAnswer.response) {
                            answer = parsedAnswer.response;
                        }
                        if (parsedAnswer.suggested_questions) {
                            suggestedQuestions = parsedAnswer.suggested_questions;
                        }
                    } catch (e) {
                        this.debugLog('Could not parse nested JSON, using original answer');
                    }
                }

                this.setLoading(false);
                this.addMessage('assistant', answer, suggestedQuestions);
                
                // Post Lumi response to SessionMessages endpoint
                // Only include replyTo if userMessageId is available (don't include field if not available)
                if (currentSessionId) {
                    this.postMessageToSession(currentSessionId, 'lumi', 'user', answer, userMessageId);
                }
                
                // Re-enable input after response is displayed
                this.setInputEnabled(true);

            } catch (error) {
                console.error('Error sending message:', error);
                this.setLoading(false);
                this.addMessage('assistant', 'Sorry, I encountered an error. Please try again later.');
                
                // Re-enable input even on error
                this.setInputEnabled(true);
            }
        }
        async sendMessageStreaming(message, userMessageId = null) {
            try {
                this.setLoading(true);
                
                // Get the current sessionId (from sessionStorage if available)
                const currentSessionId = this.getSessionIdFromStorage() || this.sessionId;
                
                this.debugLog('Sending streaming message to:', this.config.streamingApiUrl);
                this.debugLog('Message:', message);
                this.debugLog('Session ID:', currentSessionId);
                this.debugLog('User Message ID (for replyTo):', userMessageId);
                
                // Create assistant message placeholder for streaming
                const assistantMessageId = this.addMessage('assistant', '');
                
                const response = await fetch(this.config.streamingApiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': this.config.streamingAuth
                    },
                    body: JSON.stringify({
                        message: message,
                        session_id: currentSessionId,
                        user_id: this.userId
                    })
                });

                this.debugLog('Streaming response status:', response.status);
                this.debugLog('Streaming response headers:', response.headers);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                // Handle streaming response
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullResponse = '';
                let suggestedQuestions = [];

                while (true) {
                    const { done, value } = await reader.read();
                    
                    if (done) {
                        this.debugLog('Streaming completed');
                        break;
                    }

                    const chunk = decoder.decode(value, { stream: true });
                    this.debugLog('Received chunk:', chunk);
                    
                    // Process each line in the chunk
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        if (line.trim() === '') continue;
                        
                        try {
                            // Handle Server-Sent Events format
                            if (line.startsWith('data: ')) {
                                const data = line.substring(6);
                                if (data === '[DONE]') {
                                    this.debugLog('Streaming done');
                                    break;
                                }
                                
                                const parsed = JSON.parse(data);
                                if (parsed.response) {
                                    fullResponse += parsed.response;
                                    this.updateMessage(assistantMessageId, fullResponse);
                                }
                                if (parsed.suggested_questions) {
                                    suggestedQuestions = parsed.suggested_questions;
                                }
                            } else {
                                // Handle plain JSON response
                                const parsed = JSON.parse(line);
                                if (parsed.response) {
                                    fullResponse += parsed.response;
                                    this.updateMessage(assistantMessageId, fullResponse);
                                }
                                if (parsed.suggested_questions) {
                                    suggestedQuestions = parsed.suggested_questions;
                                }
                            }
                        } catch (e) {
                            this.debugLog('Could not parse streaming chunk:', line);
                        }
                    }
                }

                // Add suggested questions if any
                if (suggestedQuestions.length > 0) {
                    this.addSuggestedQuestions(suggestedQuestions);
                }

                this.setLoading(false);
                this.debugLog('Streaming message completed');
                
                // Post Lumi response to SessionMessages endpoint
                // Only include replyTo if userMessageId is available (don't include field if not available)
                if (currentSessionId && fullResponse) {
                    this.postMessageToSession(currentSessionId, 'lumi', 'user', fullResponse, userMessageId);
                }
                
                // Re-enable input after streaming response is complete
                this.setInputEnabled(true);

            } catch (error) {
                console.error('Error sending streaming message:', error);
                this.setLoading(false);
                this.addMessage('assistant', 'Sorry, I encountered an error. Please try again later.');
                
                // Re-enable input even on error
                this.setInputEnabled(true);
            }
        }

        addWelcomeMessages() {
            // Only add welcome messages if they haven't been added yet
            if (this.welcomeMessagesAdded) {
                this.debugLog('Welcome messages already added, skipping');
                return;
            }
            
            // Check if welcome messages are already in the DOM
            const messagesContainer = this.container.querySelector('#lumi-chat-messages');
            if (messagesContainer && messagesContainer.querySelectorAll('.lumi-chat-message').length > 0) {
                this.debugLog('Messages already in DOM, skipping welcome messages');
                this.welcomeMessagesAdded = true;
                return;
            }
            
            // If there are session messages, don't add welcome messages (they'll be restored by restoreMessagesToDOM)
            if (this.messages.length > 0) {
                this.debugLog('Session messages exist, skipping welcome messages (will be handled by restoreMessagesToDOM)');
                this.welcomeMessagesAdded = true;
                return;
            }
            
            this.debugLog('Adding welcome messages');
            this.welcomeMessagesAdded = true;
            
            // Add welcome messages to DOM only (not to session storage)
            setTimeout(() => {
                this.addMessageToDOM('assistant', "Hi, I'm LuMi, Lundbeck's AI-assisted chatbot. I am here to answer questions about VYEPTI® (eptinezumab-jjmr). The transcript of this chat will be stored for monitoring and compliance purposes.");
            }, 500);

            setTimeout(() => {
                this.addMessageToDOM('assistant', "What would you like to know? Type your question or choose from the following options.");
            }, 1000);

            setTimeout(() => {
                this.addMessageToDOM('assistant', '<a href="https://www.lundbeck.com/content/dam/lundbeck-com/americas/united-states/products/neurology/vyepti_pi_us_en.pdf" target="_blank">Prescribing Information</a>');
            }, 1500);

            setTimeout(() => {
                this.addMessageToDOM('assistant', "Ask a Question about VYEPTI");
            }, 2000);
        }
    }
    // CSS Styles
    const styles = `
        <style>
        /* CSS Variables for positioning */
        :root {
            --chat-polygon-width: 14px;
            --chat-polygon-height: 12px;
            --widget-button-height: 52px;
            --widget-polygon-top: 64px;
            --widget-polygon-left: 0px;
            --widget-window-top: 76px;
            --widget-window-right: 0px;
        }

        .lumi-assistant-widget {
            position: relative;
            z-index: 10000; /* ensure widget sits above site headers/overlays */
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: inline-block;
        }

        .lumi-chat-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: transparent;
            z-index: 9998;
            display: none;
            pointer-events: none;
        }

        .lumi-assistant-button {
            display: flex;
            align-items: center;
            gap: 5px;
            background: transparent;
            border: none;
            cursor: pointer;
            color: white;
            font-size: 16px;
            font-weight: 700;
            padding: 0;
            height: auto;
            position: relative;
            border-radius: 0;
        }

        .lumi-avatar {
            width: 52px;
            height: 52px;
            background: #D9D9D9;
            border: 1px solid #B5D9DD;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }

        .lumi-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .lumi-button-text {
            line-height: 1.2;
            text-align: left;
            font-family: 'Open Sans', Arial, sans-serif;
            font-weight: 700;
            font-size: 16px;
            color: white;
            width: 74px;
        }

        .lumi-chat-polygon {
            position: absolute !important;
            top: var(--widget-polygon-top) !important;
            left: var(--widget-polygon-left) !important;
            z-index: 10002;
            display: none;
        }

        .lumi-chat-polygon svg {
            width: var(--chat-polygon-width);
            height: var(--chat-polygon-height);
        }

        /* Desktop: Show polygon when landing window is visible */
        @media (min-width: 769px) {
            .lumi-assistant-widget.open:not(.chat-active) .lumi-chat-polygon,
            .lumi-assistant-widget:has(#lumi-landing-window-desktop:not(.lumi-landing-dismissed)) .lumi-chat-polygon,
            .lumi-landing-desktop:not(.lumi-landing-dismissed) ~ .lumi-chat-polygon,
            .lumi-assistant-widget:has(.lumi-landing-desktop:not(.lumi-landing-dismissed)) .lumi-chat-polygon,
            .lumi-chat-polygon[style*="display: block"] {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: absolute !important;
                z-index: 10004 !important; /* Above landing window (10003) */
            }
            
            /* Show polygon when chat window is visible on desktop */
            .lumi-assistant-widget.chat-active .lumi-chat-polygon,
            .lumi-assistant-widget:has(.lumi-chat-window:not([style*="display: none"])) .lumi-chat-polygon {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: absolute !important;
                z-index: 10002 !important;
            }
        }

        .lumi-landing-window {
            position: absolute;
            top: var(--widget-window-top) !important;
            right: var(--widget-window-right) !important;
            border-radius: 10px;
            border: none;
            z-index: 100000;
            display: none;
            overflow: visible;
            box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.10);
            pointer-events: auto;
        }

        /* Desktop landing window */
        .lumi-landing-desktop {
            width: 335px;
            height: 85px;
        }
        
        /* Desktop landing window - show by default on desktop */
        .lumi-landing-desktop {
            display: flex !important;
        }

        /* Mobile landing window - hide by default on desktop */
        .lumi-landing-mobile {
            height: 85px;
            display: none !important;
        }

        /* Hide landing window whenever chat is active */
        .lumi-assistant-widget.chat-active .lumi-landing-window {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
        }

        /* Desktop-specific landing styles */
        .lumi-landing-desktop .lumi-landing-header {
            position: absolute;
            top: 0px;
            left: 0px;
            width: 100%;
            height: 38px;
            padding: 10px;
            background: #B5D9DD;
            border-top-left-radius: 10px;
            border-top-right-radius: 10px;
            display: inline-flex;
            flex-direction: row;
            justify-content: flex-start;
            align-items: center;
            gap: 0;
            pointer-events: auto;
            box-sizing: border-box;
        }

        .lumi-landing-desktop .lumi-landing-header-content {
            width: 100%;
            display: inline-flex;
            gap: 34px;
            align-items: center;
            justify-content: flex-start;
        }

        .lumi-landing-desktop .lumi-landing-content {
            position: absolute;
            top: 46px;
            left: 21.50px;
            width: 288px;
            height: 31px;
            display: inline-flex;
            justify-content: flex-start;
            align-items: center;
            gap: 7px;
            pointer-events: auto;
        }

        .lumi-landing-buttons-container {
            display: inline-flex;
            gap: 10px;
            align-items: center;
            flex-direction: row;
        }

        #lumi-landing-start-btn {
            order: 1;
        }

        #lumi-landing-later-btn {
            order: 2;
        }

        .lumi-landing-title {
            flex: 1 1 0;
            justify-content: center;
            display: flex;
            flex-direction: column;
            color: #006186;
            font-size: 18px;
            font-family: 'Open Sans', sans-serif;
            font-weight: 700;
            line-height: 24px;
            word-wrap: break-word;
        }

        .lumi-landing-close-btn {
            width: 24px;
            height: 24px;
            position: relative;
            background: none;
            border: none;
            cursor: pointer;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .lumi-landing-close-btn img {
            width: 24px;
            height: 24px;
            object-fit: contain;
        }

        .lumi-landing-btn {
            height: 26px;
            padding: 5px 12px;
            background: white;
            border: 1px solid #D9D9D9;
            border-radius: 20px;
            display: flex;
            gap: 10px;
            align-items: center;
            justify-content: flex-start;
            cursor: pointer;
            color: #006186;
            font-size: 14px;
            font-family: 'Open Sans', sans-serif;
            font-weight: 600;
            line-height: 24px;
            white-space: nowrap;
            position: relative;
            z-index: 100001;
            pointer-events: auto;
            transition: all 0.2s ease;
        }

        .lumi-landing-btn:hover {
            background: #006186 !important;
            color: white !important;
            border-color: #006186 !important;
            transform: scale(1.05) !important;
        }

        .lumi-landing-btn:active {
            transform: scale(0.95) !important;
        }

        .lumi-landing-close-wrapper {
            width: 24px;
            height: 24px;
            position: relative;
        }

        .lumi-landing-bubble {
            flex: 1;
            padding: 5px 8px;
            background: #EFF6F9;
            border-radius: 5px;
            color: #4D4D4D;
            font-size: 14px;
            font-family: 'Open Sans', sans-serif;
            font-weight: 400;
            line-height: 24px;
        }

        .lumi-landing-buttons {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 10px;
        }


        .lumi-chat-window {
            position: absolute;
            top: var(--widget-window-top) !important;
            right: var(--widget-window-right) !important;
            width: 385px;
            height: 471px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            z-index: 10001;
            display: none;
            flex-direction: column;
            overflow: hidden;
            padding: 0;
            margin: 0;
            box-sizing: border-box;
        }

        .lumi-chat-header {
            background: #B5D9DD !important;
            color: #006186 !important;
            padding: 10px 15px;
            display: flex !important;
            justify-content: space-between;
            align-items: center;
            border-top-left-radius: 10px;
            border-top-right-radius: 10px;
            min-height: 40px;
            flex-shrink: 0;
            position: relative;
            z-index: 10;
            width: 100%;
            box-sizing: border-box;
            margin: 0;
            border: none;
        }

        .lumi-chat-title {
            font-size: 16px;
            font-weight: 600;
        }
        .lumi-close-btn {
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .lumi-chat-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 5px 19px 20px;
            gap: 15px;
            min-height: 0;
            height: 100%;
            pointer-events: auto;
        }

        .lumi-chat-messages-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }

        .lumi-chat-messages {
            flex: 1;
            overflow-y: auto;
            padding: 0 15px 0 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
            min-height: 0;
            max-height: 300px;
        }

        .lumi-avatar-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            height: 100%;
            max-height: none;
            background: #B5D9DD;
            border-radius: 8px;
            position: relative;
            overflow: hidden;
            pointer-events: auto;
        }

        .lumi-avatar-wrapper {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
            height: 100%;
            position: relative;
            pointer-events: auto;
        }

        .lumi-avatar-placeholder {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #000000;
            color: white;
            text-align: center;
            padding: 20px;
            pointer-events: none;
        }

        .lumi-avatar-loading {
            display: none;
        }

        .lumi-avatar-icon {
            display: none;
        }

        .lumi-avatar-loading h3 {
            display: none;
        }

        .lumi-avatar-loading p {
            display: none;
        }

        .lumi-avatar-iframe {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            border: none !important;
            background: #B5D9DD !important;
            z-index: 100 !important;
            object-fit: cover !important;
            pointer-events: auto !important;
        }
        
        .lumi-avatar-iframe * {
            width: 100% !important;
            height: 100% !important;
            max-height: none !important;
            object-fit: cover !important;
        }
        
        .lumi-avatar-iframe body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: 100vh !important;
            overflow: hidden !important;
        }
        
        .lumi-avatar-iframe #__next {
            width: 100% !important;
            height: 100vh !important;
            overflow: hidden !important;
        }
        
        /* Ensure video elements inside iframe fill the space and align to top */
        .lumi-avatar-iframe video {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
            object-position: top !important;
        }

        .lumi-avatar-controls {
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            padding: 10px;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 8px;
            display: none !important;
            justify-content: center;
            gap: 10px;
            z-index: 10;
            pointer-events: none !important;
        }

        .lumi-avatar-stop-btn {
            display: none !important;
        }

        .lumi-avatar-status {
            display: none;
            pointer-events: none !important;
        }

        .lumi-chat-message {
            display: flex;
            gap: 8px;
            align-items: flex-start;
        }

        .lumi-chat-message.user {
            justify-content: flex-end;
        }

        .lumi-chat-message.assistant {
            justify-content: flex-start;
        }

        .lumi-chat-avatar {
            width: 22px;
            height: 22px;
            flex-shrink: 0;
            margin-top: 2px;
            background: #EFF6F9;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }

        .lumi-chat-avatar img {
            width: 18px;
            height: 18px;
            object-fit: contain;
        }

        .lumi-chat-message-content {
            max-width: 80%;
            padding: 8px 12px;
            border-radius: 12px;
            font-size: 14px;
            line-height: 1.4;
            word-wrap: break-word;
        }

        .lumi-chat-message.user .lumi-chat-message-content {
            background: #006186;
            color: white;
            border-bottom-right-radius: 4px;
        }

        .lumi-chat-message.assistant .lumi-chat-message-content {
            background: #EFF6F9;
            color: #333;
            border-bottom-left-radius: 4px;
        }

        .lumi-suggested-questions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 8px;
        }

        .lumi-suggested-question {
            background: white;
            border: 1px solid #D9D9D9;
            border-radius: 20px;
            padding: 6px 12px;
            font-size: 12px;
            color: #006186;
            cursor: pointer;
            transition: all 0.2s;
        }

        .lumi-suggested-question:hover {
            background: #006186;
            color: white;
        }

        .lumi-ask-question-btn {
            background: white;
            border: 1px solid #D9D9D9;
            border-radius: 20px;
            padding: 6px 12px;
            font-size: 14px;
            font-family: 'Open Sans', sans-serif;
            font-weight: 600;
            color: #006186;
            cursor: pointer;
            transition: all 0.2s;
            outline: none;
            width: 100%;
            text-align: left;
            margin: 0;
        }

        .lumi-ask-question-btn:hover {
            background: #006186;
            color: white;
        }

        .lumi-ask-question-btn:focus {
            outline: 1px #D9D9D9 solid;
            outline-offset: -1px;
        }

        .lumi-ask-question-btn:focus-visible {
            outline: 1px #D9D9D9 solid;
            outline-offset: -1px;
        }

        .lumi-ask-question-btn:disabled,
        .lumi-ask-question-btn.disabled {
            opacity: 0.6;
            cursor: not-allowed !important;
            pointer-events: none;
        }

        .lumi-ask-question-btn:disabled:hover,
        .lumi-ask-question-btn.disabled:hover {
            background: white;
            color: #006186;
        }

        .lumi-chat-input-container {
            display: flex;
            flex-direction: column;
            gap: 15px;
            flex-shrink: 0;
            margin-top: auto;
        }

        .lumi-chat-mode-buttons {
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 20px;
            margin-top: 10px;
            flex-shrink: 0;
        }
        .lumi-mode-btn {
            height: 31px;
            padding-left: 12px;
            padding-right: 12px;
            border-radius: 40px;
            outline: 1px #D9D9D9 solid;
            outline-offset: -1px;
            justify-content: center;
            align-items: center;
            gap: 10px;
            display: flex;
            cursor: pointer;
            border: none;
            transition: all 0.2s ease;
        }

        .lumi-mode-btn:focus {
            outline: 1px #D9D9D9 solid;
            outline-offset: -1px;
        }

        .lumi-mode-btn:focus-visible {
            outline: 1px #D9D9D9 solid;
            outline-offset: -1px;
        }

        .lumi-ai-btn {
            background: white;
        }

        .lumi-ai-btn.active {
            background: #006186;
        }

        .lumi-ai-btn:not(.active) {
            background: white;
        }

        .lumi-ai-btn:focus {
            outline: 1px #D9D9D9 solid;
            outline-offset: -1px;
        }

        .lumi-ai-btn:focus-visible {
            outline: 1px #D9D9D9 solid;
            outline-offset: -1px;
        }

        .lumi-text-btn {
            background: white;
        }

        .lumi-text-btn.active {
            background: #006186;
        }

        .lumi-text-btn:not(.active) {
            background: white;
        }

        .lumi-text-btn:focus {
            outline: 1px #D9D9D9 solid;
            outline-offset: -1px;
        }

        .lumi-text-btn:focus-visible {
            outline: 1px #D9D9D9 solid;
            outline-offset: -1px;
        }

        .lumi-btn-content {
            justify-content: flex-start;
            align-items: center;
            gap: 5px;
            display: flex;
        }

        .lumi-btn-text {
            text-align: center;
            justify-content: center;
            display: flex;
            flex-direction: column;
            font-size: 14px;
            font-family: 'Open Sans', sans-serif;
            font-weight: 700;
            line-height: 14px;
            word-wrap: break-word;
        }

        .lumi-ai-btn .lumi-btn-text {
            color: #006186;
        }

        .lumi-ai-btn.active .lumi-btn-text {
            color: white;
        }

        .lumi-text-btn .lumi-btn-text {
            color: #006186;
        }

        .lumi-text-btn.active .lumi-btn-text {
            color: white;
        }

        .lumi-btn-icon {
            width: 18px;
            height: 19px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .lumi-btn-icon svg {
            width: 18px;
            height: 19px;
        }

        .lumi-ai-btn .lumi-btn-icon svg {
            color: #006186;
        }

        .lumi-ai-btn.active .lumi-btn-icon svg {
            color: white;
        }

        .lumi-text-btn .lumi-btn-icon svg {
            color: #006186;
        }

        .lumi-text-btn.active .lumi-btn-icon svg {
            color: white;
        }

        .lumi-chat-input-form {
            width: 317px;
            max-width: 100%;
            display: flex;
            justify-content: center;
        }

        .lumi-chat-input-wrapper {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 8px;
            border: 1px solid #D9D9D9;
            border-radius: 10px;
            background: white;
        }
        .lumi-chat-input-wrapper textarea {
            flex: 1;
            border: none;
            outline: none;
            resize: none;
            font-size: 14px;
            font-family: inherit;
            min-height: 20px;
            max-height: 120px;
            padding: 0;
        }
        .lumi-chat-send-icon {
            width: 26px;
            height: 26px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            cursor: pointer;
            background: none;
            border: none;
            padding: 0;
        }

        .lumi-send-icon-inactive {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .lumi-send-icon-active {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .lumi-chat-footnote {
            font-size: 12px;
            line-height: 15px;
            color: #4D4D4D;
            text-align: left;
            width: 345px;
            margin: 0 auto;
            word-wrap: break-word;
            white-space: normal;
            display: -webkit-box;
            -webkit-line-clamp: 5;
            -webkit-box-orient: vertical;
            overflow: hidden;
            font-family: 'Open Sans', sans-serif;
            font-weight: 400;
        }

        .lumi-chat-footnote a {
            color: #006186 !important;
            font-size: 12px;
            font-family: 'Open Sans', sans-serif;
            font-weight: 600;
            text-decoration: underline !important;
            line-height: 15px;
            word-wrap: break-word;
        }

        .lumi-chat-footnote a:hover {
            text-decoration: underline !important;
            opacity: 0.8 !important;
        }

        .lumi-loading-text {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .lumi-loading-dots {
            animation: lumi-loading-dots 1.5s infinite;
        }

        @keyframes lumi-loading-dots {
            0%, 20% {
                opacity: 0;
            }
            50% {
                opacity: 1;
            }
            100% {
                opacity: 0;
            }
        }

        /* Markdown formatting styles */
        .lumi-chat-message-content h1 {
            font-size: 18px;
            font-weight: bold;
            margin: 8px 0 4px 0;
            color: #333;
        }

        .lumi-chat-message-content h2 {
            font-size: 16px;
            font-weight: bold;
            margin: 6px 0 3px 0;
            color: #333;
        }

        .lumi-chat-message-content h3 {
            font-size: 14px;
            font-weight: bold;
            margin: 4px 0 2px 0;
            color: #333;
        }

        .lumi-chat-message-content ul, .lumi-chat-message-content ol {
            margin: 4px 0;
            padding-left: 20px;
        }

        .lumi-chat-message-content li {
            margin: 2px 0;
        }

        .lumi-chat-message-content pre {
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 8px;
            margin: 4px 0;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
            font-size: 12px;
        }

        .lumi-chat-message-content code {
            background: #f5f5f5;
            border: 1px solid #ddd;
            border-radius: 3px;
            padding: 2px 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
        }

        .lumi-chat-message-content p {
            margin: 4px 0;
        }

        .lumi-chat-message-content strong {
            font-weight: bold;
        }

        .lumi-chat-message-content em {
            font-style: italic;
        }

        .lumi-chat-message.user .lumi-chat-message-content a {
            color: #bae6fd !important;
        }

        .lumi-chat-message.assistant .lumi-chat-message-content a {
            color: #006186 !important;
            text-decoration: underline !important;
        }

        /* Additional link styling to prevent external CSS override */
        .lumi-chat-message-content a {
            text-decoration: underline !important;
            font-weight: inherit !important;
        }

        .lumi-chat-message-content a:hover {
            opacity: 0.8 !important;
        }

        /* Responsive design */

        @media (max-width: 768px) {
            .lumi-assistant-widget {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 0 !important; /* children are absolutely positioned */
                z-index: 10000 !important;
                pointer-events: none; /* allow clicks to pass except on children */
            }

            .lumi-assistant-button {
                margin-left: 0;
                margin-top: 0;
                order: 2;
            }
            
            .lumi-button-text {
                display: none !important;
            }

            /* Hide desktop landing window on mobile */
            .lumi-landing-desktop {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
            }

            /* Mobile landing window is hidden by default - only shown via JavaScript after button is rendered */
            /* Do NOT show via CSS - always use JavaScript positioning based on button position */
            .lumi-landing-mobile {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
            }
            
            /* Keep dismissed landing windows hidden */
            .lumi-landing-mobile.lumi-landing-dismissed {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
            
            /* Show polygon when landing window is visible on mobile - polygon must be above landing window */
            .lumi-landing-mobile:not(.lumi-landing-dismissed) ~ .lumi-chat-polygon,
            .lumi-assistant-widget:has(.lumi-landing-mobile:not(.lumi-landing-dismissed)) .lumi-chat-polygon {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: fixed !important;
                top: var(--widget-polygon-top) !important;
                left: var(--widget-polygon-left) !important;
                z-index: 10004 !important; /* Higher than landing window (10003) so polygon renders on top */
            }
            
            /* Show polygon when chat window is visible on mobile - CRITICAL: Must have high specificity */
            .lumi-assistant-widget.chat-active .lumi-chat-polygon,
            .lumi-assistant-widget.chat-active .lumi-chat-polygon[style*="display: block"],
            .lumi-chat-window:not([style*="display: none"]) ~ .lumi-chat-polygon,
            .lumi-assistant-widget:has(.lumi-chat-window:not([style*="display: none"])) .lumi-chat-polygon {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: fixed !important;
                top: var(--widget-polygon-top) !important;
                left: var(--widget-polygon-left) !important;
                z-index: 10002 !important;
            }
            
            /* Default: Show polygon on mobile when widget is open (either landing or chat visible) */
            /* This must come after the default .lumi-chat-polygon rule to override display: none */
            .lumi-assistant-widget.open .lumi-chat-polygon,
            .lumi-assistant-widget.open ~ .lumi-chat-polygon,
            body:has(.lumi-assistant-widget.open) .lumi-chat-polygon {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: fixed !important;
                top: var(--widget-polygon-top) !important;
                left: var(--widget-polygon-left) !important;
                z-index: 10002 !important;
            }
            
            /* Force show polygon on mobile when widget container has open class or landing window is visible */
            @media (max-width: 768px) {
                .lumi-assistant-widget.open .lumi-chat-polygon,
                body .lumi-assistant-widget.open ~ .lumi-chat-polygon,
                body:has(.lumi-assistant-widget.open) .lumi-chat-polygon,
                .lumi-landing-mobile:not(.lumi-landing-dismissed) ~ .lumi-chat-polygon,
                .lumi-assistant-widget:has(.lumi-landing-mobile:not(.lumi-landing-dismissed)) .lumi-chat-polygon,
                .lumi-chat-polygon[style*="display: block"] {
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    position: fixed !important;
                }
            }
            
            /* Hide polygon only when widget is closed (not open AND not chat-active) AND landing is dismissed AND chat is not visible */
            /* This rule must come BEFORE the show rules so show rules can override it */
            .lumi-assistant-widget:has(.lumi-landing-mobile.lumi-landing-dismissed):not(.chat-active):not(.open) .lumi-chat-polygon {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
            }
            
            
            .lumi-landing-window:not(.lumi-landing-dismissed) {
                width: 335px !important;
                height: 91px !important;
                top: var(--widget-window-top) !important;
                right: var(--widget-window-right) !important;
                position: fixed !important;
                z-index: 10003 !important; /* Lower than polygon so polygon appears on top */
                display: flex !important;
                pointer-events: auto;
            }
            
            /* Keep dismissed landing windows hidden */
            .lumi-landing-window.lumi-landing-dismissed {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
            
            /* Ensure mobile landing buttons are clickable */
            .lumi-landing-mobile .lumi-landing-header,
            .lumi-landing-mobile .lumi-landing-content,
            .lumi-landing-mobile .lumi-landing-btn {
                pointer-events: auto !important;
                z-index: 1000 !important;
            }
            
            .lumi-chat-window {
                width: min(385px, 92vw) !important;
                max-width: min(385px, 92vw) !important;
                height: min(65vh, 420px);
                max-height: 420px;
                top: var(--widget-window-top) !important;
                right: var(--widget-window-right) !important;
                left: auto !important;
                transform: none !important;
                pointer-events: auto;
            }

            /* Ensure landing is hidden on mobile when chat is active */
            .lumi-assistant-widget.chat-active .lumi-landing-window {
                display: none !important;
            }
            
            .lumi-chat-content {
                padding: 5px 15px 15px;
                max-width: 100%;
                box-sizing: border-box;
            }
            
            .lumi-chat-messages {
                max-width: 100%;
                box-sizing: border-box;
            }
            
            .lumi-chat-message-content {
                max-width: 100%;
                word-wrap: break-word;
                overflow-wrap: break-word;
            }
            
            .lumi-chat-input-form {
                width: 100%;
                max-width: 100%;
                box-sizing: border-box;
            }
            
            .lumi-chat-input-wrapper {
                max-width: 100%;
                box-sizing: border-box;
                margin-top: 5px;
            }
            
            .lumi-chat-footnote {
                width: 100%;
                max-width: 100%;
                font-size: 12px;
                line-height: 15px;
                box-sizing: border-box;
                word-wrap: break-word;
            }
        }

        /* Small phones (<=430px) */
        @media (max-width: 430px) {
            .lumi-landing-window {
                width: 335px !important;
                max-width: calc(100vw - 20px) !important;
            }
            .lumi-landing-header {
                width: 100% !important;
                top: 0px !important;
            }
            .lumi-landing-content {
                left: 14px;
                width: calc(100% - 28px);
            }
            .lumi-chat-window {
                width: calc(100vw - 20px);
                max-width: calc(100vw - 20px);
            }
            .lumi-chat-input-form {
                width: 100% !important;
            }
            .lumi-chat-footnote {
                font-size: 12px;
                line-height: 15px;
            }
        }

        /* Compact phones (<=390px) */
        @media (max-width: 390px) {
            .lumi-button-text { display: none !important; }
            .lumi-chat-window { height: min(78vh, 440px); }
            .lumi-chat-footnote { font-size: 12px; line-height: 15px; }
        }

        /* Extra small (<=360px) */
        @media (max-width: 360px) {
            .lumi-chat-window { height: min(75vh, 420px); }
            .lumi-chat-content { padding: 4px 12px 12px; }
            .lumi-chat-footnote { font-size: 12px; line-height: 15px; }
        }

        /* Short viewports */
        @media (max-height: 700px) {
            .lumi-chat-window { height: 70vh; }
        }
        </style>
    `;

    // Add styles to head
    if (!document.getElementById('lumi-assistant-widget-styles')) {
        const styleElement = document.createElement('div');
        styleElement.id = 'lumi-assistant-widget-styles';
        styleElement.innerHTML = styles;
        document.head.appendChild(styleElement);
    }

    // Initialize widget when DOM is ready
    function initWidget() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                window.lumiAssistantWidget = new LuMiAssistantWidget(config);
            });
        } else {
            window.lumiAssistantWidget = new LuMiAssistantWidget(config);
        }
    }

    initWidget();
})();