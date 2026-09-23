import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { signInWithGoogle } from "@/lib/googleAuth";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText, BrandMark, GoogleButton, PickerField, PressableScale, PrimaryButton } from "@/components/ui";
import {
  aniosNacimiento,
  calcularTelefono,
  fechaNacimientoISO,
  MESES_NACIMIENTO,
  paisPorIso,
  PAISES_TEL,
  traducirErrorAuth,
} from "@/lib/authErrors";

type Mode = "signin" | "signup";
type Panel = "form" | "check-email" | "forgot" | "forgot-sent";

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

function makeInputStyle(colors: ReturnType<typeof useTheme>["colors"]) {
  return {
    height: 50,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    color: colors.text,
    fontFamily: "InstrumentSans_400Regular",
  } as const;
}

const DIAS_OPTS = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
const MESES_OPTS = MESES_NACIMIENTO.map((m) => ({ value: String(m.value), label: m.label }));
const ANIOS_OPTS = aniosNacimiento().map((y) => ({ value: String(y), label: String(y) }));
const PAISES_OPTS = PAISES_TEL.map((p) => ({ value: p.iso, label: `${p.bandera} ${p.nombre} (${p.prefijo})` }));

export default function LoginScreen() {
  const { colors } = useTheme();
  const inputStyle = useMemo(() => makeInputStyle(colors), [colors]);
  // Preseleccionado desde app/intro/index.tsx ("Ya tengo cuenta" / "Comencemos
  // el viaje" ya saben a qué modo apuntar) — cualquier otro valor cae en
  // signin, mismo default que si se entra directo a /login sin param.
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(modeParam === "signup" ? "signup" : "signin");
  const [panel, setPanel] = useState<Panel>("form");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [nacDia, setNacDia] = useState("");
  const [nacMes, setNacMes] = useState("");
  const [nacAnio, setNacAnio] = useState("");
  const [telPais, setTelPais] = useState("UY");
  const [telefono, setTelefono] = useState("");

  const [checkEmail, setCheckEmail] = useState("");
  const [resendInfo, setResendInfo] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);

  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotSentEmail, setForgotSentEmail] = useState("");

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  const handleGoogle = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      // setSession() dispara onAuthStateChange y la navegación ya está
      // manejada en useSession/_layout.tsx.
    } catch (e) {
      setError(traducirErrorAuth(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError("Completá tu email y contraseña.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const birthDate = fechaNacimientoISO(nacDia ? Number(nacDia) : null, nacMes ? Number(nacMes) : null, nacAnio ? Number(nacAnio) : null);
        const tel = calcularTelefono(telPais, telefono.trim());
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              nombre: nombre.trim(),
              apellido: apellido.trim(),
              birth_date: birthDate,
              telefono_e164: tel.telefonoE164,
              telefono_pais: tel.telefonoPais,
            },
          },
        });
        if (signUpError) throw signUpError;
        if (data && !data.session) {
          setCheckEmail(email.trim());
          setResendInfo(null);
          setPanel("check-email");
        }
        // Con sesión inmediata (confirmación de email desactivada), el
        // listener de useSession dispara la navegación sola (ver _layout.tsx).
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      }
    } catch (e) {
      setError(traducirErrorAuth(e));
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setResendBusy(true);
    try {
      const { error: resendError } = await supabase.auth.resend({ type: "signup", email: checkEmail });
      if (resendError) throw resendError;
      setResendInfo("Listo, te lo volvimos a mandar.");
    } catch (e) {
      setResendInfo(traducirErrorAuth(e));
    } finally {
      setResendBusy(false);
    }
  };

  const handleForgotOpen = () => {
    setForgotError(null);
    setForgotEmail(email.trim());
    setPanel("forgot");
  };

  const handleForgotSubmit = async () => {
    setForgotError(null);
    if (!forgotEmail.trim()) {
      setForgotError("Ingresá tu email.");
      return;
    }
    setForgotBusy(true);
    try {
      const { error: forgotErr } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), { redirectTo: "cursada://reset-password" });
      if (forgotErr) throw forgotErr;
      setForgotSentEmail(forgotEmail.trim());
      setPanel("forgot-sent");
    } catch (e) {
      setForgotError(traducirErrorAuth(e));
    } finally {
      setForgotBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xxl, paddingVertical: spacing.xxl, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
          {panel === "form" ? (
            <>
              <View style={{ alignItems: "center", gap: spacing.sm, paddingBottom: spacing.md }}>
                <BrandMark size={56} />
                <AppText weight="700" style={{ fontSize: 26, letterSpacing: -0.5, color: colors.text }}>
                  cursada
                </AppText>
                <AppText style={{ fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: "center", maxWidth: 280 }}>
                  Gestión académica personal — con cuenta, sincronizada entre tus dispositivos.
                </AppText>
              </View>

              <GoogleButton label="Continuar con Google" onPress={handleGoogle} disabled={busy} />

              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.smd, paddingVertical: spacing.xs }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <AppText style={{ fontSize: 12, color: colors.textFaint }}>o con tu email</AppText>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>

              <View style={{ height: 40, borderRadius: radii.sm, backgroundColor: colors.surfaceSofter, padding: 3, flexDirection: "row", gap: 3 }}>
                {(["signin", "signup"] as const).map((m) => (
                  <PressableScale
                    key={m}
                    scaleTo={0.98}
                    onPress={() => switchMode(m)}
                    style={{ flex: 1, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: mode === m ? colors.text : "transparent" }}
                  >
                    <AppText weight={mode === m ? "600" : "500"} style={{ fontSize: 14, color: mode === m ? colors.bg : colors.textSecondary }}>
                      {m === "signin" ? "Iniciar sesión" : "Crear cuenta"}
                    </AppText>
                  </PressableScale>
                ))}
              </View>

              <TextInput
                style={inputStyle}
                placeholder="tu@email.com"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={inputStyle}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor={colors.textFaint}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              {mode === "signin" ? (
                <PressableScale scaleTo={0.98} onPress={handleForgotOpen} style={{ alignSelf: "flex-end", marginTop: -spacing.sm }}>
                  <AppText weight="500" style={{ fontSize: 13, color: colors.accentText }}>
                    ¿Olvidaste tu contraseña?
                  </AppText>
                </PressableScale>
              ) : null}

              {mode === "signup" ? (
                <View style={{ gap: spacing.md }}>
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
                </View>
              ) : null}

              {error ? (
                <AppText style={{ fontSize: 13, color: colors.dangerText, textAlign: "center" }}>{error}</AppText>
              ) : null}

              <PrimaryButton label={mode === "signup" ? "Crear cuenta" : "Iniciar sesión"} onPress={handleSubmit} disabled={busy} style={{ marginTop: spacing.xs }} />
            </>
          ) : null}

          {panel === "check-email" ? (
            <View style={{ gap: spacing.lg, alignItems: "center", paddingTop: spacing.xxxl }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentSofter, alignItems: "center", justifyContent: "center" }}>
                <AppText style={{ fontSize: 28 }}>✉</AppText>
              </View>
              <AppText weight="700" style={{ fontSize: 21, textAlign: "center" }}>
                Confirmá tu cuenta
              </AppText>
              <AppText style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 }}>
                Te mandamos un mail a <AppText weight="600" style={{ fontSize: 14 }}>{checkEmail}</AppText> con un link para confirmar tu cuenta. Abrilo (revisá spam si no
                aparece) y después volvé acá.
              </AppText>
              {resendInfo ? <AppText style={{ fontSize: 13, color: colors.textTertiary, textAlign: "center" }}>{resendInfo}</AppText> : null}
              <PrimaryButton label="Reenviar mail" variant="ghost" onPress={handleResend} disabled={resendBusy} style={{ width: "100%" }} />
              <PrimaryButton
                label="Ya confirmé, iniciar sesión"
                style={{ width: "100%" }}
                onPress={() => {
                  setPanel("form");
                  setMode("signin");
                  setEmail(checkEmail);
                  setPassword("");
                }}
              />
            </View>
          ) : null}

          {panel === "forgot" ? (
            <View style={{ gap: spacing.lg }}>
              <AppText weight="700" style={{ fontSize: 21 }}>
                Recuperar contraseña
              </AppText>
              <AppText style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>
                Ingresá tu email y, si existe una cuenta con ese email, te mandamos un link para elegir una contraseña nueva.
              </AppText>
              <TextInput
                style={inputStyle}
                placeholder="tu@email.com"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={forgotEmail}
                onChangeText={setForgotEmail}
              />
              {forgotError ? <AppText style={{ fontSize: 13, color: colors.dangerText, textAlign: "center" }}>{forgotError}</AppText> : null}
              <PrimaryButton label="Mandar link de recuperación" onPress={handleForgotSubmit} disabled={forgotBusy} />
              <PrimaryButton label="Volver a iniciar sesión" variant="ghost" onPress={() => setPanel("form")} />
            </View>
          ) : null}

          {panel === "forgot-sent" ? (
            <View style={{ gap: spacing.lg, alignItems: "center", paddingTop: spacing.xxxl }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentSofter, alignItems: "center", justifyContent: "center" }}>
                <AppText style={{ fontSize: 28 }}>✉</AppText>
              </View>
              <AppText weight="700" style={{ fontSize: 21, textAlign: "center" }}>
                Revisá tu email
              </AppText>
              <AppText style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 }}>
                Si existe una cuenta con <AppText weight="600" style={{ fontSize: 14 }}>{forgotSentEmail}</AppText>, te mandamos un link para elegir una contraseña nueva
                (revisá spam si no aparece).
              </AppText>
              <PrimaryButton label="Volver a iniciar sesión" style={{ width: "100%" }} onPress={() => setPanel("form")} />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
