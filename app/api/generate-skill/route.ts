import { NextRequest, NextResponse } from 'next/server'
import { generateText, stepCountIs, hasToolCall } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'
import { getFileTreeTool } from '@/lib/tools/get-file-tree'
import { readFilesTool } from '@/lib/tools/read-files'
import { createSkillFilesTool } from '@/lib/tools/create-skill-files'
import { getFileTree, getReadme } from '@/lib/github-client'
import { formatAsFilteredTree } from '@/lib/file-tree-formatter'
import { serverLog } from '@/lib/server-log'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

const inFlight = new Map<string, Promise<{ files: Array<{ path: string; content: string }> } | NextResponse>>()

function cacheKey(owner: string, repo: string, prompt?: string) {
  return `${owner}/${repo}|${prompt ?? ''}`
}

export async function POST(request: NextRequest) {
  let body: { owner?: string; repo?: string; prompt?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { owner, repo, prompt } = body

  if (
    !owner ||
    typeof owner !== 'string' ||
    owner.trim() === '' ||
    !repo ||
    typeof repo !== 'string' ||
    repo.trim() === ''
  ) {
    return NextResponse.json(
      { error: 'owner and repo are required non-empty strings' },
      { status: 400 }
    )
  }

  const key = cacheKey(owner, repo, prompt)
  const existing = inFlight.get(key)
  if (existing) {
    console.log('[generate-skill] Dedup: waiting for in-flight', key)
    const out = await existing
    return out instanceof NextResponse ? out : NextResponse.json({ files: out.files }, { status: 200 })
  }

  serverLog.request(owner, repo, prompt)

  const promise = (async () => {
    let tree: { tree: Array<{ path: string; type: string }>; truncated: boolean }
    let readme: string

    try {
      ;[tree, readme] = await Promise.all([
        getFileTree(owner, repo),
        getReadme(owner, repo),
      ])
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = message.toLowerCase().includes('not found') ? 404 : 500
      return NextResponse.json({ error: message }, { status })
    }

  const depth1Tree = formatAsFilteredTree(
    tree.tree,
    `${owner}/${repo}`,
    undefined,
    1
  )

  let capturedFiles: Array<{ path: string; content: string }> | null = null

  const initialMessage = [
    '## Repository root structure (depth 1)\n\n```',
    depth1Tree,
    '```',
    '\n\n## README\n\n',
    readme
      ? '```\n' + readme + '\n```'
      : '*(No README.md or empty)*',
  ].join('') + (prompt ? `\n\n## User request\n\n${prompt}` : '')

  let result: Awaited<ReturnType<typeof generateText>>
  let stepIndex = 0

  try {
    result = await generateText({
      model: openrouter.chat('anthropic/claude-sonnet-4-5'),
      system: SYSTEM_PROMPT,
      prompt: initialMessage,
      tools: {
        getFileTree: getFileTreeTool,
        readFiles: readFilesTool,
        createSkillFiles: createSkillFilesTool((files) => {
          capturedFiles = files
        }),
      },
      stopWhen: [stepCountIs(20), hasToolCall('createSkillFiles')],
      maxOutputTokens: 16000,
      onStepFinish: (stepResult) => {
        try {
          const toolCalls = stepResult.toolCalls.map((tc) => ({
            toolName: tc.toolName,
            args: tc.input,
          }))
          const toolResults = stepResult.toolResults.map((tr) => ({
            toolName: tr.toolName,
            resultPreview:
              typeof tr.output === 'string'
                ? tr.output
                : JSON.stringify(tr.output).slice(0, 200),
          }))
          serverLog.stepFinish(
            ++stepIndex,
            toolCalls,
            toolResults,
            stepResult.finishReason ?? 'unknown',
            stepResult.usage
              ? {
                  inputTokens: stepResult.usage.inputTokens,
                  outputTokens: stepResult.usage.outputTokens,
                  totalTokens: stepResult.usage.totalTokens,
                }
              : undefined
          )
        } catch (logErr) {
          console.error('[generate-skill] (log error)', logErr)
        }
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : undefined
    serverLog.generateError(message, stack)
    return NextResponse.json(
      { error: `Skill generation failed: ${message}` },
      { status: 500 }
    )
  }

  if (capturedFiles === null) {
    serverLog.noFilesProduced()
    return NextResponse.json(
      { error: 'Agent did not produce skill files.' },
      { status: 500 }
    )
  }

  serverLog.success(
    capturedFiles.length,
    capturedFiles.map((f) => f.path),
    result.steps.length,
    result.totalUsage
  )
  return { files: capturedFiles }
  })()

  inFlight.set(key, promise)
  try {
    const out = await promise
    return out instanceof NextResponse ? out : NextResponse.json({ files: out.files }, { status: 200 })
  } finally {
    inFlight.delete(key)
  }
}
