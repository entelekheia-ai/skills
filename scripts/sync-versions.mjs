// SPDX-License-Identifier: Apache-2.0
// Copy each plugin's package.json version — the one changesets bumps — into its root plugin.json (the
// Agent Plugins manifest Codex, Copilot CLI, Cursor and Antigravity read), its .claude-plugin/plugin.json and
// its entry in the root marketplace.json; then regenerate the Codex and Cursor catalogs from that one and, for a plugin with agents, its Cursor layer.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { OVERLAY_DIR, cursorLayer, overlayFiles } from './cursor-overlay.mjs'
import { CODEX_PATH, CURSOR_PATH, codexCatalog, cursorCatalog } from './marketplaces.mjs'

const read = (p) => JSON.parse(readFileSync(p, 'utf8'))
const write = (p, v) => {
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(v, null, 2) + '\n')
}

const marketplacePath = '.claude-plugin/marketplace.json'
const marketplace = read(marketplacePath)

for (const dir of read('package.json').workspaces) {
  const { version } = read(`${dir}/package.json`)
  const pluginPath = `${dir}/.claude-plugin/plugin.json`
  const plugin = read(pluginPath)
  plugin.version = version
  write(pluginPath, plugin)
  const portablePath = `${dir}/plugin.json`
  const portable = read(portablePath)
  portable.version = version
  write(portablePath, portable)
  const sources = existsSync(`${dir}/agents`)
    ? readdirSync(`${dir}/agents`).filter((f) => f.endsWith('.md')).map((f) => ({ file: `${dir}/agents/${f}`, text: readFileSync(`${dir}/agents/${f}`, 'utf8') }))
    : []
  const layer = cursorLayer(plugin.name, portable, sources)
  for (const [file, text] of Object.entries(layer)) {
    mkdirSync(dirname(`${dir}/${file}`), { recursive: true })
    writeFileSync(`${dir}/${file}`, text)
  }
  // A generated file whose source was renamed or deleted, or whose last agent is gone, must not outlive it.
  for (const rel of overlayFiles(`${dir}/${OVERLAY_DIR}`).map((f) => f.slice(dir.length + 1))) {
    if (!(rel in layer)) rmSync(`${dir}/${rel}`)
  }
  const entry = marketplace.plugins.find((p) => p.name === plugin.name)
  if (!entry) throw new Error(`${plugin.name} is not listed in ${marketplacePath}`)
  entry.version = version
}

write(marketplacePath, marketplace)
write(CODEX_PATH, codexCatalog(marketplace))
write(CURSOR_PATH, cursorCatalog(marketplace))
