import { tool } from 'ai'
import { z } from 'zod'
import { readFile } from '@/lib/github-client'

export const readFilesTool = tool({
  inputSchema: z.object({
    owner: z.string(),
    repo: z.string(),
    paths: z.array(z.string()).min(1).max(10),
    branch: z.string().optional(),
  }),
  execute: async ({ owner, repo, paths, branch }) => {
    const branchName = branch ?? 'main'
    const successes: string[] = []
    const failures: string[] = []

    for (const path of paths) {
      try {
        const content = await readFile(owner, repo, path, branchName)
        successes.push(`### ${path}\n\`\`\`\n${content}\n\`\`\``)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        failures.push(`- ${path}: ${message}`)
      }
    }

    let result = successes.join('\n\n')

    if (failures.length > 0) {
      if (result) result += '\n\n'
      result += '**Failed to read:**\n' + failures.join('\n')
    }

    return result
  },
})
