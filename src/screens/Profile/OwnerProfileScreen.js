import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import client from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

function formatPriceVN(value) {
    if (value == null || Number.isNaN(Number(value))) return '—';
    try {
        return new Intl.NumberFormat('vi-VN').format(Number(value));
    } catch {
        return String(value);
    }
}

export default function OwnerProfileScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const isFocused = useIsFocused();

    const ownerId = route?.params?.ownerId;
    const initialName = route?.params?.ownerName;
    const initialAvatar = route?.params?.ownerAvatar;

    const [profile, setProfile] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const loadProfile = async () => {
        if (!ownerId) return;
        try {
            const res = await client.get(ENDPOINTS.USER_PUBLIC_PROFILE(ownerId));
            const data = res?.data?.result || res?.data;
            setProfile(data || null);
        } catch {
            setProfile(null);
        }
    };

    const loadPosts = async () => {
        if (!ownerId) return;
        try {
            setLoading(true);
            const res = await client.get(ENDPOINTS.OWNER_POSTS, {
                params: { owner_id: ownerId, page: 1, page_size: 20 },
            });
            const list = res?.data?.results || res?.data || [];
            setPosts(Array.isArray(list) ? list : []);
        } catch {
            setPosts([]);
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([loadProfile(), loadPosts()]);
        setRefreshing(false);
    };

    useEffect(() => {
        if (isFocused) {
            loadProfile();
            loadPosts();
        }
    }, [isFocused, ownerId]);

    const displayName = useMemo(() => {
        const fullName = profile?.full_name || `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
        if (fullName) return fullName;
        return initialName || 'Người đăng';
    }, [profile, initialName]);

    const avatarUri = profile?.anh_dai_dien || initialAvatar || DEFAULT_AVATAR;
    const phoneText = profile?.phone || profile?.so_dien_thoai || '';
    const emailText = profile?.email || '';

    const renderItem = ({ item }) => {
        const title = item?.title || 'Bài đăng';
        const price = item?.price != null ? `${formatPriceVN(item.price)} đ` : '—';
        const area = item?.area != null ? `${item.area} m²` : '—';
        const imageUrl = item?.images?.[0]?.image_url || item?.images?.[0]?.url;

        return (
            <TouchableOpacity
                style={styles.postCard}
                onPress={() => navigation.navigate('PostDetail', { postId: item?.id, id: item?.id })}
                activeOpacity={0.85}
            >
                <View style={styles.postImageWrap}>
                    {imageUrl ? (
                        <Image source={{ uri: imageUrl }} style={styles.postImage} />
                    ) : (
                        <View style={styles.postImageFallback}>
                            <Ionicons name="image-outline" size={22} color="#999" />
                        </View>
                    )}
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.postTitle} numberOfLines={2}>{title}</Text>
                    <Text style={styles.postMeta}>{price} • {area}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#111" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Hồ sơ người đăng</Text>
                <View style={{ width: 32 }} />
            </View>

            <View style={styles.profileCard}>
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
                <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{displayName}</Text>
                    {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
                    {phoneText ? <Text style={styles.subText}>SĐT: {phoneText}</Text> : null}
                    {emailText ? <Text style={styles.subText}>Email: {emailText}</Text> : null}
                </View>
            </View>

            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Những bài đăng của {displayName}</Text>
            </View>

            {loading && posts.length === 0 ? (
                <View style={styles.loading}>
                    <ActivityIndicator />
                </View>
            ) : (
                <FlatList
                    data={posts}
                    keyExtractor={(item) => String(item?.id)}
                    renderItem={renderItem}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle={posts.length === 0 ? styles.emptyWrap : styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="document-text-outline" size={44} color="#999" />
                            <Text style={styles.emptyText}>Chưa có bài đăng công khai.</Text>
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
    headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#111', textAlign: 'center' },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#F3F4F6' },
    name: { fontSize: 16, fontWeight: '800', color: '#111' },
    bio: { fontSize: 12, color: '#666', marginTop: 4 },
    subText: { fontSize: 12, color: '#444', marginTop: 4 },
    sectionHeader: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
    sectionTitle: { fontSize: 14, fontWeight: '800', color: '#111' },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 16, gap: 12 },
    emptyWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyState: { alignItems: 'center', gap: 8 },
    emptyText: { color: '#666', fontSize: 14, textAlign: 'center' },
    postCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#EEE',
        borderRadius: 12,
        backgroundColor: '#fff',
    },
    postImageWrap: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F3F4F6' },
    postImage: { width: '100%', height: '100%' },
    postImageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    postTitle: { fontSize: 14, fontWeight: '800', color: '#111' },
    postMeta: { fontSize: 12, color: '#666', marginTop: 6 },
});
