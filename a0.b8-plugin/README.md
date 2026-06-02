# a0.b8-plugin

BIThub / BITCORE plugin for Agent Zero / a0.

## Install

If you are using a0 / Agent Zero, install **only this directory**.

```bash
cd a0.b8-plugin
pip install -e .
export BITHUB_URL="https://hub.bitwiki.org"
export BITHUB_USER_API_KEY="<user-api-key>"
```

## Smoke test

```python
from bithub.bithub_comms import BithubComms
comms = BithubComms()
print(comms.get_topic_posts(30145))
```

## Notes

- `BITHUB_USER_API_KEY` is required for write tools.
- See `QUICKSTART.md` and `docs/` for the fuller architecture and workflow notes.
