const SLUG_SEGMENT = /^[a-zA-Z0-9._-]+$/

export function parseGitHubRepoInput(
  raw: string
): { owner: string; repo: string } | null {
  const s = raw.trim()
  if (!s) return null

  const withoutGit = (name: string) => name.replace(/\.git$/i, '')

  try {
    const url =
      s.includes('://') || s.startsWith('github.com')
        ? new URL(s.startsWith('http') ? s : `https://${s}`)
        : null

    if (url && url.hostname.replace(/^www\./, '') === 'github.com') {
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length < 2) return null
      return { owner: parts[0], repo: withoutGit(parts[1]) }
    }
  } catch {
    // fall through to owner/repo form
  }

  const parts = s.split('/').filter(Boolean)
  if (parts.length === 2 && !s.includes(' ')) {
    return { owner: parts[0], repo: withoutGit(parts[1]) }
  }

  return null
}

export function normalizeRepoSegment(repo: string): string {
  return repo.trim().replace(/\.git$/i, '')
}

export function isValidGitHubRepoPath(owner: string, repo: string): boolean {
  const o = owner.trim()
  const r = normalizeRepoSegment(repo)
  if (!o || !r || o.includes('..') || r.includes('..')) return false
  return SLUG_SEGMENT.test(o) && SLUG_SEGMENT.test(r)
}
