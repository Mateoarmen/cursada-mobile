---
target: Inicio (Home) screen
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:/Users/mateoarmendariz/Documents/CLAUDE/cursada-mobile/app/(tabs)/index.tsx"
target_fingerprint: "sha256:53995b7b98e2c62424b356f4ca2e8527144e7aa5c492e07806973beb2a4ba294"
target_path: /Users/mateoarmendariz/Documents/CLAUDE/cursada-mobile/app/(tabs)/index.tsx
timestamp: 2026-09-18T02-35-48Z
slug: app-tabs-index-tsx
---
Method: dual-agent (A: a67e1ebe5c1f7a406 · B: ae7d4169902557fb0)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No loading indicator during the initial fetch; sections silently pop in once `useMemo`s resolve. |
| 2 | Match System / Real World | 4 | Spanish labels, natural date formatting, domain-correct terms ("Cursando", "Pendientes esta semana"). |
| 3 | User Control and Freedom | 3 | All-forward navigation is fine for a tab root; no real gaps found. |
| 4 | Consistency and Standards | 3 | Internally consistent (radii/spacing/press-feedback), but inconsistent with the web source of truth on elevation/motion language. |
| 5 | Error Prevention | 2 | Disabled "Evento personal" tile correctly prevents a dead action; but the data fetch has no failure guard at all. |
| 6 | Recognition Rather Than Recall | 4 | Materia color-dots and badge tones are reused 1:1 from Materias/Agenda logic — strong cross-screen consistency. |
| 7 | Flexibility and Efficiency | 2 | No shortcuts for a daily power user (Alex) — quick-access tiles jump to whole tabs, no swipe actions on list rows. |
| 8 | Aesthetic and Minimalist Design | 3 | Genuinely minimal, but "minimal" and "inert" are currently conflated — the web's spotlight background and card depth exist specifically to keep minimal from reading as bare. |
| 9 | Error Recovery | 1 | No error state exists for the Supabase fetch at all — a failed call reads as "nothing due today," which is actively misleading. |
| 10 | Help and Documentation | 3 | `disabledHint="Pronto"` on the disabled tile is an appropriately lightweight, contextual affordance for this screen type. |
| **Total** | | **27/40** | **Acceptable — solid foundation, real gaps in status/error feedback and motion** |

## Design Specificity Verdict

**LLM assessment:** Correct-but-flat, leaning inert. The screen faithfully ports the web's IA (hero → KPIs → quick actions → upcoming → risk → semester progress) and gets the flat/opaque card rule right — but that turns out to be accidental, not intentional (see below). It is missing nearly the entire "premium" layer the web's dark theme relies on: no spotlight background, no entrance motion anywhere on mount, and the one sanctioned glow-CTA treatment is implemented but wired to only 1 of its 3 intended spots. This reads as a well-executed wireframe of the web app rather than its "Pro Edition" sibling.

**Deterministic scan:** `impeccable detect` returned `[]` (exit 0) against both `app/(tabs)/index.tsx` and `src/theme/tokens.ts` + `src/components/ui`. This detector is built for web markup/CSS pattern-matching and has no meaningful coverage of React Native/JSX — read this as a null signal, not a clean bill of health. In its place, Assessment B ran six targeted static/grep checks that produced the hard evidence behind every priority issue below:
- `shadows.card` (tokens.ts) is defined but referenced nowhere in `app/` or `src/` — only `shadows.fab` (Fab.tsx:27) is ever used.
- Only one motion primitive exists in the whole codebase: `Animated.timing(..., { easing: Easing.linear })` inside `CtaGlow.tsx:38` (a continuous spin). No `react-native-reanimated`, no `withSpring`/`withTiming`, no named curves resembling the web's `ease-out`/`ease-in-out`/`ease-drawer`/`ease-spring` — and neither `reanimated` nor `moti` nor `lottie` is even a package.json dependency.
- `CtaGlow` exists but has zero references in `index.tsx`.
- The screen root (`SafeAreaView`, line 151) uses a flat `backgroundColor: colors.bg`; the only `LinearGradient` on the screen is scoped to the hero card, not the background.
- No `useEffect`/`Animated` usage anywhere in `index.tsx` — no mount-time fade/slide-in exists.

No false positives from the detector (it simply had nothing to say); no browser/simulator evidence was available or fabricated — both assessments explicitly flagged this as a source-level review (no booted Simulator).

## Overall Impression

The token layer (color, type, spacing, radii) was ported with real discipline — no brand violations found anywhere. What's missing is entirely the *motion and elevation* layer the user's brief predicted: zero ported easing curves, zero entrance animation, and a shadow token that was seemingly authored and then abandoned rather than deliberately withheld from cards. The single biggest opportunity is also the cheapest to fix: give the screen's sections a punchy, reduced-motion-aware entrance (there's already a working RN reduced-motion pattern to copy, in `CtaGlow.tsx` itself).

## What's Working

1. **Disciplined token usage.** `AppText`'s weight-to-family mapping and consistent use of `spacing.*`/`radii.*` throughout `index.tsx` reflects real design-system rigor, not ad-hoc styling. Single-accent discipline holds everywhere; no stray accent colors found.
2. **The hero card is the one place this screen nails the web's "recessed exception surface."** `colors.surfaceRaised` (`#171A21`) + the gradient-ring `LinearGradient` border correctly implements the one deliberately-different card in the whole app — and it's the single most premium-feeling element on the page today.
3. **Cross-screen recognition.** Materia color-dots and badge tone logic (`agendaBadgeInfo`, `TONE_COLOR`) are reused 1:1 from Materias/Agenda rather than reinvented — reduces cognitive load for a user moving between tabs.

## Priority Issues

**[P0] No entrance/appearance animation anywhere on mount, and no motion tokens ported at all.**
Why it matters: Confirmed by grep — zero `Animated`/`Reanimated`/`FadeIn` usage in `index.tsx`, and the only easing primitive anywhere in the codebase is a single linear spin inside `CtaGlow.tsx`. Combined with the async `useFocusEffect` fetch, the actual cold-open sequence is: header-only screen → all five sections pop into existence simultaneously, no transition. This is the single biggest gap between "correct" and "premium," and it's the thing the daily user (Alex) sees first, every day, forever.
Fix: Ports the web's `--ease-out` (things entering) as an RN easing curve and wraps each conditionally-rendered section in a short (~200-280ms) opacity/translateY entrance, gated behind `AccessibilityInfo.isReduceMotionEnabled` — copying the exact reduced-motion pattern `CtaGlow.tsx` already implements. Also a natural place to port `ease-in-out`/`ease-drawer` for later screens' sheet/drawer motion.
Suggested command: `/impeccable animate`

**[P1] `shadows.card` is dead code — the flat-card compliance is accidental, not a decision.**
Why it matters: Repo-wide grep confirms `shadows.card` (tokens.ts) is defined but never applied to any `View`. That means nobody actually decided cards should be flat and shadow-free — the token was authored and abandoned, and nothing stops a future card from picking it up inappropriately (violating "shadow only on FAB / active-day-cell / modals").
Fix: Either delete the unused token, or rename/scope it explicitly (e.g. `shadows.fabOrModalOnly`) with a comment enforcing the brand rule, so the correct-by-accident state becomes correct-by-design.
Suggested command: `/impeccable polish`

**[P1] `CtaGlow` is built but wired to only 1 of its 3 sanctioned spots — and Inicio's own empty-progress CTA isn't even a tappable button.**
Why it matters: The web spec reserves the glow treatment for exactly three first-use moments, one of which is Inicio's "load your first grade" empty state. In the mobile code, `kpis.promedioGeneral.empty` renders as a static, non-interactive `KpiCard` with `ctaTexto` shown as inert caption text — there's no button there to glow at all. Materias' "Agregar mi primera materia" button also lacks it.
Fix: Turn the empty `promedioGeneral` state into a real pressable CTA (or its own card outside the KPI grid) wrapped in `CtaGlow`; wrap Materias' first-subject button the same way.
Suggested command: `/impeccable polish`

**[P2] No error state for the Inicio data fetch.**
Why it matters: The `useFocusEffect` async block has no `.catch`/error branch. Since RLS from web is "inherited but unverified from mobile" per PRODUCT.md, a failed or denied fetch leaves every section silently hidden — for the exact power user who trusts this screen as their daily source of truth, a silent failure reads as "you have nothing due," which is worse than no data at all.
Fix: Add an error branch to the fetch and a minimal inline error state (not a full-screen block) so a failure is distinguishable from "genuinely caught up."
Suggested command: `/impeccable harden`

**[P2] No spotlight/radial background at the screen level.**
Why it matters: The web's dark theme applies a subtle radial-gradient glow toward the top-right of `.main` specifically so a near-black background doesn't read as bare. Inicio's root `SafeAreaView` uses a flat `colors.bg` with no equivalent — one of the concrete, nameable reasons the screen feels flatter than the web reference despite having the right base color.
Fix: Add a low-cost `RadialGradient`/`LinearGradient` wash behind the ScrollView content (same color stops as the web spotlight), scoped to Inicio for now.
Suggested command: `/impeccable polish`

## Persona Red Flags

**Alex (daily power user):** Hit hardest by the P0 and error-state gaps — this is the screen Alex opens first every day, and right now every open looks identical: pop-in, no acknowledgment of freshness, no distinction between "just refreshed" and "stale from the 5s focus-throttle cache." A habitual daily user is exactly who notices a screen that never feels alive across repeat visits. Also flagged: heuristic #7 — no shortcuts/deep-links from the quick-access tiles, every one jumps to a whole tab.

**Casey (mobile, thumb, frequently interrupted):** Touch targets and thumb-zone placement are fine (adequate `hitSlop`, no red flag there). But if Casey backgrounds the app mid-fetch and returns inside the 5s throttle window, they get stale data with zero signal it might be stale — compounding the missing loading/error feedback from P0/P2 above.

## Minor Observations

- `heroMeta` and `proximosDiasRows[].detalle` both hand-build `"materia · hora · tipo"` strings with duplicated manual concatenation logic — fine today, worth a shared formatter if `lib/proximos.ts` doesn't already have one.
- The hero gradient's third color stop (`rgba(255,255,255,0.06)`) introduces a faint white note into an otherwise accent-only ring — not a brand violation, but worth confirming it doesn't read as a second hue at small sizes.
- `KpiCard`'s `flexBasis: "47%"` + `flexGrow: 0` is a slightly fragile way to force a 2-column wrap for exactly 3-4 items; will need revisiting if a 5th KPI is ever added.
- Uniform `spacing.xl` rhythm between every section below the hero means "Materias en riesgo" (urgent) and "Accesos rápidos" (routine) currently carry the same visual weight — within the no-shadow/no-border rule, a subtle background-tint differentiation for the risk section could restore some hierarchy without violating the flat-card doctrine.

## Questions to Consider

- If `shadows.card` was authored and never used, was there an original intent to add elevation that got dropped mid-build — worth confirming before treating "flat cards" as a locked decision going forward?
- `CtaGlow` exists, works, and already respects reduced-motion — why does only 1 of 3 intended call sites use it? Oversight, or a deliberate MVP scope cut that should be tracked rather than silently diverging from the design doc?
- Is the total absence of entrance animation a "not yet built" gap or a considered choice to keep native mount fast? A 150–200ms staggered fade is unlikely to read as lag, but worth confirming the intent before `/impeccable animate` proceeds.
