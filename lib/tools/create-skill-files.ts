import { tool } from 'ai'
import { z } from 'zod'

type FileEntry = { path: string; content: string }

export function createSkillFilesTool(
  onCapture: (files: Array<{ path: string; content: string }>) => void
) {
  return tool({
    inputSchema: z.object({
      files: z.union([
        z.array(z.object({ path: z.string(), content: z.string() })).min(1),
        z.string().transform((s) => {
          try {
            const parsed = JSON.parse(s) as unknown
            if (!Array.isArray(parsed)) return []
            return parsed
              .map((f: unknown) =>
                f && typeof f === 'object' && 'path' in f && 'content' in f
                  ? { path: String((f as FileEntry).path), content: String((f as FileEntry).content) }
                  : null
              )
              .filter(Boolean) as FileEntry[]
          } catch {
            return []
          }
        }).pipe(z.array(z.object({ path: z.string(), content: z.string() })).min(1)),
      ]),
    }),
    execute: async ({ files }) => {
      const hasSkillMd = files.some((f) => f.path === 'SKILL.md' || f.path.endsWith('/SKILL.md'))
      if (!hasSkillMd) {
        throw new Error('files must include SKILL.md')
      }
      const hasScript = files.some((f) => /(^|\/)scripts\/.+/.test(f.path))
      if (!hasScript) {
        throw new Error('files must include at least one scripts/* file')
      }
      let finalFiles = files
      const hasSourceMap = files.some((f) => /(^|\/)references\/source-map\.md$/.test(f.path))
      if (!hasSourceMap) {
        const scriptPaths = files
          .filter((f) => /(^|\/)scripts\/.+/.test(f.path))
          .map((f) => f.path)
        const minimalSourceMap = `# Source map\n\n| Generated file | Source |\n|----------------|--------|\n${scriptPaths.map((p) => `| ${p} | (extracted from repo) |`).join('\n')}\n`
        finalFiles = [...files, { path: 'references/source-map.md', content: minimalSourceMap }]
      }
      onCapture(finalFiles)
      const paths = finalFiles.map((f) => f.path).join(', ')
      return `Successfully captured skill files: ${paths}`
    },
  })
}
