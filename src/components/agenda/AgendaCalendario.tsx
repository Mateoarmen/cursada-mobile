import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, PanResponder, View } from "react-native";
import { easing, motionDuration, radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, PressableScale } from "@/components/ui";
import { diffDias, MESES_LARGOS, parseISODate, toISODate } from "@/lib/agenda";

const INICIALES = ["L", "M", "M", "J", "V", "S", "D"];
const DIAS_LARGOS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const COLUMNA = "14.285714%";
const MAX_MARCAS = 3;

export type CalendarioItem = {
  id: string;
  fecha: string;
  hora?: string;
  todoElDia?: boolean;
  hecho: boolean;
  titulo: string;
  // Color de identidad de la materia (o gris de "Personal") para la marca.
  marca: string;
};

function capitalizar(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function primeroDelMes(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function sumarMeses(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function mismoMes(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

// Siempre 6 semanas completas (lunes primero, mismo criterio que
// MesCalendario y Horario), con los días del mes anterior/siguiente para
// rellenar: la grilla nunca cambia de alto al pasar de mes, así la lista
// del día de abajo no salta.
function semanasDelMes(mes: Date): Date[] {
  const offset = (mes.getDay() + 6) % 7;
  const inicio = new Date(mes.getFullYear(), mes.getMonth(), 1 - offset);
  return Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i));
}

function tituloDia(iso: string, hoy: Date) {
  const d = parseISODate(iso);
  const diff = diffDias(d, hoy);
  const relativo = diff === 0 ? "Hoy" : diff === 1 ? "Mañana" : diff === -1 ? "Ayer" : null;
  const largo = `${DIAS_LARGOS[d.getDay()]} ${d.getDate()} de ${MESES_LARGOS[d.getMonth()]}`;
  return relativo ? { titulo: relativo, detalle: largo } : { titulo: capitalizar(largo), detalle: null };
}

function describirDia(fecha: Date, items: CalendarioItem[]) {
  const base = `${DIAS_LARGOS[fecha.getDay()]} ${fecha.getDate()} de ${MESES_LARGOS[fecha.getMonth()]}`;
  if (!items.length) return base;
  const n = items.length;
  return `${base}, ${n} ${n === 1 ? "ítem" : "ítems"}: ${items.map((i) => i.titulo).join(", ")}`;
}

// Vista mes de la Agenda: los mismos ítems (ya filtrados) que la lista,
// ubicados en su día. Cada día lleva una marca por ítem en el color de su
// materia; al tocarlo se listan abajo con la misma fila que la vista
// Lista (la dibuja el padre vía renderItem, para no duplicar AgendaRow).
export function AgendaCalendario<T extends CalendarioItem>({
  items,
  hoy,
  seleccion,
  onSeleccionar,
  renderItem,
  onAgregar,
}: {
  items: T[];
  hoy: Date;
  seleccion: string;
  onSeleccionar: (iso: string) => void;
  renderItem: (item: T) => ReactNode;
  onAgregar: (iso: string) => void;
}) {
  const { colors } = useTheme();
  const [mes, setMes] = useState(() => primeroDelMes(parseISODate(seleccion)));
  const semanas = useMemo(() => semanasDelMes(mes), [mes]);
  const hoyIso = toISODate(hoy);

  const porDia = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const it of items) {
      const lista = map.get(it.fecha);
      if (lista) lista.push(it);
      else map.set(it.fecha, [it]);
    }
    // Todo el día primero, después por hora — mismo desempate que groupAgenda.
    map.forEach((lista) => lista.sort((a, b) => (a.todoElDia || !a.hora ? "" : a.hora).localeCompare(b.todoElDia || !b.hora ? "" : b.hora)));
    return map;
  }, [items]);

  // Si la selección cambia desde afuera (p. ej. "Hoy") y cae en otro mes,
  // la grilla la sigue.
  useEffect(() => {
    const d = parseISODate(seleccion);
    if (!mismoMes(d, mes)) setMes(primeroDelMes(d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seleccion]);

  // Entrada del mes nuevo: se desliza desde el lado hacia el que se fue
  // (o sólo fundido con Reducir movimiento).
  const reduceMotion = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => (reduceMotion.current = v))
      .catch(() => {});
  }, []);
  const entrada = useRef(new Animated.Value(1)).current;
  const direccion = useRef(1);

  const irAMes = (delta: number, seleccionar?: string) => {
    direccion.current = delta >= 0 ? 1 : -1;
    const nuevo = sumarMeses(mes, delta);
    setMes(nuevo);
    if (seleccionar) {
      onSeleccionar(seleccionar);
    } else if (mismoMes(nuevo, hoy)) {
      onSeleccionar(hoyIso);
    } else {
      // Primer día con algo agendado; si el mes está vacío, el 1.
      const conItems = semanasDelMes(nuevo).find((d) => mismoMes(d, nuevo) && porDia.has(toISODate(d)));
      onSeleccionar(toISODate(conItems ?? nuevo));
    }
    entrada.setValue(0);
    Animated.timing(entrada, {
      toValue: 1,
      duration: reduceMotion.current ? motionDuration.feedback : motionDuration.layout,
      easing: easing.out,
      useNativeDriver: true,
    }).start();
  };

  // Deslizar horizontalmente sobre la grilla cambia de mes, como en
  // Calendario de iOS. Sólo reclama el gesto si es claramente horizontal,
  // para no pelear con el scroll vertical de la pantalla.
  const irAMesRef = useRef(irAMes);
  irAMesRef.current = irAMes;
  const pan = useMemo(
    () =>
      PanResponder.create({
        // En captura: cada día es un botón y, si no, se queda con el toque.
        onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.6,
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, g) => {
          if (g.dx <= -40 || g.vx < -0.4) irAMesRef.current(1);
          else if (g.dx >= 40 || g.vx > 0.4) irAMesRef.current(-1);
        },
      }),
    []
  );

  const enMesDeHoy = mismoMes(mes, hoy);
  const mostrarHoy = !enMesDeHoy || seleccion !== hoyIso;
  const delDia = porDia.get(seleccion) ?? [];
  const { titulo, detalle } = tituloDia(seleccion, hoy);

  const translateX = entrada.interpolate({
    inputRange: [0, 1],
    outputRange: [reduceMotion.current ? 0 : 28 * direccion.current, 0],
  });

  return (
    <View style={{ gap: spacing.xxl }}>
      <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, paddingHorizontal: spacing.sm, paddingTop: spacing.xs, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: spacing.md }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "baseline", gap: spacing.sm }} accessible accessibilityRole="header">
            <AppText weight="700" maxFontSizeMultiplier={1.4} style={{ fontSize: 20, letterSpacing: -0.4 }}>
              {capitalizar(MESES_LARGOS[mes.getMonth()]!)}
            </AppText>
            {mes.getFullYear() !== hoy.getFullYear() || !enMesDeHoy ? (
              <AppText mono maxFontSizeMultiplier={1.4} style={{ fontSize: 13, color: colors.textTertiary }}>
                {mes.getFullYear()}
              </AppText>
            ) : null}
          </View>
          {mostrarHoy ? (
            <PressableScale
              scaleTo={0.94}
              onPress={() => {
                if (enMesDeHoy) onSeleccionar(hoyIso);
                else irAMes((hoy.getFullYear() - mes.getFullYear()) * 12 + hoy.getMonth() - mes.getMonth(), hoyIso);
              }}
              accessibilityRole="button"
              accessibilityLabel="Ir a hoy"
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md }}
            >
              <AppText weight="600" style={{ fontSize: 14, color: colors.accentText }}>
                Hoy
              </AppText>
            </PressableScale>
          ) : null}
          <PressableScale
            scaleTo={0.9}
            onPress={() => irAMes(-1)}
            accessibilityRole="button"
            accessibilityLabel="Mes anterior"
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <AppIcon name="chevron-back" size={16} color={colors.textSecondary} weight="semibold" />
          </PressableScale>
          <PressableScale
            scaleTo={0.9}
            onPress={() => irAMes(1)}
            accessibilityRole="button"
            accessibilityLabel="Mes siguiente"
            style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
          >
            <AppIcon name="chevron-forward" size={16} color={colors.textSecondary} weight="semibold" />
          </PressableScale>
        </View>

        <View style={{ flexDirection: "row", paddingTop: spacing.xs, paddingBottom: 6 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {INICIALES.map((l, i) => (
            <AppText key={i} weight="600" maxFontSizeMultiplier={1.3} style={{ width: COLUMNA, textAlign: "center", fontSize: 11, color: colors.textTertiary }}>
              {l}
            </AppText>
          ))}
        </View>

        <Animated.View {...pan.panHandlers} style={{ flexDirection: "row", flexWrap: "wrap", opacity: entrada, transform: [{ translateX }] }}>
          {semanas.map((fecha) => {
            const iso = toISODate(fecha);
            const delMes = mismoMes(fecha, mes);
            const esHoy = iso === hoyIso;
            const activo = iso === seleccion;
            const lista = porDia.get(iso) ?? [];
            const marcas = lista.slice(0, MAX_MARCAS);
            // Hoy visto desde el mes vecino (relleno) queda sólo en azul, sin
            // el círculo lleno que le compite al día elegido.
            const hoyLleno = esHoy && delMes;
            const circulo = hoyLleno ? colors.accent : activo ? colors.text : "transparent";
            const numero = hoyLleno ? colors.white : activo ? colors.bg : esHoy ? colors.accentText : delMes ? colors.text : colors.textGhost;
            return (
              <PressableScale
                key={iso}
                scaleTo={0.92}
                onPress={() => (delMes ? onSeleccionar(iso) : irAMes(fecha < mes ? -1 : 1, iso))}
                accessibilityRole="button"
                accessibilityLabel={describirDia(fecha, lista)}
                accessibilityState={{ selected: activo }}
                style={{ width: COLUMNA, height: 50, alignItems: "center", paddingTop: 2 }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: circulo }}>
                  <AppText
                    maxFontSizeMultiplier={1.25}
                    weight={hoyLleno || activo ? "700" : "500"}
                    style={{ fontSize: 15, color: numero, fontVariant: ["tabular-nums"] }}
                  >
                    {fecha.getDate()}
                  </AppText>
                </View>
                <View style={{ flexDirection: "row", gap: 3, marginTop: 4, height: 6, opacity: delMes ? 1 : 0.35 }}>
                  {marcas.map((it) => (
                    <View
                      key={it.id}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: it.hecho ? "transparent" : it.marca,
                        borderWidth: it.hecho ? 1 : 0,
                        borderColor: it.marca,
                      }}
                    />
                  ))}
                </View>
              </PressableScale>
            );
          })}
        </Animated.View>
      </View>

      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm, flexWrap: "wrap" }} accessible accessibilityRole="header">
          <AppText weight="700" style={{ fontSize: 20, letterSpacing: -0.4 }}>
            {titulo}
          </AppText>
          {detalle ? <AppText style={{ fontSize: 14, color: colors.textTertiary }}>{detalle}</AppText> : null}
          {delDia.length ? (
            <AppText mono style={{ fontSize: 13, color: colors.textTertiary }}>
              {delDia.length}
            </AppText>
          ) : null}
        </View>
        {delDia.length ? (
          <View style={{ gap: spacing.smd }}>{delDia.map((it) => <View key={it.id}>{renderItem(it)}</View>)}</View>
        ) : (
          // Alineado a la izquierda: a la derecha queda el FAB flotando justo
          // a esta altura.
          <View style={{ alignItems: "flex-start" }}>
            <AppText style={{ fontSize: 14, color: colors.textTertiary }}>Nada agendado para este día.</AppText>
            <PressableScale
              scaleTo={0.96}
              onPress={() => onAgregar(seleccion)}
              accessibilityRole="button"
              accessibilityLabel={`Agregar algo para el ${tituloDia(seleccion, hoy).detalle ?? titulo.toLowerCase()}`}
              style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <AppIcon name="add-circle-outline" size={16} color={colors.accentText} />
              <AppText weight="600" style={{ fontSize: 14, color: colors.accentText }}>
                Agregar para este día
              </AppText>
            </PressableScale>
          </View>
        )}
      </View>
    </View>
  );
}
