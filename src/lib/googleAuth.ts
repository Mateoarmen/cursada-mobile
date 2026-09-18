import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { supabase } from "@/lib/supabase";

// Mismo flujo que la web (signInWithOAuth con provider: google), pero sin
// redirect de navegador propio: abrimos la URL de Supabase en una sesión de
// auth nativa (openAuthSessionAsync) y, al volver, seteamos la sesión a mano
// con los tokens que vienen en el hash de la URL de retorno.
const redirectTo = makeRedirectUri();

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("No se pudo iniciar el login con Google.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === "cancel" || result.type === "dismiss") {
    throw new Error("access_denied");
  }
  if (result.type !== "success" || !result.url) {
    throw new Error("No se pudo completar el login con Google.");
  }

  const { params, errorCode } = QueryParams.getQueryParams(result.url);
  if (errorCode) throw new Error(errorCode);
  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) {
    throw new Error("No se pudo completar el login con Google.");
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token,
    refresh_token,
  });
  if (sessionError) throw sessionError;
}

export function googleRedirectUri() {
  return redirectTo;
}
