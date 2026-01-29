'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [repo, setRepo] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate format: owner/repo
    const repoPattern = /^[\w.-]+\/[\w.-]+$/;
    if (!repoPattern.test(repo.trim())) {
      setError('Please enter a valid GitHub repository in the format: owner/repo');
      return;
    }

    // Navigate to generate page
    router.push(`/generate?repo=${encodeURIComponent(repo.trim())}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black">
        <div className="flex flex-col items-center gap-8 text-center w-full">
          <h1 className="text-4xl font-bold leading-tight text-black dark:text-zinc-50">
            GitHub to Skill Converter
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Convert any GitHub repository into a Cursor skill. Simply enter the repository in the format <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">owner/repo</code>
          </p>
          
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="e.g., facebook/react"
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              />
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
            </div>
            <button
              type="submit"
              className="w-full px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Generate Skill
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
