"use client";

import { use, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CookingPot, ChatCircle, ArrowsClockwise, CaretDown } from "@phosphor-icons/react";

function CollapsibleSection({
  title,
  children,
  defaultOpen = false
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="candy-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between text-left"
      >
        <h3 className="font-display text-lg font-bold" style={{ color: 'var(--ink)' }}>
          {title}
        </h3>
        <CaretDown
          size={18}
          weight="bold"
          className="transition-transform duration-200"
          style={{
            color: 'var(--muted)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 border-t-2" style={{ borderColor: 'var(--ink)' }}>
          <div className="pt-4">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const recipe = useQuery(api.recipes.get, { id: id as Id<"recipes"> });
  const deleteRecipe = useMutation(api.recipes.remove);
  const triggerExtraction = useMutation(api.recipes.triggerAIExtraction);

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this recipe?")) {
      await deleteRecipe({ id: id as Id<"recipes"> });
      router.push("/");
    }
  };

  const handleRetryExtraction = async () => {
    await triggerExtraction({ recipeId: id as Id<"recipes"> });
  };

  if (recipe === undefined) {
    return (
      <div className="text-center py-20 font-display text-xl font-bold" style={{ color: 'var(--muted)' }}>
        Loading recipe...
      </div>
    );
  }

  if (recipe === null) {
    return (
      <div className="text-center py-20">
        <p className="font-display text-2xl font-bold mb-4" style={{ color: 'var(--ink)' }}>
          Recipe not found
        </p>
        <Link href="/" className="link-underline font-semibold" style={{ color: 'var(--berry)' }}>
          ← Back to the box
        </Link>
      </div>
    );
  }

  const hasAIRecipe = recipe.aiRecipe &&
    (recipe.aiRecipe.ingredients.length > 0 || recipe.aiRecipe.instructions.length > 0);
  const isExtracting = recipe.aiRecipeStatus === "pending" || recipe.aiRecipeStatus === "processing";

  // Use clean title if available, fallback to original
  const displayTitle = recipe.aiRecipe?.cleanTitle || recipe.aiRecipe?.title || recipe.title || "Untitled Recipe";

  return (
    <main>
      {/* Back Link */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 mb-8 font-bold text-sm link-underline"
        style={{ color: 'var(--muted)' }}
      >
        ← Back to the box
      </Link>

      {/* Recipe Header */}
      <header className="mb-6">
        <h1 className="font-display text-4xl md:text-5xl font-black leading-tight mb-3" style={{ color: 'var(--ink)' }}>
          {displayTitle}
        </h1>
        {recipe.channelName && (
          <p className="font-semibold" style={{ color: 'var(--muted)' }}>
            by{" "}
            {recipe.channelUrl ? (
              <a
                href={recipe.channelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="link-underline"
                style={{ color: 'var(--berry)' }}
              >
                {recipe.channelName}
              </a>
            ) : (
              <span style={{ color: 'var(--berry)' }}>{recipe.channelName}</span>
            )}
          </p>
        )}
      </header>

      {/* Action buttons */}
      {hasAIRecipe && (
        <section className="mb-10 flex flex-wrap gap-3">
          <Link
            href={`/recipe/${id}/cook`}
            className="btn-candy flex items-center gap-2 px-6 py-3 text-white"
            style={{ background: 'var(--berry)' }}
          >
            <CookingPot size={22} weight="bold" />
            Cook
          </Link>
          <Link
            href={`/recipe/${id}/cook?chat=true`}
            className="btn-candy flex items-center gap-2 px-6 py-3"
            style={{ background: 'var(--card)', color: 'var(--ink)' }}
          >
            <ChatCircle size={22} weight="bold" />
            Chat
          </Link>
          <button
            onClick={handleRetryExtraction}
            disabled={isExtracting}
            className="btn-candy flex items-center gap-2 px-6 py-3"
            style={{ background: 'var(--butter)', color: 'var(--ink)' }}
            title="Run the AI extraction again"
          >
            <ArrowsClockwise size={22} weight="bold" className={isExtracting ? "animate-spin" : ""} />
            {isExtracting ? "Re-running…" : "Re-run AI"}
          </button>
        </section>
      )}

      {/* Video Embed — Shorts are vertical, so use a 9:16 frame for them */}
      <section className="mb-12">
        {recipe.isShort ? (
          <div className="candy-card overflow-hidden bg-black max-w-[300px] mx-auto">
            <div className="relative aspect-[9/16]">
              <iframe
                src={`https://www.youtube.com/embed/${recipe.videoId}`}
                title={recipe.title || "Recipe video"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </div>
        ) : (
          <div className="candy-card overflow-hidden bg-black">
            <div className="video-container">
              <iframe
                src={`https://www.youtube.com/embed/${recipe.videoId}`}
                title={recipe.title || "Recipe video"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        )}
      </section>

      {/* AI Recipe Section - Primary Content */}
      <section className="mb-12">
        {isExtracting && (
          <div className="candy-card border-dashed p-8 text-center mb-6" style={{ background: 'var(--pistachio-soft)' }}>
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-t-transparent mb-4" style={{ borderColor: 'var(--pistachio)', borderTopColor: 'transparent' }} />
            <p className="font-display text-lg font-bold" style={{ color: 'var(--ink)' }}>
              Extracting recipe with AI...
            </p>
            <p className="text-sm font-semibold mt-2" style={{ color: 'var(--muted)' }}>
              Analyzing transcript, description, and comments
            </p>
          </div>
        )}

        {recipe.aiRecipeStatus === "failed" && (
          <div className="candy-card p-8 text-center" style={{ background: 'var(--berry-soft)' }}>
            <p className="font-display text-lg font-bold mb-2" style={{ color: 'var(--ink)' }}>
              Couldn&apos;t extract recipe automatically
            </p>
            <p className="text-sm font-semibold mb-4" style={{ color: 'var(--muted)' }}>
              {recipe.aiRecipeError || "The video may not contain a clear recipe"}
            </p>
            <button
              onClick={handleRetryExtraction}
              className="btn-candy px-5 py-2.5 text-white"
              style={{ background: 'var(--berry)' }}
            >
              Try Again
            </button>
          </div>
        )}

        {hasAIRecipe && recipe.aiRecipe && (
          <div className="candy-card p-6 sm:p-8">
            {/* Recipe Meta */}
            {(recipe.aiRecipe.prepTime || recipe.aiRecipe.cookTime || recipe.aiRecipe.servings) && (
              <div className="flex flex-wrap gap-2 mb-6">
                {recipe.aiRecipe.prepTime && (
                  <span className="chip" style={{ background: 'var(--berry-soft)' }}>
                    prep · {recipe.aiRecipe.prepTime}
                  </span>
                )}
                {recipe.aiRecipe.cookTime && (
                  <span className="chip" style={{ background: 'var(--butter)' }}>
                    cook · {recipe.aiRecipe.cookTime}
                  </span>
                )}
                {recipe.aiRecipe.servings && (
                  <span className="chip" style={{ background: 'var(--pistachio-soft)' }}>
                    serves · {recipe.aiRecipe.servings}
                  </span>
                )}
              </div>
            )}

            {recipe.aiRecipe.description && (
              <p className="mb-6 italic" style={{ color: 'var(--muted)' }}>
                {recipe.aiRecipe.description}
              </p>
            )}

            {/* Ingredients */}
            {recipe.aiRecipe.ingredients.length > 0 && (
              <div className="mb-8">
                <h2 className="font-display text-2xl font-black mb-4" style={{ color: 'var(--ink)' }}>
                  Ingredients
                </h2>
                <ul className="space-y-2.5">
                  {recipe.aiRecipe.ingredients.map((ingredient, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 border-2" style={{ background: 'var(--pistachio)', borderColor: 'var(--ink)' }} />
                      <span style={{ color: 'var(--ink)' }}>{ingredient}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Instructions */}
            {recipe.aiRecipe.instructions.length > 0 && (
              <div>
                <h2 className="font-display text-2xl font-black mb-4" style={{ color: 'var(--ink)' }}>
                  Instructions
                </h2>
                <ol className="space-y-4">
                  {recipe.aiRecipe.instructions.map((step, i) => (
                    <li key={i} className="flex items-start gap-4">
                      <span
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-white leading-none border-2"
                        style={{ background: 'var(--berry)', borderColor: 'var(--ink)' }}
                      >
                        <span className="-mt-0.5">{i + 1}</span>
                      </span>
                      <p className="pt-1.5" style={{ color: 'var(--ink)' }}>{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* What the AI actually worked from, so it's obvious when the
                transcript couldn't be fetched */}
            <div className="mt-8 pt-4 border-t-2 border-dashed flex flex-wrap items-center justify-between gap-2" style={{ borderColor: 'var(--muted)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                {recipe.extractionSources?.length
                  ? `Extracted from: ${recipe.extractionSources.join(" · ")}`
                  : "Extracted before source tracking was added"}
                {recipe.extractionSources?.length && !recipe.extractionSources.includes("transcript") ? (
                  <span style={{ color: 'var(--berry-deep)' }}> — no transcript was available</span>
                ) : null}
              </p>
            </div>
          </div>
        )}

        {!recipe.aiRecipeStatus && !hasAIRecipe && (
          <div className="candy-card p-8 text-center">
            <p className="font-display text-lg font-bold mb-4" style={{ color: 'var(--ink)' }}>
              No AI recipe extracted yet
            </p>
            <button
              onClick={handleRetryExtraction}
              className="btn-candy px-5 py-2.5 text-white"
              style={{ background: 'var(--pistachio)' }}
            >
              Extract Recipe with AI
            </button>
          </div>
        )}
      </section>

      {/* Original Content - Collapsible */}
      {(recipe.description || recipe.ownerComment) && (
        <section className="mb-12 space-y-4">
          <h2 className="font-display text-sm font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--muted)' }}>
            Original Video Content
          </h2>

          {recipe.description && (
            <CollapsibleSection title="Video Description" defaultOpen={false}>
              <p className="whitespace-pre-wrap leading-relaxed text-sm" style={{ color: 'var(--ink)' }}>
                {recipe.description}
              </p>
            </CollapsibleSection>
          )}

          {recipe.ownerComment && (
            <CollapsibleSection title="Pinned Comment" defaultOpen={false}>
              <p className="whitespace-pre-wrap leading-relaxed text-sm" style={{ color: 'var(--ink)' }}>
                {recipe.ownerComment}
              </p>
            </CollapsibleSection>
          )}
        </section>
      )}

      {/* Original Link */}
      <section className="mb-12">
        <a
          href={recipe.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-candy inline-flex items-center gap-3 px-6 py-3"
          style={{ background: 'var(--card)', color: 'var(--ink)' }}
        >
          ▶ Watch on YouTube
        </a>
      </section>

      {/* Divider */}
      <div className="divider-wave my-12" />

      {/* Actions */}
      <section className="flex justify-between items-center">
        <p className="text-sm font-semibold" style={{ color: 'var(--muted)' }}>
          Saved {new Date(recipe._creationTime).toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: '2-digit'
          })}
        </p>
        <button
          onClick={handleDelete}
          className="text-sm font-semibold underline decoration-2 underline-offset-2 hover:no-underline transition-all"
          style={{ color: 'var(--berry-deep)' }}
        >
          Delete from the box
        </button>
      </section>
    </main>
  );
}
