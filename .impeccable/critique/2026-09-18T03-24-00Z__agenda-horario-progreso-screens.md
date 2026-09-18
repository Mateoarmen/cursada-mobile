---
target: Agenda, Horario, Progreso screens
total_score: 16
max_score: 36
na_heuristics: 10
p0_count: 2
p1_count: 2
target_identity: "file:/Users/mateoarmendariz/Documents/CLAUDE/cursada-mobile/Agenda, Horario, Progreso screens"
timestamp: 2026-09-18T03-24-00Z
slug: agenda-horario-progreso-screens
---
# Crítica: Agenda, Horario, Progreso

Method: dual-agent (A: ace469ebcdfdecacd · B: a7b69f6dfd2a2e377)

## Design Health Score

| # | Heurística | Score | Hallazgo clave |
|---|---|---|---|
| 1 | Visibilidad del estado del sistema | 1 | Agenda no tiene loading state |
| 2 | Coincidencia sistema/mundo real | 2 | Horario muestra ordinal del día, no fecha |
| 3 | Control y libertad del usuario | 2 | Creación fuerza fecha=hoy; Progreso clampea notas silenciosamente |
| 4 | Consistencia y estándares | 1 | 3 headers distintos; sin Reveal/Spotlight |
| 5 | Prevención de errores | 2 | guardarNota inserta fila de agenda sintética |
| 6 | Reconocimiento vs. recuerdo | 2 | Sin marcador persistente de "hoy" en Horario |
| 7 | Flexibilidad y eficiencia | 2 | Sin swipe-to-complete, sin vista semanal |
| 8 | Diseño estético y minimalista | 1 | ~200pt de chrome fijo en Agenda |
| 9 | Ayuda a reconocer errores | 1 | error de hooks no leído en ninguna pantalla |
| 10 | Ayuda y documentación | n/a | No aplica |
| Total | | 16/36 (≈17.8/40) | Poor |

## Design Specificity Verdict
Falla en las tres, Horario peor (bug ordinal-vs-fecha, sin eje temporal), Progreso segundo (sin jerarquía), Agenda menos grave (color rail específico pero header genérico). Detector B corrió limpio (reglas genéricas no conocen Pro Edition); confirmó por grep 0 ocurrencias de shadow/blur/motion primitives en las 3 pantallas vs uso en index/materias/detalle; celda activa de Horario sin la sombra sancionada; CtaGlow budget agotado (3/3).

## Priority Issues
P0: Loading/error/empty indiferenciados en las 3 pantallas → /impeccable harden
P0: Horario sin vista semanal, sin eje de tiempo, ordinal-vs-fecha → /impeccable shape
P1: Sin Spotlight/Reveal, celda activa de Horario sin sombra sancionada → /impeccable animate
P1: Progreso sin jerarquía, pico emocional entregado como Alert de sistema → /impeccable bolder
P2: Chrome-antes-que-contenido en Agenda, creación sin fecha → /impeccable distill

## Persona Red Flags
Alex: sin vista semanal, ScrollView en vez de FlatList, filtros no persisten.
Sam: día selector sin labels/estado, checkbox sin role, contraste bajo en hora.
Casey: filtros antes de contenido, mensaje de vacío durante loading, sin haptics.

## Minor Observations
Sin DESIGN.md en mobile; paddingBottom hardcodeado; sheets sin easing.drawer; TextInput de Progreso con bajo contraste contra su sheet; fetchMaterias duplicado inline en Progreso.
