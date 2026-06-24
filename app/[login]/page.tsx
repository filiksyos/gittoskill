import { notFound } from 'next/navigation'
import { GittoskillHome } from '@/components/gittoskill-home'
import { isValidGitHubProfileLogin } from '@/lib/parse-github-profile'

type PageProps = {
  params: Promise<{ login: string }>
}

export default async function ProfilePage({ params }: PageProps) {
  const { login: loginRaw } = await params
  const login = decodeURIComponent(loginRaw)

  if (!isValidGitHubProfileLogin(login)) {
    notFound()
  }

  return <GittoskillHome initialProfileInput={`@${login}`} />
}
