import { useEffect, useState } from "react";
import { ScrollView, TextInput, View, useWindowDimensions } from "react-native";
import { materiaColors, radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, BottomSheet, MiniCalendario, Pill, PressableScale, PrimaryButton, Segmented } from "@/components/ui";
import type { DemoMateria } from "@/data/demoContent";
import { formatFechaAgenda, toISODate, today } from "@/lib/agenda";

export type CrearModo = { kind: "materia"; itemKind: "evaluacion" | "tarea" } | { kind: "personal" };

export type CrearItemValores = {
  titulo: string;
  fecha: string;
  // Sólo para evaluación/tarea.
  materiaId: string;
  hora?: string;
  // Sólo para evento personal.
  todoElDia: boolean;
};

type MateriaOpcion = Pick<DemoMateria, "id" | "nombre" | "colorId">;

type Props = {
  modo: CrearModo | null;
  onClose: () => void;
  // El sheet no se cierra solo: lo cierra quien lo abrió (poniendo `modo`
  // en null) si la creación salió bien, igual que el resto de los sheets.
  onCrear: (valores: CrearItemValores) => Promise<void>;
  // Picker de materia (Agenda). Se ignora si viene `materiaFija`.
  materias?: MateriaOpcion[];
  // Desde el detalle de una materia la materia ya está decidida: se muestra
  // como contexto, sin picker.
  materiaFija?: MateriaOpcion;
  // Día con el que arranca el campo Fecha (p. ej. el día elegido en la
  // vista Calendario de Agenda). Sin esto, hoy.
  fechaInicial?: string;
};

const FECHA_QUICK_LABELS = ["Hoy", "Mañana", "Pasado", "En una semana"];
const FECHA_QUICK_OFFSETS = [0, 1, 2, 7];

// Opciones rápidas de fecha para el sheet de creación — sin agregar una
// dependencia nativa de date-picker sólo para esto (ver critique P2: antes
// todo ítem nuevo nacía "hoy" sin poder elegir, corrompiendo el
// agrupamiento de Agenda). Cubre el caso real de uso: cargar algo que ya
// se sabe hoy/mañana/en unos días, no un calendario completo.
function fechaQuickOptions() {
  const base = today();
  return FECHA_QUICK_OFFSETS.map((offset, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    return { value: toISODate(d), label: FECHA_QUICK_LABELS[i]! };
  });
}

function CampoCrear({ label, children }: { label: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.smd }}>
      <AppText weight="500" style={{ fontSize: 12, color: colors.textTertiary }}>
        {label}
      </AppText>
      {children}
    </View>
  );
}

// Crear evaluación/tarea/evento — compartido entre Agenda (con picker de
// materia) y el detalle de una materia (materia fija).
export function CrearItemSheet({ modo, onClose, onCrear, materias = [], materiaFija, fechaInicial }: Props) {
  const { colors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();

  const [titulo, setTitulo] = useState("");
  const [materiaId, setMateriaId] = useState("");
  const [todoElDia, setTodoElDia] = useState(true);
  const [fecha, setFecha] = useState(() => toISODate(today()));
  const [calendarioAbierto, setCalendarioAbierto] = useState(false);
  const [conHorario, setConHorario] = useState(false);
  const [hora, setHora] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Formulario limpio cada vez que se abre. Se compara por tipo y no por
  // identidad del objeto: un `modo` literal nuevo en cada render del padre
  // no debe borrar lo que se viene escribiendo.
  const modoKey = modo ? (modo.kind === "materia" ? modo.itemKind : "personal") : null;
  useEffect(() => {
    if (!modoKey) return;
    setTitulo("");
    setMateriaId(materiaFija?.id ?? materias[0]?.id ?? "");
    setTodoElDia(true);
    setFecha(fechaInicial ?? toISODate(today()));
    setCalendarioAbierto(false);
    setConHorario(false);
    setHora("");
    setGuardando(false);
    // Sólo al abrir/cambiar de modo — no pisar la selección si cambia la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoKey]);

  const esMateria = modo?.kind === "materia";
  const puedeCrear = !!titulo.trim() && (!esMateria || !!materiaId) && !guardando;

  const confirmar = async () => {
    if (!modo || !puedeCrear) return;
    const horaValida = conHorario && /^([01]?\d|2[0-3]):[0-5]\d$/.test(hora.trim()) ? hora.trim() : undefined;
    setGuardando(true);
    try {
      await onCrear({ titulo: titulo.trim(), fecha, materiaId, hora: horaValida, todoElDia });
    } finally {
      setGuardando(false);
    }
  };

  const encabezado = modo?.kind === "personal" ? "Nuevo evento personal" : modo?.kind === "materia" && modo.itemKind === "evaluacion" ? "Nueva evaluación" : "Nueva tarea";

  return (
    <BottomSheet visible={!!modo} onClose={onClose}>
      <AppText weight="600" style={{ fontSize: 19, letterSpacing: -0.1 }}>
        {encabezado}
      </AppText>

      {/* Formulario con scroll propio: al abrir el calendario o el teclado
          el sheet no puede crecer más que la pantalla, y Cancelar/Crear
          quedan siempre a la vista fuera del scroll. */}
      <ScrollView
        style={{ maxHeight: windowHeight * 0.55 }}
        contentContainerStyle={{ gap: spacing.xl, paddingBottom: spacing.xs }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TextInput
          value={titulo}
          onChangeText={setTitulo}
          placeholder={modo?.kind === "materia" ? (modo.itemKind === "evaluacion" ? "Ej: Primer parcial" : "Ej: TP 1") : "Título"}
          placeholderTextColor={colors.textFaint}
          autoFocus={!!materiaFija}
          style={{
            height: 52,
            borderRadius: radii.sm,
            backgroundColor: colors.bg,
            paddingHorizontal: spacing.lg,
            fontSize: 17,
            color: colors.text,
            fontFamily: "InstrumentSans_600SemiBold",
          }}
        />

        {esMateria ? (
          <CampoCrear label="Materia">
            {materiaFija ? (
              <View style={{ flexDirection: "row" }}>
                <Pill
                  label={materiaFija.nombre}
                  color={materiaColors[materiaFija.colorId].strong}
                  background={materiaColors[materiaFija.colorId].soft}
                  style={{ height: 36, paddingHorizontal: 14 }}
                />
              </View>
            ) : materias.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm }}>
                {materias.map((m) => (
                  <PressableScale key={m.id} scaleTo={0.96} onPress={() => setMateriaId(m.id)}>
                    <Pill
                      label={m.nombre}
                      color={materiaId === m.id ? materiaColors[m.colorId].strong : colors.textSecondary}
                      background={materiaId === m.id ? materiaColors[m.colorId].soft : colors.surfaceSoft}
                      style={{ height: 36, paddingHorizontal: 14 }}
                    />
                  </PressableScale>
                ))}
              </ScrollView>
            ) : (
              <AppText style={{ fontSize: 13, color: colors.textTertiary }}>No tenés materias cargadas en el semestre activo todavía.</AppText>
            )}
          </CampoCrear>
        ) : null}

        <CampoCrear label="Fecha">
          <PressableScale
            scaleTo={0.99}
            onPress={() => setCalendarioAbierto((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={`Fecha: ${formatFechaAgenda(fecha)}. Abrir calendario`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              height: 52,
              paddingHorizontal: spacing.lg,
              borderRadius: radii.sm,
              backgroundColor: colors.bg,
              borderWidth: 1,
              borderColor: calendarioAbierto ? colors.accent : "transparent",
            }}
          >
            <AppIcon name="calendar-outline" size={18} color={colors.textSecondary} />
            <AppText mono style={{ fontSize: 16, flex: 1 }}>
              {formatFechaAgenda(fecha)}
            </AppText>
            <AppIcon name={calendarioAbierto ? "chevron-up" : "chevron-down"} size={14} color={colors.textTertiary} />
          </PressableScale>
          {calendarioAbierto ? (
            <MiniCalendario
              seleccionado={fecha}
              onSeleccionar={(iso) => {
                setFecha(iso);
                setCalendarioAbierto(false);
              }}
            />
          ) : (
            // Atajos como texto plano (sin relleno): así no se confunden
            // con las píldoras de materia, que sí son selección con fondo.
            <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: spacing.xl }}>
              {fechaQuickOptions().map((o) => (
                <PressableScale key={o.value} scaleTo={0.96} onPress={() => setFecha(o.value)} style={{ minHeight: 36, justifyContent: "center" }}>
                  <AppText weight={fecha === o.value ? "600" : "500"} style={{ fontSize: 14, color: fecha === o.value ? colors.accentText : colors.textSecondary }}>
                    {o.label}
                  </AppText>
                </PressableScale>
              ))}
            </View>
          )}
        </CampoCrear>

        <CampoCrear label="Horario">
          {esMateria ? (
            <>
              <Segmented
                options={[
                  { value: "sin", label: "Sin horario" },
                  { value: "con", label: "Con horario" },
                ]}
                value={conHorario ? "con" : "sin"}
                onChange={(v) => {
                  setConHorario(v === "con");
                  if (v === "sin") setHora("");
                }}
              />
              {conHorario ? (
                <TextInput
                  value={hora}
                  onChangeText={setHora}
                  placeholder="HH:MM"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  style={{
                    height: 48,
                    borderRadius: radii.sm,
                    backgroundColor: colors.bg,
                    paddingHorizontal: spacing.lg,
                    fontSize: 16,
                    color: colors.text,
                    fontFamily: "InstrumentSans_600SemiBold",
                  }}
                />
              ) : null}
            </>
          ) : (
            <Segmented
              options={[
                { value: "dia", label: "Todo el día" },
                { value: "hora", label: "Con horario" },
              ]}
              value={todoElDia ? "dia" : "hora"}
              onChange={(v) => setTodoElDia(v === "dia")}
            />
          )}
        </CampoCrear>
      </ScrollView>

      <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.xs }}>
        <PrimaryButton label="Cancelar" variant="ghost" flex onPress={onClose} />
        <PrimaryButton label="Crear" flex disabled={!puedeCrear} onPress={confirmar} />
      </View>
    </BottomSheet>
  );
}
