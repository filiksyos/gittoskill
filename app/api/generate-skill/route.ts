import { NextRequest, NextResponse } from 'next/server'
import {
  getAzureQuickModel,
  getAzureQuickReasoningEffort,
  generateAzureChatText,
} from '@/lib/azure-openai'
import {
  buildProfileAnalysisPrompt,
  buildReferenceFiles,
  buildSkillMarkdown,
  skillDirectoryName,
  type SkillOutput,
} from '@/lib/generate-skill'
import {
  getGitHubProfileOverview,
  getGitHubRepoStyleDetails,
  type GitHubProfileRepo,
} from '@/lib/github-client'
import { parseGitHubProfileInput } from '@/lib/parse-github-profile'

const STYLE_GUIDE_SYSTEM_PROMPT = `You are generating a Cursor skill that helps an agent code in a specific GitHub developer's style.

Write a concise but concrete markdown guide focused on philosophy and style.
Start directly with useful guidance. Do not include a title that repeats the developer's name or username.
Do not output headings like "Style Guide" or "<name> / <username> style guide".

Use these sections:
1. "What they tend to build"
2. "Coding patterns to mirror"
3. "Product and UI taste" (if evidence exists)
4. "Tech stack clues"
5. "When to inspect repos first"

Focus on observations backed by the provided repositories and profile materials. Avoid filler, hype, or safety disclaimers.`

function selectReposForDeepDive(repos: GitHubProfileRepo[]): GitHubProfileRepo[] {
  return repos
    .filter((repo) => !repo.isArchived)
    .sort((left, right) => {
      const leftScore = left.stargazerCount + left.forkCount * 2
      const rightScore = right.stargazerCount + right.forkCount * 2
      return rightScore - leftScore
    })
    .slice(0, 4)
}

export async function POST(request: NextRequest) {
  let body: { profile?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (typeof body.profile !== 'string') {
    return NextResponse.json(
      { error: 'profile is required (string).' },
      { status: 400 }
    )
  }

  const parsed = parseGitHubProfileInput(body.profile)
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          'Enter a GitHub profile like @steipete or https://github.com/steipete.',
      },
      { status: 400 }
    )
  }

  try {
    const overview = await getGitHubProfileOverview(parsed.login)
    const selectedRepos = selectReposForDeepDive([
      ...overview.pinnedRepos,
      ...overview.topRepos,
    ])
    const repoDetails = await getGitHubRepoStyleDetails(selectedRepos)

    const styleGuide = await generateAzureChatText({
      model: getAzureQuickModel(),
      systemPrompt: STYLE_GUIDE_SYSTEM_PROMPT,
      userMessage: buildProfileAnalysisPrompt({ overview, repoDetails }),
      reasoningEffort: getAzureQuickReasoningEffort(),
      maxCompletionTokens: 2000,
    })

    const skillMarkdown = buildSkillMarkdown({
      overview,
      repoDetails,
      styleGuide,
    })
    const references = buildReferenceFiles({ overview, repoDetails })

    const output: SkillOutput = {
      login: overview.login,
      skillDirectoryName: skillDirectoryName(overview.login),
      skillMarkdown,
      references,
      installCommand: `npx gittoskill add @${overview.login}`,
    }

    return NextResponse.json(output)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed.'
    const lower = message.toLowerCase()
    const status =
      lower.includes('not found')
        ? 404
        : lower.includes('required') || lower.includes('configured')
          ? 500
          : 502

    return NextResponse.json({ error: message }, { status })
  }
}
