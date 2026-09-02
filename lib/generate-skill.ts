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

function dependencyFence(path: string): string {
  if (path.endsWith('.json') || path.endsWith('.toml')) return 'json'
  if (path.endsWith('.gradle.kts')) return 'kotlin'
  if (path.endsWith('.gradle')) return 'gradle'
  if (path.endsWith('.swift')) return 'swift'
  return ''
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
        repo.readme ? `README excerpt:\n${repo.readme}` : '',
        repo.dependencies && repo.dependenciesPath
          ? `Dependency manifest (${repo.dependenciesPath}):\n\`\`\`${dependencyFence(repo.dependenciesPath)}\n${repo.dependencies}\n\`\`\``
          : '',
        repo.globalsCss && repo.globalsCssPath
          ? `UI/design file (${repo.globalsCssPath}):\n\`\`\`css\n${repo.globalsCss}\n\`\`\``
          : '',
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
    'Repository evidence for tech stack and UI taste:',
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
  const { styleGuide } = input

  return `${styleGuide.trim()}\n`
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
      '## README Excerpt',
      '',
      repo.readme || 'Not available.',
      '',
      repo.dependenciesPath
        ? `## Dependency Manifest (\`${repo.dependenciesPath}\`)`
        : '## Dependency Manifest',
      '',
      repo.dependencies
        ? `\`\`\`${dependencyFence(repo.dependenciesPath)}\n${repo.dependencies}\n\`\`\``
        : 'Not available.',
      '',
      repo.globalsCssPath
        ? `## UI / Design File (\`${repo.globalsCssPath}\`)`
        : '## UI / Design File',
      '',
      repo.globalsCss
        ? `\`\`\`css\n${repo.globalsCss}\n\`\`\``
        : 'Not available.',
    ].join('\n'),
  }))

  return [{ path: 'references/profile-summary.md', content: profileSummary }, ...repoFiles]
}
