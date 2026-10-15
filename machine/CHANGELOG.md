# machine

## 0.3.0

### Minor Changes

- bbb585b: Each plugin now ships a root `plugin.json` in the Agent Plugins 1.0 format, so Codex, Copilot CLI, Cursor and Antigravity load its skills (and, in Antigravity, its agents) without a conversion step. The `.codex-plugin/plugin.json` fallback is gone: Codex reads the root manifest. Plugins with subagents also carry a generated Cursor layer, so Cursor loads their agents. Hooks stay Claude Code only. Copilot CLI prefers the root manifest over `.claude-plugin/plugin.json`, so a Copilot install of `delegation` or `publishing` now receives skills only, without agents or hooks.

## 0.2.0

### Minor Changes

- 2da5ece: First release: `dev-storage` and `repair-agent-host`.
