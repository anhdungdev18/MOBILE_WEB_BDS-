import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PickLocationScreen({ navigation }) {
    return (
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={22} color="#111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Ghim vị trí</Text>
                <View style={styles.headerBtn} />
            </View>

            <View style={styles.webFallback}>
                <Text style={styles.webTitle}>Bản đồ chưa hỗ trợ trên web.</Text>
                <Text style={styles.webText}>
                    Hãy chạy app trên Android emulator hoặc thiết bị thật để chọn vị trí.
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#fff' },
    header: {
        height: 52,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        backgroundColor: '#fff',
    },
    headerBtn: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontWeight: '900', color: '#111' },
    webFallback: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        backgroundColor: '#fff',
    },
    webTitle: { fontSize: 16, fontWeight: '900', color: '#111', textAlign: 'center' },
    webText: { marginTop: 8, color: '#666', textAlign: 'center' },
});
