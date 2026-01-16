import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import client from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

const toAbsoluteMediaUrl = (maybePath) => {
    if (!maybePath) return '';
    const s = String(maybePath).trim();
    if (!s) return '';
    if (s.startsWith('http://') || s.startsWith('https://')) return s;

    const base = (client?.defaults?.baseURL || '').replace(/\/+$/, '');
    const path = s.replace(/^\/+/, '');
    return base ? `${base}/${path}` : s;
};

const getFullName = (data) => {
    const last =
        data?.last_name ||
        data?.lastname ||
        data?.lastName ||
        data?.user_last_name ||
        data?.owner_last_name ||
        data?.ho ||
        data?.last;
    const first =
        data?.first_name ||
        data?.firstname ||
        data?.firstName ||
        data?.user_first_name ||
        data?.owner_first_name ||
        data?.ten ||
        data?.first;
    return [last, first].filter(Boolean).join(' ').trim();
};

const getDisplayName = (profile) => {
    const full = getFullName(profile);
    const name = full || profile?.full_name || profile?.name || profile?.username;
    if (name) return String(name);
    return 'Nguoi dung';
};

const getAvatarUrl = (profile) => {
    const raw =
        profile?.avatar ||
        profile?.avatar_url ||
        profile?.anh_dai_dien ||
        profile?.image ||
        profile?.image_url ||
        '';
    return toAbsoluteMediaUrl(raw) || DEFAULT_AVATAR;
};

const getLastMessage = (room) => {
    return (
        room?.last_message ||
        room?.lastMessage ||
        room?.latest_message ||
        room?.latestMessage ||
        room?.last_msg ||
        null
    );
};

const getLastMessageKey = (room, lastMessage) => {
    const key =
        lastMessage?.id ||
        lastMessage?.message_id ||
        lastMessage?.messageId ||
        lastMessage?.pk ||
        lastMessage?.created_at ||
        lastMessage?.createdAt;
    if (key != null) return String(key);
    const fallback =
        room?.last_message_at || room?.lastMessageAt || room?.updated_at || room?.updatedAt || room?.lastMessageTime;
    return fallback ? String(fallback) : '';
};

const getMessageKey = (message) => {
    const key =
        message?.id ||
        message?.message_id ||
        message?.messageId ||
        message?.pk ||
        message?.created_at ||
        message?.createdAt;
    return key != null ? String(key) : '';
};

const getLastMessageText = (room, lastMessage) => {
    const text =
        lastMessage?.text ||
        lastMessage?.message ||
        lastMessage?.content ||
        room?.last_message_text ||
        room?.lastMessageText ||
        room?.last_text ||
        room?.lastText;
    return String(text || '').trim();
};

const getRoomId = (room) => String(room?.room_id || room?.id || '');

const getListingTitle = (room) => {
    const title =
        room?.listing_title ||
        room?.listingTitle ||
        room?.listing?.title ||
        room?.post_title ||
        room?.postTitle ||
        room?.title;
    return String(title || '').trim();
};

function RoomItem({ room, meId, userMap, onPress, onLongPress }) {
    const otherId = room?.buyer_id === meId ? room?.seller_id : room?.buyer_id;
    const other = otherId ? userMap?.[otherId] : null;
    const listingTitle = room?.__listingTitle || getListingTitle(room);
    const displayName = listingTitle || getDisplayName(other);
    const avatarUrl = getAvatarUrl(other);
    const lastMessage = getLastMessage(room);
    const lastMessageText = getLastMessageText(room, lastMessage) || 'Chua co tin nhan';
    const unreadCount = room?.unread_count || room?.unreadCount || room?.unread || 0;
    const isUnread = Boolean(unreadCount);
    const unreadText = unreadCount > 99 ? '99+' : String(unreadCount);

    return (
        <TouchableOpacity
            style={styles.roomItem}
            onPress={onPress}
            onLongPress={onLongPress}
            delayLongPress={350}
            activeOpacity={0.85}
        >
            <View style={styles.avatar}>
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            </View>
            <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                    <Text style={styles.roomName} numberOfLines={1}>
                        {displayName}
                    </Text>
                    {isUnread ? (
                        <View style={styles.unreadBadgeInline}>
                            <Text style={styles.unreadBadgeText}>{unreadText}</Text>
                        </View>
                    ) : null}
                </View>
                <Text style={[styles.roomSub, isUnread && styles.roomSubUnread]} numberOfLines={1}>
                    {lastMessageText}
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
    const [lastSeenMap, setLastSeenMap] = useState({});
    const [lastMessageMap, setLastMessageMap] = useState({});
    const [listingTitleMap, setListingTitleMap] = useState({});
    const roomsFetchRef = useRef(false);

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
        if (roomsFetchRef.current) return [];
        roomsFetchRef.current = true;
        try {
            setLoading(true);
            const res = await client.get(ENDPOINTS.CHAT_ROOMS_MY);
            const list = res?.data?.rooms || [];
            setRooms(Array.isArray(list) ? list : []);
            return Array.isArray(list) ? list : [];
        } catch {
            setRooms([]);
            return [];
        } finally {
            setLoading(false);
            roomsFetchRef.current = false;
        }
    };

    const hydrateLastMessages = async (roomList) => {
        const list = Array.isArray(roomList) ? roomList : [];
        if (list.length === 0) return;
        const next = { ...(lastMessageMap || {}) };

        for (const room of list) {
            const roomId = getRoomId(room);
            if (!roomId) continue;
            const existing = getLastMessage(room);
            if (existing) {
                next[roomId] = existing;
                continue;
            }
            const cached = next[roomId];
            const roomKey = getLastMessageKey(room, existing);
            const cachedKey = getMessageKey(cached);
            if (cached && (!roomKey || cachedKey === roomKey)) continue;
            try {
                const res = await client.get(ENDPOINTS.CHAT_ROOM_MESSAGES(roomId));
                const msgs = res?.data?.messages || [];
                const normalized = Array.isArray(msgs) ? msgs : [];
                const last = normalized[normalized.length - 1];
                if (last) next[roomId] = last;
            } catch {
                // ignore
            }
        }
        setLastMessageMap(next);
    };

    const hydrateListingTitles = async (roomList) => {
        const list = Array.isArray(roomList) ? roomList : [];
        if (list.length === 0) return;
        const next = { ...(listingTitleMap || {}) };

        for (const room of list) {
            const listingId = room?.listing_id || room?.listingId;
            if (!listingId) continue;
            const existing = getListingTitle(room);
            if (existing) {
                next[String(listingId)] = existing;
                continue;
            }
            if (next[String(listingId)]) continue;
            try {
                const res = await client.get(ENDPOINTS.POST_DETAIL(listingId));
                const data = res?.data?.result || res?.data;
                const title = data?.title ? String(data.title).trim() : '';
                if (title) next[String(listingId)] = title;
            } catch {
                // ignore
            }
        }
        setListingTitleMap(next);
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
        const list = await fetchRooms();
        await hydrateLastMessages(list);
        await hydrateListingTitles(list);
    };

    useEffect(() => {
        if (!isFocused) return;
        loadData();
    }, [isFocused]);

    useEffect(() => {
        if (!isFocused) return;
        const poll = setInterval(async () => {
            const list = await fetchRooms();
            await hydrateLastMessages(list);
            await hydrateListingTitles(list);
        }, 3000);
        return () => clearInterval(poll);
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

    const deleteRoomUi = (room) => {
        const roomId = room?.room_id || room?.id;
        if (!roomId) return;
        Alert.alert('Xóa đoạn chat', 'Bạn có chắc muốn xóa đoạn chat này?', [
            { text: 'Hủy', style: 'cancel' },
            {
                text: 'Xóa',
                style: 'destructive',
                onPress: () => {
                    setRooms((prev) => prev.filter((r) => String(r?.room_id || r?.id) !== String(roomId)));
                    setLastSeenMap((prev) => {
                        const next = { ...(prev || {}) };
                        delete next[String(roomId)];
                        return next;
                    });
                    setLastMessageMap((prev) => {
                        const next = { ...(prev || {}) };
                        delete next[String(roomId)];
                        return next;
                    });
                    const listingId = room?.listing_id || room?.listingId;
                    if (listingId) {
                        setListingTitleMap((prev) => {
                            const next = { ...(prev || {}) };
                            delete next[String(listingId)];
                            return next;
                        });
                    }
                },
            },
        ]);
    };

    const emptyText = useMemo(() => {
        if (loading) return '?ang t?i...';
        return 'Bạn chưa có cuộc trò chuyện nào';
    }, [loading]);

    const visibleRooms = useMemo(() => {
        return (rooms || []).filter((room) => {
            const roomId = getRoomId(room);
            const lastMessage = getLastMessage(room) || lastMessageMap?.[roomId];
            const lastText = getLastMessageText(room, lastMessage);
            return Boolean(lastMessage || lastText);
        });
    }, [rooms, lastMessageMap]);

    const openRoom = (room) => {
        const roomId = room?.room_id || room?.id;
        if (!roomId) return;
        const listingId = room?.listing_id || room?.listingId;
        const otherId = room?.buyer_id === meId ? room?.seller_id : room?.buyer_id;
        const other = otherId ? userMap?.[otherId] : null;
        const displayName = getDisplayName(other);
        const lastMessage = getLastMessage(room) || lastMessageMap?.[String(roomId)];
        const lastKey = getLastMessageKey(room, lastMessage);
        if (lastKey) {
            setLastSeenMap((prev) => ({ ...(prev || {}), [roomId]: lastKey }));
        }

        navigation.navigate('ChatRoom', {
            roomId,
            otherUserId: otherId,
            otherUserName: displayName,
            listingId,
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Tin nhắn</Text>
            </View>

            {loading && visibleRooms.length === 0 ? (
                <View style={styles.loading}>
                    <ActivityIndicator />
                </View>
            ) : (
                <FlatList
                    data={visibleRooms}
                    keyExtractor={(item) => String(item?.room_id || item?.id)}
                    renderItem={({ item }) => {
                        const roomId = item?.room_id || item?.id;
                        const listingId = item?.listing_id || item?.listingId;
                        const cachedTitle = listingId ? listingTitleMap?.[String(listingId)] : '';
                        const lastMessage = getLastMessage(item) || lastMessageMap?.[String(roomId)];
                        const lastKey = getLastMessageKey(item, lastMessage);
                        const seenKey = roomId ? lastSeenMap?.[roomId] : '';
                        const unreadCount = item?.unread_count || item?.unreadCount || item?.unread || 0;
                        const lastSenderId = lastMessage?.sender_id || lastMessage?.senderId || lastMessage?.user_id;
                        const isFromMe = meId && lastSenderId && String(lastSenderId) === String(meId);
                        const isUnread = !isFromMe && (unreadCount > 0 || (lastKey && seenKey !== lastKey));
                        const roomWithLast = lastMessage ? { ...item, last_message: lastMessage } : item;
                        const roomWithTitle = cachedTitle ? { ...roomWithLast, __listingTitle: cachedTitle } : roomWithLast;
                        const roomWithUnread = isUnread ? { ...roomWithTitle, unread_count: 1 } : roomWithTitle;
                        return (
                            <RoomItem
                                room={roomWithUnread}
                                meId={meId}
                                userMap={userMap}
                                onPress={() => openRoom(item)}
                                onLongPress={() => deleteRoomUi(item)}
                            />
                        );
                    }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle={visibleRooms.length === 0 ? styles.emptyWrap : styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="chatbubbles-outline" size={48} color="#999" />
                            <Text style={styles.emptyText}>{emptyText}</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
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
    avatarImage: { width: 42, height: 42, borderRadius: 21 },
    roomName: { fontSize: 16, fontWeight: '800', color: '#111' },
    roomSub: { fontSize: 12, color: '#666', marginTop: 2 },
    roomSubUnread: { fontWeight: '800', color: '#111' },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    unreadBadgeInline: {
        minWidth: 22,
        height: 22,
        paddingHorizontal: 6,
        borderRadius: 11,
        backgroundColor: '#FFB800',
        alignItems: 'center',
        justifyContent: 'center',
    },
    unreadBadgeText: { color: '#111', fontSize: 12, fontWeight: '800' },
});
