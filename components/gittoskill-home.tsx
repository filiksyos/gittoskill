'use client'

import ReactMarkdown from 'react-markdown'
import { useEffect, useRef, useState } from 'react'
import { parseGitHubProfileInput } from '@/lib/parse-github-profile'
import { SkillGenerationFlavorText } from '@/components/skill-generation-flavor-text'

const EXAMPLES = [
  { label: 'steipete', value: '@steipete' },
  { label: 'shadcn', value: '@shadcn' },
  { label: 'rauchg', value: '@rauchg' },
  { label: 'tj', value: '@tj' },
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

function CopyIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}

export function GittoskillHome({
  initialProfileInput = '',
}: GittoskillHomeProps) {
  const [profileInput, setProfileInput] = useState(initialProfileInput)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [output, setOutput] = useState<SkillOutput | null>(null)
  const autoStartedRef = useRef(false)
  const parsed = parseGitHubProfileInput(profileInput)
  const parsedSkill = output ? parseSkillMarkdown(output.skillMarkdown) : null
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
    setCopied(false)

    try {
      const response = await fetch('/api/generate-skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: input }),
      })
      const data = (await response.json()) as SkillOutput & { error?: string }

      if (!response.ok) {
        setOutput(null)
        setError(data.error ?? `Request failed (${response.status})`)
        return
      }

      setOutput(data)

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

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!parsed || loading) return
    void runGeneration(profileInput)
  }

  async function copyCommand() {
    if (!output?.installCommand) return
    try {
      await navigator.clipboard.writeText(output.installCommand)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  function downloadSkill() {
    if (!output || typeof window === 'undefined') return
    const blob = new Blob([output.skillMarkdown], { type: 'text/markdown' })
    const href = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `${output.skillDirectoryName}.md`
    link.click()
    URL.revokeObjectURL(href)
  }

  return (
    <div id="main-content" className="min-h-screen bg-[#FFFDF8] text-zinc-900">
      <nav className="sticky top-0 z-50 border-b-[3px] border-zinc-900 bg-[#FFFDF8]">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-zinc-900">Git</span>
            <span className="text-[#d31611]">ToSkill</span>
          </span>
          <span className="text-sm text-zinc-600">GitHub profile to skill</span>
        </div>
      </nav>

      <main className="mx-auto flex max-w-5xl flex-col items-center gap-10 px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex w-full flex-col items-center gap-6 text-center">
          <div className="flex w-full flex-col items-center">
            <h1 className="max-w-4xl text-5xl font-extrabold tracking-tighter sm:text-6xl lg:text-7xl">
              GitHub profile into a skill
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-zinc-600">
              Paste a profile and get a clean, installable skill in seconds.
            </p>
          </div>

          <div className="relative w-full max-w-4xl">
            <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-xl bg-zinc-900" />
            <form
              onSubmit={onSubmit}
              className="relative z-10 rounded-xl border-[3px] border-zinc-900 bg-[#fff4da] p-6 text-left"
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
                  className="relative z-10 rounded border-[3px] border-zinc-900 bg-[#d31611] px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-70 sm:shrink-0"
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
                    className="rounded border-[3px] border-zinc-900 bg-[#EBDBB7] px-3 py-1 text-sm font-medium hover:bg-[#ffc480]"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {loading ? (
                <SkillGenerationFlavorText />
              ) : null}

              {validationError ? (
                <p className="mt-3 text-sm text-red-600" role="alert">
                  {validationError}
                </p>
              ) : null}

              {error ? (
                <p className="mt-3 text-sm text-red-600" role="alert">
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
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                    {`${skillFirstName}'s coding skill`}
                  </h2>
                  <button
                    type="button"
                    onClick={downloadSkill}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border-[3px] border-zinc-900 bg-white px-3 py-2 text-sm font-medium text-zinc-900 sm:shrink-0"
                  >
                    <DownloadIcon />
                    <span>Download .md</span>
                  </button>
                </div>

                {parsedSkill?.description ? (
                  <p className="-mt-1 max-w-3xl text-sm leading-7 text-zinc-600">
                    {parsedSkill.description}
                  </p>
                ) : null}

                <div>
                  <h2 className="text-base font-bold tracking-tight text-zinc-900">
                    Installation
                  </h2>
                  <hr className="mt-3 border-zinc-300" />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="inline-flex max-w-full overflow-hidden rounded-xl border-[3px] border-zinc-900 bg-white">
                    <div className="min-w-0 px-4 py-3 font-mono text-sm text-zinc-800 break-all">
                      {output.installCommand}
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyCommand()}
                      aria-label={copied ? 'Copied install command' : 'Copy install command'}
                      title={copied ? 'Copied!' : 'Copy install command'}
                      className="inline-flex shrink-0 items-center justify-center border-l-[3px] border-zinc-900 bg-[#fff4da] px-3 text-zinc-900"
                    >
                      <CopyIcon />
                    </button>
                  </div>
                </div>

                {copied ? (
                  <p className="-mt-2 text-sm font-medium text-[#b61a14]">Copied.</p>
                ) : null}

                <div className="border-t border-zinc-300 pt-5">
                  <h3 className="text-base font-bold tracking-tight text-zinc-900">
                    SKILL.md
                  </h3>
                  <hr className="mt-3 border-zinc-300" />

                  <div className="mt-5">
                    {parsedSkill?.name ? (
                      <p className="font-mono text-sm text-zinc-500">{parsedSkill.name}</p>
                    ) : null}
                  </div>

                  <div className="mt-6 max-w-none text-sm leading-relaxed">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => (
                          <h1 className="mb-4 mt-0 text-3xl font-bold tracking-tight text-zinc-900">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="mb-3 mt-8 border-t border-zinc-200 pt-6 text-lg font-bold tracking-tight text-zinc-900 first:mt-0 first:border-t-0 first:pt-0">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="mb-2 mt-5 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-700">
                            {children}
                          </h3>
                        ),
                        p: ({ children }) => (
                          <p className="mb-4 text-[15px] leading-7 text-zinc-700">
                            {children}
                          </p>
                        ),
                        ul: ({ children }) => (
                          <ul className="mb-5 list-disc space-y-2 pl-5 text-[15px] text-zinc-700 marker:text-[#b61a14]">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="mb-5 list-decimal space-y-2 pl-5 text-[15px] text-zinc-700 marker:font-semibold">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => <li className="leading-7">{children}</li>,
                        a: ({ children, href }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-[#b61a14] underline underline-offset-2"
                          >
                            {children}
                          </a>
                        ),
                        code: ({ children }) => (
                          <code className="rounded-md bg-[#fff4da] px-1.5 py-0.5 font-mono text-[13px] text-zinc-900">
                            {children}
                          </code>
                        ),
                        pre: ({ children }) => (
                          <pre className="mb-5 overflow-auto rounded-xl border border-zinc-200 bg-zinc-950 p-4 font-mono text-[13px] text-zinc-100">
                            {children}
                          </pre>
                        ),
                        hr: () => <hr className="my-6 border-zinc-200" />,
                        blockquote: ({ children }) => (
                          <blockquote className="mb-5 rounded-r-lg border-l-4 border-[#d31611] bg-[#fff8ea] py-1 pl-4 text-zinc-600">
                            {children}
                          </blockquote>
                        ),
                      }}
                    >
                      {parsedSkill?.body ?? output.skillMarkdown}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  )
}
