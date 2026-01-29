import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are a skill generator for Cursor. Generate a Cursor skill (SKILL.md format) from the provided GitHub repository.

Requirements:
- YAML frontmatter with name (lowercase, hyphens) and description (third person, specific, includes trigger terms)
- Markdown body with essential instructions only
- Keep under 500 lines
- Focus on what the repository does and how to use it as a skill
- Be concise - only include necessary information

Generate the complete SKILL.md content.`;

interface GitHubTreeItem {
  path: string;
  type: string;
  sha: string;
}

interface GitHubTreeResponse {
  tree: GitHubTreeItem[];
  truncated?: boolean;
}

interface GitHubContentResponse {
  content: string;
  encoding: string;
}

async function getFileTree(owner: string, repo: string, branch: string): Promise<string> {
  try {
    // Get branch SHA first
    const branchResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches/${branch}`,
      { headers: { 'Accept': 'application/vnd.github.v3+json' } }
    );

    if (!branchResponse.ok) {
      throw new Error(`Failed to fetch branch: ${branchResponse.statusText}`);
    }

    const branchData = await branchResponse.json();
    const treeSha = branchData.commit.commit.tree.sha;

    // Get the tree recursively
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
      { headers: { 'Accept': 'application/vnd.github.v3+json' } }
    );

    if (!treeResponse.ok) {
      throw new Error(`Failed to fetch tree: ${treeResponse.statusText}`);
    }

    const treeData: GitHubTreeResponse = await treeResponse.json();

    // Filter to root level only (depth 1)
    const rootItems = treeData.tree.filter(item => {
      const depth = item.path.split('/').length;
      return depth === 1;
    });

    // Format as simple directory structure
    const directories = rootItems
      .filter(item => item.type === 'tree')
      .map(item => item.path);
    const files = rootItems
      .filter(item => item.type === 'blob')
      .map(item => item.path);

    let structure = `${repo}/\n`;
    directories.forEach(dir => {
      structure += `├── ${dir}/\n`;
    });
    files.forEach((file, index) => {
      const isLast = index === files.length - 1 && directories.length === 0;
      structure += `${isLast ? '└──' : '├──'} ${file}\n`;
    });

    return structure;
  } catch (error) {
    throw new Error(`Failed to get file tree: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function getReadme(owner: string, repo: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/README.md`,
      { headers: { 'Accept': 'application/vnd.github.v3+json' } }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return 'No README.md found in repository.';
      }
      throw new Error(`Failed to fetch README: ${response.statusText}`);
    }

    const data: GitHubContentResponse = await response.json();
    
    if (data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    
    return data.content;
  } catch (error) {
    throw new Error(`Failed to get README: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function generateSkill(fileTree: string, readme: string): Promise<string> {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;

  if (!openRouterApiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  const userMessage = `Generate a Cursor skill for this repository:

File Tree:
\`\`\`
${fileTree}
\`\`\`

README:
\`\`\`
${readme}
\`\`\``;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4.1',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const skill = data.choices?.[0]?.message?.content;

    if (!skill) {
      throw new Error('No skill content in OpenRouter response');
    }

    return skill;
  } catch (error) {
    throw new Error(`Failed to generate skill: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const repoParam = searchParams.get('repo');

    if (!repoParam) {
      return NextResponse.json(
        { error: 'Missing repo parameter. Use ?repo=owner/repo' },
        { status: 400 }
      );
    }

    // Parse owner/repo
    const repoPattern = /^([\w.-]+)\/([\w.-]+)$/;
    const match = repoParam.match(repoPattern);

    if (!match) {
      return NextResponse.json(
        { error: 'Invalid repo format. Use owner/repo format' },
        { status: 400 }
      );
    }

    const [, owner, repo] = match;

    // Try main branch first, fallback to master
    let fileTree: string;
    let branch = 'main';
    
    try {
      fileTree = await getFileTree(owner, repo, branch);
    } catch (error) {
      // Try master branch if main fails
      branch = 'master';
      try {
        fileTree = await getFileTree(owner, repo, branch);
      } catch (masterError) {
        return NextResponse.json(
          { error: `Failed to fetch repository: ${error instanceof Error ? error.message : 'Unknown error'}` },
          { status: 404 }
        );
      }
    }

    // Get README
    const readme = await getReadme(owner, repo);

    // Generate skill
    const skill = await generateSkill(fileTree, readme);

    return NextResponse.json({ skill });
  } catch (error) {
    console.error('Error generating skill:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate skill' },
      { status: 500 }
    );
  }
}
