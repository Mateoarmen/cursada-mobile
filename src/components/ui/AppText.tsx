import { Text, type TextProps } from "react-native";
import { colors, fonts } from "@/theme/tokens";

type Weight = "400" | "500" | "600" | "700";

type Props = TextProps & {
  weight?: Weight;
  mono?: boolean;
};

const weightToFamily: Record<Weight, string> = {
  "400": fonts.sans,
  "500": fonts.sansMedium,
  "600": fonts.sansSemiBold,
  "700": fonts.sansBold,
};

// Envuelve <Text> para resolver siempre a Instrument Sans (o JetBrains Mono
// para cifras/horas) en vez de la fuente de sistema — RN no soporta
// font-weight numérico sobre una sola familia variable como hace la web.
export function AppText({ style, weight = "400", mono = false, ...rest }: Props) {
  const fontFamily = mono ? fonts.mono : weightToFamily[weight];
  return <Text style={[{ fontFamily, color: colors.text }, style]} {...rest} />;
}
