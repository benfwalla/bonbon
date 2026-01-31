"use client";

import Image from "next/image";
import { Doc } from "../../convex/_generated/dataModel";

interface RecipeCardProps {
  recipe: Doc<"recipes">;
  onDelete: () => void;
}

export function RecipeCard({ recipe, onDelete }: RecipeCardProps) {
  const formattedDate = new Date(recipe._creationTime).toLocaleDateString();

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-zinc-100 dark:border-zinc-700">
      {recipe.thumbnail && (
        <a href={recipe.url} target="_blank" rel="noopener noreferrer">
          <div className="relative aspect-video">
            <Image
              src={recipe.thumbnail}
              alt={recipe.title || "Recipe thumbnail"}
              fill
              className="object-cover"
            />
          </div>
        </a>
      )}
      <div className="p-4">
        <a
          href={recipe.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-orange-500 transition-colors line-clamp-2"
        >
          {recipe.title || "Untitled Recipe"}
        </a>
        {recipe.channelName && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {recipe.channelName}
          </p>
        )}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-700">
          <span className="text-xs text-zinc-400">Saved {formattedDate}</span>
          <button
            onClick={onDelete}
            className="text-xs text-red-500 hover:text-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
