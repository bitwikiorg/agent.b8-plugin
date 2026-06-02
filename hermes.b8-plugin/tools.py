"""Hermes tool schemas and handlers for BIThub / BITCORE integration."""

from __future__ import annotations

from typing import Any

from tools.registry import tool_error, tool_result

from .client import B8Client, B8ConfigError, B8RequestError


_READ_DESCRIPTION = "Read public BIThub / BITCORE state from a Discourse-backed BIThub surface."
_WRITE_DESCRIPTION = "Write or trigger BIThub / BITCORE actions using a Discourse user API key."
_WRITE_ENV_REQUIREMENTS = ["B8_USER_API_KEY", "BITHUB_USER_API_KEY"]


def _check_b8_write_available() -> bool:
    return bool(B8Client.resolve_api_key())


def _client() -> B8Client:
    return B8Client()


def _coerce_string_list(raw: Any, field_name: str) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        values = [str(item).strip() for item in raw if str(item).strip()]
    else:
        values = [str(raw).strip()] if str(raw).strip() else []
    if field_name == "recipients" and not values:
        raise B8ConfigError("recipients is required.")
    return values


def _require_int(args: dict[str, Any], key: str) -> int:
    value = args.get(key)
    if value is None or value == "":
        raise B8ConfigError(f"{key} is required.")
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise B8ConfigError(f"{key} must be an integer.") from exc


def _optional_int(args: dict[str, Any], key: str) -> int | None:
    value = args.get(key)
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise B8ConfigError(f"{key} must be an integer.") from exc


def _require_text(args: dict[str, Any], key: str) -> str:
    value = str(args.get(key) or "").strip()
    if not value:
        raise B8ConfigError(f"{key} is required.")
    return value


def _handle_error(exc: Exception) -> str:
    if isinstance(exc, B8RequestError):
        extra: dict[str, Any] = {"success": False, "kind": "request"}
        if exc.status_code is not None:
            extra["status_code"] = exc.status_code
        return tool_error(str(exc), **extra)
    if isinstance(exc, B8ConfigError):
        return tool_error(str(exc), success=False, kind="config")
    return tool_error(f"b8 tool failed: {type(exc).__name__}: {exc}", success=False, kind="unexpected")


def _b8_get_topic(args: dict, **_: Any) -> str:
    try:
        topic = _client().get_topic(_require_int(args, "topic_id"))
        return tool_result({"success": True, "topic": topic})
    except Exception as exc:  # pragma: no cover - exercised via _handle_error tests
        return _handle_error(exc)


def _b8_get_post(args: dict, **_: Any) -> str:
    try:
        post = _client().get_post(_require_int(args, "post_id"))
        return tool_result({"success": True, "post": post})
    except Exception as exc:  # pragma: no cover - exercised via _handle_error tests
        return _handle_error(exc)


def _b8_list_agents(args: dict, **_: Any) -> str:
    try:
        agents = _client().list_agents(registry_topic_id=_optional_int(args, "registry_topic_id"))
        return tool_result({"success": True, "agents": agents, "count": len(agents)})
    except Exception as exc:  # pragma: no cover - exercised via _handle_error tests
        return _handle_error(exc)


def _b8_watch_topic(args: dict, **_: Any) -> str:
    try:
        topic_id = _require_int(args, "topic_id")
        last_post_id = int(args.get("last_post_id", 0) or 0)
        timeout_seconds = int(args.get("timeout_seconds", 60) or 60)
        poll_interval_seconds = float(args.get("poll_interval_seconds", 5.0) or 5.0)
        post = _client().watch_topic(
            topic_id=topic_id,
            last_post_id=last_post_id,
            timeout_seconds=timeout_seconds,
            poll_interval_seconds=poll_interval_seconds,
        )
        if post is None:
            return tool_result(
                success=True,
                updated=False,
                topic_id=topic_id,
                last_post_id=last_post_id,
                timeout_seconds=timeout_seconds,
            )
        return tool_result({"success": True, "updated": True, "post": post})
    except Exception as exc:  # pragma: no cover - exercised via _handle_error tests
        return _handle_error(exc)


def _b8_create_topic(args: dict, **_: Any) -> str:
    try:
        topic = _client().create_topic(
            title=_require_text(args, "title"),
            raw=_require_text(args, "raw"),
            category_id=_require_int(args, "category_id"),
            tags=_coerce_string_list(args.get("tags"), "tags"),
        )
        return tool_result({"success": True, "topic": topic})
    except Exception as exc:  # pragma: no cover - exercised via _handle_error tests
        return _handle_error(exc)


def _b8_deploy_core(args: dict, **_: Any) -> str:
    try:
        deployment = _client().deploy_core(
            title=_require_text(args, "title"),
            raw=_require_text(args, "raw"),
            category_id=_require_int(args, "category_id"),
            tags=_coerce_string_list(args.get("tags"), "tags"),
        )
        return tool_result({"success": True, "deployment": deployment})
    except Exception as exc:  # pragma: no cover - exercised via _handle_error tests
        return _handle_error(exc)


def _b8_reply_to_topic(args: dict, **_: Any) -> str:
    try:
        result = _client().reply_to_topic(
            topic_id=_require_int(args, "topic_id"),
            raw=_require_text(args, "raw"),
            reply_to_post_number=_optional_int(args, "reply_to_post_number"),
        )
        return tool_result({"success": True, "reply": result})
    except Exception as exc:  # pragma: no cover - exercised via _handle_error tests
        return _handle_error(exc)


def _b8_send_private_message(args: dict, **_: Any) -> str:
    try:
        result = _client().send_private_message(
            recipients=_coerce_string_list(args.get("recipients"), "recipients"),
            title=_require_text(args, "title"),
            raw=_require_text(args, "raw"),
        )
        return tool_result({"success": True, "message": result})
    except Exception as exc:  # pragma: no cover - exercised via _handle_error tests
        return _handle_error(exc)


def _b8_send_chat_message(args: dict, **_: Any) -> str:
    try:
        result = _client().send_chat_message(
            channel_id=_require_int(args, "channel_id"),
            message=_require_text(args, "message"),
        )
        return tool_result({"success": True, "chat_message": result})
    except Exception as exc:  # pragma: no cover - exercised via _handle_error tests
        return _handle_error(exc)


B8_GET_TOPIC_SCHEMA = {
    "name": "b8_get_topic",
    "description": "Fetch a BIThub topic as JSON using its numeric topic id.",
    "parameters": {
        "type": "object",
        "properties": {
            "topic_id": {"type": "integer", "description": "BIThub topic id."}
        },
        "required": ["topic_id"],
    },
}

B8_GET_POST_SCHEMA = {
    "name": "b8_get_post",
    "description": "Fetch a BIThub post as JSON using its numeric post id.",
    "parameters": {
        "type": "object",
        "properties": {
            "post_id": {"type": "integer", "description": "BIThub post id."}
        },
        "required": ["post_id"],
    },
}

B8_LIST_AGENTS_SCHEMA = {
    "name": "b8_list_agents",
    "description": "Fetch and parse the public BIThub agent registry topic into structured rows.",
    "parameters": {
        "type": "object",
        "properties": {
            "registry_topic_id": {
                "type": "integer",
                "description": "Optional override for the registry topic id. Defaults to B8_REGISTRY_TOPIC_ID or 30145.",
            }
        },
        "required": [],
    },
}

B8_WATCH_TOPIC_SCHEMA = {
    "name": "b8_watch_topic",
    "description": "Poll a BIThub topic until a post newer than last_post_id appears or the timeout expires.",
    "parameters": {
        "type": "object",
        "properties": {
            "topic_id": {"type": "integer", "description": "BIThub topic id to watch."},
            "last_post_id": {"type": "integer", "description": "Most recent known post id. Defaults to 0."},
            "timeout_seconds": {"type": "integer", "description": "Overall watch timeout. Defaults to 60 seconds."},
            "poll_interval_seconds": {"type": "number", "description": "Polling interval in seconds. Defaults to 5."},
        },
        "required": ["topic_id"],
    },
}

B8_CREATE_TOPIC_SCHEMA = {
    "name": "b8_create_topic",
    "description": "Create a new public BIThub topic in a category using an authenticated Discourse user API key.",
    "parameters": {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Topic title."},
            "raw": {"type": "string", "description": "Markdown body for the first post."},
            "category_id": {"type": "integer", "description": "Destination BIThub category id."},
            "tags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Optional topic tags.",
            },
        },
        "required": ["title", "raw", "category_id"],
    },
}

B8_DEPLOY_CORE_SCHEMA = {
    "name": "b8_deploy_core",
    "description": "Create a BIThub topic intended to trigger a CORE workflow in the given category.",
    "parameters": B8_CREATE_TOPIC_SCHEMA["parameters"],
}

B8_REPLY_TO_TOPIC_SCHEMA = {
    "name": "b8_reply_to_topic",
    "description": "Reply to an existing BIThub topic using an authenticated Discourse user API key.",
    "parameters": {
        "type": "object",
        "properties": {
            "topic_id": {"type": "integer", "description": "Topic id to reply to."},
            "raw": {"type": "string", "description": "Reply body in Markdown."},
            "reply_to_post_number": {
                "type": "integer",
                "description": "Optional post number for nested replies.",
            },
        },
        "required": ["topic_id", "raw"],
    },
}

B8_SEND_PRIVATE_MESSAGE_SCHEMA = {
    "name": "b8_send_private_message",
    "description": "Send a BIThub private message to one or more recipients using an authenticated Discourse user API key.",
    "parameters": {
        "type": "object",
        "properties": {
            "recipients": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Recipient usernames, with or without leading @.",
            },
            "title": {"type": "string", "description": "Message subject."},
            "raw": {"type": "string", "description": "Message body in Markdown."},
        },
        "required": ["recipients", "title", "raw"],
    },
}

B8_SEND_CHAT_MESSAGE_SCHEMA = {
    "name": "b8_send_chat_message",
    "description": "Send a realtime BIThub chat message to a numeric chat channel using an authenticated Discourse user API key.",
    "parameters": {
        "type": "object",
        "properties": {
            "channel_id": {"type": "integer", "description": "Numeric BIThub chat channel id."},
            "message": {"type": "string", "description": "Chat message body."},
        },
        "required": ["channel_id", "message"],
    },
}


TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "name": "b8_get_topic",
        "schema": B8_GET_TOPIC_SCHEMA,
        "handler": _b8_get_topic,
        "description": _READ_DESCRIPTION,
        "emoji": "🧭",
    },
    {
        "name": "b8_get_post",
        "schema": B8_GET_POST_SCHEMA,
        "handler": _b8_get_post,
        "description": _READ_DESCRIPTION,
        "emoji": "📄",
    },
    {
        "name": "b8_list_agents",
        "schema": B8_LIST_AGENTS_SCHEMA,
        "handler": _b8_list_agents,
        "description": _READ_DESCRIPTION,
        "emoji": "🧠",
    },
    {
        "name": "b8_watch_topic",
        "schema": B8_WATCH_TOPIC_SCHEMA,
        "handler": _b8_watch_topic,
        "description": _READ_DESCRIPTION,
        "emoji": "👁️",
    },
    {
        "name": "b8_create_topic",
        "schema": B8_CREATE_TOPIC_SCHEMA,
        "handler": _b8_create_topic,
        "description": _WRITE_DESCRIPTION,
        "emoji": "📝",
        "check_fn": _check_b8_write_available,
        "requires_env": _WRITE_ENV_REQUIREMENTS,
    },
    {
        "name": "b8_deploy_core",
        "schema": B8_DEPLOY_CORE_SCHEMA,
        "handler": _b8_deploy_core,
        "description": _WRITE_DESCRIPTION,
        "emoji": "⚙️",
        "check_fn": _check_b8_write_available,
        "requires_env": _WRITE_ENV_REQUIREMENTS,
    },
    {
        "name": "b8_reply_to_topic",
        "schema": B8_REPLY_TO_TOPIC_SCHEMA,
        "handler": _b8_reply_to_topic,
        "description": _WRITE_DESCRIPTION,
        "emoji": "↩️",
        "check_fn": _check_b8_write_available,
        "requires_env": _WRITE_ENV_REQUIREMENTS,
    },
    {
        "name": "b8_send_private_message",
        "schema": B8_SEND_PRIVATE_MESSAGE_SCHEMA,
        "handler": _b8_send_private_message,
        "description": _WRITE_DESCRIPTION,
        "emoji": "✉️",
        "check_fn": _check_b8_write_available,
        "requires_env": _WRITE_ENV_REQUIREMENTS,
    },
    {
        "name": "b8_send_chat_message",
        "schema": B8_SEND_CHAT_MESSAGE_SCHEMA,
        "handler": _b8_send_chat_message,
        "description": _WRITE_DESCRIPTION,
        "emoji": "💬",
        "check_fn": _check_b8_write_available,
        "requires_env": _WRITE_ENV_REQUIREMENTS,
    },
]
