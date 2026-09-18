// Recordatorios locales (Expo Notifications) — sin servidor, sin push
// remoto: todo se agenda y cancela en el dispositivo. Este módulo es dueño
// exclusivo de la cola de notificaciones locales de la app (no se usan
// notificaciones para nada más), así que `sincronizarNotificaciones` puede
// cancelar todo y reagendar desde cero sin riesgo de pisar algo ajeno.
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { EventoAgenda, Materia } from "@/types/database";
import { parseISODate, today } from "@/lib/agenda";

const PREFS_KEY = "cursada:notif-prefs";

export type NotifPrefs = {
  evaluaciones: boolean;
  tareas: boolean;
  clases: boolean;
};

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  evaluaciones: true,
  tareas: true,
  clases: true,
};

export async function getNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_NOTIF_PREFS;
    return { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_NOTIF_PREFS;
  }
}

export async function setNotifPrefs(prefs: NotifPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Pide permiso sólo cuando el usuario prende un toggle — no al abrir la
// app. Devuelve false si el usuario lo negó (para que el toggle vuelva a
// apagarse en vez de quedar prendido sin efecto).
export async function ensureNotifPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

function horaDecimalAMinutosAntes(decimal: number, minutosAntes: number): { hour: number; minute: number } {
  const totalMin = Math.max(0, Math.round(decimal * 60) - minutosAntes);
  return { hour: Math.floor(totalMin / 60) % 24, minute: totalMin % 60 };
}

// dia de bloques es 1=Lunes..6=Sábado (ver DIAS_BLOQUE en lib/catalog.ts);
// el trigger semanal de Expo usa 1=Domingo..7=Sábado (misma convención que
// `Date.getDay()` + 1) — de ahí el +1.
function diaBloqueAWeekday(dia: number): number {
  return dia + 1;
}

// Recalcula TODA la cola de recordatorios locales a partir del estado
// actual (preferencias + agenda + materias) — se llama al cambiar un
// toggle, al abrir la app, y en los puntos de mutación de agenda/horario
// más relevantes. Es más simple y confiable que tratar de mantener
// sincronizados ids individuales en cada mutación posible.
export async function sincronizarNotificaciones(prefs: NotifPrefs, agendaAll: EventoAgenda[], materiasAll: Materia[]): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const anyEnabled = prefs.evaluaciones || prefs.tareas || prefs.clases;
  if (!anyEnabled) return;
  const permiso = await Notifications.getPermissionsAsync();
  if (!permiso.granted) return;

  const materiaNombre = new Map(materiasAll.map((m) => [m.id, m.nombre]));
  const t = today();

  for (const item of agendaAll) {
    if (item.hecho) continue;
    const esEval = item.kind === "evaluacion";
    if (esEval && !prefs.evaluaciones) continue;
    if (!esEval && !prefs.tareas) continue;

    const fecha = parseISODate(item.fecha);
    const diffDias = Math.round((fecha.getTime() - t.getTime()) / 86400000);
    if (diffDias < 0) continue;

    const nombreMateria = item.materia_id ? (materiaNombre.get(item.materia_id) ?? "") : "";
    // Examen: recordatorio la tarde anterior. Tarea: recordatorio la
    // mañana del día de entrega (suelen vencer ese mismo día, no "antes").
    const disparo = esEval ? new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() - 1, 18, 0, 0) : new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 9, 0, 0);
    if (disparo.getTime() <= Date.now()) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: esEval ? `Mañana rendís ${item.titulo}` : `Hoy entregás ${item.titulo}`,
        body: nombreMateria || undefined,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: disparo },
    });
  }

  if (prefs.clases) {
    for (const materia of materiasAll) {
      for (const bloque of materia.bloques ?? []) {
        const { hour, minute } = horaDecimalAMinutosAntes(bloque.ini, 15);
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `Clase en 15 min: ${materia.nombre}`,
            body: materia.salon ? `Salón ${materia.salon}` : undefined,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: diaBloqueAWeekday(bloque.dia),
            hour,
            minute,
          },
        });
      }
    }
  }
}

// Android exige un canal para mostrar notificaciones con prioridad normal
// — sin esto igual se agendan pero el sistema puede no mostrarlas.
export async function configurarCanalAndroid(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Recordatorios",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}
