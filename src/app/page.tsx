"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const recipes = useQuery(api.recipes.list);
  const addRecipe = useMutation(api.recipes.add);
  const [url, setUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const youtubeRegex = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(url)) {
      setError("Please enter a valid YouTube URL");
      return;
    }

    setIsAdding(true);
    try {
      const result = await addRecipe({ url });
      setUrl("");
      if (result.alreadyExisted) {
        // Already saved — just take them to it
        router.push(`/recipe/${result.id}`);
      }
    } catch {
      setError("Couldn't save that link — make sure it's a YouTube video URL.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <main>
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight" style={{ color: 'var(--ink)' }}>
            bonbon
          </h1>
          <p className="text-sm italic mt-1" style={{ color: 'var(--ink-light)' }}>
            Your recipe collection
          </p>
        </div>
      </header>

      {/* Add Recipe Form */}
      <section className="mb-12">
        <form onSubmit={handleSubmit}>
          <label className="block mb-2 text-sm font-medium" style={{ color: 'var(--ink-light)' }}>
            Paste a YouTube recipe link
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 px-4 py-3 text-base border-2 rounded-none bg-white/50 focus:outline-none focus:border-[var(--terracotta)] transition-colors"
              style={{ borderColor: 'var(--ink)' }}
              disabled={isAdding}
            />
            <button
              type="submit"
              disabled={isAdding || !url}
              className="px-6 py-3 font-display font-semibold text-white transition-all hover:translate-y-[-2px] disabled:opacity-50 disabled:hover:translate-y-0 whitespace-nowrap"
              style={{ background: 'var(--terracotta)' }}
            >
              {isAdding ? "Saving..." : "Save Recipe"}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm" style={{ color: 'var(--terracotta)' }}>{error}</p>
          )}
        </form>
      </section>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 h-px" style={{ background: 'var(--ink-light)', opacity: 0.3 }} />
        <span className="text-sm font-medium" style={{ color: 'var(--ink-light)' }}>
          {recipes?.length ?? 0} {recipes?.length === 1 ? 'recipe' : 'recipes'}
        </span>
        <div className="flex-1 h-px" style={{ background: 'var(--ink-light)', opacity: 0.3 }} />
      </div>

      {/* Recipe Grid */}
      {recipes === undefined ? (
        <div className="text-center py-16 italic" style={{ color: 'var(--ink-light)' }}>
          Loading...
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-lg mb-1" style={{ color: 'var(--ink-light)' }}>
            No recipes yet
          </p>
          <p className="text-sm italic" style={{ color: 'var(--ink-light)' }}>
            Paste a YouTube link above to start
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
          {recipes.map((recipe) => (
            <Link
              key={recipe._id}
              href={`/recipe/${recipe._id}`}
              className="recipe-card block bg-white border border-[var(--ink)] p-3 sm:p-4 group"
            >
              {recipe.thumbnail && (
                <div className="relative aspect-video mb-3 overflow-hidden">
                  <Image
                    src={recipe.thumbnail}
                    alt={recipe.title || "Recipe thumbnail"}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              )}
              <h3 className="font-display text-base sm:text-lg font-semibold leading-snug mb-1 line-clamp-2" style={{ color: 'var(--ink)' }}>
                {recipe.aiRecipe?.cleanTitle || recipe.aiRecipe?.title || recipe.title || "Untitled Recipe"}
              </h3>
              {recipe.channelName && (
                <p className="text-xs sm:text-sm" style={{ color: 'var(--ink-light)' }}>
                  {recipe.channelName}
                </p>
              )}
              {(recipe.aiRecipeStatus === "pending" || recipe.aiRecipeStatus === "processing") && (
                <p className="text-xs italic mt-1" style={{ color: 'var(--sage)' }}>
                  extracting recipe…
                </p>
              )}
              {recipe.aiRecipeStatus === "failed" && (
                <p className="text-xs italic mt-1" style={{ color: 'var(--terracotta)' }}>
                  extraction failed — tap to retry
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-16 pt-6 border-t text-center" style={{ borderColor: 'var(--ink-light)', opacity: 0.3 }}>
        <p className="text-xs" style={{ color: 'var(--ink-light)' }}>
          bonbon
        </p>
      </footer>
    </main>
  );
}
