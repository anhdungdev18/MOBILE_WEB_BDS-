// src/screens/Post/PickLocationScreen.js
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const isWeb = Platform.OS === 'web';
const maps = !isWeb ? require('react-native-maps') : null;
const MapView = maps ? maps.default : null;
const Marker = maps ? maps.Marker : null;

export default function PickLocationScreen({ navigation, route }) {
    const initial = route?.params?.initialLocation || null;

    const [loading, setLoading] = useState(false);
    const [picked, setPicked] = useState(initial);

    // ✅ nếu initialLocation thay đổi, đồng bộ lại marker
    useEffect(() => {
        if (initial?.lat && initial?.lng) {
            setPicked(initial);
        }
    }, [initial?.lat, initial?.lng]);

    const region = useMemo(() => {
        const lat = picked?.lat || initial?.lat || 10.8231;
        const lng = picked?.lng || initial?.lng || 106.6297;
        return {
            latitude: lat,
            longitude: lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        };
    }, [picked?.lat, picked?.lng, initial?.lat, initial?.lng]);

    const requestAndGetCurrent = async () => {
        try {
            setLoading(true);
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Thiếu quyền', 'Bạn cần cấp quyền vị trí để dùng tính năng này.');
                return;
            }

            const pos = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            setPicked({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch (e) {
            console.log('getCurrentPosition error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // nếu chưa có initial, lấy vị trí hiện tại để map mở ra gần bạn
        if (!initial?.lat || !initial?.lng) requestAndGetCurrent();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onSave = () => {
        if (!picked?.lat || !picked?.lng) {
            Alert.alert('Thiếu vị trí', 'Bạn hãy ghim một điểm trên bản đồ.');
            return;
        }

        // ✅ Trả vị trí về CreatePost bằng callback để không mất dữ liệu đã nhập
        const cb = route?.params?.onPicked;
        if (typeof cb === 'function') {
            cb(picked);
        }

        navigation.goBack();
    };

    if (isWeb) {
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

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={22} color="#111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Ghim vị trí</Text>
                <TouchableOpacity onPress={onSave} style={styles.headerBtn}>
                    <Ionicons name="save-outline" size={22} color="#111" />
                </TouchableOpacity>
            </View>

            <MapView
                style={styles.map}
                initialRegion={region}
                onLongPress={(e) => {
                    const { latitude, longitude } = e.nativeEvent.coordinate;
                    setPicked({ lat: latitude, lng: longitude });
                }}
            >
                {picked?.lat && picked?.lng ? (
                    <Marker coordinate={{ latitude: picked.lat, longitude: picked.lng }} />
                ) : null}
            </MapView>

            <View style={styles.bottomPanel}>
                <Text style={styles.tip}>
                    Nhấn giữ trên bản đồ để ghim. Sau đó bấm icon lưu (💾) để quay lại.
                </Text>

                <View style={styles.row}>
                    <TouchableOpacity
                        style={[styles.btn, loading && { opacity: 0.5 }]}
                        onPress={requestAndGetCurrent}
                        disabled={loading}
                    >
                        <Ionicons name="locate-outline" size={18} color="#111" />
                        <Text style={styles.btnText}>Vị trí hiện tại</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={onSave}>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#111" />
                        <Text style={[styles.btnText, { fontWeight: '900' }]}>Lưu vị trí</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.coords}>
                    {picked?.lat && picked?.lng
                        ? `Đã ghim: ${picked.lat.toFixed(6)}, ${picked.lng.toFixed(6)}`
                        : 'Chưa ghim điểm nào'}
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

    map: { flex: 1 },

    bottomPanel: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        backgroundColor: '#fff',
    },
    webFallback: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        backgroundColor: '#fff',
    },
    webTitle: { fontSize: 16, fontWeight: '900', color: '#111', textAlign: 'center' },
    webText: { marginTop: 8, color: '#666', textAlign: 'center' },
    tip: { color: '#666', lineHeight: 18 },
    row: { flexDirection: 'row', gap: 10, marginTop: 10 },
    btn: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        paddingVertical: 12,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
        backgroundColor: '#fff',
    },
    btnPrimary: { backgroundColor: '#FFB800', borderColor: '#FFB800' },
    btnText: { color: '#111', fontWeight: '800' },
    coords: { marginTop: 10, color: '#111', fontWeight: '900' },
});
