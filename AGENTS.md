# AGENTS.md - bonbon

Project-specific notes for AI assistants working on this repo.

## Project Overview

**bonbon** — YouTube recipe saver
- Paste YouTube cooking videos → auto-extract recipes with AI
- Cook mode with step-by-step navigation
- Chat with recipes while cooking

## Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS
- **Backend:** Convex (shared deployment: `amicable-weasel-128`)
- **Deployment:** Vercel (org: `ben-wallaces-projects`)
- **Package manager:** Bun preferred, npm works

## Key Links

- **GitHub:** https://github.com/benfwalla/bonbon
- **Convex Dashboard:** https://dashboard.convex.dev/t/ben-wallace/openclaw/amicable-weasel-128
- **Vercel Dashboard:** https://vercel.com/ben-wallaces-projects/bonbon
- **Live site:** https://bonbon-eta.vercel.app

## Convex Notes

This deployment is **shared with fitclaw** — both apps use the same Convex backend.
- bonbon tables: `recipes`
- fitclaw tables: `fitUser`, `fitEquipment`, `fitExercises`, `fitWorkouts`, `fitChat`, `fitCurrentWorkout`

**Do not modify fitclaw tables when working on bonbon.**

## Transcript Fetching

`convex/recipeAi.ts` fetches captions via YouTube's InnerTube API (ANDROID
client) first, falling back to the `youtube-transcript` npm package. The
package alone is unreliable from datacenter IPs (it scrapes the watch page
and gets bot-blocked), which is why InnerTube is primary. Each recipe stores
`extractionSources` so the UI shows whether the transcript was actually used.

## Post-Deploy Checklist

After pushing changes:
1. Wait ~60s for Vercel build
2. Check deployment status: `npx vercel ls bonbon --token="$VERCEL_TOKEN"`
3. If build fails → check logs, fix, push, retry (up to 3x)
4. **If `convex/` changed:** Vercel only builds the frontend — the Convex
   functions/schema must also be deployed with `npx convex deploy` (or
   `bunx convex deploy`) or the frontend will call functions that don't
   exist yet
5. If stuck → notify in Discord #bonbon channel
