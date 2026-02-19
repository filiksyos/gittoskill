import { NextRequest, NextResponse } from 'next/server'
import { generateText, stepCountIs, hasToolCall } from 'ai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { SYSTEM_PROMPT } from '@/lib/system-prompt'
import { getFileTreeTool } from '@/lib/tools/get-file-tree'
import { readFilesTool } from '@/lib/tools/read-files'
import { createSkillFilesTool } from '@/lib/tools/create-skill-files'
import { getFileTree, getReadme } from '@/lib/github-client'
import { formatAsFilteredTree } from '@/lib/file-tree-formatter'

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
})

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

  try {
    await generateText({
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
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Skill generation failed: ${message}` },
      { status: 500 }
    )
  }

  if (capturedFiles === null) {
    return NextResponse.json(
      { error: 'Agent did not produce skill files.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ files: capturedFiles }, { status: 200 })
}
