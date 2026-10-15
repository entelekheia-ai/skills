// SPDX-License-Identifier: Apache-2.0
//
// A workspace's manifests disagree about its version, or the catalog and the workspaces disagree about
// which plugins exist.
//
// WHY IT EXISTS. `scripts/sync-versions.mjs` used to be the only thing keeping four files in step: the
// root `package.json`'s `workspaces` list, each plugin's own `package.json` (the file changesets
// bumps), its `.claude-plugin/plugin.json`, its root `plugin.json` (the Agent Plugins manifest that
// Codex, Copilot CLI, Cursor and Antigravity read), and its entry in the root
// `.claude-plugin/marketplace.json`. The script only ever COPIES a version forward; nothing reported
// when a plugin folder existed with no entry in the catalog, a catalog entry pointed at a folder that
// had been renamed or deleted, or the two manifests drifted apart in name. This gate reads all of them
// and says which pair disagrees, instead of one script quietly overwriting the others from one.
//
// POPULATION. The root `package.json`'s own `workspaces` array, read directly off disk rather than
// from `files` — this gate compares several files against each other and must see all of them or none,
// and `files.length === 0` is used only to decide there is nothing declared to check at all.
//
// FIVE RULES. `manifest-version-drift`: a workspace's `package.json` version differs from its
// `.claude-plugin/plugin.json` version or its root `plugin.json` version.
// `manifest-marketplace-missing`: a workspace has no entry in `marketplace.json`, or its entry's
// version differs from the plugin's own. `manifest-marketplace-orphan`: a *local* marketplace entry
// (a relative `source`) names a folder that is not a workspace. `manifest-portable-invalid`: the root
// `plugin.json` is missing, does not declare the Agent Plugins 1.x `$schema`, or names a different
// plugin than `.claude-plugin/plugin.json`. `manifest-catalog-stale`: the Codex or Cursor catalog differs
// from what `scripts/marketplaces.mjs` derives from the Claude catalog, or a Cursor layer file
// (`.cursor-plugin/plugin.json`, `.cursor-plugin/agents/*`) differs from what `scripts/cursor-overlay.mjs`
// derives from a plugin's `agents/`.
//
// NOT FIXABLE, ON PURPOSE. `vibe-ops check` never forwards `--fix` to a composed ops, and a LOCAL ops
// — declared as a relative `./.vibe-ops/ops.json`, the shape this repository uses — cannot be
// addressed by name for the ops runner's own `--fix` either (`vibe-ops skills` and
// `vibe-ops ./.vibe-ops/ops.json` both refuse). Measured against vibe-ops 0.2.0. So
// `scripts/sync-versions.mjs` stays: this gate is the detector `npm run version` had none of before,
// not a replacement for the repair.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { OVERLAY_DIR, cursorLayer, overlayFiles } from "../../../scripts/cursor-overlay.mjs";
import { CODEX_PATH, CURSOR_PATH, codexCatalog, cursorCatalog } from "../../../scripts/marketplaces.mjs";

function readJSON(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

/** `./delegation` and `delegation` name the same workspace. */
const stripDotSlash = (p) => p.replace(/^\.\//, "").replace(/\/$/, "");

export default {
  definition: {
    id: "manifest-versions",
    version: 1,
    summary:
      "every workspace's package.json, .claude-plugin/plugin.json, root plugin.json and marketplace.json entry agree on its version and its existence",
    defaultPaths: ["package.json", "*/package.json", "*/.claude-plugin/plugin.json", "*/plugin.json", "*/.cursor-plugin/plugin.json", "*/.cursor-plugin/agents/*.md", ".agents/plugins/marketplace.json", ".cursor-plugin/marketplace.json", ".claude-plugin/marketplace.json"],
  },

  async run({ repoRoot, files }) {
    if (files.length === 0) {
      return { findings: [], skipped: "no manifest in this population" };
    }

    const rootPkg = readJSON(path.join(repoRoot, "package.json"));
    const workspaces = Array.isArray(rootPkg?.workspaces) ? rootPkg.workspaces.map(stripDotSlash) : [];
    if (workspaces.length === 0) {
      return { findings: [], skipped: "root package.json declares no workspaces" };
    }

    const marketplacePath = path.join(repoRoot, ".claude-plugin", "marketplace.json");
    const marketplace = existsSync(marketplacePath) ? readJSON(marketplacePath) : undefined;
    const plugins = Array.isArray(marketplace?.plugins) ? marketplace.plugins : [];

    const findings = [];
    let examined = 0;

    for (const dir of workspaces) {
      examined += 1;
      const pkgPath = path.join(repoRoot, dir, "package.json");
      const pkg = readJSON(pkgPath);
      if (pkg?.version === undefined) {
        findings.push({
          rule: "manifest-version-drift",
          file: `${dir}/package.json`,
          evidence: "no readable version in this workspace's package.json",
          level: "fail",
        });
        continue;
      }

      const pluginPath = path.join(repoRoot, dir, ".claude-plugin", "plugin.json");
      const plugin = existsSync(pluginPath) ? readJSON(pluginPath) : undefined;
      if (plugin?.version !== pkg.version) {
        findings.push({
          rule: "manifest-version-drift",
          file: `${dir}/.claude-plugin/plugin.json`,
          evidence: `version ${JSON.stringify(plugin?.version)} does not match ${dir}/package.json's ${pkg.version}`,
          level: "fail",
        });
      }

      const portablePath = path.join(repoRoot, dir, "plugin.json");
      const portable = existsSync(portablePath) ? readJSON(portablePath) : undefined;
      if (portable === undefined || !/^https:\/\/agent-plugins\.org\/schemas\/1\.\d+\.\d+\/plugin\.schema\.json$/.test(String(portable.$schema))) {
        findings.push({
          rule: "manifest-portable-invalid",
          file: `${dir}/plugin.json`,
          evidence: "root plugin.json is missing or does not declare an Agent Plugins 1.x $schema",
          level: "fail",
        });
      } else {
        if (portable.version !== pkg.version) {
          findings.push({
            rule: "manifest-version-drift",
            file: `${dir}/plugin.json`,
            evidence: `version ${JSON.stringify(portable.version)} does not match ${dir}/package.json's ${pkg.version}`,
            level: "fail",
          });
        }
        if (plugin?.name !== undefined && portable.name !== plugin.name) {
          findings.push({
            rule: "manifest-portable-invalid",
            file: `${dir}/plugin.json`,
            evidence: `name ${JSON.stringify(portable.name)} differs from .claude-plugin/plugin.json's ${JSON.stringify(plugin.name)}`,
            level: "fail",
          });
        }
      }

      // Cursor reads agents only from its own layer, derived from agents/ and the root manifest. The layer
      // exists exactly while the plugin has agents, so a layer file with no source is stale too.
      if (portable !== undefined && plugin !== undefined) {
        const agentsDir = path.join(repoRoot, dir, "agents");
        const sources = existsSync(agentsDir)
          ? readdirSync(agentsDir).filter((n) => n.endsWith(".md")).map((n) => ({ file: `${dir}/agents/${n}`, text: readFileSync(path.join(agentsDir, n), "utf8") }))
          : [];
        const layer = cursorLayer(plugin.name, portable, sources);
        for (const [rel, text] of Object.entries(layer)) {
          const abs = path.join(repoRoot, dir, rel);
          if (!existsSync(abs) || readFileSync(abs, "utf8") !== text) {
            findings.push({
              rule: "manifest-catalog-stale",
              file: `${dir}/${rel}`,
              evidence: "differs from what scripts/cursor-overlay.mjs derives from agents/ and plugin.json; run `node scripts/sync-versions.mjs`",
              level: "fail",
            });
          }
        }
        for (const abs of overlayFiles(path.join(repoRoot, dir, OVERLAY_DIR))) {
          const rel = path.relative(path.join(repoRoot, dir), abs);
          if (!(rel in layer)) {
            findings.push({
              rule: "manifest-catalog-stale",
              file: `${dir}/${rel}`,
              evidence: "no agent in agents/ produces this file; run `node scripts/sync-versions.mjs`, which deletes it",
              level: "fail",
            });
          }
        }
      }

      const name = plugin?.name ?? path.basename(dir);
      const entry = plugins.find((p) => p.name === name);
      if (entry === undefined) {
        findings.push({
          rule: "manifest-marketplace-missing",
          file: ".claude-plugin/marketplace.json",
          evidence: `workspace ${dir} (plugin "${name}") has no entry in the catalog`,
          level: "fail",
        });
      } else if (typeof entry.source === "string" && entry.version !== pkg.version) {
        findings.push({
          rule: "manifest-marketplace-missing",
          file: ".claude-plugin/marketplace.json",
          evidence: `entry "${name}" version ${JSON.stringify(entry.version)} does not match ${dir}/package.json's ${pkg.version}`,
          level: "fail",
        });
      }
    }

    if (marketplace !== undefined) {
      for (const [file, derive] of [[CODEX_PATH, codexCatalog], [CURSOR_PATH, cursorCatalog]]) {
        const actual = readJSON(path.join(repoRoot, file));
        if (JSON.stringify(actual) !== JSON.stringify(derive(marketplace))) {
          findings.push({
            rule: "manifest-catalog-stale",
            file,
            evidence: "differs from what scripts/marketplaces.mjs derives from .claude-plugin/marketplace.json; run `node scripts/sync-versions.mjs`",
            level: "fail",
          });
        }
      }
    }

    // The reverse direction: a local marketplace entry naming a folder that is not a workspace.
    for (const entry of plugins) {
      if (typeof entry.source !== "string") continue; // git-subdir and other remote sources are not workspaces
      const dir = stripDotSlash(entry.source);
      if (!workspaces.includes(dir)) {
        findings.push({
          rule: "manifest-marketplace-orphan",
          file: ".claude-plugin/marketplace.json",
          evidence: `entry "${entry.name}" points at "${entry.source}", which is not in the root package.json's workspaces`,
          level: "fail",
        });
      }
    }

    return { findings, examined };
  },
};
