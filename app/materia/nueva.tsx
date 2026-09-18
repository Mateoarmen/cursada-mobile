import { useState } from "react";
import { router } from "expo-router";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@/theme/tokens";
import { AppText, BackButton, PrimaryButton, Reveal } from "@/components/ui";
import { crearMateria } from "@/lib/materias";
import { useMateriaFormState } from "@/hooks/useMateriaFormState";
import { MateriaBasicosFields } from "@/components/materia/MateriaBasicosFields";
import { MateriaCursadaFields } from "@/components/materia/MateriaCursadaFields";
import { MateriaCalificacionFields } from "@/components/materia/MateriaCalificacionFields";

const PASOS = ["basicos", "cursada", "calificacion"] as const;
type Paso = (typeof PASOS)[number];
const TITULOS: Record<Paso, string> = {
  basicos: "Datos básicos",
  cursada: "Cursada y horario",
  calificacion: "Calificación y aprobación",
};

// Alta de Materia — wizard paso a paso (mismo criterio que el onboarding,
// ver app/onboarding/wizard.tsx: dots de progreso arriba, un paso por
// pantalla) en vez de un formulario largo de una sola vez — pedido
// explícito después de la primera pasada ("que sea más amigable"). La
// edición (app/materia/form.tsx) se queda en una sola pantalla porque ahí
// ya sabés lo que hay, no hace falta que te vuelvan a guiar.
export default function MateriaNuevaScreen() {
  const [pasoIdx, setPasoIdx] = useState(0);
  const [creando, setCreando] = useState(false);
  const f = useMateriaFormState();
  const paso = PASOS[pasoIdx];

  const volver = () => {
    if (pasoIdx > 0) setPasoIdx((i) => i - 1);
    else router.back();
  };

  const continuar = async () => {
    if (paso === "basicos") {
      if (!f.validarBasicos()) return;
      setPasoIdx(1);
      return;
    }
    if (paso === "cursada") {
      setPasoIdx(2);
      return;
    }
    const input = f.construir();
    if (!input) return;
    setCreando(true);
    try {
      const creada = await crearMateria(input);
      router.replace(`/materia/${creada.id}`);
    } catch (e) {
      Alert.alert("No se pudo crear la materia", e instanceof Error ? e.message : "Revisá tu conexión e intentá de nuevo.");
    } finally {
      setCreando(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View
        style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.md }}
        accessible
        accessibilityLabel={`Paso ${pasoIdx + 1} de ${PASOS.length}: ${TITULOS[paso]}`}
      >
        <BackButton onPress={volver} />
        <View style={{ flex: 1, flexDirection: "row", justifyContent: "center", gap: 4 }}>
          {PASOS.map((p, i) => (
            <View key={p} style={{ width: 28, height: 4, borderRadius: 2, backgroundColor: i <= pasoIdx ? colors.accent : colors.surfaceSoft }} />
          ))}
        </View>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.xl, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          {/* key={paso} fuerza que Reveal se remonte en cada paso — un
              momento autoral por transición de paso, mismo criterio que el
              resto de la app (ver animate.md: una sola entrada, no una por
              campo). */}
          <Reveal key={paso} style={{ gap: spacing.xl }}>
            <View style={{ gap: 2 }}>
              <AppText weight="600" style={{ fontSize: 12, letterSpacing: 0.4, color: colors.accentText }}>
                Paso {pasoIdx + 1} de {PASOS.length}
              </AppText>
              <AppText weight="700" style={{ fontSize: 22, letterSpacing: -0.3 }}>
                {TITULOS[paso]}
              </AppText>
            </View>

            {paso === "basicos" ? (
              <MateriaBasicosFields nombre={f.nombre} setNombre={f.setNombre} doc={f.doc} setDoc={f.setDoc} colorId={f.colorId} setColorId={f.setColorId} />
            ) : null}

            {paso === "cursada" ? (
              <MateriaCursadaFields
                salon={f.salon}
                setSalon={f.setSalon}
                estado={f.estado}
                setEstado={f.setEstado}
                bloques={f.bloques}
                onAgregarFranja={f.agregarFranja}
                onQuitarFranja={f.quitarFranja}
              />
            ) : null}

            {paso === "calificacion" ? (
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
        <PrimaryButton
          label={paso === "calificacion" ? (creando ? "Creando…" : "Crear materia") : "Continuar"}
          onPress={continuar}
          disabled={creando}
        />
      </View>
    </SafeAreaView>
  );
}
