import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";
import { useOnboardingStatusContext } from "@/hooks/OnboardingStatusContext";
import { saveProfile } from "@/lib/profile";
import { aniosNacimiento, calcularTelefono, fechaNacimientoISO, MESES_NACIMIENTO, paisPorIso, PAISES_TEL } from "@/lib/authErrors";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText, BrandMark, PickerField, PrimaryButton, PressableScale, Reveal } from "@/components/ui";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <AppText weight="500" style={{ fontSize: 12, color: colors.textTertiary }}>
        {label}
      </AppText>
      {children}
    </View>
  );
}

const DIAS_OPTS = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
const MESES_OPTS = MESES_NACIMIENTO.map((m) => ({ value: String(m.value), label: m.label }));
const ANIOS_OPTS = aniosNacimiento().map((y) => ({ value: String(y), label: String(y) }));
const PAISES_OPTS = PAISES_TEL.map((p) => ({ value: p.iso, label: `${p.bandera} ${p.nombre} (${p.prefijo})` }));

// Paso previo al onboarding normal (índice/wizard), sólo para cuentas que
// llegan sin haber pasado por el formulario de alta — hoy, Google: el
// trigger handle_new_user les crea el profile con nombre/apellido vacíos y
// university_id null (ver raw_user_meta_data de Google: name/email/picture,
// nada de nuestros campos), así que sin este paso caían derecho en
// app/onboarding/index.tsx sin haber elegido ni universidad ni cargado su
// nombre — el gate está en ese índice (profile.nombre vacío → acá).
export default function OnboardingPerfilScreen() {
  const { colors } = useTheme();
  const { session } = useSession();
  const status = useOnboardingStatusContext();
  const userId = session?.user?.id;

  const inputStyle = useMemo(
    () =>
      ({
        height: 50,
        borderRadius: radii.sm,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.lg,
        fontSize: 15,
        color: colors.text,
        fontFamily: "InstrumentSans_400Regular",
      }) as const,
    [colors]
  );

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [nacDia, setNacDia] = useState("");
  const [nacMes, setNacMes] = useState("");
  const [nacAnio, setNacAnio] = useState("");
  const [telPais, setTelPais] = useState("UY");
  const [telefono, setTelefono] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Precarga lo que ya trajo el metadata de Google (nombre, email) para
    // no pedirle de nuevo lo que ya sabemos — pero nunca lo pisa una vez
    // que el usuario empezó a tocar el campo.
    const meta = session?.user?.user_metadata as Record<string, string> | undefined;
    if (meta?.name && !nombre && !apellido) {
      const [first, ...rest] = meta.name.trim().split(/\s+/);
      setNombre(first ?? "");
      setApellido(rest.join(" "));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const continuar = async () => {
    setError(null);
    if (!nombre.trim() || !apellido.trim()) {
      setError("Completá tu nombre y apellido para continuar.");
      return;
    }
    if (!userId) {
      setError("No hay sesión.");
      return;
    }
    setBusy(true);
    try {
      const birthDate = fechaNacimientoISO(nacDia ? Number(nacDia) : null, nacMes ? Number(nacMes) : null, nacAnio ? Number(nacAnio) : null);
      const tel = calcularTelefono(telPais, telefono.trim());
      await saveProfile(userId, {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        birth_date: birthDate,
        telefono_e164: tel.telefonoE164,
        telefono_pais: tel.telefonoPais,
      });
      await status.refresh();
      router.replace("/onboarding");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar tus datos — revisá tu conexión e intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          <Reveal style={{ gap: spacing.lg }}>
            <View style={{ alignItems: "center", gap: spacing.md, paddingBottom: spacing.sm }}>
              <BrandMark size={48} />
              <AppText weight="700" style={{ fontSize: 22, letterSpacing: -0.3, textAlign: "center" }}>
                Completá tus datos
              </AppText>
              <AppText style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: "center" }}>
                Con Google no pedimos esto al crear la cuenta — lo necesitamos para armar tu semestre.
              </AppText>
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <TextInput style={inputStyle} placeholder="Nombre" placeholderTextColor={colors.textFaint} value={nombre} onChangeText={setNombre} />
              </View>
              <View style={{ flex: 1 }}>
                <TextInput style={inputStyle} placeholder="Apellido" placeholderTextColor={colors.textFaint} value={apellido} onChangeText={setApellido} />
              </View>
            </View>

            <Field label="Fecha de nacimiento (opcional)">
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <PickerField compact label="Día" value={nacDia} placeholder="Día" options={DIAS_OPTS} onSelect={setNacDia} />
                <View style={{ flex: 1.6 }}>
                  <PickerField label="Mes" value={nacMes} placeholder="Mes" options={MESES_OPTS} onSelect={setNacMes} />
                </View>
                <View style={{ flex: 1.2 }}>
                  <PickerField label="Año" value={nacAnio} placeholder="Año" options={ANIOS_OPTS} onSelect={setNacAnio} />
                </View>
              </View>
            </Field>

            <Field label="Teléfono (opcional)">
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <View style={{ width: 108 }}>
                  <PickerField label="País" value={telPais} placeholder="País" options={PAISES_OPTS} onSelect={setTelPais} />
                </View>
                <TextInput
                  style={[inputStyle, { flex: 1, height: 48 }]}
                  placeholder={`Ej: ${paisPorIso(telPais).prefijo} 99 123 456`}
                  placeholderTextColor={colors.textFaint}
                  keyboardType="phone-pad"
                  value={telefono}
                  onChangeText={setTelefono}
                />
              </View>
            </Field>

            {error ? (
              <AppText style={{ fontSize: 13, color: colors.dangerText, textAlign: "center" }}>{error}</AppText>
            ) : null}
          </Reveal>
        </ScrollView>
      </KeyboardAvoidingView>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md,
          paddingBottom: spacing.xxl,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.borderFaint,
        }}
      >
        <PrimaryButton label={busy ? "Guardando…" : "Continuar"} onPress={continuar} disabled={busy} />
      </View>
    </SafeAreaView>
  );
}
