"use client";

import { use, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CookingPot, ChatCircle } from "@phosphor-icons/react";

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
    <div className="border border-[var(--ink-light)] bg-white/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/20 transition-colors"
      >
        <h3 className="font-display text-lg font-medium" style={{ color: 'var(--ink)' }}>
          {title}
        </h3>
        <span 
          className="text-xs transition-transform duration-200"
          style={{ 
            color: 'var(--ink-light)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        >
          ▼
        </span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 border-t border-[var(--ink-light)]">
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

  const hasAIRecipe = recipe.aiRecipe && 
    (recipe.aiRecipe.ingredients.length > 0 || recipe.aiRecipe.instructions.length > 0);
  
  // Use clean title if available, fallback to original
  const displayTitle = recipe.aiRecipe?.cleanTitle || recipe.aiRecipe?.title || recipe.title || "Untitled Recipe";

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
      <header className="mb-6">
        <h1 className="font-display text-3xl md:text-5xl font-bold leading-tight mb-4" style={{ color: 'var(--ink)' }}>
          {displayTitle}
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

      {/* Cook & Chat Buttons */}
      {hasAIRecipe && (
        <section className="mb-10 flex gap-3">
          <Link
            href={`/recipe/${id}/cook`}
            className="flex items-center gap-2 px-5 py-3 font-display font-semibold text-white transition-all hover:translate-y-[-2px] rounded-lg"
            style={{ background: 'var(--terracotta)' }}
          >
            <CookingPot size={22} weight="bold" />
            Cook
          </Link>
          <Link
            href={`/recipe/${id}/cook`}
            className="flex items-center gap-2 px-5 py-3 font-display font-semibold transition-all hover:translate-y-[-2px] rounded-lg border-2"
            style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }}
          >
            <ChatCircle size={22} weight="bold" />
            Chat
          </Link>
        </section>
      )}

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

      {/* AI Recipe Section - Primary Content */}
      <section className="mb-12">
        {(recipe.aiRecipeStatus === "pending" || recipe.aiRecipeStatus === "processing") && (
          <div className="border-2 border-dashed border-[var(--sage)] bg-[var(--sage)]/10 p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[var(--sage)] border-t-transparent mb-4" />
            <p className="font-display text-lg" style={{ color: 'var(--ink)' }}>
              Extracting recipe with AI...
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--ink-light)' }}>
              Analyzing transcript, description, and comments
            </p>
          </div>
        )}

        {recipe.aiRecipeStatus === "failed" && (
          <div className="border-2 border-dashed border-[var(--terracotta)] bg-[var(--terracotta)]/10 p-8 text-center">
            <p className="font-display text-lg mb-2" style={{ color: 'var(--ink)' }}>
              Couldn't extract recipe automatically
            </p>
            <p className="text-sm mb-4" style={{ color: 'var(--ink-light)' }}>
              {recipe.aiRecipeError || "The video may not contain a clear recipe"}
            </p>
            <button
              onClick={handleRetryExtraction}
              className="px-4 py-2 font-display text-sm text-white transition-all hover:translate-y-[-2px]"
              style={{ background: 'var(--terracotta)' }}
            >
              Try Again
            </button>
          </div>
        )}

        {hasAIRecipe && recipe.aiRecipe && (
          <div className="border-2 border-[var(--sage)] bg-white p-6 sm:p-8">
            {/* Recipe Meta */}
            {(recipe.aiRecipe.prepTime || recipe.aiRecipe.cookTime || recipe.aiRecipe.servings) && (
              <div className="flex flex-wrap gap-4 mb-6 pb-6 border-b border-[var(--ink-light)]/30">
                {recipe.aiRecipe.prepTime && (
                  <div>
                    <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--ink-light)' }}>Prep</span>
                    <p className="font-display font-medium" style={{ color: 'var(--ink)' }}>{recipe.aiRecipe.prepTime}</p>
                  </div>
                )}
                {recipe.aiRecipe.cookTime && (
                  <div>
                    <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--ink-light)' }}>Cook</span>
                    <p className="font-display font-medium" style={{ color: 'var(--ink)' }}>{recipe.aiRecipe.cookTime}</p>
                  </div>
                )}
                {recipe.aiRecipe.servings && (
                  <div>
                    <span className="text-xs uppercase tracking-wide" style={{ color: 'var(--ink-light)' }}>Servings</span>
                    <p className="font-display font-medium" style={{ color: 'var(--ink)' }}>{recipe.aiRecipe.servings}</p>
                  </div>
                )}
              </div>
            )}

            {recipe.aiRecipe.description && (
              <p className="mb-6 italic" style={{ color: 'var(--ink-light)' }}>
                {recipe.aiRecipe.description}
              </p>
            )}

            {/* Ingredients */}
            {recipe.aiRecipe.ingredients.length > 0 && (
              <div className="mb-8">
                <h2 className="font-display text-2xl font-bold mb-4" style={{ color: 'var(--ink)' }}>
                  Ingredients
                </h2>
                <ul className="space-y-2">
                  {recipe.aiRecipe.ingredients.map((ingredient, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--sage)' }} />
                      <span style={{ color: 'var(--ink)' }}>{ingredient}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Instructions */}
            {recipe.aiRecipe.instructions.length > 0 && (
              <div>
                <h2 className="font-display text-2xl font-bold mb-4" style={{ color: 'var(--ink)' }}>
                  Instructions
                </h2>
                <ol className="space-y-4">
                  {recipe.aiRecipe.instructions.map((step, i) => (
                    <li key={i} className="flex gap-4">
                      <span 
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-display font-bold text-white"
                        style={{ background: 'var(--terracotta)' }}
                      >
                        {i + 1}
                      </span>
                      <p className="pt-1" style={{ color: 'var(--ink)' }}>{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

          </div>
        )}

        {!recipe.aiRecipeStatus && !hasAIRecipe && (
          <div className="border-2 border-dashed border-[var(--ink-light)] p-8 text-center">
            <p className="font-display text-lg mb-4" style={{ color: 'var(--ink)' }}>
              No AI recipe extracted yet
            </p>
            <button
              onClick={handleRetryExtraction}
              className="px-4 py-2 font-display text-sm text-white transition-all hover:translate-y-[-2px]"
              style={{ background: 'var(--sage)' }}
            >
              Extract Recipe with AI
            </button>
          </div>
        )}
      </section>

      {/* Original Content - Collapsible */}
      {(recipe.description || recipe.ownerComment) && (
        <section className="mb-12 space-y-3">
          <h2 className="font-display text-sm uppercase tracking-wide mb-4" style={{ color: 'var(--ink-light)' }}>
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
          className="inline-flex items-center gap-3 px-6 py-3 font-display font-semibold text-white transition-all hover:translate-y-[-2px]"
          style={{ background: 'var(--terracotta)' }}
        >
          Watch on YouTube
        </a>
      </section>

      {/* Divider */}
      <div className="h-px my-12" style={{ background: 'var(--ink-light)' }} />

      {/* Actions */}
      <section className="flex justify-between items-center">
        <p className="text-sm" style={{ color: 'var(--ink-light)' }}>
          Saved {new Date(recipe._creationTime).toLocaleDateString('en-US', { 
            month: 'numeric', 
            day: 'numeric',
            year: '2-digit'
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
