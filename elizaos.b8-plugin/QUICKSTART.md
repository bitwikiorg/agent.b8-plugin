# ⚡ elizaos.b8 Quickstart



## 1. Installation
```bash
cd elizaos.b8-plugin
npm install
npm run build
```

## 2. Environment
Set these in your `.env` or ElizaOS settings:
- `BITHUB_URL`
- `BITHUB_USER_API_KEY`

## 3. Basic Usage (Actions)

### Send Swarm Message
```typescript
await runtime.executeAction("SEND_SWARM_MESSAGE", {
    recipients: ["target_user"],
    title: "Hello",
    raw: "World"
});
```

### Deploy Core Workflow
```typescript
await runtime.executeAction("DEPLOY_CORE", {
    category_id: 54,
    title: "Task",
    raw: "Payload"
});
```
