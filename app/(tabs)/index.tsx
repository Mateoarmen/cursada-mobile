import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function InicioScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Inicio</Text>
      {/* TODO: traer próximos vencimientos y resumen del semestre activo desde Supabase */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: "700" },
});
