"use client";

import { useState } from "react";

interface AddRecipeFormProps {
  onAdd: (url: string) => Promise<void>;
  isLoading: boolean;
}

export function AddRecipeForm({ onAdd, isLoading }: AddRecipeFormProps) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Basic YouTube URL validation
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(url)) {
      setError("Please enter a valid YouTube URL");
      return;
    }

    try {
      await onAdd(url);
      setUrl("");
    } catch (err) {
      setError("Failed to save recipe. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube recipe link..."
          className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700 
                     bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100
                     focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent
                     placeholder:text-zinc-400"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !url}
          className="px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-medium
                     rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Saving..." : "Save Recipe"}
        </button>
      </div>
      {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
    </form>
  );
}
