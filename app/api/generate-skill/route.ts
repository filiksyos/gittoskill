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

const STYLE_GUIDE_SYSTEM_PROMPT = `You are generating a descriptive coding skill profile distilled from a GitHub developer's public work.

Write concise, concrete traits of this developer's approach. The reader will copy individual sections into their coding agent.

Start directly with useful content. Do not include a title that repeats the developer's name or username.
Do not output headings like "Style Guide" or "<name> / <username> style guide".
Do not write instructions to an agent. No "you should", "reach for", "clone repos", or "how to use" language.
Do not use third-person pronouns. Never write "they", "their", "he", "she", or the developer's name in the body.

Write as a direct description of the style — attribute lists and short phrases, not narrative sentences about a person.

Format each section as bullet lists. Lead with the trait, not a subject:
- Good: "- self-hosted, local-first software with clear operational boundaries"
- Good: "- Python as the main preferred stack, with FastAPI for APIs and Pydantic for schemas"
- Bad: "- They favor self-hosted, local-first software"
- Bad: "- He prefers Python for backend work"

Use these sections exactly:
1. "## Philosophy" — values, priorities, and building mindset; draw mainly from profile README, bio, and repository README excerpts
2. "## Tech Stack" — languages, frameworks, tooling, and architectural choices; draw from dependency manifest files (package.json, requirements.txt, pyproject.toml, etc.)
3. "## UI Taste" — only if there is evidence from CSS, design token, or tailwind config files; product and visual/design sensibility

Omit "## UI Taste" entirely if there is no UI/design evidence. Keep every section short enough to paste into a chat.

After each section's bullet list, add one attribution line in this exact format:
> Source: \`<file-path>\` — <owner/repo>

Use the actual file path and repository name from the provided evidence. For Philosophy, cite the profile README or the most relevant repo README. For Tech Stack, cite the dependency manifest file used. For UI Taste, cite the CSS or design file used.

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
