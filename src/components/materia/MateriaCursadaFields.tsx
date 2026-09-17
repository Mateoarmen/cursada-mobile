import { useState } from "react";
import { TextInput, View } from "react-native";
import { colors, estadoLabel, radii, spacing, type EstadoMateria } from "@/theme/tokens";
import { AppText, Pill, PressableScale } from "@/components/ui";
import { DIAS_BLOQUE, horaTexto } from "@/lib/catalog";
import type { MateriaBloqueInput } from "@/lib/materias";
import { FranjaSheet } from "./FranjaSheet";
import { MateriaField, materiaInputStyle } from "./MateriaBasicosFields";

const ESTADOS: EstadoMateria[] = ["cursando", "aprobada", "recursando", "pendiente"];

function franjaLabel(b: MateriaBloqueInput): string {
  return `${DIAS_BLOQUE[b.dia - 1] ?? "?"} · ${horaTexto(b.ini)}–${horaTexto(b.fin)}`;
}

type Props = {
  salon: string;
  setSalon: (v: string) => void;
  estado: EstadoMateria;
  setEstado: (v: EstadoMateria) => void;
  bloques: MateriaBloqueInput[];
  onAgregarFranja: (b: MateriaBloqueInput) => void;
  onQuitarFranja: (i: number) => void;
};

// Paso 2 del alta / segunda sección de la edición: salón, estado, horario
// semanal. El horario se carga vía FranjaSheet (día + hora en un bottom
// sheet aparte) en vez de tres selectores sueltos en la pantalla — mucho
// menos intuitivo que un modal chico dedicado a "agregar una franja".
export function MateriaCursadaFields({ salon, setSalon, estado, setEstado, bloques, onAgregarFranja, onQuitarFranja }: Props) {
  const [sheetAbierto, setSheetAbierto] = useState(false);

  return (
    <View style={{ gap: spacing.lg }}>
      <MateriaField label="Salón">
        <TextInput style={materiaInputStyle} placeholder="Ej. Aula 302" placeholderTextColor={colors.textFaint} value={salon} onChangeText={setSalon} />
      </MateriaField>

      <MateriaField label="Estado">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {ESTADOS.map((e) => (
            <PressableScale key={e} scaleTo={0.96} onPress={() => setEstado(e)}>
              <Pill label={estadoLabel[e]} background={estado === e ? colors.accent : colors.surfaceSoft} color={estado === e ? colors.white : colors.textSecondary} />
            </PressableScale>
          ))}
        </View>
      </MateriaField>

      <MateriaField label="Horario semanal (opcional)">
        <View style={{ gap: spacing.sm }}>
          {bloques.map((b, i) => (
            <View
              key={`${b.dia}-${b.ini}-${b.fin}-${i}`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                height: 44,
                borderRadius: radii.sm,
                backgroundColor: colors.surfaceSoft,
                paddingHorizontal: spacing.md,
              }}
            >
              <AppText mono weight="600" style={{ fontSize: 13 }}>
                {franjaLabel(b)}
              </AppText>
              <PressableScale scaleTo={0.9} onPress={() => onQuitarFranja(i)}>
                <AppText style={{ fontSize: 13, color: colors.dangerText }}>Quitar</AppText>
              </PressableScale>
            </View>
          ))}

          <PressableScale scaleTo={0.98} onPress={() => setSheetAbierto(true)}>
            <View
              style={{
                height: 44,
                borderRadius: radii.sm,
                borderWidth: 1.5,
                borderStyle: "dashed",
                borderColor: colors.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AppText weight="600" style={{ fontSize: 13, color: colors.accentText }}>
                + Agregar franja
              </AppText>
            </View>
          </PressableScale>
        </View>
      </MateriaField>

      <FranjaSheet visible={sheetAbierto} onClose={() => setSheetAbierto(false)} onAgregar={onAgregarFranja} />
    </View>
  );
}
