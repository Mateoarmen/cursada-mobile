# Cursada Mobile (React Native / Expo)

Reescritura nativa de Cursada usando Expo + expo-router, conectada al mismo
proyecto de Supabase que ya usa la versión web (mismas tablas, mismos usuarios).

UI aplicada desde el diseño "Cursada Mobile Premium" (Claude Design): fondo
`#0F1116`, superficie `#191C22`, acento `#2C7BFF → #0A63F0`, tipografía
Instrument Sans + JetBrains Mono para cifras/horas. Tab bar de 4 (Inicio ·
Materias · Agenda · Horario); Perfil se accede desde el avatar de Inicio, no
es un 5.º tab.

## Estructura

```
cursada-mobile/
├── app/                     # Rutas (expo-router = navegación basada en archivos)
│   ├── _layout.tsx          # Layout raíz: carga fuentes, splash, stack de navegación
│   ├── login.tsx            # Onboarding (Apple/Google/correo)
│   ├── perfil.tsx           # Perfil (se llega desde el avatar de Inicio)
│   ├── semestre-activo.tsx  # Selector de semestre activo (desde Perfil)
│   ├── materia/[id].tsx     # Detalle de materia (evaluaciones, progreso)
│   └── (tabs)/
│       ├── _layout.tsx      # Tab bar inferior (blur, 4 tabs)
│       ├── index.tsx        # Inicio
│       ├── materias.tsx     # Materias
│       ├── agenda.tsx       # Agenda + sheet "Nuevo evento"
│       └── horario.tsx      # Horario semanal
├── src/
│   ├── theme/tokens.ts      # Colores, radios, espaciado, fuentes del design system
│   ├── theme/useAppFonts.ts # Carga de Instrument Sans + JetBrains Mono
│   ├── components/ui/       # Primitivas (AppText, PressableScale, ProgressRing, etc)
│   ├── data/demoContent.ts  # Datos de muestra para progreso/notas/horario (ver TODOs)
│   ├── lib/supabase.ts      # Cliente de Supabase
│   ├── hooks/useSession.ts  # Hook de sesión de auth
│   └── types/database.ts    # Tipos de las tablas (completar con `supabase gen types`)
├── app.json                 # Config de Expo (bundle id, splash, íconos)
├── package.json
└── .env.example
```

`src/data/demoContent.ts` alimenta las pantallas de Materias/Detalle/Agenda/
Horario con contenido de muestra (progreso, notas, créditos, bloques de
horario) porque el schema actual de Supabase todavía no tiene esas columnas.
Materias sí lee `nombre`/`color` reales de Supabase cuando hay datos
cargados; el resto queda marcado con `TODO(backend)` para cuando se agregue
el schema correspondiente.

## Setup

1. **Instalar dependencias** (necesitás Node 18+):
   ```bash
   npm install
   ```

2. **Variables de entorno**: copiá `.env.example` a `.env` y completá con las
   credenciales de tu proyecto Supabase (las mismas que usa la web — Project
   Settings > API en el dashboard de Supabase):
   ```bash
   cp .env.example .env
   ```

3. **Generar tipos reales de la base** (opcional pero recomendado, reemplaza
   los placeholders en `src/types/database.ts`):
   ```bash
   npx supabase gen types typescript --project-id <tu-project-id> > src/types/database.ts
   ```

4. **Correr en desarrollo** — con Expo Go en tu iPhone (sin Xcode, sin cuenta
   de Apple Developer):
   ```bash
   npm start
   ```
   Escaneás el QR con la cámara del iPhone y abre en la app Expo Go.

5. **Correr en el simulador de iOS** (necesitás Mac + Xcode instalado):
   ```bash
   npm run ios
   ```

## Próximos pasos sugeridos

- [ ] Completar la lógica de cada pantalla migrando la lógica de negocio de
      la versión web (cálculos de agenda, agrupación por semestre, etc)
- [ ] Implementar `activarSemestre` en `semestres.tsx`
- [ ] Traer catálogo de carreras/materias de ORT para el onboarding automático
- [ ] Revisar Row Level Security (RLS) en Supabase — las policies ya
      existentes deberían funcionar igual desde mobile, pero conviene
      verificarlas
- [ ] Cuando esté lista para testear con otros usuarios: cuenta de Apple
      Developer (USD 99/año) + build con EAS (`npx eas build --platform ios`)
      para poder subir a TestFlight
