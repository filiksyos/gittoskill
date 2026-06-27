# GitToSkill

https://github.com/user-attachments/assets/2db46a17-4162-4002-bddd-0f21d69716a9

GitToSkill turns a GitHub profile into an installable Cursor skill.

Give it a profile like `@steipete`, and it will:

1. Fetch the profile, profile README, and a notable repo shortlist through GitHub GraphQL.
2. Pull a second batch of repo details to capture style signals from real projects.
3. Use Azure OpenAI to write a profile-specific skill guide.
4. Let you either download the generated markdown skill or install it through the CLI.

## Core flow

Web:

- Paste a GitHub profile like `@steipete` or `https://github.com/steipete`
- Review the generated skill
- Copy the install command or download the `.md` file

CLI:

```bash
npx gittoskill add @steipete
```

The CLI calls the GitToSkill backend, writes the returned `SKILL.md` plus reference files into a local generated folder, and then forwards installation to `skills add`.

## Environment

The generator expects:

- `GITHUB_TOKEN`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_BASE_URL`
- `AZURE_OPENAI_DEPLOYMENT_NAME_MAP`

Optional Azure tuning:

- `AZURE_OPENAI_MODEL`
- `AZURE_OPENAI_REASONING_EFFORT`

For local CLI usage against a local dev server, set:

- `GITTOSKILL_API_BASE_URL=http://localhost:3000`

Otherwise the CLI defaults to the production GitToSkill deployment URL.

## Local development

### Prerequisites

- Node.js 18+
- `pnpm`

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
$env:GITTOSKILL_API_BASE_URL="http://localhost:3000"
pnpm cli:add -- @steipete
```

You can forward normal `skills add` flags after the profile input:

```bash
pnpm cli:add -- @steipete --agent cursor --scope project
```

## Project structure

```text
gittoskill/
├── app/                    # Next.js website + profile skill API
├── bin/gittoskill.mjs      # CLI wrapper around backend generation + skills add
├── components/             # Web UI
├── lib/                    # GitHub, Azure, parsing, and skill generation helpers
└── README.md
```

## License

MIT
