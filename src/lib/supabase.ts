import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// Mismo proyecto Supabase que usa la versión web de Cursada.
// Las tablas, RLS policies y usuarios ya existentes se conservan tal cual.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copiá .env.example a .env y completá los valores."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// getUser() valida el JWT contra el servidor (a diferencia de getSession(),
// que sólo lee lo cacheado en el dispositivo) — es el punto correcto para
// detectar una sesión persistida que ya no corresponde a ningún usuario
// real (caso real: usuario borrado a mano desde Supabase con la sesión
// todavía en el dispositivo; ver useSession.ts). Cerramos sesión local ante
// cualquier error de auth para que el resto de la app deje de reintentar
// contra una sesión rota y el guard de rutas mande a /login, en vez de
// fallar en silencio (o con un throw sin atrapar) en cada pantalla que
// necesita el user id.
export async function usuarioActual() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    await supabase.auth.signOut().catch(() => {});
    return null;
  }
  return data.user;
}
