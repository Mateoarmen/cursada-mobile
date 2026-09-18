import { TextInput, View } from "react-native";
import type { EscalaTipo } from "@/types/database";
import { spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText, Pill, PressableScale } from "@/components/ui";
import { MateriaField, makeMateriaInputStyle } from "./MateriaBasicosFields";

const ESC_TIPOS: { value: EscalaTipo; label: string }[] = [
  { value: "nota", label: "Nota 0–12" },
  { value: "pct", label: "Porcentaje" },
  { value: "puntos", label: "Puntaje" },
];

type Props = {
  escTipo: EscalaTipo;
  onCambiarTipo: (t: EscalaTipo) => void;
  escTotal: string;
  setEscTotal: (v: string) => void;
  escAprob: string;
  setEscAprob: (v: string) => void;
  escExon: string | null;
  setEscExon: (v: string | null) => void;
};

// Paso 3 del alta / tercera sección de la edición: sistema de calificación.
export function MateriaCalificacionFields({ escTipo, onCambiarTipo, escTotal, setEscTotal, escAprob, setEscAprob, escExon, setEscExon }: Props) {
  const { colors } = useTheme();
  const materiaInputStyle = makeMateriaInputStyle(colors);
  return (
    <View style={{ gap: spacing.lg }}>
      <MateriaField label="Sistema">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {ESC_TIPOS.map((t) => (
            <PressableScale key={t.value} scaleTo={0.96} onPress={() => onCambiarTipo(t.value)}>
              <Pill label={t.label} background={escTipo === t.value ? colors.accent : colors.surfaceSoft} color={escTipo === t.value ? colors.white : colors.textSecondary} />
            </PressableScale>
          ))}
        </View>
      </MateriaField>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <MateriaField label="Total">
            <TextInput
              style={[materiaInputStyle, escTipo === "nota" ? { opacity: 0.5 } : null]}
              keyboardType="decimal-pad"
              editable={escTipo !== "nota"}
              value={escTipo === "nota" ? "12" : escTotal}
              onChangeText={setEscTotal}
            />
          </MateriaField>
        </View>
        <View style={{ flex: 1 }}>
          <MateriaField label="Aprueba con">
            <TextInput style={materiaInputStyle} keyboardType="decimal-pad" value={escAprob} onChangeText={setEscAprob} />
          </MateriaField>
        </View>
      </View>

      {escExon == null ? (
        <PressableScale scaleTo={0.98} onPress={() => setEscExon("")}>
          <AppText weight="600" style={{ fontSize: 13, color: colors.accentText }}>
            + Agregar nota de exoneración
          </AppText>
        </PressableScale>
      ) : (
        <MateriaField label="Exonera con">
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <TextInput style={[materiaInputStyle, { flex: 1 }]} keyboardType="decimal-pad" value={escExon} onChangeText={setEscExon} autoFocus />
            <PressableScale scaleTo={0.9} onPress={() => setEscExon(null)}>
              <AppText style={{ fontSize: 13, color: colors.dangerText }}>Quitar</AppText>
            </PressableScale>
          </View>
        </MateriaField>
      )}
    </View>
  );
}
