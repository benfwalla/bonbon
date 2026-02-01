"use client";

import { use, useState, useEffect, useRef } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { 
  X, 
  CaretLeft, 
  CaretRight, 
  ChatCircle, 
  PaperPlaneTilt,
  CookingPot,
  ListChecks
} from "@phosphor-icons/react";

export default function CookModePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const recipe = useQuery(api.recipes.get, { id: id as Id<"recipes"> });
  const sendMessage = useAction(api.ai.chat);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Wake lock to keep screen on
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err) {
        console.log('Wake lock failed:', err);
      }
    };

    requestWakeLock();

    // Re-acquire on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      wakeLock?.release();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [recipe?.chatHistory]);

  if (recipe === undefined) {
    return (
      <div className="min-h-screen bg-[var(--cream)] flex items-center justify-center">
        <CookingPot size={48} className="animate-pulse" style={{ color: 'var(--terracotta)' }} />
      </div>
    );
  }

  if (!recipe?.aiRecipe) {
    router.push(`/recipe/${id}`);
    return null;
  }

  const { aiRecipe } = recipe;
  const instructions = aiRecipe.instructions;
  const totalSteps = instructions.length;

  const handlePrev = () => setCurrentStep(Math.max(0, currentStep - 1));
  const handleNext = () => setCurrentStep(Math.min(totalSteps - 1, currentStep + 1));

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    
    const message = chatInput.trim();
    setChatInput("");
    setChatLoading(true);
    
    try {
      await sendMessage({ recipeId: id as Id<"recipes">, message });
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setChatLoading(false);
    }
  };

  const toggleIngredient = (index: number) => {
    const newChecked = new Set(checkedIngredients);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedIngredients(newChecked);
  };

  return (
    <div className="min-h-screen bg-[var(--ink)] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-white/10">
        <button
          onClick={() => router.push(`/recipe/${id}`)}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <X size={24} />
        </button>
        <h1 className="font-display font-semibold text-lg truncate px-4">
          {aiRecipe.cleanTitle || aiRecipe.title || recipe.title}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowIngredients(!showIngredients)}
            className={`p-2 rounded-full transition-colors ${showIngredients ? 'bg-[var(--sage)] text-[var(--ink)]' : 'hover:bg-white/10'}`}
          >
            <ListChecks size={24} />
          </button>
          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-2 rounded-full transition-colors ${showChat ? 'bg-[var(--terracotta)]' : 'hover:bg-white/10'}`}
          >
            <ChatCircle size={24} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Ingredients panel (collapsible) */}
        {showIngredients && (
          <div className="p-4 border-b border-white/10 bg-white/5 max-h-[30vh] overflow-y-auto">
            <h2 className="font-display font-semibold mb-3 text-sm uppercase tracking-wide text-white/60">
              Ingredients
            </h2>
            <ul className="space-y-2">
              {aiRecipe.ingredients.map((ing, i) => (
                <li key={i}>
                  <button
                    onClick={() => toggleIngredient(i)}
                    className={`text-left w-full flex items-start gap-3 ${checkedIngredients.has(i) ? 'text-white/40 line-through' : ''}`}
                  >
                    <span className={`mt-1 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${checkedIngredients.has(i) ? 'bg-[var(--sage)] border-[var(--sage)]' : 'border-white/40'}`}>
                      {checkedIngredients.has(i) && <span className="text-[var(--ink)] text-xs">✓</span>}
                    </span>
                    <span className="text-sm">{ing}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Current step */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="text-sm uppercase tracking-wide text-white/40 mb-4">
            Step {currentStep + 1} of {totalSteps}
          </div>
          <p className="text-xl sm:text-2xl leading-relaxed max-w-lg">
            {instructions[currentStep]}
          </p>
        </div>

        {/* Step navigation */}
        <div className="flex items-center justify-between p-4 border-t border-white/10">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-6 py-3 bg-white/10 rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/20 transition-colors"
          >
            <CaretLeft size={20} />
            <span className="font-display">Back</span>
          </button>
          
          <div className="flex gap-1">
            {instructions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === currentStep ? 'bg-[var(--terracotta)]' : 'bg-white/20'}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={currentStep === totalSteps - 1}
            className="flex items-center gap-2 px-6 py-3 bg-[var(--terracotta)] rounded-full disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 transition-all"
          >
            <span className="font-display">Next</span>
            <CaretRight size={20} />
          </button>
        </div>
      </div>

      {/* Chat panel (slide up) */}
      {showChat && (
        <div className="absolute inset-x-0 bottom-0 bg-[var(--ink)] border-t border-white/10 flex flex-col" style={{ height: '50vh' }}>
          <div className="flex items-center justify-between p-3 border-b border-white/10">
            <h2 className="font-display font-semibold">Recipe Chat</h2>
            <button onClick={() => setShowChat(false)} className="p-1 hover:bg-white/10 rounded">
              <X size={20} />
            </button>
          </div>
          
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {(!recipe.chatHistory || recipe.chatHistory.length === 0) && (
              <p className="text-white/40 text-sm text-center">
                Ask anything about this recipe
              </p>
            )}
            {recipe.chatHistory?.map((msg, i) => (
              <div
                key={i}
                className={`text-sm ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
              >
                <span className={`inline-block px-3 py-2 rounded-2xl max-w-[85%] ${
                  msg.role === 'user' 
                    ? 'bg-[var(--terracotta)] text-white' 
                    : 'bg-white/10 text-white'
                }`}>
                  {msg.content}
                </span>
              </div>
            ))}
            {chatLoading && (
              <div className="text-left">
                <span className="inline-block px-3 py-2 rounded-2xl bg-white/10 text-white/60 text-sm">
                  ...
                </span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="p-3 border-t border-white/10">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Ask about substitutes, tips..."
                className="flex-1 bg-white/10 rounded-full px-4 py-2 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[var(--terracotta)]"
              />
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim() || chatLoading}
                className="p-2 bg-[var(--terracotta)] rounded-full disabled:opacity-50 hover:brightness-110 transition-all"
              >
                <PaperPlaneTilt size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
