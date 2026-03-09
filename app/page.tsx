'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PROVIDER_CONFIG, type ProviderId } from '@/lib/llm-providers';

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
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<ProviderId>('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('byok-provider');
    if (stored === 'openrouter' || stored === 'google') setProvider(stored);
    const key = sessionStorage.getItem('byok-api-key');
    if (typeof key === 'string') setApiKey(key);
  }, []);

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

    sessionStorage.setItem('byok-provider', provider);
    if (apiKey.trim()) {
      sessionStorage.setItem('byok-api-key', apiKey.trim());
    } else {
      sessionStorage.removeItem('byok-api-key');
    }

    const params = new URLSearchParams();
    if (prompt.trim()) params.set('prompt', prompt.trim());
    if (provider !== 'openrouter') params.set('provider', provider);
    const query = params.toString();
    const url = query ? `/${owner}/${repoName}?${query}` : `/${owner}/${repoName}`;
    startTransition(() => {
      router.push(url);
    });
  };

  return (
    <main id="main-content" className="flex min-h-screen flex-col items-center justify-center px-4 py-12 font-sans bg-white dark:bg-black">
      <div className="flex w-full max-w-lg flex-col items-center gap-8 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-black dark:text-zinc-50 text-balance">
            Script Extractor Skill Creator
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Turn GitHub repos into AI skills with runnable scripts
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
              placeholder="https://github.com/owner/repo"
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
          <div className="flex flex-col gap-3 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50">
            <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Bring your own API key (BYOK)
            </h2>
            <div className="flex flex-col gap-2">
              <label htmlFor="provider-select" className="text-xs text-zinc-600 dark:text-zinc-400">
                Provider
              </label>
              <select
                id="provider-select"
                value={provider}
                onChange={(e) => setProvider(e.target.value as ProviderId)}
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              >
                {(['openrouter', 'google'] as const).map((id) => (
                  <option key={id} value={id}>
                    {PROVIDER_CONFIG[id].label}
                    {id === 'openrouter' && ' (Claude)'}
                    {id === 'google' && ' (Gemini 2.5 Pro)'}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="api-key-input" className="text-xs text-zinc-600 dark:text-zinc-400">
                API key <span className="text-zinc-400 dark:text-zinc-500">(optional)</span>
              </label>
              <input
                id="api-key-input"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  provider === 'openrouter'
                    ? 'Leave empty to use server OpenRouter key'
                    : 'Leave empty to use server Google AI key'
                }
                autoComplete="off"
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              <a
                href={PROVIDER_CONFIG[provider].getKeyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Get API key →
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="prompt-input" className="text-sm text-zinc-600 dark:text-zinc-400">
              What script capability should the skill extract? <span className="text-zinc-400 dark:text-zinc-500">(optional)</span>
            </label>
            <textarea
              id="prompt-input"
              name="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder={`e.g. "Create a skill that turns images into dither art"\n"Extract scripts for generating signed upload URLs"\n"Extract scripts for running the core audio pipeline"`}
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-y"
            />
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
              'Extract Skill'
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
