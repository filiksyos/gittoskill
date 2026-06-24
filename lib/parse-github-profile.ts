const GITHUB_LOGIN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/

export type GitHubProfileInput = {
  login: string
}

export function parseGitHubProfileInput(raw: string): GitHubProfileInput | null {
  const value = raw.trim()
  if (!value) return null

  const normalizedAt = value.startsWith('@') ? value.slice(1) : value

  try {
    const url =
      normalizedAt.includes('://') || normalizedAt.startsWith('github.com')
        ? new URL(
            normalizedAt.startsWith('http')
              ? normalizedAt
              : `https://${normalizedAt}`
          )
        : null

    if (url && url.hostname.replace(/^www\./, '') === 'github.com') {
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length !== 1) return null
      const login = normalizeProfileSegment(parts[0] ?? '')
      return isValidGitHubProfileLogin(login) ? { login } : null
    }
  } catch {
    // Fall through to plain @username / username parsing.
  }

  if (normalizedAt.includes('/') || normalizedAt.includes(' ')) {
    return null
  }

  const login = normalizeProfileSegment(normalizedAt)
  return isValidGitHubProfileLogin(login) ? { login } : null
}

export function normalizeProfileSegment(raw: string): string {
  return raw.trim().replace(/^@+/, '').replace(/\/+$/, '')
}

export function isValidGitHubProfileLogin(login: string): boolean {
  const value = normalizeProfileSegment(login)
  if (!value || value.includes('..')) return false
  return GITHUB_LOGIN.test(value)
}
