"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { RecipeCard } from "@/components/RecipeCard";
import { AddRecipeForm } from "@/components/AddRecipeForm";

export default function Home() {
  const recipes = useQuery(api.recipes.list);
  const addRecipe = useMutation(api.recipes.add);
  const deleteRecipe = useMutation(api.recipes.remove);
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (url: string) => {
    setIsAdding(true);
    try {
      await addRecipe({ url });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <header className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-2">
          🍬 <span className="bg-gradient-to-r from-orange-500 to-pink-500 bg-clip-text text-transparent">bonbon</span>
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Save your favorite YouTube recipes for later
        </p>
      </header>

      <AddRecipeForm onAdd={handleAdd} isLoading={isAdding} />

      <section className="mt-12">
        <h2 className="text-2xl font-semibold mb-6 text-zinc-800 dark:text-zinc-200">
          Saved Recipes ({recipes?.length ?? 0})
        </h2>
        
        {recipes === undefined ? (
          <div className="text-center py-12 text-zinc-500">Loading...</div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            No recipes saved yet. Paste a YouTube link above to get started!
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe._id}
                recipe={recipe}
                onDelete={() => deleteRecipe({ id: recipe._id })}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
