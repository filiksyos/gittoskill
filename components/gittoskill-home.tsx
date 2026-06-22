'use client'

import { useState } from 'react'
import { parseGitHubRepoInput } from '@/lib/parse-github-repo'

const EXAMPLES = [
  { label: 'Next.js', url: 'https://github.com/vercel/next.js' },
  { label: 'Shadcn', url: 'https://github.com/shadcn-ui/ui' },
  { label: 'React', url: 'https://github.com/facebook/react' },
  { label: 'Supabase', url: 'https://github.com/supabase/supabase' },
] as const

type GittoskillHomeProps = {
  initialRepoInput?: string
}

export function GittoskillHome({ initialRepoInput = '' }: GittoskillHomeProps) {
  const [repoUrl, setRepoUrl] = useState(initialRepoInput)
  const [copied, setCopied] = useState(false)
  const parsed = parseGitHubRepoInput(repoUrl)
  const normalizedRepo = parsed ? `${parsed.owner}/${parsed.repo}` : ''
  const command = parsed ? `npx gittoskill add ${normalizedRepo}` : ''
  const error =
    repoUrl.trim().length > 0 && !parsed
      ? 'Enter a GitHub URL like https://github.com/owner/repo or owner/repo.'
      : null

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!parsed || typeof window === 'undefined') return
    window.history.replaceState(
      null,
      '',
      `/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`
    )
  }

  async function copyCommand() {
    if (!command) return
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div id="main-content" className="min-h-screen bg-[#FFFDF8] text-zinc-900">
      <nav className="sticky top-0 z-50 border-b-[3px] border-zinc-900 bg-[#FFFDF8]">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-zinc-900">Git</span>
            <span className="text-[#d31611]">ToSkill</span>
          </span>
          <span className="text-sm text-zinc-600">GitHub → installable skill</span>
        </div>
      </nav>

      <main className="mx-auto flex max-w-4xl flex-col items-center gap-12 px-4 py-12 sm:px-6">
        <div className="flex w-full flex-col items-center gap-6">
          <div className="flex w-full flex-col items-center text-center">
            <h1 className="text-5xl font-extrabold tracking-tighter sm:text-6xl">
              Repository to skill
            </h1>
            <p className="mt-4 max-w-xl text-lg text-zinc-600">
              Paste a public GitHub repo URL or{' '}
              <span className="whitespace-nowrap">owner/repo</span>. GitToSkill
              returns the exact command to clone the repo locally, generate a
              root <code className="text-zinc-800">SKILL.md</code>, and install
              it through <code className="text-zinc-800">skills add</code>.
            </p>
          </div>

          <div className="relative w-full max-w-2xl">
            <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-xl bg-zinc-900" />
            <form
              onSubmit={onSubmit}
              className="relative z-10 rounded-xl border-[3px] border-zinc-900 bg-[#fff4da] p-6"
            >
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <div className="absolute inset-0 translate-x-1 translate-y-1 rounded bg-zinc-900" />
                  <input
                    name="repoUrl"
                    autoComplete="off"
                    className="relative z-10 w-full rounded border-[3px] border-zinc-900 bg-white px-4 py-3 text-base text-zinc-900 placeholder-zinc-500 focus:outline-none"
                    placeholder="https://github.com/… or owner/repo"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="relative z-10 rounded border-[3px] border-zinc-900 bg-[#d31611] px-6 py-3 font-medium text-white transition-transform sm:shrink-0"
                >
                  Get command
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="w-full text-sm text-zinc-600">
                  Example repos:
                </span>
                {EXAMPLES.map(({ label, url }) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setRepoUrl(url)}
                    className="rounded border-[3px] border-zinc-900 bg-[#EBDBB7] px-3 py-1 text-sm font-medium hover:bg-[#ffc480]"
                  >
                    {label}
                  </button>
                ))}
              </div>

              {error ? (
                <p className="mt-3 text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}
            </form>
          </div>
        </div>

        {command ? (
          <div data-results className="relative w-full max-w-2xl scroll-mt-24">
            <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-xl bg-zinc-900" />
            <section className="relative z-10 rounded-xl border-[3px] border-zinc-900 bg-[#fafafa] p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                    Install command
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-zinc-900">
                    {normalizedRepo}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => void copyCommand()}
                  className="rounded border-[3px] border-zinc-900 bg-[#ffc480] px-3 py-1.5 text-xs font-medium text-zinc-900"
                >
                  {copied ? 'Copied!' : 'Copy command'}
                </button>
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-800">
                {command}
              </pre>
              <div className="mt-4 space-y-2 text-sm text-zinc-700">
                <p>
                  GitToSkill does not call the GitHub REST API. The CLI clones
                  the repository locally, writes a generated{' '}
                  <code>SKILL.md</code> into the cloned snapshot, and then
                  forwards installation to <code>skills add</code>.
                </p>
                <p>
                  Append any normal <code>skills add</code> flags after the repo
                  input, for example <code>{command} --agent cursor</code>.
                </p>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  )
}
