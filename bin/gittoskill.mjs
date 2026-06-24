#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { access, mkdtemp, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const DEFAULT_API_BASE_URL = 'https://gittoskill.vercel.app'

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

  const profileInput = args[1]
  if (!profileInput || profileInput === '--help' || profileInput === '-h') {
    printHelp()
    return
  }

  const parsed = parseGitHubProfileInput(profileInput)
  if (!parsed) {
    exitWithError(
      'Could not parse a GitHub profile. Use @username or https://github.com/username.'
    )
  }

  const forwardedArgs = args.slice(2)
  const cacheRoot = path.join(os.homedir(), '.gittoskill', 'generated')
  const finalSkillDir = path.join(
    cacheRoot,
    slugSkillSegment(`${parsed.login}-coding-skill`) || 'coding-skill'
  )
  const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'gittoskill-'))
  const stagingDir = path.join(
    stagingRoot,
    slugSkillSegment(`${parsed.login}-coding-skill`) || 'coding-skill'
  )

  await mkdir(cacheRoot, { recursive: true })
  await mkdir(stagingDir, { recursive: true })

  try {
    logStep(`Generating skill for @${parsed.login}`)
    const output = await fetchGeneratedSkill(parsed.login)
    await writeGeneratedSkillBundle(stagingDir, output)

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
    await ensureInstalledSkillIgnored({ slug: output.skillDirectoryName })

    logStep(`Done. Re-run this command anytime to refresh @${parsed.login}.`)
  } finally {
    await rm(stagingRoot, { recursive: true, force: true })
  }
}

function printHelp() {
  console.log(`GitToSkill

Usage:
  gittoskill add <@username|github-profile-url> [...skills-add-flags]

Examples:
  gittoskill add @steipete
  gittoskill add https://github.com/steipete --agent cursor --scope project

What it does:
  1. Calls the GitToSkill backend to generate a profile skill
  2. Writes the returned SKILL.md + references locally
  3. Invokes the skills CLI on that local folder, forwarding the remaining flags
`)
}

function parseGitHubProfileInput(raw) {
  const input = raw.trim()
  if (!input) return null

  const normalizedAt = input.startsWith('@') ? input.slice(1) : input

  try {
    const url =
      normalizedAt.includes('://') || normalizedAt.startsWith('github.com')
        ? new URL(normalizedAt.startsWith('http') ? normalizedAt : `https://${normalizedAt}`)
        : null

    if (url && url.hostname.replace(/^www\./, '') === 'github.com') {
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length !== 1) return null
      return { login: parts[0].replace(/^@+/, '') }
    }
  } catch {
    // Fall through to plain username parsing.
  }

  if (
    normalizedAt &&
    !normalizedAt.includes('/') &&
    !normalizedAt.includes(' ') &&
    /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(normalizedAt)
  ) {
    return { login: normalizedAt }
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

async function fetchGeneratedSkill(login) {
  const apiBaseUrl = (process.env.GITTOSKILL_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL).replace(/\/+$/, '')
  const response = await fetch(`${apiBaseUrl}/api/generate-skill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile: `@${login}` }),
  }).catch((error) => {
    throw new Error(
      `Could not reach GitToSkill API at ${apiBaseUrl}. ${error instanceof Error ? error.message : String(error)}`
    )
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.error || `GitToSkill API failed with status ${response.status}.`)
  }

  if (
    !payload ||
    typeof payload.skillMarkdown !== 'string' ||
    !Array.isArray(payload.references) ||
    typeof payload.skillDirectoryName !== 'string'
  ) {
    throw new Error('GitToSkill API returned an invalid payload.')
  }

  return payload
}

async function writeGeneratedSkillBundle(targetDir, output) {
  await mkdir(targetDir, { recursive: true })
  await writeFile(path.join(targetDir, 'SKILL.md'), output.skillMarkdown, 'utf8')

  for (const reference of output.references) {
    if (
      !reference ||
      typeof reference.path !== 'string' ||
      typeof reference.content !== 'string'
    ) {
      continue
    }

    const outputPath = path.join(targetDir, reference.path.replace(/\//g, path.sep))
    await mkdir(path.dirname(outputPath), { recursive: true })
    await writeFile(outputPath, reference.content, 'utf8')
  }
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
