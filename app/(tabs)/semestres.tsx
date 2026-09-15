import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { Semestre } from "@/types/database";

export default function SemestresScreen() {
  const [semestres, setSemestres] = useState<Semestre[]>([]);

  useEffect(() => {
    supabase
      .from("semestres")
      .select("*")
      .then(({ data }) => setSemestres(data ?? []));
  }, []);

  const activarSemestre = async (id: string) => {
    // TODO: replicar la lógica de "semestre activo" que ya existe en la versión web
    // (probablemente actualizar un flag en la tabla semestres o en el perfil del usuario)
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Semestres</Text>
      <FlatList
        data={semestres}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, item.activo && styles.cardActive]}
            onPress={() => activarSemestre(item.id)}
          >
            <Text style={styles.cardText}>{item.nombre}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text>No hay semestres cargados todavía.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 16 },
  card: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardActive: { backgroundColor: "#111" },
  cardText: { fontSize: 16, fontWeight: "600" },
});
