# ¿Qué hay? — CLAUDE.md

App personal para 2 personas que comparten despensa y reciben sugerencias de recetas generadas con IA.

## Stack

- **Frontend:** React + Vite + Tailwind v4 (plugin `@tailwindcss/vite`, sin `tailwind.config.js`)
- **Auth + DB:** Supabase (PostgreSQL con RLS activado)
- **IA:** OpenAI GPT-4o-mini via Vercel Functions (nunca llamar OpenAI directo desde el frontend)
- **Deploy:** Vercel

## Arquitectura — decisiones tomadas

**OpenAI va por Vercel Functions** (`/api/recipes.js`), no desde el frontend. La API key vive como variable de entorno en Vercel, nunca en el cliente.

**Sistema de despensa compartida por invite code.** Usuario A crea cuenta y genera un código. Usuario B lo ingresa al registrarse. El código se guarda en `user_metadata` de Supabase Auth al hacer `signUp`. La lógica de vincular usuarios por código se implementa en Fase 2.

**Sin realtime por ahora.** Se puede agregar en fases posteriores sin romper nada. No es necesario para el MVP.

## Fases del proyecto

- [x] **Fase 1** — Proyecto base: Vite + React + Tailwind + Supabase conectado + login/registro + deploy en Vercel ✓ (repo: pepelancheros/quehay, deployado en Vercel)
- [ ] **Fase 2** — Despensa compartida: CRUD de ingredientes, vincular usuarios por invite code
- [x] **Fase 3** — Sugerencias de recetas con OpenAI (incluyendo recetas con 1-3 ingredientes faltantes)
- [ ] **Fase 4** — Pulido UX: lista de compras, historial, filtros
- [ ] **Fase 5** — Extras: contexto de país, dificultad, soporte para más de 2 usuarios

## Estructura de carpetas

```
src/
  lib/supabase.js     ← cliente de Supabase, se importa donde se necesite
  pages/              ← una página = una ruta
  components/         ← componentes reutilizables entre páginas
  App.jsx             ← rutas + manejo de sesión global
```

## Convenciones

- Rutas protegidas con `PrivateRoute` / `PublicRoute` en `App.jsx`
- La sesión se maneja con `supabase.auth.onAuthStateChange` en `App.jsx` y se pasa como prop
- Variables de entorno con prefijo `VITE_` para que Vite las exponga al cliente
- `.env.local` nunca va a Git (cubierto por `*.local` en `.gitignore`)
