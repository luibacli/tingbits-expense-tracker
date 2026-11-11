# QA report

## Motion (2026-11-11, kit motion/07)
| Check | How | Result |
|---|---|---|
| Purpose test for every animation | Audit table in `CREATIVE_DIRECTION.md` → Motion direction | Pass: each one is Feedback or Explain; generic motion rejected |
| Only cheap properties animate | Code review: transform, opacity, clip-path (bars and meters no longer animate height or width) | Pass |
| Signature number settles exactly on the true value | e2e "the safe-to-spend figure settles exactly…" (4 browsers) | Pass |
| No layout shift from motion | e2e: CLS under 0.1 on `/` (calculator input) and `/app` (adding an entry) | Pass |
| Reduced motion: no hidden content, no tween | e2e reduced-motion test on `/` and `/app` | Pass |
| No-JS landing render | e2e "is server-rendered…" | Pass |
| Visual: bars and meters with clip-path | Screenshots of the Day Strip and hero at 390 px | Pass: rounded tops, correct heights |
| Lighthouse (mobile) | Not run; do it on the Vercel preview | Not verified |
