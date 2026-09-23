import { useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, PressableScale } from "@/components/ui";
import { addDias, formatRangoFechas, type SemanaPunto } from "@/lib/asistencia";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "set", "oct", "nov", "dic"];

const ALTO = 104; // alto del área de barras (0-100%)
const ALTO_EJE = 22; // franja de rótulos de fecha bajo las barras
const CANAL = 38; // ancho reservado a la derecha para "100%" / "50%"
const SLOT_MIN = 14;
const SLOT_MAX = 40;
const RANGO_ROTULO = 44; // ancho que necesita un rótulo de fecha

function textoSemana(p: SemanaPunto): string {
  const rango = formatRangoFechas(p.lunes, addDias(p.lunes, 6));
  if (p.stats.total === 0) return `${rango} · sin registros`;
  return `${rango} · ${p.stats.presentes} de ${p.stats.total} ${p.stats.total === 1 ? "clase" : "clases"} · ${p.stats.pct}%`;
}

// Asistencia del semestre semana a semana: una barra por semana, alto = % de
// esa semana (0-100). Una sola serie → un solo tono (el acento) y énfasis en
// la barra elegida; el valor exacto de la elegida se lee arriba y el resto
// por su altura contra las líneas del 50 y el 100%. Sin línea de "mínimo":
// no hay uno definido. Semanas sin clases contadas quedan como una marca
// baja — el tiempo del eje no se saltea.
export function SemestreBarras({
  semanas,
  seleccion,
  onSeleccionar,
  onVerSemana,
}: {
  semanas: SemanaPunto[];
  seleccion: number;
  onSeleccionar: (i: number) => void;
  onVerSemana: (lunes: Date) => void;
}) {
  const { colors } = useTheme();
  const [ancho, setAncho] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const area = Math.max(0, ancho - CANAL);
  const n = semanas.length;
  const slot = n && area ? Math.min(SLOT_MAX, Math.max(SLOT_MIN, Math.floor(area / n))) : SLOT_MIN;
  const contenido = slot * n;
  // Con muchas semanas las barras no se achican de SLOT_MIN: se desplaza,
  // arrancando en la semana más reciente.
  const desplaza = area > 0 && contenido > area + 1;
  const paso = Math.max(1, Math.ceil(RANGO_ROTULO / slot));
  const elegida = semanas[seleccion];

  return (
    <View style={{ gap: spacing.md }} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, minHeight: 32 }}>
        <AppText style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }} numberOfLines={2}>
          {elegida ? textoSemana(elegida) : ""}
        </AppText>
        {elegida ? (
          <PressableScale
            scaleTo={0.97}
            hitSlop={10}
            onPress={() => onVerSemana(elegida.lunes)}
            accessibilityLabel="Ver esa semana"
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
          >
            <AppText weight="600" style={{ fontSize: 13, color: colors.accentText }}>
              Ver semana
            </AppText>
            <AppIcon name="chevron-forward" size={11} color={colors.accentText} weight="semibold" />
          </PressableScale>
        ) : null}
      </View>

      <View style={{ height: ALTO + ALTO_EJE }}>
        {[0, 50, 100].map((v) => (
          <View key={v} style={{ position: "absolute", left: 0, right: CANAL, bottom: ALTO_EJE + (v / 100) * ALTO, height: 1, backgroundColor: v === 0 ? colors.border : colors.borderFaint }} />
        ))}
        {[100, 50].map((v) => (
          <AppText key={v} style={{ position: "absolute", right: 0, bottom: ALTO_EJE + (v / 100) * ALTO - 8, fontSize: 11, color: colors.textTertiary }}>
            {v}%
          </AppText>
        ))}
        <ScrollView
          ref={scrollRef}
          horizontal
          scrollEnabled={desplaza}
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => desplaza && scrollRef.current?.scrollToEnd({ animated: false })}
          style={{ position: "absolute", left: 0, top: 0, width: area, height: ALTO + ALTO_EJE }}
        >
          {/* Un solo hijo: en un ScrollView horizontal el contenedor interno es
              `row`, y las barras y el eje tienen que apilarse, no ir al lado. */}
          <View style={{ width: Math.max(contenido, 1) }}>
            <View style={{ flexDirection: "row", height: ALTO, alignItems: "flex-end" }}>
              {semanas.map((p, i) => {
                const activa = i === seleccion;
                const alto = p.stats.pct == null ? 3 : Math.max(3, Math.round((p.stats.pct / 100) * ALTO));
                return (
                  <PressableScale
                    key={p.lunes.getTime()}
                    scaleTo={0.97}
                    onPress={() => onSeleccionar(i)}
                    accessibilityLabel={textoSemana(p)}
                    accessibilityState={{ selected: activa }}
                    style={{ width: slot, height: ALTO, justifyContent: "flex-end", alignItems: "center" }}
                  >
                    <View
                      style={{
                        width: Math.min(slot - 4, 22),
                        height: alto,
                        borderTopLeftRadius: 4,
                        borderTopRightRadius: 4,
                        backgroundColor: p.stats.pct == null ? colors.textGhost : colors.accent,
                        opacity: p.stats.pct == null ? 1 : activa ? 1 : 0.45,
                      }}
                    />
                  </PressableScale>
                );
              })}
            </View>
            <View style={{ height: ALTO_EJE }}>
              {semanas.map((p, i) =>
                i % paso === 0 ? (
                  <AppText
                    key={p.lunes.getTime()}
                    maxFontSizeMultiplier={1.2}
                    style={{
                      position: "absolute",
                      top: 5,
                      // Se recorta a los bordes: el primer rótulo no queda cortado.
                      left: Math.min(Math.max(0, i * slot + slot / 2 - RANGO_ROTULO / 2), Math.max(0, contenido - RANGO_ROTULO)),
                      width: RANGO_ROTULO,
                      textAlign: "center",
                      fontSize: 11,
                      color: colors.textTertiary,
                    }}
                  >
                    {p.lunes.getDate()} {MESES[p.lunes.getMonth()]}
                  </AppText>
                ) : null
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}
