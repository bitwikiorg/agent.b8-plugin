# hermes.b8-plugin

Hermes-native BIThub / BITCORE plugin.

## Runtime identity

- directory in this repo: `hermes.b8-plugin/`
- Hermes plugin name: `b8`
- install target inside Hermes: `plugins/b8/`

## Install

If you are using Hermes, install **only this directory**.

```bash
rsync -a hermes.b8-plugin/ /path/to/hermes-agent/plugins/b8/
```

Then enable `b8` in the active Hermes config and restart Hermes.

Minimal config shape:

```yaml
plugins:
  enabled:
    - b8
```

## Files

- `plugin.yaml`
- `client.py`
- `tools.py`
- `__init__.py`
- `tests/test_b8_plugin.py`

## Auth

Read-only tools work without a key.

Write tools need one of:

- `B8_USER_API_KEY`
- `BITHUB_USER_API_KEY`

Optional env:

- `B8_BASE_URL` or `BITHUB_BASE_URL`
- `B8_TIMEOUT`
- `B8_REGISTRY_TOPIC_ID`

Default BIThub base URL: `https://hub.bitwiki.org`
