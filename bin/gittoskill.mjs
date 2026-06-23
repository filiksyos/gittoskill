#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { access, mkdtemp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const README_NAMES = new Set([
  'readme',
  'readme.md',
  'readme.mdx',
  'readme.txt',
])

async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  if (command !== 'add') {
    exitWithError(`Unknown command "${command}".`)
  }

  const repoInput = args[1]
  if (!repoInput || repoInput === '--help' || repoInput === '-h') {
    printHelp()
    return
  }

  const parsed = parseGitHubRepoInput(repoInput)
  if (!parsed) {
    exitWithError(
      'Could not parse a GitHub repository. Use a URL like https://github.com/owner/repo or owner/repo.'
    )
  }

  const forwardedArgs = args.slice(2)
  const cloneUrl = `https://github.com/${parsed.owner}/${parsed.repo}.git`
  const slug = slugSkillSegment(`${parsed.owner}-${parsed.repo}`) || 'skill'

  const cacheRoot = path.join(os.homedir(), '.gittoskill', 'generated')
  const finalSkillDir = path.join(cacheRoot, slug)
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'gittoskill-'))
  const stagingDir = path.join(stagingRoot, slug)

  await mkdir(cacheRoot, { recursive: true })

  try {
    logStep(`Cloning ${cloneUrl}`)
    await runCommand('git', ['clone', '--depth', '1', cloneUrl, stagingDir])

    await rm(path.join(stagingDir, '.git'), { recursive: true, force: true })
    const referencesDir = await moveRepoContentsToReferences(stagingDir)
    const repoDescription = await fetchGitHubRepoDescription({
      owner: parsed.owner,
      repo: parsed.repo,
    })

    const skillMarkdown = await buildSkillMarkdown({
      referencesDir,
      owner: parsed.owner,
      repo: parsed.repo,
      repoDescription,
    })

    await writeFile(path.join(stagingDir, 'SKILL.md'), skillMarkdown, 'utf8')

    const backupDir = `${finalSkillDir}.bak`
    await rm(backupDir, { recursive: true, force: true })
    try {
      await rename(finalSkillDir, backupDir)
    } catch {
      // Ignore if no existing generated snapshot exists yet.
    }
    await rename(stagingDir, finalSkillDir)
    await rm(backupDir, { recursive: true, force: true })

    logStep(`Installing generated skill from ${finalSkillDir}`)
    const skillsCliPath = require.resolve('skills/bin/cli.mjs')
    await runCommand(process.execPath, [skillsCliPath, 'add', finalSkillDir, ...forwardedArgs], {
      inheritOutput: true,
    })
    await ensureInstalledSkillIgnored({ slug })

    logStep(`Done. Re-run this command anytime to refresh ${parsed.owner}/${parsed.repo}.`)
  } finally {
    await rm(stagingRoot, { recursive: true, force: true })
  }
}

function printHelp() {
  console.log(`GitToSkill

Usage:
  gittoskill add <owner/repo|github-url> [...skills-add-flags]

Examples:
  gittoskill add vercel/next.js
  gittoskill add https://github.com/vercel/next.js --agent cursor --scope project

What it does:
  1. Clones the target GitHub repo locally
  2. Moves the cloned repo into references/ and generates a root SKILL.md wrapper
  3. Invokes the skills CLI on that local folder, forwarding the remaining flags
`)
}

function parseGitHubRepoInput(raw) {
  const input = raw.trim()
  if (!input) return null

  const withoutGit = (value) => value.replace(/\.git$/i, '')

  try {
    const url =
      input.includes('://') || input.startsWith('github.com')
        ? new URL(input.startsWith('http') ? input : `https://${input}`)
        : null

    if (url && url.hostname.replace(/^www\./, '') === 'github.com') {
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length < 2) return null
      return { owner: parts[0], repo: withoutGit(parts[1]) }
    }
  } catch {
    // Fall through to owner/repo parsing.
  }

  const parts = input.split('/').filter(Boolean)
  if (parts.length === 2 && !input.includes(' ')) {
    return { owner: parts[0], repo: withoutGit(parts[1]) }
  }

  return null
}

function slugSkillSegment(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}

async function buildSkillMarkdown({ referencesDir, owner, repo, repoDescription }) {
  const entries = await readdir(referencesDir, { withFileTypes: true })
  const visibleEntries = entries.map((entry) => entry.name).sort((left, right) => left.localeCompare(right))
  const readmeName =
    visibleEntries.find((name) => README_NAMES.has(name.toLowerCase())) ?? null
  const readmeText = readmeName
    ? await readTextIfExists(path.join(referencesDir, readmeName))
    : null
  const description = buildDescription({ repoDescription })
  const readmeBody = buildReadmeBody({ owner, repo, readmeText })

  return [
    '---',
    `name: ${slugSkillSegment(`${owner}-${repo}`) || 'skill'}`,
    `description: "${escapeForYaml(description)}"`,
    '---',
    '',
    '(This is the README.md of the repository repackaged into SKILL.md to give context about the codebase.)',
    '',
    'The repository code is available under `/references` in this installed skill.',
    '',
    readmeBody,
    '',
    '## Refresh',
    '',
    `- Re-run \`npx gittoskill add ${owner}/${repo}\` whenever you want a fresh snapshot.`,
    '- Any additional flags are forwarded to `skills add`, so agent selection, scope, and install mode behave the same as the upstream `skills` CLI.',
    '',
  ].join('\n')
}

function buildReadmeBody({ owner, repo, readmeText }) {
  const normalizedReadme = normalizeMarkdown(readmeText)
  if (normalizedReadme) {
    return normalizedReadme
  }

  return [`# ${owner}/${repo}`, '', 'README.md was not available in the upstream repository.'].join('\n')
}

function normalizeMarkdown(text) {
  if (!text) return ''
  return text.replace(/\r/g, '').trim()
}

function buildDescription({ repoDescription }) {
  const base = repoDescription || 'Description not available.'
  const suffix =
    " (This is a github repo that's repackaged as a skill so it can be used as a reference for inspiration)"
  const combined = `${base}${base.endsWith('.') ? '' : '.'}${suffix}`
  return combined.slice(0, 1024)
}

async function fetchGitHubRepoDescription({ owner, repo }) {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'gittoskill/0.1.0',
    },
  }).catch(() => null)

  if (!response?.ok) {
    return ''
  }

  const payload = await response.json().catch(() => null)
  return typeof payload?.description === 'string' ? payload.description.trim() : ''
}

async function moveRepoContentsToReferences(skillDir) {
  const entries = await readdir(skillDir, { withFileTypes: true })
  const referencesDir = path.join(skillDir, 'references')
  await mkdir(referencesDir, { recursive: true })

  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'references' || entry.name === 'SKILL.md') {
      continue
    }

    await rename(path.join(skillDir, entry.name), path.join(referencesDir, entry.name))
  }

  return referencesDir
}

async function ensureInstalledSkillIgnored({ slug }) {
  const gitRoot = await getGitRoot()
  if (!gitRoot) {
    return
  }

  const candidates = [
    `/.agents/skills/${slug}/`,
    `/.cursor/skills/${slug}`,
    `/skills/${slug}/`,
  ]

  const existingCandidates = []
  for (const candidate of candidates) {
    const candidatePath = path.join(gitRoot, candidate.replace(/^\/+/, '').replace(/\//g, path.sep))
    if (await pathExists(candidatePath)) {
      existingCandidates.push(candidate)
    }
  }

  if (existingCandidates.length === 0) {
    return
  }

  const gitignorePath = path.join(gitRoot, '.gitignore')
  const currentText = (await readTextIfExists(gitignorePath)) ?? ''
  const normalizedLines = currentText.replace(/\r/g, '').split('\n')
  const additions = existingCandidates.filter((entry) => !normalizedLines.includes(entry))

  if (additions.length === 0) {
    return
  }

  const prefix = currentText.length === 0 ? '' : currentText.endsWith('\n') ? '' : '\n'
  const comment = normalizedLines.includes('# Installed skills') ? '' : '# Installed skills\n'
  await writeFile(gitignorePath, `${currentText}${prefix}${comment}${additions.join('\n')}\n`, 'utf8')
}

async function getGitRoot() {
  const result = await runCommandCapture('git', ['rev-parse', '--show-toplevel']).catch(() => null)
  return result?.stdout.trim() || ''
}

async function pathExists(targetPath) {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

function escapeForYaml(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')
}

async function readTextIfExists(targetPath) {
  try {
    return await readFile(targetPath, 'utf8')
  } catch {
    return null
  }
}

function logStep(message) {
  console.log(`[gittoskill] ${message}`)
}

async function runCommand(command, args, options = {}) {
  await runCommandCapture(command, args, options)
}

async function runCommandCapture(command, args, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.inheritOutput ? 'inherit' : 'pipe',
      shell: false,
    })

    let stdout = ''
    let stderr = ''

    if (!options.inheritOutput) {
      child.stdout?.on('data', (chunk) => {
        stdout += String(chunk)
      })
      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk)
      })
    }

    child.on('error', (error) => reject(error))
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      reject(
        new Error(
          stderr.trim() || `${command} ${args.join(' ')} exited with code ${String(code)}.`
        )
      )
    })
  })
}

function exitWithError(message) {
  console.error(`[gittoskill] ${message}`)
  process.exit(1)
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  exitWithError(message)
})
