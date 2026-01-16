// src/screens/Home/HomeScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { AuthContext } from '../../context/AuthContext';
import {
    getDistrictsByProvinceCode,
    getProvinces,
    getWardsByDistrictCode,
} from '../../utils/locations';

const kingIcon = require('../../../assets/images/king.png');

const TX_TYPES = {
    ALL: 'ALL',
    SELL: 1,
    RENT: 2,
};

const APPROVED_IDS = new Set([2]); // DB: 2 = Approved
const PAGE_SIZE = 5;
const CHAT_LINK_REGEX = /(https?:\/\/[^\s]+)/gi;

const extractPostIdFromUrl = (url) => {
    if (!url) return null;
    const tinMatch = url.match(/\/tin\/([^/?#\s]+)/i);
    if (tinMatch?.[1]) return tinMatch[1];
    const postMatch = url.match(/\/posts\/(\d+)/i);
    if (postMatch?.[1]) return postMatch[1];
    const queryMatch = url.match(/[?&](post_id|postId|id)=([^&#\s]+)/i);
    if (queryMatch?.[2]) return decodeURIComponent(queryMatch[2]);
    return null;
};

const parseChatParts = (text) => {
    const str = String(text ?? '');
    const parts = [];
    let lastIndex = 0;
    let match;
    CHAT_LINK_REGEX.lastIndex = 0;

    while ((match = CHAT_LINK_REGEX.exec(str)) !== null) {
        const url = match[0];
        if (match.index > lastIndex) {
            parts.push({ type: 'text', value: str.slice(lastIndex, match.index) });
        }
        parts.push({ type: 'link', value: url, postId: extractPostIdFromUrl(url) });
        lastIndex = match.index + url.length;
    }

    if (lastIndex < str.length) {
        parts.push({ type: 'text', value: str.slice(lastIndex) });
    }

    return parts;
};

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
    const [categories, setCategories] = useState([]);
    const [categoryFilter, setCategoryFilter] = useState('ALL');

    // ✅ FAVORITES
    const [favMap, setFavMap] = useState({}); // { postId: 1/0 }

    // ✅ ADDRESS CACHE (lấy từ API detail)
    const [addressMap, setAddressMap] = useState({}); // { postId: "địa chỉ" }
    const fetchingAddressRef = useRef(new Set()); // chống gọi trùng
    const vipKeyLoggedRef = useRef(false);

    // SEARCH (tiêu đề/địa chỉ)
    const [q, setQ] = useState('');
    const [priceMin, setPriceMin] = useState('');
    const [priceMax, setPriceMax] = useState('');

    // ✅ LOCATION FILTER (Tỉnh/Quận/Phường)
    const [locOpen, setLocOpen] = useState(false);
    const [locLoading, setLocLoading] = useState(false);
    const [locSearch, setLocSearch] = useState('');
    const [locError, setLocError] = useState('');
    const [catOpen, setCatOpen] = useState(false);
    const [catSearch, setCatSearch] = useState('');
    const [txOpen, setTxOpen] = useState(false);
    const [txSearch, setTxSearch] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);

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
    const { userToken } = useContext(AuthContext);

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

    const parsePriceInput = (value) => {
        const raw = String(value ?? '').trim();
        if (!raw) return null;
        const num = Number(raw.replace(/[^\d]/g, ''));
        return Number.isFinite(num) ? num : null;
    };

    const formatNumberInput = (value) => {
        const digits = String(value ?? '').replace(/[^\d]/g, '');
        if (!digits) return '';
        return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    };

    const parsePriceValue = (value) => {
        if (value == null || value === '') return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;

        const s = String(value).trim().toLowerCase();
        if (!s) return null;

        const digits = Number(s.replace(/[^\d]/g, ''));
        if (!Number.isFinite(digits)) return null;

        if (s.includes('ty') || s.includes('tỷ')) return digits * 1e9;
        if (s.includes('trieu') || s.includes('triệu')) return digits * 1e6;
        if (s.includes('ngan') || s.includes('ngàn') || s.includes('nghin') || s.includes('nghìn')) return digits * 1e3;
        return digits;
    };

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

    const getCategoryId = (p) => {
        const candidates = [
            p?.category_id,
            p?.categoryId,
            p?.category_code,
            p?.category?.id,
            p?.category?.category_id,
            p?.category,
        ];
        for (const v of candidates) {
            if (v !== null && v !== undefined && v !== '') return String(v);
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
            const list = (arr || [])
                .map((c) => {
                    const id = c?.id ?? c?.category_id ?? c?.code;
                    const name = c?.name ?? c?.category_name ?? c?.title;
                    if (id != null) map[String(id)] = name ? String(name) : String(id);
                    return id != null ? { id: String(id), name: name ? String(name) : String(id) } : null;
                })
                .filter(Boolean)
                .sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }));
            setCategoryMap(map);
            setCategories(list);
        } catch {
            setCategoryMap({});
            setCategories([]);
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

    const txOptions = useMemo(
        () => [
            { id: TX_TYPES.ALL, name: 'Tất cả' },
            { id: TX_TYPES.SELL, name: 'Bán' },
            { id: TX_TYPES.RENT, name: 'Cho thuê' },
        ],
        []
    );

    const txLabelSelected = useMemo(() => {
        const found = txOptions.find((x) => String(x.id) === String(txFilter));
        return found?.name || 'Hình thức';
    }, [txOptions, txFilter]);

    const openTxModal = () => {
        setTxSearch('');
        setTxOpen(true);
    };

    const clearTxFilter = () => {
        setTxFilter(TX_TYPES.ALL);
        setTxSearch('');
    };

    const txFilteredList = useMemo(() => {
        const s = normalizeText(txSearch);
        if (!s) return txOptions;
        return txOptions.filter((x) => normalizeText(x?.name).includes(s));
    }, [txOptions, txSearch]);

    const categoryLabel = useMemo(() => {
        if (categoryFilter === 'ALL') return 'Loại BĐS';
        const found = categories.find((c) => String(c.id) === String(categoryFilter));
        return found?.name || 'Loại BĐS';
    }, [categories, categoryFilter]);

    const openCategoryModal = async () => {
        setCatSearch('');
        setCatOpen(true);
        if (!categories.length) await fetchCategories();
    };

    const clearCategory = () => {
        setCategoryFilter('ALL');
        setCatSearch('');
    };

    const catFilteredList = useMemo(() => {
        const s = normalizeText(catSearch);
        if (!s) return categories;
        return (categories || []).filter((x) => normalizeText(x?.name).includes(s));
    }, [categories, catSearch]);

    /* ================= FETCH POSTS ================= */

    const getPayloadTotal = (payload) => {
        const candidates = [
            payload?.count,
            payload?.total,
            payload?.total_items,
            payload?.totalItems,
            payload?.total_results,
            payload?.totalResults,
        ];
        for (const v of candidates) {
            const n = Number(v);
            if (Number.isFinite(n)) return n;
        }
        return null;
    };

    const buildPostSearchParams = (page, pageSize) => {
        const params = { page, page_size: pageSize };
        const query = q?.trim();
        if (query) params.q = query;
        if (categoryFilter !== 'ALL') params.category_id = categoryFilter;
        if (txFilter !== TX_TYPES.ALL) params.post_type_id = txFilter;
        const minPrice = parsePriceInput(priceMin);
        const maxPrice = parsePriceInput(priceMax);
        if (minPrice != null) params.price_min = minPrice;
        if (maxPrice != null) params.price_max = maxPrice;
        if (province?.name) params.province = province.name;
        if (district?.name) params.district = district.name;
        if (ward?.name) params.ward = ward.name;
        return params;
    };

    const fetchPosts = async () => {
        try {
            setLoading(true);

            const baseUrl = (ENDPOINTS?.POSTS || '/api/listings/posts').replace(/\/+$/, '');
            const pageSize = 100;
            let url = baseUrl;
            let page = 1;
            let params = buildPostSearchParams(page, pageSize);
            let allPosts = [];
            const seen = new Set();
            let guard = 0;

            while (url && !seen.has(url) && guard < 20) {
                seen.add(url);
                const res = await apiClient.get(url, params ? { params } : undefined);
                const payload = res?.data;
                const items = pickArray(payload);

                if (Array.isArray(payload)) {
                    allPosts = items;
                    url = null;
                    break;
                }

                allPosts = allPosts.concat(items);
                if (payload?.next) {
                    url = payload.next;
                    params = null;
                } else {
                    const total = getPayloadTotal(payload);
                    if (Number.isFinite(total) && allPosts.length < total && items.length) {
                        page += 1;
                        url = baseUrl;
                        params = buildPostSearchParams(page, pageSize);
                    } else {
                        url = null;
                    }
                }
                guard += 1;
            }

            const approvedOnly = allPosts.filter((p) => isApproved(p) && !isHidden(p));

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

    const loadUnreadCount = async () => {
        if (!userToken) {
            setUnreadCount(0);
            return;
        }
        try {
            const res = await apiClient.get(ENDPOINTS.NOTIFICATIONS_UNREAD);
            const count = res?.data?.unread ?? 0;
            setUnreadCount(Number(count) || 0);
        } catch {
            setUnreadCount(0);
        }
    };

    useEffect(() => {
        if (isFocused) {
            fetchCategories();
            loadUnreadCount();
        }
    }, [isFocused, userToken]);

    useEffect(() => {
        if (!isFocused) return;
        const timer = setTimeout(() => {
            fetchPosts();
        }, 400);
        return () => clearTimeout(timer);
    }, [isFocused, q, categoryFilter, txFilter, priceMin, priceMax, province, district, ward]);

    useEffect(() => {
        if (categoryFilter === 'ALL') return;
        const exists = categories.some((c) => String(c.id) === String(categoryFilter));
        if (!exists) setCategoryFilter('ALL');
    }, [categories, categoryFilter]);

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

    const filteredPosts = useMemo(() => posts, [posts]);

    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [txFilter, categoryFilter, q, locationQuery, priceMin, priceMax, posts.length]);

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

    const openChatPost = (postId) => {
        if (!postId) return;
        setAiOpen(false);
        navigation.navigate('PostDetail', { postId, id: postId });
    };

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
        if (!vipKeyLoggedRef.current && item && typeof item === 'object') {
            vipKeyLoggedRef.current = true;
            console.log('[HomeScreen] post keys:', Object.keys(item));
        }
        const txId = getTxTypeId(item);
        const priceVal = item?.priceValue ?? item?.price_value ?? item?.price ?? null;
        const isFav = Number(favMap?.[item?.id]) === 1;
        const imgUrl = getFirstImageUrl(item);
        const isVip = Boolean(item?.owner_is_agent);

        const addrLoaded = Object.prototype.hasOwnProperty.call(addressMap, item?.id);
        const addrText = addressMap?.[item?.id] ?? '';

        const catName = categoryMap?.[String(getCategoryId(item))] || '—';

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
                {isVip ? (
                    <View style={styles.vipBadge}>
                        <Image source={kingIcon} style={styles.vipCrown} resizeMode="contain" />
                    </View>
                ) : null}
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
            <View style={[styles.header, { paddingTop: Math.max(insets.top - 30, 0) }]}>
                {/* TOP ROW: Title + Bell */}
                <View style={styles.headerTop}>
                    <Text style={styles.h1}>Trang chủ</Text>

                    <TouchableOpacity style={styles.bellBtn} onPress={onPressBell} activeOpacity={0.85}>
                        <Ionicons name="notifications-outline" size={22} color="#111" />
                        {unreadCount > 0 ? (
                            <View style={styles.badgeDot} />
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

                <View style={styles.filterToggleRow}>
                    <TouchableOpacity style={styles.filterToggleBtn} onPress={() => setFilterOpen(true)} activeOpacity={0.9}>
                        <Ionicons name="options-outline" size={18} color="#111" />
                        <Text style={styles.filterToggleText}>Bộ lọc</Text>
                    </TouchableOpacity>
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

            {/* FILTER MODAL */}
            <Modal visible={filterOpen} animationType="slide" transparent>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.locModalCard}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Bộ lọc</Text>
                                <TouchableOpacity onPress={() => setFilterOpen(false)}>
                                    <Ionicons name="close" size={24} color="#333" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.modalSection}>
                                <Text style={styles.modalSectionTitle}>Khoảng giá</Text>
                                <View style={styles.priceRow}>
                                    <Ionicons name="cash-outline" size={18} color="#666" />
                                    <TextInput
                                        value={priceMin}
                                        onChangeText={(text) => setPriceMin(formatNumberInput(text))}
                                        placeholder="Giá từ (VND)"
                                        keyboardType="numeric"
                                        style={styles.priceInput}
                                        returnKeyType="next"
                                    />
                                    <Text style={styles.priceDash}>-</Text>
                                    <TextInput
                                        value={priceMax}
                                        onChangeText={(text) => setPriceMax(formatNumberInput(text))}
                                        placeholder="Giá đến (VND)"
                                        keyboardType="numeric"
                                        style={styles.priceInput}
                                        returnKeyType="search"
                                    />
                                    {(priceMin || priceMax) ? (
                                        <TouchableOpacity
                                            onPress={() => {
                                                setPriceMin('');
                                                setPriceMax('');
                                            }}
                                            style={styles.clearBtn}
                                        >
                                            <Ionicons name="close" size={18} color="#666" />
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            </View>

                            <View style={styles.modalSection}>
                                <Text style={styles.modalSectionTitle}>Khu vực</Text>
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
                            </View>

                            <View style={styles.modalSection}>
                                <Text style={styles.modalSectionTitle}>Loại BĐS & Hình thức</Text>
                                <View style={styles.filterRow}>
                                    <TouchableOpacity style={[styles.locBtn, styles.filterBtn]} onPress={openCategoryModal} activeOpacity={0.9}>
                                        <Ionicons name="grid-outline" size={18} color="#111" />
                                        <Text style={styles.locText} numberOfLines={1}>
                                            {categoryLabel}
                                        </Text>
                                        <Ionicons name="chevron-down" size={18} color="#111" />
                                    </TouchableOpacity>

                                    {categoryFilter !== 'ALL' ? (
                                        <TouchableOpacity style={[styles.locClear, styles.filterClear]} onPress={clearCategory} activeOpacity={0.9}>
                                            <Ionicons name="close" size={16} color="#111" />
                                        </TouchableOpacity>
                                    ) : null}

                                    <TouchableOpacity style={[styles.locBtn, styles.filterBtn]} onPress={openTxModal} activeOpacity={0.9}>
                                        <Ionicons name="swap-horizontal-outline" size={18} color="#111" />
                                        <Text style={styles.locText} numberOfLines={1}>
                                            {txLabelSelected}
                                        </Text>
                                        <Ionicons name="chevron-down" size={18} color="#111" />
                                    </TouchableOpacity>

                                    {txFilter !== TX_TYPES.ALL ? (
                                        <TouchableOpacity style={[styles.locClear, styles.filterClear]} onPress={clearTxFilter} activeOpacity={0.9}>
                                            <Ionicons name="close" size={16} color="#111" />
                                        </TouchableOpacity>
                                    ) : null}
                                </View>
                            </View>

                            <View style={styles.locModalBottom}>
                                <TouchableOpacity style={styles.locApplyBtn} onPress={() => setFilterOpen(false)} activeOpacity={0.9}>
                                    <Text style={{ color: '#fff', fontWeight: '900' }}>Xong</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* CATEGORY MODAL */}
            <Modal visible={catOpen} animationType="slide" transparent>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.locModalCard}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Chọn loại BĐS</Text>
                                <TouchableOpacity onPress={() => setCatOpen(false)}>
                                    <Ionicons name="close" size={24} color="#333" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.locSearchRow}>
                                <Ionicons name="search" size={18} color="#666" />
                                <TextInput
                                    value={catSearch}
                                    onChangeText={setCatSearch}
                                    placeholder="Tìm loại bất động sản..."
                                    style={styles.locSearchInput}
                                />
                                {!!catSearch && (
                                    <TouchableOpacity onPress={() => setCatSearch('')}>
                                        <Ionicons name="close" size={18} color="#666" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={styles.locSelectedRow}>
                                <Text style={styles.locSelectedText}>Đang chọn: {categoryLabel}</Text>
                                {categoryFilter !== 'ALL' ? (
                                    <TouchableOpacity style={styles.locClearAllBtn} onPress={clearCategory}>
                                        <Text style={{ fontWeight: '800', color: '#111' }}>Bỏ chọn</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            <View style={{ paddingHorizontal: 12 }}>
                                <TouchableOpacity
                                    style={[
                                        styles.locPill,
                                        categoryFilter === 'ALL' && styles.locPillActive,
                                    ]}
                                    onPress={() => {
                                        setCategoryFilter('ALL');
                                        setCatOpen(false);
                                    }}
                                    activeOpacity={0.9}
                                >
                                    <Text
                                        style={[
                                            styles.locPillText,
                                            categoryFilter === 'ALL' && styles.locPillTextActive,
                                        ]}
                                        numberOfLines={1}
                                    >
                                        Tất cả loại
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <FlatList
                                data={catFilteredList}
                                keyExtractor={(x, idx) => String(x?.id ?? idx)}
                                style={{ paddingHorizontal: 12, marginTop: 10, maxHeight: 320 }}
                                showsVerticalScrollIndicator
                                renderItem={({ item }) => {
                                    const active = String(item?.id) === String(categoryFilter);
                                    return (
                                        <TouchableOpacity
                                            style={[styles.locPill, active && styles.locPillActive, { marginBottom: 10 }]}
                                            onPress={() => {
                                                setCategoryFilter(String(item?.id));
                                                setCatOpen(false);
                                            }}
                                            activeOpacity={0.9}
                                        >
                                            <Text style={[styles.locPillText, active && styles.locPillTextActive]} numberOfLines={1}>
                                                {item?.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                }}
                                ListEmptyComponent={<Text style={{ color: '#999' }}>Không có dữ liệu loại BĐS</Text>}
                            />

                            <View style={styles.locModalBottom}>
                                <TouchableOpacity style={styles.locApplyBtn} onPress={() => setCatOpen(false)} activeOpacity={0.9}>
                                    <Text style={{ color: '#fff', fontWeight: '900' }}>Xong</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* TX TYPE MODAL */}
            <Modal visible={txOpen} animationType="slide" transparent>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.locModalCard}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>Chọn hình thức</Text>
                                <TouchableOpacity onPress={() => setTxOpen(false)}>
                                    <Ionicons name="close" size={24} color="#333" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.locSearchRow}>
                                <Ionicons name="search" size={18} color="#666" />
                                <TextInput
                                    value={txSearch}
                                    onChangeText={setTxSearch}
                                    placeholder="Tìm hình thức..."
                                    style={styles.locSearchInput}
                                />
                                {!!txSearch && (
                                    <TouchableOpacity onPress={() => setTxSearch('')}>
                                        <Ionicons name="close" size={18} color="#666" />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={styles.locSelectedRow}>
                                <Text style={styles.locSelectedText}>Đang chọn: {txLabelSelected}</Text>
                                {txFilter !== TX_TYPES.ALL ? (
                                    <TouchableOpacity style={styles.locClearAllBtn} onPress={clearTxFilter}>
                                        <Text style={{ fontWeight: '800', color: '#111' }}>Bỏ chọn</Text>
                                    </TouchableOpacity>
                                ) : null}
                            </View>

                            <FlatList
                                data={txFilteredList}
                                keyExtractor={(x, idx) => String(x?.id ?? idx)}
                                style={{ paddingHorizontal: 12, marginTop: 10, maxHeight: 320 }}
                                showsVerticalScrollIndicator
                                renderItem={({ item }) => {
                                    const active = String(item?.id) === String(txFilter);
                                    return (
                                        <TouchableOpacity
                                            style={[styles.locPill, active && styles.locPillActive, { marginBottom: 10 }]}
                                            onPress={() => {
                                                setTxFilter(item?.id);
                                                setTxOpen(false);
                                            }}
                                            activeOpacity={0.9}
                                        >
                                            <Text style={[styles.locPillText, active && styles.locPillTextActive]} numberOfLines={1}>
                                                {item?.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                }}
                            />

                            <View style={styles.locModalBottom}>
                                <TouchableOpacity style={styles.locApplyBtn} onPress={() => setTxOpen(false)} activeOpacity={0.9}>
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
                                renderItem={({ item }) => <ChatBubble role={item.role} text={item.text} onOpenPost={openChatPost} />}
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

function ChatBubble({ role, text, onOpenPost }) {
    const navigation = useNavigation();
    const isUser = role === 'user';
    const parts = useMemo(() => parseChatParts(text), [text]);
    const handleOpenPost = (postId) => {
        if (!postId) return;
        if (onOpenPost) {
            onOpenPost(postId);
            return;
        }
        navigation.navigate('PostDetail', { postId, id: postId });
    };

    return (
        <View style={[styles.msgRow, isUser ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
            <View style={[styles.msgBubble, isUser ? styles.msgUser : styles.msgBot]}>
                <Text style={{ color: isUser ? '#fff' : '#111' }}>
                    {parts.map((part, idx) => {
                        if (part.type !== 'link') {
                            return (
                                <Text key={`t_${idx}`}>{part.value}</Text>
                            );
                        }

                        const label = part.postId ? 'Xem bai dang' : part.value;
                        if (!part.postId) {
                            return <Text key={`l_${idx}`}>{label}</Text>;
                        }

                        return (
                            <Text
                                key={`l_${idx}`}
                                style={[styles.msgLink, isUser && styles.msgLinkOnUser]}
                                onPress={() => handleOpenPost(part.postId)}
                            >
                                {label}
                            </Text>
                        );
                    })}
                </Text>
            </View>
        </View>
    );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#fff' },

    header: {
        paddingHorizontal: 14,
        paddingBottom: 6,
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
        position: 'absolute',
        top: 6,
        right: 6,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#E53935',
        borderWidth: 2,
        borderColor: '#fff',
    },

    searchRow: {
        marginTop: 6,
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

    priceRow: {
        marginTop: 6,
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
    priceInput: { flex: 1, paddingVertical: 2 },
    priceDash: { color: '#666', fontWeight: '800' },

    locRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
    filterRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
    filterBtn: { flex: 1, paddingVertical: 8 },
    filterClear: { width: 34, height: 34, borderRadius: 10 },
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

    filters: { flexDirection: 'row', marginTop: 6, gap: 8 },
    hint: { marginTop: 6, color: '#666', fontSize: 12 },
    filterToggleRow: { marginTop: 6, flexDirection: 'row', justifyContent: 'flex-end' },
    filterToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e6e6e6',
        backgroundColor: '#fff',
    },
    filterToggleText: { fontWeight: '800', color: '#111' },

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
        overflow: 'visible',
    },
    cover: {
        width: '100%',
        height: 170,
        borderRadius: 12,
        marginBottom: 10,
        backgroundColor: '#f3f3f3',
    },
    vipBadge: {
        position: 'absolute',
        top: -12,
        left: -14,
        width: 78,
        height: 54,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 11,
    },
    vipCrown: {
        width: 78,
        height: 54,
        transform: [{ rotate: '-45deg' }],
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
    modalSection: { paddingHorizontal: 12, paddingTop: 10 },
    modalSectionTitle: { fontWeight: '900', color: '#111', marginBottom: 6 },

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
    msgLink: { color: '#0A66C2', textDecorationLine: 'underline', fontWeight: '700' },
    msgLinkOnUser: { color: '#fff' },

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
