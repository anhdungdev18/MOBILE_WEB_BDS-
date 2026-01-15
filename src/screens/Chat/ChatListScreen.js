import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
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

function RoomItem({ room, meId, userMap, onPress }) {
    const otherId = room?.buyer_id === meId ? room?.seller_id : room?.buyer_id;
    const other = otherId ? userMap?.[otherId] : null;
    const displayName =
        other?.username ||
        other?.full_name ||
        other?.name ||
        (otherId ? `User #${otherId}` : 'Người dùng');

    return (
        <TouchableOpacity style={styles.roomItem} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.avatar}>
                <Ionicons name="person-outline" size={20} color="#666" />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.roomName} numberOfLines={1}>
                    {displayName}
                </Text>
                <Text style={styles.roomSub} numberOfLines={1}>
                    Phòng: {room?.room_id || room?.id}
                </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#999" />
        </TouchableOpacity>
    );
}

export default function ChatListScreen() {
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    const [rooms, setRooms] = useState([]);
    const [meId, setMeId] = useState(null);
    const [userMap, setUserMap] = useState({});
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const fetchMe = async () => {
        try {
            const res = await client.get(ENDPOINTS.PROFILE);
            const id = res?.data?.id;
            if (id) setMeId(id);
        } catch {
            setMeId(null);
        }
    };

    const fetchRooms = async () => {
        try {
            setLoading(true);
            const res = await client.get(ENDPOINTS.CHAT_ROOMS_MY);
            const list = res?.data?.rooms || [];
            setRooms(Array.isArray(list) ? list : []);
        } catch {
            setRooms([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async (roomList, myId) => {
        const ids = Array.from(
            new Set(
                (roomList || [])
                    .map((r) => (r?.buyer_id === myId ? r?.seller_id : r?.buyer_id))
                    .filter(Boolean)
            )
        );

        if (ids.length === 0) return;

        const next = { ...(userMap || {}) };
        for (const id of ids) {
            if (next[id]) continue;
            try {
                const res = await client.get(ENDPOINTS.USER_PUBLIC_PROFILE(id));
                const data = res?.data?.result || res?.data;
                if (data) next[id] = data;
            } catch {
                // ignore
            }
        }
        setUserMap(next);
    };

    const loadData = async () => {
        await fetchMe();
        await fetchRooms();
    };

    useEffect(() => {
        if (!isFocused) return;
        loadData();
    }, [isFocused]);

    useEffect(() => {
        if (!meId) return;
        fetchUsers(rooms, meId);
    }, [rooms, meId]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const emptyText = useMemo(() => {
        if (loading) return 'Đang tải...';
        return 'Bạn chưa có cuộc trò chuyện nào.';
    }, [loading]);

    const openRoom = (room) => {
        const roomId = room?.room_id || room?.id;
        if (!roomId) return;
        const otherId = room?.buyer_id === meId ? room?.seller_id : room?.buyer_id;
        const other = otherId ? userMap?.[otherId] : null;
        const displayName =
            other?.username ||
            other?.full_name ||
            other?.name ||
            (otherId ? `User #${otherId}` : 'Người dùng');

        navigation.navigate('ChatRoom', {
            roomId,
            otherUserId: otherId,
            otherUserName: displayName,
        });
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Tin nhắn</Text>
            </View>

            {loading && rooms.length === 0 ? (
                <View style={styles.loading}>
                    <ActivityIndicator />
                </View>
            ) : (
                <FlatList
                    data={rooms}
                    keyExtractor={(item) => String(item?.room_id || item?.id)}
                    renderItem={({ item }) => (
                        <RoomItem room={item} meId={meId} userMap={userMap} onPress={() => openRoom(item)} />
                    )}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle={rooms.length === 0 ? styles.emptyWrap : styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="chatbubbles-outline" size={48} color="#999" />
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
    header: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 10 },
    headerTitle: { fontSize: 22, fontWeight: '900', color: '#111' },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingHorizontal: 16, paddingBottom: 16 },
    emptyWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyState: { alignItems: 'center', gap: 10 },
    emptyText: { color: '#666', fontSize: 14, textAlign: 'center' },
    roomItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
        gap: 12,
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    roomName: { fontSize: 16, fontWeight: '800', color: '#111' },
    roomSub: { fontSize: 12, color: '#666', marginTop: 2 },
});
