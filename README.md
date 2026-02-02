# GitHub to Skill Converter

A simple Next.js application that converts GitHub repositories into Agent skills. Enter a repository in the format `owner/repo` and get a generated Agent skill file.

## Features

- Simple hero page with input form
- Automatic fetching of repository file tree and README
- Skill generation using OpenRouter API
- Download generated skill as SKILL.md file

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
cp .env.local.example .env.local
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

1. Enter a GitHub repository in the format `owner/repo` (e.g., `facebook/react`)
2. Click "Generate Skill"
3. Wait for the skill to be generated
4. Review the generated skill
5. Download as SKILL.md if needed

## How It Works

1. **GitHub API**: Fetches the repository's file tree (root level) and README.md
2. **OpenRouter API**: Sends the repository information to OpenRouter with a system prompt
3. **Skill Generation**: Generates an Agent skill following SKILL.md format
4. **Display**: Shows the generated skill with download option

## Project Structure

```
gittoskill/
├── app/
│   ├── page.tsx              # Hero page with input form
│   ├── generate/
│   │   └── page.tsx          # Page to display generated skill
│   ├── api/
│   │   └── generate-skill/
│   │       └── route.ts      # API route that generates skills
│   └── layout.tsx
├── .env.local.example        # Example environment variables
└── README.md
```

## API Endpoints

### GET /api/generate-skill?repo=owner/repo

Generates an Agent skill from a GitHub repository.

**Query Parameters:**
- `repo` (required): GitHub repository in format `owner/repo`

**Response:**
```json
{
  "skill": "Generated SKILL.md content"
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
