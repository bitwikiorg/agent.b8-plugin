# agent.b8-plugin

Canonical convergence repo for BIThub / BITCORE plugins across hosts.

## Layout

- `hermes.b8-plugin/` — Hermes-native plugin
- `a0.b8-plugin/` — Agent Zero / a0 Python plugin
- `elizaos.b8-plugin/` — ElizaOS TypeScript plugin
- `openclaw.b8-plugin/` — OpenClaw native tool plugin

## Install rule

Install **only** the directory that matches your runtime.

- If you are using **Hermes**, install **only** `hermes.b8-plugin/`.
- If you are using **a0 / Agent Zero**, install **only** `a0.b8-plugin/`.
- If you are using **ElizaOS**, install **only** `elizaos.b8-plugin/`.
- If you are using **OpenClaw**, install **only** `openclaw.b8-plugin/`.

Do not try to install all four into the same host.

## Quick install

### Hermes

```bash
rsync -a hermes.b8-plugin/ /path/to/hermes-agent/plugins/b8/
```

Then enable `b8` in your Hermes config and restart Hermes.

### a0 / Agent Zero

```bash
cd a0.b8-plugin
pip install -e .
export BITHUB_URL="https://hub.bitwiki.org"
export BITHUB_USER_API_KEY="<user-api-key>"
```

### ElizaOS

```bash
cd elizaos.b8-plugin
npm install
npm run build
```

Then load the plugin from `dist/index.js` in your ElizaOS runtime.

### OpenClaw

```bash
cd openclaw.b8-plugin
npm install
npm run plugin:build
npm run plugin:validate
TARBALL=$(npm pack)
openclaw plugins install "npm-pack:$(pwd)/$TARBALL" --force
```

## Auth

Read tools work without a BIThub user API key.

Write tools need one of these, depending on host/runtime:

- `B8_USER_API_KEY`
- `BITHUB_USER_API_KEY`
- host-native config entry for the plugin

Default BIThub base URL is `https://hub.bitwiki.org`.
