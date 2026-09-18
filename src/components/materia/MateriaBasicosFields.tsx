import { TextInput, View } from "react-native";
import { materiaColors, radii, spacing, type MateriaColorId } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText, PressableScale } from "@/components/ui";

export function makeMateriaInputStyle(colors: ReturnType<typeof useTheme>["colors"]) {
  return {
    height: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    color: colors.text,
    fontFamily: "InstrumentSans_400Regular",
  } as const;
}

const COLOR_IDS = Object.keys(materiaColors) as MateriaColorId[];

export function MateriaField({ label, children }: { label: string; children: React.ReactNode }) {
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

type Props = {
  nombre: string;
  setNombre: (v: string) => void;
  doc: string;
  setDoc: (v: string) => void;
  colorId: MateriaColorId;
  setColorId: (v: MateriaColorId) => void;
};

// Paso 1 del alta / primera sección de la edición: nombre, docente, color —
// mismos 3 campos que el paso 1 del wizard de la web.
export function MateriaBasicosFields({ nombre, setNombre, doc, setDoc, colorId, setColorId }: Props) {
  const { colors } = useTheme();
  const materiaInputStyle = makeMateriaInputStyle(colors);
  return (
    <View style={{ gap: spacing.lg }}>
      <MateriaField label="Nombre">
        <TextInput style={materiaInputStyle} placeholder="Ej. Finanzas Corporativas" placeholderTextColor={colors.textFaint} value={nombre} onChangeText={setNombre} />
      </MateriaField>
      <MateriaField label="Docente">
        <TextInput style={materiaInputStyle} placeholder="Nombre del docente" placeholderTextColor={colors.textFaint} value={doc} onChangeText={setDoc} />
      </MateriaField>
      <MateriaField label="Color">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {COLOR_IDS.map((c) => {
            const selected = c === colorId;
            return (
              <PressableScale key={c} scaleTo={0.9} onPress={() => setColorId(c)}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: materiaColors[c].strong,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: selected ? 2 : 0,
                    borderColor: colors.white,
                  }}
                >
                  {selected ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white }} /> : null}
                </View>
              </PressableScale>
            );
          })}
        </View>
      </MateriaField>
    </View>
  );
}
