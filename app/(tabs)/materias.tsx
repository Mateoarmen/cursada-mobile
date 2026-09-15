import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { Materia } from "@/types/database";

export default function MateriasScreen() {
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: filtrar por el semestre activo (ver pantalla Semestres)
    supabase
      .from("materias")
      .select("*")
      .then(({ data }) => {
        setMaterias(data ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Materias</Text>
      <FlatList
        data={materias}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardText}>{item.nombre}</Text>
          </View>
        )}
        ListEmptyComponent={<Text>No hay materias cargadas todavía.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 16 },
  card: {
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardText: { fontSize: 16, fontWeight: "600" },
});
