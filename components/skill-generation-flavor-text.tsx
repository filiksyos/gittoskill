'use client'

import { useEffect, useState } from 'react'

const ELLIPSIS_MS = 450
const FLAVOR_MS = 2600

const FLAVOR_LINES = [
  'Viewing profile',
  'Looking through their work',
  'Picking the most telling repos',
  'Noticing how they like to build',
  'Putting together the skill',
  'Polishing the final guide',
] as const

const ELLIPSIS_FRAMES = ['', '.', '..', '...'] as const

export function SkillGenerationFlavorText() {
  const [flavorIndex, setFlavorIndex] = useState(0)
  const [ellipsisIndex, setEllipsisIndex] = useState(0)

  useEffect(() => {
    const ellipsisId = window.setInterval(() => {
      setEllipsisIndex((index) => (index + 1) % ELLIPSIS_FRAMES.length)
    }, ELLIPSIS_MS)

    const flavorId = window.setInterval(() => {
      setFlavorIndex((index) => (index + 1) % FLAVOR_LINES.length)
    }, FLAVOR_MS)

    return () => {
      window.clearInterval(ellipsisId)
      window.clearInterval(flavorId)
    }
  }, [])

  const line = FLAVOR_LINES[flavorIndex] ?? FLAVOR_LINES[0]
  const dots = ELLIPSIS_FRAMES[ellipsisIndex] ?? ''

  return (
    <p className="mt-4 min-h-[1.25rem] text-sm text-zinc-700" role="status" aria-live="polite">
      {line}
      <span className="inline-block min-w-[1.25em] font-mono tabular-nums text-zinc-500">
        {dots}
      </span>
    </p>
  )
}
