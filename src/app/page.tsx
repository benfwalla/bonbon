"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Link from "next/link";
import Image from "next/image";

export default function Home() {
  const recipes = useQuery(api.recipes.list);
  const addRecipe = useMutation(api.recipes.add);
  const [url, setUrl] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    if (!youtubeRegex.test(url)) {
      setError("Please enter a valid YouTube URL");
      return;
    }

    setIsAdding(true);
    try {
      await addRecipe({ url });
      setUrl("");
    } catch (err) {
      setError("Failed to save recipe. It might already exist.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <main>
      {/* Header */}
      <header className="text-center mb-16">
        <div className="inline-block mb-6">
          <span className="text-6xl">🍬</span>
        </div>
        <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight mb-4" style={{ color: 'var(--ink)' }}>
          bonbon
        </h1>
        <p className="text-xl italic" style={{ color: 'var(--ink-light)' }}>
          Your collection of sweet recipes
        </p>
      </header>

      {/* Add Recipe Form */}
      <section className="mb-20">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
          <label className="block mb-3 font-display text-lg" style={{ color: 'var(--ink-light)' }}>
            Paste a YouTube recipe link
          </label>
          <div className="flex gap-4">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 px-5 py-4 text-lg border-2 rounded-none bg-white/50 focus:outline-none focus:border-[var(--terracotta)] transition-colors"
              style={{ borderColor: 'var(--ink)' }}
              disabled={isAdding}
            />
            <button
              type="submit"
              disabled={isAdding || !url}
              className="px-8 py-4 font-display text-lg font-semibold text-white transition-all hover:translate-y-[-2px] disabled:opacity-50 disabled:hover:translate-y-0"
              style={{ background: 'var(--terracotta)' }}
            >
              {isAdding ? "Saving..." : "Save"}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-sm" style={{ color: 'var(--terracotta)' }}>{error}</p>
          )}
        </form>
      </section>

      {/* Divider */}
      <div className="flex items-center gap-6 mb-12">
        <div className="flex-1 h-px" style={{ background: 'var(--ink-light)' }} />
        <span className="font-display text-xl" style={{ color: 'var(--ink-light)' }}>
          {recipes?.length ?? 0} {recipes?.length === 1 ? 'Recipe' : 'Recipes'} Saved
        </span>
        <div className="flex-1 h-px" style={{ background: 'var(--ink-light)' }} />
      </div>

      {/* Recipe Grid */}
      {recipes === undefined ? (
        <div className="text-center py-20 font-display text-xl italic" style={{ color: 'var(--ink-light)' }}>
          Loading your collection...
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-display text-2xl mb-2" style={{ color: 'var(--ink-light)' }}>
            Your collection is empty
          </p>
          <p className="italic" style={{ color: 'var(--ink-light)' }}>
            Paste a YouTube link above to save your first recipe
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          {recipes.map((recipe) => (
            <Link
              key={recipe._id}
              href={`/recipe/${recipe._id}`}
              className="recipe-card block bg-white border-recipe p-4 group"
            >
              {recipe.thumbnail && (
                <div className="relative aspect-video mb-4 overflow-hidden">
                  <Image
                    src={recipe.thumbnail}
                    alt={recipe.title || "Recipe thumbnail"}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              )}
              <h3 className="font-display text-xl font-semibold leading-tight mb-2 line-clamp-2" style={{ color: 'var(--ink)' }}>
                {recipe.title || "Untitled Recipe"}
              </h3>
              {recipe.channelName && (
                <p className="text-sm italic" style={{ color: 'var(--ink-light)' }}>
                  by {recipe.channelName}
                </p>
              )}
              <p className="mt-4 text-xs tracking-wide uppercase" style={{ color: 'var(--terracotta)' }}>
                View Recipe →
              </p>
            </Link>
          ))}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-24 pt-8 border-t text-center" style={{ borderColor: 'var(--ink-light)' }}>
        <p className="text-sm" style={{ color: 'var(--ink-light)' }}>
          Made with 🦞 by OpenClaw
        </p>
      </footer>
    </main>
  );
}
