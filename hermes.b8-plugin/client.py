"""HTTP client for BIThub / BITCORE Discourse surfaces.

Why:
    Hermes needs a small, dependable integration layer for BIThub operations
    without inheriting the framework assumptions of upstream reference repos.

What:
    ``B8Client`` wraps the handful of Discourse endpoints Hermes needs for a
    first usable plugin: topic/post reads, public topic creation, private
    messages, chat messages, replies, topic watching, and agent-registry fetch.

How:
    Resolve configuration from explicit args first, then environment. Keep all
    network behavior in one place, raise typed errors, and return parsed JSON
    payloads only after validating HTTP success.
"""

from __future__ import annotations

import os
import re
import time
from dataclasses import dataclass
from typing import Any, Iterable, Sequence

import requests

DEFAULT_BASE_URL = "https://hub.bitwiki.org"
DEFAULT_TIMEOUT_SECONDS = 30.0
DEFAULT_REGISTRY_TOPIC_ID = 30145
_WRITE_ENV_VARS = ("B8_USER_API_KEY", "BITHUB_USER_API_KEY")
_BASE_URL_ENV_VARS = ("B8_BASE_URL", "BITHUB_BASE_URL", "BITHUB_URL")
_TIMEOUT_ENV_VARS = ("B8_TIMEOUT",)
_REGISTRY_TOPIC_ENV_VARS = ("B8_REGISTRY_TOPIC_ID",)
_USERNAME_KEY_RE = re.compile(r"[^a-z0-9]+")
_LINK_RE = re.compile(r"\[([^\]]+)\]\([^\)]+\)")
_INLINE_CODE_RE = re.compile(r"`([^`]*)`")
_MARKDOWN_EMPHASIS_RE = re.compile(r"(\*\*|\*)")


class B8Error(Exception):
    """Base exception for BIThub plugin failures."""


class B8ConfigError(B8Error):
    """Raised when required BIThub configuration is missing or invalid."""


@dataclass(slots=True)
class B8RequestError(B8Error):
    """Raised when a BIThub HTTP request fails."""

    message: str
    status_code: int | None = None

    def __str__(self) -> str:  # pragma: no cover - trivial
        return self.message


class B8Client:
    """Small client for Discourse-backed BIThub operations."""

    def __init__(
        self,
        *,
        base_url: str | None = None,
        api_key: str | None = None,
        timeout_seconds: float | None = None,
        session: requests.Session | Any | None = None,
    ) -> None:
        self.base_url = self.resolve_base_url(base_url)
        self.api_key = self.resolve_api_key(api_key)
        self.timeout_seconds = self.resolve_timeout(timeout_seconds)
        self.session = session or requests.Session()

    @staticmethod
    def resolve_base_url(value: str | None = None) -> str:
        resolved = (value or _first_env(_BASE_URL_ENV_VARS) or DEFAULT_BASE_URL).strip()
        if not resolved:
            raise B8ConfigError("B8 base URL is empty.")
        return resolved.rstrip("/")

    @staticmethod
    def resolve_api_key(value: str | None = None) -> str | None:
        resolved = (value or _first_env(_WRITE_ENV_VARS) or "").strip()
        return resolved or None

    @staticmethod
    def resolve_timeout(value: float | int | None = None) -> float:
        raw = value if value is not None else (_first_env(_TIMEOUT_ENV_VARS) or DEFAULT_TIMEOUT_SECONDS)
        try:
            timeout = float(raw)
        except (TypeError, ValueError) as exc:  # pragma: no cover - defensive
            raise B8ConfigError(f"Invalid B8 timeout value: {raw!r}") from exc
        if timeout <= 0:
            raise B8ConfigError("B8 timeout must be positive.")
        return timeout

    @staticmethod
    def resolve_registry_topic_id(value: int | str | None = None) -> int:
        raw = value if value is not None else (_first_env(_REGISTRY_TOPIC_ENV_VARS) or DEFAULT_REGISTRY_TOPIC_ID)
        try:
            topic_id = int(raw)
        except (TypeError, ValueError) as exc:
            raise B8ConfigError(f"Invalid B8 registry topic id: {raw!r}") from exc
        if topic_id <= 0:
            raise B8ConfigError("B8 registry topic id must be positive.")
        return topic_id

    def has_write_auth(self) -> bool:
        return bool(self.api_key)

    def get_topic(self, topic_id: int) -> dict[str, Any]:
        return self._request("GET", f"/t/{_positive_int(topic_id, 'topic_id')}.json")

    def get_post(self, post_id: int) -> dict[str, Any]:
        return self._request("GET", f"/posts/{_positive_int(post_id, 'post_id')}.json")

    def create_topic(
        self,
        *,
        title: str,
        raw: str,
        category_id: int,
        tags: Sequence[str] | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "title": _required_text(title, "title"),
            "raw": _required_text(raw, "raw"),
            "category": _positive_int(category_id, "category_id"),
        }
        normalized_tags = _normalize_tags(tags)
        if normalized_tags:
            payload["tags"] = normalized_tags
        return self._request("POST", "/posts.json", json_data=payload, auth_required=True)

    def deploy_core(
        self,
        *,
        title: str,
        raw: str,
        category_id: int,
        tags: Sequence[str] | None = None,
    ) -> dict[str, Any]:
        return self.create_topic(title=title, raw=raw, category_id=category_id, tags=tags)

    def reply_to_topic(
        self,
        *,
        topic_id: int,
        raw: str,
        reply_to_post_number: int | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "topic_id": _positive_int(topic_id, "topic_id"),
            "raw": _required_text(raw, "raw"),
        }
        if reply_to_post_number is not None:
            payload["reply_to_post_number"] = _positive_int(reply_to_post_number, "reply_to_post_number")
        return self._request("POST", "/posts.json", json_data=payload, auth_required=True)

    def send_private_message(
        self,
        *,
        recipients: Sequence[str],
        title: str,
        raw: str,
    ) -> dict[str, Any]:
        normalized_recipients = _normalize_recipients(recipients)
        payload = {
            "title": _required_text(title, "title"),
            "raw": _required_text(raw, "raw"),
            "archetype": "private_message",
            "target_recipients": ",".join(normalized_recipients),
        }
        return self._request("POST", "/posts.json", json_data=payload, auth_required=True)

    def send_chat_message(self, *, channel_id: int, message: str) -> dict[str, Any]:
        payload = {"message": _required_text(message, "message")}
        return self._request(
            "POST",
            f"/chat/{_positive_int(channel_id, 'channel_id')}.json",
            json_data=payload,
            auth_required=True,
        )

    def watch_topic(
        self,
        *,
        topic_id: int,
        last_post_id: int = 0,
        timeout_seconds: int = 60,
        poll_interval_seconds: float = 5.0,
    ) -> dict[str, Any] | None:
        topic_id = _positive_int(topic_id, "topic_id")
        timeout_seconds = _positive_int(timeout_seconds, "timeout_seconds")
        if last_post_id < 0:
            raise B8ConfigError("last_post_id must be zero or positive.")
        if poll_interval_seconds <= 0:
            raise B8ConfigError("poll_interval_seconds must be positive.")

        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            topic = self.get_topic(topic_id)
            post_ids = self.extract_post_ids(topic)
            if post_ids and post_ids[-1] > last_post_id:
                return self.get_post(post_ids[-1])
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            time.sleep(min(poll_interval_seconds, remaining))
        return None

    def list_agents(self, *, registry_topic_id: int | None = None) -> list[dict[str, str]]:
        topic_id = self.resolve_registry_topic_id(registry_topic_id)
        topic = self.get_topic(topic_id)
        raw = self._get_first_post_raw(topic)
        return parse_markdown_table(raw)

    def _get_first_post_raw(self, topic: dict[str, Any]) -> str:
        post_stream = topic.get("post_stream") or {}
        posts = post_stream.get("posts") or []
        if posts:
            first = posts[0] or {}
            raw = str(first.get("raw") or "").strip()
            if raw:
                return raw
            first_id = first.get("id")
            if first_id:
                return str(self.get_post(int(first_id)).get("raw") or "")
        stream = post_stream.get("stream") or []
        if stream:
            return str(self.get_post(int(stream[0])).get("raw") or "")
        raise B8RequestError("Registry topic has no readable posts.")

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json_data: dict[str, Any] | None = None,
        auth_required: bool = False,
    ) -> dict[str, Any]:
        if auth_required and not self.api_key:
            raise B8ConfigError(
                "B8 write operations require B8_USER_API_KEY or BITHUB_USER_API_KEY."
            )

        url = f"{self.base_url}{path}"
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "Hermes-Agent b8 plugin/0.1",
        }
        if auth_required and self.api_key:
            headers["User-Api-Key"] = self.api_key

        try:
            response = self.session.request(
                method=method,
                url=url,
                params=params,
                json=json_data,
                headers=headers,
                timeout=self.timeout_seconds,
            )
        except requests.RequestException as exc:
            raise B8RequestError(f"B8 request to {url} failed: {exc}") from exc

        if not response.ok:
            detail = _response_text(response)
            reason = getattr(response, "reason", "") or "HTTP error"
            raise B8RequestError(
                f"B8 API request failed ({response.status_code} {reason}) for {path}: {detail}",
                status_code=int(getattr(response, "status_code", 0) or 0),
            )

        if getattr(response, "status_code", None) == 204:
            return {}

        try:
            return response.json()
        except ValueError as exc:
            raise B8RequestError(f"B8 API returned non-JSON response for {path}: {_response_text(response)}") from exc

    @staticmethod
    def extract_post_ids(topic: dict[str, Any]) -> list[int]:
        post_stream = topic.get("post_stream") or {}
        stream = post_stream.get("stream") or []
        if stream:
            return [int(post_id) for post_id in stream]
        posts = post_stream.get("posts") or []
        ids: list[int] = []
        for post in posts:
            post_id = (post or {}).get("id")
            if post_id is not None:
                ids.append(int(post_id))
        return ids


def parse_markdown_table(raw: str) -> list[dict[str, str]]:
    """Parse agent-registry style Markdown tables into normalized dict rows.

    The BIThub registry topic contains several independent tables. We only want
    top-level construct listings, not every two-column detail table later in the
    document. A table is considered agent-registry-like when it has a username
    column and at least one construct/name/agent column.
    """
    text = str(raw or "")
    rows: list[dict[str, str]] = []

    for table_lines in _extract_markdown_table_blocks(text):
        if len(table_lines) < 2:
            continue
        header_cells = _split_markdown_row(table_lines[0])
        if not header_cells:
            continue
        if not _is_separator_row(_split_markdown_row(table_lines[1])):
            continue

        keys = [_normalize_header(cell) for cell in header_cells]
        if "username" not in keys:
            continue
        if not any(key in {"construct", "name", "agent", "persona"} for key in keys):
            continue

        for line in table_lines[2:]:
            cells = _split_markdown_row(line)
            if not cells or _is_separator_row(cells):
                continue
            row: dict[str, str] = {}
            for index, key in enumerate(keys):
                if not key:
                    continue
                cell = cells[index] if index < len(cells) else ""
                row[key] = _clean_markdown_cell(cell)

            username = row.get("username") or row.get("user") or row.get("agent") or row.get("handle")
            if not username:
                continue
            normalized_username = _clean_username(username)
            if not normalized_username or normalized_username.lower() == "username":
                continue
            row["username"] = normalized_username
            rows.append(row)

    return rows


def _first_env(names: Iterable[str]) -> str | None:
    for name in names:
        value = os.getenv(name)
        if value and value.strip():
            return value.strip()
    return None


def _positive_int(value: int | str, field_name: str) -> int:
    try:
        coerced = int(value)
    except (TypeError, ValueError) as exc:
        raise B8ConfigError(f"{field_name} must be an integer.") from exc
    if coerced <= 0:
        raise B8ConfigError(f"{field_name} must be positive.")
    return coerced


def _required_text(value: Any, field_name: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise B8ConfigError(f"{field_name} is required.")
    return text


def _normalize_recipients(recipients: Sequence[str]) -> list[str]:
    normalized: list[str] = []
    for recipient in recipients:
        cleaned = _clean_username(_required_text(recipient, "recipient"))
        if not cleaned:
            raise B8ConfigError("recipient is required.")
        normalized.append(cleaned)
    if not normalized:
        raise B8ConfigError("At least one recipient is required.")
    return normalized


def _normalize_tags(tags: Sequence[str] | None) -> list[str]:
    if not tags:
        return []
    normalized: list[str] = []
    for tag in tags:
        cleaned = str(tag or "").strip().lower().replace(" ", "-")
        if cleaned:
            normalized.append(cleaned)
    return normalized


def _response_text(response: Any, limit: int = 400) -> str:
    text = str(getattr(response, "text", "") or "").strip()
    if not text:
        return "(empty response body)"
    return text[:limit] + ("…" if len(text) > limit else "")


def _extract_markdown_table_blocks(text: str) -> list[list[str]]:
    blocks: list[list[str]] = []
    current: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if line.startswith("|"):
            current.append(line)
            continue
        if current:
            blocks.append(current)
            current = []
    if current:
        blocks.append(current)
    return blocks


def _clean_markdown_cell(value: str) -> str:
    text = str(value or "").strip()
    text = _LINK_RE.sub(r"\1", text)
    text = _INLINE_CODE_RE.sub(r"\1", text)
    text = _MARKDOWN_EMPHASIS_RE.sub("", text)
    return " ".join(text.split())


def _clean_username(value: str) -> str:
    return _clean_markdown_cell(value).strip().lstrip("@")


def _split_markdown_row(line: str) -> list[str]:
    stripped = line.strip().strip("|")
    if not stripped:
        return []
    return [cell.strip() for cell in stripped.split("|")]


def _is_separator_row(cells: Sequence[str]) -> bool:
    if not cells:
        return False
    return all(cell and set(cell.replace(":", "")) <= {"-"} for cell in cells)


def _normalize_header(value: str) -> str:
    cleaned = _USERNAME_KEY_RE.sub("_", value.strip().lower()).strip("_")
    return cleaned
