// src/screens/Profile/MyReviewsScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import client from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';

export default function MyReviewsScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]); // ratings of me
    const [stats, setStats] = useState({ total: 0, avg: 0 });

    const computeStats = (arr) => {
        const list = Array.isArray(arr) ? arr : [];
        const total = list.length;
        const sum = list.reduce((s, x) => s + (Number(x.score ?? 0) || 0), 0);
        const avg = total ? sum / total : 0;
        return { total, avg };
    };

    const fetchMyId = async () => {
        const res = await client.get(ENDPOINTS.PROFILE);
        const myId = res.data?.id;
        if (!myId) throw new Error('Không lấy được user id.');
        return { myId, me: res.data };
    };

    const safeGetResults = (data) => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.results)) return data.results;
        return [];
    };

    const fetchFavoritePosts = async () => {
        try {
            const res = await client.get(ENDPOINTS.FAVORITES_MY);
            return safeGetResults(res.data);
        } catch (e) {
            return [];
        }
    };

    const fetchMyPosts = async () => {
        try {
            const res = await client.get(ENDPOINTS.MY_POSTS);
            return safeGetResults(res.data);
        } catch (e) {
            return [];
        }
    };

    const fetchRecentPosts = async (page = 1) => {
        try {
            const res = await client.get(ENDPOINTS.POSTS, { params: { page, page_size: 20 } });
            return safeGetResults(res.data);
        } catch (e) {
            return [];
        }
    };

    const fetchRatingsByPost = async (postId) => {
        const res = await client.get(ENDPOINTS.RATINGS_LIST_BY_POST, {
            params: { post_id: postId },
        });
        return safeGetResults(res.data);
    };

    const load = async () => {
        try {
            setLoading(true);

            const { myId } = await fetchMyId();

            // 1) Lấy post ứng viên từ favorites + my posts + vài trang posts
            const [favPosts, myPosts, recent1, recent2] = await Promise.all([
                fetchFavoritePosts(),
                fetchMyPosts(),
                fetchRecentPosts(1),
                fetchRecentPosts(2),
            ]);

            // gom unique post_id
            const map = new Map();
            const addPosts = (arr) => {
                (arr || []).forEach((p) => {
                    const id = p?.id;
                    if (id && !map.has(id)) map.set(id, p);
                });
            };

            addPosts(favPosts);
            addPosts(myPosts);
            addPosts(recent1);
            addPosts(recent2);

            const candidatePosts = Array.from(map.values());

            // chặn để tránh quá nhiều request
            const MAX_SCAN = 40;
            const scanPosts = candidatePosts.slice(0, MAX_SCAN);

            const merged = [];
            for (const p of scanPosts) {
                const pid = p?.id;
                if (!pid) continue;

                const list = await fetchRatingsByPost(pid);

                // lọc rating của chính mình
                for (const r of list) {
                    const uid = String(r?.user_id ?? '');
                    if (uid && uid === String(myId)) {
                        merged.push({
                            _key: `${pid}_${r?.id || r?.rating_id || Math.random()}`,
                            post_id: pid,
                            post_title: p?.title || 'Bài đăng',
                            score: Number(r?.score ?? 0) || 0,
                            comment: r?.comment || '',
                            created_at: r?.created_at || '',
                        });
                    }
                }
            }

            merged.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

            setItems(merged);
            setStats(computeStats(merged));

            if (candidatePosts.length > MAX_SCAN) {
                Alert.alert(
                    'Lưu ý',
                    `Đang thống kê trong ${MAX_SCAN} bài gần nhất (favorites + bài của tôi + 2 trang posts) để app không bị lag.\n\nNếu bạn muốn thống kê đầy đủ 100%, BE cần thêm API "ratings/my".`
                );
            }
        } catch (e) {
            console.log('load my ratings error', e?.response?.data || e.message);
            setItems([]);
            setStats({ total: 0, avg: 0 });
            Alert.alert('Lỗi', 'Không tải được danh sách đánh giá của bạn.');
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            load();
        }, [])
    );

    const headerTitle = useMemo(() => `Đánh giá của tôi`, []);

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="star" size={18} color="#F4B400" />
                <Text style={styles.score}>{item.score}/5</Text>
                <Text style={styles.title} numberOfLines={1}>
                    {item.post_title}
                </Text>
            </View>

            {!!item.comment && (
                <Text style={styles.comment} numberOfLines={3}>
                    {item.comment}
                </Text>
            )}

            <View style={styles.row}>
                <Text style={styles.time}>{item.created_at || ''}</Text>

                <TouchableOpacity
                    onPress={() =>
                        navigation.navigate('Home', { screen: 'PostDetail', params: { postId: item.post_id } })
                    }
                >
                    <Text style={styles.open}>Xem bài</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {headerTitle}
                </Text>
                <View style={{ width: 60 }} />
            </View>

            <View style={styles.statsBox}>
                {loading ? (
                    <View style={{ paddingVertical: 6 }}>
                        <ActivityIndicator />
                    </View>
                ) : (
                    <>
                        <Text style={styles.statsText}>
                            Tổng đánh giá: <Text style={{ fontWeight: '900' }}>{stats.total}</Text>
                        </Text>
                        <Text style={styles.statsText}>
                            Điểm TB: <Text style={{ fontWeight: '900' }}>{stats.total ? stats.avg.toFixed(2) : '0.00'}</Text>
                        </Text>
                    </>
                )}
            </View>

            <FlatList
                data={items}
                keyExtractor={(it) => String(it._key)}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
                ListEmptyComponent={
                    !loading ? (
                        <View style={{ paddingTop: 40, alignItems: 'center' }}>
                            <Text style={{ color: '#777' }}>
                                Bạn chưa có đánh giá nào (hoặc bài bạn đã đánh giá chưa nằm trong phạm vi thống kê).
                            </Text>
                        </View>
                    ) : null
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#000', flex: 1, marginLeft: 10 },

    statsBox: {
        marginHorizontal: 16,
        marginBottom: 6,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#EEE',
        backgroundColor: '#fff',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    statsText: { color: '#333' },

    card: {
        borderWidth: 1,
        borderColor: '#EEE',
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
        backgroundColor: '#fff',
    },
    score: { marginLeft: 6, fontWeight: '900', color: '#333' },
    title: { marginLeft: 10, flex: 1, fontWeight: '800', color: '#333' },
    comment: { marginTop: 8, color: '#555' },
    row: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
    time: { color: '#999', fontSize: 12 },
    open: { color: '#111', fontWeight: '900' },
});
