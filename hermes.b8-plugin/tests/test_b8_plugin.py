"""Tests for the bundled BIThub / BITCORE plugin."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest
import yaml

from hermes_cli.plugins import PluginManager
from toolsets import get_toolset
from tools.registry import registry


class FakeResponse:
    def __init__(self, *, payload=None, text="", ok=True, status_code=200, reason="OK"):
        self._payload = payload
        self.text = text
        self.ok = ok
        self.status_code = status_code
        self.reason = reason

    def json(self):
        if isinstance(self._payload, Exception):
            raise self._payload
        return self._payload


class FakeSession:
    def __init__(self, responses):
        self._responses = list(responses)
        self.calls = []

    def request(self, **kwargs):
        self.calls.append(kwargs)
        if not self._responses:
            raise AssertionError("No fake response queued")
        response = self._responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


@pytest.fixture
def b8_client_module():
    repo_root = Path(__file__).resolve().parents[2]
    client_path = repo_root / "plugins" / "b8" / "client.py"
    spec = importlib.util.spec_from_file_location("b8_client_under_test", client_path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    try:
        spec.loader.exec_module(module)
        return module
    finally:
        sys.modules.pop(spec.name, None)


@pytest.fixture
def isolate_registry_and_modules():
    tools_snapshot = dict(registry._tools)
    checks_snapshot = dict(registry._toolset_checks)
    aliases_snapshot = dict(registry._toolset_aliases)
    generation_snapshot = registry._generation
    modules_snapshot = {
        name: module
        for name, module in sys.modules.items()
        if name == "hermes_plugins" or name.startswith("hermes_plugins.b8")
    }
    yield
    registry._tools.clear()
    registry._tools.update(tools_snapshot)
    registry._toolset_checks.clear()
    registry._toolset_checks.update(checks_snapshot)
    registry._toolset_aliases.clear()
    registry._toolset_aliases.update(aliases_snapshot)
    registry._generation = generation_snapshot
    for name in list(sys.modules):
        if name == "hermes_plugins" or name.startswith("hermes_plugins.b8"):
            sys.modules.pop(name, None)
    sys.modules.update(modules_snapshot)


class TestB8Client:
    def test_create_topic_builds_expected_request(self, b8_client_module):
        session = FakeSession([
            FakeResponse(payload={"id": 101, "topic_id": 55}, text='{"id":101}'),
        ])
        client = b8_client_module.B8Client(
            base_url="https://hub.bitwiki.org/",
            api_key="secret-key",
            session=session,
            timeout_seconds=12,
        )

        payload = client.create_topic(
            title="Launch core",
            raw="Deploy this core.",
            category_id=42,
            tags=["Core Ops", "Launch"],
        )

        assert payload == {"id": 101, "topic_id": 55}
        call = session.calls[0]
        assert call["method"] == "POST"
        assert call["url"] == "https://hub.bitwiki.org/posts.json"
        assert call["timeout"] == 12
        assert call["headers"]["User-Api-Key"] == "secret-key"
        assert call["json"] == {
            "title": "Launch core",
            "raw": "Deploy this core.",
            "category": 42,
            "tags": ["core-ops", "launch"],
        }

    def test_send_private_message_normalizes_recipients(self, b8_client_module):
        session = FakeSession([
            FakeResponse(payload={"id": 202, "topic_id": 88}, text='{"id":202}'),
        ])
        client = b8_client_module.B8Client(
            base_url="https://hub.bitwiki.org",
            api_key="secret-key",
            session=session,
        )

        payload = client.send_private_message(
            recipients=["`@janus`", " hermes "],
            title="Sync",
            raw="Ping.",
        )

        assert payload["topic_id"] == 88
        assert session.calls[0]["json"]["target_recipients"] == "janus,hermes"
        assert session.calls[0]["json"]["archetype"] == "private_message"

    def test_list_agents_fetches_registry_post_and_parses_table(self, b8_client_module):
        session = FakeSession([
            FakeResponse(payload={"post_stream": {"posts": [{"id": 17}]}}),
            FakeResponse(
                payload={
                    "raw": (
                        "| # | Construct | Username |\n"
                        "| ---: | --- | --- |\n"
                        "| 1 | **Hermes** | `@hermes` |\n"
                        "| 2 | Janus | `@janus` |\n\n"
                        "| Field | Value |\n"
                        "| --- | --- |\n"
                        "| **Username** | `@should_not_parse` |"
                    )
                }
            ),
        ])
        client = b8_client_module.B8Client(session=session)

        agents = client.list_agents(registry_topic_id=30145)

        assert agents == [
            {"construct": "Hermes", "username": "hermes"},
            {"construct": "Janus", "username": "janus"},
        ]
        assert session.calls[0]["url"] == "https://hub.bitwiki.org/t/30145.json"
        assert session.calls[1]["url"] == "https://hub.bitwiki.org/posts/17.json"

    def test_watch_topic_returns_none_when_no_new_post(self, b8_client_module, monkeypatch):
        sleep_calls = []
        monotonic_values = iter([0.0, 0.1, 0.2, 0.3, 1.1])
        monkeypatch.setattr(b8_client_module.time, "sleep", lambda seconds: sleep_calls.append(seconds))
        monkeypatch.setattr(b8_client_module.time, "monotonic", lambda: next(monotonic_values))
        session = FakeSession([
            FakeResponse(payload={"post_stream": {"stream": [11, 12]}}),
            FakeResponse(payload={"post_stream": {"stream": [11, 12]}}),
        ])
        client = b8_client_module.B8Client(session=session)

        result = client.watch_topic(
            topic_id=99,
            last_post_id=12,
            timeout_seconds=1,
            poll_interval_seconds=0.01,
        )

        assert result is None
        assert sleep_calls


class TestB8PluginRegistration:
    def test_bundled_plugin_registers_tools_when_enabled(
        self,
        tmp_path,
        monkeypatch,
        isolate_registry_and_modules,
    ):
        hermes_home = tmp_path / ".hermes"
        hermes_home.mkdir()
        (hermes_home / "config.yaml").write_text(
            yaml.safe_dump({"plugins": {"enabled": ["b8"]}})
        )
        monkeypatch.setenv("HERMES_HOME", str(hermes_home))
        monkeypatch.delenv("B8_USER_API_KEY", raising=False)
        monkeypatch.delenv("BITHUB_USER_API_KEY", raising=False)

        manager = PluginManager()
        manager.discover_and_load(force=True)

        assert "b8" in manager._plugins
        assert manager._plugins["b8"].enabled is True
        assert registry.get_tool_names_for_toolset("b8") == [
            "b8_create_topic",
            "b8_deploy_core",
            "b8_get_post",
            "b8_get_topic",
            "b8_list_agents",
            "b8_reply_to_topic",
            "b8_send_chat_message",
            "b8_send_private_message",
            "b8_watch_topic",
        ]
        toolset = get_toolset("b8")
        assert toolset is not None
        assert set(toolset["tools"]) == set(registry.get_tool_names_for_toolset("b8"))
        entry = registry.get_entry("b8_create_topic")
        assert entry is not None
        assert entry.check_fn() is False

    def test_write_tool_check_flips_when_api_key_present(
        self,
        tmp_path,
        monkeypatch,
        isolate_registry_and_modules,
    ):
        hermes_home = tmp_path / ".hermes"
        hermes_home.mkdir()
        (hermes_home / "config.yaml").write_text(
            yaml.safe_dump({"plugins": {"enabled": ["b8"]}})
        )
        monkeypatch.setenv("HERMES_HOME", str(hermes_home))
        monkeypatch.setenv("B8_USER_API_KEY", "present")

        manager = PluginManager()
        manager.discover_and_load(force=True)

        entry = registry.get_entry("b8_send_private_message")
        assert entry is not None
        check_fn = entry.check_fn
        assert check_fn() is True


class TestB8ToolHandlers:
    def test_missing_required_argument_returns_config_error(
        self,
        tmp_path,
        monkeypatch,
        isolate_registry_and_modules,
    ):
        hermes_home = tmp_path / ".hermes"
        hermes_home.mkdir()
        (hermes_home / "config.yaml").write_text(
            yaml.safe_dump({"plugins": {"enabled": ["b8"]}})
        )
        monkeypatch.setenv("HERMES_HOME", str(hermes_home))

        manager = PluginManager()
        manager.discover_and_load(force=True)

        result = registry.dispatch("b8_get_topic", {})
        payload = json.loads(result)
        assert payload["kind"] == "config"
        assert payload["success"] is False
        assert payload["error"] == "topic_id is required."
