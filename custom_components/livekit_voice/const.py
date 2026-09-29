"""Constants for the LiveKit Voice Assistant integration."""

DOMAIN = "livekit_voice"

# Config-entry keys.
CONF_LIVEKIT_URL = "livekit_url"
CONF_API_KEY = "api_key"
CONF_API_SECRET = "api_secret"
CONF_AGENT_NAME = "agent_name"
# Base URL of the scheduler service (e.g. http://192.168.1.50:8080) and its shared secret.
# When set, the card's Schedules tab can list/manage tasks directly through a proxy.
CONF_SCHEDULER_URL = "scheduler_url"
CONF_SCHEDULER_TOKEN = "scheduler_token"
# Base URL of the worker's HTTP app (e.g. http://192.168.1.50:8952) and its TEXT_API_TOKEN.
# When set, the card's Text tab shows and continues the worker's persisted text conversation.
CONF_CHAT_URL = "chat_url"
CONF_CHAT_TOKEN = "chat_token"

# Matches AGENT_NAME in agent/agent.py (the worker's explicit-dispatch name).
DEFAULT_AGENT_NAME = "ha-agent"

# Served card bundle (built from ../card via esbuild) and its public URL.
CARD_FILENAME = "livekit-voice-card.js"
CARD_URL = "/livekit_voice/livekit-voice-card.js"

# Token endpoint the card calls via `hass.callApi('POST', 'livekit_voice/token', ...)`.
TOKEN_URL = "/api/livekit_voice/token"

# Scheduler proxy the card calls via `hass.callApi(...)`; forwards to the scheduler service
# so the Schedules tab can list/get/edit/delete tasks without a LiveKit connection.
TASKS_URL = "/api/livekit_voice/tasks"
TASK_URL = "/api/livekit_voice/tasks/{task_id}"
# Settings proxy (e.g. notify.* push targets); forwards to the scheduler's /settings.
SETTINGS_URL = "/api/livekit_voice/settings"
# Text chat proxy for the Text tab; forwards to the worker's /chat and /chat/*.
CHAT_URL = "/api/livekit_voice/chat"
CHAT_HISTORY_URL = "/api/livekit_voice/chat/history"
CHAT_CANCEL_URL = "/api/livekit_voice/chat/cancel"
CHAT_WARM_URL = "/api/livekit_voice/chat/warm"
CHAT_CONVERSATIONS_URL = "/api/livekit_voice/chat/conversations"
CHAT_SWITCH_URL = "/api/livekit_voice/chat/switch"
CHAT_DELETE_URL = "/api/livekit_voice/chat/delete"
# Turn progress on a phone (start / progress / final); the worker posts here with an HA token.
PROGRESS_URL = "/api/livekit_voice/progress"

# hass.data[DOMAIN] keys.
DATA_CONFIG = "config"
DATA_REGISTERED = "registered"
DATA_PROGRESS = "progress"
