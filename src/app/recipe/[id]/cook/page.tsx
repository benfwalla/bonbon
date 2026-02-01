"use client";

import { use, useState, useEffect, useRef } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useRouter, useSearchParams } from "next/navigation";
import { Drawer } from "vaul";
import { 
  X, 
  CaretLeft, 
  CaretRight, 
  ChatCircle, 
  PaperPlaneTilt,
  CookingPot,
  ListChecks
} from "@phosphor-icons/react";
import { useSwipeable } from "react-swipeable";

export default function CookModePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const recipe = useQuery(api.recipes.get, { id: id as Id<"recipes"> });
  const sendMessage = useAction(api.ai.chat);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [showChat, setShowChat] = useState(searchParams.get('chat') === 'true');
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
  }, [recipe?.chatHistory, showChat]);

  if (recipe === undefined) {
    return (
      <div className="h-[100dvh] w-full bg-[var(--ink)] flex items-center justify-center">
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

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleNext(),
    onSwipedRight: () => handlePrev(),
    trackMouse: false,
    trackTouch: true,
    delta: 50,
    preventScrollOnSwipe: true,
  });

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
    <div className="h-[100dvh] w-full bg-[var(--ink)] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-none flex items-center justify-between px-4 py-3 safe-top">
        <button
          onClick={() => router.push(`/recipe/${id}`)}
          className="p-2 -m-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <X size={24} />
        </button>
        <h1 className="font-display font-semibold text-base truncate px-4 text-center flex-1">
          {aiRecipe.cleanTitle || aiRecipe.title || recipe.title}
        </h1>
        <div className="w-10" /> {/* Spacer for balance */}
      </header>

      {/* Main content with side navigation */}
      <div {...swipeHandlers} className="flex-1 flex items-center justify-center relative min-h-0 px-4">
        {/* Left arrow */}
        <button
          onClick={handlePrev}
          disabled={currentStep === 0}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed hover:bg-white/20 transition-colors z-10"
        >
          <CaretLeft size={24} weight="bold" />
        </button>

        {/* Step content */}
        <div className="flex flex-col items-center justify-center text-center px-12 max-w-lg">
          <div className="text-sm uppercase tracking-wide text-white/40 mb-4">
            Step {currentStep + 1} of {totalSteps}
          </div>
          <p className="text-xl sm:text-2xl leading-relaxed">
            {instructions[currentStep]}
          </p>
        </div>

        {/* Right arrow */}
        <button
          onClick={handleNext}
          disabled={currentStep === totalSteps - 1}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed hover:bg-white/20 transition-colors z-10"
        >
          <CaretRight size={24} weight="bold" />
        </button>
      </div>

      {/* Bottom toolbar */}
      <div className="flex-none flex items-center justify-between px-6 pt-4 pb-8 mb-[env(safe-area-inset-bottom)]">
        {/* Ingredients button */}
        <button
          onClick={() => setShowIngredients(true)}
          className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <ListChecks size={24} />
        </button>

        {/* Step dots */}
        <div className="flex gap-1.5 justify-center">
          {instructions.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === currentStep ? 'bg-[var(--terracotta)]' : 'bg-white/30'}`}
            />
          ))}
        </div>

        {/* Chat button */}
        <button
          onClick={() => setShowChat(true)}
          className="p-3 rounded-full bg-[var(--terracotta)] hover:brightness-110 transition-all"
        >
          <ChatCircle size={24} weight="fill" />
        </button>
      </div>

      {/* Ingredients drawer */}
      <Drawer.Root open={showIngredients} onOpenChange={setShowIngredients}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/60 z-40" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 bg-[var(--ink)] border-t border-white/10 rounded-t-2xl max-h-[70dvh] flex flex-col">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-white/20 mt-3 mb-2" />
            <Drawer.Title className="font-display font-semibold px-4 pb-3 text-white border-b border-white/10">
              Ingredients
            </Drawer.Title>
            <div className="flex-1 overflow-y-auto p-4">
              <ul className="space-y-3">
                {aiRecipe.ingredients.map((ing, i) => (
                  <li key={i}>
                    <button
                      onClick={() => toggleIngredient(i)}
                      className={`text-left w-full flex items-start gap-3 ${checkedIngredients.has(i) ? 'text-white/40 line-through' : 'text-white'}`}
                    >
                      <span className={`mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${checkedIngredients.has(i) ? 'bg-[var(--sage)] border-[var(--sage)]' : 'border-white/40'}`}>
                        {checkedIngredients.has(i) && <span className="text-[var(--ink)] text-xs font-bold">✓</span>}
                      </span>
                      <span>{ing}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* Chat drawer */}
      <Drawer.Root open={showChat} onOpenChange={setShowChat}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/60 z-40" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 bg-[var(--ink)] border-t border-white/10 rounded-t-2xl h-[70dvh] flex flex-col">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-white/20 mt-3 mb-2" />
            <div className="flex items-center justify-between px-4 pb-3 border-b border-white/10">
              <Drawer.Title className="font-display font-semibold text-white">Recipe Chat</Drawer.Title>
              <button onClick={() => setShowChat(false)} className="p-1 hover:bg-white/10 rounded text-white/60">
                <X size={20} />
              </button>
            </div>
            
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(!recipe.chatHistory || recipe.chatHistory.length === 0) && (
                <p className="text-white/40 text-sm text-center py-8">
                  Ask anything about this recipe
                </p>
              )}
              {recipe.chatHistory?.map((msg, i) => (
                <div
                  key={i}
                  className={`${msg.role === 'user' ? 'text-right' : 'text-left'}`}
                >
                  <span className={`inline-block px-4 py-2.5 rounded-2xl max-w-[85%] text-sm ${
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
                  <span className="inline-block px-4 py-2.5 rounded-2xl bg-white/10 text-white/60 text-sm">
                    •••
                  </span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="flex-none p-3 border-t border-white/10 safe-bottom">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                  placeholder="Ask about substitutes, tips..."
                  className="flex-1 bg-white/10 rounded-full px-4 py-3 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[var(--terracotta)] text-white"
                  autoComplete="off"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || chatLoading}
                  className="p-3 bg-[var(--terracotta)] rounded-full disabled:opacity-50 hover:brightness-110 transition-all"
                >
                  <PaperPlaneTilt size={20} />
                </button>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}
