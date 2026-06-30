'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CollapsibleSection } from '@/components/collapsible-section'
import { SkillGenerationFlavorText } from '@/components/skill-generation-flavor-text'
import { SkillMarkdown } from '@/components/skill-markdown'
import { parseGitHubProfileInput } from '@/lib/parse-github-profile'
import {
  getDefaultOpenSectionId,
  splitSkillMarkdownSections,
} from '@/lib/parse-skill-sections'

const EXAMPLES = [
  { label: 'pewdiepie', value: '@pewdiepie-archdaemon' },
  { label: 'shadcn', value: '@shadcn' },
  { label: 'karpathy', value: '@karpathy' },
  { label: 'garrytan', value: '@garrytan' },
  { label: 'torvalds', value: '@torvalds' },
] as const

type SkillOutput = {
  login: string
  skillDirectoryName: string
  skillMarkdown: string
  installCommand: string
}

type GittoskillHomeProps = {
  initialProfileInput?: string
}

type ParsedSkillMarkdown = {
  name: string | null
  description: string | null
  body: string
}

function parseSkillMarkdown(markdown: string): ParsedSkillMarkdown {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) {
    return {
      name: null,
      description: null,
      body: markdown.trim(),
    }
  }

  const frontmatter = match[1]

  return {
    name: frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? null,
    description:
      frontmatter
        .match(/^description:\s*(.+)$/m)?.[1]
        ?.trim()
        .replace(/^"(.*)"$/, '$1')
        .replace(/\\"/g, '"') ?? null,
    body: markdown.slice(match[0].length).trim(),
  }
}

function firstNameFromSkillBody(body: string, fallback: string): string {
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? fallback
  const [firstName] = heading.split(/\s+/)
  return firstName || fallback
}

function GitHubIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="currentColor"
    >
      <path d="M12 .5C5.648.5.5 5.648.5 12a11.5 11.5 0 0 0 7.86 10.914c.575.106.786-.25.786-.556 0-.274-.01-1-.016-1.963-3.198.695-3.873-1.541-3.873-1.541-.523-1.328-1.278-1.682-1.278-1.682-1.045-.714.08-.699.08-.699 1.155.081 1.763 1.186 1.763 1.186 1.027 1.76 2.694 1.252 3.35.957.104-.744.402-1.252.732-1.54-2.553-.291-5.238-1.277-5.238-5.684 0-1.255.449-2.282 1.185-3.086-.119-.291-.514-1.462.113-3.049 0 0 .967-.31 3.17 1.18A10.97 10.97 0 0 1 12 6.037c.974.004 1.955.132 2.872.387 2.201-1.49 3.166-1.18 3.166-1.18.629 1.587.234 2.758.115 3.049.738.804 1.184 1.831 1.184 3.086 0 4.418-2.69 5.389-5.254 5.674.413.356.781 1.06.781 2.137 0 1.543-.014 2.787-.014 3.168 0 .309.207.668.793.555A11.503 11.503 0 0 0 23.5 12C23.5 5.648 18.352.5 12 .5Z" />
    </svg>
  )
}

export function GittoskillHome({
  initialProfileInput = '',
}: GittoskillHomeProps) {
  const [profileInput, setProfileInput] = useState(initialProfileInput)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [output, setOutput] = useState<SkillOutput | null>(null)
  const [openSectionId, setOpenSectionId] = useState<string | null>(null)
  const autoStartedRef = useRef(false)
  const parsed = parseGitHubProfileInput(profileInput)
  const parsedSkill = output ? parseSkillMarkdown(output.skillMarkdown) : null
  const skillSections = useMemo(
    () =>
      parsedSkill?.body
        ? splitSkillMarkdownSections(parsedSkill.body)
        : [],
    [parsedSkill?.body]
  )
  const skillFirstName = parsedSkill
    ? firstNameFromSkillBody(parsedSkill.body, output?.login ?? 'Developer')
    : 'Developer'
  const validationError =
    profileInput.trim().length > 0 && !parsed
      ? 'Enter a GitHub profile like @steipete or https://github.com/steipete.'
      : null

  async function runGeneration(input: string) {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/generate-skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: input }),
      })
      const data = (await response.json()) as SkillOutput & { error?: string }

      if (!response.ok) {
        setOutput(null)
        setOpenSectionId(null)
        setError(data.error ?? `Request failed (${response.status})`)
        return
      }

      const sections = splitSkillMarkdownSections(
        parseSkillMarkdown(data.skillMarkdown).body
      )
      setOutput(data)
      setOpenSectionId(getDefaultOpenSectionId(sections))

      const normalized = parseGitHubProfileInput(input)
      if (normalized && typeof window !== 'undefined') {
        window.history.replaceState(
          null,
          '',
          `/${encodeURIComponent(normalized.login)}`
        )
      }
    } catch (requestError) {
      setOutput(null)
      setOpenSectionId(null)
      setError(
        requestError instanceof Error ? requestError.message : 'Request failed.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (autoStartedRef.current) return
    if (!initialProfileInput.trim()) return
    if (!parseGitHubProfileInput(initialProfileInput)) return

    autoStartedRef.current = true
    void runGeneration(initialProfileInput)
  }, [initialProfileInput])

  useEffect(() => {
    if (!output || skillSections.length === 0) return
    setOpenSectionId(getDefaultOpenSectionId(skillSections))
  }, [output?.login, output?.skillMarkdown])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!parsed || loading) return
    void runGeneration(profileInput)
  }

  function toggleSection(id: string) {
    setOpenSectionId((prev) => (prev === id ? null : id))
  }

  return (
    <div id="main-content" className="min-h-screen bg-[#FFFDF8] text-zinc-900">
      <nav className="sticky top-0 z-50 border-b-[3px] border-zinc-900 bg-[#FFFDF8]">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-zinc-900">Git</span>
            <span className="text-[#7c3aed]">ToSkill</span>
          </span>
          <a
            href="https://github.com/filiksyos/gittoskill"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-zinc-700 transition-opacity hover:opacity-70"
            aria-label="Open filiksyos/gittoskill on GitHub"
          >
            <GitHubIcon />
            <span>GitHub</span>
          </a>
        </div>
      </nav>

      <main className="mx-auto flex max-w-5xl flex-col items-center gap-10 px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex w-full flex-col items-center gap-6 text-center">
          <div className="flex w-full flex-col items-center">
            <h1 className="max-w-4xl text-5xl font-extrabold tracking-tighter sm:text-6xl lg:text-7xl">
              GitHub profile into a skill
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-zinc-600">
              Paste a profile, open a section, and copy what you need into your
              coding agent.
            </p>
          </div>

          <div className="relative w-full max-w-4xl">
            <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-xl bg-zinc-900" />
            <form
              onSubmit={onSubmit}
              className="relative z-10 rounded-xl border-[3px] border-zinc-900 bg-[#f3e8ff] p-6 text-left"
            >
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <div className="absolute inset-0 translate-x-1 translate-y-1 rounded bg-zinc-900" />
                  <input
                    name="profile"
                    autoComplete="off"
                    className="relative z-10 w-full rounded border-[3px] border-zinc-900 bg-white px-4 py-3 text-base text-zinc-900 placeholder-zinc-500 focus:outline-none"
                    placeholder="@steipete or https://github.com/steipete"
                    value={profileInput}
                    onChange={(e) => setProfileInput(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !parsed}
                  className="relative z-10 rounded border-[3px] border-zinc-900 bg-[#7c3aed] px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-70 sm:shrink-0"
                >
                  {loading ? 'Generating…' : 'Generate skill'}
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="w-full text-sm text-zinc-600">
                  Example profiles:
                </span>
                {EXAMPLES.map(({ label, value }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setProfileInput(value)}
                    className="rounded border-[3px] border-zinc-900 bg-[#ede9fe] px-3 py-1 text-sm font-medium hover:bg-[#ddd6fe]"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {loading ? (
                <SkillGenerationFlavorText />
              ) : null}

              {validationError ? (
                <p className="mt-3 text-sm text-violet-700" role="alert">
                  {validationError}
                </p>
              ) : null}

              {error ? (
                <p className="mt-3 text-sm text-violet-700" role="alert">
                  {error}
                </p>
              ) : null}
            </form>
          </div>
        </div>

        {output ? (
          <div data-results className="relative w-full max-w-4xl">
            <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-xl bg-zinc-900" />
            <section className="relative z-10 rounded-xl border-[3px] border-zinc-900 bg-[#fafafa] p-6 sm:p-7">
              <div className="flex flex-col gap-5">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                  {`${skillFirstName}'s coding skill`}
                </h2>

                {skillSections.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border-[3px] border-zinc-900">
                    {skillSections.map((section, index) => (
                      <CollapsibleSection
                        key={section.id}
                        id={section.id}
                        title={section.title}
                        rawContent={section.content}
                        isOpen={openSectionId === section.id}
                        onToggle={() => toggleSection(section.id)}
                        isFirst={index === 0}
                      >
                        <SkillMarkdown content={section.content} />
                      </CollapsibleSection>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  )
}
