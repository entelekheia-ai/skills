// SPDX-License-Identifier: Apache-2.0
export type Track = { name: string; status: string; by?: string; task?: string; commits: string[]; depends: string[] }
export type Run = {
  isActive: boolean
  plan?: string
  branch?: string
  at?: string
  tracks: Track[]
  openQuestions: number
  learningsRouted?: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'method': { run: Shaped<Run> }
  }
}
