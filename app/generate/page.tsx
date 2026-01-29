'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

function GenerateContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const repo = searchParams.get('repo') || '';
  
  const [skill, setSkill] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!repo) {
      setError('No repository specified');
      setLoading(false);
      return;
    }

    const fetchSkill = async () => {
      try {
        setLoading(true);
        setError('');
        
        const response = await fetch(`/api/generate-skill?repo=${encodeURIComponent(repo)}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to generate skill');
        }

        const data = await response.json();
        setSkill(data.skill);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchSkill();
  }, [repo]);

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <main className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Generating skill for <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">{repo}</code>...
          </p>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <main className="flex flex-col items-center gap-6 max-w-2xl px-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
              Error
            </h1>
            <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-6">
              {error}
            </p>
            <button
              onClick={handleBack}
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
            >
              Go Back
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-zinc-50 mb-2">
              Generated Skill
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Repository: <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">{repo}</code>
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-black dark:text-zinc-50 transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
            >
              Download SKILL.md
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <pre className="p-6 overflow-x-auto text-sm font-mono text-black dark:text-zinc-50">
            <code>{skill}</code>
          </pre>
        </div>
      </main>
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <GenerateContent />
    </Suspense>
  );
}
