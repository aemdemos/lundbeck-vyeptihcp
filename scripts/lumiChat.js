import { pushToAdobeDataLayer, DATA_LAYER_CONFIG } from './datalayer.js';

function isLumiWidgetEvent(envelope) {
  return Boolean(envelope) && envelope.type === 'lumi-widget-event';
}

const ALLOWED_LUMI_ORIGIN_PATTERNS = [
  /(^|\.)lumi-virtual-ai-asst\.com$/,
  /(^|\.)norta\.ai$/,
];

function isAllowedLumiOrigin(originString) {
  if (!originString) {
    return false;
  }

  if (originString === window.location.origin) {
    return true;
  }

  try {
    const host = new URL(originString).hostname;

    return ALLOWED_LUMI_ORIGIN_PATTERNS.some((pattern) => pattern.test(host));
  } catch {
    return false;
  }
}

function getCurrentPageName() {
  const fromAttr = document?.body?.getAttribute('data-page-name');

  if (fromAttr && fromAttr.trim() !== '') {
    return fromAttr.trim();
  }

  return document.title || null;
}

function formatChatMode(mode) {
  if (typeof mode !== 'string') {
    return mode;
  }

  const lower = mode.toLowerCase();

  return lower === 'ai' ? 'AI' : lower;
}

function yesNo(value) {
  if (value === true) {
    return 'Yes';
  }

  if (value === false) {
    return 'No';
  }

  return value;
}

function normalizeFieldValue(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    return trimmed === '' ? null : trimmed;
  }

  return value;
}

function normalizeWidgetInfo(widgetInfo) {
  if (!widgetInfo || typeof widgetInfo !== 'object') {
    return Object.create(null);
  }

  const normalizedEntries = Object.entries(widgetInfo).map(([key, value]) => [
    key,
    normalizeFieldValue(value),
  ]);

  return Object.fromEntries(normalizedEntries);
}

function pushChatEventToDataLayer(widgetEvent) {
  if (!widgetEvent || !widgetEvent.eventType) {
    return;
  }

  const data = widgetEvent.data || {};

  const meta = {
    timeStamp: new Date(
      widgetEvent.timestamp || Date.now(),
    ).toISOString(),
  };

  const { chatEvents, chatMeta } = DATA_LAYER_CONFIG;

  const lumiSessionId = window.sessionStorage.getItem('lumiSessionId');

  let payload;

  switch (widgetEvent.eventType) {
    case 'assistant-button-clicked': {
      const pageName = getCurrentPageName();

      const assistantEventName = pageName
        ? `${chatMeta.eventNameAssistantClicked} on ${pageName}`
        : chatMeta.eventNameAssistantClicked;

      payload = {
        event: chatEvents.CHAT_ASSISTANT_CLICKED,
        eventInfo: {
          eventName: assistantEventName,
        },
        widgetInfo: {
          action: data.action,
          buttonId: data.buttonId,
          source: data.source,
        },
        meta,
      };
      break;
    }

    case 'start-chatting':
      payload = {
        event: chatEvents.CHAT_START,
        eventInfo: {
          eventName: chatMeta.eventNameStart,
        },
        widgetInfo: {
          buttonId: data.buttonId,
          source: data.source,
        },
        meta,
      };
      break;

    case 'try-later':
      payload = {
        event: chatEvents.CHAT_DEFERRED,
        eventInfo: {
          eventName: chatMeta.eventNameDeferred,
        },
        widgetInfo: {
          buttonId: data.buttonId,
          source: data.source,
        },
        meta,
      };
      break;

    case 'mode-switch': {
      const newMode = formatChatMode(data.mode);
      const prevMode = formatChatMode(data.previousMode);

      const modeSwitchEventName = (prevMode && newMode)
        ? `Chat mode switched from ${prevMode} to ${newMode}`
        : chatMeta.eventNameModeSwitch;

      payload = {
        event: chatEvents.CHAT_MODE_SWITCH,
        eventInfo: {
          eventName: modeSwitchEventName,
        },
        widgetInfo: {
          mode: newMode,
          previousMode: prevMode,
          buttonId: data.buttonId,
        },
        meta,
      };
      break;
    }

    case 'voice-chat-start': {
      const { sessionId, trigger } = data;

      payload = {
        event: chatEvents.AI_CHAT_SESSION_START,
        eventInfo: {
          eventName: chatMeta.eventNameAiSessionStart,
        },
        widgetInfo: {
          sessionId,
          trigger,
        },
        meta,
      };
      break;
    }

    case 'text-chat-start': {
      const { sessionId, trigger } = data;

      payload = {
        event: chatEvents.TEXT_CHAT_SESSION_START,
        eventInfo: {
          eventName: chatMeta.eventNameTextSessionStart,
        },
        widgetInfo: {
          sessionId,
          trigger,
        },
        meta,
      };
      break;
    }

    case 'resource-link-click':
      payload = {
        event: chatEvents.CHAT_RESOURCE_LINK_CLICKED,
        eventInfo: {
          eventName: chatMeta.eventNameResourceLink,
        },
        widgetInfo: {
          linkUrl: data.url,
          linkText: data.linkText,
          messageId: data.messageId,
          messageType: data.messageType,
          ...(lumiSessionId && { sessionId: lumiSessionId }),
        },
        meta,
      };
      break;

    case 'chat-window-close': {
      const { sessionId } = data;

      payload = {
        event: chatEvents.CHAT_CLOSED,
        eventInfo: {
          eventName: chatMeta.eventNameClosed,
        },
        widgetInfo: {
          sessionId,
          explicitlyClosed: yesNo(data.explicitlyClosed),
          clearMessages: yesNo(data.clearMessages),
        },
        meta,
      };
      break;
    }

    default:
      return;
  }

  payload.widgetInfo = normalizeWidgetInfo(payload.widgetInfo);

  pushToAdobeDataLayer(payload);
}

window.addEventListener('lumi-widget-event', (event) => {
  if (event && isLumiWidgetEvent(event.detail)) {
    pushChatEventToDataLayer(event.detail);
  }
});

window.addEventListener(
  'message',
  (event) => {
    if (!event) {
      return;
    }

    const isTrustedOrigin = (
      event.origin === window.location.origin
      || isAllowedLumiOrigin(event.origin)
    );

    if (!isTrustedOrigin) {
      return;
    }

    if (isLumiWidgetEvent(event.data)) {
      pushChatEventToDataLayer(event.data);
    }
  },
  false,
);