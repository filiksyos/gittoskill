'use client';

import { Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    let errorMessage = 'Failed to generate skill';
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // If JSON parsing fails, use status text
      errorMessage = `Request failed with status ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }
  const data = await response.json();
  if (!data.skill) {
    throw new Error('No skill content received from server');
  }
  return data.skill;
};

function GenerateContent() {
  const params = useParams();
  const router = useRouter();
  const owner = params.owner as string;
  const repo = params.repo as string;
  const repoParam = owner && repo ? `${owner}/${repo}` : '';
  
  const { data: skill, error, isLoading } = useSWR(
    repoParam ? `/api/generate-skill?repo=${encodeURIComponent(repoParam)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const loading = isLoading;
  const errorMessage = error instanceof Error ? error.message : (error ? 'An error occurred' : '');

  const handleDownload = () => {
    if (!skill) return;

    const blob = new Blob([skill], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SKILL.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBack = () => {
    router.push('/');
  };

  if (!repoParam) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <main className="flex flex-col items-center gap-6 max-w-2xl px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
              Error
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-6" aria-live="polite">
              No repository specified
            </p>
            <button
              onClick={handleBack}
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Go Back
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <main className="flex flex-col items-center gap-4">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"
            aria-hidden="true"
          ></div>
          <p className="text-lg text-zinc-600 dark:text-zinc-400" aria-live="polite">
            Generating skill for <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">{repoParam}</code>…
          </p>
        </main>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <main className="flex flex-col items-center gap-6 max-w-2xl px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
              Error
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-6" aria-live="polite">
              {errorMessage}
            </p>
            <button
              onClick={handleBack}
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Go Back
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans dark:bg-black">
      <main className="max-w-4xl mx-auto py-6 px-4">
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-black dark:text-zinc-50 mb-1">
              Generated Skill
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
              <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">{repoParam}</code>
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={handleBack}
              className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Back
            </button>
            <button
              onClick={handleDownload}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap"
            >
              Download SKILL.md
            </button>
          </div>
        </div>

        <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <pre className="p-4 text-xs sm:text-sm font-mono text-black dark:text-zinc-50 whitespace-pre-wrap break-words overflow-hidden">
            <code>{skill}</code>
          </pre>
        </div>
      </main>
    </div>
  );
}

export default function RepoPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div 
          className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"
          aria-hidden="true"
        ></div>
      </div>
    }>
      <GenerateContent />
    </Suspense>
  );
}
