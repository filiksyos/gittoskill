'use client'

import { useState, type ReactNode } from 'react'

type CollapsibleSectionProps = {
  id: string
  title: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
  isFirst?: boolean
  rawContent?: string
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`h-4 w-4 shrink-0 text-[#7c3aed] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function CopySectionButton({
  title,
  rawContent,
}: {
  title: string
  rawContent: string
}) {
  const [copied, setCopied] = useState(false)

  async function copySection() {
    const text = `## ${title}\n\n${rawContent}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        void copySection()
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white p-2 text-zinc-700 transition-colors hover:bg-[#f3e8ff] hover:text-[#7c3aed]"
      aria-label={copied ? `Copied ${title}` : `Copy ${title}`}
      title={copied ? 'Copied' : 'Copy section'}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  )
}

export function CollapsibleSection({
  id,
  title,
  isOpen,
  onToggle,
  children,
  isFirst = false,
  rawContent,
}: CollapsibleSectionProps) {
  const panelId = `${id}-panel`

  return (
    <div
      className={`border-[3px] border-zinc-900 bg-white ${isFirst ? 'rounded-t-xl' : 'border-t-0'} last:rounded-b-xl`}
    >
      <div className="flex w-full items-center gap-2 px-4 py-4 sm:px-5">
        <button
          type="button"
          id={`${id}-trigger`}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left transition-colors hover:text-[#7c3aed]"
        >
          <span className="text-base font-bold tracking-tight text-zinc-900">
            {title}
          </span>
          {!rawContent ? <ChevronIcon isOpen={isOpen} /> : null}
        </button>

        {rawContent ? (
          <>
            <CopySectionButton title={title} rawContent={rawContent} />
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex shrink-0 items-center justify-center p-1 text-[#7c3aed] transition-colors hover:opacity-80"
              aria-label={`Toggle ${title}`}
            >
              <ChevronIcon isOpen={isOpen} />
            </button>
          </>
        ) : null}
      </div>

      <div
        id={panelId}
        role="region"
        aria-labelledby={`${id}-trigger`}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="border-t border-zinc-300 px-4 py-4 sm:px-5 sm:py-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
