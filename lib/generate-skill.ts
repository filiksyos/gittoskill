/**
 * Build Cursor skill output (SKILL.md + references/) from GitHub API data only.
 */

export type SkillReferenceFile = {
  path: string
  content: string
}

export type SkillOutput = {
  skillDirectoryName: string
  skillMarkdown: string
  references: SkillReferenceFile[]
  treeTruncated: boolean
}

const MAX_SKILL_NAME_LEN = 64
const MAX_DESCRIPTION_LEN = 1024
const MAX_README_BODY_LINES = 400
const MAX_REFERENCES_BYTES = 100 * 1024
const MAX_REFERENCE_FILES = 10
const PER_FILE_CAP = 48 * 1024

const ROOT_SKIP = new Set(
  [
    'readme.md',
    'license',
    'license.md',
    'copying',
    'changelog.md',
    'changelog',
    'contributing.md',
    'code_of_conduct.md',
    'security.md',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'bun.lockb',
    'composer.lock',
    'poetry.lock',
    'cargo.lock',
    'gemfile.lock',
    'mix.lock',
  ].map((s) => s.toLowerCase())
)

const SOURCE_EXT =
  /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|py|go|rs|java|kt|kts|cs|swift|vue|svelte|rb|php|zig|nim|scala|ml|mli|fs|fsx|hs|clj|ex|exs|dart|lua|r)$/i

function slugSkillSegment(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function skillDirectoryName(owner: string, repo: string): string {
  const base = slugSkillSegment(`${owner}-${repo}`)
  const name = base.slice(0, MAX_SKILL_NAME_LEN)
  return name || 'skill'
}

export function skillFrontmatterName(owner: string, repo: string): string {
  const base = slugSkillSegment(`${owner}-${repo}`)
  const name = base.slice(0, MAX_SKILL_NAME_LEN)
  return name || 'skill'
}

function yamlDoubleQuotedString(s: string): string {
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`
}

function buildDescription(meta: {
  description: string | null
  topics: string[]
  language: string | null
  owner: string
  repo: string
}): string {
  const parts: string[] = []
  if (meta.description?.trim()) {
    parts.push(meta.description.trim())
  }
  if (meta.topics.length) {
    parts.push(`Topics: ${meta.topics.join(', ')}.`)
  }
  if (meta.language?.trim()) {
    parts.push(`Primary language: ${meta.language.trim()}.`)
  }
  parts.push(
    `Repository ${meta.owner}/${meta.repo}. Use for inspiration or when adapting patterns from this project.`
  )
  let desc = parts.join(' ')
  if (desc.length > MAX_DESCRIPTION_LEN) {
    desc = desc.slice(0, MAX_DESCRIPTION_LEN - 1).trimEnd() + '…'
  }
  return desc
}

function trimReadmeForBody(readme: string): { body: string; trimmed: boolean } {
  const lines = readme.split(/\r?\n/)
  if (lines.length <= MAX_README_BODY_LINES) {
    return { body: readme, trimmed: false }
  }
  const slice = lines.slice(0, MAX_README_BODY_LINES)
  return {
    body: `${slice.join('\n')}\n\n… (${lines.length - MAX_README_BODY_LINES} more lines omitted; see references/README.md)`,
    trimmed: true,
  }
}

function isRootBlobPath(itemPath: string): boolean {
  return !itemPath.includes('/')
}

function shouldIncludeRootFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  if (fileName.startsWith('.')) return false
  if (ROOT_SKIP.has(lower)) return false
  if (/\.lock$/i.test(fileName)) return false
  if (/\.min\.(js|css)$/i.test(fileName)) return false
  if (SOURCE_EXT.test(fileName)) return true
  if (/\.(md|txt)$/i.test(fileName) && lower !== 'readme.md') return true
  return false
}

export function listCandidateRootPaths(
  tree: Array<{ path: string; type: string }>
): string[] {
  const blobs = tree.filter(
    (t) =>
      t.type === 'blob' &&
      isRootBlobPath(t.path) &&
      shouldIncludeRootFile(t.path.split('/').pop() ?? '')
  )
  return blobs.map((t) => t.path).sort((a, b) => a.localeCompare(b))
}

export function buildSkillMarkdown(input: {
  owner: string
  repo: string
  meta: {
    description: string | null
    topics: string[]
    language: string | null
  }
  readme: string
  treeTruncated: boolean
}): string {
  const fmName = skillFrontmatterName(input.owner, input.repo)
  const description = buildDescription({
    ...input.meta,
    owner: input.owner,
    repo: input.repo,
  })
  const { body: readmeBody, trimmed: readmeTrimmed } = trimReadmeForBody(
    input.readme || '*(No README or empty)*'
  )

  const notes: string[] = []
  if (input.treeTruncated) {
    notes.push(
      '**Note:** The GitHub API returned a truncated file tree for this repository.'
    )
  }
  if (readmeTrimmed) {
    notes.push(
      '**Note:** README in this file is capped at 400 lines; full text is in `references/README.md`.'
    )
  }

  const header = `# ${input.repo}`
  const metaBlock = notes.length > 0 ? `\n\n${notes.join('\n\n')}` : ''

  return [
    '---',
    `name: ${fmName}`,
    `description: ${yamlDoubleQuotedString(description)}`,
    '---',
    '',
    header,
    metaBlock,
    '',
    readmeBody,
    '',
    '## References',
    '',
    '- Full README: [references/README.md](references/README.md)',
    '- Key root source files: [references/](references/)',
    '',
  ].join('\n')
}

export function mergeReferenceFiles(input: {
  readme: string
  rootFiles: Array<{ path: string; content: string }>
}): SkillReferenceFile[] {
  function truncateToByteBudget(text: string, maxBytes: number): string {
    if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text
    let low = 0
    let high = text.length
    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2)
      const chunk = text.slice(0, mid)
      if (Buffer.byteLength(chunk, 'utf8') <= maxBytes) low = mid
      else high = mid - 1
    }
    return text.slice(0, low)
  }

  let readmeContent = input.readme ?? ''
  if (Buffer.byteLength(readmeContent, 'utf8') > MAX_REFERENCES_BYTES - 256) {
    readmeContent =
      truncateToByteBudget(readmeContent, MAX_REFERENCES_BYTES - 256) +
      '\n\n… (truncated: README exceeded references size budget)'
  }

  const out: SkillReferenceFile[] = [
    { path: 'references/README.md', content: readmeContent },
  ]

  let totalBytes = Buffer.byteLength(out[0]!.content, 'utf8')

  for (const f of input.rootFiles) {
    if (out.length >= MAX_REFERENCE_FILES) break

    let content = f.content
    if (Buffer.byteLength(content, 'utf8') > PER_FILE_CAP) {
      content =
        truncateToByteBudget(content, PER_FILE_CAP - 64) +
        '\n\n… (truncated: file exceeded per-file limit)'
    }

    const room = MAX_REFERENCES_BYTES - totalBytes
    if (room < 128) break

    if (Buffer.byteLength(content, 'utf8') > room) {
      content =
        truncateToByteBudget(content, room - 80) +
        '\n\n… (truncated: references size budget)'
    }

    totalBytes += Buffer.byteLength(content, 'utf8')
    out.push({ path: `references/${f.path}`, content })
  }

  return out
}
