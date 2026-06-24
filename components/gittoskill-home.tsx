'use client'

import { useEffect, useRef, useState } from 'react'
import { parseGitHubProfileInput } from '@/lib/parse-github-profile'

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
          <span className="text-sm text-zinc-600">GitHub profile → skill</span>
        </div>
      </nav>

      <main className="mx-auto flex max-w-5xl flex-col items-center gap-12 px-4 py-12 sm:px-6">
        <div className="flex w-full flex-col items-center gap-6 text-center">
          <div className="flex w-full flex-col items-center">
            <h1 className="text-5xl font-extrabold tracking-tighter sm:text-6xl lg:text-7xl">
              Turn any GitHub profile
              <br />
              into a coding skill
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-zinc-600">
              Paste a GitHub profile, and GitToSkill maps the person&apos;s repos,
              reads their profile README, studies a shortlist of their code, and
              generates a skill you can install or download.
            </p>
          </div>

          <div className="relative w-full max-w-3xl">
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
                <p className="mt-4 text-sm text-zinc-700" role="status">
                  Pulling profile metadata, shortlisting repos, and generating the
                  skill guide with Azure OpenAI…
                </p>
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
          <div
            data-results
            className="grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
          >
            <div className="relative">
              <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-xl bg-zinc-900" />
              <section className="relative z-10 rounded-xl border-[3px] border-zinc-900 bg-[#fafafa] p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Generated skill
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-zinc-900">
                      @{output.login}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void copyCommand()}
                      className="rounded border-[3px] border-zinc-900 bg-[#ffc480] px-3 py-1.5 text-xs font-medium text-zinc-900"
                    >
                      {copied ? 'Copied!' : 'Copy install'}
                    </button>
                    <button
                      type="button"
                      onClick={downloadSkill}
                      className="rounded border-[3px] border-zinc-900 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900"
                    >
                      Download .md
                    </button>
                  </div>
                </div>

                <pre className="max-h-[min(70vh,40rem)] overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-800">
                  {output.skillMarkdown}
                </pre>
              </section>
            </div>

            <div className="relative h-fit">
              <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-xl bg-zinc-900" />
              <aside className="relative z-10 rounded-xl border-[3px] border-zinc-900 bg-[#fff4da] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Install command
                </p>
                <pre className="mt-3 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-800">
                  {output.installCommand}
                </pre>
                <div className="mt-4 space-y-3 text-sm text-zinc-700">
                  <p>
                    The backend uses authenticated GitHub GraphQL to read the
                    profile plus a shortlist of repos, then Azure OpenAI writes
                    the final style guide.
                  </p>
                  <p>
                    The generated skill tells the agent to clone the most relevant
                    repos into <code>/tmp</code> when studying this developer&apos;s
                    patterns would help on the current task.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  )
}
