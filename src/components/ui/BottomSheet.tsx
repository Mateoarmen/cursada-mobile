import { type ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { colors, radii, spacing } from "@/theme/tokens";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
};

export function BottomSheet({ visible, onClose, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: colors.surfaceRaised,
            borderTopLeftRadius: radii.xxl,
            borderTopRightRadius: radii.xxl,
            paddingTop: spacing.md,
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.xxl + spacing.xs,
            gap: spacing.lg,
          }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: radii.round,
              backgroundColor: "rgba(255,255,255,0.2)",
              alignSelf: "center",
            }}
          />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
