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

function isMissingRepositoryError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('could not resolve to a repository') ||
    lower.includes('could not resolve to repository')
  )
}

function isMissingUserError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('could not resolve to a user') ||
    lower.includes('could not resolve to user')
  )
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
  const userQuery = `
    query UserProfileOverview($login: String!, $repoLimit: Int!) {
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
      profileReadme: repository(owner: $login, name: $login) {
        readme: object(expression: "HEAD:README.md") {
          ... on Blob {
            text
          }
        }
      }
    }
  `

  let userData: {
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
    profileReadme?: {
      readme?: BlobNode | null
    } | null
  }

  try {
    userData = await fetchGitHubGraphQl(userQuery, {
      login,
      repoLimit: MAX_OVERVIEW_REPOS,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isMissingUserError(message)) {
      userData = { user: null, profileReadme: null }
    } else if (!isMissingRepositoryError(message)) {
      throw error
    } else {
      userData = await fetchGitHubGraphQl<{
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
      }>(
        `
          query UserProfileOverviewWithoutReadme($login: String!, $repoLimit: Int!) {
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
          }
        `,
        { login, repoLimit: MAX_OVERVIEW_REPOS }
      )
    }
  }

  if (userData.user?.login && userData.user.url && userData.user.avatarUrl) {
    const pinnedRepos = uniqueRepos(
      (userData.user.pinnedItems?.nodes ?? [])
        .map((repo) => normalizeRepo(repo))
        .filter((repo): repo is GitHubProfileRepo => Boolean(repo))
    )
    const topRepos = uniqueRepos(
      (userData.user.repositories?.nodes ?? [])
        .map((repo) => normalizeRepo(repo))
        .filter((repo): repo is GitHubProfileRepo => Boolean(repo))
    )

    return {
      login: userData.user.login,
      displayName: userData.user.name?.trim() || userData.user.login,
      bio: userData.user.bio?.trim() || null,
      websiteUrl: userData.user.websiteUrl?.trim() || null,
      profileUrl: userData.user.url,
      avatarUrl: userData.user.avatarUrl,
      followerCount: userData.user.followers?.totalCount ?? null,
      profileReadme: trimBlobText(userData.profileReadme?.readme?.text, 12000),
      pinnedRepos,
      topRepos,
    }
  }

  const organizationQuery = `
    query OrganizationProfileOverview($login: String!, $repoLimit: Int!) {
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

  let orgData: {
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
  }

  try {
    orgData = await fetchGitHubGraphQl(organizationQuery, {
      login,
      repoLimit: MAX_OVERVIEW_REPOS,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isMissingRepositoryError(message)) {
      orgData = await fetchGitHubGraphQl<{
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
      }>(
        `
          query OrganizationProfileOverviewWithoutReadme($login: String!, $repoLimit: Int!) {
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
          }
        `,
        { login, repoLimit: MAX_OVERVIEW_REPOS }
      )
    } else if (
      message.toLowerCase().includes('read:org') ||
      message.toLowerCase().includes('granted the required scopes')
    ) {
      throw new Error(
        'This token can read normal user profiles, but organization profiles need the GitHub `read:org` scope.'
      )
    } else {
      throw error
    }
  }

  const pinnedRepos = uniqueRepos(
    (orgData.organization?.pinnedItems?.nodes ?? [])
      .map((repo) => normalizeRepo(repo))
      .filter((repo): repo is GitHubProfileRepo => Boolean(repo))
  )
  const topRepos = uniqueRepos(
    (orgData.organization?.repositories?.nodes ?? [])
      .map((repo) => normalizeRepo(repo))
      .filter((repo): repo is GitHubProfileRepo => Boolean(repo))
  )

  if (
    !orgData.organization?.login ||
    !orgData.organization.url ||
    !orgData.organization.avatarUrl
  ) {
    throw new Error(`GitHub profile "${login}" was not found.`)
  }

  return {
    login: orgData.organization.login,
    displayName: orgData.organization.name?.trim() || orgData.organization.login,
    bio: orgData.organization.description?.trim() || null,
    websiteUrl: orgData.organization.websiteUrl?.trim() || null,
    profileUrl: orgData.organization.url,
    avatarUrl: orgData.organization.avatarUrl,
    followerCount: null,
    profileReadme: trimBlobText(orgData.profileReadme?.readme?.text, 12000),
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
