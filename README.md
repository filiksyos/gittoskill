# Script Extractor Skill Creator

A Next.js application that converts GitHub repositories into script-oriented AI skills. Enter a repository and objective (for example, "extract dither generation"), and the app generates a skill package with runnable scripts, SKILL.md guidance, and source mapping.

## Features

- Simple hero page with input form
- Automatic fetching of repository tree and README
- Objective-driven script extraction using OpenRouter API
- Generates multi-file skill packages (\`SKILL.md\`, \`scripts/*\`, \`references/source-map.md\`)
- Download generated skill as ZIP

## Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (or npm/yarn)
- OpenRouter API key ([Get one here](https://openrouter.ai/))

### Installation

1. Clone the repository
2. Install dependencies:

```bash
pnpm install
```

3. Create `.env.local` file:

```bash
cp .env.example .env.local
```

4. Add your OpenRouter API key to `.env.local`:

```
OPENROUTER_API_KEY=your_openrouter_api_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

5. Run the development server:

```bash
pnpm dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Enter a GitHub repository URL or `owner/repo` (e.g., `https://github.com/vercel-labs/dither`)
2. Optionally describe the capability to extract (e.g., "create a skill that turns images into dither art")
3. Click "Extract Skill"
3. Wait for the skill to be generated
4. Review the generated skill package
5. Download as ZIP

## How It Works

1. **GitHub API**: Fetches repository tree and README for context
2. **OpenRouter API**: Explores the repo through tools and identifies relevant implementation files
3. **Script Extraction**: Produces runnable script resources and a SKILL.md usage guide
4. **Source Mapping**: Generates provenance notes linking source files to extracted scripts
5. **Display/Download**: Shows SKILL.md preview and allows ZIP download

## Project Structure

```
gittoskill/
├── app/
│   ├── page.tsx              # Hero page with input form
│   ├── [owner]/[repo]/
│   │   └── page.tsx          # Page to display generated skill package
│   ├── api/
│   │   └── generate-skill/
│   │       └── route.ts      # API route that generates skills
│   └── layout.tsx
├── .env.example              # Example environment variables
└── README.md
```

## API Endpoints

### POST /api/generate-skill

Generates an Agent skill from a GitHub repository.

**Request Body:**
- `owner` (required): GitHub owner/org
- `repo` (required): GitHub repository name
- `prompt` (optional): extraction objective

**Response:**
```json
{
  "files": [
    { "path": "SKILL.md", "content": "..." },
    { "path": "scripts/extract_feature.py", "content": "..." },
    { "path": "references/source-map.md", "content": "..." }
  ]
}
```

## Environment Variables

- `OPENROUTER_API_KEY`: Your OpenRouter API key (required)
- `NEXT_PUBLIC_APP_URL`: Your app URL (optional, defaults to localhost:3000)

## Technologies Used

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- GitHub REST API
- OpenRouter API

## License

MIT
