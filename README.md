# GitToSkill

GitToSkill is a CLI-first project for turning any public GitHub repository into a locally installable skill. The web app only generates the install command; the CLI does the real work.

## How it works

`gittoskill add <repo>` does four things:

1. Clones the target repository locally with `git clone --depth 1`
2. Fetches the repository description from the public GitHub API
3. Moves the cloned repository contents into `references/` and generates a root `SKILL.md`
4. Invokes `skills add <local-path>` so agent selection, scope, and install mode behave the same as the upstream `skills` CLI

The generated skill keeps `SKILL.md` at the root as the wrapper/context file. The upstream repository contents are stored under `references/`, and the cloned `.git` directory is removed before handing the folder to `skills`.

## Web app

The Next.js app is intentionally simple. It accepts a GitHub repository URL or `owner/repo` and returns the exact command:

```bash
npx gittoskill add owner/repo
```

That means there is no preview-generation backend and no ZIP export. The CLI makes a small unauthenticated GitHub API request to pull the repository description, but the packaging work still happens locally on the user's machine.

## Local development

### Prerequisites

- Node.js 18+
- `pnpm`
- `git`

### Install

```bash
pnpm install
```

### Run the web app

```bash
pnpm dev
```

### Run the CLI locally

```bash
pnpm cli:add -- vercel/next.js
```

You can forward normal `skills add` flags after the repository input:

```bash
pnpm cli:add -- vercel/next.js --agent cursor --scope project
```

## Project structure

```text
gittoskill/
├── app/                    # Next.js website that outputs the install command
├── bin/gittoskill.mjs      # CLI wrapper around git clone + skills add
├── components/             # Web UI
├── lib/                    # Shared parsing helpers for the web app
└── README.md
```

## Cross-platform support

The target platforms for v1 are Windows, macOS, and Linux. The implementation stays cross-platform by relying on:

- Node.js standard library for filesystem/process work
- `git` for cloning
- `skills` for the final installation flow

## License

MIT
