// Create AIChatWidget namespace
      window.AIChatWidget = {
        _contactIdentifier: null, // Store contact identifier here
        _widgetConversationThreadId: null, // Store our internal DB thread ID

        getContactIdentifier: function() {
          if (!this._contactIdentifier) {
            const localStorageKey = 'aiChatWidgetUserIdentifier_' + "6847bd6fab8663acbc87ab50"; // Make it widget-specific
            let storedId = null;
            try {
              storedId = localStorage.getItem(localStorageKey);
            } catch (e) { console.warn('AIChatWidget: localStorage not accessible.'); }
            
            if (storedId) {
              this._contactIdentifier = storedId;
            } else {
              // Simple UUID v4 generator
              const generateUUID = () => {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                  var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                  return v.toString(16);
                });
              };
              this._contactIdentifier = generateUUID();
              try {
                localStorage.setItem(localStorageKey, this._contactIdentifier);
              } catch (e) { console.warn('AIChatWidget: localStorage not accessible for saving new ID.'); }
            }
          }
          return this._contactIdentifier;
        },

        setWidgetConversationThreadId: function(threadId) {
          this._widgetConversationThreadId = threadId;
        },

        getWidgetConversationThreadId: function() {
          return this._widgetConversationThreadId;
        },

        init: function(config) {
          // MODIFIED: Instead of checking the host where the widget is embedded,
          // we'll extract the domain from where this script was loaded
          var getScriptDomain = function() {
            // Try to find this script element
            var scripts = document.querySelectorAll('script');
            var currentScript = null;
            
            for (var i = 0; i < scripts.length; i++) {
              var src = scripts[i].src || '';
              if (src.indexOf('/widget/') > -1 && src.indexOf('/widget.js') > -1) {
                currentScript = scripts[i];
                break;
              }
            }
            
            if (currentScript && currentScript.src) {
              var a = document.createElement('a');
              a.href = currentScript.src;
              // Return the origin (protocol + domain + port)
              return a.origin;
            }
            
            // Fallback to testmyprompt.com if we can't determine the script origin
            return 'https://testmyprompt.com';
          };
          
          // Use the domain from where the widget script was loaded
          var apiHost = getScriptDomain();
          
          // Only required parameter is widgetId
          if (!config || !config.widgetId) {
            console.error('AIChatWidget: Missing required parameter widgetId');
            return;
          }

          const widgetId = config.widgetId;
          // For backwards compatibility: handle case where all settings are passed client-side
          const clientSuppliedSettings = (config.theme || config.themeColor || config.showFirstMessage !== undefined) ? config : null;
          
          // If no client settings, fetch settings from server
          if (!clientSuppliedSettings) {
            // Start fetching settings from the server - use the same domain as the script
            const settingsUrl = `${apiHost}/api/widget/${widgetId}/settings`;
            console.log('AIChatWidget: Fetching settings from', settingsUrl);
            fetch(settingsUrl)
              .then(response => {
                if (!response.ok) {
                  throw new Error('Settings endpoint returned ' + response.status);
                }
                return response.json();
              })
              .then(serverSettings => {
                // Call init again with combined settings
                this.initWithSettings({
                  ...serverSettings,
                  widgetId: widgetId,
                  baseUrl: config.baseUrl || apiHost
                });
              })
              .catch(err => {
                console.error('AIChatWidget: Failed to load settings from server', err);
                // Continue with default settings
                this.initWithSettings({ 
                  widgetId: widgetId,
                  baseUrl: config.baseUrl || apiHost
                });
              });
          } else {
            // Client has already provided settings, use them directly
            this.initWithSettings(config);
          }
        },
        
        // Actual initialization function that takes complete settings
        initWithSettings: function(config) {
          // Ensure contactIdentifier is initialized at the beginning of initWithSettings
          this.getContactIdentifier(); // This will generate and store if not already present

          // Define defaults within the client-side scope (serialized from server)
          const defaultSettings = {"theme":"dark","themeColor":"#1F51FF","showFirstMessage":true,"firstMessage":"Hello! How can I help you today?","logoUrl":"","logoWidth":100,"logoCropPosition":{"x":50,"y":50},"logoScale":1,"widgetLogoCropPosition":{"x":50,"y":50},"widgetLogoScale":1,"useLogoForAvatar":false,"useLogoForMinimizedWidget":false,"dailyLimit":200,"widgetTitle":"Relay AI Bot","width":400,"height":500,"minimizedSize":"large","placement":"bottom-right","inputPlaceholder":"Type your message...","typingIndicator":"typing...","chatBubble":{"enabled":true,"message":"Hi there! Need any help?","delaySeconds":3}};
          
          // Get the apiHost value from the parent function if it exists
          var apiHost = typeof getScriptDomain === 'function' ? getScriptDomain() : 'https://testmyprompt.com';
          
          // Merge default DB settings with any overrides supplied at init()
          const finalSettings = { ...defaultSettings, ...config };
          
          // Ensure baseUrl is set (default to apiHost if not provided)
          finalSettings.baseUrl = finalSettings.baseUrl || apiHost;

          // --- Start Client-Side Widget Setup ---
          
          // Add Manrope font (if not already added)
          if (!document.querySelector('link[href*="family=Manrope"]')) {
            const preconnect = document.createElement('link');
            preconnect.rel = 'preconnect';
            preconnect.href = 'https://fonts.googleapis.com';
            document.head.appendChild(preconnect);

            const preconnect2 = document.createElement('link');
            preconnect2.rel = 'preconnect';
            preconnect2.href = 'https://fonts.gstatic.com';
            preconnect2.crossOrigin = 'anonymous';
            document.head.appendChild(preconnect2);

            const fontLink = document.createElement('link');
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&display=swap';
            fontLink.rel = 'stylesheet';
            document.head.appendChild(fontLink);
          }
          
          // Add base styles (if not already added)
          if (!document.getElementById('ai-chat-widget-base-styles')) {
             const styleSheet = document.createElement('style');
             styleSheet.id = 'ai-chat-widget-base-styles';
             // Base styles independent of finalSettings
             styleSheet.textContent = `.ai-chat-widget, .ai-chat-widget * { font-family: 'Manrope', sans-serif !important; box-sizing: border-box; }`;
              document.head.appendChild(styleSheet);
             // Add dynamic styles that DEPEND on finalSettings AFTER finalSettings is defined
             const dynamicStyleSheet = document.createElement('style');
             dynamicStyleSheet.textContent = `
               /* Mobile adjustments based on final width */
               @media screen and (max-width: ${finalSettings.width}px) {
                 #ai-chat-widget-container {
                    width: 100% !important;
                    height: 100% !important;
                    max-width: none !important;
                    max-height: none !important;
                    position: fixed !important;
                    top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
                    margin: 0 !important;
                 }
                 .ai-chat-widget {
                     width: 100% !important;
                     height: 100% !important;
                     border-radius: 0 !important;
                 }
               }
             `;
             document.head.appendChild(dynamicStyleSheet);
           }

          const widgetId = finalSettings.widgetId;
          if (!widgetId) { console.error('Widget ID is required'); return; }

          // --- DOM Element Creation & Styling ---
          
          // Helper Functions (defined within init scope)
          const getPlacementStyles = (placement) => {
            const base = { position: 'fixed', margin: '20px' };
            switch(placement) {
              case 'bottom-left': return { ...base, bottom: '20px', left: '20px', transformOrigin: 'bottom left' };
              case 'top-right': return { ...base, top: '20px', right: '20px', transformOrigin: 'top right' };
              case 'top-left': return { ...base, top: '20px', left: '20px', transformOrigin: 'top left' };
              default: return { ...base, bottom: '20px', right: '20px', transformOrigin: 'bottom right' }; // bottom-right default
            }
          };
          const getMinimizedSize = (size) => {
             const sizes = { small: { button: 48 }, medium: { button: 64 }, large: { button: 80 } };
             return sizes[size] || sizes.medium; // Default to medium
          };

          const placement = finalSettings.placement || 'bottom-right';
          const placementStyles = getPlacementStyles(placement);
          const sizeConfig = getMinimizedSize(finalSettings.minimizedSize);
          
          // Widget Container
          let container = document.getElementById('ai-chat-widget-container');
          if (!container) {
            container = document.createElement('div');
            container.id = 'ai-chat-widget-container';
            document.body.appendChild(container);
          }
          Object.assign(container.style, {
            ...placementStyles,
            width: finalSettings.width + 'px',
            height: 'auto', // Height adjusts based on open/closed state
            zIndex: '9999',
            transition: 'all 0.3s ease',
            pointerEvents: 'none', // Allow clicks only on button/iframe
          });
          
          // Iframe Container (initially hidden)
          const iframeContainer = document.createElement('div');
          iframeContainer.className = 'ai-chat-widget';
          iframeContainer.style.cssText = `
            display: none;
            width: 100%;
            height: ${finalSettings.height}px;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: all 0.3s ease;
            transform-origin: ${placementStyles.transformOrigin};
            pointer-events: auto;
            background-color: #020817;
          `;
          
          // Create the Iframe first
          const iframe = document.createElement('iframe');
          Object.assign(iframe.style, {            width: '100%',            height: '100%',            border: 'none',          });
          
          // Make sure we have a valid baseUrl - finalSettings.baseUrl is guaranteed to be set 
          // (defaults to testmyprompt.com if not provided)
          let iframeBaseUrl = finalSettings.baseUrl;
          if (iframeBaseUrl.startsWith('file://')) {
            // Safety fallback for local development only
            console.warn('AIChatWidget: baseUrl started with file://, falling back to https://testmyprompt.com');
            iframeBaseUrl = apiHost;
          }
          
          const iframeSrc = `${iframeBaseUrl}/widget/${widgetId}?theme=${finalSettings.theme}&themeColor=${encodeURIComponent(finalSettings.themeColor)}`;
          // console.log('AIChatWidget: Loading iframe source:', iframeSrc);
          iframe.src = iframeSrc;          
          // Append iframe to its container
          iframeContainer.appendChild(iframe);          
          // Minimized Button
          const minimizedButton = document.createElement('button'); // Use button for better accessibility
          minimizedButton.className = 'minimized-button';
          minimizedButton.setAttribute('aria-label', 'Open chat widget');
          Object.assign(minimizedButton.style, {            width: sizeConfig.button + 'px',
            height: sizeConfig.button + 'px',
            borderRadius: '50%',
            backgroundColor: finalSettings.themeColor || '#276d64',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            padding: '0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            transition: 'transform 0.2s ease',
            pointerEvents: 'auto',
            position: 'absolute', // Position relative to container now
            bottom: '0px',
            right: '0px', // Default position within container corner
          });
          // Adjust button position based on placement (relative to container edges)
          if (placement.includes('left')) { minimizedButton.style.right = 'auto'; minimizedButton.style.left = '0px'; }
          if (placement.includes('top')) { minimizedButton.style.bottom = 'auto'; minimizedButton.style.top = '0px'; }

          // Set button content (Logo or Icon)
          const logoSize = sizeConfig.button * 0.6;
          
          if (finalSettings.logoUrl && finalSettings.useLogoForMinimizedWidget) {
            // Create container div for the logo
            const logoContainer = document.createElement('div');
            logoContainer.style.width = logoSize + 'px';
            logoContainer.style.height = logoSize + 'px';
            logoContainer.style.overflow = 'hidden';
            logoContainer.style.borderRadius = '50%';
            logoContainer.style.display = 'flex';
            logoContainer.style.alignItems = 'center';
            logoContainer.style.justifyContent = 'center';
            
            // Create the image element
            const logoImg = document.createElement('img');
            logoImg.src = finalSettings.logoUrl;
            logoImg.alt = 'Chat';
            logoImg.style.width = '100%';
            logoImg.style.height = '100%';
            logoImg.style.objectFit = 'cover';
            logoImg.style.objectPosition = (finalSettings.widgetLogoCropPosition?.x || 50) + '% ' + (finalSettings.widgetLogoCropPosition?.y || 50) + '%';
            logoImg.style.transform = 'scale(' + (finalSettings.widgetLogoScale || 1) + ')';
            
            // Append the image to the container
            logoContainer.appendChild(logoImg);
            
            // Append the container to the button
            minimizedButton.appendChild(logoContainer);
          } else {
            // Use SVG for default icon
            const svgWidth = logoSize * 0.7;
            const svgHeight = logoSize * 0.7;
            minimizedButton.innerHTML = '<svg width="' + svgWidth + '" height="' + svgHeight + '" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
          }
          
          // Chat Bubble (conditionally created)
          let chatBubble = null;
          if (finalSettings.chatBubble.enabled) {
            chatBubble = document.createElement('div');
            chatBubble.className = 'ai-chat-widget-bubble'; // Use a class for easier targeting
            Object.assign(chatBubble.style, {              position: 'absolute',
              padding: '14px 16px',
              backgroundColor: '#020817',
              color: '#fff',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              maxWidth: '260px',
              minWidth: '200px',
              opacity: '0',
              transform: 'translateY(10px)',
              transition: 'opacity 0.3s ease, transform 0.3s ease',
              zIndex: '9998',
              pointerEvents: 'none', // Bubble itself isn't clickable
              fontFamily: 'Manrope, sans-serif',
              fontSize: '15px',
              lineHeight: '1.6',
            });
            // Position bubble relative to button
            if (placement.includes('bottom')) { chatBubble.style.bottom = (sizeConfig.button + 12) + 'px'; } 
            else { chatBubble.style.top = (sizeConfig.button + 12) + 'px'; }
            if (placement.includes('right')) { chatBubble.style.right = '0px'; } 
            else { chatBubble.style.left = '0px'; }

            // Bubble Content + Close Button
            chatBubble.innerHTML = `
              <div style="position: relative; padding-right: 24px; pointer-events: auto;">
                ${finalSettings.chatBubble.message}
                <button aria-label="Close chat bubble" style="position: absolute; top: -4px; right: -4px; padding: 4px; cursor: pointer; background: none; border: none; color: inherit; opacity: 0.7; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <div style="position: absolute; width: 16px; height: 16px; background: inherit; transform: rotate(45deg); z-index: -1; box-shadow: ${placement.includes('bottom') ? '2px 2px 4px rgba(0,0,0,0.05)' : '-2px -2px 4px rgba(0,0,0,0.05)'}; ${placement.includes('bottom') ? 'bottom: -8px;' : 'top: -8px;'} ${placement.includes('right') ? 'right: 24px;' : 'left: 24px;'}"></div>
            `;

            // Bubble Close Logic
            chatBubble.querySelector('button').onclick = (e) => {
              e.stopPropagation();
              chatBubble.style.opacity = '0';
              chatBubble.style.transform = 'translateY(10px)';
              setTimeout(() => chatBubble?.remove(), 300);
            };
          }

          // --- Widget State & Logic ---
          let isOpen = false;
          let bubbleTimeout = null;

          // Restore open/closed state from localStorage
          const persistedOpen = localStorage.getItem('aiChatWidgetOpen') === '1';

          function showBubble() {
            if (chatBubble && !isOpen && !document.contains(chatBubble)) { // Only show if enabled, widget closed, and not already shown
              container.appendChild(chatBubble);
              requestAnimationFrame(() => { // Ensure element is in DOM for transition
                 chatBubble.style.opacity = '1';
                 chatBubble.style.transform = 'translateY(0)';
              });
            }
          }
          
          function hideBubble() {
             if (chatBubble && document.contains(chatBubble)) {
                chatBubble.style.opacity = '0';
                chatBubble.style.transform = 'translateY(10px)';
                setTimeout(() => chatBubble?.remove(), 300);
             }
             if (bubbleTimeout) clearTimeout(bubbleTimeout);
          }

          function openWidget() {
            if (isOpen) return;
            isOpen = true;
            // Persist open state
            localStorage.setItem('aiChatWidgetOpen', '1');
            hideBubble();
            iframeContainer.style.display = 'block';
            minimizedButton.style.display = 'none';
            // Adjust container size for open widget
            container.style.height = finalSettings.height + 'px'; 
            container.style.pointerEvents = 'auto';
            // Mobile body scroll lock
            if (window.innerWidth <= finalSettings.width) { document.body.style.overflow = 'hidden'; }
          }

          function closeWidget() {
             if (!isOpen) return;
             isOpen = false;
             // Persist closed state
             localStorage.setItem('aiChatWidgetOpen', '0');
             iframeContainer.style.display = 'none';
             minimizedButton.style.display = 'flex';
             // Reset container size
             container.style.height = 'auto';
             container.style.pointerEvents = 'none'; // Only button is active
             minimizedButton.style.pointerEvents = 'auto'; // Ensure button is clickable
             document.body.style.overflow = ''; // Restore scroll
             // Restart bubble timer if enabled
             if (finalSettings.chatBubble.enabled) {
                bubbleTimeout = setTimeout(showBubble, (finalSettings.chatBubble.delaySeconds || 2) * 1000);
             }
          }

          // --- Event Listeners ---
          minimizedButton.onclick = openWidget;
          minimizedButton.onmouseenter = () => { minimizedButton.style.transform = 'scale(1.1)'; };
          minimizedButton.onmouseleave = () => { minimizedButton.style.transform = 'scale(1)'; };

          // Listen for messages from iframe (e.g., to request contactIdentifier or to close)
          window.addEventListener('message', (event) => {
            // Optional: Add origin check for security event.origin === 'YOUR_IFRAME_ORIGIN'
            if (event.data === 'close-widget') {
              closeWidget();
            }
            // The iframe will postMessage when it needs identifiers or has created a new internal thread ID
            if (event.data && event.data.type === 'AIChatWidgetInternal') {
              if (event.data.action === 'getIdentifiers' && event.source === iframe.contentWindow) {
                event.source.postMessage({
                  type: 'AIChatWidgetInternalResponse',
                  action: 'identifiers',
                  contactIdentifier: this.getContactIdentifier(),
                  widgetConversationThreadId: this.getWidgetConversationThreadId()
                }, '*'); // Consider specifying target origin if possible
              }
              if (event.data.action === 'setWidgetConversationThreadId' && event.data.threadId) {
                this.setWidgetConversationThreadId(event.data.threadId);
              }
            }
          });

          // --- Initialization ---
          container.appendChild(iframeContainer);
          container.appendChild(minimizedButton);
          
          // Restore open/closed state after DOM is set up
          if (persistedOpen) {
            openWidget();
          }
          
          // Initial bubble display timer
          if (finalSettings.chatBubble.enabled) {
            const bubbleDelaySeconds = finalSettings.chatBubble.delaySeconds || 2;
            // console.log('Setting chat bubble to appear after ' + bubbleDelaySeconds + ' seconds');
            bubbleTimeout = setTimeout(showBubble, bubbleDelaySeconds * 1000);
          }
          
          // console.log('AIChatWidget initialized with settings:', finalSettings);
        }
      };