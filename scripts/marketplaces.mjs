// SPDX-License-Identifier: Apache-2.0
// Derive the per-client catalogs from the Claude catalog (`.claude-plugin/marketplace.json`), the one
// file edited by hand. Agent Plugins standardizes the plugin manifest, not the catalog, so each client
// reads its own: Codex `.agents/plugins/marketplace.json`, Cursor `.cursor-plugin/marketplace.json`.
// Copilot CLI reads `.claude-plugin/marketplace.json` itself and needs nothing derived.
export const CODEX_PATH = '.agents/plugins/marketplace.json'
export const CURSOR_PATH = '.cursor-plugin/marketplace.json'

const dotSlash = (p) => (p.startsWith('./') ? p : `./${p}`)

// Codex source shapes: `local` (a path in this repository), `url` (a plugin at a repository root) and
// `git-subdir` (a plugin in a subdirectory). A Claude `github` source is a `url` source.
function codexSource(source) {
  if (typeof source === 'string') return { source: 'local', path: dotSlash(source) }
  const ref = source.ref && { ref: source.ref }
  if (source.source === 'github') return { source: 'url', url: `https://github.com/${source.repo}.git`, ...ref }
  if (source.source === 'url') return { source: 'url', url: source.url, ...ref }
  if (source.source !== 'git-subdir') throw new Error(`no Codex source shape for a Claude "${source.source}" source (${JSON.stringify(source)})`)
  return { source: source.source, url: source.url, ...(source.path && { path: dotSlash(source.path) }), ...ref }
}

export function codexCatalog(catalog) {
  return {
    name: catalog.name,
    interface: { displayName: catalog.name },
    plugins: catalog.plugins.map((p) => ({
      name: p.name,
      source: codexSource(p.source),
      policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
      category: 'Developer Tools',
    })),
  }
}

// Cursor documents a path string for an in-repo plugin. A remote entry has no documented shape that this
// generator can check, so it is left out of the Cursor catalog and the plugin installs there from its own
// repository instead.
export function cursorCatalog(catalog) {
  return {
    name: catalog.name,
    owner: { name: catalog.owner?.name ?? catalog.name },
    ...(catalog.metadata?.description ? { metadata: { description: catalog.metadata.description } } : {}),
    plugins: catalog.plugins
      .filter((p) => typeof p.source === 'string')
      .map((p) => ({
        name: p.name,
        source: p.source.replace(/^\.\//, '') || '.',
        ...(p.description ? { description: p.description } : {}),
      })),
  }
}
