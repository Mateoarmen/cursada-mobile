---
name: cursada-mobile-design
description: Base de diseño de Cursada mobile — de dónde vienen los tokens y qué patrones ya existen. Cargar antes de tocar cualquier pantalla o componente de UI en este repo.
user-invocable: false
---

# Diseño — Cursada mobile

## Fuente de verdad

El design system real vive en el repo web (`cursada-design-system`):
`design.md` (reglas) + `src/styles.css` (valores exactos). Acá se traduce a
React Native en `src/theme/tokens.ts` — no inventar valores nuevos de color,
tipografía o espaciado si ya existe un token allá; si falta algo, portarlo
desde ese repo, no improvisar.

`tokens.ts` sólo implementa el **tema oscuro** de `design.md` (la app no
tiene modo claro todavía) — los valores de `colors` ahí corresponden 1:1 a
las variables `--color-*`/`--c-*` oscuras de `styles.css`.

## Desviaciones intencionales ya decididas (no "corregir")

- `fonts.mono` usa Instrument Sans (no JetBrains Mono como en la web) —
  decisión ya tomada porque en pantalla chica se leía "de código" en vez de
  un dato de la app. Ver comentario en `tokens.ts`.
- `estadoTone`/`tone` sólo cubren los 4 estados que ya usa la web
  (`TONE`/`ESTADO_TONE` de `runtime.js`) — no agregar tonos nuevos sin
  precedente en la web.

## Componentes reusables (`src/components/ui`)

Reusar antes de escribir estilos inline nuevos: `PrimaryButton`, `AppText`,
`PressableScale` (feedback táctil estándar), `ProgressRing` (anillo de
progreso vía SVG — RN no soporta `conic-gradient`, es el patrón para
cualquier "valor sobre un total"), `Pill`, `BottomSheet`, `Switch`,
`RangeSlider`.

### `CtaGlow`

Puerto de `.cta-glow` (marco de gradiente giratorio). Regla exacta de
`design.md`: **sólo** en el CTA de "primera acción" que el usuario ve una
única vez, sin otro control compitiendo en la misma pantalla. En la web son
tres botones puntuales (`#btn-ob-empezar`, `#btn-empty-primera`,
`#btn-progreso-semestre-cargar`); en la app, portar el mismo criterio a su
equivalente exacto en cada pantalla — no agregarlo a botones de acción
repetida (Guardar, + Nuevo, Continuar, etc.), rompería "éxito silencioso, no
toasts celebratorios". Ya aplicado en `app/onboarding/index.tsx` ("Crear mi
primera materia" del onboarding genérico). Si se agrega un cuarto lugar,
tiene que cumplir el mismo criterio, no "se ve bien acá también".

## Cómo verificar cambios visuales

`npm run web` (o el preset `cursada-mobile-web` de `.claude/launch.json`)
levanta la app en el navegador vía react-native-web — sirve para revisar
layout/color rápido, pero el gate de sesión (`app/_layout.tsx`) redirige
cualquier ruta sin sesión activa a `/login`: no crear ni loguear una cuenta
real para verificar una pantalla. Si hace falta ver algo detrás del gate,
usar una ruta temporal descartable (agregarla a la excepción del gate,
verificar, y revertir/borrar todo antes de terminar) en vez de autenticarse.
