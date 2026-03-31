'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import JSZip from 'jszip'
import { parseGitHubRepoInput } from '@/lib/parse-github-repo'

const EXAMPLES = [
  { label: 'Next.js', url: 'https://github.com/vercel/next.js' },
  { label: 'Shadcn', url: 'https://github.com/shadcn-ui/ui' },
  { label: 'React', url: 'https://github.com/facebook/react' },
  { label: 'Supabase', url: 'https://github.com/supabase/supabase' },
] as const

type SkillReferenceFile = { path: string; content: string }

type GenerateSkillResponse = {
  skillDirectoryName?: string
  skillMarkdown?: string
  references?: SkillReferenceFile[]
  treeTruncated?: boolean
  error?: string
}

type GittoskillHomeProps = {
  initialRepoInput?: string
  autoSubmit?: boolean
}

type TabId = 'skill' | 'references'

export function GittoskillHome({
  initialRepoInput = '',
  autoSubmit = false,
}: GittoskillHomeProps) {
  const [repoUrl, setRepoUrl] = useState(initialRepoInput)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [skillMarkdown, setSkillMarkdown] = useState('')
  const [skillDirectoryName, setSkillDirectoryName] = useState('')
  const [references, setReferences] = useState<SkillReferenceFile[]>([])
  const [treeTruncated, setTreeTruncated] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('skill')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const resultsRef = useRef<HTMLDivElement | null>(null)
  const autoSubmitStartedRef = useRef(false)

  const runGenerateSkill = useCallback(async (input: string) => {
    setError(null)
    setSkillMarkdown('')
    setSkillDirectoryName('')
    setReferences([])
    setTreeTruncated(false)
    setActiveTab('skill')
    setCopiedKey(null)
    setLoading(true)
    try {
      const res = await fetch('/api/generate-skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: input }),
      })
      const data = (await res.json()) as GenerateSkillResponse
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`)
        return
      }
      if (typeof data.skillMarkdown === 'string') {
        setSkillMarkdown(data.skillMarkdown)
        setSkillDirectoryName(data.skillDirectoryName ?? '')
        setReferences(Array.isArray(data.references) ? data.references : [])
        setTreeTruncated(Boolean(data.treeTruncated))
        const parsed = parseGitHubRepoInput(input)
        if (parsed && typeof window !== 'undefined') {
          window.history.replaceState(
            null,
            '',
            `/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}`
          )
        }
      } else {
        setError('No skill output in response.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }, [])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    void runGenerateSkill(repoUrl.trim())
  }

  useEffect(() => {
    if (!autoSubmit || autoSubmitStartedRef.current) return
    const trimmed = initialRepoInput?.trim() ?? ''
    if (!trimmed || !parseGitHubRepoInput(trimmed)) return
    autoSubmitStartedRef.current = true
    void runGenerateSkill(trimmed)
  }, [autoSubmit, initialRepoInput, runGenerateSkill])

  useEffect(() => {
    if (!skillMarkdown) return
    const id = requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
    return () => cancelAnimationFrame(id)
  }, [skillMarkdown])

  async function copyFile(path: string, content: string) {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedKey(path)
      window.setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  async function downloadZip() {
    if (!skillDirectoryName || !skillMarkdown) return
    try {
      const zip = new JSZip()
      const root = zip.folder(skillDirectoryName)
      if (!root) return
      root.file('SKILL.md', skillMarkdown)
      for (const file of references) {
        const rel = file.path.replace(/^references\//, '')
        root.file(`references/${rel}`, file.content)
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${skillDirectoryName}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      setError('Could not build ZIP download.')
    }
  }

  const hasResults = Boolean(skillMarkdown)

  return (
    <div id="main-content" className="min-h-screen bg-[#FFFDF8] text-zinc-900">
      <nav className="sticky top-0 z-50 border-b-[3px] border-zinc-900 bg-[#FFFDF8]">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-zinc-900">Git</span>
            <span className="text-[#d31611]">ToSkill</span>
          </span>
          <span className="text-sm text-zinc-600">GitHub → Cursor skill</span>
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
              <span className="whitespace-nowrap">owner/repo</span>. Builds{' '}
              <code className="text-zinc-800">SKILL.md</code> and{' '}
              <code className="text-zinc-800">references/</code> from the GitHub
              API only — no external model calls.
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
                  disabled={loading}
                  aria-busy={loading}
                  className={`relative z-10 rounded border-[3px] border-zinc-900 px-6 py-3 font-medium text-white transition-transform disabled:pointer-events-none sm:shrink-0 ${
                    loading ? 'bg-[#b5120e]' : 'bg-[#d31611]'
                  }`}
                >
                  {loading ? 'Fetching…' : 'Generate skill'}
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

        {hasResults ? (
          <div
            ref={resultsRef}
            data-results
            className="relative w-full max-w-2xl scroll-mt-24"
          >
            <div className="absolute inset-0 translate-x-2 translate-y-2 rounded-xl bg-zinc-900" />
            <section className="relative z-10 rounded-xl border-[3px] border-zinc-900 bg-[#fafafa] p-6">
              {skillDirectoryName ? (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-zinc-600">
                    Install folder:{' '}
                    <code className="rounded bg-zinc-200 px-1 py-0.5 text-zinc-800">
                      ~/.cursor/skills/{skillDirectoryName}/
                    </code>
                  </p>
                  <button
                    type="button"
                    onClick={() => void downloadZip()}
                    className="rounded border-[3px] border-zinc-900 bg-[#ffc480] px-3 py-1.5 text-xs font-medium text-zinc-900"
                  >
                    Download ZIP
                  </button>
                </div>
              ) : null}
              {treeTruncated ? (
                <p className="mb-3 text-xs text-amber-800">
                  GitHub returned a truncated tree; root file selection may be
                  incomplete.
                </p>
              ) : null}
              <div className="mb-4 flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('skill')}
                  className={`rounded border-[3px] border-zinc-900 px-3 py-1.5 text-sm font-medium ${
                    activeTab === 'skill'
                      ? 'bg-[#ffc480] text-zinc-900'
                      : 'bg-white text-zinc-700'
                  }`}
                >
                  SKILL.md
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('references')}
                  className={`rounded border-[3px] border-zinc-900 px-3 py-1.5 text-sm font-medium ${
                    activeTab === 'references'
                      ? 'bg-[#ffc480] text-zinc-900'
                      : 'bg-white text-zinc-700'
                  }`}
                >
                  references/ ({references.length})
                </button>
              </div>

              {activeTab === 'skill' ? (
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-zinc-700">
                      SKILL.md
                    </h2>
                    <button
                      type="button"
                      onClick={() => void copyFile('SKILL.md', skillMarkdown)}
                      className="rounded border-[3px] border-zinc-900 bg-[#ffc480] px-3 py-1.5 text-xs font-medium text-zinc-900"
                    >
                      {copiedKey === 'SKILL.md' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="max-h-[min(70vh,32rem)] overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-800">
                    {skillMarkdown}
                  </pre>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {references.map((file) => (
                    <div key={file.path}>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-mono text-xs font-semibold text-zinc-700">
                          {file.path}
                        </h3>
                        <button
                          type="button"
                          onClick={() => void copyFile(file.path, file.content)}
                          className="rounded border-[3px] border-zinc-900 bg-[#ffc480] px-3 py-1.5 text-xs font-medium text-zinc-900"
                        >
                          {copiedKey === file.path ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-800">
                        {file.content}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </main>
    </div>
  )
}
