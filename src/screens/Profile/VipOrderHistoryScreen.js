// src/screens/Profile/VipOrderHistoryScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useContext, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import client from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';
import { AuthContext } from '../../context/AuthContext';

function formatTime(text) {
    if (!text) return '';
    try {
        return new Date(text).toLocaleString();
    } catch {
        return String(text);
    }
}

function formatMoney(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '';
    return `${num.toLocaleString('en-US')} VND`;
}

function normalizeOrders(data) {
    if (!data) return [];
    const list = data?.items || data?.results || data?.orders || data;
    return Array.isArray(list) ? list : [];
}

export default function VipOrderHistoryScreen({ navigation, route }) {
    const isFocused = useIsFocused();
    const { userToken } = useContext(AuthContext);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [userId, setUserId] = useState(
        route?.params?.userId ? String(route.params.userId) : null
    );

    const resolveUserId = async () => {
        if (userId) return userId;
        try {
            const res = await client.get(ENDPOINTS.PROFILE);
            const data = res?.data || {};
            const id = data?.id || data?.user_id || data?.userId;
            if (id) {
                const idText = String(id);
                setUserId(idText);
                return idText;
            }
        } catch {
            // ignore
        }
        return null;
    };

    const loadOrders = async () => {
        if (!userToken) {
            setItems([]);
            return;
        }
        setLoading(true);
        try {
            const uid = userId || (await resolveUserId());
            if (!uid) {
                setItems([]);
                return;
            }
            const res = await client.get(ENDPOINTS.MEMBERSHIP_ORDERS(uid));
            setItems(normalizeOrders(res?.data));
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isFocused) loadOrders();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFocused, userToken, userId]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadOrders();
        setRefreshing(false);
    };

    const emptyText = useMemo(() => {
        if (!userToken) return 'Vui long dang nhap de xem lich su VIP.';
        if (loading) return 'Dang tai lich su VIP...';
        return 'Chua co lich su VIP.';
    }, [userToken, loading]);

    const renderItem = ({ item }) => {
        const planName = item?.plan_name || item?.plan || item?.plan_code || 'Goi VIP';
        const status = item?.status || item?.state || item?.payment_status || 'unknown';
        const amountText = formatMoney(item?.amount_vnd || item?.amount || item?.price);
        const createdAt = item?.created_at || item?.created || item?.createdAt;
        const expiredAt = item?.expired_at || item?.end_at || item?.end_date;
        const note = item?.transfer_note || item?.note || item?.description;
        const orderCode = item?.code || item?.order_code || item?.id;

        return (
            <View style={styles.card}>
                <View style={styles.rowBetween}>
                    <Text style={styles.title}>{planName}</Text>
                    <View style={styles.statusPill}>
                        <Text style={styles.statusText}>{String(status).toUpperCase()}</Text>
                    </View>
                </View>
                {orderCode ? <Text style={styles.meta}>Ma don: {String(orderCode)}</Text> : null}
                {amountText ? <Text style={styles.meta}>So tien: {amountText}</Text> : null}
                {createdAt ? <Text style={styles.meta}>Tao luc: {formatTime(createdAt)}</Text> : null}
                {expiredAt ? <Text style={styles.meta}>Het han: {formatTime(expiredAt)}</Text> : null}
                {note ? <Text style={styles.note}>{String(note)}</Text> : null}
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="black" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Lịch sử nâng cấp VIP</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading && items.length === 0 ? (
                <View style={styles.loading}>
                    <ActivityIndicator />
                </View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item, index) => String(item?.id ?? item?.order_id ?? index)}
                    renderItem={renderItem}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle={items.length === 0 ? styles.emptyWrap : styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="star-outline" size={48} color="#999" />
                            <Text style={styles.emptyText}>{emptyText}</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        paddingTop: 40,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 15 },
    emptyWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyState: { alignItems: 'center', gap: 10 },
    emptyText: { color: '#666', fontSize: 14, textAlign: 'center' },

    card: {
        padding: 14,
        borderWidth: 1,
        borderColor: '#EEE',
        borderRadius: 12,
        marginBottom: 12,
        backgroundColor: '#fff',
    },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 15, fontWeight: 'bold', color: '#111' },
    statusPill: {
        backgroundColor: '#F4B400',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
    },
    statusText: { fontSize: 10, fontWeight: '800', color: '#111' },
    meta: { marginTop: 6, color: '#555', fontSize: 13 },
    note: { marginTop: 8, color: '#333', fontSize: 13 },
});
