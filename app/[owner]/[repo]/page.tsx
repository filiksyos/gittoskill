import { notFound } from 'next/navigation'
type PageProps = {
  params: Promise<{ owner: string; repo: string }>
}

export default async function RepoPage({ params }: PageProps) {
  await params
  notFound()
}
