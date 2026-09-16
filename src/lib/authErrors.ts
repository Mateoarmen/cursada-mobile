// Puerto de traducirErrorAuth() + helpers de teléfono/país/fecha de
// nacimiento del formulario de registro en runtime.js — mismos mensajes en
// español, mismo criterio "mejor esfuerzo" para el teléfono (sin
// libphonenumber-js: no es una dependencia de este proyecto RN).

export function traducirErrorAuth(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (/Invalid login credentials/i.test(msg)) return "Email o contraseña incorrectos.";
  if (/Email not confirmed/i.test(msg)) return "Todavía no confirmaste tu email — revisá tu casilla (y spam) y tocá el link que te mandamos.";
  if (/already registered/i.test(msg)) return "Ya existe una cuenta con ese email — probá iniciar sesión.";
  if (/Password should be at least/i.test(msg)) return "La contraseña tiene que tener al menos 6 caracteres.";
  if (/invalid.*email/i.test(msg)) return "Ese email no parece válido.";
  if (/rate limit/i.test(msg)) return "Demasiados intentos — esperá un minuto y probá de nuevo.";
  if (/provider is not enabled/i.test(msg)) return "El login con Google todavía no está habilitado en el proyecto.";
  if (/otp_expired|email link is invalid or has expired/i.test(msg)) return 'Ese link venció o ya se usó — pedí uno nuevo desde "¿Olvidaste tu contraseña?".';
  if (/access_denied/i.test(msg)) return "Cancelaste el inicio de sesión con Google.";
  return msg || "No se pudo completar la operación. Revisá tu conexión a internet.";
}

// Uruguay primero (default) — mismo criterio que PAISES_TEL en runtime.js:
// pensado para estudiantes de la región + destinos de intercambio comunes,
// no la lista completa de países del mundo.
export const PAISES_TEL = [
  { iso: "UY", nombre: "Uruguay", prefijo: "+598", bandera: "🇺🇾" },
  { iso: "AR", nombre: "Argentina", prefijo: "+54", bandera: "🇦🇷" },
  { iso: "BR", nombre: "Brasil", prefijo: "+55", bandera: "🇧🇷" },
  { iso: "CL", nombre: "Chile", prefijo: "+56", bandera: "🇨🇱" },
  { iso: "PY", nombre: "Paraguay", prefijo: "+595", bandera: "🇵🇾" },
  { iso: "BO", nombre: "Bolivia", prefijo: "+591", bandera: "🇧🇴" },
  { iso: "PE", nombre: "Perú", prefijo: "+51", bandera: "🇵🇪" },
  { iso: "EC", nombre: "Ecuador", prefijo: "+593", bandera: "🇪🇨" },
  { iso: "CO", nombre: "Colombia", prefijo: "+57", bandera: "🇨🇴" },
  { iso: "VE", nombre: "Venezuela", prefijo: "+58", bandera: "🇻🇪" },
  { iso: "MX", nombre: "México", prefijo: "+52", bandera: "🇲🇽" },
  { iso: "ES", nombre: "España", prefijo: "+34", bandera: "🇪🇸" },
  { iso: "US", nombre: "Estados Unidos", prefijo: "+1", bandera: "🇺🇸" },
] as const;

export type PaisTelIso = (typeof PAISES_TEL)[number]["iso"];

export function paisPorIso(iso: string) {
  return PAISES_TEL.find((p) => p.iso === iso) ?? PAISES_TEL[0];
}

// Sin libphonenumber-js (no está entre las dependencias): guarda un E.164
// "mejor esfuerzo" (prefijo + dígitos) — mismo fallback que ya usa la web
// cuando la librería no cargó (CDN caído/offline).
export function calcularTelefono(paisIso: string, valorInput: string): { telefonoE164: string | null; telefonoPais: string | null } {
  const digits = (valorInput || "").replace(/[^\d]/g, "");
  if (!digits) return { telefonoE164: null, telefonoPais: null };
  return { telefonoE164: paisPorIso(paisIso).prefijo + digits, telefonoPais: paisIso };
}

const MESES_LARGOS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "setiembre", "octubre", "noviembre", "diciembre",
];

export const MESES_NACIMIENTO = MESES_LARGOS.map((m, i) => ({ value: i + 1, label: m.charAt(0).toUpperCase() + m.slice(1) }));

// 15 a 100 años — mismo rango que valida el check constraint en Supabase.
export function aniosNacimiento(): number[] {
  const actual = new Date().getFullYear();
  const out: number[] = [];
  for (let y = actual - 15; y >= actual - 100; y--) out.push(y);
  return out;
}

export function fechaNacimientoISO(dia: number | null, mes: number | null, anio: number | null): string | null {
  if (!dia || !mes || !anio) return null;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function nacimientoDesdeISO(iso: string | null): { dia: string; mes: string; anio: string } {
  if (!iso) return { dia: "", mes: "", anio: "" };
  const [anio, mes, dia] = iso.split("-");
  return { dia: String(Number(dia)), mes: String(Number(mes)), anio };
}

// Sin libphonenumber-js: mismo "mejor esfuerzo" que calcularTelefono() para
// desarmar el E.164 guardado y mostrar sólo el número nacional en el input
// (el prefijo ya lo muestra el select de país aparte, igual que en la web).
export function telefonoNacionalDesdeE164(e164: string | null, paisIso: string | null): string {
  if (!e164) return "";
  const prefijo = paisPorIso(paisIso ?? "UY").prefijo;
  return e164.indexOf(prefijo) === 0 ? e164.slice(prefijo.length).trim() : e164;
}
