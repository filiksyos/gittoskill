import { NextRequest, NextResponse } from 'next/server'
import {
  buildSkillMarkdown,
  listCandidateRootPaths,
  mergeReferenceFiles,
  skillDirectoryName,
  type SkillOutput,
} from '@/lib/generate-skill'
import { getFileTree, getReadme, getRepoMeta, readFile } from '@/lib/github-client'
import { parseGitHubRepoInput } from '@/lib/parse-github-repo'

export async function POST(request: NextRequest) {
  let body: { repoUrl?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const repoUrl = body.repoUrl
  if (typeof repoUrl !== 'string') {
    return NextResponse.json(
      { error: 'repoUrl is required (string)' },
      { status: 400 }
    )
  }

  const parsed = parseGitHubRepoInput(repoUrl)
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          'Could not parse a GitHub repo. Use a URL like https://github.com/owner/repo or owner/repo.',
      },
      { status: 400 }
    )
  }

  const { owner, repo } = parsed

  let meta: Awaited<ReturnType<typeof getRepoMeta>>
  try {
    meta = await getRepoMeta(owner, repo)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message.toLowerCase().includes('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }

  const branch = meta.default_branch

  let tree: { tree: Array<{ path: string; type: string }>; truncated: boolean }
  let readme: string
  try {
    ;[tree, readme] = await Promise.all([
      getFileTree(owner, repo, branch),
      getReadme(owner, repo, branch),
    ])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message.toLowerCase().includes('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }

  const candidates = listCandidateRootPaths(tree.tree)
  const rootFiles: Array<{ path: string; content: string }> = []

  for (const path of candidates) {
    if (rootFiles.length >= 9) break
    try {
      const content = await readFile(owner, repo, path, branch)
      rootFiles.push({ path, content })
    } catch {
      // Skip files that cannot be read
    }
  }

  const skillMarkdown = buildSkillMarkdown({
    owner,
    repo,
    meta,
    readme,
    treeTruncated: tree.truncated,
  })

  const references = mergeReferenceFiles({ readme, rootFiles })

  const output: SkillOutput = {
    skillDirectoryName: skillDirectoryName(owner, repo),
    skillMarkdown,
    references,
    treeTruncated: tree.truncated,
  }

  return NextResponse.json(output, { status: 200 })
}
