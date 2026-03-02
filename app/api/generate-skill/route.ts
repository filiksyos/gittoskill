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
const DEFAULT_EXTRACTION_OBJECTIVE =
  'Extract the repository logic into reusable, runnable scripts and create a skill that tells an AI agent which script to use, what inputs are required, and how to validate results.'

function cacheKey(owner: string, repo: string, prompt?: string) {
  return `${owner}/${repo}|${prompt ?? ''}`
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY.trim() === '') {
    return NextResponse.json(
      {
        error:
          'OPENROUTER_API_KEY is missing. Add it to .env.local and restart the dev server.',
      },
      { status: 500 }
    )
  }

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

  if (prompt !== undefined && typeof prompt !== 'string') {
    return NextResponse.json(
      { error: 'prompt must be a string when provided' },
      { status: 400 }
    )
  }

  const normalizedPrompt = prompt?.trim() ?? ''
  const effectivePrompt = normalizedPrompt || DEFAULT_EXTRACTION_OBJECTIVE
  const key = cacheKey(owner, repo, effectivePrompt)
  const existing = inFlight.get(key)
  if (existing) {
    console.log('[generate-skill] Dedup: waiting for in-flight', key)
    const out = await existing
    return out instanceof NextResponse ? out : NextResponse.json({ files: out.files }, { status: 200 })
  }

  serverLog.request(owner, repo, effectivePrompt)

  const promise = (async () => {
    let tree: { tree: Array<{ path: string; type: string }>; truncated: boolean }
    let readme: string

    try {
      ;[tree, readme] = await Promise.all([
        getFileTree(owner, repo),
        getReadme(owner, repo),
      ])
      serverLog.githubOk(tree.tree.length, tree.truncated, readme.length)
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

    let capturedFiles: Array<{ path: string; content: string }> = []
    let didCaptureFiles = false
    let stepIndex = 0
    let totalSteps = 0
    let totalUsage: unknown

    const initialMessage = [
      `## Repository\n\nUse **owner: "${owner}"** and **repo: "${repo}"** when calling getFileTree or readFiles.\n\n`,
      '## Repository root structure (depth 1)\n\n```',
      depth1Tree,
      '```',
      '\n\n## README\n\n',
      readme
        ? '```\n' + readme + '\n```'
        : '*(No README.md or empty)*',
      '\n\n## Objective\n\n',
      effectivePrompt,
      '\n\n## Output contract\n\n',
      '- Produce a skill package with SKILL.md, at least one scripts/* file, and references/source-map.md.\n',
      '- Keep outputs SHORT: SKILL.md <120 lines, each script <80 lines. Verbose output will be truncated.\n',
      '- Focus only on code relevant to the objective.\n',
      tree.truncated
        ? '- Repository tree was truncated by GitHub API; prioritize key files and mention any assumptions.\n'
        : '',
    ].join('')

    try {
      const result = await generateText({
        model: openrouter.chat('anthropic/claude-sonnet-4.5'),
        system: SYSTEM_PROMPT,
        prompt: initialMessage,
        tools: {
          getFileTree: getFileTreeTool,
          readFiles: readFilesTool,
          createSkillFiles: createSkillFilesTool((files) => {
            capturedFiles = files
            didCaptureFiles = true
          }),
        },
        stopWhen: [stepCountIs(28), hasToolCall('createSkillFiles')],
        maxOutputTokens: 48000,
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
      totalSteps = result.steps.length
      totalUsage = result.totalUsage
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      const stack = error instanceof Error ? error.stack : undefined
      serverLog.generateError(message, stack)
      const lower = message.toLowerCase()
      const isAuthError =
        lower.includes('missing authentication') ||
        lower.includes('authentication') ||
        lower.includes('unauthorized') ||
        lower.includes('invalid api key')

      return NextResponse.json(
        {
          error: isAuthError
            ? 'Skill generation failed: OpenRouter authentication failed. Verify OPENROUTER_API_KEY in .env.local and restart the dev server.'
            : `Skill generation failed: ${message}`,
        },
        { status: 500 }
      )
    }

    if (!didCaptureFiles) {
      serverLog.noFilesProduced()
      return NextResponse.json(
        { error: 'Agent did not produce skill files.' },
        { status: 500 }
      )
    }
    const finalizedFiles = capturedFiles

    serverLog.success(
      finalizedFiles.length,
      finalizedFiles.map((f) => f.path),
      totalSteps,
      totalUsage
    )
    return { files: finalizedFiles }
  })()

  inFlight.set(key, promise)
  try {
    const out = await promise
    return out instanceof NextResponse ? out : NextResponse.json({ files: out.files }, { status: 200 })
  } finally {
    inFlight.delete(key)
  }
}
