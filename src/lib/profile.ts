// Puerto de subirAvatar()/comprimirImagenAAvatar() de runtime.js: recorta a
// cuadrado y comprime antes de subir, mismo bucket ('avatars') y mismo
// path (`${userId}/avatar.jpg`, upsert) — así una cuenta ve la misma foto
// en la web y en la app. El recorte a cuadrado lo hace el picker nativo
// (allowsEditing + aspect 1:1) en vez del canvas manual que usa la web.
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";

const AVATAR_SIZE = 256;

export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const resized = await ImageManipulator.manipulate(localUri).resize({ width: AVATAR_SIZE, height: AVATAR_SIZE }).renderAsync();
  const saved = await resized.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });

  const response = await fetch(saved.uri);
  const arrayBuffer = await response.arrayBuffer();

  const path = `${userId}/avatar.jpg`;
  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, arrayBuffer, { upsert: true, contentType: "image/jpeg" });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Mismo path entre subidas — el query param evita que quede cacheada la
  // foto vieja en el <Image> (mismo truco que la web).
  const fotoUrl = `${data.publicUrl}?t=${Date.now()}`;

  const { error: updateError } = await supabase.from("profiles").update({ foto_url: fotoUrl }).eq("id", userId);
  if (updateError) throw updateError;

  return fotoUrl;
}

// Partial: app/perfil.tsx (edición completa desde Perfil) sigue mandando
// todos los campos, pero app/onboarding/perfil.tsx (alta inicial de cuentas
// Google) ya no pide universidad/carrera ahí — eso se pregunta como primer
// paso del wizard (ver app/onboarding/wizard.tsx) — así que sólo manda
// nombre/apellido/nacimiento/teléfono.
export type ProfilePatch = Partial<
  Pick<Profile, "nombre" | "apellido" | "birth_date" | "carrera" | "telefono_e164" | "telefono_pais" | "university_id" | "university_other">
>;

export async function saveProfile(userId: string, patch: ProfilePatch): Promise<void> {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}
