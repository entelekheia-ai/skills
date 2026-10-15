---
name: make-portable
description: Make a plugin or skill collection installable in more than one coding agent — Codex, Copilot CLI, Cursor, Antigravity, OpenCode and the rest — from one source of truth. Use when a plugin has only a Claude Code manifest, when asked to support Codex, Antigravity (agy), Cursor or Copilot, when a skill must stay manual-only in every agent, or "/publishing:make-portable <plugin-dir>".
argument-hint: '<plugin-dir>'
disable-model-invocation: true
user-invocable: true
user_invocable: true
---

# Make a plugin portable

**Before starting, read your notes for this skill**, where they exist — `~/.agents/skill-notes/make-portable.md`,
then `.agents/skill-notes/make-portable.md`, then `.agents/skill-notes/make-portable.local.md`. Where two
disagree, the more specific one wins. They hold what earlier runs taught; see the last section for how
they are written.

Take a plugin that installs in one agent and make it install in the others, without a second copy of
anything. At the end the plugin carries one portable manifest, one catalog per client derived from a
single hand-edited catalog, a version that lives in one file, and a written statement of what each
client receives.

**This is a target-state skill.** A second run repairs what drifted — a client's format moves often —
and `audit` runs Step 1, reads the plugin against Step 3's component rules and runs the validators of Step 7,
then reports the gaps against the matrix in [references/clients.md](references/clients.md) and writes nothing.

The matrix is dated. Read its header first: when the date is older than a month, re-read the vendor
pages it cites before trusting a row, because Codex changed its layout within a quarter.

## Step 1 — Inventory what the plugin holds

List the plugin's components: skills (`skills/*/SKILL.md`), subagents, hooks, MCP servers, commands,
rules. The portable standard (Agent Plugins 1.0) carries **only skills and MCP servers**. Every other
component is client-specific, so the inventory decides how much of the plugin travels.

## Step 2 — Write the root `plugin.json`

Add a `plugin.json` at the plugin root (for a repository whose single plugin root is the repository root,
the root `plugin.json` sits beside `.claude-plugin/`) with the Agent Plugins 1.0 fields: `$schema`
(`https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`), `name`, and optionally `version`,
`description`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions`. The schema is
closed: a component-path field such as `skills` or `hooks` is reported and ignored. The name is
lowercase letters, digits, hyphens and periods, at most 64 characters, with no `--` and no `..`.

Keep the existing vendor manifest (`.claude-plugin/plugin.json`) beside it. Delete a `.codex-plugin/`
fallback when one exists: Codex reads the root manifest, and a fallback is one more file whose version
drifts. The root `version` field is optional; carry it only when a script keeps it in step, otherwise
omit it.
Put settings only one client reads under `extensions.<reverse-domain>` (Codex reads
`extensions.com.openai`).

## Step 3 — Place each client-specific component

Skills need nothing more. For the rest, [references/clients.md](references/clients.md) gives each client's
location. The decisions that matter:

- **MCP servers.** A Claude `.mcp.json` loads in no other client unchanged. The portable `mcp.json` needs
  a `$schema` matching the manifest's version and a `type` on every server, and it expands `${PLUGIN_ROOT}` and
  `${PLUGIN_DATA}`, which Cursor does not (Cursor expands `CURSOR_PLUGIN_ROOT` and `CLAUDE_PLUGIN_ROOT`).
  Antigravity reads its own `mcp_config.json`. A plugin with MCP servers needs one file per client family.

- **Subagents.** Antigravity loads `agents/*.md` from the plugin root, which is where Claude Code
  already reads them, so they travel there unchanged. Copilot CLI reads `com.github.copilot/agents/`
  once a root manifest exists. Cursor needs its own layer: copy
  [assets/cursor-overlay.mjs](assets/cursor-overlay.mjs) into `scripts/` (`mkdir -p scripts && cp ${CLAUDE_SKILL_DIR}/assets/cursor-overlay.mjs scripts/`) and call it from the version
  script. It writes `.cursor-plugin/plugin.json` and one file per agent in `.cursor-plugin/agents/`,
  because Cursor's subagent frontmatter differs: `model` is `inherit` or a Cursor model id (a Claude alias
  such as `sonnet` is not one), `readonly: true` replaces the `tools` list, and names are lowercase
  letters and hyphens. The generator sets `readonly: true` only for an agent that declares a `tools` list
  with no writing tool (`Edit`, `Write`, `MultiEdit`, `NotebookEdit`) in it; an agent with no `tools` key
  inherits every tool and stays unrestricted. It names each agent `<plugin>-<agent>`. Make the commit check regenerate these files and
  compare, the same as the catalogs. Cursor's rule for which manifest wins when both exist is
  undocumented, so state in the README that the Cursor layer is untested in Cursor.
- **Hooks.** Event names, matchers and the variable that points at the plugin root differ per client.
  Keep hooks in the client they were written for and say so in the install table (Step 6). Cursor's
  hook events (`preToolUse`, `subagentStart`, `beforeShellExecution` and others) take a different payload
  from Claude Code's, so a guard translates only after it runs in Cursor. A hook that
  enforces a safety property (a read-only guard) is a reason to state the gap loudly, because the
  other clients run the agent without the guard.
- **Root manifest precedence.** Copilot CLI prefers a root Agent Plugins manifest over
  `.claude-plugin/plugin.json`. Adding the root file therefore moves a Copilot install from the legacy
  layout, which loaded agents and hooks, to the portable one, which loads skills only. Record that
  change in the changelog.

## Step 4 — Derive the catalogs, edit one

A plugin repository that lists several plugins keeps one hand-edited catalog
(`.claude-plugin/marketplace.json`) and generates the others from it with a script:

| Client | Catalog path | Entry shape |
|---|---|---|
| Copilot CLI | reads `.claude-plugin/marketplace.json` | none to derive |
| Codex | `.agents/plugins/marketplace.json` | `{name, source: {source: "local", path: "./dir"}, policy, category}`; a remote plugin uses `source: "git-subdir"` with `url`, `path`, `ref` |
| Cursor | `.cursor-plugin/marketplace.json` | `{name, source: "dir", description}` under `owner` and `metadata` |
| Antigravity | none; installs one plugin from a repository URL or a local directory | none to derive |

Copy [assets/marketplaces.mjs](assets/marketplaces.mjs) into the repository's `scripts/` (`mkdir -p scripts && cp ${CLAUDE_SKILL_DIR}/assets/marketplaces.mjs scripts/`): it derives
the Codex and Cursor catalogs from the Claude one. A plugin whose root is the repository root
(`source: "./"`) becomes `path: "./"` for Codex and `source: "."` for Cursor; the Cursor form is a
guess, because its documentation shows only named subfolders. The Codex entry's `policy` and `category`
values and `interface.displayName` are the ones Codex's own examples use; change `category` to taste.

Cursor receives only the in-repository entries; a remote entry stays out of its catalog and installs from
its own repository. Call the generator from the script that copies versions, and give that script a `--check` mode that
writes nothing and exits 1 when any file it would write differs. The check runs where the repository
checks itself: a commit gate, or CI where no gate exists. A catalog nobody checks is stale within a
release.

[assets/sync-versions.example.mjs](assets/sync-versions.example.mjs) is a working version script for a
single-plugin repository: it copies the version, derives both catalogs and has the `--check` mode. A
repository with several plugins loops it over the workspaces. The Cursor layer needs a driver as well: read
each `agents/*.md`, call `cursorLayer` from the overlay asset, write its files and delete any generated
agent file the layer no longer produces. The check calls the same function and also fails on a generated
file with no source.

**The version has one source.** In a changesets repository that source is the workspace `package.json`;
every manifest and catalog entry is a copy written by the script. Where a plugin's `package.json` does
not exist, the vendor manifest is the source.

## Step 5 — Keep a manual-only skill manual-only everywhere

`disable-model-invocation: true` is a Claude Code key. Agent Skills defines no such field, so every
other client ignores it and may start the skill unprompted. For each skill that sets it, add
`<skill>/agents/openai.yaml` with:

```yaml
policy:
  allow_implicit_invocation: false
```

Codex then runs the skill only on explicit `$skill` invocation. Antigravity and Cursor document no
equivalent switch, so state in the plugin README that those clients may select the skill themselves.
A repository where no skill sets the key needs no file and says so in one README sentence. Also check
each `SKILL.md` against the Agent Skills specification: `name` equals its folder, and `description`
stays within 1024 characters.

## Step 6 — State what each client receives

Add an install table to the README, in the language the README is already written in: one row per channel (Claude Code, Antigravity, Codex, Copilot CLI,
Cursor, and `npx skills add` for the rest), one column per component type. Fill each component cell from what
the format's documentation and the validator output show, never from what the format could permit, and
copy the install commands from [references/clients.md](references/clients.md), marked as not run when
the client was not launched. A repository that generates its changelog from changesets records the
Copilot precedence change in the changeset, since that is where the changelog text comes from.

## Step 7 — Verify, and label what was not run

Run `sh ${CLAUDE_SKILL_DIR}/scripts/verify.sh <plugin-dir>` (`CLAUDE_SKILL_DIR` is the directory this `SKILL.md`
sits in; a client that does not set it needs that path written out). It runs every validator installed on the machine
(`agy plugin validate`, `claude plugin validate --strict`), prints which ones it skipped, and exits
non-zero when a validator that ran failed. The strict Claude validator also reports warnings the
repository carried before this work (for example a `CLAUDE.md` at the plugin root); compare against
the same run on the base branch before attributing a failure to the portable layer. A client without a validator or without an installed binary
is **documentation-checked only**: say that in the report, with the date of the page read, and never
write "tested in Codex" for a client that was not launched. The repository's own check is the
second one: it must pass, and it must fail when the root manifest's version is changed by hand. Make
that edit with a script (`python3` or `node`), because BSD `sed -i` on macOS needs an empty suffix
argument and a failed edit leaves the check passing for the wrong reason; confirm the file changed
before reading the result.

## Checklist

- [ ] The inventory named every component type, and the README says which ones each client receives
- [ ] `plugin.json` exists at the root, declares the Agent Plugins `$schema`, and matches the vendor manifest's name
- [ ] No `.codex-plugin/` fallback remains
- [ ] The version has one source and a script copies it to every manifest and catalog, with a `--check` mode
- [ ] A check regenerates each derived catalog, and changing one by hand fails it
- [ ] Every skill with `disable-model-invocation: true` carries `agents/openai.yaml`
- [ ] `scripts/verify.sh` ran, and the report separates validated clients from documentation-checked ones

## ⟳ After every use: note what this run taught

**Never edit this file** — it is an installed copy, and the next update overwrites it without a word.
Write what the run taught to a notes file instead, one dated line per point, in the narrowest scope that
fits:

- **local** — `.agents/skill-notes/make-portable.local.md`, kept out of git (add `*.local.md` to that
  folder's ignore rules if it is not there yet). The default.
- **repo** — `.agents/skill-notes/make-portable.md`, committed, read by everyone who works in this
  repository.
- **user** — `~/.agents/skill-notes/make-portable.md`, true for you in every project.

Then ask the user whether a note should go back into the skill itself, through the flow they use for it
— an issue, a pull request, an edit in the plugin's own repository. When you do not know that flow, ask.

What is worth noting, in this skill:

- A client row of the matrix that no longer matches its vendor page, with the page's date.
- A repository shape the steps did not fit (a root-level plugin, a repository without CI, no changesets).
- A validator that became available for Codex, Copilot CLI or Cursor.

Verified against: `agy` 1.1.8 (`plugin validate`) and `claude plugin validate --strict`, 2026-10-14; Codex,
Copilot CLI and Cursor from their documentation of the same date, not launched.
