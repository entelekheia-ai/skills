// SPDX-License-Identifier: Apache-2.0
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Run, Track } from '../types'

const PANE = 'method-plan-run'
const run = atom({ plugin: 'method', key: 'run' } as const, { isActive: false, tracks: [], openQuestions: 0 } as Run, { shape: 'run-1' })

let sid = ''

const COLOR: Record<string, string> = {
  done: 'green',
  running: 'yellow',
  runnable: 'cyan',
  waiting: 'gray',
  parked: 'magenta',
  halt: 'red',
}
const GLYPH: Record<string, string> = { done: '✓', running: '●', runnable: '○', waiting: '◷', parked: '⏸', halt: '✕' }

const planName = (p?: string) => (p ? (p.split('/').pop() ?? p).replace(/\.md$/, '') : '')
const doneOf = (r: Run) => r.tracks.filter(t => t.status === 'done').length
const bar = (done: number, total: number, width: number) => {
  const n = total ? Math.round((done / total) * width) : 0
  return '▰'.repeat(n) + '▱'.repeat(Math.max(0, width - n))
}

// The run's state file is written only by run-plan's state.sh; this mod only reads it.
async function refresh($: EngineInterface) {
  if (!/^[0-9a-f-]{36}$/.test(sid)) return
  const ran = await $.process.run(['sh', '-c', `cat "$HOME/.claude/plan-runs/${sid}.json"`])
  if (ran.exitCode !== 0) {
    await update($, run, r => (r.isActive ? { isActive: false, tracks: [], openQuestions: 0 } : r))
    return
  }
  try {
    const j = JSON.parse(ran.stdout) as {
      plan?: string
      branch?: string
      at?: string
      learnings_routed?: boolean
      tracks?: { track?: string; name?: string; status?: string; by?: string; task?: string; commits?: string[]; depends_on?: string[] }[]
      questions?: { answer?: string | null }[]
    }
    const tracks: Track[] = (j.tracks ?? []).map((t, i) => ({
      name: t.track ?? t.name ?? `Track ${i + 1}`,
      status: t.status ?? 'runnable',
      by: t.by,
      task: t.task,
      commits: t.commits ?? [],
      depends: t.depends_on ?? [],
    }))
    await update($, run, () => ({
      isActive: true,
      plan: j.plan,
      branch: j.branch,
      at: j.at,
      tracks,
      openQuestions: (j.questions ?? []).filter(q => q.answer == null).length,
      learningsRouted: j.learnings_routed,
    }))
  } catch {
    // A file caught mid-write is retried on the next tick.
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    sid = await $.session.id()
    await $.command.register({ name: 'plan-run', description: "Open the pane of this session's run-plan run" })
    await refresh($)
    $.clock.every(15_000, () => void refresh($))
    return started
  })

  on('command.run', { command: 'plan-run' }, async $ => {
    await refresh($)
    await $.ui.open({ id: PANE, title: 'Plan run', focus: true, closeOnEscape: true })
    return {}
  })

  // state.sh is the only writer: re-read right after it runs.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (e.command.includes('state.sh')) await refresh($)
    return ran
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const r = await read($, run)
    if (!r.isActive || r.tracks.length === 0) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const done = doneOf(r)
    const total = r.tracks.length
    const current = r.tracks.find(t => t.status === 'running') ?? r.tracks.find(t => t.status === 'runnable')
    const halted = r.tracks.some(t => t.status === 'halt')
    return (
      <Box flexDirection="row" columnGap="sm">
        <Text bold color={halted ? 'red' : done === total ? 'green' : 'cyan'}>
          {planName(r.plan)}
        </Text>
        <Text color={done === total ? 'green' : 'cyan'}>{bar(done, total, 10)}</Text>
        <Text>{done}/{total}</Text>
        {current && (
          <Text dimColor wrap="truncate-end">
            {GLYPH[current.status]} {current.name}
          </Text>
        )}
        {r.openQuestions > 0 && <Text color="magenta">? {r.openQuestions}</Text>}
        <Button label="tracks" hotkey="3" plain onPress={() => void $.ui.open({ id: PANE, title: 'Plan run', focus: true, closeOnEscape: true })} />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const r = await read($, run)
    if (!r.isActive) return <Text dimColor>No run-plan run in this session.</Text>
    const done = doneOf(r)
    const total = r.tracks.length
    return (
      <Box flexDirection="column" rowGap="sm">
        <Box flexDirection="column">
          <Text bold wrap="truncate-end">{planName(r.plan)}</Text>
          <Text dimColor wrap="truncate-end">
            {r.branch ?? '—'} · updated {r.at?.slice(11, 16) ?? '—'}
          </Text>
          <Text>
            <Text color={done === total ? 'green' : 'cyan'}>{bar(done, total, 20)}</Text> {done}/{total} tracks
          </Text>
          {r.openQuestions > 0 && <Text color="magenta">{r.openQuestions} open question(s)</Text>}
          {done === total && (
            <Text color={r.learningsRouted ? 'green' : 'yellow'}>
              {r.learningsRouted ? 'learnings routed' : 'learnings not routed yet'}
            </Text>
          )}
        </Box>
        <Box flexDirection="column">
          {r.tracks.map(t => (
            <Box key={t.name} flexDirection="column">
              <Text wrap="truncate-end">
                <Text color={COLOR[t.status] ?? 'gray'}>{GLYPH[t.status] ?? '·'}</Text> <Text bold>{t.name}</Text>
                <Text dimColor> · {t.status}{t.by ? ` · ${t.by}` : ''}</Text>
              </Text>
              {(t.task || t.commits.length > 0 || t.depends.length > 0) && (
                <Text dimColor wrap="truncate-end">
                  {'  '}
                  {[t.task ? planName(t.task) : '', t.depends.length ? `after ${t.depends.join(', ')}` : '', t.commits.length ? t.commits.join(' ') : '']
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              )}
            </Box>
          ))}
        </Box>
      </Box>
    )
  })
}
