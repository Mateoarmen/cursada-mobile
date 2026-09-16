import { useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing } from "@/theme/tokens";
import { AppText } from "./AppText";
import { BottomSheet } from "./BottomSheet";
import { PressableScale } from "./PressableScale";

type Option = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  placeholder: string;
  options: Option[];
  onSelect: (v: string) => void;
  compact?: boolean;
};

// Selector tipo bottom-sheet reusado por login (registro) y perfil — mismos
// campos (nombre/apellido, nacimiento, país+teléfono, universidad, carrera)
// aparecen en los dos formularios, así que el picker vive acá en vez de
// duplicarse.
export function PickerField({ label, value, placeholder, options, onSelect, compact }: Props) {
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();
  const selected = options.find((o) => o.value === value)?.label;
  return (
    <View style={{ gap: 6, flex: compact ? 1 : undefined }}>
      <PressableScale scaleTo={0.99} onPress={() => setOpen(true)}>
        <View
          style={{
            height: 48,
            borderRadius: radii.sm,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: spacing.sm,
          }}
        >
          <AppText style={{ fontSize: 14, color: selected ? colors.text : colors.textFaint, flexShrink: 1 }} numberOfLines={1}>
            {selected ?? placeholder}
          </AppText>
          <Ionicons name="chevron-down" size={14} color={colors.textFaint} />
        </View>
      </PressableScale>
      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <AppText weight="600" style={{ fontSize: 17 }}>
          {label}
        </AppText>
        <ScrollView style={{ maxHeight: Math.min(420, height * 0.5) }} showsVerticalScrollIndicator={false}>
          {options.map((o, i) => (
            <PressableScale
              key={o.value}
              scaleTo={0.99}
              onPress={() => {
                onSelect(o.value);
                setOpen(false);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: spacing.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.borderFaint,
              }}
            >
              <AppText weight={value === o.value ? "600" : "400"} style={{ fontSize: 15 }}>
                {o.label}
              </AppText>
              {value === o.value ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
            </PressableScale>
          ))}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}
