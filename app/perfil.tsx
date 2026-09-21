import { useEffect, useMemo, useRef, useState } from "react";
import { router } from "expo-router";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";
import { useOnboardingStatusContext } from "@/hooks/OnboardingStatusContext";
import { catCarrerasDe, type CatCarrera } from "@/lib/catalog";
import { saveProfile, uploadAvatar } from "@/lib/profile";
import {
  aniosNacimiento,
  calcularTelefono,
  fechaNacimientoISO,
  MESES_NACIMIENTO,
  nacimientoDesdeISO,
  paisPorIso,
  PAISES_TEL,
  telefonoNacionalDesdeE164,
} from "@/lib/authErrors";
import type { University } from "@/types/database";
import { radii, spacing } from "@/theme/tokens";
import { useTheme, type ThemePreference } from "@/theme/ThemeContext";
import { AppIcon, AppText, Avatar, BackButton, BottomSheet, PickerField, PressableScale, PrimaryButton, Switch } from "@/components/ui";
import { agendaDeSemestre } from "@/lib/materias";
import { getSemestreActivoId } from "@/lib/semestres";
import {
  configurarCanalAndroid,
  DEFAULT_NOTIF_PREFS,
  ensureNotifPermission,
  getNotifPrefs,
  setNotifPrefs,
  sincronizarNotificaciones,
  type NotifPrefs,
} from "@/lib/notifications";

const APARIENCIA_OPTS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

const NOTIF_ROWS: { key: keyof NotifPrefs; label: string }[] = [
  { key: "evaluaciones", label: "Evaluaciones" },
  { key: "tareas", label: "Tareas" },
  { key: "clases", label: "Clases" },
];

// Re-sincroniza toda la cola de recordatorios locales con lo que haya
// cambiado acá — Perfil no tiene ya cargados materias/agenda (a
// diferencia de Inicio, que lo hace en cada foco), así que trae lo mínimo
// necesario en el momento en vez de duplicar ese estado.
async function resincronizarNotificaciones(prefs: NotifPrefs) {
  const [{ data: materiasAll }, { data: agendaAll }, activeId] = await Promise.all([
    supabase.from("materias").select("*"),
    supabase.from("agenda").select("*"),
    getSemestreActivoId(),
  ]);
  const materias = materiasAll ?? [];
  const agenda = agendaAll ?? [];
  await configurarCanalAndroid();
  await sincronizarNotificaciones(
    prefs,
    agendaDeSemestre(agenda, materias, activeId),
    materias.filter((m) => m.semestre_id === activeId)
  );
}

const DIAS_OPTS = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
const MESES_OPTS = MESES_NACIMIENTO.map((m) => ({ value: String(m.value), label: m.label }));
const ANIOS_OPTS = aniosNacimiento().map((y) => ({ value: String(y), label: String(y) }));
const PAISES_OPTS = PAISES_TEL.map((p) => ({ value: p.iso, label: `${p.bandera} ${p.nombre} (${p.prefijo})` }));

function makeInputStyle(colors: ReturnType<typeof useTheme>["colors"]) {
  return {
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    color: colors.text,
    fontFamily: "InstrumentSans_400Regular",
  } as const;
}

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.md }}>
      <AppText weight="600" style={{ fontSize: 13, color: colors.textTertiary }}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

function SettingsRow({
  label,
  value,
  onPress,
  last,
  toggle,
  checked,
  onToggle,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
  toggle?: boolean;
  checked?: boolean;
  onToggle?: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  // Sin destino ni toggle: no se dibuja un chevron que promete algo que no
  // pasa — mismo criterio que "Pronto" en los accesos deshabilitados de
  // Inicio.
  const pendiente = !toggle && !onPress;
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={toggle ? () => onToggle?.(!checked) : onPress}
      disabled={pendiente}
      accessible={!toggle}
      accessibilityRole={toggle ? undefined : "button"}
      accessibilityLabel={pendiente ? `${label} (pronto)` : undefined}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing.md,
        minHeight: 52,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.borderFaint,
      }}
    >
      <AppText weight="500" style={{ fontSize: 16, color: pendiente ? colors.textTertiary : colors.text }}>
        {label}
      </AppText>
      {toggle ? (
        <Switch value={!!checked} onValueChange={onToggle} accessibilityLabel={label} />
      ) : pendiente ? (
        <AppText weight="600" style={{ fontSize: 12, color: colors.textFaint }}>
          Pronto
        </AppText>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {value ? (
            <AppText style={{ fontSize: 15, color: colors.textTertiary }}>{value}</AppText>
          ) : null}
          <AppIcon name="chevron-forward" size={14} color={colors.textGhost} />
        </View>
      )}
    </PressableScale>
  );
}

export default function PerfilScreen() {
  const { colors, preference, setPreference } = useTheme();
  const inputStyle = useMemo(() => makeInputStyle(colors), [colors]);
  const [aparienciaAbierta, setAparienciaAbierta] = useState(false);
  const aparienciaLabel = APARIENCIA_OPTS.find((o) => o.value === preference)?.label ?? "Sistema";
  const [notifPrefs, setNotifPrefsState] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);

  useEffect(() => {
    getNotifPrefs().then(setNotifPrefsState);
  }, []);

  const handleToggleNotif = async (key: keyof NotifPrefs, next: boolean) => {
    if (next) {
      const permitido = await ensureNotifPermission();
      if (!permitido) {
        Alert.alert("Notificaciones desactivadas", "Activá los permisos de notificaciones para Cursada en Ajustes del sistema.");
        return;
      }
    }
    const updated = { ...notifPrefs, [key]: next };
    setNotifPrefsState(updated);
    await setNotifPrefs(updated);
    resincronizarNotificaciones(updated).catch(() => {});
  };

  const { session } = useSession();
  // Sólo se lee `profile` de acá — el `refresh()` de este contexto también
  // dispara el `loading` que usa _layout.tsx para decidir si desmontar todo
  // el navegador (gate de sesión/onboarding), así que llamarlo después de
  // guardar tira al usuario de vuelta a las tabs en vez de dejarlo en
  // Perfil. El estado local del formulario ya refleja lo guardado, así que
  // no hace falta releer el perfil compartido acá.
  const { profile } = useOnboardingStatusContext();
  const userId = session?.user?.id;
  const email = session?.user?.email ?? "";

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [nacDia, setNacDia] = useState("");
  const [nacMes, setNacMes] = useState("");
  const [nacAnio, setNacAnio] = useState("");
  const [telPais, setTelPais] = useState("UY");
  const [telefono, setTelefono] = useState("");
  const [universidades, setUniversidades] = useState<University[]>([]);
  const [universidadId, setUniversidadId] = useState("");
  const [universidadOtra, setUniversidadOtra] = useState("");
  const [carreras, setCarreras] = useState<CatCarrera[]>([]);
  const [carrera, setCarrera] = useState("");
  const [carreraEsOtra, setCarreraEsOtra] = useState(true);

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editando, setEditando] = useState(false);

  const initialized = useRef(false);

  // Precarga el formulario una única vez, cuando el perfil llega del
  // contexto compartido — igual que openPerfilModal() en la web. Después de
  // esa carga inicial no se vuelve a pisar el formulario (aunque el
  // contexto se refresque) para no perder una edición en curso.
  useEffect(() => {
    if (initialized.current || !profile) return;
    initialized.current = true;
    setNombre(profile.nombre ?? "");
    setApellido(profile.apellido ?? "");
    const nac = nacimientoDesdeISO(profile.birth_date);
    setNacDia(nac.dia);
    setNacMes(nac.mes);
    setNacAnio(nac.anio);
    setTelPais(profile.telefono_pais ?? "UY");
    setTelefono(telefonoNacionalDesdeE164(profile.telefono_e164, profile.telefono_pais));
    setUniversidadId(profile.university_id ?? (profile.university_other ? "otra" : ""));
    setUniversidadOtra(profile.university_other ?? "");
    setCarrera(profile.carrera ?? "");
    setAvatarUri(profile.foto_url ?? null);
  }, [profile]);

  useEffect(() => {
    if (universidades.length) return;
    supabase
      .from("universities")
      .select("*")
      .order("nombre")
      .then(({ data }) => setUniversidades((data as University[]) ?? []));
  }, [universidades.length]);

  useEffect(() => {
    if (!universidadId || universidadId === "otra") {
      setCarreras([]);
      setCarreraEsOtra(true);
      return;
    }
    catCarrerasDe(universidadId)
      .then((c) => {
        setCarreras(c);
        setCarreraEsOtra(c.length > 0 ? !c.some((x) => x.nombre === carrera) : true);
      })
      .catch(() => {
        setCarreras([]);
        setCarreraEsOtra(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [universidadId]);

  const universidadOpts = useMemo(
    () => [...universidades.map((u) => ({ value: u.id, label: u.nombre })), { value: "otra", label: "Otra…" }],
    [universidades]
  );
  const carreraOpts = useMemo(
    () => [...carreras.map((c) => ({ value: c.id, label: c.nombre + (c.plan_version ? ` — ${c.plan_version}` : "") })), { value: "__otra__", label: "No está en la lista" }],
    [carreras]
  );
  const carreraIdSeleccionado = carreras.find((c) => c.nombre === carrera)?.id ?? "";

  const initial = (nombre || email || "?")[0]!.toUpperCase();
  const nombreCompleto = [nombre, apellido].filter(Boolean).join(" ").trim();

  const handleLogout = async () => {
    Alert.alert("Cerrar sesión", "¿Seguro que querés cerrar sesión?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: () => supabase.auth.signOut(),
      },
    ]);
  };

  const handleCambiarFoto = async () => {
    if (!userId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permiso necesario", "Activá el acceso a tus fotos en Ajustes para cambiar tu foto de perfil.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (result.canceled || !result.assets[0]) return;
    setAvatarBusy(true);
    try {
      const fotoUrl = await uploadAvatar(userId, result.assets[0].uri);
      setAvatarUri(fotoUrl);
    } catch (e) {
      Alert.alert("No se pudo subir la foto", e instanceof Error ? e.message : "Revisá tu conexión e intentá de nuevo.");
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleGuardar = async () => {
    if (!userId) return;
    setSaving(true);
    setSaved(false);
    try {
      const tel = calcularTelefono(telPais, telefono.trim());
      await saveProfile(userId, {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        birth_date: fechaNacimientoISO(nacDia ? Number(nacDia) : null, nacMes ? Number(nacMes) : null, nacAnio ? Number(nacAnio) : null),
        carrera: carrera.trim(),
        telefono_e164: tel.telefonoE164,
        telefono_pais: tel.telefonoPais,
        university_id: universidadId && universidadId !== "otra" ? universidadId : null,
        university_other: universidadId === "otra" ? universidadOtra.trim() : null,
      });
      // Éxito silencioso — sin toast, sólo el botón confirma un instante
      // (ver design system, sección Motion).
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      Alert.alert("No se pudieron guardar los cambios", e instanceof Error ? e.message : "Revisá tu conexión e intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <BackButton />
        <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2 }}>
          Perfil
        </AppText>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xxl }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm }}>
            <PressableScale
              scaleTo={0.95}
              onPress={handleCambiarFoto}
              disabled={avatarBusy}
              accessibilityRole="button"
              accessibilityLabel="Cambiar foto de perfil"
              style={{ opacity: avatarBusy ? 0.5 : 1 }}
            >
              <Avatar uri={avatarUri} initial={initial} size={88} fontSize={32} />
            </PressableScale>
            <View style={{ alignItems: "center", gap: spacing.xxs }}>
              <AppText weight="700" style={{ fontSize: 24, letterSpacing: -0.5 }}>
                {nombreCompleto || email || "Tu cuenta"}
              </AppText>
              {nombreCompleto && email ? <AppText style={{ fontSize: 14, color: colors.textTertiary }}>{email}</AppText> : null}
            </View>
            {avatarBusy ? (
              <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Subiendo foto…</AppText>
            ) : (
              <PressableScale
                scaleTo={0.98}
                onPress={() => setEditando((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ expanded: editando }}
                style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.lg }}
              >
                <AppText weight="600" style={{ fontSize: 15, color: colors.accentText }}>
                  {editando ? "Ocultar" : "Editar perfil"}
                </AppText>
              </PressableScale>
            )}
          </View>

          {editando ? (
            <>
              <Section title="Datos personales">
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Nombre" placeholderTextColor={colors.textFaint} value={nombre} onChangeText={setNombre} />
                  <TextInput style={[inputStyle, { flex: 1 }]} placeholder="Apellido" placeholderTextColor={colors.textFaint} value={apellido} onChangeText={setApellido} />
                </View>

                <Field label="Fecha de nacimiento">
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

                <Field label="Teléfono">
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <View style={{ width: 108 }}>
                      <PickerField label="País" value={telPais} placeholder="País" options={PAISES_OPTS} onSelect={setTelPais} />
                    </View>
                    <TextInput
                      style={[inputStyle, { flex: 1 }]}
                      placeholder={`Ej: ${paisPorIso(telPais).prefijo} 99 123 456`}
                      placeholderTextColor={colors.textFaint}
                      keyboardType="phone-pad"
                      value={telefono}
                      onChangeText={setTelefono}
                    />
                  </View>
                </Field>
              </Section>

              <Section title="Estudio">
                <Field label="Universidad">
                  <PickerField label="Universidad" value={universidadId} placeholder="Elegí tu universidad" options={universidadOpts} onSelect={setUniversidadId} />
                  {universidadId === "otra" ? (
                    <TextInput
                      style={[inputStyle, { marginTop: spacing.xs }]}
                      placeholder="Nombre de tu universidad"
                      placeholderTextColor={colors.textFaint}
                      value={universidadOtra}
                      onChangeText={setUniversidadOtra}
                    />
                  ) : null}
                </Field>

                <Field label="Carrera">
                  {!carreraEsOtra && carreras.length ? (
                    <PickerField
                      label="Carrera"
                      value={carreraIdSeleccionado}
                      placeholder="Elegí tu carrera"
                      options={carreraOpts}
                      onSelect={(v) => {
                        if (v === "__otra__") {
                          setCarreraEsOtra(true);
                          setCarrera("");
                        } else {
                          const c = carreras.find((x) => x.id === v);
                          setCarrera(c?.nombre ?? "");
                        }
                      }}
                    />
                  ) : (
                    <TextInput
                      style={inputStyle}
                      placeholder="Ej: Lic. en Administración de Empresas"
                      placeholderTextColor={colors.textFaint}
                      value={carrera}
                      onChangeText={setCarrera}
                    />
                  )}
                  {carreraEsOtra && carreras.length ? (
                    <PressableScale scaleTo={0.98} onPress={() => setCarreraEsOtra(false)}>
                      <AppText weight="500" style={{ fontSize: 12, color: colors.accentText, marginTop: 4 }}>
                        Elegir de la lista de {universidadOpts.find((o) => o.value === universidadId)?.label}
                      </AppText>
                    </PressableScale>
                  ) : null}
                </Field>
              </Section>

              <PrimaryButton label={saving ? "Guardando…" : saved ? "Guardado" : "Guardar cambios"} onPress={handleGuardar} disabled={saving} />
            </>
          ) : null}

          <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, overflow: "hidden" }}>
            <SettingsRow label="Semestre activo" onPress={() => router.push("/semestre-activo")} />
            <SettingsRow label="Apariencia" value={aparienciaLabel} onPress={() => setAparienciaAbierta(true)} last />
          </View>

          <View style={{ gap: spacing.md }}>
            <AppText weight="600" style={{ fontSize: 13, color: colors.textTertiary }}>
              Notificaciones
            </AppText>
            <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, overflow: "hidden" }}>
              {NOTIF_ROWS.map((r, i) => (
                <SettingsRow
                  key={r.key}
                  label={r.label}
                  toggle
                  checked={notifPrefs[r.key]}
                  onToggle={(v) => handleToggleNotif(r.key, v)}
                  last={i === NOTIF_ROWS.length - 1}
                />
              ))}
            </View>
          </View>

          <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, overflow: "hidden" }}>
            <SettingsRow label="Privacidad y datos" />
            <SettingsRow label="Ayuda" last />
          </View>

          <PrimaryButton label="Cerrar sesión" variant="danger" onPress={handleLogout} />
          <AppText mono style={{ fontSize: 12, color: colors.textGhost, textAlign: "center" }}>
            cursada 0.1.0
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheet visible={aparienciaAbierta} onClose={() => setAparienciaAbierta(false)}>
        <AppText weight="600" style={{ fontSize: 17 }}>
          Apariencia
        </AppText>
        {APARIENCIA_OPTS.map((o, i) => (
          <PressableScale
            key={o.value}
            scaleTo={0.99}
            onPress={() => {
              setPreference(o.value);
              setAparienciaAbierta(false);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: 52,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.borderFaint,
            }}
          >
            <AppText weight={preference === o.value ? "600" : "400"} style={{ fontSize: 15 }}>
              {o.label}
            </AppText>
            {preference === o.value ? <AppIcon name="checkmark" size={18} color={colors.accent} /> : null}
          </PressableScale>
        ))}
      </BottomSheet>
    </SafeAreaView>
  );
}
