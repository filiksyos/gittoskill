'use client';

import { Suspense, useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import JSZip from 'jszip';
import useSWR from 'swr';

type GeneratedSkillResponse = {
  files: Array<{ path: string; content: string }>;
};

const generateSkillFetcher = async (
  [, owner, repo, prompt, provider, apiKey]: readonly [string, string, string, string, string?, string?]
): Promise<GeneratedSkillResponse> => {
  const body: Record<string, string> = { owner, repo, prompt };
  if (provider) body.provider = provider;
  if (apiKey) body.apiKey = apiKey;
  const response = await fetch('/api/generate-skill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Keep payload null and handle fallback message below.
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'error' in payload &&
      typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : response.statusText || 'Request failed';
    throw new Error(message);
  }

  const files =
    payload &&
    typeof payload === 'object' &&
    'files' in payload &&
    Array.isArray((payload as { files?: unknown }).files)
      ? ((payload as { files: Array<{ path: string; content: string }> }).files ?? [])
      : [];

  return { files };
};

function GenerateContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const owner = params.owner as string;
  const repo = params.repo as string;
  const prompt = searchParams.get('prompt') ?? '';
  const [byok, setByok] = useState<{ provider?: string; apiKey?: string } | null>(null);
  useEffect(() => {
    setByok({
      provider: sessionStorage.getItem('byok-provider') ?? undefined,
      apiKey: sessionStorage.getItem('byok-api-key') ?? undefined,
    });
  }, []);
  const repoParam = owner && repo ? `${owner}/${repo}` : '';
  const swrKey =
    repoParam && byok !== null
      ? (['generate-skill', owner, repo, prompt, byok.provider ?? '', byok.apiKey ?? ''] as const)
      : null;
  const { data, error, isLoading } = useSWR<GeneratedSkillResponse, Error>(
    swrKey,
    generateSkillFetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );
  const files = data?.files ?? null;
  const errorMessage = error?.message ?? '';

  const handleDownload = () => {
    if (!files || files.length !== 1 || files[0].path !== 'SKILL.md') return;
    const blob = new Blob([files[0].content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SKILL.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadZip = async () => {
    if (!files || files.length === 0) return;
    const skillMd = files.find((f) => f.path === 'SKILL.md');
    const match = skillMd?.content.match(/^name:\s*(.+)$/m);
    const skillName = match?.[1]?.trim() ?? 'skill';

    const zip = new JSZip();
    const folder = zip.folder(skillName)!;
    for (const file of files) {
      folder.file(file.path, file.content);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${skillName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBack = () => {
    if (repoParam) {
      router.push(`/?repo=${owner}/${repo}&prompt=${encodeURIComponent(prompt)}`);
    } else {
      router.push('/');
    }
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

  if (byok === null || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <main className="flex flex-col items-center gap-4">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"
            aria-hidden="true"
          ></div>
          <p className="text-lg text-zinc-600 dark:text-zinc-400" aria-live="polite">
            Analyzing <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">{repoParam}</code> and extracting scripts for your skill…
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-500 mt-2">
            This takes 2–4 minutes. Don&apos;t refresh—you&apos;ll start over.
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

  const isSingleFile =
    files && files.length === 1 && files[0].path === 'SKILL.md';
  const skillMd = files?.find((f) => f.path === 'SKILL.md');
  const previewContent = skillMd?.content ?? '';

  return (
    <div className="min-h-screen bg-white font-sans dark:bg-black">
      <main className="max-w-4xl mx-auto py-6 px-4">
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-black dark:text-zinc-50 mb-1">
              Generated Script Skill
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
            {isSingleFile ? (
              <button
                onClick={handleDownload}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap"
              >
                Download SKILL.md
              </button>
            ) : (
              <button
                onClick={handleDownloadZip}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap"
              >
                Download Skill ZIP
              </button>
            )}
          </div>
        </div>

        {!isSingleFile && files && (
          <div className="mb-4">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
              Files in this skill package
            </h2>
            <div className="flex flex-col gap-1">
              {files.map((file) => (
                <div key={file.path} className="flex items-center gap-2 text-sm">
                  <span aria-hidden>📄</span>
                  <code className="font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                    {file.path}
                  </code>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <pre className="p-4 text-xs sm:text-sm font-mono text-black dark:text-zinc-50 whitespace-pre-wrap break-words overflow-hidden">
            <code>{previewContent}</code>
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
