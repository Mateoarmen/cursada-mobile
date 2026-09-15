# Cursada Mobile (React Native / Expo)

Reescritura nativa de Cursada usando Expo + expo-router, conectada al mismo
proyecto de Supabase que ya usa la versión web (mismas tablas, mismos usuarios).

## Estructura

```
cursada-mobile/
├── app/                    # Rutas (expo-router = navegación basada en archivos)
│   ├── _layout.tsx         # Layout raíz: controla sesión y redirige a login o tabs
│   ├── login.tsx           # Pantalla de login
│   └── (tabs)/
│       ├── _layout.tsx     # Tab bar inferior
│       ├── index.tsx       # Inicio
│       ├── materias.tsx    # Materias
│       ├── agenda.tsx      # Agenda (parciales, entregas, finales)
│       ├── horario.tsx     # Horario semanal
│       └── semestres.tsx   # Selector de semestre activo
├── src/
│   ├── lib/supabase.ts     # Cliente de Supabase
│   ├── hooks/useSession.ts # Hook de sesión de auth
│   └── types/database.ts   # Tipos de las tablas (completar con `supabase gen types`)
├── app.json                # Config de Expo (bundle id, splash, íconos)
├── package.json
└── .env.example
```

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
