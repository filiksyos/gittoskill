import { notFound } from 'next/navigation'
import { GittoskillHome } from '@/components/gittoskill-home'
import {
  isValidGitHubRepoPath,
  normalizeRepoSegment,
} from '@/lib/parse-github-repo'

type PageProps = {
  params: Promise<{ owner: string; repo: string }>
}

export default async function RepoPage({ params }: PageProps) {
  const { owner: ownerRaw, repo: repoRaw } = await params
  const owner = decodeURIComponent(ownerRaw)
  const repo = decodeURIComponent(repoRaw)

  if (!isValidGitHubRepoPath(owner, repo)) {
    notFound()
  }

  const repoNorm = normalizeRepoSegment(repo)
  const initialRepoInput = `${owner}/${repoNorm}`

  return <GittoskillHome initialRepoInput={initialRepoInput} autoSubmit />
}
