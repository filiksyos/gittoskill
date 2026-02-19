/**
 * Human-readable server logging for the generate-skill API.
 * Prefix [generate-skill] for easy grep.
 */

const P = '[generate-skill]'

export const serverLog = {
  request(owner: string, repo: string, prompt?: string) {
    const promptPart = prompt
      ? ` | prompt: "${prompt.slice(0, 60)}${prompt.length > 60 ? '…' : ''}"`
      : ''
    console.log(`${P} → ${owner}/${repo}${promptPart}`)
  },

  githubOk(treeItemCount: number, truncated: boolean, readmeLength: number) {
    console.log(
      `${P}   GitHub OK: ${treeItemCount} files${truncated ? ' (truncated)' : ''}, readme ${readmeLength} chars`
    )
  },

  githubError(message: string, stack?: string) {
    console.error(`${P} ✗ GitHub error: ${message}`)
    if (stack) console.error(`${P}   ${stack.split('\n').slice(0, 3).join('\n   ')}`)
  },

  stepFinish(
    stepIndex: number,
    toolCalls: Array<{ toolName: string; args: unknown }>,
    toolResults: Array<{ toolName: string; resultPreview: string }>,
    finishReason: string,
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number }
  ) {
    const usageStr = usage?.totalTokens ? ` (${usage.totalTokens} tokens)` : ''
    console.log(`${P}   Step ${stepIndex}${usageStr} [${finishReason}]`)
    for (const tc of toolCalls) {
      const argPreview = safeArgPreview(tc.args, tc.toolName)
      console.log(`${P}     - ${tc.toolName}(${argPreview})`)
    }
    for (const tr of toolResults) {
      const preview =
        tr.resultPreview.slice(0, 80) + (tr.resultPreview.length > 80 ? '…' : '')
      console.log(`${P}     ← ${tr.toolName}: ${preview.replace(/\n/g, ' ')}`)
    }
  },

  generateError(message: string, stack?: string) {
    console.error(`${P} ✗ Generation failed: ${message}`)
    if (stack) console.error(`${P}   ${stack.split('\n').slice(0, 5).join('\n   ')}`)
  },

  noFilesProduced() {
    console.warn(`${P} ✗ No skill files produced (agent did not call createSkillFiles)`)
  },

  success(
    filesCount: number,
    filePaths: string[],
    totalSteps: number,
    totalUsage?: unknown
  ) {
    const usage =
      totalUsage &&
      typeof totalUsage === 'object' &&
      'totalTokens' in totalUsage
        ? ` (${(totalUsage as { totalTokens?: number }).totalTokens} tokens)`
        : ''
    console.log(`${P} ✓ Done: ${filesCount} files, ${totalSteps} steps${usage}`)
    console.log(`${P}   ${filePaths.join(', ')}`)
  },
}

/** Safe preview of tool args; never throws even if input is string or malformed. */
function safeArgPreview(input: unknown, toolName: string): string {
  if (input == null) return ''
  if (typeof input !== 'object') return String(input).slice(0, 60)
  const obj = input as Record<string, unknown>
  if (toolName === 'createSkillFiles') {
    const files = obj.files
    if (Array.isArray(files)) {
      return files
        .map((f: unknown) => {
          if (f != null && typeof f === 'object' && 'path' in (f as object))
            return String((f as { path?: string }).path ?? '?')
          return '?'
        })
        .join(', ')
    }
  }
  if (Array.isArray(obj.paths))
    return `paths: [${obj.paths.slice(0, 5).join(', ')}${obj.paths.length > 5 ? '…' : ''}]`
  const str = JSON.stringify(obj)
  return str.length > 80 ? str.slice(0, 80) + '…' : str
}
