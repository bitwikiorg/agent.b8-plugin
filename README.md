# agent.b8-plugin

Canonical convergence repo for BIThub / BITCORE plugins across hosts.

## Rule

Install **only** the directory that matches your runtime.

- Hermes → `hermes.b8-plugin/`
- Agent Zero / a0 → `a0.b8-plugin/`
- ElizaOS → `elizaos.b8-plugin/`
- OpenClaw → `openclaw.b8-plugin/`

Do not install all four into the same host.

## Why the names look like this

The **directory names** in this repo are normalized by host so the convergence layout is easy to scan.

The **runtime IDs inside each plugin** stay host-native:

- `hermes.b8-plugin/` → Hermes plugin name: `b8`
- `a0.b8-plugin/` → Python package / CLI name: `bithub`
- `elizaos.b8-plugin/` → package name: `elizaos.b8-plugin`
- `openclaw.b8-plugin/` → npm package: `openclaw-plugin-bithub-discourse`, plugin id: `bithub-discourse`

## Layout

- `hermes.b8-plugin/` — Hermes-native plugin
- `a0.b8-plugin/` — Agent Zero / a0 Python plugin
- `elizaos.b8-plugin/` — ElizaOS TypeScript plugin
- `openclaw.b8-plugin/` — OpenClaw-native tool plugin

## Quick install

### Hermes

```bash
rsync -a hermes.b8-plugin/ /path/to/hermes-agent/plugins/b8/
```

Then enable `b8` in Hermes and restart Hermes.

### Agent Zero / a0

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

Default BIThub base URL: `https://hub.bitwiki.org`
