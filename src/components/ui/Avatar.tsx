import { Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/theme/ThemeContext";
import { AppText } from "./AppText";

type Props = {
  initial: string;
  size?: number;
  fontSize?: number;
  uri?: string | null;
};

// Misma regla que renderAvatarInto() en la web: si el perfil tiene foto_url,
// se muestra la imagen recortada a círculo; si no, el degradé con la inicial.
export function Avatar({ initial, size = 44, fontSize = 17, uri }: Props) {
  const { colors, gradients } = useTheme();
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface }} />;
  }
  return (
    <LinearGradient
      colors={gradients.avatar}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppText weight="600" style={{ fontSize, color: colors.white }}>
        {initial}
      </AppText>
    </LinearGradient>
  );
}
