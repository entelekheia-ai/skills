# Client matrix — where each agent reads a plugin

Read on **2026-10-14** from each vendor's own page. Only the `agy` row was exercised on this machine
(`agy` 1.1.8, `agy plugin validate`). Every other row is documentation-checked. Re-read the cited page
before relying on a row older than a month.

Contents: [The portable standard](#the-portable-standard) · [Per client](#per-client) ·
[Skills-only clients](#skills-only-clients) · [Invocation policy](#invocation-policy)

## The portable standard

Agent Plugins 1.0 (`agent-plugins.org`, spec 1.0.0 and 1.1.0): a directory with a root `plugin.json`,
`skills/<name>/SKILL.md` and an optional `mcp.json`. The manifest schema is closed: `$schema` and `name`
required; `version`, `description`, `author` (`name`, `email`, `url`), `homepage`, `repository`, `license`,
`keywords`, `extensions` optional. Agents, hooks, commands and rules are **not** portable; a client reads
its own from a directory named for its reverse-domain namespace (Copilot: `com.github.copilot/`).
Clients the standard's own page lists: ChatGPT/Codex, Cursor, GitHub Copilot, VS Code, Kiro, OpenHands,
Hermes Agent, OpenClaw, NanoClaw, Grok Bot.

## Per client

| Client | Manifest it reads | Skills | Agents | Hooks | Catalog | Install |
|---|---|---|---|---|---|---|
| **Claude Code** | `.claude-plugin/plugin.json` | `skills/` | `agents/*.md` | `hooks/hooks.json` | `.claude-plugin/marketplace.json` | `claude plugin marketplace add <owner/repo>` |
| **Codex** (OpenAI) | root `plugin.json` (primary); `.codex-plugin/plugin.json` optional fallback | `skills/` | not in the portable layer | `hooks/` (lifecycle hooks only for manually installed desktop plugins) | `.agents/plugins/marketplace.json` (repo) or `~/.agents/plugins/marketplace.json`; entry `source` is `local`, `url` or `git-subdir` | `codex plugin marketplace add <owner/repo>` |
| **Antigravity** (`agy`, Google) | root `plugin.json` (`name` required in the CLI, `^[a-zA-Z0-9-_]+$`) | `skills/` (and `mcp_config.json` for MCP) | `agents/*.md` | root `hooks.json` | official marketplace `antigravity-plugins-official`; also a repository URL or local path | `agy plugin install <name\|url\|path>` (one plugin per directory; a multi-plugin repository installs per plugin directory); `agy plugin validate <path>`; `agy plugin import` reads Claude or Gemini plugins |
| **GitHub Copilot CLI** | root Agent Plugins manifest (wins over `.plugin/`, `.github/plugin/` and `.claude-plugin/`); legacy locations still read | `skills/` | `com.github.copilot/agents/` (portable layout) or `agents/` (legacy) | `com.github.copilot/hooks/hooks.json` | `marketplace.json`, `.plugin/`, `.github/plugin/` or `.claude-plugin/` | `copilot plugin install <plugin@marketplace\|owner/repo\|owner/repo:path\|git-url\|path>` |
| **Cursor** | root `plugin.json` (skills, MCP) or `.cursor-plugin/plugin.json` (full set); precedence when both exist is undocumented | `skills/` | `agents/*.md` with `name`, `description`, `model: inherit` or a model id, `readonly`, `is_background`; read also from `.claude/agents` and `.codex/agents` at project level | `hooks/hooks.json` (Cursor format only) | `.cursor-plugin/marketplace.json`, `source` a path string | import the repository's marketplace; the public marketplace reviews each plugin and requires open source |
| **Gemini CLI** | `gemini-extension.json` (an extension, not an Agent Plugin) | yes | yes | yes | none; GitHub URL | `gemini extensions install <url>`. For unpaid and Google One users the CLI was replaced by Antigravity CLI on 2026-06-18 |
| **OpenCode** | none; skills and its own `plugin` array in `opencode.json` | `.opencode/skills`, `~/.config/opencode/skills`, also `.claude/skills` and `.agents/skills` | its own config | JS/TS plugin in `.opencode/plugin/` | none | skills only through this skill folder; hooks do not translate |

## Skills-only clients

These read `SKILL.md` folders and have no plugin concept this skill packages for: OpenCode, Windsurf,
Roo Code, JetBrains Junie, VS Code (Copilot agent skills). `npx skills add <owner/repo>` installs a
repository's skills into them. Treat the list as a floor: sources disagree on how many tools adopted the
Agent Skills format (20 to 26+).

## Invocation policy

`disable-model-invocation: true` is Claude Code frontmatter and is **not** in the Agent Skills
specification, whose frontmatter is `name`, `description`, `license`, `compatibility`, `metadata`,
`allowed-tools`. Codex's equivalent is a file inside the skill folder:

```yaml
# <skill>/agents/openai.yaml
policy:
  allow_implicit_invocation: false   # default true; explicit $skill still works
```

No equivalent was found for Antigravity, Cursor or Copilot as of the read date.

## Sources

- <https://developers.openai.com/codex/plugins/build> and /codex/skills
- <https://antigravity.google/docs/plugins/> and /docs/skills/
- <https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference>
- <https://cursor.com/docs/reference/plugins>
- <https://agent-plugins.org> and <https://agentskills.io/specification>
- <https://geminicli.com/docs/extensions/reference/>
