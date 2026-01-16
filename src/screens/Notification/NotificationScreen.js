import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
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

function iconForType(type) {
    if (type === 'message') return 'chatbubbles-outline';
    if (type === 'comment') return 'chatbox-outline';
    if (type === 'favorite') return 'heart-outline';
    if (type === 'post_status') return 'pricetag-outline';
    if (type === 'membership') return 'star-outline';
    return 'notifications-outline';
}

function formatTime(text) {
    if (!text) return '';
    try {
        return new Date(text).toLocaleString();
    } catch {
        return String(text);
    }
}

function buildWsUrl(token) {
    const base = client?.defaults?.baseURL || '';
    if (!base) return null;
    const wsBase = base.replace(/^http/i, 'ws').replace(/\/$/, '');
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${wsBase}/ws/notifications/${qs}`;
}

export default function NotificationScreen({ navigation }) {
    const isFocused = useIsFocused();
    const { userToken } = useContext(AuthContext);

    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [postTitleMap, setPostTitleMap] = useState({});
    const socketRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const reconnectAttemptRef = useRef(0);
    const isConnectingRef = useRef(false);

    const loadNotifications = async () => {
        if (!userToken) {
            setItems([]);
            return;
        }

        try {
            setLoading(true);
            const res = await client.get(ENDPOINTS.NOTIFICATIONS);
            const list = res?.data?.items || [];
            setItems(Array.isArray(list) ? list : []);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    const markRead = async (ids, markAll = false) => {
        if (!userToken) return;
        try {
            await client.post(ENDPOINTS.NOTIFICATIONS_MARK_READ, {
                ids: ids || [],
                mark_all: markAll,
            });
        } catch {
            // ignore
        }
    };

    useEffect(() => {
        if (isFocused) loadNotifications();
    }, [isFocused, userToken]);

    const handleIncoming = (payload) => {
        const id = payload?.id ? String(payload.id) : null;
        if (!id) return;
        setItems((prev) => {
            if (prev.some((x) => String(x?.id) === id)) return prev;
            return [payload, ...(prev || [])];
        });
    };

    const scheduleReconnect = () => {
        if (reconnectTimerRef.current) return;
        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(8000, 1200 + attempt * 1500);
        reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            reconnectAttemptRef.current += 1;
            connectWs();
        }, delay);
    };

    const connectWs = async () => {
        if (isConnectingRef.current) return;
        isConnectingRef.current = true;
        try {
            const token = await AsyncStorage.getItem('access_token');
            const wsUrl = buildWsUrl(token);
            if (!wsUrl) {
                isConnectingRef.current = false;
                return;
            }

            if (socketRef.current) {
                socketRef.current.close();
            }

            const ws = new WebSocket(wsUrl);
            socketRef.current = ws;

            ws.onopen = () => {
                reconnectAttemptRef.current = 0;
                isConnectingRef.current = false;
            };
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event?.data || '{}');
                    handleIncoming(data);
                } catch {
                    // ignore
                }
            };
            ws.onerror = () => {
                isConnectingRef.current = false;
                scheduleReconnect();
            };
            ws.onclose = () => {
                isConnectingRef.current = false;
                scheduleReconnect();
            };
        } catch {
            isConnectingRef.current = false;
            scheduleReconnect();
        }
    };

    useEffect(() => {
        if (!isFocused || !userToken) return;
        connectWs();
        return () => {
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            if (socketRef.current) socketRef.current.close();
        };
    }, [isFocused, userToken]);

    useEffect(() => {
        const loadPostTitles = async () => {
            if (!userToken) return;
            const candidates = (items || [])
                .filter((x) => x?.target_id && (x?.type === 'post_status' || x?.target_type === 'post' || x?.target_type === 'listing'))
                .map((x) => String(x.target_id));

            const unique = Array.from(new Set(candidates)).filter((id) => !postTitleMap?.[id]);
            if (unique.length === 0) return;

            const next = { ...(postTitleMap || {}) };
            for (const id of unique) {
                try {
                    const res = await client.get(ENDPOINTS.POST_DETAIL(id));
                    const data = res?.data?.result || res?.data;
                    const title = data?.title;
                    if (title) next[id] = title;
                } catch {
                    // ignore
                }
            }
            setPostTitleMap(next);
        };

        loadPostTitles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items.length, userToken]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadNotifications();
        setRefreshing(false);
    };

    const onPressItem = async (item) => {
        if (!userToken) {
            navigation.navigate('Login');
            return;
        }

        if (!item?.is_read) {
            setItems((prev) =>
                prev.map((x) => (String(x?.id) === String(item?.id) ? { ...x, is_read: true } : x))
            );
            await markRead([item?.id]);
        }

        const targetType = item?.target_type;
        const targetId = item?.target_id;
        if (targetType === 'room' && targetId) {
            navigation.navigate('Chat', {
                screen: 'ChatRoom',
                params: { roomId: targetId },
            });
            return;
        }

        if ((targetType === 'post' || targetType === 'listing') && targetId) {
            navigation.navigate('PostDetail', { postId: targetId, id: targetId });
        }
    };

    const markAllRead = async () => {
        if (items.length === 0) return;
        setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
        await markRead([], true);
    };

    const emptyText = useMemo(() => {
        if (!userToken) return 'Bạn cần đăng nhập để xem thông báo.';
        if (loading) return 'Đang tải thông báo...';
        return 'Chưa có thông báo nào.';
    }, [userToken, loading]);

    const renderItem = ({ item }) => {
        const isNew = !item?.is_read;
        const postTitle = item?.target_id ? postTitleMap?.[String(item.target_id)] : null;
        const ratingScore = item?.extra?.score;
        const ratingText =
            item?.title === 'Đánh giá mới' && Number.isFinite(Number(ratingScore))
                ? ` (${Number(ratingScore)} sao)`
                : '';
        const displayTitle = postTitle ? `${item?.title || 'Bai dang'}: ${postTitle}` : item?.title || 'Thong bao';
        return (
            <TouchableOpacity style={[styles.item, isNew && styles.newItem]} onPress={() => onPressItem(item)}>
                <View style={styles.iconContainer}>
                    <Ionicons name={iconForType(item?.type)} size={22} color={isNew ? '#FFB800' : '#999'} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{displayTitle}{ratingText}</Text>
                    {item?.content ? <Text style={styles.desc}>{item.content}</Text> : null}
                    <Text style={styles.time}>{formatTime(item?.created_at)}</Text>
                </View>
                {isNew && <View style={styles.dot} />}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="black" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Thông báo</Text>
                <TouchableOpacity onPress={markAllRead} disabled={items.length === 0}>
                    <Text style={[styles.headerAction, items.length === 0 && { opacity: 0.5 }]}>Đã đọc hết</Text>
                </TouchableOpacity>
            </View>

            {loading && items.length === 0 ? (
                <View style={styles.loading}>
                    <ActivityIndicator />
                </View>
            ) : (
                <FlatList
                    data={items}
                    keyExtractor={(item) => String(item?.id)}
                    renderItem={renderItem}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle={items.length === 0 ? styles.emptyWrap : styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="notifications-outline" size={48} color="#999" />
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
    headerAction: { fontSize: 12, fontWeight: '800', color: '#111' },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 15 },
    emptyWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyState: { alignItems: 'center', gap: 10 },
    emptyText: { color: '#666', fontSize: 14, textAlign: 'center' },

    item: {
        flexDirection: 'row',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        alignItems: 'flex-start',
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: '#fff',
    },
    newItem: { backgroundColor: '#fffcf0' },
    iconContainer: { marginRight: 12, marginTop: 2 },
    title: { fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
    desc: { fontSize: 13, color: '#555', lineHeight: 18 },
    time: { fontSize: 11, color: '#999', marginTop: 6 },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'red',
        position: 'absolute',
        right: 10,
        top: 16,
    },
});
