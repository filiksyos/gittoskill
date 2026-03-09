import { NextRequest, NextResponse } from 'next/server'
import { generateText, stepCountIs, hasToolCall } from 'ai'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'
import { getFileTreeTool } from '@/lib/tools/get-file-tree'
import { readFilesTool } from '@/lib/tools/read-files'
import { createSkillFilesTool } from '@/lib/tools/create-skill-files'
import { getFileTree, getReadme } from '@/lib/github-client'
import { formatAsFilteredTree } from '@/lib/file-tree-formatter'
import { serverLog } from '@/lib/server-log'
import {
  getModelForProvider,
  validateProvider,
  PROVIDER_CONFIG,
  type ProviderId,
} from '@/lib/llm-providers'

const inFlight = new Map<string, Promise<{ files: Array<{ path: string; content: string }> } | NextResponse>>()
const DEFAULT_EXTRACTION_OBJECTIVE =
  'Extract the repository logic into reusable, runnable scripts and create a skill that tells an AI agent which script to use, what inputs are required, and how to validate results.'

function cacheKey(
  owner: string,
  repo: string,
  prompt?: string,
  provider?: ProviderId,
  hasUserKey?: boolean
) {
  if (hasUserKey) return null
  return `${owner}/${repo}|${prompt ?? ''}|${provider ?? 'openrouter'}`
}

export async function POST(request: NextRequest) {
  let body: {
    owner?: string
    repo?: string
    prompt?: string
    provider?: unknown
    apiKey?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { owner, repo, prompt, provider: providerRaw, apiKey: userApiKey } = body

  const provider: ProviderId = validateProvider(providerRaw)
    ? providerRaw
    : 'openrouter'

  let model
  try {
    model = getModelForProvider(provider, userApiKey)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }

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
  const hasUserKey = typeof userApiKey === 'string' && userApiKey.trim().length > 0
  const key = cacheKey(owner, repo, effectivePrompt, provider, hasUserKey)
  const existing = key ? inFlight.get(key) : undefined
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
        model,
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

      const providerLabel = PROVIDER_CONFIG[provider]?.label ?? provider
      return NextResponse.json(
        {
          error: isAuthError
            ? `Skill generation failed: ${providerLabel} authentication failed. Verify your API key or ${PROVIDER_CONFIG[provider]?.keyEnv} in .env.local.`
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

  if (key) inFlight.set(key, promise)
  try {
    const out = await promise
    return out instanceof NextResponse ? out : NextResponse.json({ files: out.files }, { status: 200 })
  } finally {
    if (key) inFlight.delete(key)
  }
}
