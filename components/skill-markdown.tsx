import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'

export const skillMarkdownComponents: Components = {
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
    <p className="mb-4 text-[15px] leading-7 text-zinc-700">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-5 list-disc space-y-2 pl-5 text-[15px] text-zinc-700 marker:text-[#7c3aed]">
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
      className="font-medium text-[#7c3aed] underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded-md bg-[#f3e8ff] px-1.5 py-0.5 font-mono text-[13px] text-zinc-900">
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
    <blockquote className="mb-5 rounded-r-lg border-l-4 border-[#7c3aed] bg-[#faf5ff] py-1 pl-4 text-zinc-600">
      {children}
    </blockquote>
  ),
}

type SkillMarkdownProps = {
  content: string
}

export function SkillMarkdown({ content }: SkillMarkdownProps) {
  return (
    <div className="max-w-none text-sm leading-relaxed">
      <ReactMarkdown components={skillMarkdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
