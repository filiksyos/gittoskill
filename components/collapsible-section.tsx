'use client'

import type { ReactNode } from 'react'

type CollapsibleSectionProps = {
  id: string
  title: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
  isFirst?: boolean
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

export function CollapsibleSection({
  id,
  title,
  isOpen,
  onToggle,
  children,
  isFirst = false,
}: CollapsibleSectionProps) {
  const panelId = `${id}-panel`

  return (
    <div
      className={`border-[3px] border-zinc-900 bg-white ${isFirst ? 'rounded-t-xl' : 'border-t-0'} last:rounded-b-xl`}
    >
      <button
        type="button"
        id={`${id}-trigger`}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-[#faf5ff] sm:px-5"
      >
        <span className="text-base font-bold tracking-tight text-zinc-900">
          {title}
        </span>
        <ChevronIcon isOpen={isOpen} />
      </button>

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
