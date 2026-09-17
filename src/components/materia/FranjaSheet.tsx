import { useState } from "react";
import { Alert, View } from "react-native";
import { colors, spacing } from "@/theme/tokens";
import { AppText, BottomSheet, Pill, PickerField, PressableScale, PrimaryButton } from "@/components/ui";
import { DIAS_BLOQUE, horaTexto } from "@/lib/catalog";
import type { MateriaBloqueInput } from "@/lib/materias";

// Opciones de hora cada 30 min (0:00–23:30) — antes sólo se podía elegir en
// horas enteras, lo que no alcanzaba para horarios reales tipo 8:30. `ini`/
// `fin` quedan como número decimal (8.5 = 8:30), mismo formato que ya lee
// horaTexto()/formatHorario() en el resto de la app.
const HORA_OPTS = Array.from({ length: 48 }, (_, i) => {
  const h = i / 2;
  return { value: String(h), label: horaTexto(h) };
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <AppText weight="500" style={{ fontSize: 12, color: colors.textTertiary }}>
        {label}
      </AppText>
      {children}
    </View>
  );
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onAgregar: (b: MateriaBloqueInput) => void;
};

// Agregar una franja de horario — bottom sheet con día (chips, un tap) +
// hora de inicio/fin (picker), en vez de tres selectores sueltos metidos en
// medio del formulario largo (mucho menos intuitivo, era la queja original).
export function FranjaSheet({ visible, onClose, onAgregar }: Props) {
  const [dia, setDia] = useState(1);
  const [ini, setIni] = useState("8");
  const [fin, setFin] = useState("10");

  const confirmar = () => {
    const iniN = Number(ini);
    const finN = Number(fin);
    if (finN <= iniN) {
      Alert.alert("Horario inválido", "La hora de fin tiene que ser posterior a la de inicio.");
      return;
    }
    onAgregar({ dia, ini: iniN, fin: finN });
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText weight="600" style={{ fontSize: 19, letterSpacing: -0.1 }}>
        Agregar franja
      </AppText>

      <View style={{ gap: 6 }}>
        <AppText weight="500" style={{ fontSize: 12, color: colors.textTertiary }}>
          Día
        </AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {DIAS_BLOQUE.map((label, i) => {
            const selected = dia === i + 1;
            return (
              <PressableScale key={label} scaleTo={0.96} onPress={() => setDia(i + 1)}>
                <Pill
                  label={label}
                  background={selected ? colors.accent : colors.surfaceSoft}
                  color={selected ? colors.white : colors.textSecondary}
                  style={{ height: 34, paddingHorizontal: 15 }}
                />
              </PressableScale>
            );
          })}
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Field label="Inicio">
          <PickerField label="Hora de inicio" value={ini} placeholder="Inicio" options={HORA_OPTS} onSelect={setIni} />
        </Field>
        <Field label="Fin">
          <PickerField label="Hora de fin" value={fin} placeholder="Fin" options={HORA_OPTS} onSelect={setFin} />
        </Field>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.xs }}>
        <PrimaryButton label="Cancelar" variant="ghost" flex onPress={onClose} />
        <PrimaryButton label="Agregar" flex onPress={confirmar} />
      </View>
    </BottomSheet>
  );
}
