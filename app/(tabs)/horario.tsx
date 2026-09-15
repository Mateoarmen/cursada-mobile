import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HorarioScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Horario</Text>
      {/* TODO: grilla semanal con los bloques de horario por materia */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: "700" },
});
