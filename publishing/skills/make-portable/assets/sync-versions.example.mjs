// SPDX-License-Identifier: Apache-2.0
// Version script for a repository whose single plugin root is the repository root. Copies the plugin's
// version into the root `plugin.json` and `.claude-plugin/plugin.json`, derives the Codex and Cursor
// catalogs and, when the plugin has `agents/`, its Cursor layer. With --check it writes nothing and exits
// 1 when any file differs from what a run would write. Needs `marketplaces.mjs` and `cursor-overlay.mjs`
// from this skill's assets beside it. A repository with several plugins loops the body over its workspaces.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { OVERLAY_DIR, cursorLayer, overlayFiles } from './cursor-overlay.mjs'
import { CODEX_PATH, CURSOR_PATH, codexCatalog, cursorCatalog } from './marketplaces.mjs'

const check = process.argv.includes('--check')
const read = (p) => JSON.parse(readFileSync(p, 'utf8'))
const stale = []
const put = (p, text) => {
  if (check) {
    if (!existsSync(p) || readFileSync(p, 'utf8') !== text) stale.push(p)
    return
  }
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, text)
}
const json = (v) => JSON.stringify(v, null, 2) + '\n'

const plugin = read('.claude-plugin/plugin.json')
// The version has one source: package.json when the repository versions with a tool such as changesets,
// otherwise the vendor manifest itself.
const version = existsSync('package.json') ? read('package.json').version : plugin.version

plugin.version = version
put('.claude-plugin/plugin.json', json(plugin))

const root = read('plugin.json')
if (root.name !== plugin.name) throw new Error(`plugin.json name ${root.name} differs from .claude-plugin/plugin.json name ${plugin.name}`)
root.version = version
put('plugin.json', json(root))

const catalogPath = '.claude-plugin/marketplace.json'
const catalog = read(catalogPath)
const entry = catalog.plugins.find((p) => p.name === plugin.name)
if (!entry) throw new Error(`${plugin.name} is not listed in ${catalogPath}`)
entry.version = version
put(catalogPath, json(catalog))
put(CODEX_PATH, json(codexCatalog(catalog)))
put(CURSOR_PATH, json(cursorCatalog(catalog)))

// The Cursor layer exists exactly while the plugin has agents; a generated file with no source is removed.
const sources = existsSync('agents')
  ? readdirSync('agents').filter((f) => f.endsWith('.md')).map((f) => ({ file: `agents/${f}`, text: readFileSync(`agents/${f}`, 'utf8') }))
  : []
const layer = cursorLayer(plugin.name, root, sources)
for (const [file, text] of Object.entries(layer)) put(file, text)
for (const file of overlayFiles(OVERLAY_DIR)) {
  if (file === `${OVERLAY_DIR}/marketplace.json` || file in layer) continue
  if (check) stale.push(file)
  else rmSync(file)
}

if (check && stale.length) {
  console.error(`Out of date (run: node scripts/sync-versions.mjs): ${stale.join(', ')}`)
  process.exit(1)
}
