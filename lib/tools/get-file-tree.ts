import { tool } from 'ai'
import { z } from 'zod'
import { getFileTree } from '@/lib/github-client'
import { formatAsFilteredTree } from '@/lib/file-tree-formatter'

export const getFileTreeTool = tool({
  inputSchema: z.object({
    owner: z.string(),
    repo: z.string(),
    branch: z.string().optional(),
    paths: z.array(z.string()).optional(),
    maxDepth: z.number().int().positive().optional(),
  }),
  execute: async ({ owner, repo, branch, paths, maxDepth }) => {
    const branchName = branch ?? 'main'
    const tree = await getFileTree(owner, repo, branchName)

    const items = tree.tree.map((item) => ({ path: item.path, type: item.type }))

    const effectiveMaxDepth =
      maxDepth ?? (paths && paths.length > 0 ? undefined : 1)

    const directoryStructure = formatAsFilteredTree(
      items,
      `${owner}/${repo}`,
      paths,
      effectiveMaxDepth
    )

    const filterInfo = paths
      ? `Filtered to paths: ${paths.join(', ')}`
      : 'Showing root level only (use paths parameter to explore deeper)'
    const depthInfo = effectiveMaxDepth
      ? ` with max depth ${effectiveMaxDepth}`
      : ' with full depth'

    return (
      `Successfully analyzed repository structure for ${owner}/${repo}@${branchName}. ` +
      `Found ${tree.tree.length} total items${tree.truncated ? ' (truncated)' : ''}. ` +
      `${filterInfo}${depthInfo}.\n\n` +
      `Repository structure:\n\`\`\`\n${directoryStructure}\n\`\`\``
    )
  },
})
