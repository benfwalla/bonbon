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
      <header className="mb-10 text-center sm:text-left">
        <h1
          className="font-display text-5xl md:text-6xl font-black tracking-tight"
          style={{ color: 'var(--ink)' }}
        >
          bonbon
          <span
            className="inline-block ml-2 w-4 h-4 rounded-full align-super"
            style={{ background: 'var(--berry)' }}
          />
        </h1>
        <p className="text-sm font-semibold mt-2" style={{ color: 'var(--muted)' }}>
          your sweet little recipe box
        </p>
      </header>

      {/* Add Recipe Form */}
      <section className="mb-12">
        <form onSubmit={handleSubmit} className="candy-card p-4 sm:p-5">
          <label className="block mb-3 text-sm font-bold" style={{ color: 'var(--ink)' }}>
            Paste a YouTube recipe link 🍬
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1 px-5 py-3 text-base rounded-full border-2 focus:outline-none transition-colors"
              style={{
                borderColor: 'var(--ink)',
                background: 'var(--bg)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--berry)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--ink)')}
              disabled={isAdding}
            />
            <button
              type="submit"
              disabled={isAdding || !url}
              className="btn-candy px-7 py-3 text-white whitespace-nowrap"
              style={{ background: 'var(--berry)' }}
            >
              {isAdding ? "Saving..." : "Save it"}
            </button>
          </div>
          {error && (
            <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--berry-deep)' }}>{error}</p>
          )}
        </form>
      </section>

      {/* Divider */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 divider-wave" />
        <span
          className="chip"
          style={{ background: 'var(--butter)', color: 'var(--ink)' }}
        >
          {recipes?.length ?? 0} {recipes?.length === 1 ? 'recipe' : 'recipes'}
        </span>
        <div className="flex-1 divider-wave" />
      </div>

      {/* Recipe Grid */}
      {recipes === undefined ? (
        <div className="text-center py-16 font-semibold" style={{ color: 'var(--muted)' }}>
          Loading...
        </div>
      ) : recipes.length === 0 ? (
        <div className="candy-card p-10 text-center">
          <p className="font-display text-2xl font-bold mb-2" style={{ color: 'var(--ink)' }}>
            The box is empty
          </p>
          <p className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>
            Paste a YouTube link above to start your collection
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:gap-6 sm:grid-cols-2">
          {recipes.map((recipe, idx) => (
            <Link
              key={recipe._id}
              href={`/recipe/${recipe._id}`}
              className={`candy-card candy-card--hover block overflow-hidden ${idx % 2 === 1 ? 'sm:rotate-[0.4deg]' : 'sm:rotate-[-0.4deg]'}`}
            >
              {recipe.thumbnail && (
                <div className="relative aspect-video overflow-hidden border-b-2" style={{ borderColor: 'var(--ink)' }}>
                  <Image
                    src={recipe.thumbnail}
                    alt={recipe.title || "Recipe thumbnail"}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="p-4">
                <h3 className="font-display text-lg font-bold leading-snug mb-1 line-clamp-2" style={{ color: 'var(--ink)' }}>
                  {recipe.aiRecipe?.cleanTitle || recipe.aiRecipe?.title || recipe.title || "Untitled Recipe"}
                </h3>
                {recipe.channelName && (
                  <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                    {recipe.channelName}
                  </p>
                )}
                {(recipe.aiRecipeStatus === "pending" || recipe.aiRecipeStatus === "processing") && (
                  <p className="text-xs font-bold mt-2" style={{ color: 'var(--pistachio)' }}>
                    ✨ extracting recipe…
                  </p>
                )}
                {recipe.aiRecipeStatus === "failed" && (
                  <p className="text-xs font-bold mt-2" style={{ color: 'var(--berry-deep)' }}>
                    extraction failed — tap to retry
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Footer */}
      <footer className="mt-16 pt-6 text-center">
        <div className="divider-wave mb-6" />
        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--muted)' }}>
          bonbon · season two
        </p>
      </footer>
    </main>
  );
}
