import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
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

function formatPriceVn(value) {
    if (value == null || Number.isNaN(Number(value))) return '—';
    try {
        return new Intl.NumberFormat('vi-VN').format(Number(value));
    } catch {
        return String(value);
    }
}

function addressToText(address) {
    if (!address) return '';
    if (typeof address === 'object') {
        const full = address.full || address.text || address.address;
        if (full) return String(full).trim();
        const joined = [address.street, address.ward, address.district, address.province]
            .filter(Boolean)
            .join(', ');
        return joined.trim();
    }
    return String(address).trim();
}

function buildWsUrl(roomId, token) {
    const base = client?.defaults?.baseURL || '';
    if (!base) return null;
    const wsBase = base.replace(/^http/i, 'ws').replace(/\/$/, '');
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${wsBase}/ws/chat/${roomId}/${qs}`;
}

function Bubble({ text, isMine, createdAt }) {
    return (
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
            <Text style={[styles.bubbleText, isMine ? styles.bubbleTextMine : styles.bubbleTextOther]}>{text}</Text>
            {createdAt ? <Text style={styles.bubbleTime}>{createdAt}</Text> : null}
        </View>
    );
}

function getFullName(data) {
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
}

function getDisplayName(profile, fallback) {
    const full = getFullName(profile);
    const name = full || profile?.full_name || profile?.name || profile?.username;
    if (name) return String(name);
    if (fallback) return String(fallback);
    return 'Nguoi dung';
}

function getAvatarUrl(profile) {
    const raw =
        profile?.avatar ||
        profile?.avatar_url ||
        profile?.anh_dai_dien ||
        profile?.image ||
        profile?.image_url ||
        '';
    return toAbsoluteMediaUrl(raw) || DEFAULT_AVATAR;
}

function normalizeText(value) {
    return String(value || '').trim().replace(/\s+/g, ' ');
}

export default function ChatRoomScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const isFocused = useIsFocused();
    const roomId = route?.params?.roomId;
    const initialListingId = route?.params?.listingId;
    const otherUserId = route?.params?.otherUserId;
    const otherUserName = route?.params?.otherUserName || 'Trò chuyện';

    const [messages, setMessages] = useState([]);
    const [meId, setMeId] = useState(null);
    const [meProfile, setMeProfile] = useState(null);
    const [userMap, setUserMap] = useState({});
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [listing, setListing] = useState(null);
    const [listingLoading, setListingLoading] = useState(false);
    const [listingId, setListingId] = useState(initialListingId || null);
    const [isNearBottom, setIsNearBottom] = useState(true);

    const socketRef = useRef(null);
    const listRef = useRef(null);
    const messageIdsRef = useRef(new Set());
    const reconnectTimerRef = useRef(null);
    const reconnectAttemptRef = useRef(0);
    const isConnectingRef = useRef(false);
    const didInitialLoadRef = useRef(false);
    const scrollStateRef = useRef({ offset: 0, contentHeight: 0, layoutHeight: 0 });
    const shouldScrollToEndRef = useRef(false);
    const isProgrammaticScrollRef = useRef(false);
    const lastMessageIdRef = useRef(null);

    const loadMe = async () => {
        try {
            const res = await client.get(ENDPOINTS.PROFILE);
            const id = res?.data?.id;
            if (id) setMeId(id);
            setMeProfile(res?.data || null);
        } catch {
            setMeId(null);
            setMeProfile(null);
        }
    };

    const loadMessages = async () => {
        if (!roomId) return;
        const shouldShowLoading = !didInitialLoadRef.current && messages.length === 0;
        try {
            if (shouldShowLoading) setLoading(true);
            const res = await client.get(ENDPOINTS.CHAT_ROOM_MESSAGES(roomId));
            const list = res?.data?.messages || [];
            const normalized = Array.isArray(list) ? list : [];
            messageIdsRef.current = new Set(normalized.map((m) => String(m?.id)).filter(Boolean));
            const latestId = normalized?.[normalized.length - 1]?.id ?? null;
            const hasNew = latestId && String(latestId) !== String(lastMessageIdRef.current || '');
            if (!didInitialLoadRef.current) {
                shouldScrollToEndRef.current = true;
            } else if (hasNew && isNearBottom) {
                shouldScrollToEndRef.current = true;
            }
            setMessages((prev) => {
                const known = new Set(normalized.map((m) => String(m?.id)).filter(Boolean));
                const normalizeTime = (t) => {
                    if (!t) return 0;
                    const ms = new Date(t).getTime();
                    return Number.isFinite(ms) ? ms : 0;
                };
                const norm = (v) => normalizeText(v);
                const pending = (prev || []).filter((m) => {
                    if (!m?.pending) return false;
                    if (known.has(String(m?.id))) return false;
                    const match = normalized.find((n) => {
                        if (!n) return false;
                        if (String(n?.sender_id || '') !== String(m?.sender_id || '')) return false;
                        if (norm(n?.text) !== norm(m?.text)) return false;
                        const diff = Math.abs(normalizeTime(n?.created_at) - normalizeTime(m?.created_at));
                        return diff <= 20000;
                    });
                    return !match;
                });
                return [...normalized, ...pending];
            });
            lastMessageIdRef.current = latestId;
            didInitialLoadRef.current = true;
        } catch {
            setMessages([]);
        } finally {
            if (shouldShowLoading) setLoading(false);
        }
    };

    const loadListing = async () => {
        if (!listingId) return;
        try {
            setListingLoading(true);
            const res = await client.get(ENDPOINTS.POST_DETAIL(listingId));
            const data = res?.data?.result || res?.data;
            setListing(data || null);
        } catch {
            setListing(null);
        } finally {
            setListingLoading(false);
        }
    };

    const loadRoomListingId = async () => {
        if (!roomId || listingId) return;
        try {
            const res = await client.get(ENDPOINTS.CHAT_ROOMS_MY);
            const list = res?.data?.rooms || [];
            const matched = (list || []).find((r) => String(r?.room_id || r?.id) === String(roomId));
            const foundId = matched?.listing_id || matched?.listingId;
            if (foundId) setListingId(foundId);
        } catch {
            // ignore
        }
    };

    const fetchUsers = async (ids) => {
        const list = Array.from(new Set((ids || []).filter(Boolean)));
        if (list.length === 0) return;

        const next = { ...(userMap || {}) };
        for (const id of list) {
            if (!id) continue;
            if (String(id) === String(meId)) continue;
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

    const handleIncoming = (payload) => {
        const id = payload?.id ? String(payload.id) : null;
        if (id && messageIdsRef.current.has(id)) return;
        if (id) messageIdsRef.current.add(id);

        const msg = {
            id: id || `local-${Date.now()}`,
            sender_id: payload?.sender_id,
            text: payload?.text || '',
            created_at: payload?.created_at,
        };
        const shouldAutoScroll = isNearBottom || (meId && String(msg.sender_id) === String(meId));
        if (shouldAutoScroll) {
            shouldScrollToEndRef.current = true;
        }
        setMessages((prev) => {
            const norm = (v) => normalizeText(v);
            const isFromMe = meId && String(msg.sender_id) === String(meId);
            const pendingIdx = prev.findIndex((m) => {
                if (!m?.pending) return false;
                if (String(m?.sender_id || '') && String(m?.sender_id || '') !== String(msg.sender_id || '')) {
                    return false;
                }
                if (norm(m?.text) !== norm(msg.text)) return false;
                const t1 = m?.created_at ? new Date(m.created_at).getTime() : 0;
                const t2 = msg.created_at ? new Date(msg.created_at).getTime() : 0;
                return Math.abs((t2 || Date.now()) - (t1 || Date.now())) <= 20000;
            });
            if (pendingIdx >= 0) {
                const next = [...prev];
                const pendingMsg = next[pendingIdx];
                next[pendingIdx] = {
                    ...pendingMsg,
                    ...msg,
                    sender_id: msg.sender_id || pendingMsg.sender_id,
                    pending: false,
                };
                return next;
            }
            if (isFromMe) {
                const incomingTime = msg.created_at ? new Date(msg.created_at).getTime() : Date.now();
                const idx = prev.findIndex((m) => {
                    if (!m?.pending) return false;
                    if (String(m?.sender_id) !== String(meId)) return false;
                    if (norm(m?.text) !== norm(msg.text)) return false;
                    const t = m?.created_at ? new Date(m.created_at).getTime() : 0;
                    return Math.abs(incomingTime - t) <= 15000;
                });
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = { ...next[idx], ...msg, pending: false };
                    return next;
                }
            }
            return [...prev, msg];
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
        if (!roomId) return;
        if (isConnectingRef.current) return;
        isConnectingRef.current = true;
        setConnecting(true);
        try {
            const token = await AsyncStorage.getItem('access_token');
            const wsUrl = buildWsUrl(roomId, token);
            if (!wsUrl) {
                setConnecting(false);
                isConnectingRef.current = false;
                return;
            }

            if (socketRef.current) {
                socketRef.current.close();
            }

            const ws = new WebSocket(wsUrl);
            socketRef.current = ws;

            ws.onopen = () => {
                setConnecting(false);
                isConnectingRef.current = false;
                reconnectAttemptRef.current = 0;
            };
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event?.data || '{}');
                    if (data?.event === 'message') handleIncoming(data);
                } catch {
                    // ignore
                }
            };
            ws.onerror = () => {
                setConnecting(false);
                isConnectingRef.current = false;
                scheduleReconnect();
            };
            ws.onclose = () => {
                setConnecting(false);
                isConnectingRef.current = false;
                scheduleReconnect();
            };
        } catch {
            setConnecting(false);
            isConnectingRef.current = false;
            scheduleReconnect();
        }
    };

    const addOptimisticMessage = (text) => {
        const now = new Date();
        const tempId = `local-${now.getTime()}`;
        const msg = {
            id: tempId,
            sender_id: meId,
            text: normalizeText(text),
            created_at: now.toISOString(),
            pending: true,
        };
        shouldScrollToEndRef.current = true;
        setMessages((prev) => [...prev, msg]);
        return msg;
    };

    const handleScroll = (event) => {
        if (isProgrammaticScrollRef.current) return;
        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        const distanceFromBottom = contentSize.height - (layoutMeasurement.height + contentOffset.y);
        setIsNearBottom(distanceFromBottom < 40);
        scrollStateRef.current = {
            offset: contentOffset.y,
            contentHeight: contentSize.height,
            layoutHeight: layoutMeasurement.height,
        };
    };

    const handleDeleteMessage = (id) => {
        if (!id) return;
        Alert.alert('Xóa tin nhắn', 'Bạn có chắc muốn xóa tin nhắn này?', [
            { text: 'Hủy', style: 'cancel' },
            {
                text: 'Xóa',
                style: 'destructive',
                onPress: () => setMessages((prev) => prev.filter((m) => String(m?.id) !== String(id))),
            },
        ]);
    };

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || !roomId) return;

        setInput('');
        addOptimisticMessage(text);
        const payload = JSON.stringify({ type: 'chat.message', text });

        const ws = socketRef.current;
        if (ws && ws.readyState === 1) {
            ws.send(payload);
            return;
        }

        try {
            await client.post(ENDPOINTS.CHAT_ROOM_MESSAGES(roomId), { text });
        } catch {
            setInput(text);
        }
    };

    useEffect(() => {
        if (!isFocused) return;
        shouldScrollToEndRef.current = true;
        loadMe();
        loadMessages();
        connectWs();
        loadRoomListingId();
        const poll = setInterval(loadMessages, 8000);
        return () => {
            clearInterval(poll);
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            if (socketRef.current) socketRef.current.close();
        };
    }, [isFocused, roomId]);

    useEffect(() => {
        loadListing();
    }, [listingId]);

    useEffect(() => {
        if (!messages.length) return;
        if (!shouldScrollToEndRef.current) return;
        shouldScrollToEndRef.current = false;
        isProgrammaticScrollRef.current = true;
        setTimeout(() => {
            listRef.current?.scrollToEnd?.({ animated: false });
            isProgrammaticScrollRef.current = false;
        }, 60);
    }, [messages.length]);

    useEffect(() => {
        const ids = messages.map((m) => m?.sender_id).filter(Boolean);
        if (otherUserId) ids.push(otherUserId);
        fetchUsers(ids);
    }, [messages, otherUserId, meId]);

    const listingTitle = listing?.title || 'Tin bạn quan tâm';
    const title = useMemo(() => {
        const profile = otherUserId ? userMap?.[otherUserId] : null;
        return getDisplayName(profile, otherUserName || 'Trò chuyện');
    }, [otherUserId, otherUserName, userMap]);
    const listingPrice = listing?.price != null ? formatPriceVn(listing.price) : '—';
    const listingArea = listing?.area != null ? `${listing.area} m²` : null;
    const listingAddress = addressToText(listing?.address || listing?.location);
    const openListing = () => {
        if (!listingId) return;
        navigation.navigate('Trang chủ', {
            screen: 'PostDetail',
            params: { postId: listingId, id: listingId },
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color="#111" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {title}
                    </Text>
                    <View style={{ width: 32 }} />
                </View>

                {loading && messages.length === 0 ? (
                    <View style={styles.loading}>
                        <ActivityIndicator />
                    </View>
                ) : (
                    <FlatList
                        ref={listRef}
                        data={messages}
                        keyExtractor={(item) => String(item?.id)}
                        contentContainerStyle={styles.listContent}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        keyboardShouldPersistTaps="handled"
                        ListHeaderComponent={
                            listingId ? (
                                <TouchableOpacity
                                    activeOpacity={0.85}
                                    onPress={openListing}
                                    style={styles.listingCard}
                                >
                                    <View style={styles.listingRow}>
                                        <Ionicons name="home-outline" size={18} color="#111" />
                                        <Text style={styles.listingTitle} numberOfLines={2}>
                                            {listingLoading ? 'Đang tải tin...' : listingTitle}
                                        </Text>
                                    </View>
                                    <View style={styles.listingMetaRow}>
                                        <Text style={styles.listingMeta}>{listingPrice}</Text>
                                        {listingArea ? <Text style={styles.listingMeta}>{listingArea}</Text> : null}
                                    </View>
                                    {listingAddress ? (
                                        <Text style={styles.listingAddress} numberOfLines={2}>
                                            {listingAddress}
                                        </Text>
                                    ) : null}
                                    <Text style={styles.listingLink}>Xem chi tiết</Text>
                                </TouchableOpacity>
                            ) : null
                        }
                        renderItem={({ item }) => {
                            const senderId = item?.sender_id;
                            const isMine = meId && String(senderId) === String(meId);
                            const senderProfile = isMine ? meProfile : userMap?.[senderId];
                            const displayName = getDisplayName(senderProfile, isMine ? 'Ban' : otherUserName);
                            const avatarUrl = getAvatarUrl(senderProfile);
                            const timeText = item?.created_at ? new Date(item.created_at).toLocaleString() : '';
                            return (
                                <TouchableOpacity
                                    activeOpacity={1}
                                    onLongPress={() => handleDeleteMessage(item?.id)}
                                    delayLongPress={350}
                                >
                                    <View
                                        style={[
                                            styles.messageRow,
                                            isMine ? styles.messageRowMine : styles.messageRowOther,
                                        ]}
                                    >
                                        {!isMine ? (
                                            <View style={styles.msgAvatar}>
                                                <Image source={{ uri: avatarUrl }} style={styles.msgAvatarImage} />
                                            </View>
                                        ) : null}
                                        <View style={styles.messageContent}>
                                            <Text
                                                style={[
                                                    styles.senderName,
                                                    isMine ? styles.senderNameMine : styles.senderNameOther,
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {displayName}
                                            </Text>
                                            <Bubble text={item?.text} isMine={isMine} createdAt={timeText} />
                                        </View>
                                        {isMine ? (
                                            <View style={styles.msgAvatar}>
                                                <Image source={{ uri: avatarUrl }} style={styles.msgAvatarImage} />
                                            </View>
                                        ) : null}
                                    </View>
                                </TouchableOpacity>
                            );
                        }}
                    />
                )}

                <View style={styles.inputWrap}>
                    <TextInput
                        value={input}
                        onChangeText={setInput}
                        placeholder="Nhập tin nhắn..."
                        style={styles.input}
                        multiline
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, (!input.trim() || connecting) && { opacity: 0.6 }]}
                        onPress={sendMessage}
                        disabled={!input.trim() || connecting}
                    >
                        <Ionicons name="send" size={20} color="#111" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
        gap: 10,
    },
    backBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F4F6',
    },
    headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#111' },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 90, gap: 10 },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
    },
    messageRowMine: { justifyContent: 'flex-end' },
    messageRowOther: { justifyContent: 'flex-start' },
    messageContent: { maxWidth: '78%', gap: 4 },
    senderName: { fontSize: 11, fontWeight: '700' },
    senderNameMine: { textAlign: 'right', color: '#111' },
    senderNameOther: { color: '#111' },
    msgAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    msgAvatarImage: { width: 28, height: 28, borderRadius: 14 },
    listingCard: {
        borderWidth: 1,
        borderColor: '#EEE',
        borderRadius: 14,
        padding: 12,
        backgroundColor: '#fff',
        marginBottom: 6,
    },
    listingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    listingTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: '#111' },
    listingMetaRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
    listingMeta: { fontSize: 12, fontWeight: '800', color: '#111' },
    listingAddress: { fontSize: 12, color: '#666', marginTop: 4 },
    listingLink: { marginTop: 8, fontSize: 12, fontWeight: '800', color: '#111' },
    bubble: {
        maxWidth: '78%',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
    },
    bubbleMine: {
        alignSelf: 'flex-end',
        backgroundColor: '#FFEDB8',
        borderTopRightRadius: 4,
    },
    bubbleOther: {
        alignSelf: 'flex-start',
        backgroundColor: '#F3F4F6',
        borderTopLeftRadius: 4,
    },
    bubbleText: { fontSize: 14 },
    bubbleTextMine: { color: '#111', fontWeight: '600' },
    bubbleTextOther: { color: '#111' },
    bubbleTime: { fontSize: 10, color: '#666', marginTop: 4 },
    inputWrap: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#EEE',
        gap: 10,
    },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 110,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontSize: 14,
        backgroundColor: '#fff',
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFB800',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
