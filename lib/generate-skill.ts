import type {
  GitHubProfileOverview,
  GitHubProfileRepo,
  GitHubRepoStyleDetails,
} from '@/lib/github-client'

export type SkillReferenceFile = {
  path: string
  content: string
}

export type SkillOutput = {
  login: string
  skillDirectoryName: string
  skillMarkdown: string
  references: SkillReferenceFile[]
  installCommand: string
}

function slugSkillSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}

export function skillDirectoryName(login: string): string {
  const base = slugSkillSegment(`${login}-coding-skill`)
  return base || 'coding-skill'
}

function repoBullet(repo: GitHubProfileRepo): string {
  const language = repo.primaryLanguage ? `, ${repo.primaryLanguage}` : ''
  const topics =
    repo.topics.length > 0 ? `, topics: ${repo.topics.slice(0, 4).join(', ')}` : ''
  return `- [${repo.nameWithOwner}](${repo.url})${repo.description ? `: ${repo.description}` : ''} (${repo.stargazerCount} stars${language}${topics})`
}

export function buildProfileAnalysisPrompt(input: {
  overview: GitHubProfileOverview
  repoDetails: GitHubRepoStyleDetails[]
}): string {
  const { overview, repoDetails } = input

  const repoBlocks = repoDetails
    .map((repo) =>
      [
        `## ${repo.nameWithOwner}`,
        repo.description ? `Description: ${repo.description}` : '',
        repo.rootEntries.length > 0
          ? `Root entries:\n${repo.rootEntries.map((entry) => `- ${entry}`).join('\n')}`
          : '',
        repo.packageJson ? `package.json:\n\`\`\`json\n${repo.packageJson}\n\`\`\`` : '',
        repo.tsconfig ? `tsconfig.json:\n\`\`\`json\n${repo.tsconfig}\n\`\`\`` : '',
        repo.tailwindConfig
          ? `tailwind.config.ts:\n\`\`\`ts\n${repo.tailwindConfig}\n\`\`\``
          : '',
        repo.readme ? `README excerpt:\n${repo.readme}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')
    )
    .join('\n\n')

  return [
    `Profile login: ${overview.login}`,
    `Display name: ${overview.displayName}`,
    overview.bio ? `Bio: ${overview.bio}` : '',
    overview.websiteUrl ? `Website: ${overview.websiteUrl}` : '',
    overview.followerCount != null ? `Followers: ${overview.followerCount}` : '',
    '',
    'Pinned / notable repositories:',
    ...overview.pinnedRepos.map(repoBullet),
    '',
    'Top repositories:',
    ...overview.topRepos.map(repoBullet),
    '',
    overview.profileReadme
      ? `Profile README:\n${overview.profileReadme}`
      : 'Profile README: none',
    '',
    'Detailed style signals from shortlisted repositories:',
    repoBlocks || 'No detailed repository excerpts were available.',
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildSkillMarkdown(input: {
  overview: GitHubProfileOverview
  repoDetails: GitHubRepoStyleDetails[]
  styleGuide: string
}): string {
  const { overview, styleGuide } = input
  const allRepos = [...overview.pinnedRepos, ...overview.topRepos]
  const uniqueRepoLines = Array.from(
    new Map(allRepos.map((repo) => [repo.nameWithOwner, repoBullet(repo)])).values()
  )

  return [
    styleGuide.trim(),
    '',
    '## Repo Map',
    '',
    ...uniqueRepoLines,
    '',
  ].join('\n')
}

export function buildReferenceFiles(input: {
  overview: GitHubProfileOverview
  repoDetails: GitHubRepoStyleDetails[]
}): SkillReferenceFile[] {
  const { overview, repoDetails } = input

  const profileSummary = [
    `# ${overview.displayName}`,
    '',
    `- Login: @${overview.login}`,
    `- Profile: ${overview.profileUrl}`,
    overview.websiteUrl ? `- Website: ${overview.websiteUrl}` : '',
    overview.followerCount != null ? `- Followers: ${overview.followerCount}` : '',
    '',
    '## Bio',
    '',
    overview.bio || 'No public bio available.',
    '',
    '## Profile README',
    '',
    overview.profileReadme || 'No profile README available.',
    '',
    '## Repositories',
    '',
    ...Array.from(
      new Map(
        [...overview.pinnedRepos, ...overview.topRepos].map((repo) => [
          repo.nameWithOwner,
          repoBullet(repo),
        ])
      ).values()
    ),
  ]
    .filter(Boolean)
    .join('\n')

  const repoFiles = repoDetails.map((repo) => ({
    path: `references/repos/${repo.nameWithOwner.replace('/', '--')}.md`,
    content: [
      `# ${repo.nameWithOwner}`,
      '',
      repo.description || 'No public description available.',
      '',
      '## Root Entries',
      '',
      ...(repo.rootEntries.length > 0 ? repo.rootEntries.map((entry) => `- ${entry}`) : ['- None']),
      '',
      '## package.json',
      '',
      repo.packageJson ? `\`\`\`json\n${repo.packageJson}\n\`\`\`` : 'Not available.',
      '',
      '## tsconfig.json',
      '',
      repo.tsconfig ? `\`\`\`json\n${repo.tsconfig}\n\`\`\`` : 'Not available.',
      '',
      '## tailwind.config.ts',
      '',
      repo.tailwindConfig ? `\`\`\`ts\n${repo.tailwindConfig}\n\`\`\`` : 'Not available.',
      '',
      '## README Excerpt',
      '',
      repo.readme || 'Not available.',
    ].join('\n'),
  }))

  return [{ path: 'references/profile-summary.md', content: profileSummary }, ...repoFiles]
}
