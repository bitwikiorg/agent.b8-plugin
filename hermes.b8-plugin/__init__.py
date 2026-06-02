"""Bundled BIThub / BITCORE plugin for Hermes.

This plugin is intentionally Hermes-native:
- tool registration happens via ``PluginContext.register_tool``
- transport logic lives in ``client.py``
- tool schemas + handlers live in ``tools.py``

The plugin is a standalone bundled plugin, so users opt in via
``plugins.enabled: [b8]``. Once enabled, it exposes a ``b8`` toolset with a
small, literal surface area instead of the metaphor-heavy upstream naming.
"""

from __future__ import annotations

from .tools import TOOL_DEFINITIONS


def register(ctx) -> None:
    """Register the BIThub tool surface with Hermes."""
    for tool in TOOL_DEFINITIONS:
        ctx.register_tool(
            name=tool["name"],
            toolset="b8",
            schema=tool["schema"],
            handler=tool["handler"],
            check_fn=tool.get("check_fn"),
            requires_env=tool.get("requires_env"),
            description=tool.get("description", ""),
            emoji=tool.get("emoji", ""),
        )
