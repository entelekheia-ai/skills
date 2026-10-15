# publishing

## 0.3.0

### Minor Changes

- bbb585b: New skill `make-portable`: take a plugin that installs in one coding agent and make it install in Codex, Copilot CLI, Cursor and Antigravity from one source — a root Agent Plugins manifest, one catalog per client derived from a single hand-edited catalog, a generated Cursor layer for subagents, a client matrix dated to the day its vendor pages were read, and a validator script that separates what ran from what was only read. Manual only (`disable-model-invocation`).
- bbb585b: Each plugin now ships a root `plugin.json` in the Agent Plugins 1.0 format, so Codex, Copilot CLI, Cursor and Antigravity load its skills (and, in Antigravity, its agents) without a conversion step. The `.codex-plugin/plugin.json` fallback is gone: Codex reads the root manifest. Plugins with subagents also carry a generated Cursor layer, so Cursor loads their agents. Hooks stay Claude Code only. Copilot CLI prefers the root manifest over `.claude-plugin/plugin.json`, so a Copilot install of `delegation` or `publishing` now receives skills only, without agents or hooks.

## 0.2.1

### Patch Changes

- 8d46250: `publish` checks that the deny-list count matches the entries meant to be active, and scans every commit before a first public push.

## 0.2.0

### Minor Changes

- 528f911: First release: the `publish` skill and the `extraction-auditor` agent.

### Patch Changes

- fa25304: `publish` Step 1 searches an item for the paths it runs, since a skill folder is not its file list.
- 1359a77: `publish` says where a plugin agent's guard goes (the plugin's hooks, keyed on `agent_type`), how a plugin agent names a preloaded skill, and how to prove both after installing.
- 4303cd3: `publish` says that only `SKILL.md` gets its variables substituted: a command in a reference file names the skill folder in words, and `SKILL.md` hands over the resolved folder.
- 9108398: `publish` says a rewrite that replaces a rule rewords every line still applying the old one.
- e0826d0: `publish` names `delegation:reviewer` for its blind review and `delegation:blind-run` for the first real use, both optional.
- f0269ab: `publish` and the `extraction-auditor` gain a fifth audit category, W: the author's own workflow — folder layout, record templates, numbering, their own word for a common thing — which no deny-list catches.
