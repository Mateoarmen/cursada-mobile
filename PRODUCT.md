# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users

University students tracking their own academic progress: courses/subjects enrolled per semester, evaluations, assignments, and weekly class schedule. ORT's catalog of careers/subjects is used for onboarding today, but the product is not institution-locked — it targets university students generally.

## Product Purpose

Cursada Mobile is a native (Expo/React Native) rewrite of the existing Cursada web app, giving students a mobile-first way to see what's due, how they're progressing in each subject, and what their week looks like. It connects to the same Supabase project (same tables, same users) as the web version, so the two are two clients of one product.

## Positioning

A quiet, single-accent, minimal academic tracker — positioned against noisier student-planner apps — that mirrors an already-designed web product's visual identity ("quiet power", Apple/Stripe/Linear-adjacent minimalism) rather than inventing a separate mobile visual language.

## Operating Context

- Screens (expo-router, file-based): Inicio (home), Materias (subjects list), Materia detail (evaluations/progress), Agenda (with "Nuevo evento" sheet), Horario (weekly schedule), Perfil (reached from the Inicio avatar, not a 5th tab), Semestre activo (active-semester selector, from Perfil), Login (Apple/Google/email onboarding).
- Tab bar is 4 tabs: Inicio · Materias · Agenda · Horario.
- Backend is shared with the existing Cursada web app via Supabase (same auth, same tables); Row Level Security policies are inherited from web and expected to work as-is but are unverified from mobile.
- `src/data/demoContent.ts` currently supplies placeholder content (progress, notes, credits, schedule blocks) for Materias/Detail/Agenda/Horario because the live Supabase schema doesn't yet have those columns; Materias does read real `nombre`/`color` from Supabase when data exists. These are marked `TODO(backend)` in the codebase.

## Capabilities and Constraints

- Built with Expo + expo-router; Node 18+ for development.
- iOS distribution requires an Apple Developer account (not yet purchased) and an EAS build for TestFlight — not yet done.
- Business logic (agenda calculations, semester grouping, etc.) still needs to be migrated over from the web version for several screens.
- `activarSemestre` (activate semester) is not yet implemented.
- Real Supabase types (`src/types/database.ts`) are placeholders pending `supabase gen types`.

## Brand Commitments

- Product name: Cursada.
- Existing visual identity, already locked in the companion web design system (`cursada-design-system/design.md`) and partially applied here per the README: background `#0F1116`, surface `#191C22`, accent gradient `#2C7BFF → #0A63F0` (brand blue, the one accent across the whole product — landing, app, legal), typography Instrument Sans + JetBrains Mono (the latter for numbers/times).
- Genre: modern-minimal / "quiet power" — no glassmorphism, no text gradients, sans-serif throughout, single accent color.
- The web app's own visual language for its app shell is preserved as-is (sidebar/topbar/tabbar, view names) per `cursada-design-system/design.md` — mobile's job is to carry the same identity natively, not to redesign it.

## Evidence on Hand

- Companion product's design system: `../cursada-design-system/design.md` (locked design tokens, genre, macrostructure) and `../cursada-design-system/design-reference/`.
- No user testimonials, case studies, or press exist yet — do not fabricate any.

## Product Principles

- One client, one identity: mobile should read as the same product as the web app, not a reskin.
- Single accent discipline: the brand blue is the only accent color anywhere in the product; don't introduce new accent colors on mobile.
- Quiet over loud: minimal, uncluttered screens over dense dashboards — consistent with the "quiet power" positioning.
- Real data over decoration: demo content is a stand-in, not a design goal; screens should degrade gracefully as real Supabase data replaces it.
- Native fit over web parity: adapt to iOS conventions (tab bar, sheets, gestures) rather than literally cloning the web shell's DOM-era structure.
