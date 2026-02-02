'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';

function extractOwnerRepo(input: string): { owner: string; repo: string } | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // Match GitHub URLs: https://github.com/owner/repo, https://www.github.com/owner/repo, github.com/owner/repo
  // Also handles URLs with trailing slashes or paths
  const urlPattern = /(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)(?:\/.*)?$/i;
  const urlMatch = trimmed.match(urlPattern);
  
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2].replace(/\.git$/, ''), // Remove .git suffix if present
    };
  }

  // Match owner/repo format
  const repoPattern = /^([\w.-]+)\/([\w.-]+)$/;
  const repoMatch = trimmed.match(repoPattern);
  
  if (repoMatch) {
    return {
      owner: repoMatch[1],
      repo: repoMatch[2],
    };
  }

  return null;
}

export default function Home() {
  const [repo, setRepo] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Extract owner/repo from URL or owner/repo format
    const extracted = extractOwnerRepo(repo.trim());

    if (!extracted) {
      const errorMessage = 'Please enter a valid GitHub repository URL (e.g., https://github.com/owner/repo) or in the format: owner/repo';
      setError(errorMessage);
      // Focus the input field on error
      inputRef.current?.focus();
      return;
    }

    const { owner, repo: repoName } = extracted;

    // Navigate to dynamic route with transition
    startTransition(() => {
      router.push(`/${owner}/${repoName}`);
    });
  };

  return (
    <main id="main-content" className="flex min-h-screen flex-col items-center justify-center px-4 py-12 font-sans bg-white dark:bg-black">
      <div className="flex w-full max-w-lg flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-black dark:text-zinc-50 text-balance">
            GitHub to Skill
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Convert repositories to Cursor skills
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="repo-input" className="sr-only">
              GitHub Repository
            </label>
            <input
              id="repo-input"
              ref={inputRef}
              type="text"
              name="repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="owner/repo or github.com/owner/repo"
              autoComplete="off"
              spellCheck={false}
              aria-describedby={error ? "repo-error" : undefined}
              aria-invalid={error ? "true" : "false"}
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
            {error && (
              <p 
                id="repo-error"
                className="text-xs text-red-600 dark:text-red-400" 
                role="alert"
                aria-live="polite"
              >
                {error}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="w-full px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" aria-hidden="true"></span>
                Generating…
              </span>
            ) : (
              'Generate Skill'
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
