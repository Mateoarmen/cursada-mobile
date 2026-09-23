import { SymbolView, type SFSymbol } from "expo-symbols";
import type { ColorValue } from "react-native";

// SF Symbols wrapper standing in for @expo/vector-icons' Ionicons — iOS
// iconography must come from the system's own symbol set, not a
// cross-platform icon font (see audit: app/(tabs)/index.tsx).
// Keys match the Ionicons names the app already used, so every call site
// only swaps the import — no prop-value churn. Values map to the closest
// stable SF Symbol: real house/house.fill-style pairs where a filled
// variant exists, the same symbol for both states where it doesn't (the
// active tab already differentiates via tint color and weight).
const SYMBOLS = {
  "chevron-back": "chevron.left",
  "chevron-forward": "chevron.right",
  "chevron-up": "chevron.up",
  "chevron-down": "chevron.down",
  "home-outline": "house",
  home: "house.fill",
  "book-outline": "book",
  book: "book.fill",
  "calendar-outline": "calendar",
  calendar: "calendar",
  "time-outline": "clock",
  time: "clock.fill",
  "school-outline": "graduationcap",
  "alert-circle-outline": "exclamationmark.circle",
  "stats-chart-outline": "chart.bar",
  "list-outline": "list.bullet",
  "folder-outline": "folder",
  "checkmark-done-outline": "checkmark.circle",
  "checkbox-outline": "checklist",
  search: "magnifyingglass",
  checkmark: "checkmark",
  "checkmark-circle-outline": "checkmark.circle",
  "close-circle-outline": "xmark.circle",
  "information-circle-outline": "info.circle",
  "arrow-undo-outline": "arrow.uturn.backward",
  "create-outline": "square.and.pencil",
  "trash-outline": "trash",
  "options-outline": "slider.horizontal.3",
  checkbox: "checkmark.square.fill",
  "square-outline": "square",
  "grid-outline": "square.grid.2x2",
  "add-circle-outline": "plus.circle",
  close: "xmark",
} as const satisfies Record<string, SFSymbol>;

export type AppIconName = keyof typeof SYMBOLS;

type Props = {
  name: AppIconName;
  size?: number;
  color?: ColorValue;
  weight?: "regular" | "medium" | "semibold" | "bold";
};

export function AppIcon({ name, size = 24, color, weight = "regular" }: Props) {
  return (
    <SymbolView
      name={SYMBOLS[name]}
      size={size}
      tintColor={color}
      weight={weight}
      resizeMode="scaleAspectFit"
      style={{ width: size, height: size }}
    />
  );
}
