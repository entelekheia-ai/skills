# Entelékheia skills

**Skills, subagents and hooks for agentic work, packaged as small Claude Code plugins — one folder each,
installable on its own.** Each plugin serves one job: routing delegated work, carrying a plan across
sessions, publishing your own skills, keeping a development machine working, or shipping an npm package on
a release-channel policy.

| Plugin | What it gives you |
|---|---|
| `delegation` | Decide where delegated work runs — the main loop, one subagent or a Workflow — and which model and effort run it, from a routing table you tune to your own sessions; carry delegated work across a phase boundary with `hand-off`, and hand an implementer or reviewer subagent a task file with `work-a-task`; turn the delegations your sessions keep briefing from scratch into subagents with `audit-delegations`; and the `plan-scout`, `blind-run`, `reviewer`, `implementer`, `fact-sheet` and `miner` agents, kept read-only by a hook that runs on every Bash, Edit and Write call and acts only inside them |
| `method` | Carry a plan through its remaining tracks unattended between them, paced against the usage limit and the context window; write or rewrite an always-on agent rule with `authoring-rules`; give every skill a place to learn from your runs with `skill-notes`; and route what a piece of work taught to the surface built for that kind of fact with `route-learnings` |
| `publishing` | Take the skills and agents you wrote for your own setup and publish them — inventory, compare with what is public, audit, triage, generalize, verify with gates and a blind review, release |
| `machine` | Keep a development machine working: exclude regenerable development caches from Time Machine and thin the snapshots that pin them, on macOS; restore the VS Code agents panel when its model picker comes up empty after an update |
| `release` | Release channels for npm packages: adopt a stable and beta channel policy with `release-channels-adopt`, promote beta to stable with `release-promote`, and take a never-published repository to publishing itself from CI through npm trusted publishing with `release-first-publish` |
| `vibe-ops` | Full repository governance: born-organized repos, AGENTS.md, ADRs, RFCs, plans and tasks from one source of truth ([its own repository](https://github.com/entelekheia-ai/vibe-ops)) |

## Install

In Claude Code — skills **and** subagents and hooks, for the plugins that have them:

```sh
claude plugin marketplace add entelekheia-ai/skills
claude plugin install delegation@entelekheia
```

Every plugin also carries a root `plugin.json` in the [Agent Plugins](https://agent-plugins.org) format, so
the clients that read it install the whole plugin, not only its skills:

```sh
# OpenAI Codex — add the catalog, then install from the plugin directory
codex plugin marketplace add entelekheia-ai/skills
# GitHub Copilot CLI
copilot plugin marketplace add entelekheia-ai/skills && copilot plugin install delegation@entelekheia
# Google Antigravity CLI
git clone https://github.com/entelekheia-ai/skills && agy plugin install ./skills/delegation   # one plugin per directory
```

Cursor imports the catalog at `.cursor-plugin/marketplace.json` from the repository. A plugin with subagents carries a Cursor layer (`.cursor-plugin/plugin.json` and `.cursor-plugin/agents/`) generated from its `agents/`; the read-only hook guard does not run there, so `delegation`'s `reviewer`, `fact-sheet` and `plan-scout` can write files in Cursor. Only `delegation-miner` and `publishing-extraction-auditor` run there with `readonly: true`, because they declare no write tool. Cursor may also discover `hooks/hooks.json` by folder; Claude's event names are not Cursor's, so those hooks are expected to stay inert there, which no run has confirmed. A manual-only skill (`disable-model-invocation`) carries `agents/openai.yaml` so Codex stays manual too; Antigravity and Cursor document no equivalent and may select such a skill themselves. In any other agent that
reads Agent Skills (OpenCode, Gemini CLI, Windsurf and others) — skills only:

```sh
npx skills add entelekheia-ai/skills
```

What each channel carries:

| Channel | Skills | Subagents | Hooks |
|---|---|---|---|
| Claude Code | yes | yes | yes |
| Antigravity | yes | yes | no |
| Cursor | yes | yes, as `<plugin>-<agent>` | no |
| Codex, Copilot CLI | yes | no | no |
| `npx skills add` | yes | no | no |

Every skill works without the agents and hooks — where a skill mentions one, it says what to do in its
absence — but the plugin's own automation (the guard that keeps an agent read-only, the hook that resumes a
plan across a compaction) only runs inside Claude Code.

## Versions

Each plugin is versioned on its own, and its changes are recorded in its `CHANGELOG.md`. Every change
carries a changeset (`pnpm changeset`); `pnpm run version` applies them and copies each new version into the
plugin manifests. `vibe-ops check` catches drift between them before it ships.

## License

[Apache-2.0](LICENSE)
