import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { Materia } from "@/types/database";
import { colors, spacing } from "@/theme/tokens";
import { AppText, BackButton, PrimaryButton } from "@/components/ui";
import { actualizarMateria, eliminarMateria } from "@/lib/materias";
import { useMateriaFormState } from "@/hooks/useMateriaFormState";
import { MateriaBasicosFields } from "@/components/materia/MateriaBasicosFields";
import { MateriaCursadaFields } from "@/components/materia/MateriaCursadaFields";
import { MateriaCalificacionFields } from "@/components/materia/MateriaCalificacionFields";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.md }}>
      <AppText weight="600" style={{ fontSize: 13, letterSpacing: 0.3, color: colors.textTertiary, textTransform: "uppercase" }}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

// Edición de Materia — todos los campos juntos en una sola pantalla (a
// diferencia del alta, que es un wizard paso a paso, ver app/materia/nueva.tsx)
// porque así ya funciona en la web: entrás sabiendo lo que hay, no hace
// falta guiarte de nuevo. Comparte estado/validaciones con el alta vía
// useMateriaFormState.
export default function MateriaFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [materiaOriginal, setMateriaOriginal] = useState<Materia | null>(null);
  const f = useMateriaFormState();

  useEffect(() => {
    if (!id) return;
    supabase
      .from("materias")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        const m = data as Materia | null;
        setMateriaOriginal(m);
        if (m) f.cargarDesde(m);
        setCargando(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const guardar = async () => {
    const input = f.construir();
    if (!input || !id) return;
    setGuardando(true);
    try {
      await actualizarMateria(id, input);
      router.back();
    } catch (e) {
      Alert.alert("No se pudo guardar", e instanceof Error ? e.message : "Revisá tu conexión e intentá de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = () => {
    if (!id) return;
    Alert.alert("Eliminar materia", `¿Seguro que querés eliminar "${materiaOriginal?.nombre ?? f.nombre}"? Esta acción no se puede deshacer.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          setGuardando(true);
          try {
            await eliminarMateria(id);
            router.replace("/materias");
          } catch (e) {
            Alert.alert("No se pudo eliminar", e instanceof Error ? e.message : "Revisá tu conexión e intentá de nuevo.");
          } finally {
            setGuardando(false);
          }
        },
      },
    ]);
  };

  if (cargando) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <AppText style={{ color: colors.textTertiary }}>Cargando…</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <BackButton />
        <AppText weight="600" style={{ fontSize: 16 }}>
          Editar materia
        </AppText>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.xxl, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Section title="Datos básicos">
            <MateriaBasicosFields nombre={f.nombre} setNombre={f.setNombre} doc={f.doc} setDoc={f.setDoc} colorId={f.colorId} setColorId={f.setColorId} />
          </Section>

          <Section title="Cursada">
            <MateriaCursadaFields
              salon={f.salon}
              setSalon={f.setSalon}
              estado={f.estado}
              setEstado={f.setEstado}
              bloques={f.bloques}
              onAgregarFranja={f.agregarFranja}
              onQuitarFranja={f.quitarFranja}
            />
          </Section>

          <Section title="Calificación y aprobación">
            <MateriaCalificacionFields
              escTipo={f.escTipo}
              onCambiarTipo={f.onCambiarTipo}
              escTotal={f.escTotal}
              setEscTotal={f.setEscTotal}
              escAprob={f.escAprob}
              setEscAprob={f.setEscAprob}
              escExon={f.escExon}
              setEscExon={f.setEscExon}
            />
          </Section>

          <PrimaryButton label={guardando ? "Guardando…" : "Guardar cambios"} onPress={guardar} disabled={guardando} />
          <PrimaryButton label="Eliminar materia" variant="danger" onPress={eliminar} disabled={guardando} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
