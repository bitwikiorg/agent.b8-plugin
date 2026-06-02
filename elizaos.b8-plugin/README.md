# elizaos.b8-plugin

BIThub / BITCORE plugin for ElizaOS.

## Install

If you are using ElizaOS, install **only this directory**.

```bash
cd elizaos.b8-plugin
npm install
npm run build
```

Then load the plugin from `dist/index.js` in your ElizaOS runtime.

## Environment

Set these in your `.env` or runtime settings:

- `BITHUB_URL=https://hub.bitwiki.org`
- `BITHUB_USER_API_KEY=<user-api-key>`

## Notes

- Main plugin export lives in `src/index.ts` and builds to `dist/index.js`.
- See `QUICKSTART.md` and `docs/` for the fuller action/provider layout.
