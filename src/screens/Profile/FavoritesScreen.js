// src/screens/Profile/FavoritesScreen.js
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, View } from 'react-native';

import client from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';
import PostCard from '../../components/features/PostCard';

export default function FavoritesScreen() {
    const navigation = useNavigation();
    const isFocused = useIsFocused();

    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState([]);
    const [favMap, setFavMap] = useState({});

    // ✅ category_id -> name
    const [categoryMap, setCategoryMap] = useState({});

    // cache địa chỉ theo postId để khỏi gọi lại
    const addressCacheRef = useRef({}); // { postId: "..." }
    const fetchingRef = useRef(new Set()); // chống gọi trùng

    const getPostDetailUrlCandidates = (id) => {
        const base = ENDPOINTS.POST_DETAIL ? ENDPOINTS.POST_DETAIL(id) : `/api/listings/posts/${id}`;
        const noSlash = base.replace(/\/+$/, '');
        return [noSlash, `${noSlash}/`];
    };

    const addressToText = (address) => {
        if (!address) return '';

        if (typeof address === 'object') {
            const full = address.full || address.text || address.address;
            if (full) return String(full).trim();
            return [address.street, address.ward, address.district, address.province].filter(Boolean).join(', ').trim();
        }

        if (typeof address === 'string') {
            const s = address.trim();
            if (!s) return '';
            if (s.startsWith('{') || s.startsWith('[')) {
                try {
                    return addressToText(JSON.parse(s));
                } catch {
                    return s;
                }
            }
            return s;
        }

        return String(address).trim();
    };

    const extractAddressFromDetail = (detail) => {
        const addrText =
            addressToText(detail?.address) ||
            addressToText(detail?.address_text) ||
            addressToText(detail?.dia_chi);

        if (addrText) return addrText;

        const locText = addressToText(detail?.location);
        return locText || '';
    };

    const fetchOneAddress = async (postId) => {
        if (!postId) return '';

        if (addressCacheRef.current[postId] !== undefined) return addressCacheRef.current[postId];
        if (fetchingRef.current.has(postId)) return '';

        fetchingRef.current.add(postId);

        try {
            const candidates = getPostDetailUrlCandidates(postId);

            let data = null;
            for (const url of candidates) {
                try {
                    const res = await client.get(url);
                    data = res.data;
                    break;
                } catch { }
            }

            const detail = data?.result || data || {};
            const addressText = extractAddressFromDetail(detail);

            addressCacheRef.current[postId] = addressText || '';
            return addressCacheRef.current[postId];
        } catch {
            addressCacheRef.current[postId] = '';
            return '';
        } finally {
            fetchingRef.current.delete(postId);
        }
    };

    const hydrateAddressesForItems = async (likedPosts) => {
        const idsToFetch = likedPosts
            .map((p) => p?.id)
            .filter(Boolean)
            .filter((id) => addressCacheRef.current[id] === undefined);

        if (idsToFetch.length === 0) return;

        const BATCH_SIZE = 5;
        for (let i = 0; i < idsToFetch.length; i += BATCH_SIZE) {
            const batch = idsToFetch.slice(i, i + BATCH_SIZE);

            await Promise.all(
                batch.map(async (id) => {
                    const addr = await fetchOneAddress(id);
                    setItems((prev) => prev.map((p) => (String(p?.id) === String(id) ? { ...p, address: addr } : p)));
                })
            );
        }
    };

    const loadCategories = async () => {
        try {
            const base = ENDPOINTS?.CATEGORIES || ENDPOINTS?.LISTING_CATEGORIES || '/api/listings/categories';
            const s = String(base).replace(/\/+$/, '');
            const candidates = [s, `${s}/`];

            let data = null;
            for (const url of candidates) {
                try {
                    const res = await client.get(url);
                    data = res.data;
                    break;
                } catch { }
            }

            const arr = Array.isArray(data) ? data : data?.results || data?.items || [];
            const map = {};
            (arr || []).forEach((c) => {
                const id = c?.id ?? c?.category_id ?? c?.code;
                const name = c?.name ?? c?.category_name ?? c?.title;
                if (id != null) map[String(id)] = name ? String(name) : String(id);
            });
            setCategoryMap(map);
        } catch {
            setCategoryMap({});
        }
    };

    const load = async () => {
        setLoading(true);
        try {
            await loadCategories();

            // 1) favorites của tôi
            const favRes = await client.get(ENDPOINTS.FAVORITES_MY);
            const favIds = (favRes.data || []).map((x) => String(x.post_id)).filter(Boolean);

            const map = {};
            favIds.forEach((id) => (map[id] = 1));
            setFavMap(map);

            if (!favIds.length) {
                setItems([]);
                return;
            }

            // 2) Fetch chi tiết từng bài theo post_id (đừng phụ thuộc /posts list)
            const fetchOneDetail = async (postId) => {
                const candidates = getPostDetailUrlCandidates(postId);
                for (const url of candidates) {
                    try {
                        const res = await client.get(url);
                        const detail = res.data?.result || res.data || {};
                        if (!detail?.id) detail.id = postId;

                        const addrText = extractAddressFromDetail(detail);
                        detail.address = addrText || detail.address || '';

                        return detail;
                    } catch { }
                }
                return null;
            };

            const BATCH = 6;
            const results = [];
            for (let i = 0; i < favIds.length; i += BATCH) {
                const batch = favIds.slice(i, i + BATCH);
                const chunk = await Promise.all(batch.map((id) => fetchOneDetail(id)));
                chunk.filter(Boolean).forEach((x) => results.push(x));
            }

            setItems(results);

            // (optional) vẫn hydrate address nếu có bài nào thiếu
            hydrateAddressesForItems(results);
        } catch (e) {
            console.log('Favorites load error:', e?.response?.status, e?.response?.data || e.message);
            Alert.alert('Lỗi', 'Không thể tải danh sách yêu thích.');
        } finally {
            setLoading(false);
        }
    };

    const toggleFavorite = async (postId) => {
        try {
            const res = await client.post(ENDPOINTS.FAVORITES_TOGGLE, { post_id: postId });
            const favorited = res?.data?.favorited ?? 0;

            setFavMap((prev) => ({ ...prev, [postId]: favorited }));

            if (Number(favorited) === 0) {
                setItems((prev) => prev.filter((p) => String(p?.id) !== String(postId)));
            }
        } catch {
            Alert.alert('Lỗi', 'Không thể cập nhật yêu thích.');
        }
    };

    const openDetail = (postId) => {
        if (!postId) return;

        // ✅ đi qua Tab "Trang chủ" -> HomeStack -> PostDetail
        // tùy app bạn đặt route, nếu khác thì đổi lại
        try {
            navigation.navigate('Trang chủ', {
                screen: 'PostDetail',
                params: { postId },
            });
        } catch (e) {
            // fallback
            navigation.navigate('PostDetail', { postId });
        }
    };

    useEffect(() => {
        if (isFocused) load();
    }, [isFocused]);

    return (
        <View style={{ flex: 1, backgroundColor: '#fff', padding: 14 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', marginBottom: 10 }}>Tin yêu thích</Text>

            <FlatList
                data={items}
                keyExtractor={(it, idx) => String(it?.id ?? idx)}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
                renderItem={({ item }) => (
                    <View style={styles.cardWrapper}>
                        <PostCard
                            post={item}
                            onPress={() => openDetail(item?.id)}
                            favMap={favMap}
                            categoryName={categoryMap?.[String(item?.category_id)] || '—'}
                            onToggleFavorite={() => toggleFavorite(item?.id)}
                        />
                    </View>
                )}
                ListEmptyComponent={
                    <View style={{ paddingVertical: 30 }}>
                        <Text style={{ color: '#666', textAlign: 'center' }}>
                            {loading ? 'Đang tải...' : 'Chưa có tin yêu thích.'}
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = {
    cardWrapper: {
        borderWidth: 1,
        borderColor: '#e0e0e0',
        borderRadius: 12,
        padding: 8,
        backgroundColor: '#fff',
        marginBottom: 12,
    },
};
