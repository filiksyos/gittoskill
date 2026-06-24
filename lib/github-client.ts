const GITHUB_GRAPHQL_API = 'https://api.github.com/graphql'
const MAX_OVERVIEW_REPOS = 12

export type GitHubProfileRepo = {
  name: string
  nameWithOwner: string
  description: string | null
  url: string
  stargazerCount: number
  forkCount: number
  updatedAt: string
  primaryLanguage: string | null
  topics: string[]
  isArchived: boolean
}

export type GitHubProfileOverview = {
  login: string
  displayName: string
  bio: string | null
  websiteUrl: string | null
  profileUrl: string
  avatarUrl: string
  followerCount: number | null
  profileReadme: string
  pinnedRepos: GitHubProfileRepo[]
  topRepos: GitHubProfileRepo[]
}

export type GitHubRepoStyleDetails = {
  nameWithOwner: string
  url: string
  description: string | null
  readme: string
  packageJson: string
  tsconfig: string
  tailwindConfig: string
  rootEntries: string[]
}

type RepoNode = {
  name?: string
  nameWithOwner?: string
  description?: string | null
  url?: string
  stargazerCount?: number
  forkCount?: number
  updatedAt?: string
  isArchived?: boolean
  primaryLanguage?: { name?: string } | null
  repositoryTopics?: { nodes?: Array<{ topic?: { name?: string } | null }> }
}

type BlobNode = {
  text?: string | null
}

type TreeNode = {
  entries?: Array<{ name?: string | null; type?: string | null }> | null
}

function githubHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN?.trim()
  if (!token) {
    throw new Error('GITHUB_TOKEN is required for GitHub profile generation.')
  }

  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'gittoskill/0.2.0',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function fetchGitHubGraphQl<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch(GITHUB_GRAPHQL_API, {
    method: 'POST',
    headers: githubHeaders(),
    body: JSON.stringify({ query, variables }),
  })

  const raw = (await response.json().catch(() => ({}))) as {
    data?: T
    errors?: Array<{ message?: string }>
  }

  if (!response.ok) {
    const message =
      raw.errors?.map((error) => error.message).filter(Boolean).join('; ') ||
      `GitHub GraphQL request failed with status ${response.status}.`
    throw new Error(message)
  }

  if (Array.isArray(raw.errors) && raw.errors.length > 0) {
    const message = raw.errors
      .map((error) => error.message)
      .filter(Boolean)
      .join('; ')
    throw new Error(message || 'GitHub GraphQL returned an error.')
  }

  if (!raw.data) {
    throw new Error('GitHub GraphQL returned no data.')
  }

  return raw.data
}

function normalizeRepo(node: RepoNode | null | undefined): GitHubProfileRepo | null {
  if (!node?.name || !node.nameWithOwner || !node.url) {
    return null
  }

  const topics =
    node.repositoryTopics?.nodes
      ?.map((entry) => entry.topic?.name?.trim())
      .filter((topic): topic is string => Boolean(topic)) ?? []

  return {
    name: node.name,
    nameWithOwner: node.nameWithOwner,
    description: node.description?.trim() || null,
    url: node.url,
    stargazerCount: node.stargazerCount ?? 0,
    forkCount: node.forkCount ?? 0,
    updatedAt: node.updatedAt ?? '',
    primaryLanguage: node.primaryLanguage?.name?.trim() || null,
    topics,
    isArchived: Boolean(node.isArchived),
  }
}

function trimBlobText(text: string | null | undefined, maxChars: number): string {
  const trimmed = text?.replace(/\r/g, '').trim() || ''
  if (!trimmed) return ''
  if (trimmed.length <= maxChars) return trimmed
  return `${trimmed.slice(0, maxChars)}\n\n... (truncated)`
}

function normalizeRootEntries(tree: TreeNode | null | undefined): string[] {
  return (
    tree?.entries
      ?.map((entry) => {
        const name = entry.name?.trim()
        if (!name) return null
        return `${entry.type === 'tree' ? 'dir' : 'file'}: ${name}`
      })
      .filter((entry): entry is string => Boolean(entry))
      .sort((left, right) => left.localeCompare(right)) ?? []
  )
}

function uniqueRepos(repos: GitHubProfileRepo[]): GitHubProfileRepo[] {
  const seen = new Set<string>()
  const out: GitHubProfileRepo[] = []

  for (const repo of repos) {
    const key = repo.nameWithOwner.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(repo)
  }

  return out
}

export async function getGitHubProfileOverview(
  login: string
): Promise<GitHubProfileOverview> {
  const query = `
    query ProfileOverview($login: String!, $repoLimit: Int!) {
      user(login: $login) {
        login
        name
        bio
        websiteUrl
        url
        avatarUrl
        followers {
          totalCount
        }
        pinnedItems(first: 6, types: REPOSITORY) {
          nodes {
            ... on Repository {
              name
              nameWithOwner
              description
              url
              stargazerCount
              forkCount
              updatedAt
              isArchived
              primaryLanguage { name }
              repositoryTopics(first: 5) {
                nodes { topic { name } }
              }
            }
          }
        }
        repositories(
          first: $repoLimit
          ownerAffiliations: OWNER
          privacy: PUBLIC
          isFork: false
          orderBy: { field: STARGAZERS, direction: DESC }
        ) {
          nodes {
            name
            nameWithOwner
            description
            url
            stargazerCount
            forkCount
            updatedAt
            isArchived
            primaryLanguage { name }
            repositoryTopics(first: 5) {
              nodes { topic { name } }
            }
          }
        }
      }
      organization(login: $login) {
        login
        name
        description
        websiteUrl
        url
        avatarUrl
        pinnedItems(first: 6, types: REPOSITORY) {
          nodes {
            ... on Repository {
              name
              nameWithOwner
              description
              url
              stargazerCount
              forkCount
              updatedAt
              isArchived
              primaryLanguage { name }
              repositoryTopics(first: 5) {
                nodes { topic { name } }
              }
            }
          }
        }
        repositories(
          first: $repoLimit
          privacy: PUBLIC
          isFork: false
          orderBy: { field: STARGAZERS, direction: DESC }
        ) {
          nodes {
            name
            nameWithOwner
            description
            url
            stargazerCount
            forkCount
            updatedAt
            isArchived
            primaryLanguage { name }
            repositoryTopics(first: 5) {
              nodes { topic { name } }
            }
          }
        }
      }
      profileReadme: repository(owner: $login, name: $login) {
        readme: object(expression: "HEAD:README.md") {
          ... on Blob {
            text
          }
        }
      }
    }
  `

  const data = await fetchGitHubGraphQl<{
    user?: {
      login?: string
      name?: string | null
      bio?: string | null
      websiteUrl?: string | null
      url?: string
      avatarUrl?: string
      followers?: { totalCount?: number } | null
      pinnedItems?: { nodes?: RepoNode[] | null } | null
      repositories?: { nodes?: RepoNode[] | null } | null
    } | null
    organization?: {
      login?: string
      name?: string | null
      description?: string | null
      websiteUrl?: string | null
      url?: string
      avatarUrl?: string
      pinnedItems?: { nodes?: RepoNode[] | null } | null
      repositories?: { nodes?: RepoNode[] | null } | null
    } | null
    profileReadme?: {
      readme?: BlobNode | null
    } | null
  }>(query, { login, repoLimit: MAX_OVERVIEW_REPOS })

  const actor = data.user ?? data.organization
  if (!actor?.login || !actor.url || !actor.avatarUrl) {
    throw new Error(`GitHub profile "${login}" was not found.`)
  }

  const pinnedRepos = uniqueRepos(
    (actor.pinnedItems?.nodes ?? [])
      .map((repo) => normalizeRepo(repo))
      .filter((repo): repo is GitHubProfileRepo => Boolean(repo))
  )
  const topRepos = uniqueRepos(
    (actor.repositories?.nodes ?? [])
      .map((repo) => normalizeRepo(repo))
      .filter((repo): repo is GitHubProfileRepo => Boolean(repo))
  )

  const actorBio =
    data.user != null
      ? data.user.bio?.trim() || null
      : data.organization?.description?.trim() || null

  return {
    login: actor.login,
    displayName: actor.name?.trim() || actor.login,
    bio: actorBio,
    websiteUrl: actor.websiteUrl?.trim() || null,
    profileUrl: actor.url,
    avatarUrl: actor.avatarUrl,
    followerCount:
      'followers' in actor ? actor.followers?.totalCount ?? null : null,
    profileReadme: trimBlobText(data.profileReadme?.readme?.text, 12000),
    pinnedRepos,
    topRepos,
  }
}

function escapeGraphQlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export async function getGitHubRepoStyleDetails(
  repos: GitHubProfileRepo[]
): Promise<GitHubRepoStyleDetails[]> {
  if (repos.length === 0) return []

  const lines = repos.map((repo, index) => {
    const [owner, name] = repo.nameWithOwner.split('/')
    return `
      repo${index}: repository(owner: "${escapeGraphQlString(owner ?? '')}", name: "${escapeGraphQlString(name ?? '')}") {
        nameWithOwner
        url
        description
        readme: object(expression: "HEAD:README.md") {
          ... on Blob { text }
        }
        packageJson: object(expression: "HEAD:package.json") {
          ... on Blob { text }
        }
        tsconfig: object(expression: "HEAD:tsconfig.json") {
          ... on Blob { text }
        }
        tailwindConfig: object(expression: "HEAD:tailwind.config.ts") {
          ... on Blob { text }
        }
        root: object(expression: "HEAD:") {
          ... on Tree {
            entries {
              name
              type
            }
          }
        }
      }
    `
  })

  const data = await fetchGitHubGraphQl<Record<string, {
    nameWithOwner?: string
    url?: string
    description?: string | null
    readme?: BlobNode | null
    packageJson?: BlobNode | null
    tsconfig?: BlobNode | null
    tailwindConfig?: BlobNode | null
    root?: TreeNode | null
  } | null>>(`query RepoStyleDetails { ${lines.join('\n')} }`)

  return repos.flatMap((repo, index) => {
    const node = data[`repo${index}`]
    if (!node?.nameWithOwner || !node.url) return []

    return [
      {
        nameWithOwner: node.nameWithOwner,
        url: node.url,
        description: node.description?.trim() || null,
        readme: trimBlobText(node.readme?.text, 5000),
        packageJson: trimBlobText(node.packageJson?.text, 2500),
        tsconfig: trimBlobText(node.tsconfig?.text, 2000),
        tailwindConfig: trimBlobText(node.tailwindConfig?.text, 2500),
        rootEntries: normalizeRootEntries(node.root),
      },
    ]
  })
}
