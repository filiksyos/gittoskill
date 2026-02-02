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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main id="main-content" className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-8 text-center w-full">
          <h1 className="text-4xl font-bold leading-tight text-black dark:text-zinc-50 text-balance">
            GitHub to Skill Converter
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Convert any GitHub repository into a Cursor skill. Simply enter the repository in the format <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">owner/repo</code>
          </p>
          
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
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
                placeholder="e.g., https://github.com/facebook/react or facebook/react"
                autoComplete="off"
                spellCheck={false}
                aria-describedby={error ? "repo-error" : undefined}
                aria-invalid={error ? "true" : "false"}
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              {error && (
                <p 
                  id="repo-error"
                  className="text-sm text-red-600 dark:text-red-400" 
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
              className="w-full px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" aria-hidden="true"></span>
                  Generating…
                </span>
              ) : (
                'Generate Skill'
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
