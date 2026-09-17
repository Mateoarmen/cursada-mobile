import { useState } from "react";
import { Alert } from "react-native";
import type { EscalaTipo, Materia } from "@/types/database";
import { materiaColors, type EstadoMateria, type MateriaColorId } from "@/theme/tokens";
import type { MateriaBloqueInput, MateriaEscInput, MateriaFormInput } from "@/lib/materias";

// Estado + validaciones del alta/edición de Materia, compartido por el
// wizard de alta (app/materia/nueva.tsx, paso a paso) y la pantalla de
// edición (app/materia/form.tsx, todo en una) — mismos campos, mismas
// reglas, un solo lugar (ver prompt original: nombre no vacío, total>0 si
// no es "nota", aprob<=total, exoneración>=aprob).
export function useMateriaFormState() {
  const [nombre, setNombre] = useState("");
  const [doc, setDoc] = useState("");
  const [colorId, setColorId] = useState<MateriaColorId>("azul");
  const [salon, setSalon] = useState("");
  const [estado, setEstado] = useState<EstadoMateria>("cursando");
  const [bloques, setBloques] = useState<MateriaBloqueInput[]>([]);
  const [escTipo, setEscTipo] = useState<EscalaTipo>("nota");
  const [escTotal, setEscTotal] = useState("12");
  const [escAprob, setEscAprob] = useState("6");
  const [escExon, setEscExon] = useState<string | null>(null);

  const cargarDesde = (m: Materia) => {
    setNombre(m.nombre);
    setDoc(m.doc ?? "");
    setColorId((m.color_id && m.color_id in materiaColors ? m.color_id : "gris") as MateriaColorId);
    setSalon(m.salon ?? "");
    setEstado(m.estado);
    setBloques(m.bloques ?? []);
    const esc = "tipo" in m.esc ? m.esc : null;
    setEscTipo(esc?.tipo ?? "nota");
    setEscTotal(String(esc?.total ?? 12));
    setEscAprob(String(esc?.aprob ?? 6));
    setEscExon(esc?.exoneracion != null ? String(esc.exoneracion) : null);
  };

  const onCambiarTipo = (t: EscalaTipo) => {
    setEscTipo(t);
    if (t === "nota") setEscTotal("12");
  };

  const agregarFranja = (b: MateriaBloqueInput) => setBloques((prev) => [...prev, b]);
  const quitarFranja = (i: number) => setBloques((prev) => prev.filter((_, idx) => idx !== i));

  const validarBasicos = (): boolean => {
    if (!nombre.trim()) {
      Alert.alert("Falta el nombre", "Ingresá el nombre de la materia.");
      return false;
    }
    return true;
  };

  const validarCalificacion = (): MateriaEscInput | null => {
    const total = escTipo === "nota" ? 12 : Number(escTotal.replace(",", "."));
    if (escTipo !== "nota" && !(total > 0)) {
      Alert.alert("Total inválido", "El total de la escala tiene que ser mayor a 0.");
      return null;
    }
    const aprob = Number(escAprob.replace(",", "."));
    if (Number.isNaN(aprob) || aprob > total) {
      Alert.alert("Nota de aprobación inválida", "No puede ser mayor al total de la escala.");
      return null;
    }
    let exoneracion: number | undefined;
    if (escExon != null && escExon.trim()) {
      exoneracion = Number(escExon.replace(",", "."));
      if (Number.isNaN(exoneracion) || exoneracion < aprob) {
        Alert.alert("Exoneración inválida", "No puede ser menor que la nota de aprobación.");
        return null;
      }
    }
    return { tipo: escTipo, total, aprob, exoneracion };
  };

  // Corre las dos validaciones y arma el input listo para crearMateria/
  // actualizarMateria — null si alguna falló (el Alert ya se mostró).
  const construir = (): MateriaFormInput | null => {
    if (!validarBasicos()) return null;
    const esc = validarCalificacion();
    if (!esc) return null;
    return { nombre: nombre.trim(), doc: doc.trim(), colorId, salon: salon.trim(), estado, bloques, esc };
  };

  return {
    nombre,
    setNombre,
    doc,
    setDoc,
    colorId,
    setColorId,
    salon,
    setSalon,
    estado,
    setEstado,
    bloques,
    agregarFranja,
    quitarFranja,
    escTipo,
    onCambiarTipo,
    escTotal,
    setEscTotal,
    escAprob,
    setEscAprob,
    escExon,
    setEscExon,
    cargarDesde,
    validarBasicos,
    validarCalificacion,
    construir,
  };
}

export type MateriaFormState = ReturnType<typeof useMateriaFormState>;
