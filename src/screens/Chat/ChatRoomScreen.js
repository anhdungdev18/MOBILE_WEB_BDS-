import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import client from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';

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

export default function ChatRoomScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const roomId = route?.params?.roomId;
    const otherUserName = route?.params?.otherUserName || 'Trò chuyện';

    const [messages, setMessages] = useState([]);
    const [meId, setMeId] = useState(null);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [connecting, setConnecting] = useState(false);

    const socketRef = useRef(null);
    const listRef = useRef(null);
    const messageIdsRef = useRef(new Set());

    const loadMe = async () => {
        try {
            const res = await client.get(ENDPOINTS.PROFILE);
            const id = res?.data?.id;
            if (id) setMeId(id);
        } catch {
            setMeId(null);
        }
    };

    const loadMessages = async () => {
        if (!roomId) return;
        try {
            setLoading(true);
            const res = await client.get(ENDPOINTS.CHAT_ROOM_MESSAGES(roomId));
            const list = res?.data?.messages || [];
            const normalized = Array.isArray(list) ? list : [];
            messageIdsRef.current = new Set(normalized.map((m) => String(m?.id)).filter(Boolean));
            setMessages(normalized);
        } catch {
            setMessages([]);
        } finally {
            setLoading(false);
        }
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
        setMessages((prev) => [...prev, msg]);
    };

    const connectWs = async () => {
        if (!roomId) return;
        setConnecting(true);
        try {
            const token = await AsyncStorage.getItem('access_token');
            const wsUrl = buildWsUrl(roomId, token);
            if (!wsUrl) {
                setConnecting(false);
                return;
            }

            if (socketRef.current) {
                socketRef.current.close();
            }

            const ws = new WebSocket(wsUrl);
            socketRef.current = ws;

            ws.onopen = () => {
                setConnecting(false);
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
            };
            ws.onclose = () => {
                setConnecting(false);
            };
        } catch {
            setConnecting(false);
        }
    };

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || !roomId) return;

        setInput('');
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
        loadMe();
        loadMessages();
        connectWs();
        return () => {
            if (socketRef.current) socketRef.current.close();
        };
    }, [roomId]);

    useEffect(() => {
        if (!messages.length) return;
        setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 80);
    }, [messages.length]);

    const title = useMemo(() => otherUserName || 'Trò chuyện', [otherUserName]);

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

            {loading ? (
                <View style={styles.loading}>
                    <ActivityIndicator />
                </View>
            ) : (
                <FlatList
                    ref={listRef}
                    data={messages}
                    keyExtractor={(item) => String(item?.id)}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => {
                        const isMine = meId && String(item?.sender_id) === String(meId);
                        const timeText = item?.created_at ? new Date(item.created_at).toLocaleString() : '';
                        return <Bubble text={item?.text} isMine={isMine} createdAt={timeText} />;
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
    listContent: { paddingHorizontal: 16, paddingVertical: 16, gap: 10 },
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
