"use client";

import { use, useState, useEffect, useRef, Suspense } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
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
  ListChecks,
  Timer,
  Trash,
} from "@phosphor-icons/react";
import { useSwipeable } from "react-swipeable";

// Find durations like "bake for 25 minutes", "simmer 10-12 min", "rest 1 hour"
// in a step's text so we can offer one-tap timers
function parseStepTimers(step: string): { label: string; seconds: number }[] {
  const results: { label: string; seconds: number }[] = [];
  const re =
    /(\d+(?:\.\d+)?)(?:\s*(?:to|-|–|—)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi;
  let m;
  while ((m = re.exec(step)) !== null) {
    const from = parseFloat(m[1]);
    const to = m[2] ? parseFloat(m[2]) : undefined;
    const unit = m[3].toLowerCase();
    const mult = unit.startsWith("h") ? 3600 : unit.startsWith("s") ? 1 : 60;
    // For a range ("10-12 min"), time the upper bound
    const seconds = Math.round((to ?? from) * mult);
    if (seconds < 10 || seconds > 12 * 3600) continue;
    const unitLabel = unit.startsWith("h") ? "hr" : unit.startsWith("s") ? "sec" : "min";
    const label = to ? `${m[1]}–${m[2]} ${unitLabel}` : `${m[1]} ${unitLabel}`;
    results.push({ label, seconds });
  }
  // Dedupe identical durations
  return results
    .filter((r, i) => results.findIndex((x) => x.seconds === r.seconds) === i)
    .slice(0, 3);
}

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

type ActiveTimer = {
  endsAt: number;
  totalSeconds: number;
  label: string;
  step: number; // 1-based step it was started from
  done: boolean;
};

function CookMode({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recipe = useQuery(api.recipes.get, { id: id as Id<"recipes"> });
  const sendMessage = useAction(api.recipeAi.chat);
  const clearChat = useMutation(api.recipes.clearChat);

  const [currentStep, setCurrentStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [showChat, setShowChat] = useState(searchParams.get("chat") === "true");
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [timer, setTimer] = useState<ActiveTimer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const historyBaselineRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const hasCookableRecipe = !!recipe?.aiRecipe && recipe.aiRecipe.instructions.length > 0;

  // Redirect back to the recipe page if there's nothing to cook
  // (side effects don't belong in render)
  useEffect(() => {
    if (recipe !== undefined && !hasCookableRecipe) {
      router.replace(`/recipe/${id}`);
    }
  }, [recipe, hasCookableRecipe, id, router]);

  // Wake lock to keep screen on
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
        }
      } catch (err) {
        console.log("Wake lock failed:", err);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      wakeLock?.release();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Scroll chat to bottom (scroll the container, not the page)
  const historyLength = recipe?.chatHistory?.length ?? 0;
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [historyLength, pendingMessage, chatLoading, showChat]);

  // Once the sent exchange lands in chat history, drop the optimistic bubble
  useEffect(() => {
    if (historyLength > historyBaselineRef.current && (pendingMessage || chatLoading)) {
      setPendingMessage(null);
      setChatLoading(false);
    }
  }, [historyLength, pendingMessage, chatLoading]);

  // Tick the timer
  useEffect(() => {
    if (!timer || timer.done) return;
    const iv = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(iv);
  }, [timer]);

  // Fire the alarm when the timer runs out
  useEffect(() => {
    if (timer && !timer.done && timer.endsAt <= now) {
      setTimer({ ...timer, done: true });
      playChime();
      if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200, 100, 500]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, timer]);

  const playChime = () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime;
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = i === 2 ? 1174 : 880;
        gain.gain.setValueAtTime(0.0001, t0 + i * 0.45);
        gain.gain.exponentialRampToValueAtTime(0.4, t0 + i * 0.45 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.45 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0 + i * 0.45);
        osc.stop(t0 + i * 0.45 + 0.42);
      }
    } catch {
      // sound is best-effort; the visual alarm still shows
    }
  };

  const startTimer = (label: string, seconds: number) => {
    // Create/resume the audio context inside the tap gesture so iOS lets us
    // play the chime later
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        audioCtxRef.current = audioCtxRef.current ?? new Ctx();
        audioCtxRef.current.resume();
      }
    } catch {
      // no audio — vibration/visual alarm still work
    }
    setNow(Date.now());
    setTimer({
      endsAt: Date.now() + seconds * 1000,
      totalSeconds: seconds,
      label,
      step: currentStep + 1,
      done: false,
    });
  };

  const instructions = recipe?.aiRecipe?.instructions ?? [];
  const totalSteps = instructions.length;

  const handlePrev = () => setCurrentStep((s) => Math.max(0, s - 1));
  const handleNext = () => setCurrentStep((s) => Math.min(Math.max(totalSteps - 1, 0), s + 1));

  // Hook — must be called unconditionally, before the loading early-return
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleNext(),
    onSwipedRight: () => handlePrev(),
    trackMouse: false,
    trackTouch: true,
    delta: 50,
    preventScrollOnSwipe: true,
  });

  if (recipe === undefined || !hasCookableRecipe) {
    return (
      <div className="h-[100dvh] w-full bg-[var(--ink)] flex items-center justify-center">
        <CookingPot size={48} className="animate-pulse" style={{ color: 'var(--terracotta)' }} />
      </div>
    );
  }

  const { aiRecipe } = recipe;
  const stepTimers = parseStepTimers(instructions[currentStep] ?? "");
  const remainingSeconds = timer ? Math.ceil((timer.endsAt - now) / 1000) : 0;

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const message = chatInput.trim();
    historyBaselineRef.current = recipe.chatHistory?.length ?? 0;
    setChatInput("");
    setChatError(null);
    setPendingMessage(message);
    setChatLoading(true);

    try {
      await sendMessage({
        recipeId: id as Id<"recipes">,
        message,
        currentStep: currentStep + 1,
      });
    } catch (err) {
      console.error("Chat error:", err);
      setPendingMessage(null);
      setChatLoading(false);
      setChatInput(message); // give the message back so it isn't lost
      setChatError("Couldn't send — check your connection and try again.");
    }
  };

  const handleClearChat = async () => {
    if (!recipe.chatHistory?.length) return;
    if (confirm("Clear this recipe's chat history?")) {
      await clearChat({ recipeId: id as Id<"recipes"> });
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
          {aiRecipe!.cleanTitle || aiRecipe!.title || recipe.title}
        </h1>
        <div className="w-10" /> {/* Spacer for balance */}
      </header>

      {/* Active timer pill */}
      {timer && (
        <div className="flex-none flex justify-center px-4 pb-1">
          {timer.done ? (
            <button
              onClick={() => setTimer(null)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--terracotta)] text-white font-semibold animate-pulse"
            >
              <Timer size={18} weight="fill" />
              Time&apos;s up — {timer.label} (step {timer.step}) · tap to dismiss
            </button>
          ) : (
            <button
              onClick={() => {
                if (confirm("Cancel this timer?")) setTimer(null);
              }}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-sm"
            >
              <Timer size={16} className="text-[var(--terracotta)]" weight="fill" />
              <span className="tabular-nums font-semibold">{formatCountdown(remainingSeconds)}</span>
              <span className="text-white/50">{timer.label} · step {timer.step}</span>
              <X size={14} className="text-white/50" />
            </button>
          )}
        </div>
      )}

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
          {/* One-tap timers detected in this step */}
          {stepTimers.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {stepTimers.map((t) => (
                <button
                  key={t.seconds}
                  onClick={() => startTimer(t.label, t.seconds)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--terracotta)] text-[var(--terracotta)] text-sm font-semibold hover:bg-[var(--terracotta)] hover:text-white transition-colors"
                >
                  <Timer size={16} weight="bold" />
                  {t.label}
                </button>
              ))}
            </div>
          )}
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

        {/* Step progress: dots for short recipes, a bar for long ones */}
        {totalSteps <= 12 ? (
          <div className="flex gap-1.5 justify-center">
            {instructions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === currentStep ? 'bg-[var(--terracotta)]' : 'bg-white/30'}`}
              />
            ))}
          </div>
        ) : (
          <div className="flex-1 mx-4 max-w-[160px]">
            <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--terracotta)] transition-all"
                style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

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
                {aiRecipe!.ingredients.map((ing, i) => (
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
              <div className="flex items-center gap-1">
                {(recipe.chatHistory?.length ?? 0) > 0 && (
                  <button
                    onClick={handleClearChat}
                    className="p-1.5 hover:bg-white/10 rounded text-white/60"
                    title="Clear chat"
                  >
                    <Trash size={18} />
                  </button>
                )}
                <button onClick={() => setShowChat(false)} className="p-1 hover:bg-white/10 rounded text-white/60">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Chat messages */}
            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {!recipe.chatHistory?.length && !pendingMessage && (
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
              {pendingMessage && (
                <div className="text-right">
                  <span className="inline-block px-4 py-2.5 rounded-2xl max-w-[85%] text-sm bg-[var(--terracotta)] text-white opacity-80">
                    {pendingMessage}
                  </span>
                </div>
              )}
              {chatLoading && (
                <div className="text-left">
                  <span className="inline-block px-4 py-2.5 rounded-2xl bg-white/10 text-white/60 text-sm">
                    •••
                  </span>
                </div>
              )}
              {chatError && (
                <p className="text-center text-sm text-[var(--terracotta-light)]">
                  {chatError}
                </p>
              )}
            </div>

            {/* Chat input */}
            <div className="flex-none p-3 pb-8 mb-[env(safe-area-inset-bottom)] border-t border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      handleSendChat();
                    }
                  }}
                  placeholder="Ask about substitutes, tips..."
                  className="flex-1 bg-white/10 rounded-full px-4 py-3 text-base placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[var(--terracotta)] text-white"
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

export default function CookModePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // useSearchParams (for ?chat=true) requires a Suspense boundary
  return (
    <Suspense
      fallback={
        <div className="h-[100dvh] w-full bg-[var(--ink)] flex items-center justify-center">
          <CookingPot size={48} className="animate-pulse" style={{ color: 'var(--terracotta)' }} />
        </div>
      }
    >
      <CookMode id={id} />
    </Suspense>
  );
}
