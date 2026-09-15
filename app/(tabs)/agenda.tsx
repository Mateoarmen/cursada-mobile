import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AgendaScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Agenda</Text>
      {/* TODO: listar eventos de agenda (parciales, entregas, finales) ordenados por fecha */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: "700" },
});
