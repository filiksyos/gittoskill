import { tool } from 'ai'
import { z } from 'zod'

export function createSkillFilesTool(
  onCapture: (files: Array<{ path: string; content: string }>) => void
) {
  return tool({
    inputSchema: z.object({
      files: z
        .array(z.object({ path: z.string(), content: z.string() }))
        .min(1),
    }),
    execute: async ({ files }) => {
      const hasSkillMd = files.some((f) => f.path === 'SKILL.md')
      if (!hasSkillMd) {
        throw new Error('files must include SKILL.md')
      }
      onCapture(files)
      const paths = files.map((f) => f.path).join(', ')
      return `Successfully captured skill files: ${paths}`
    },
  })
}
