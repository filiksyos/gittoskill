#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
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

    const skillMarkdown = await buildSkillMarkdown({
      repoDir: stagingDir,
      owner: parsed.owner,
      repo: parsed.repo,
      sourceUrl: cloneUrl.replace(/\.git$/i, ''),
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
  2. Generates a root SKILL.md inside the cloned snapshot
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

async function buildSkillMarkdown({ repoDir, owner, repo, sourceUrl }) {
  const entries = await readdir(repoDir, { withFileTypes: true })
  const visibleEntries = entries
    .map((entry) => entry.name)
    .filter((name) => name !== 'SKILL.md' && name !== '.git')
    .sort((left, right) => left.localeCompare(right))

  const directories = visibleEntries.filter((name) =>
    entries.some((entry) => entry.name === name && entry.isDirectory())
  )
  const files = visibleEntries.filter((name) =>
    entries.some((entry) => entry.name === name && entry.isFile())
  )

  const readmeName =
    visibleEntries.find((name) => README_NAMES.has(name.toLowerCase())) ?? null
  const readmeText = readmeName
    ? await readTextIfExists(path.join(repoDir, readmeName))
    : null
  const packageJsonText = await readTextIfExists(path.join(repoDir, 'package.json'))

  const projectSummary = summarizeProject({ owner, repo, readmeText, packageJsonText })
  const description = buildDescription({ owner, repo, projectSummary })
  const startHere = buildStartHere({ readmeName, directories, files })

  return [
    '---',
    `name: ${slugSkillSegment(`${owner}-${repo}`) || 'skill'}`,
    `description: "${escapeForYaml(description)}"`,
    '---',
    '',
    `# ${owner}/${repo}`,
    '',
    `This skill is a locally generated snapshot of [\`${owner}/${repo}\`](${sourceUrl}). GitToSkill cloned the repository, removed its Git metadata, added this \`SKILL.md\`, and then handed installation off to the \`skills\` CLI.`,
    '',
    'Use the files in this folder directly. The original repository contents stay in place so you can inspect source code, docs, configs, and examples without switching context.',
    '',
    '## Project Summary',
    '',
    projectSummary,
    '',
    '## Start Here',
    '',
    ...startHere.map((line) => `- ${line}`),
    '',
    '## Refreshing',
    '',
    `- Re-run \`npx gittoskill add ${owner}/${repo}\` whenever you want a fresh snapshot.`,
    '- Any additional flags are forwarded to `skills add`, so agent selection, scope, and install mode behave the same as the upstream `skills` CLI.',
    '',
  ].join('\n')
}

function summarizeProject({ owner, repo, readmeText, packageJsonText }) {
  const packageDescription = readPackageDescription(packageJsonText)
  if (packageDescription) {
    return packageDescription
  }

  const readmeSummary = readmeText ? extractFirstParagraph(readmeText) : ''
  if (readmeSummary) {
    return readmeSummary
  }

  return `Snapshot of ${owner}/${repo}. Use this skill when you want the upstream repository's files available locally as an installable skill.`
}

function readPackageDescription(packageJsonText) {
  if (!packageJsonText) return ''
  try {
    const parsed = JSON.parse(packageJsonText)
    return typeof parsed.description === 'string' ? parsed.description.trim() : ''
  } catch {
    return ''
  }
}

function extractFirstParagraph(readmeText) {
  const paragraphs = readmeText
    .replace(/\r/g, '')
    .split('\n\n')
    .map((chunk) => chunk.trim())
    .filter(Boolean)

  for (const paragraph of paragraphs) {
    if (paragraph.startsWith('#')) continue
    if (paragraph.startsWith('```')) continue
    const collapsed = paragraph.replace(/\s+/g, ' ').trim()
    if (collapsed) {
      return collapsed
    }
  }

  return ''
}

function buildDescription({ owner, repo, projectSummary }) {
  const base = projectSummary || `Installed snapshot of ${owner}/${repo}.`
  const suffix = ` Repository ${owner}/${repo}, cloned locally and installed via the skills CLI.`
  const combined = `${base}${base.endsWith('.') ? '' : '.'}${suffix}`
  return combined.slice(0, 1024)
}

function buildStartHere({ readmeName, directories, files }) {
  const lines = []

  if (readmeName) {
    lines.push(`Read \`${readmeName}\` first for the upstream project's overview and setup details.`)
  }

  if (directories.length > 0) {
    lines.push(
      `Explore top-level directories such as ${directories
        .slice(0, 6)
        .map((name) => `\`${name}/\``)
        .join(', ')}${directories.length > 6 ? ', and more.' : '.'}`
    )
  }

  const notableFiles = files.filter((name) => name !== readmeName).slice(0, 6)
  if (notableFiles.length > 0) {
    lines.push(
      `Review root files like ${notableFiles
        .map((name) => `\`${name}\``)
        .join(', ')}${files.length > 6 ? ', and other config files.' : '.'}`
    )
  }

  lines.push('Search the repository directly when you need implementation details; this generated skill does not strip or summarize the source tree.')
  return lines
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
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.inheritOutput ? 'inherit' : 'pipe',
      shell: false,
    })

    let stderr = ''

    if (!options.inheritOutput) {
      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk)
      })
    }

    child.on('error', (error) => reject(error))
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
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
