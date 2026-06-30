export type SkillMarkdownSection = {
  id: string
  title: string
  content: string
}

function slugifySectionTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)

  return slug || 'section'
}

export function splitSkillMarkdownSections(body: string): SkillMarkdownSection[] {
  const trimmed = body.trim()
  if (!trimmed) return []

  const headingPattern = /^## (.+)$/gm
  const matches = [...trimmed.matchAll(headingPattern)]

  if (matches.length === 0) {
    return [
      {
        id: 'overview',
        title: 'Overview',
        content: trimmed,
      },
    ]
  }

  const sections: SkillMarkdownSection[] = []
  const firstMatch = matches[0]
  const preamble = trimmed.slice(0, firstMatch.index).trim()

  if (preamble) {
    sections.push({
      id: 'overview',
      title: 'Overview',
      content: preamble,
    })
  }

  const usedIds = new Set<string>()

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const title = match[1].trim()
    const start = (match.index ?? 0) + match[0].length
    const end =
      index + 1 < matches.length
        ? (matches[index + 1].index ?? trimmed.length)
        : trimmed.length
    const content = trimmed.slice(start, end).trim()

    if (!content) continue

    let id = slugifySectionTitle(title)
    if (usedIds.has(id)) {
      let suffix = 2
      while (usedIds.has(`${id}-${suffix}`)) suffix += 1
      id = `${id}-${suffix}`
    }
    usedIds.add(id)

    sections.push({ id, title, content })
  }

  return sections
}

export function getDefaultOpenSectionId(
  sections: SkillMarkdownSection[]
): string | null {
  if (sections.length === 0) return null

  const philosophy = sections.find((section) =>
    section.title.toLowerCase().includes('philosophy')
  )
  if (philosophy) return philosophy.id

  const firstNonOverview = sections.find(
    (section) =>
      section.id !== 'overview' &&
      section.title.toLowerCase() !== 'overview'
  )
  return firstNonOverview?.id ?? sections[0].id
}
