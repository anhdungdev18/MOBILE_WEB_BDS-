// src/screens/Home/HomeScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import apiClient from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';
import {
    getDistrictsByProvinceCode,
    getProvinces,
    getWardsByDistrictCode,
} from '../../utils/locations';

const TX_TYPES = {
    ALL: 'ALL',
    SELL: 1,
    RENT: 2,
};

const APPROVED_IDS = new Set([2]); // DB: 2 = Approved
const PAGE_SIZE = 5;

export default function HomeScreen() {
    const isFocused = useIsFocused();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [posts, setPosts] = useState([]);
    const [txFilter, setTxFilter] = useState(TX_TYPES.ALL);

    // ✅ CATEGORY MAP: category_id -> name (Loại BĐS)
    const [categoryMap, setCategoryMap] = useState({});

    // ✅ FAVORITES
    const [favMap, setFavMap] = useState({}); // { postId: 1/0 }

    // ✅ ADDRESS CACHE (lấy từ API detail)
    const [addressMap, setAddressMap] = useState({}); // { postId: "địa chỉ" }
    const fetchingAddressRef = useRef(new Set()); // chống gọi trùng

    // SEARCH (tiêu đề/địa chỉ)
    const [q, setQ] = useState('');

    // ✅ LOCATION FILTER (Tỉnh/Quận/Phường)
    const [locOpen, setLocOpen] = useState(false);
    const [locLoading, setLocLoading] = useState(false);
    const [locSearch, setLocSearch] = useState('');
    const [locError, setLocError] = useState('');

    const [provinces, setProvinces] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [wards, setWards] = useState([]);

    const [province, setProvince] = useState(null);
    const [district, setDistrict] = useState(null);
    const [ward, setWard] = useState(null);
    const [provinceOpen, setProvinceOpen] = useState(false);
    const [districtOpen, setDistrictOpen] = useState(false);
    const [wardOpen, setWardOpen] = useState(false);

    // ✅ Notifications placeholder
    const [unreadCount, setUnreadCount] = useState(0);

    // ✅ Lazy load
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [loadingMore, setLoadingMore] = useState(false);

    // AI Chat (giữ skeleton, bạn có thể xóa nếu không dùng)
    const [aiOpen, setAiOpen] = useState(false);
    const [aiTyping, setAiTyping] = useState(false);
    const [aiInput, setAiInput] = useState('');
    const [sessionId, setSessionId] = useState(null);
    const [aiMessages, setAiMessages] = useState([
        { id: 'm0', role: 'assistant', text: 'Đây là chatbox AI của ứng dụng!.', createdAt: Date.now() },
    ]);
    const chatListRef = useRef(null);

    /* ================= HELPERS ================= */

    const normalizeText = (s) => (s ?? '').toString().trim().toLowerCase();

    const getTxTypeId = (p) => {
        const candidates = [
            p?.txTypeId,
            p?.tx_type_id,
            p?.tx_type,
            p?.post_type_id,
            p?.postTypeId,
            p?.post_type,
            p?.transaction_type_id,
            p?.transactionTypeId,
            p?.type_id,
            p?.typeId,
        ];
        for (const v of candidates) {
            if (v !== null && v !== undefined && v !== '') return Number(v);
        }
        return null;
    };

    const txLabel = (id) => {
        const n = Number(id);
        if (n === 1) return 'Bán';
        if (n === 2) return 'Cho thuê';
        return 'Khác';
    };

    const formatPrice = (v) => {
        if (v === null || v === undefined || v === '') return 'Liên hệ';
        const n = Number(v);
        if (Number.isNaN(n)) return String(v);
        return n.toLocaleString('vi-VN');
    };

    const getFirstImageUrl = (p) => p?.images?.[0]?.image_url || p?.images?.[0]?.url || null;

    const norm = (v) => String(v ?? '').trim().toLowerCase();

    const getPostLocationText = (p) =>
        normalizeText(
            addressMap?.[p?.id] ||
            p?.address ||
            p?.address_text ||
            p?.location_text ||
            p?.province ||
            p?.district ||
            p?.ward ||
            p?.location ||
            ''
        );

    const isApproved = (p) => {
        const raw = p?.approval_status ?? p?.approval_status_id;

        if (raw && typeof raw === 'object') {
            const id = Number(raw?.id);
            const name = norm(raw?.name || raw?.title);
            if (!Number.isNaN(id)) return APPROVED_IDS.has(id);
            if (name) return name.includes('approved') || name.includes('duyệt') || name.includes('đã duyệt');
            return false;
        }

        if (typeof raw === 'boolean') return raw;
        if (typeof raw === 'number') return APPROVED_IDS.has(raw);

        const s = norm(raw);
        if (!s) return false;
        const n = Number(s);
        if (!Number.isNaN(n)) return APPROVED_IDS.has(n);
        return s.includes('approved') || s.includes('duyệt') || s.includes('đã duyệt');
    };

    const isHidden = (p) => {
        const norm2 = (x) => (x == null ? '' : String(x)).toLowerCase().trim();
        const raw =
            p?.post_status_id ??
            p?.postStatusId ??
            p?.post_status ??
            p?.postStatus ??
            p?.post_status_name ??
            p?.status_name ??
            p?.status;

        if (raw && typeof raw === 'object') {
            const id = Number(raw?.id);
            const name = norm2(raw?.name || raw?.title);
            if (!Number.isNaN(id)) return id === 1 || id === 3;
            if (name) return name.includes('hidden') || name.includes('ẩn');
            return false;
        }

        if (typeof raw === 'number') return raw === 1 || raw === 3;
        const s = norm2(raw);
        return s.includes('hidden') || s.includes('ẩn');
    };

    /* ================= FAVORITES ================= */

    const loadFavorites = async () => {
        try {
            const favRes = await apiClient.get(ENDPOINTS.FAVORITES_MY);
            const favIds = (favRes.data || []).map((x) => String(x.post_id));
            const map = {};
            favIds.forEach((id) => (map[id] = 1));
            setFavMap(map);
        } catch (e) {
            setFavMap({});
        }
    };

    const toggleFavorite = async (postId) => {
        if (!postId) return;
        try {
            const res = await apiClient.post(ENDPOINTS.FAVORITES_TOGGLE, { post_id: postId });
            const favorited = res?.data?.favorited ?? 0;
            setFavMap((prev) => ({ ...prev, [postId]: favorited }));
        } catch (e) {
            Alert.alert('Thông báo', 'Bạn cần đăng nhập để lưu tin.');
        }
    };

    /* ================= ADDRESS FROM DETAIL ================= */

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

        if (typeof address === 'string') {
            const s = address.trim();
            if (!s) return '';
            if (s.startsWith('{') || s.startsWith('[')) {
                try {
                    const obj = JSON.parse(s);
                    return addressToText(obj);
                } catch {
                    return s;
                }
            }
            return s;
        }

        return String(address).trim();
    };

    const getPostDetailUrlCandidates = (id) => {
        const base = ENDPOINTS.POST_DETAIL ? ENDPOINTS.POST_DETAIL(id) : `/api/listings/posts/${id}`;
        const noSlash = base.replace(/\/+$/, '');
        return [noSlash, `${noSlash}/`];
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

    const fetchPostDetailAddress = async (postId) => {
        if (!postId) return;

        if (Object.prototype.hasOwnProperty.call(addressMap, postId)) return;
        if (fetchingAddressRef.current.has(postId)) return;

        fetchingAddressRef.current.add(postId);

        try {
            const candidates = getPostDetailUrlCandidates(postId);

            let data = null;
            for (const url of candidates) {
                try {
                    const res = await apiClient.get(url);
                    data = res.data;
                    break;
                } catch { }
            }

            const detail = data?.result || data || {};
            const addressText = extractAddressFromDetail(detail);

            setAddressMap((prev) => ({ ...prev, [postId]: addressText || '' }));
        } catch {
            setAddressMap((prev) => ({ ...prev, [postId]: '' }));
        } finally {
            fetchingAddressRef.current.delete(postId);
        }
    };

    const hydrateAddressesForPosts = async (list) => {
        const ids = (list || [])
            .map((p) => p?.id)
            .filter(Boolean)
            .filter((id) => !Object.prototype.hasOwnProperty.call(addressMap, id));

        if (!ids.length) return;

        const BATCH = 6;
        for (let i = 0; i < ids.length; i += BATCH) {
            const batch = ids.slice(i, i + BATCH);
            await Promise.all(batch.map((id) => fetchPostDetailAddress(id)));
        }
    };

    /* ================= CATEGORIES ================= */

    const fetchCategories = async () => {
        try {
            const base = ENDPOINTS?.CATEGORIES || ENDPOINTS?.LISTING_CATEGORIES || '/api/listings/categories';
            const s = String(base).replace(/\/+$/, '');
            const urls = [s, `${s}/`];

            let data = null;
            for (const u of urls) {
                try {
                    const res = await apiClient.get(u);
                    data = res?.data;
                    break;
                } catch { }
            }

            const arr =
                Array.isArray(data) ? data : data?.results || data?.items || data?.result || data?.data || [];

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

    /* ================= LOCATION API (FIX) ================= */

    const pickArray = (data) => {
        if (Array.isArray(data)) return data;

        const candidates = [
            data?.results,
            data?.items,
            data?.result,
            data?.data,
            data?.data?.results,
            data?.data?.items,
            data?.data?.result,
            data?.payload,
        ];

        for (const c of candidates) {
            if (Array.isArray(c)) return c;
        }
        return [];
    };

    const tryGetWithLog = async (urls, tag) => {
        let lastErr = null;
        for (const url of urls) {
            try {
                const res = await apiClient.get(url);
                return res?.data;
            } catch (e) {
                lastErr = e;
                console.log(`[${tag}] FAIL`, url, e?.response?.status, e?.response?.data || e?.message);
            }
        }
        throw lastErr || new Error('Request failed');
    };

    const fetchProvinces = async () => {
        setLocLoading(true);
        setLocError('');
        try {
            const base = ENDPOINTS?.LOCATIONS_PROVINCES || ENDPOINTS?.PROVINCES;
            let arr = [];
            if (base) {
                const s = String(base).replace(/\/+$/, '');
                const urls = [s, `${s}/`];
                const data = await tryGetWithLog(urls, 'PROVINCES');
                arr = pickArray(data);
            }

            const mapped = (arr || [])
                .map((x) => ({
                    id:
                        x?.id ??
                        x?.code ??
                        x?.province_id ??
                        x?.provinceId ??
                        x?.province_code ??
                        x?.ProvinceID ??
                        x?.ma_tinh ??
                        x?.value,
                    name:
                        x?.name ??
                        x?.province_name ??
                        x?.provinceName ??
                        x?.title ??
                        x?.ten_tinh ??
                        x?.label ??
                        String(x?.id ?? x?.code ?? ''),
                }))
                .filter((x) => x.id != null && String(x.name).trim() !== '');

            setProvinces(mapped);

            if (!mapped.length) {
                const local = (getProvinces() || []).map((x) => ({
                    id: x?.code ?? x?.id,
                    name: x?.name ?? x?.title ?? String(x?.code ?? x?.id ?? ''),
                }));
                if (local.length) {
                    setProvinces(local);
                } else {
                    setLocError('Không tải được danh sách Tỉnh/Thành (API trả về rỗng).');
                }
            }
        } catch {
            const local = (getProvinces() || []).map((x) => ({
                id: x?.code ?? x?.id,
                name: x?.name ?? x?.title ?? String(x?.code ?? x?.id ?? ''),
            }));
            if (local.length) {
                setProvinces(local);
            } else {
                setProvinces([]);
                setLocError('Không gọi được API Tỉnh/Thành. Xem log: [PROVINCES] FAIL');
            }
        } finally {
            setLocLoading(false);
        }
    };

    const fetchDistricts = async (provinceObj) => {
        const pid = provinceObj?.id ?? provinceObj?.code;
        if (!pid) return;

        setLocLoading(true);
        setLocError('');
        try {
            let data = null;
            const base = ENDPOINTS?.LOCATIONS_DISTRICTS || ENDPOINTS?.DISTRICTS;
            if (base) {
                const s = String(base).replace(/\/+$/, '');
                const bases = [s, `${s}/`];
                const params = [
                    `province_id=${encodeURIComponent(pid)}`,
                    `provinceId=${encodeURIComponent(pid)}`,
                    `province_code=${encodeURIComponent(pid)}`,
                    `province=${encodeURIComponent(pid)}`,
                ];

                for (const b of bases) {
                    for (const p of params) {
                        try {
                            data = await tryGetWithLog([`${b}?${p}`], 'DISTRICTS');
                            break;
                        } catch { }
                    }
                    if (data) break;
                }
            }

            const arr = pickArray(data);
            const mapped = arr
                .map((x) => ({
                    id:
                        x?.id ??
                        x?.code ??
                        x?.district_id ??
                        x?.districtId ??
                        x?.district_code ??
                        x?.DistrictID ??
                        x?.ma_huyen ??
                        x?.value,
                    name:
                        x?.name ??
                        x?.district_name ??
                        x?.districtName ??
                        x?.title ??
                        x?.ten_huyen ??
                        x?.label ??
                        String(x?.id ?? x?.code ?? ''),
                }))
                .filter((x) => x.id != null && String(x.name).trim() !== '');

            setDistricts(mapped);
            if (!mapped.length) {
                const local = (getDistrictsByProvinceCode(pid) || []).map((x) => ({
                    id: x?.code ?? x?.id,
                    name: x?.name ?? x?.title ?? String(x?.code ?? x?.id ?? ''),
                }));
                if (local.length) {
                    setDistricts(local);
                } else {
                    setLocError('Không tải được danh sách Quận/Huyện (API trả về rỗng).');
                }
            }
        } catch {
            const local = (getDistrictsByProvinceCode(pid) || []).map((x) => ({
                id: x?.code ?? x?.id,
                name: x?.name ?? x?.title ?? String(x?.code ?? x?.id ?? ''),
            }));
            if (local.length) {
                setDistricts(local);
            } else {
                setDistricts([]);
                setLocError('Không gọi được API Quận/Huyện. Xem log: [DISTRICTS] FAIL');
            }
        } finally {
            setLocLoading(false);
        }
    };

    const fetchWards = async (districtObj) => {
        const did = districtObj?.id ?? districtObj?.code;
        if (!did) return;

        setLocLoading(true);
        setLocError('');
        try {
            let data = null;
            const base = ENDPOINTS?.LOCATIONS_WARDS || ENDPOINTS?.WARDS;
            if (base) {
                const s = String(base).replace(/\/+$/, '');
                const bases = [s, `${s}/`];

                const params = [
                    `district_id=${encodeURIComponent(did)}`,
                    `districtId=${encodeURIComponent(did)}`,
                    `district_code=${encodeURIComponent(did)}`,
                    `district=${encodeURIComponent(did)}`,
                ];

                for (const b of bases) {
                    for (const p of params) {
                        try {
                            data = await tryGetWithLog([`${b}?${p}`], 'WARDS');
                            break;
                        } catch { }
                    }
                    if (data) break;
                }
            }

            const arr = pickArray(data);
            const mapped = arr
                .map((x) => ({
                    id:
                        x?.id ??
                        x?.code ??
                        x?.ward_id ??
                        x?.wardId ??
                        x?.ward_code ??
                        x?.WardID ??
                        x?.ma_xa ??
                        x?.value,
                    name:
                        x?.name ??
                        x?.ward_name ??
                        x?.wardName ??
                        x?.title ??
                        x?.ten_xa ??
                        x?.label ??
                        String(x?.id ?? x?.code ?? ''),
                }))
                .filter((x) => x.id != null && String(x.name).trim() !== '');

            setWards(mapped);
            if (!mapped.length) {
                const local = (getWardsByDistrictCode(did) || []).map((x) => ({
                    id: x?.code ?? x?.id,
                    name: x?.name ?? x?.title ?? String(x?.code ?? x?.id ?? ''),
                }));
                if (local.length) {
                    setWards(local);
                } else {
                    setLocError('Không tải được danh sách Phường/Xã (API trả về rỗng).');
                }
            }
        } catch {
            const local = (getWardsByDistrictCode(did) || []).map((x) => ({
                id: x?.code ?? x?.id,
                name: x?.name ?? x?.title ?? String(x?.code ?? x?.id ?? ''),
            }));
            if (local.length) {
                setWards(local);
            } else {
                setWards([]);
                setLocError('Không gọi được API Phường/Xã. Xem log: [WARDS] FAIL');
            }
        } finally {
            setLocLoading(false);
        }
    };

    const openLocationModal = async () => {
        setLocSearch('');
        setLocError('');
        setLocOpen(true);
        if (!provinces?.length) await fetchProvinces();
        setProvinceOpen(false);
        setDistrictOpen(false);
        setWardOpen(false);
    };

    const clearLocation = () => {
        setProvince(null);
        setDistrict(null);
        setWard(null);
        setDistricts([]);
        setWards([]);
        setLocSearch('');
        setLocError('');
        setProvinceOpen(false);
        setDistrictOpen(false);
        setWardOpen(false);
    };

    const locationLabel = useMemo(() => {
        const parts = [ward?.name, district?.name, province?.name].filter(Boolean);
        return parts.length ? parts.join(', ') : 'Khu vực';
    }, [province, district, ward]);

    const locationQuery = useMemo(() => {
        return normalizeText([ward?.name, district?.name, province?.name].filter(Boolean).join(' '));
    }, [province, district, ward]);

    useEffect(() => {
        if (locationQuery) {
            // preload address để filter hoạt động
            hydrateAddressesForPosts(posts);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locationQuery, posts.length]);

    const locFilteredList = (arr) => {
        const s = normalizeText(locSearch);
        if (!s) return arr;
        return (arr || []).filter((x) => normalizeText(x?.name).includes(s));
    };

    /* ================= FETCH POSTS ================= */

    const fetchPosts = async () => {
        try {
            setLoading(true);

            const url = (ENDPOINTS?.POSTS || '/api/listings/posts').replace(/\/+$/, '');
            const res = await apiClient.get(url);

            const data = Array.isArray(res.data) ? res.data : res.data?.results || [];
            const approvedOnly = data.filter((p) => isApproved(p) && !isHidden(p));

            setPosts(approvedOnly);

            // reset address cache + lazy load
            setAddressMap({});
            fetchingAddressRef.current = new Set();
            setVisibleCount(PAGE_SIZE);

            await loadFavorites();
        } catch (e) {
            console.log('HOME fetchPosts error:', e?.response?.status, e?.response?.data || e.message);
            Alert.alert('Lỗi', 'Không tải được danh sách bài đăng.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isFocused) {
            fetchPosts();
            fetchCategories();
        }
    }, [isFocused]);

    const onRefresh = async () => {
        try {
            setRefreshing(true);
            await fetchPosts();
            await fetchCategories();
        } finally {
            setRefreshing(false);
        }
    };

    /* ================= FILTER + SEARCH ================= */

    const filteredPosts = useMemo(() => {
        let list = posts;

        if (txFilter !== TX_TYPES.ALL) {
            list = list.filter((p) => Number(getTxTypeId(p)) === Number(txFilter));
        }

        const query = normalizeText(q);
        const lq = locationQuery;

        if (!query && !lq) return list;

        return list.filter((p) => {
            const title = normalizeText(p?.title);
            const addr = getPostLocationText(p);
            const okText = !query ? true : title.includes(query) || addr.includes(query);
            const okLoc = !lq ? true : addr.includes(lq);
            return okText && okLoc;
        });
    }, [posts, txFilter, q, addressMap, locationQuery]);

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [txFilter, q, locationQuery, posts.length]);

    const visiblePosts = useMemo(() => filteredPosts.slice(0, visibleCount), [filteredPosts, visibleCount]);
    const canLoadMore = visibleCount < filteredPosts.length;

    const onEndReached = () => {
        if (loadingMore) return;
        if (!canLoadMore) return;

        setLoadingMore(true);
        setTimeout(() => {
            setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredPosts.length));
            setLoadingMore(false);
        }, 200);
    };

    const renderFooter = () => {
        if (loadingMore) {
            return (
                <View style={{ paddingVertical: 14 }}>
                    <ActivityIndicator />
                    <Text style={{ textAlign: 'center', color: '#666', marginTop: 6 }}>Đang tải thêm...</Text>
                </View>
            );
        }
        if (canLoadMore) {
            return (
                <View style={{ paddingVertical: 10 }}>
                    <Text style={{ textAlign: 'center', color: '#999' }}>Cuộn xuống để xem thêm</Text>
                </View>
            );
        }
        return <View style={{ height: 10 }} />;
    };

    /* ================= VIEWABLE => FETCH ADDRESS ================= */

    const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
    const onViewableItemsChanged = useRef(({ viewableItems }) => {
        viewableItems.forEach((v) => {
            const id = v?.item?.id;
            if (id) fetchPostDetailAddress(id);
        });
    }).current;

    /* ================= NOTIFICATIONS ================= */

    const onPressBell = () => {
        try {
            navigation.navigate('Notifications');
        } catch {
            Alert.alert('Thông báo', 'Màn hình Notifications chưa được khai báo (để tích hợp realtime sau).');
        }
    };

    /* ================= AI CHAT ================= */

    const scrollChatToEnd = () => {
        setTimeout(() => chatListRef.current?.scrollToEnd?.({ animated: true }), 120);
    };

    useEffect(() => {
        if (aiOpen) scrollChatToEnd();
    }, [aiOpen, aiMessages.length]);

    const sendToAI = async () => {
        const text = aiInput.trim();
        if (!text) return;

        const userMsg = { id: `u_${Date.now()}`, role: 'user', text, createdAt: Date.now() };
        setAiMessages((prev) => [...prev, userMsg]);
        setAiInput('');
        setAiTyping(true);
        scrollChatToEnd();

        try {
            const res = await apiClient.post(ENDPOINTS.CHATBOT, { message: text, session_id: sessionId });
            const newSessionId = res.data?.session_id ?? sessionId;
            if (newSessionId) setSessionId(newSessionId);

            const answer = res.data?.answer ?? 'Mình đã xử lý yêu cầu của bạn.';
            setAiMessages((prev) => [...prev, { id: `a_${Date.now()}`, role: 'assistant', text: answer, createdAt: Date.now() }]);
        } catch (e) {
            console.log('AI error:', e?.response?.status, e?.response?.data || e.message);
            setAiMessages((prev) => [
                ...prev,
                { id: `a_err_${Date.now()}`, role: 'assistant', text: 'Không gọi được AI. Kiểm tra /api/chatbot/.', createdAt: Date.now() },
            ]);
        } finally {
            setAiTyping(false);
            scrollChatToEnd();
        }
    };

    /* ================= UI ================= */

    const renderPost = ({ item }) => {
        const txId = getTxTypeId(item);
        const priceVal = item?.priceValue ?? item?.price_value ?? item?.price ?? null;
        const isFav = Number(favMap?.[item?.id]) === 1;
        const imgUrl = getFirstImageUrl(item);

        const addrLoaded = Object.prototype.hasOwnProperty.call(addressMap, item?.id);
        const addrText = addressMap?.[item?.id] ?? '';

        const catName = categoryMap?.[String(item?.category_id)] || '—';

        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() =>
                    navigation.navigate('PostDetail', {
                        postId: item.id,
                        images: item?.images || [],
                        title: item?.title || '',
                        price: item?.price ?? null,
                        area: item?.area ?? null,
                    })
                }
            >
                {imgUrl ? <Image source={{ uri: imgUrl }} style={styles.cover} /> : null}

                <TouchableOpacity style={styles.heartBtn} onPress={() => toggleFavorite(item?.id)} activeOpacity={0.8}>
                    <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? '#E53935' : '#111'} />
                </TouchableOpacity>

                <View style={styles.rowBetween}>
                    <Text style={styles.badge}>{txLabel(txId)}</Text>
                    <Text style={styles.price}>{formatPrice(priceVal)} đ</Text>
                </View>

                <Text style={styles.title} numberOfLines={2}>
                    {item?.title || 'Bài đăng'}
                </Text>

                <Text style={styles.sub} numberOfLines={2}>
                    {!addrLoaded ? 'Đang tải địa chỉ...' : addrText?.trim() ? addrText : 'Chưa có địa chỉ'}
                </Text>

                <View style={styles.metaRow}>
                    <Text style={styles.metaText}>DT: {item?.area ?? '—'} m²</Text>
                    <Text style={styles.metaText}>Loại: {catName}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                {/* TOP ROW: Title + Bell */}
                <View style={styles.headerTop}>
                    <Text style={styles.h1}>Trang chủ</Text>

                    <TouchableOpacity style={styles.bellBtn} onPress={onPressBell} activeOpacity={0.85}>
                        <Ionicons name="notifications-outline" size={22} color="#111" />
                        {unreadCount > 0 ? (
                            <View style={styles.badgeDot}>
                                <Text style={styles.badgeDotText}>{unreadCount > 99 ? '99+' : String(unreadCount)}</Text>
                            </View>
                        ) : null}
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={styles.searchRow}>
                    <Ionicons name="search" size={18} color="#666" />
                    <TextInput value={q} onChangeText={setQ} placeholder="Tìm theo tiêu đề / địa chỉ..." style={styles.searchInput} returnKeyType="search" />
                    {!!q && (
                        <TouchableOpacity onPress={() => setQ('')} style={styles.clearBtn}>
                            <Ionicons name="close" size={18} color="#666" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Location filter button */}
                <View style={styles.locRow}>
                    <TouchableOpacity style={styles.locBtn} onPress={openLocationModal} activeOpacity={0.9}>
                        <Ionicons name="location-outline" size={18} color="#111" />
                        <Text style={styles.locText} numberOfLines={1}>
                            {locationLabel}
                        </Text>
                        <Ionicons name="chevron-down" size={18} color="#111" />
                    </TouchableOpacity>

                    {(province || district || ward) ? (
                        <TouchableOpacity style={styles.locClear} onPress={clearLocation} activeOpacity={0.9}>
                            <Ionicons name="close" size={16} color="#111" />
                        </TouchableOpacity>
                    ) : null}
                </View>

                <View style={styles.filters}>
                    <FilterChip label="Tất cả" active={txFilter === TX_TYPES.ALL} onPress={() => setTxFilter(TX_TYPES.ALL)} />
                    <FilterChip label="Bán" active={txFilter === TX_TYPES.SELL} onPress={() => setTxFilter(TX_TYPES.SELL)} />
                    <FilterChip label="Cho thuê" active={txFilter === TX_TYPES.RENT} onPress={() => setTxFilter(TX_TYPES.RENT)} />
                </View>

                <Text style={styles.hint}>
                    Đang hiển thị: {filteredPosts.length} bài • Đang xem: {filteredPosts.length ? `${Math.min(visibleCount, filteredPosts.length)}/${filteredPosts.length}` : '0/0'}
                </Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator />
                    <Text style={{ marginTop: 8, color: '#666' }}>Đang tải bài đăng...</Text>
                </View>
            ) : (
                <FlatList
                    data={visiblePosts}
                    keyExtractor={(it, idx) => String(it?.id ?? idx)}
                    renderItem={renderPost}
                    contentContainerStyle={{ padding: 14, paddingBottom: 140 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    onViewableItemsChanged={onViewableItemsChanged}
                    viewabilityConfig={viewabilityConfig}
                    onEndReached={onEndReached}
                    onEndReachedThreshold={0.25}
                    ListFooterComponent={renderFooter}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Text style={{ color: '#666', textAlign: 'center' }}>Không có bài đăng phù hợp.</Text>
                        </View>
                    }
                />
            )}

            {/* AI bubble (optional) */}
            <TouchableOpacity style={styles.aiBubble} onPress={() => setAiOpen(true)} activeOpacity={0.9}>
                <Ionicons name="chatbubbles" size={22} color="#fff" />
            </TouchableOpacity>

            {/* LOCATION MODAL */}
            <Modal visible={locOpen} animationType="slide" transparent>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.locModalCard}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Chọn khu vực</Text>
                                <TouchableOpacity onPress={() => setLocOpen(false)}>
                                    <Ionicons name="close" size={24} color="#333" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.locSearchRow}>
                                <Ionicons name="search" size={16} color="#666" />
                                <TextInput value={locSearch} onChangeText={setLocSearch} placeholder="Tìm tỉnh / quận / phường..." style={styles.locSearchInput} />
                                {!!locSearch && (
                                    <TouchableOpacity onPress={() => setLocSearch('')} style={{ padding: 6 }}>
                                        <Ionicons name="close" size={16} color="#666" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={styles.locSelectedRow}>
                                <Text style={styles.locSelectedText}>Đang chọn: {locationQuery ? locationLabel : 'Chưa chọn'}</Text>
                                <TouchableOpacity onPress={clearLocation} activeOpacity={0.9} style={styles.locClearAllBtn}>
                                    <Text style={{ fontWeight: '800' }}>Xóa</Text>
                                </TouchableOpacity>
                            </View>

                            {/* ✅ ERROR + Retry */}
                            {locError ? (
                                <View style={styles.locErrorBox}>
                                    <Text style={styles.locErrorText}>{locError}</Text>
                                    <TouchableOpacity
                                        onPress={async () => {
                                            if (!province) await fetchProvinces();
                                            else if (province && !district) await fetchDistricts(province);
                                            else if (district && !ward) await fetchWards(district);
                                            else await fetchProvinces();
                                        }}
                                        style={styles.locRetryBtn}
                                        activeOpacity={0.9}
                                    >
                                        <Text style={{ color: '#fff', fontWeight: '900' }}>Thử lại</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : null}

                            {locLoading ? (
                                <View style={{ padding: 18, alignItems: 'center' }}>
                                    <ActivityIndicator />
                                    <Text style={{ marginTop: 8, color: '#666' }}>Đang tải dữ liệu...</Text>
                                </View>
                            ) : (
                                <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}>
                                    <Text style={styles.locStepTitle}>1) Tỉnh/Thành</Text>
                                    <TouchableOpacity
                                        style={styles.locFieldHeader}
                                        onPress={async () => {
                                            const next = !provinceOpen;
                                            setProvinceOpen(next);
                                            if (next && !provinces.length) await fetchProvinces();
                                        }}
                                        activeOpacity={0.9}
                                    >
                                        <Text style={styles.locFieldLabel}>{province?.name || 'Chọn Tỉnh/Thành'}</Text>
                                        <Ionicons name={provinceOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#111" />
                                    </TouchableOpacity>
                                    {provinceOpen ? (
                                        <FlatList
                                            data={locFilteredList(provinces)}
                                            keyExtractor={(x, idx) => String(x?.id ?? idx)}
                                            style={styles.locList}
                                            showsVerticalScrollIndicator
                                            renderItem={({ item }) => {
                                                const active = String(item?.id) === String(province?.id);
                                                return (
                                                    <TouchableOpacity
                                                        style={[styles.locPill, active && styles.locPillActive]}
                                                        onPress={async () => {
                                                            setProvince(item);
                                                            setDistrict(null);
                                                            setWard(null);
                                                            setDistricts([]);
                                                            setWards([]);
                                                            setLocSearch('');
                                                            setProvinceOpen(false);
                                                            setDistrictOpen(true);
                                                            setWardOpen(false);
                                                            await fetchDistricts(item);
                                                        }}
                                                        activeOpacity={0.9}
                                                    >
                                                        <Text style={[styles.locPillText, active && styles.locPillTextActive]} numberOfLines={1}>
                                                            {item?.name}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            }}
                                            ListEmptyComponent={<Text style={{ color: '#999' }}>Không có dữ liệu Tỉnh/Thành</Text>}
                                        />
                                    ) : null}

                                    <Text style={styles.locStepTitle}>2) Quận/Huyện</Text>
                                    <TouchableOpacity
                                        style={[styles.locFieldHeader, !province && styles.locFieldHeaderDisabled]}
                                        onPress={async () => {
                                            if (!province) return;
                                            const next = !districtOpen;
                                            setDistrictOpen(next);
                                            if (next && !districts.length) await fetchDistricts(province);
                                        }}
                                        activeOpacity={0.9}
                                    >
                                        <Text style={styles.locFieldLabel}>{district?.name || 'Chọn Quận/Huyện'}</Text>
                                        <Ionicons name={districtOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#111" />
                                    </TouchableOpacity>
                                    {districtOpen ? (
                                        <FlatList
                                            data={locFilteredList(districts)}
                                            keyExtractor={(x, idx) => String(x?.id ?? idx)}
                                            style={styles.locList}
                                            showsVerticalScrollIndicator
                                            renderItem={({ item }) => {
                                                const active = String(item?.id) === String(district?.id);
                                                return (
                                                    <TouchableOpacity
                                                        style={[styles.locPill, active && styles.locPillActive]}
                                                        onPress={async () => {
                                                            setDistrict(item);
                                                            setWard(null);
                                                            setWards([]);
                                                            setLocSearch('');
                                                            setDistrictOpen(false);
                                                            setWardOpen(true);
                                                            await fetchWards(item);
                                                        }}
                                                        activeOpacity={0.9}
                                                    >
                                                        <Text style={[styles.locPillText, active && styles.locPillTextActive]} numberOfLines={1}>
                                                            {item?.name}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            }}
                                            ListEmptyComponent={<Text style={{ color: '#999' }}>Không có dữ liệu Quận/Huyện</Text>}
                                        />
                                    ) : null}

                                    <Text style={styles.locStepTitle}>3) Phường/Xã</Text>
                                    <TouchableOpacity
                                        style={[styles.locFieldHeader, !district && styles.locFieldHeaderDisabled]}
                                        onPress={async () => {
                                            if (!district) return;
                                            const next = !wardOpen;
                                            setWardOpen(next);
                                            if (next && !wards.length) await fetchWards(district);
                                        }}
                                        activeOpacity={0.9}
                                    >
                                        <Text style={styles.locFieldLabel}>{ward?.name || 'Chọn Phường/Xã'}</Text>
                                        <Ionicons name={wardOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#111" />
                                    </TouchableOpacity>
                                    {wardOpen ? (
                                        <FlatList
                                            data={locFilteredList(wards)}
                                            keyExtractor={(x, idx) => String(x?.id ?? idx)}
                                            style={styles.locList}
                                            showsVerticalScrollIndicator
                                            renderItem={({ item }) => {
                                                const active = String(item?.id) === String(ward?.id);
                                                return (
                                                    <TouchableOpacity
                                                        style={[styles.locPill, active && styles.locPillActive]}
                                                        onPress={() => {
                                                            setWard(item);
                                                            setLocSearch('');
                                                            setWardOpen(false);
                                                        }}
                                                        activeOpacity={0.9}
                                                    >
                                                        <Text style={[styles.locPillText, active && styles.locPillTextActive]} numberOfLines={1}>
                                                            {item?.name}
                                                        </Text>
                                                    </TouchableOpacity>
                                                );
                                            }}
                                            ListEmptyComponent={<Text style={{ color: '#999' }}>Không có dữ liệu Phường/Xã</Text>}
                                        />
                                    ) : null}
                                </View>
                            )}

                            <View style={styles.locModalBottom}>
                                <TouchableOpacity style={styles.locApplyBtn} onPress={() => setLocOpen(false)} activeOpacity={0.9}>
                                    <Text style={{ color: '#fff', fontWeight: '900' }}>Xong</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* AI Chat Modal (optional) */}
            <Modal visible={aiOpen} animationType="slide" transparent>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <View style={styles.modalOverlay}>
                        <KeyboardAvoidingView
                            style={styles.modalCard}
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
                        >
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>AI Chat</Text>
                                <TouchableOpacity onPress={() => setAiOpen(false)}>
                                    <Ionicons name="close" size={24} color="#333" />
                                </TouchableOpacity>
                            </View>

                            <FlatList
                                ref={chatListRef}
                                data={aiMessages}
                                keyExtractor={(m) => m.id}
                                contentContainerStyle={{ padding: 12, paddingBottom: 10 }}
                                renderItem={({ item }) => <ChatBubble role={item.role} text={item.text} />}
                                onContentSizeChange={scrollChatToEnd}
                            />

                            {aiTyping ? (
                                <View style={{ paddingHorizontal: 12, paddingBottom: 6 }}>
                                    <Text style={{ color: '#666' }}>AI đang trả lời...</Text>
                                </View>
                            ) : null}

                            <View style={styles.chatInputRow}>
                                <TextInput value={aiInput} onChangeText={setAiInput} placeholder='Nhập câu hỏi... "'
                                    style={styles.chatInput} multiline />
                                <TouchableOpacity style={styles.sendBtn} onPress={sendToAI} disabled={aiTyping}>
                                    <Ionicons name="send" size={18} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </SafeAreaView>
    );
}

/* ---------- Components ---------- */

function FilterChip({ label, active, onPress }) {
    return (
        <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]} activeOpacity={0.9}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
        </TouchableOpacity>
    );
}

function ChatBubble({ role, text }) {
    const isUser = role === 'user';
    return (
        <View style={[styles.msgRow, isUser ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
            <View style={[styles.msgBubble, isUser ? styles.msgUser : styles.msgBot]}>
                <Text style={{ color: isUser ? '#fff' : '#111' }}>{text}</Text>
            </View>
        </View>
    );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#fff' },

    header: {
        paddingHorizontal: 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
    },

    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    h1: { fontSize: 22, fontWeight: '800', color: '#111' },

    bellBtn: {
        width: 40, height: 40, borderRadius: 12,
        borderWidth: 1, borderColor: '#eee', backgroundColor: '#fff',
        justifyContent: 'center', alignItems: 'center',
    },
    badgeDot: {
        position: 'absolute', top: 4, right: 4,
        minWidth: 18, height: 18, paddingHorizontal: 4,
        borderRadius: 9, backgroundColor: '#E53935',
        justifyContent: 'center', alignItems: 'center',
    },
    badgeDotText: { color: '#fff', fontSize: 10, fontWeight: '900' },

    searchRow: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: '#e6e6e6',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: '#fafafa',
    },
    searchInput: { flex: 1, paddingVertical: 2 },
    clearBtn: { padding: 4 },

    locRow: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
    locBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
        borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 12,
        paddingHorizontal: 10, paddingVertical: 10, backgroundColor: '#fff',
    },
    locText: { flex: 1, fontWeight: '800', color: '#111' },
    locClear: {
        width: 40, height: 40, borderRadius: 12,
        borderWidth: 1, borderColor: '#eee',
        justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff',
    },

    filters: { flexDirection: 'row', marginTop: 10, gap: 8 },
    hint: { marginTop: 8, color: '#666', fontSize: 12 },

    chip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#ddd',
        backgroundColor: '#fff',
    },
    chipActive: { backgroundColor: '#111', borderColor: '#111' },
    chipText: { color: '#111', fontWeight: '700' },
    chipTextActive: { color: '#fff' },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    card: {
        position: 'relative',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
        overflow: 'hidden',
    },
    cover: {
        width: '100%',
        height: 170,
        borderRadius: 12,
        marginBottom: 10,
        backgroundColor: '#f3f3f3',
    },
    heartBtn: {
        position: 'absolute',
        right: 12,
        top: 12,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        elevation: 3,
    },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    badge: {
        paddingHorizontal: 10, paddingVertical: 5,
        borderRadius: 999, borderWidth: 1, borderColor: '#ddd',
        color: '#111', fontWeight: '800',
    },
    price: { fontSize: 16, fontWeight: '900', color: '#111' },
    title: { marginTop: 10, fontSize: 16, fontWeight: '800', color: '#111' },
    sub: { marginTop: 6, color: '#666' },
    metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    metaText: { color: '#666', fontSize: 12 },

    aiBubble: {
        position: 'absolute',
        right: 16,
        bottom: 22,
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: '#111',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
    },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '85%', overflow: 'hidden' },
    modalHeader: {
        paddingHorizontal: 14, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#eee',
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    modalTitle: { fontSize: 16, fontWeight: '900', color: '#111' },

    chatInputRow: {
        padding: 10, borderTopWidth: 1, borderTopColor: '#eee',
        flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    },
    chatInput: {
        flex: 1, minHeight: 42, maxHeight: 110,
        borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
        paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff',
    },
    sendBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },

    msgRow: { flexDirection: 'row', marginBottom: 10 },
    msgBubble: { maxWidth: '82%', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14 },
    msgUser: { backgroundColor: '#111' },
    msgBot: { backgroundColor: '#f2f3f5' },

    // Location Modal
    locModalCard: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, maxHeight: '88%', overflow: 'hidden' },
    locSearchRow: {
        margin: 12, marginTop: 10,
        flexDirection: 'row', alignItems: 'center', gap: 8,
        borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 12,
        paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#fafafa',
    },
    locSearchInput: { flex: 1, paddingVertical: 2 },

    locSelectedRow: {
        marginHorizontal: 12, marginBottom: 8,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    locSelectedText: { color: '#111', fontWeight: '800' },
    locClearAllBtn: {
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 12, borderWidth: 1, borderColor: '#eee', backgroundColor: '#fff',
    },

    locErrorBox: {
        marginHorizontal: 12,
        marginTop: 6,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#f2b8b5',
        backgroundColor: '#fff5f5',
    },
    locErrorText: { color: '#b42318', fontWeight: '800' },
    locRetryBtn: {
        marginTop: 8,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#111',
        alignItems: 'center',
    },

    locStepTitle: { marginTop: 10, marginBottom: 6, fontWeight: '900', color: '#111' },
    locPill: {
        paddingHorizontal: 12, paddingVertical: 9,
        borderRadius: 999, borderWidth: 1, borderColor: '#ddd',
        backgroundColor: '#fff', marginRight: 8,
    },
    locPillActive: { backgroundColor: '#111', borderColor: '#111' },
    locPillText: { color: '#111', fontWeight: '800', maxWidth: 220 },
    locPillTextActive: { color: '#fff' },

    locList: {
        maxHeight: 180,
        paddingBottom: 4,
    },
    locFieldHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e6e6e6',
        backgroundColor: '#fff',
        marginBottom: 8,
    },
    locFieldHeaderDisabled: {
        opacity: 0.5,
    },
    locFieldLabel: { fontWeight: '800', color: '#111' },

    locModalBottom: { padding: 12, borderTopWidth: 1, borderTopColor: '#eee' },
    locApplyBtn: { height: 46, borderRadius: 14, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
});
