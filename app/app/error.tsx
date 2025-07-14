'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-red-500">
      <h1 className="text-3xl font-bold mb-4">Something went wrong!</h1>
      <p className="mb-4">{error.message}</p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-red-600 text-white rounded"
      >
        Try again
      </button>
    </div>
  );
} 