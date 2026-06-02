# openclaw.b8-plugin

OpenClaw-native BIThub / BITCORE tool plugin.

## Install

If you are using OpenClaw, install **only this directory**.

```bash
cd openclaw.b8-plugin
npm install
npm run plugin:build
npm run plugin:validate
TARBALL=$(npm pack)
openclaw plugins install "npm-pack:$(pwd)/$TARBALL" --force
```

## Config

Configure the plugin directly under `plugins.entries.bithub-discourse`:

```json5
{
  plugins: {
    entries: {
      "bithub-discourse": {
        enabled: true,
        baseUrl: "https://hub.bitwiki.org",
        userApiKey: "<discourse-user-api-key>",
        registryTopicId: 30145,
        timeoutMs: 30000
      }
    }
  }
}
```

## Auth

Read tools work without a key.

Write tools need either:

- `plugins.entries.bithub-discourse.userApiKey`
- `B8_USER_API_KEY`
- `BITHUB_USER_API_KEY`

This is a native OpenClaw plugin, not a Hermes `plugin.yaml` port.
