---
target: Materias + Detalle de materia
total_score: 25
max_score: 36
na_heuristics: 10
p0_count: 2
p1_count: 2
target_identity: "file:/Users/mateoarmendariz/Documents/CLAUDE/cursada-mobile/app/(tabs)/materias.tsx"
target_fingerprint: "sha256:a530c40c7285855d0d668edcc73361f407a2454279d8d9f2e790ed600d178224"
target_path: /Users/mateoarmendariz/Documents/CLAUDE/cursada-mobile/app/(tabs)/materias.tsx
timestamp: 2026-09-18T02-54-43Z
slug: app-tabs-materias-tsx
---
Method: dual-agent (A: a916eb3579ca9bc95 · B: ae15e278add5f188d)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | List population is instant/jarring; simulator toggle has no transitional feedback; no saving-state on grade save. |
| 2 | Match System / Real World | 4 | Spanish domain copy (aprueba/exonera/rendir) matches student mental model well. |
| 3 | User Control and Freedom | 3 | "Reiniciar simulación" and cancel present; no undo after a saved nota. |
| 4 | Consistency and Standards | 2 | Internally consistent, but a direct sibling-screen regression — Inicio (one tab away) already has Reveal/Spotlight/CtaGlow; Materias/Detalle have none. |
| 5 | Error Prevention | 3 | `guardarNotas` clamps input to `[0, notaMax]` before save. |
| 6 | Recognition Rather Than Recall | 3 | Filter pills show live counts; view/state toggles are clear. |
| 7 | Flexibility and Efficiency | 2 | No sort-by-nota/riesgo/estado on either Materias view; no bulk actions. |
| 8 | Aesthetic and Minimalist Design | 3 | Correctly minimal per brand, but under-differentiated — every Detalle `Card` carries identical visual weight regardless of importance. |
| 9 | Error Recovery | 3 | Consistent `Alert.alert` pattern for failed saves. |
| 10 | Help and Documentation | n/a | No in-app help surface anywhere in this app — not specific to these two screens. |
| **Total** | | **25/36** | **Acceptable, on the edge of Good — functionally solid, sibling-consistency and hierarchy gaps hold it back** |

## Design Specificity Verdict

**LLM assessment:** Not done — regressed relative to the standard Inicio just established. Materias and Detalle show none of the three house patterns now shipped on Inicio (`Reveal`, `Spotlight`, `CtaGlow`): confirmed by import audit, neither file references any of the three. Materias' list-load path is literally the pre-fix Inicio anti-pattern — a spinner that snaps to a fully-populated `FlatList` with zero transition, the exact thing the Inicio critique already diagnosed and fixed one screen over. Functionally both screens are strong (real data parity with the web, careful edge-case clamping, a genuinely well-built grade simulator), but visually they now read as "half-migrated" specifically because the sibling tab has already been polished — a user swiping between tabs will notice the gap immediately.

**Deterministic scan:** `impeccable detect` returned `[]` (exit 0) on both files — a null signal, not a clean bill of health (web/CSS-oriented detector, no real RN coverage). In its place, nine static grep/read checks produced the hard evidence:
- Neither `materias.tsx` nor `[id].tsx` imports `Spotlight`, `Reveal`, or `CtaGlow`. Zero `Animated`/motion API usage in either file.
- Both screen roots use flat `colors.bg` (no spotlight wash) — `materias.tsx:264`, `[id].tsx:251`.
- `AddMateriaCard` (`materias.tsx:120-146`) and the `EmptyState` "Agregar mi primera materia" button (`materias.tsx:195`) are plain, unwrapped by `CtaGlow`, despite being one of the 3 product-wide sanctioned spots.
- Detalle's shared `Card` component (`[id].tsx:66-68`) is used at 4 call sites (`:305` Calificación, `:505` Evaluaciones, `:522` Horario, `:555` Asistencia) with byte-identical styling regardless of content density — the grading card can balloon to include the full simulator and still gets the same container as the compact schedule strip.
- The pass/fail callout (`calloutDe`, rendered `[id].tsx:348-353`) does get a tone-tinted background + border, but it's nested three levels inside the generic Card with no icon, no size distinction, no elevation — a real but small exception, swallowed by its container.
- `materias.tsx:345-349`: the loading→loaded swap is a plain ternary (`ActivityIndicator` → `FlatList`), not gated by any transition primitive.

No false positives; no live capture was available or fabricated by either assessment.

## Overall Impression

The underlying work is solid — data parity with the web is meticulous, the grade simulator's math and copy are genuinely the best interaction in the app, and empty/error states exist and behave correctly. What's missing is exactly what the Inicio pass added: an authored entrance, the one sanctioned glow-CTA, and visual hierarchy for the one piece of information that actually matters most on Detalle (am I passing?). The single biggest opportunity is making the pass/fail callout read as the page's verdict, not as another card's body copy — it's currently the least visually important-looking element that is the most informationally important one on the screen.

## What's Working

1. **The grade simulator is the strongest single interaction in the app.** `calcularSimulacion` surfaces tone-correct, precisely-worded projections (asegurado/imposible/faltan-X), and the `Aviso` banners correctly reuse the same `tone` system as the rest of the product — real craft, just currently inert (no entrance, no highlight on tone crossing).
2. **Data-parity discipline.** Both files carry detailed comments tying every computed value back to the web's `runtime.js` (e.g. `calloutDe`'s 5-branch documentation) — this is why the numbers can be trusted, not just how they look.
3. **MateriaCard's internal composition** (tile → badge → name/docente → ring+meta → footer accent) is a well-balanced, scannable card layout — the best-composed single element on either screen.

## Priority Issues

**[P0] Detalle's pass/fail callout — the single most important string on the screen — reads as a generic card paragraph.** `calloutDe()` computes the one thing a student opens this screen to know, but it renders as a tone-tinted `View` nested inside the same `Card` as the grade ring, notes list, and buttons — same radius/padding rhythm as everything around it, no icon, no elevation, no size differentiation.
Fix: Give it its own container distinct from the flat `Card` system — a leading tone icon, positioned above/outside the ring row, sized to read as the page's headline rather than body copy. Stays within "no shadow, no border on content cards" (a background/padding/typographic distinction, not elevation).
Suggested command: `/impeccable polish`

**[P0] No entrance motion on Materias' list — literally the pre-fix Inicio pattern.** `cargando && rows.length===0` swaps straight from spinner to a fully-populated list with zero transition (`materias.tsx:345-349`) — the exact anti-pattern the Inicio critique already fixed with a `dataReady`-gated `<Reveal>`. This is a direct, visible regression against a standard already shipped one tab away.
Fix: Port the same `dataReady`-gated `<Reveal>` pattern from Inicio around the loaded grid/table, plus a light `<Reveal mode="pop">` stagger on the first screenful of cards (same sanctioned "real list" exception used for Inicio's KPI tiles).
Suggested command: `/impeccable animate`

**[P1] The one sanctioned `CtaGlow` spot on this screen isn't wired.** `AddMateriaCard`'s dashed "add" tile and `EmptyState`'s "Agregar mi primera materia" button are explicitly one of the product's 3 sanctioned first-use glow spots (per design.md), confirmed absent via import audit — the moment meant to feel special looks identical to every other dashed rectangle.
Fix: Wrap `EmptyState`'s `PrimaryButton` in `<CtaGlow>`, matching the pattern already shipped on Inicio's "Cargá tu primera nota" KPI tile.
Suggested command: `/impeccable polish`

**[P1] The grade simulator's open/close toggle has zero transition.** `simuladorAbierto` flips between two conditionally-rendered blocks (`[id].tsx:379-501`) via instant remount — no height/opacity animation, no rotation on the chevron icon that already swaps state (`:392`). This is the richest interaction on the screen and currently has less motion polish than a static Pill.
Fix: Animate the panel open/close (height+opacity, `easing.out`, `motionDuration.layout`) and rotate the chevron on toggle.
Suggested command: `/impeccable animate`

**[P2] All four Detalle `Card` sections carry identical visual weight regardless of importance or density.** The grading card (which can expand to include the full simulator) and the compact schedule strip get byte-identical containers — no visual shortcut for a user (Alex) comparing several subjects to find what matters.
Fix: Differentiate `Card` treatment by section importance/density (e.g. more generous padding/emphasis for the grading card, a more compact treatment for the schedule strip) — still within the flat/no-shadow rule.
Suggested command: `/impeccable polish`

## Persona Red Flags

**Alex (power user comparing many subjects):** Materias' table view is the right shape for fast scanning but has no sort-by-nota/riesgo/estado — only insertion order, on both views. Also hit by P2 (no visual hierarchy in Detalle's sections).

**Riley (stress-tests the simulator/attendance):** `guardarNotas`'s input clamp is solid, but an invalid/empty field (`if (!raw || !raw.trim()) return null`) silently drops that one change with no per-field error signal — Riley gets silent partial-failure, not a clear "that didn't count." `RangeSlider`'s `PanResponder` reads a cached `widthRef` captured at `onLayout`; dragging while the sheet is still settling layout could desync touch-to-value.

## Minor Observations

- `materiaAbrev` is duplicated verbatim in both files (`materias.tsx:20-22`, `[id].tsx:21-23`) — not a design issue, a maintenance smell.
- The filter/search/view-toggle stack in Materias (`materias.tsx:275-342`) gives no transition between tarjetas/tabla switches — an instant content swap rather than a crossfade. Minor (P3-level), folded in here rather than as a standalone priority issue given the 5-issue cap.
- Detalle's `stub()` `Alert.alert` pattern for unimplemented actions ("Cambiar escala", "Editar") is the app's only remaining raw system alert in an otherwise custom-sheet-driven UI — worth a follow-up pass, out of scope here.
- `EstadoBadge`'s 8px accent dot in `MateriaCard`'s footer duplicates color already shown via the tile and badge — mildly redundant, low cost.

## Questions to Consider

- Should the grade simulator — the most sophisticated single interaction in the app — get its own distinct `motionDuration.focal`-length entrance (already defined in tokens.ts) rather than inheriting nothing at all, given it's arguably more "authored moment"-worthy than the KPI tiles that got the stagger treatment on Inicio?
- Is the flat, undifferentiated `Card` on Detalle deliberate minimalism, or an artifact of the component predating the opaque/flat-card mandate — and would giving the callout *any* distinction (even just padding/radius) still honor "no shadows, no borders on content cards" while fixing the hierarchy problem?
- Now that Inicio sets a visibly higher bar, does leaving any other untouched screen (Agenda, Horario, Progreso) for later risk the same "half-migrated, noticed on tab-swipe" impression in the meantime?
