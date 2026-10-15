// SPDX-License-Identifier: Apache-2.0
// Derive Cursor's own plugin layer for a plugin that ships subagents. Cursor reads a root Agent Plugins
// manifest for skills and MCP only; agents need `.cursor-plugin/plugin.json`, and its subagent
// frontmatter differs from Claude Code's: `model` is `inherit` or a Cursor model id (a Claude alias such
// as `sonnet` is not one), `readonly` replaces the `tools` list, and an agent's name is lowercase letters
// and hyphens, so `reviewer` in plugin `delegation` becomes `delegation-reviewer`.
//
// Hooks are NOT derived: a Claude hook reads a Claude payload (`agent_type`, `tool_input`) and signals by
// exit code and stderr; Cursor's hook payloads and events differ, so a guard cannot be translated without
// running it in Cursor. A plugin whose agents rely on a hook for their read-only guarantee runs those agents
// unguarded in Cursor, except where `readonly` below already restricts them. Cursor also discovers
// `hooks/hooks.json` by folder when a manifest declares no `hooks`; Claude's event names are not Cursor's,
// so those hooks are expected to stay inert there, which no run has confirmed.
import { existsSync, readdirSync } from 'node:fs'

export const OVERLAY_DIR = '.cursor-plugin'
export const AGENTS_DIR = `${OVERLAY_DIR}/agents`

export function cursorManifest(portable) {
  const { $schema, extensions, author, ...rest } = portable
  return {
    ...rest,
    ...(author?.name ? { author: { name: author.name } } : {}),
    skills: './skills',
    agents: `./${AGENTS_DIR}`,
  }
}

// Frontmatter is split into top-level keys; a line indented or blank continues the key above it.
function splitFrontmatter(src) {
  const m = src.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) throw new Error('agent file has no frontmatter')
  const keys = []
  for (const line of m[1].split('\n')) {
    const top = line.match(/^([A-Za-z_-]+):/)
    if (top) keys.push({ key: top[1], lines: [line] })
    else keys.at(-1)?.lines.push(line)
  }
  return { keys, body: m[2] }
}

const unquote = (v) => v.trim().replace(/^(["'])(.*)\1$/, '$2')
const WRITERS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

// The tool names an agent declares: inline (`tools: Read, Edit`), flow (`tools: ["Read"]`) or block list.
// `undefined` when the key is absent, which in Claude Code means the agent inherits every tool.
function declaredTools(entry) {
  if (!entry) return undefined
  const inline = entry.lines[0].replace(/^tools:\s*/, '').trim()
  const rest = entry.lines.slice(1).map((l) => l.replace(/^\s*-\s*/, '')).join(',')
  const list = [inline, rest].join(',').split(/[,\s\[\]]+/).map(unquote).filter(Boolean)
  return list.length ? list : undefined // an empty `tools:` declares nothing
}

export function cursorAgent(plugin, src, file = 'an agent file') {
  const { keys, body } = splitFrontmatter(src)
  const get = (k) => keys.find((e) => e.key === k)
  if (!get('name') || !get('description')) throw new Error(`${file} needs both a name and a description in its frontmatter`)
  const tools = declaredTools(get('tools'))
  // Restricted only when the agent declares its tools and none of them writes. A Write-capable agent stays
  // unrestricted (its deliverable is a file), and so does one with no `tools` key: it inherits everything.
  const readonly = tools !== undefined && !tools.some((t) => WRITERS.has(t))
  const raw = unquote(get('name').lines[0].replace(/^name:\s*/, '').replace(/\s+#.*$/, ''))
  const name = `${plugin}-${raw}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-')
  const head = [`name: ${name}`, ...get('description').lines, 'model: inherit', ...(readonly ? ['readonly: true'] : [])]
  return { name, text: `---\n${head.join('\n')}\n---\n${body}` }
}

// Every file the Cursor layer holds for one plugin, as `{ relativePath: text }`. `agentSources` is a list
// of `{ file, text }`.
// Empty when the plugin has no agents: a plugin without them has no Cursor layer to carry.
export function cursorLayer(plugin, portable, agentSources) {
  if (agentSources.length === 0) return {}
  const files = { [`${OVERLAY_DIR}/plugin.json`]: JSON.stringify(cursorManifest(portable), null, 2) + '\n' }
  for (const { file, text } of agentSources) {
    const agent = cursorAgent(plugin, text, file)
    files[`${AGENTS_DIR}/${agent.name}.md`] = agent.text
  }
  return files
}

// Every file under a plugin's `.cursor-plugin/` directory (`dir` is that directory), dot-files excluded.
export function overlayFiles(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.')) return []
    return e.isDirectory() ? overlayFiles(`${dir}/${e.name}`) : [`${dir}/${e.name}`]
  })
}
