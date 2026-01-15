// src/screens/Home/PostDetailScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import client from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';
import { AuthContext } from '../../context/AuthContext';

const { width } = Dimensions.get('window');
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

// Engagement endpoints (Rating + Comment)
const ENG_ENDPOINTS = {
    RATINGS_SUMMARY: (postId) => `/api/engagement/ratings/summary/?post_id=${postId}`,
    RATINGS_UPSERT: `/api/engagement/ratings/`,
    COMMENTS_LIST: (postId) => `/api/engagement/comments/list/?post_id=${postId}`,
    COMMENTS_CREATE: `/api/engagement/comments/`,
};

const addressToText = (address) => {
    if (!address) return '';
    if (typeof address === 'object') {
        const full = address.full || address.text || address.address;
        if (full) return String(full).trim();
        const joined = [address.street, address.ward, address.district, address.province]
            .filter(Boolean)
            .join(', ');
        return joined.trim();
    }
    if (typeof address === 'string') return address.trim();
    return '';
};

const formatPriceVN = (price) => {
    if (price == null) return '';
    const n = Number(price);
    if (Number.isNaN(n)) return String(price);

    if (n >= 1_000_000_000) {
        const v = n / 1_000_000_000;
        return `${v.toFixed(n % 1_000_000_000 === 0 ? 0 : 2)} tỷ`;
    }
    if (n >= 1_000_000) {
        const v = n / 1_000_000;
        return `${v.toFixed(n % 1_000_000 === 0 ? 0 : 2)} triệu`;
    }
    return n.toLocaleString('vi-VN');
};

const normalizeObject = (data) => {
    if (!data) return {};
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            if (parsed && typeof parsed === 'object') return parsed;
        } catch {
            // ignore
        }
        return { value: data };
    }
    if (Array.isArray(data)) return { value: data.join(', ') };
    if (typeof data === 'object') return data;
    return { value: String(data) };
};

const getFullName = (data) => {
    const first =
        data?.first_name ||
        data?.firstname ||
        data?.firstName ||
        data?.user_first_name ||
        data?.owner_first_name ||
        data?.ho ||
        data?.first;
    const last =
        data?.last_name ||
        data?.lastname ||
        data?.lastName ||
        data?.user_last_name ||
        data?.owner_last_name ||
        data?.ten ||
        data?.last;
    return [first, last].filter(Boolean).join(' ').trim();
};

const FIELD_LABELS = {
    legal: 'Pháp lý',
    floors: 'Tầng',
    floor: 'Tầng',
    bedrooms: 'Phòng ngủ',
    bedroom: 'Phòng ngủ',
    bathrooms: 'Phòng tắm',
    bathroom: 'Phòng tắm',
    direction: 'Hướng',
    furniture: 'Nội thất',
    phap_ly: 'Pháp lý',
    noi_that: 'Nội thất',
};

const PREFERRED_ORDER = [
    'legal',
    'floors',
    'bedrooms',
    'bathrooms',
    'direction',
    'furniture',
    'phap_ly',
    'noi_that',
];

const KeyValueRow = ({ label, value }) => (
    <View style={styles.kvRow}>
        <Text style={styles.kvLabel} numberOfLines={1}>
            {label}
        </Text>
        <Text style={styles.kvValue} numberOfLines={2}>
            {value || '—'}
        </Text>
    </View>
);

const KeyValueCard = ({ data }) => {
    const obj = useMemo(() => normalizeObject(data), [data]);

    const keys = useMemo(() => {
        const rawKeys = Object.keys(obj || {});
        return [
            ...PREFERRED_ORDER.filter((k) => rawKeys.includes(k)),
            ...rawKeys.filter((k) => !PREFERRED_ORDER.includes(k)),
        ];
    }, [obj]);

    if (!keys.length) {
        return (
            <View style={styles.sectionCard}>
                <Text style={styles.emptyDash}>—</Text>
            </View>
        );
    }

    return (
        <View style={styles.sectionCard}>
            {keys.map((k) => {
                const label = FIELD_LABELS[k] || k;
                let v = obj?.[k];

                if (v && typeof v === 'object') {
                    if (Array.isArray(v)) v = v.join(', ');
                    else v = JSON.stringify(v);
                }
                return <KeyValueRow key={k} label={label} value={v != null ? String(v) : ''} />;
            })}
        </View>
    );
};

const Stars = ({ value = 0, size = 16 }) => {
    const raw = Number(value) || 0;
    const full = Math.floor(raw);
    const hasHalf = raw - full > 0;
    return (
        <View style={{ flexDirection: 'row', gap: 2 }}>
            {Array.from({ length: 5 }).map((_, i) => {
                const name = i < full ? 'star' : i === full && hasHalf ? 'star-half' : 'star-outline';
                const active = i < full || (i === full && hasHalf);
                return <Ionicons key={i} name={name} size={size} color={active ? '#F5A623' : '#c7c7c7'} />;
            })}
        </View>
    );
};

const StarsPicker = ({ value, onChange }) => (
    <View style={{ flexDirection: 'row', gap: 6 }}>
        {Array.from({ length: 5 }).map((_, i) => {
            const score = i + 1;
            const active = score <= (value || 0);
            return (
                <TouchableOpacity key={score} onPress={() => onChange?.(score)} activeOpacity={0.85}>
                    <Ionicons
                        name={active ? 'star' : 'star-outline'}
                        size={22}
                        color={active ? '#F5A623' : '#999'}
                    />
                </TouchableOpacity>
            );
        })}
    </View>
);

// Build comment tree by parent_id
const buildCommentTree = (list = []) => {
    const map = new Map();
    list.forEach((c) => {
        const id = c?.id ?? c?.comment_id;
        if (id == null) return;
        map.set(id, { ...c, _id: id, replies: [] });
    });

    const roots = [];
    map.forEach((node) => {
        const parentId = node?.parent_id ?? node?.parentId ?? null;
        if (parentId && map.has(parentId)) map.get(parentId).replies.push(node);
        else roots.push(node);
    });

    // sort by created_at if exists
    const sortFn = (a, b) => {
        const ta = new Date(a?.created_at || a?.createdAt || 0).getTime();
        const tb = new Date(b?.created_at || b?.createdAt || 0).getTime();
        return ta - tb;
    };
    roots.sort(sortFn);
    roots.forEach((r) => r.replies.sort(sortFn));
    return roots;
};

// Try to read breakdown from rating summary (if BE returns)
const getStarCounts = (summary) => {
    if (!summary) return null;
    // possible keys
    const a = summary?.star_counts || summary?.stars || summary?.breakdown;
    if (!a) return null;

    // normalize to {5: n,4:n,...}
    if (Array.isArray(a)) return null;
    const out = {};
    [1, 2, 3, 4, 5].forEach((k) => {
        out[k] = Number(a?.[k] ?? a?.[String(k)] ?? 0) || 0;
    });
    return out;
};

export default function PostDetailScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const isFocused = useIsFocused();
    const { userToken } = useContext(AuthContext);

    const postId = route?.params?.postId || route?.params?.id;

    const passedImages = route?.params?.images || [];
    const passedTitle = route?.params?.title || '';
    const passedPrice = route?.params?.price ?? null;
    const passedArea = route?.params?.area ?? null;

    const sliderRef = useRef(null);

    const [loading, setLoading] = useState(true);
    const [post, setPost] = useState(null);
    const [images, setImages] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [favorited, setFavorited] = useState(false);
    const [galleryVisible, setGalleryVisible] = useState(false);
    const [galleryIndex, setGalleryIndex] = useState(0);

    const galleryRef = useRef(null);

    // Owner
    const [ownerLoading, setOwnerLoading] = useState(false);
    const [owner, setOwner] = useState(null);

    // Comments + author cache
    const [comments, setComments] = useState([]);
    const [cmtLoading, setCmtLoading] = useState(false);
    const [authorCache, setAuthorCache] = useState({}); // { [userId]: {...} }

    // Reply UI
    const [replyingTo, setReplyingTo] = useState(null); // commentId
    const [replyText, setReplyText] = useState('');
    const [sendingReply, setSendingReply] = useState(false);

    // Rating
    const [ratingSummary, setRatingSummary] = useState(null);

    // Forms
    const [myComment, setMyComment] = useState('');
    const [myScore, setMyScore] = useState(0);
    const [myRatingText, setMyRatingText] = useState('');
    const [sendingComment, setSendingComment] = useState(false);
    const [sendingRating, setSendingRating] = useState(false);

    const safeTitle = post?.title || passedTitle || 'Chi tiết bài đăng';
    const safePrice = post?.price ?? passedPrice;
    const safeArea = post?.area ?? passedArea;

    const heroImages =
        images?.length ? images : passedImages?.map((x) => x?.image_url || x?.url || x).filter(Boolean);

    const loadOwnerPublicProfile = async (ownerId) => {
        if (!ownerId) return;
        if (!ENDPOINTS?.USER_PUBLIC_PROFILE) return; // tránh crash nếu quên sửa endpoints.js

        setOwnerLoading(true);
        try {
            const res = await client.get(ENDPOINTS.USER_PUBLIC_PROFILE(ownerId));
            const data = res?.data?.result || res?.data;
            setOwner(data || null);
        } catch {
            setOwner(null);
        } finally {
            setOwnerLoading(false);
        }
    };

    const preloadCommentAuthors = async (list) => {
        if (!ENDPOINTS?.USER_PUBLIC_PROFILE) return;

        try {
            const ids = Array.from(
                new Set(
                    (list || [])
                        .map((c) => c?.user_id || c?.userId || c?.user?.id)
                        .filter(Boolean)
                )
            );

            const missing = ids.filter((id) => !authorCache?.[id]);
            if (missing.length === 0) return;

            const next = { ...(authorCache || {}) };
            for (const uid of missing) {
                try {
                    const res = await client.get(ENDPOINTS.USER_PUBLIC_PROFILE(uid));
                    const data = res?.data?.result || res?.data;
                    if (data) next[uid] = data;
                } catch {
                    // ignore
                }
            }
            setAuthorCache(next);
        } catch {
            // ignore
        }
    };

    const loadDetail = async () => {
        if (!postId) {
            setPost(null);
            setImages([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const res = await client.get(ENDPOINTS.POST_DETAIL(postId));
            const data = res?.data?.result || res?.data;

            setPost(data || null);

            const imgs =
                Array.isArray(data?.images) && data.images.length > 0
                    ? data.images.map((x) => x?.image_url || x?.url || x).filter(Boolean)
                    : Array.isArray(passedImages)
                        ? passedImages.map((x) => x?.image_url || x?.url || x).filter(Boolean)
                        : [];
            setImages(imgs);

            // ✅ Owner: ưu tiên nếu BE trả object owner
            if (data?.owner && typeof data.owner === 'object') {
                setOwner(data.owner);
            } else {
                const ownerId = data?.owner_id || data?.ownerId || data?.owner;
                if (ownerId) loadOwnerPublicProfile(ownerId);
            }

            // favorite status (nếu có)
            try {
                const f = await client.get(ENDPOINTS.FAVORITES_STATUS(postId));
                const isFav = Number(f?.data?.favorited ?? f?.data?.is_favorited ?? 0) === 1;
                setFavorited(isFav);
            } catch {
                // ignore
            }
        } catch {
            setPost(null);
            setImages([]);
        } finally {
            setLoading(false);
        }
    };

    const toggleFavorite = async () => {
        try {
            const res = await client.post(ENDPOINTS.FAVORITES_TOGGLE, { post_id: postId });
            const fav = Number(res?.data?.favorited ?? 0) === 1;
            setFavorited(fav);
        } catch {
            Alert.alert('Thông báo', 'Bạn cần đăng nhập để lưu tin.');
        }
    };

    const startChat = async () => {
        const ownerId = owner?.id || post?.owner_id || post?.ownerId || post?.owner;
        if (!ownerId) {
            Alert.alert('Thông báo', 'Không tìm thấy người đăng để bắt đầu chat.');
            return;
        }
        if (!userToken) {
            Alert.alert('Thông báo', 'Bạn cần đăng nhập để nhắn tin.');
            navigation.navigate('Login');
            return;
        }

        try {
            const res = await client.post(ENDPOINTS.CHAT_ROOMS, {
                seller_id: ownerId,
                listing_id: postId,
            });
            const roomId = res?.data?.room_id;
            if (!roomId) throw new Error('No room_id');

            navigation.navigate('Chat', {
                screen: 'ChatRoom',
                params: {
                    roomId,
                    otherUserId: ownerId,
                    otherUserName: ownerName,
                    listingId: postId,
                },
            });
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Không tạo được phòng chat.';
            Alert.alert('Thông báo', String(msg));
        }
    };

    const loadRatingSummary = async () => {
        if (!postId) return;
        try {
            const res = await client.get(ENG_ENDPOINTS.RATINGS_SUMMARY(postId));
            const data = res?.data?.result ?? res?.data;
            setRatingSummary(data || null);
        } catch {
            setRatingSummary(null);
        }
    };

    const loadComments = async () => {
        if (!postId) return;
        setCmtLoading(true);
        try {
            const res = await client.get(ENG_ENDPOINTS.COMMENTS_LIST(postId));
            const data = res?.data?.result ?? res?.data;
            const list = Array.isArray(data) ? data : [];
            setComments(list);
            await preloadCommentAuthors(list);
        } catch {
            setComments([]);
        } finally {
            setCmtLoading(false);
        }
    };

    const submitComment = async () => {
        const content = myComment?.trim?.();
        if (!content) {
            Alert.alert('Thông báo', 'Bạn hãy nhập nội dung bình luận.');
            return;
        }

        setSendingComment(true);
        try {
            await client.post(ENG_ENDPOINTS.COMMENTS_CREATE, {
                post_id: postId,
                content,
                parent_id: null,
            });

            setMyComment('');
            await loadComments();
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Bạn cần đăng nhập để bình luận.';
            Alert.alert('Thông báo', String(msg));
        } finally {
            setSendingComment(false);
        }
    };

    const submitReply = async () => {
        const content = replyText?.trim?.();
        if (!replyingTo) return;
        if (!content) {
            Alert.alert('Thông báo', 'Bạn hãy nhập nội dung trả lời.');
            return;
        }

        setSendingReply(true);
        try {
            await client.post(ENG_ENDPOINTS.COMMENTS_CREATE, {
                post_id: postId,
                content,
                parent_id: replyingTo,
            });

            setReplyText('');
            setReplyingTo(null);
            await loadComments();
        } catch (e) {
            const msg = e?.response?.data?.detail || 'Bạn cần đăng nhập để trả lời bình luận.';
            Alert.alert('Thông báo', String(msg));
        } finally {
            setSendingReply(false);
        }
    };

    const submitRating = async () => {
        if (!postId) return;
        if (!myScore) {
            Alert.alert('Thông báo', 'Bạn hãy chọn số sao (1-5).');
            return;
        }

        setSendingRating(true);
        try {
            const note = myRatingText?.trim?.();

            await client.post(ENG_ENDPOINTS.RATINGS_UPSERT, {
                post_id: postId,
                score: myScore,
                rating: myScore, // hỗ trợ BE khác tên
                comment: note || undefined,
                content: note || undefined,
            });

            setMyRatingText('');
            Alert.alert('OK', 'Đã gửi đánh giá!');
            await loadRatingSummary(); // ✅ lưu + xuất thống kê ngay
        } catch (e) {
            const msg = e?.response?.data?.detail || JSON.stringify(e?.response?.data || {});
            Alert.alert('Không gửi được đánh giá', msg || 'Bạn cần đăng nhập để đánh giá.');
        } finally {
            setSendingRating(false);
        }
    };

    useEffect(() => {
        if (isFocused) {
            setOwner(null);
            loadDetail();
            loadComments();
            loadRatingSummary();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFocused, postId]);

    const onScrollImages = (e) => {
        const x = e?.nativeEvent?.contentOffset?.x ?? 0;
        const idx = Math.round(x / width);
        setActiveIndex(idx);
    };

    const onScrollGallery = (e) => {
        const x = e?.nativeEvent?.contentOffset?.x ?? 0;
        const idx = Math.round(x / width);
        setGalleryIndex(idx);
    };

    const scrollToIndex = (idx) => {
        if (!sliderRef.current) return;
        sliderRef.current.scrollToIndex({ index: idx, animated: true });
        setActiveIndex(idx);
    };

    const openGallery = (idx) => {
        setGalleryIndex(idx);
        setGalleryVisible(true);
    };

    useEffect(() => {
        if (!galleryVisible) return;
        if (!galleryRef.current) return;
        galleryRef.current.scrollToIndex({ index: galleryIndex, animated: false });
    }, [galleryVisible, galleryIndex]);

    const openGoogleMap = () => {
        const loc = post?.location;
        const lat = loc?.lat ?? loc?.latitude;
        const lng = loc?.lng ?? loc?.longitude;

        if (lat != null && lng != null) {
            Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`);
            return;
        }

        const addr = addressToText(post?.address);
        if (addr) {
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`);
            return;
        }

        Alert.alert('Thông báo', 'Bài đăng chưa có vị trí.');
    };

    const getAuthorName = (c) => {
        const inlineUser = c?.user && typeof c.user === 'object' ? c.user : null;
        const uid = c?.user_id || c?.userId || c?.user?.id;
        const cached = uid ? authorCache?.[uid] : null;
        const data = inlineUser || cached || c;

        const fullName = getFullName(data);
        if (fullName) return fullName;

        const direct =
            data?.full_name ||
            data?.name ||
            data?.user_name ||
            data?.username ||
            inlineUser?.full_name ||
            inlineUser?.name ||
            inlineUser?.username;
        if (direct) return String(direct);

        return uid ? String(uid) : '??"';
    };

    const getAuthorAvatar = (c) => {
        const inlineUser = c?.user && typeof c.user === 'object' ? c.user : null;
        const uid = c?.user_id || c?.userId || c?.user?.id;
        const cached = uid ? authorCache?.[uid] : null;
        const data = inlineUser || cached || c;
        const raw =
            data?.anh_dai_dien ||
            data?.avatar ||
            data?.avatar_url ||
            data?.image ||
            data?.image_url ||
            data?.url;
        return toAbsoluteMediaUrl(raw) || DEFAULT_AVATAR;
    };

    const getTimeText = (c) => c?.created_at || c?.createdAt || c?.time || '';

    const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

    const renderCommentNode = (node, level = 0) => {
        const content = node?.content || node?.text || node?.message || node?.body || '';
        const author = getAuthorName(node);
        const created = getTimeText(node);
        const avatar = getAuthorAvatar(node);

        return (
            <View key={node._id} style={[styles.cmtItem, level > 0 && { marginLeft: 18 }]}>
                <View style={styles.cmtHeader}>
                    <View style={styles.cmtAvatar}>
                        {avatar ? (
                            <Image source={{ uri: avatar }} style={styles.cmtAvatarImage} />
                        ) : (
                            <Ionicons name="person" size={14} color="#666" />
                        )}
                    </View>

                    <View style={{ flex: 1 }}>
                        <View style={styles.rowBetween}>
                            <Text style={styles.cmtAuthor} numberOfLines={1}>
                                {author}
                            </Text>
                            <Text style={styles.cmtTime} numberOfLines={1}>
                                {created}
                            </Text>
                        </View>

                        <Text style={styles.cmtText}>{String(content)}</Text>

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => {
                                    if (replyingTo === node._id) {
                                        setReplyingTo(null);
                                        setReplyText('');
                                    } else {
                                        setReplyingTo(node._id);
                                        setReplyText('');
                                    }
                                }}
                            >
                                <Text style={{ fontWeight: '900', color: '#111' }}>Trả lời</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Reply box (independent) */}
                        {replyingTo === node._id ? (
                            <View style={{ marginTop: 10 }}>
                                <TextInput
                                    value={replyText}
                                    onChangeText={setReplyText}
                                    placeholder="Nhập trả lời..."
                                    placeholderTextColor="#999"
                                    style={styles.input}
                                    multiline
                                />
                                <TouchableOpacity
                                    onPress={submitReply}
                                    disabled={sendingReply}
                                    activeOpacity={0.9}
                                    style={[styles.primaryBtn, sendingReply && { opacity: 0.6 }]}
                                >
                                    <Text style={styles.primaryBtnText}>
                                        {sendingReply ? 'Đang gửi...' : 'Gửi trả lời'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}
                    </View>
                </View>

                {Array.isArray(node.replies) && node.replies.length > 0 ? (
                    <View style={{ marginTop: 12, gap: 10 }}>
                        {node.replies.map((r) => renderCommentNode(r, level + 1))}
                    </View>
                ) : null}
            </View>
        );
    };

    const starCounts = useMemo(() => getStarCounts(ratingSummary), [ratingSummary]);
    const totalFromCounts = useMemo(() => {
        if (!starCounts) return 0;
        return [1, 2, 3, 4, 5].reduce((sum, k) => sum + (Number(starCounts[k]) || 0), 0);
    }, [starCounts]);
    const totalRatings = Number(ratingSummary?.count ?? ratingSummary?.total ?? totalFromCounts ?? 0) || 0;
    const avgFromCounts = totalFromCounts
        ? [1, 2, 3, 4, 5].reduce((sum, k) => sum + k * (Number(starCounts?.[k]) || 0), 0) /
        totalFromCounts
        : 0;
    const avgScore = Number(ratingSummary?.avg ?? ratingSummary?.average ?? 0) || avgFromCounts;

    const ownerProfile =
        owner && typeof owner === 'object'
            ? owner
            : post?.owner && typeof post.owner === 'object'
                ? post.owner
                : null;
    const ownerData = ownerProfile || {
        owner_first_name: post?.owner_first_name,
        owner_last_name: post?.owner_last_name,
        first_name: post?.owner_first_name,
        last_name: post?.owner_last_name,
    };
    const ownerFullName = getFullName(ownerData);
    const ownerName =
        ownerFullName ||
        ownerProfile?.full_name ||
        ownerProfile?.name ||
        ownerProfile?.username ||
        post?.owner_username ||
        post?.owner_name ||
        post?.ownerUserName ||
        '??"';
    const ownerAvatar =
        toAbsoluteMediaUrl(
            ownerProfile?.anh_dai_dien ||
            ownerProfile?.avatar ||
            ownerProfile?.avatar_url ||
            ownerProfile?.image ||
            ownerProfile?.image_url ||
            ownerProfile?.url
        ) || DEFAULT_AVATAR;

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Ionicons name="chevron-back" size={26} color="#111" />
                </TouchableOpacity>

                <Text style={styles.headerTitle} numberOfLines={1}>
                    Chi tiết bài đăng
                </Text>

                <TouchableOpacity onPress={toggleFavorite} style={styles.headerBtn} activeOpacity={0.8}>
                    <Ionicons name={favorited ? 'heart' : 'heart-outline'} size={24} color="#111" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator />
                </View>
            ) : (
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                    {/* Slider ảnh */}
                    <View style={{ position: 'relative' }}>
                        {heroImages?.length ? (
                            <>
                                <FlatList
                                    ref={sliderRef}
                                    data={heroImages}
                                    horizontal
                                    pagingEnabled
                                    showsHorizontalScrollIndicator={false}
                                    keyExtractor={(item, idx) => `${item}-${idx}`}
                                    onScroll={onScrollImages}
                                    renderItem={({ item, index }) => (
                                        <TouchableOpacity
                                            activeOpacity={0.9}
                                            onPress={() => openGallery(index)}
                                        >
                                            <Image source={{ uri: item }} style={styles.hero} resizeMode="cover" />
                                        </TouchableOpacity>
                                    )}
                                />

                                <View style={styles.counter}>
                                    <Text style={styles.counterText}>
                                        {Math.min(activeIndex + 1, heroImages.length)}/{heroImages.length}
                                    </Text>
                                </View>

                                <View style={styles.thumbRow}>
                                    {heroImages.slice(0, 8).map((x, idx) => (
                                        <TouchableOpacity
                                            key={`${x}-${idx}`}
                                            activeOpacity={0.85}
                                            onPress={() => openGallery(idx)}
                                        >
                                            <Image source={{ uri: x }} style={styles.thumb} />
                                        </TouchableOpacity>
                                    ))}
                                    {heroImages.length > 8 ? (
                                        <View style={[styles.thumb, styles.moreThumb]}>
                                            <Text style={{ color: '#fff', fontWeight: '900' }}>+{heroImages.length - 8}</Text>
                                        </View>
                                    ) : null}
                                </View>
                            </>
                        ) : (
                            <View style={[styles.hero, { justifyContent: 'center', alignItems: 'center' }]}>
                                <Ionicons name="image-outline" size={40} color="#666" />
                                <Text style={{ color: '#666', marginTop: 6 }}>Chưa có ảnh</Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.container}>
                        {/* Title + price + area */}
                        <Text style={styles.title}>{safeTitle}</Text>

                        <View style={styles.metaRow}>
                            <View style={styles.metaChip}>
                                <Ionicons name="cash-outline" size={16} color="#111" />
                                <Text style={styles.metaText}>
                                    {safePrice != null ? formatPriceVN(safePrice) : '—'}
                                </Text>
                            </View>

                            <View style={styles.metaChip}>
                                <Ionicons name="resize-outline" size={16} color="#111" />
                                <Text style={styles.metaText}>{safeArea != null ? `${safeArea} m²` : '—'}</Text>
                            </View>
                        </View>

                        {/* ✅ Người đăng */}
                        <View style={styles.ownerCard}>
                            <TouchableOpacity
                                style={styles.ownerLeft}
                                activeOpacity={0.85}
                                onPress={() => {
                                    const ownerId = owner?.id || post?.owner_id || post?.ownerId || post?.owner;
                                    if (!ownerId) return;
                                    navigation.navigate('OwnerProfile', {
                                        ownerId,
                                        ownerName,
                                        ownerAvatar,
                                    });
                                }}
                            >
                                <View style={styles.avatar}>
                                    {ownerAvatar ? (
                                        <Image source={{ uri: ownerAvatar }} style={styles.avatarImage} />
                                    ) : (
                                        <Ionicons name="person-outline" size={22} color="#666" />
                                    )}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.ownerLabel}>Người đăng</Text>
                                    <Text style={styles.ownerName} numberOfLines={2}>
                                        {ownerLoading ? 'Đang tải...' : ownerName}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <View style={styles.ownerActions}>
                                <TouchableOpacity activeOpacity={0.85} style={styles.chatBtn} onPress={startChat}>
                                    <Ionicons name="chatbubble-ellipses-outline" size={18} color="#111" />
                                    <Text style={styles.chatText}>Nhắn tin</Text>
                                </TouchableOpacity>

                                {(owner?.phone || owner?.email) && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            const phone = owner?.phone;
                                            const email = owner?.email;
                                            if (phone) Linking.openURL(`tel:${phone}`);
                                            else if (email) Linking.openURL(`mailto:${email}`);
                                        }}
                                        activeOpacity={0.85}
                                        style={styles.contactBtn}
                                    >
                                        <Ionicons name="call-outline" size={18} color="#111" />
                                        <Text style={styles.contactText}>Liên hệ</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Address + Map */}
                        {post?.address || post?.location ? (
                            <View style={styles.sectionCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="location-outline" size={18} color="#111" />
                                    <Text style={{ flex: 1, color: '#111', fontWeight: '800' }}>
                                        {addressToText(post?.address) || '—'}
                                    </Text>
                                </View>

                                <TouchableOpacity onPress={openGoogleMap} style={styles.mapBtn} activeOpacity={0.85}>
                                    <Text style={styles.mapBtnText}>Xem bản đồ</Text>
                                    <Text style={styles.mapBtnRight}>›</Text>
                                </TouchableOpacity>
                            </View>
                        ) : null}

                        {/* Mô tả */}
                        <Text style={styles.sectionTitle}>Mô tả</Text>
                        <View style={styles.sectionCard}>
                            <Text style={styles.bodyText}>
                                {post?.description?.trim?.() ? post.description : '—'}
                            </Text>
                        </View>

                        {/* Chi tiết */}
                        <Text style={styles.sectionTitle}>Chi tiết</Text>
                        <KeyValueCard data={post?.details} />

                        {/* Thông tin khác */}
                        <Text style={styles.sectionTitle}>Thông tin khác</Text>
                        <KeyValueCard data={post?.other_info} />

                        {/* ✅ BÌNH LUẬN */}
                        <Text style={styles.sectionTitle}>Bình luận</Text>

                        {/* Form gửi bình luận */}
                        <View style={styles.sectionCard}>
                            <Text style={styles.subTitle}>Viết bình luận</Text>
                            <TextInput
                                value={myComment}
                                onChangeText={setMyComment}
                                placeholder="Nhập bình luận..."
                                placeholderTextColor="#999"
                                style={styles.input}
                                multiline
                            />

                            <TouchableOpacity
                                onPress={submitComment}
                                disabled={sendingComment}
                                activeOpacity={0.9}
                                style={[styles.primaryBtn, sendingComment && { opacity: 0.6 }]}
                            >
                                <Text style={styles.primaryBtnText}>
                                    {sendingComment ? 'Đang gửi...' : 'Gửi bình luận'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* List bình luận + replies */}
                        <View style={styles.sectionCard}>
                            <View style={styles.rowBetween}>
                                <Text style={styles.subTitle}>Danh sách bình luận</Text>
                                <TouchableOpacity onPress={loadComments} activeOpacity={0.8}>
                                    <Ionicons name="refresh" size={18} color="#111" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.divider} />

                            {cmtLoading ? (
                                <View style={{ paddingVertical: 10 }}>
                                    <ActivityIndicator />
                                </View>
                            ) : commentTree.length === 0 ? (
                                <Text style={{ color: '#666' }}>Chưa có bình luận.</Text>
                            ) : (
                                <View style={{ gap: 12 }}>{commentTree.map((n) => renderCommentNode(n, 0))}</View>
                            )}
                        </View>

                        {/* ✅ ĐÁNH GIÁ (CUỐI) */}
                        <Text style={styles.sectionTitle}>Đánh giá</Text>

                        {/* Summary */}
                        <View style={styles.sectionCard}>
                            <View style={styles.rowBetween}>
                                <View>
                                    <Text style={{ fontWeight: '900', color: '#111' }}>
                                        {totalRatings ? Number(avgScore).toFixed(1) : '—'} / 5
                                    </Text>
                                    <Text style={{ color: '#666', marginTop: 2 }}>{totalRatings} lượt đánh giá</Text>
                                </View>
                                <Stars value={avgScore || 0} size={18} />
                            </View>

                            {/* Breakdown nếu có */}
                            {starCounts ? (
                                <View style={{ marginTop: 12, gap: 8 }}>
                                    {[5, 4, 3, 2, 1].map((k) => {
                                        const c = starCounts[k] || 0;
                                        const basePct = Math.round((k / 5) * 100);
                                        const active = c > 0;
                                        return (
                                            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                                <Text style={{ width: 22, fontWeight: '900', color: '#111' }}>{k}</Text>
                                                <View style={styles.barWrap}>
                                                    <View
                                                        style={[
                                                            styles.barFill,
                                                            {
                                                                width: `${basePct}%`,
                                                                backgroundColor: active ? '#F5A623' : '#e5e7eb',
                                                            },
                                                        ]}
                                                    />
                                                </View>
                                                <Text style={{ width: 52, textAlign: 'right', color: '#666' }}>{c}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            ) : null}

                            <TouchableOpacity onPress={loadRatingSummary} activeOpacity={0.8} style={styles.refreshMini}>
                                <Ionicons name="refresh" size={16} color="#111" />
                                <Text style={{ fontWeight: '800', color: '#111' }}>Tải lại</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Form gửi đánh giá */}
                        <View style={styles.sectionCard}>
                            <Text style={styles.subTitle}>Đánh giá của bạn</Text>

                            <StarsPicker value={myScore} onChange={setMyScore} />

                            <TextInput
                                value={myRatingText}
                                onChangeText={setMyRatingText}
                                placeholder="Nhận xét (tuỳ chọn)..."
                                placeholderTextColor="#999"
                                style={styles.input}
                                multiline
                            />

                            <TouchableOpacity
                                onPress={submitRating}
                                disabled={sendingRating}
                                activeOpacity={0.9}
                                style={[styles.primaryBtn, sendingRating && { opacity: 0.6 }]}
                            >
                                <Text style={styles.primaryBtnText}>{sendingRating ? 'Đang gửi...' : 'Gửi đánh giá'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            )}

            <Modal
                visible={galleryVisible}
                transparent
                onRequestClose={() => setGalleryVisible(false)}
            >
                <View style={styles.galleryBackdrop}>
                    <FlatList
                        ref={galleryRef}
                        data={heroImages}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        keyExtractor={(item, idx) => `${item}-${idx}`}
                        onScroll={onScrollGallery}
                        getItemLayout={(_, index) => ({
                            length: width,
                            offset: width * index,
                            index,
                        })}
                        renderItem={({ item }) => (
                            <View style={styles.galleryItem}>
                                <Image source={{ uri: item }} style={styles.galleryImage} resizeMode="contain" />
                            </View>
                        )}
                    />

                    <View style={styles.galleryTopBar}>
                        <Text style={styles.galleryCounter}>
                            {Math.min(galleryIndex + 1, heroImages.length)}/{heroImages.length}
                        </Text>
                        <TouchableOpacity onPress={() => setGalleryVisible(false)} style={styles.galleryClose}>
                            <Ionicons name="close" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
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
    headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, textAlign: 'center', fontWeight: '900', color: '#111' },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    hero: { width, height: 260, backgroundColor: '#eee' },

    counter: {
        position: 'absolute',
        right: 12,
        top: 64,
        backgroundColor: 'rgba(0,0,0,0.55)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
    },
    counterText: { color: '#fff', fontWeight: '800' },

    thumbRow: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    thumb: { width: 70, height: 70, borderRadius: 14, marginRight: 10, backgroundColor: '#eee' },
    moreThumb: { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },

    galleryBackdrop: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    galleryItem: { width, height: '100%', justifyContent: 'center', alignItems: 'center' },
    galleryImage: { width: '100%', height: '100%' },
    galleryTopBar: {
        position: 'absolute',
        top: 16,
        left: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    galleryCounter: { color: '#fff', fontWeight: '900' },
    galleryClose: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    container: { padding: 14 },

    title: { fontSize: 18, fontWeight: '900', color: '#111' },

    metaRow: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
    metaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 999,
    },
    metaText: { fontWeight: '800', color: '#111' },

    sectionTitle: { marginTop: 18, fontSize: 18, fontWeight: '900', color: '#111' },
    subTitle: { fontWeight: '900', color: '#111' },

    sectionCard: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 16,
        padding: 14,
        backgroundColor: '#fff',
    },

    bodyText: { color: '#111', lineHeight: 20 },

    kvRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
        gap: 10,
    },
    kvLabel: {
        color: '#6b7280',
        fontWeight: '800',
        fontSize: 15,
        flex: 1,
        maxWidth: '55%',
    },
    kvValue: {
        color: '#111',
        fontWeight: '700',
        fontSize: 15,
        textAlign: 'right',
        flex: 1,
    },
    emptyDash: { color: '#6b7280', fontWeight: '800', fontSize: 18 },

    mapBtn: {
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 14,
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    mapBtnText: { fontWeight: '900', color: '#111', fontSize: 16 },
    mapBtnRight: { color: '#666', fontWeight: '800' },

    ownerCard: {
        marginTop: 14,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 16,
        padding: 12,
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    ownerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 999,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarImage: { width: 40, height: 40, borderRadius: 999 },
    ownerLabel: { color: '#6b7280', fontWeight: '800', fontSize: 12 },
    ownerName: { color: '#111', fontWeight: '900', fontSize: 16, marginTop: 2 },

    ownerActions: { flexDirection: 'column', alignItems: 'flex-end', gap: 8 },
    contactBtn: {
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    contactText: { fontWeight: '900', color: '#111' },
    chatBtn: {
        backgroundColor: '#FFEDB8',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    chatText: { fontWeight: '900', color: '#111' },

    divider: { height: 1, backgroundColor: '#eee', marginVertical: 12 },

    input: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        minHeight: 44,
        color: '#111',
    },

    primaryBtn: {
        marginTop: 10,
        backgroundColor: '#111',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    primaryBtnText: { color: '#fff', fontWeight: '900' },

    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    cmtItem: {
        borderWidth: 1,
        borderColor: '#f0f0f0',
        borderRadius: 12,
        padding: 12,
        backgroundColor: '#fff',
    },
    cmtHeader: { flexDirection: 'row', gap: 10 },
    cmtAvatar: {
        width: 26,
        height: 26,
        borderRadius: 999,
        backgroundColor: '#f3f4f6',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    cmtAvatarImage: { width: 26, height: 26, borderRadius: 999 },
    cmtAuthor: { fontWeight: '900', color: '#111', flex: 1 },
    cmtTime: { color: '#999', fontSize: 12, marginLeft: 10 },
    cmtText: { marginTop: 6, color: '#333', lineHeight: 18 },

    refreshMini: {
        marginTop: 10,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },

    barWrap: {
        flex: 1,
        height: 10,
        borderRadius: 999,
        backgroundColor: '#f3f4f6',
        overflow: 'hidden',
    },
    barFill: {
        height: 10,
        borderRadius: 999,
        backgroundColor: '#111',
    },
});
