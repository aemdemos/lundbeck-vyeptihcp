/* eslint-disable no-console */

import { pushToAdobeDataLayer, DATA_LAYER_CONFIG } from './datalayer.js';

function isLumiWidgetEvent(envelope) {
  return Boolean(envelope) && envelope.type === 'lumi-widget-event';
}

var ALLOWED_LUMI_ORIGIN_PATTERNS = [
  /(^|\.)lumi-virtual-ai-asst\.com$/,
  /(^|\.)norta\.ai$/,
];

function isAllowedLumiOrigin(originString) {
  if (!originString) return false;
  if (originString === window.location.origin) return true;
  try {
    var host = new URL(originString).hostname;
    return ALLOWED_LUMI_ORIGIN_PATTERNS.some(function (pattern) {
      return pattern.test(host);
    });
  } catch (e) {
    return false;
  }
}

function getCurrentPageName() {
  var fromAttr = document && document.body && document.body.getAttribute('data-page-name');
  if (fromAttr && fromAttr.trim() !== '') {
    return fromAttr.trim();
  }
  return document.title || null;
}

function formatChatMode(mode) {
  if (typeof mode !== 'string') return mode;
  var lower = mode.toLowerCase();
  return lower === 'ai' ? 'AI' : lower;
}

function yesNo(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return value;
}

function normalizeFieldValue(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    var trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  }
  return value;
}

function normalizeWidgetInfo(widgetInfo) {
  var result = {};
  Object.keys(widgetInfo).forEach(function (key) {
    result[key] = normalizeFieldValue(widgetInfo[key]);
  });
  return result;
}

function pushChatEventToDataLayer(widgetEvent) {
  if (!widgetEvent || !widgetEvent.eventType) return;

  var data = widgetEvent.data || {};
  var meta = {
    timeStamp: new Date(widgetEvent.timestamp || Date.now()).toISOString(),
  };
  var chatEvents = DATA_LAYER_CONFIG.chatEvents;
  var chatMeta = DATA_LAYER_CONFIG.chatMeta;
  var lumiSessionId = window.sessionStorage.getItem('lumiSessionId');
  var payload;

  switch (widgetEvent.eventType) {
    case 'assistant-button-clicked': {
      var pageName = getCurrentPageName();
      var assistantEventName = pageName
        ? chatMeta.eventNameAssistantClicked + ' on ' + pageName
        : chatMeta.eventNameAssistantClicked;
      payload = {
        event: chatEvents.CHAT_ASSISTANT_CLICKED,
        eventInfo: { eventName: assistantEventName },
        widgetInfo: {
          action: data.action,
          buttonId: data.buttonId,
          source: data.source,
        },
        meta: meta,
      };
      break;
    }
    case 'start-chatting':
      payload = {
        event: chatEvents.CHAT_START,
        eventInfo: { eventName: chatMeta.eventNameStart },
        widgetInfo: {
          buttonId: data.buttonId,
          source: data.source,
        },
        meta: meta,
      };
      break;
    case 'try-later':
      payload = {
        event: chatEvents.CHAT_DEFERRED,
        eventInfo: { eventName: chatMeta.eventNameDeferred },
        widgetInfo: {
          buttonId: data.buttonId,
          source: data.source,
        },
        meta: meta,
      };
      break;
    case 'mode-switch': {
      var newMode = formatChatMode(data.mode);
      var prevMode = formatChatMode(data.previousMode);
      var modeSwitchEventName = prevMode && newMode
        ? 'Chat mode switched from ' + prevMode + ' to ' + newMode
        : chatMeta.eventNameModeSwitch;
      payload = {
        event: chatEvents.CHAT_MODE_SWITCH,
        eventInfo: { eventName: modeSwitchEventName },
        widgetInfo: {
          mode: newMode,
          previousMode: prevMode,
          buttonId: data.buttonId,
        },
        meta: meta,
      };
      break;
    }
    case 'voice-chat-start':
      payload = {
        event: chatEvents.AI_CHAT_SESSION_START,
        eventInfo: { eventName: chatMeta.eventNameAiSessionStart },
        widgetInfo: {
          sessionId: data.sessionId,
          trigger: data.trigger,
        },
        meta: meta,
      };
      break;
    case 'text-chat-start':
      payload = {
        event: chatEvents.TEXT_CHAT_SESSION_START,
        eventInfo: { eventName: chatMeta.eventNameTextSessionStart },
        widgetInfo: {
          sessionId: data.sessionId,
          trigger: data.trigger,
        },
        meta: meta,
      };
      break;
    case 'resource-link-click':
      payload = {
        event: chatEvents.CHAT_RESOURCE_LINK_CLICKED,
        eventInfo: { eventName: chatMeta.eventNameResourceLink },
        widgetInfo: {
          linkUrl: data.url,
          linkText: data.linkText,
          messageId: data.messageId,
          messageType: data.messageType,
          ...(lumiSessionId && { sessionId: lumiSessionId }),
        },
        meta: meta,
      };
      break;
    case 'chat-window-close':
      payload = {
        event: chatEvents.CHAT_CLOSED,
        eventInfo: { eventName: chatMeta.eventNameClosed },
        widgetInfo: {
          sessionId: data.sessionId,
          explicitlyClosed: yesNo(data.explicitlyClosed),
          clearMessages: yesNo(data.clearMessages),
        },
        meta: meta,
      };
      break;
    default:
      return;
  }

  payload.widgetInfo = normalizeWidgetInfo(payload.widgetInfo);
  pushToAdobeDataLayer(payload);
}

window.addEventListener('lumi-widget-event', function (event) {
  if (event && isLumiWidgetEvent(event.detail)) {
    pushChatEventToDataLayer(event.detail);
  }
});

window.addEventListener(
  'message',
  function (event) {
    if (!event || !isAllowedLumiOrigin(event.origin)) return;
    if (isLumiWidgetEvent(event.data)) {
      pushChatEventToDataLayer(event.data);
    }
  },
  false,
);