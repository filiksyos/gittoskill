import { notFound } from 'next/navigation'
import { GittoskillHome } from '@/components/gittoskill-home'
import { isValidGitHubProfileLogin } from '@/lib/parse-github-profile'

type PageProps = {
  params: Promise<{ owner: string }>
}

export default async function ProfilePage({ params }: PageProps) {
  const { owner: ownerRaw } = await params
  const owner = decodeURIComponent(ownerRaw)

  if (!isValidGitHubProfileLogin(owner)) {
    notFound()
  }

  return <GittoskillHome initialProfileInput={`@${owner}`} />
}
