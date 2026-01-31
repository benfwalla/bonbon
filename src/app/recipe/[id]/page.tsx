"use client";

import { use } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const recipe = useQuery(api.recipes.get, { id: id as Id<"recipes"> });
  const deleteRecipe = useMutation(api.recipes.remove);

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this recipe?")) {
      await deleteRecipe({ id: id as Id<"recipes"> });
      router.push("/");
    }
  };

  if (recipe === undefined) {
    return (
      <div className="text-center py-20 font-display text-xl italic" style={{ color: 'var(--ink-light)' }}>
        Loading recipe...
      </div>
    );
  }

  if (recipe === null) {
    return (
      <div className="text-center py-20">
        <p className="font-display text-2xl mb-4" style={{ color: 'var(--ink)' }}>
          Recipe not found
        </p>
        <Link href="/" className="link-underline" style={{ color: 'var(--terracotta)' }}>
          ← Back to collection
        </Link>
      </div>
    );
  }

  return (
    <main>
      {/* Back Link */}
      <Link 
        href="/" 
        className="inline-flex items-center gap-2 mb-8 font-display text-lg link-underline"
        style={{ color: 'var(--ink-light)' }}
      >
        ← Back to collection
      </Link>

      {/* Recipe Header */}
      <header className="mb-10">
        <h1 className="font-display text-3xl md:text-5xl font-bold leading-tight mb-4" style={{ color: 'var(--ink)' }}>
          {recipe.title || "Untitled Recipe"}
        </h1>
        {recipe.channelName && (
          <p className="text-xl italic" style={{ color: 'var(--ink-light)' }}>
            by{" "}
            <a 
              href={`https://youtube.com/@${recipe.channelName.replace(/\s+/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline"
              style={{ color: 'var(--terracotta)' }}
            >
              {recipe.channelName}
            </a>
          </p>
        )}
      </header>

      {/* Video Embed */}
      <section className="mb-12">
        <div className="border-recipe bg-black">
          <div className="video-container">
            <iframe
              src={`https://www.youtube.com/embed/${recipe.videoId}`}
              title={recipe.title || "Recipe video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      {/* Description */}
      <section className="mb-12">
        <h2 className="font-display text-2xl font-semibold mb-4" style={{ color: 'var(--ink)' }}>
          Description
        </h2>
        <div className="bg-white/50 border-recipe p-6">
          {recipe.description ? (
            <p className="whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--ink)' }}>
              {recipe.description}
            </p>
          ) : (
            <p className="italic" style={{ color: 'var(--ink-light)' }}>
              No description available yet.
              <br /><br />
              <span className="text-sm">
                To enable automatic description fetching, add a <code className="px-2 py-1 bg-[var(--cream-dark)]">YOUTUBE_API_KEY</code> environment variable.
              </span>
            </p>
          )}
        </div>
      </section>

      {/* Original Link */}
      <section className="mb-12">
        <a 
          href={recipe.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 px-6 py-3 font-display font-semibold text-white transition-all hover:translate-y-[-2px]"
          style={{ background: 'var(--terracotta)' }}
        >
          Watch on YouTube ↗
        </a>
      </section>

      {/* Divider */}
      <div className="h-px my-12" style={{ background: 'var(--ink-light)' }} />

      {/* Actions */}
      <section className="flex justify-between items-center">
        <p className="text-sm" style={{ color: 'var(--ink-light)' }}>
          Saved on {new Date(recipe._creationTime).toLocaleDateString('en-US', { 
            weekday: 'long',
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
        <button
          onClick={handleDelete}
          className="text-sm underline decoration-1 underline-offset-2 hover:no-underline transition-all"
          style={{ color: 'var(--ink-light)' }}
        >
          Delete from collection
        </button>
      </section>
    </main>
  );
}
