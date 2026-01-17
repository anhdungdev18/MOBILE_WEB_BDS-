// src/screens/Post/CreatePostScreen.js
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
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
import { getDistrictsByProvinceCode, getProvinces, getWardsByDistrictCode } from '../../utils/locations';

// ✅ options đúng theo admin backend
const CATEGORY_OPTIONS = [
    { id: 1, label: 'Căn hộ/Chung cư' },
    { id: 2, label: 'Nhà riêng' },
    { id: 3, label: 'Phòng trọ' },
    { id: 4, label: 'Đất nền' },
    { id: 5, label: 'Văn phòng' },
    { id: 6, label: 'Mặt bằng kinh doanh' },
];

const POST_TYPE_OPTIONS = [
    { id: 1, label: 'Bán' },
    { id: 2, label: 'Cho thuê' },
];

const toIntOrDefault = (v, def) => {
    const n = Number.parseInt(String(v ?? ''), 10);
    return Number.isFinite(n) ? n : def;
};

const prettyLabel = (k) => {
    const map = {
        legal: 'Pháp lý',
        floors: 'Tầng',
        bedrooms: 'Phòng ngủ',
        bathrooms: 'Phòng tắm',
        direction: 'Hướng',
        furniture: 'Nội thất',
    };
    return map[k] || k;
};

const safeStr = (v) => (v == null ? '' : String(v));
const buildAddressText = (street, wardName, districtName, provinceName) =>
    [street, wardName, districtName, provinceName].filter(Boolean).join(', ');

function Section({ title, children }) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.sectionCard}>{children}</View>
        </View>
    );
}

function KVInput({ label, value, onChangeText, placeholder, keyboardType = 'default' }) {
    return (
        <View style={styles.kvRowInput}>
            <Text style={styles.kvKey}>{label}</Text>
            <TextInput
                style={styles.kvInput}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#999"
                keyboardType={keyboardType}
            />
        </View>
    );
}

export default function CreatePostScreen({ navigation }) {
    const route = useRoute();

    // ===== MODE =====
    const initialPost = route?.params?.initialPost || null;
    const postIdParam = route?.params?.postId || route?.params?.id || null;
    const resolvedPostId = postIdParam || initialPost?.id || initialPost?.post_id || null;
    const mode = route?.params?.mode || (resolvedPostId ? 'edit' : 'create'); // 'create' | 'edit'

    const didPrefillRef = useRef(false);
    const returningFromMapRef = useRef(false);

    const [loading, setLoading] = useState(false);

    // ===== FORM =====
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [addressText, setAddressText] = useState('');
    const [streetText, setStreetText] = useState('');
    const [area, setArea] = useState('');
    const [price, setPrice] = useState('');

    const [categoryId, setCategoryId] = useState(1);
    const [postTypeId, setPostTypeId] = useState(1);

    const [location, setLocation] = useState(null); // {lat,lng}
    const [assets, setAssets] = useState([]); // [{uri,...}] (có thể chứa remote uri để hiển thị)
    const [deleteImageIds, setDeleteImageIds] = useState([]);

    const [details, setDetails] = useState({
        legal: '',
        floors: '',
        bedrooms: '',
        bathrooms: '',
        direction: '',
        furniture: '',
    });
    const [otherInfo, setOtherInfo] = useState('');

    const [provinceCode, setProvinceCode] = useState('');
    const [districtCode, setDistrictCode] = useState('');
    const [wardCode, setWardCode] = useState('');
    const [hasLocationSelection, setHasLocationSelection] = useState(false);

    // ===== inline errors =====
    const [errArea, setErrArea] = useState('');
    const [errPrice, setErrPrice] = useState('');
    const [upgradeNotice, setUpgradeNotice] = useState(null);

    const clearErrors = () => {
        setErrArea('');
        setErrPrice('');
    };

    const resetForm = useCallback(
        (opts = { clearParams: true }) => {
            setTitle('');
            setDescription('');
            setAddressText('');
            setStreetText('');
            setArea('');
            setPrice('');
            setCategoryId(1);
            setPostTypeId(1);
            setLocation(null);
            setAssets([]);
            setDeleteImageIds([]);
            setDetails({
                legal: '',
                floors: '',
                bedrooms: '',
                bathrooms: '',
                direction: '',
                furniture: '',
            });
            setOtherInfo('');
            setProvinceCode('');
            setDistrictCode('');
            setWardCode('');
            setHasLocationSelection(false);
            clearErrors();

            didPrefillRef.current = false;

            if (opts?.clearParams) {
                // dọn params để lần sau vào create không bị dính mode/edit/draft cũ
                navigation.setParams({
                    pickedLocation: undefined,
                    draft: undefined,
                    mode: undefined,
                    postId: undefined,
                    id: undefined,
                    initialPost: undefined,
                });
            }
        },
        [navigation]
    );

    // ✅ QUAN TRỌNG:
    // - Khi vào screen ở mode=create: form phải trống.
    // - Nhưng khi vừa quay lại từ PickLocation: phải giữ dữ liệu.
    const hasDraft = !!route?.params?.draft;
    const hasPickedLocation = !!route?.params?.pickedLocation;

    useFocusEffect(
        useCallback(() => {
            if (mode === 'create' && !resolvedPostId) {
                // ✅ Vừa quay lại từ màn map thì không reset form
                if (returningFromMapRef.current) {
                    returningFromMapRef.current = false;
                    return undefined;
                }
                if (!hasDraft && !hasPickedLocation) {
                    resetForm({ clearParams: false });
                }
            }
            return undefined;
        }, [mode, resolvedPostId, hasDraft, hasPickedLocation, resetForm])
    );

    // ===== Prefill khi sửa bài =====
    const prefillFromPost = useCallback((p) => {
        if (!p) return;

        setTitle(safeStr(p.title));
        setDescription(safeStr(p.description));
        setArea(p.area != null ? String(p.area) : '');
        setPrice(p.price != null ? String(p.price) : '');

        if (p.category_id != null) setCategoryId(toIntOrDefault(p.category_id, 1));
        if (p.post_type_id != null) setPostTypeId(toIntOrDefault(p.post_type_id, 1));

        // address
        if (typeof p.address === 'string') {
            setAddressText(p.address);
        } else if (p.address && typeof p.address === 'object') {
            const full = p.address.full || p.address.text || p.address.address;
            setAddressText(full ? String(full) : '');
        } else {
            setAddressText('');
        }

        // location (hỗ trợ object hoặc JSON string)
        try {
            const loc = p.location;

            if (loc && typeof loc === 'object') {
                const lat = loc.lat ?? loc.latitude;
                const lng = loc.lng ?? loc.longitude;
                if (lat != null && lng != null) setLocation({ lat: Number(lat), lng: Number(lng) });
            } else if (typeof loc === 'string' && loc.trim()) {
                const obj = JSON.parse(loc);
                const lat = obj.lat ?? obj.latitude;
                const lng = obj.lng ?? obj.longitude;
                if (lat != null && lng != null) setLocation({ lat: Number(lat), lng: Number(lng) });
            }
        } catch {
            // ignore
        }

        // details
        try {
            const d = p.details;
            if (d && typeof d === 'object') {
                setDetails((prev) => ({ ...prev, ...d }));
            } else if (typeof d === 'string' && d.trim()) {
                const obj = JSON.parse(d);
                if (obj && typeof obj === 'object') setDetails((prev) => ({ ...prev, ...obj }));
            }
        } catch {
            // ignore
        }

        // other_info
        try {
            const oi = p.other_info;
            if (typeof oi === 'string') {
                const s = oi.trim();
                if (!s) setOtherInfo('');
                else {
                    try {
                        const obj = JSON.parse(s);
                        setOtherInfo(obj?.text != null ? String(obj.text) : s);
                    } catch {
                        setOtherInfo(s);
                    }
                }
            } else if (oi && typeof oi === 'object') {
                setOtherInfo(oi?.text != null ? String(oi.text) : JSON.stringify(oi));
            } else {
                setOtherInfo('');
            }
        } catch {
            setOtherInfo('');
        }

        // images: chỉ để HIỂN THỊ (remote). Edit sẽ không upload lại ảnh.
        if (Array.isArray(p.images) && p.images.length) {
            const mapped = p.images
                .map((it) => ({
                    id: it?.id,
                    uri: it?.image_url || it?.url || it?.image,
                }))
                .filter((it) => !!it?.uri)
                .map((it) => ({ uri: String(it.uri), id: it.id, __remote: true }));
            setAssets(mapped);
        } else {
            setAssets([]);
        }
        setDeleteImageIds([]);
    }, []);

    const fetchDetailIfNeeded = useCallback(async () => {
        if (didPrefillRef.current) return;

        if (initialPost) {
            prefillFromPost(initialPost);
            didPrefillRef.current = true;
            return;
        }

        if (!resolvedPostId) return;

        try {
            setLoading(true);
            setUpgradeNotice(null);
            setUpgradeNotice(null);
            const res = await client.get(ENDPOINTS.POST_DETAIL(resolvedPostId));
            const data = res?.data?.result || res?.data;
            prefillFromPost(data);
            didPrefillRef.current = true;
        } catch (e) {
            console.log('Fetch detail for edit error:', e?.response?.status, e?.response?.data || e?.message);
            Alert.alert('Lỗi', 'Không tải được dữ liệu bài để sửa.');
        } finally {
            setLoading(false);
        }
    }, [resolvedPostId, initialPost, prefillFromPost]);

    // Khi đổi postId/mode => cho phép prefill lại
    useEffect(() => {
        didPrefillRef.current = false;
    }, [mode, resolvedPostId]);

    useFocusEffect(
        useCallback(() => {
            if (resolvedPostId) {
                fetchDetailIfNeeded();
            }
            return undefined;
        }, [resolvedPostId, fetchDetailIfNeeded])
    );

    // ===== Restore draft khi quay lại từ PickLocation (giữ lại cho tương thích cũ) =====
    useEffect(() => {
        const draft = route?.params?.draft;
        if (draft && typeof draft === 'object') {
            if (typeof draft.title === 'string') setTitle(draft.title);
            if (typeof draft.description === 'string') setDescription(draft.description);
            if (typeof draft.addressText === 'string') setAddressText(draft.addressText);
            if (typeof draft.streetText === 'string') setStreetText(draft.streetText);
            if (typeof draft.area === 'string') setArea(draft.area);
            if (typeof draft.price === 'string') setPrice(draft.price);

            if (draft.categoryId != null) setCategoryId(toIntOrDefault(draft.categoryId, 1));
            if (draft.postTypeId != null) setPostTypeId(toIntOrDefault(draft.postTypeId, 1));

            if (draft.details && typeof draft.details === 'object') {
                setDetails((prev) => ({ ...prev, ...draft.details }));
            }
            if (typeof draft.otherInfo === 'string') setOtherInfo(draft.otherInfo);

            if (Array.isArray(draft.assets)) setAssets(draft.assets);
            if (draft.location && typeof draft.location === 'object') setLocation(draft.location);
            if (Array.isArray(draft.deleteImageIds)) setDeleteImageIds(draft.deleteImageIds);
            if (typeof draft.provinceCode === 'string') setProvinceCode(draft.provinceCode);
            if (typeof draft.districtCode === 'string') setDistrictCode(draft.districtCode);
            if (typeof draft.wardCode === 'string') setWardCode(draft.wardCode);
            if (typeof draft.hasLocationSelection === 'boolean') setHasLocationSelection(draft.hasLocationSelection);

            navigation.setParams({ draft: undefined });
        }
    }, [route?.params?.draft, navigation]);

    // ===== Nhận pickedLocation (giữ lại cho tương thích cũ) =====
    useEffect(() => {
        const picked = route?.params?.pickedLocation;
        if (picked?.lat && picked?.lng) {
            setLocation(picked);
            navigation.setParams({ pickedLocation: undefined });
        }
    }, [route?.params?.pickedLocation, navigation]);

    const canSubmit = useMemo(() => {
        return title.trim().length > 0 && !!location?.lat && !!location?.lng;
    }, [title, location]);

    // ===== Image Picker =====
    const pickImages = async () => {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (perm.status !== 'granted') {
                Alert.alert('Thiếu quyền', 'Bạn cần cấp quyền truy cập ảnh.');
                return;
            }

            const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.85,
                allowsMultipleSelection: true,
                selectionLimit: 10,
            });

            if (res.canceled) return;

            const picked = res.assets || [];
            setAssets((prev) => {
                const merged = [...prev, ...picked];
                const seen = new Set();
                return merged.filter((a) => {
                    const uri = a?.uri;
                    if (!uri) return false;
                    if (seen.has(uri)) return false;
                    seen.add(uri);
                    return true;
                });
            });
        } catch (e) {
            console.log('pickImages error:', e);
            Alert.alert('Lỗi', String(e?.message || e));
        }
    };

    const removeImage = (uri) => {
        setAssets((prev) => {
            const target = prev.find((a) => a.uri === uri);
            if (target?.__remote && target?.id != null) {
                setDeleteImageIds((ids) => (ids.includes(target.id) ? ids : [...ids, target.id]));
            }
            return prev.filter((a) => a.uri !== uri);
        });
    };

    // ✅ mở map: giữ dữ liệu + trả về bằng callback để không mất form
    const openPickLocation = () => {
        const draft = {
            title,
            description,
            addressText,
            streetText,
            area,
            price,
            categoryId,
            postTypeId,
            location,
            assets,
            deleteImageIds,
            details,
            otherInfo,
            provinceCode,
            districtCode,
            wardCode,
            hasLocationSelection,
        };

        // ✅ đánh dấu để không reset khi quay lại từ màn map
        returningFromMapRef.current = true;

        navigation.navigate('PickLocation', {
            initialLocation: location,
            draft,
            onPicked: (picked) => {
                if (picked?.lat && picked?.lng) {
                    setLocation(picked);
                }
            },
        });
    };

    const provinces = useMemo(() => getProvinces(), []);
    const districts = useMemo(() => getDistrictsByProvinceCode(provinceCode), [provinceCode]);
    const wards = useMemo(() => getWardsByDistrictCode(districtCode), [districtCode]);

    const selectedProvince = useMemo(
        () => provinces.find((p) => String(p.code) === String(provinceCode)),
        [provinces, provinceCode]
    );
    const selectedDistrict = useMemo(
        () => districts.find((d) => String(d.code) === String(districtCode)),
        [districts, districtCode]
    );
    const selectedWard = useMemo(
        () => wards.find((w) => String(w.code) === String(wardCode)),
        [wards, wardCode]
    );

    useEffect(() => {
        setHasLocationSelection(!!(provinceCode || districtCode || wardCode));
    }, [provinceCode, districtCode, wardCode]);

    useEffect(() => {
        if (!hasLocationSelection) return;
        const composed = buildAddressText(
            streetText.trim(),
            selectedWard?.name,
            selectedDistrict?.name,
            selectedProvince?.name
        );
        setAddressText(composed);
    }, [hasLocationSelection, streetText, selectedWard, selectedDistrict, selectedProvince]);

    const validateBeforeSubmit = () => {
        clearErrors();
        const a = area.trim();
        const p = price.trim();

        let ok = true;
        if (!a) {
            setErrArea('Vui lòng nhập diện tích.');
            ok = false;
        }
        if (!p) {
            setErrPrice('Vui lòng nhập giá.');
            ok = false;
        }

        if (!ok) {
            Alert.alert('Thiếu thông tin', 'Bạn cần nhập đầy đủ Giá và Diện tích.');
        }
        return ok;
    };

    const goUpgrade = useCallback(() => {
        const parentNav = navigation.getParent();
        (parentNav || navigation).navigate('Tài khoản', {
            screen: 'ProfileHome',
            params: { openVipModal: true },
        });
    }, [navigation]);

    const submit = async () => {
        if (!canSubmit) {
            Alert.alert('Thiếu dữ liệu', 'Bạn cần nhập tiêu đề và ghim vị trí (tọa độ).');
            return;
        }
        if (!validateBeforeSubmit()) return;

        try {
            setLoading(true);

            const cleanedDetails = Object.fromEntries(
                Object.entries(details).filter(([_, v]) => String(v ?? '').trim() !== '')
            );

            const addressPayload = addressText.trim() ? JSON.stringify({ full: addressText.trim() }) : null;
            const otherInfoPayload = otherInfo.trim() ? JSON.stringify({ text: otherInfo.trim() }) : null;
            const locationPayload = JSON.stringify({ lat: location.lat, lng: location.lng });

            const hasNewImages = assets.some((a) => a?.uri && !a.__remote);
            const hasDeleteImages = deleteImageIds.length > 0;

            // ===== EDIT: PATCH (JSON hoặc multipart) =====
            if (mode === 'edit' && resolvedPostId) {
                if (hasNewImages || hasDeleteImages) {
                    const form = new FormData();
                    form.append('title', title.trim());
                    form.append('description', description.trim());
                    if (addressPayload) form.append('address', addressPayload);
                    form.append('area', String(area).trim());
                    form.append('price', String(price).trim());
                    form.append('category_id', String(categoryId));
                    form.append('post_type_id', String(postTypeId));
                    form.append('location', locationPayload);
                    if (Object.keys(cleanedDetails).length > 0) form.append('details', JSON.stringify(cleanedDetails));
                    if (otherInfoPayload) form.append('other_info', otherInfoPayload);
                    if (hasDeleteImages) form.append('delete_image_ids', JSON.stringify(deleteImageIds));

                    assets.forEach((a, idx) => {
                        if (!a?.uri || a.__remote) return;
                        form.append('images', {
                            uri: a.uri,
                            name: `photo_${idx}.jpg`,
                            type: 'image/jpeg',
                        });
                    });

                    // axios PATCH multipart hay lỗi "Network Error" trên RN -> dùng fetch để ổn định hơn
                    const base = (client?.defaults?.baseURL || '').replace(/\/+$/, '');
                    const endpoint = ENDPOINTS.POST_DETAIL(resolvedPostId);
                    const url = base ? `${base}${endpoint}` : endpoint;
                    const token = await AsyncStorage.getItem('access_token');

                    const res = await fetch(url, {
                        method: 'PATCH',
                        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                        body: form,
                    });

                    if (!res.ok) {
                        const text = await res.text();
                        throw new Error(`PATCH failed: ${res.status} ${text}`);
                    }
                } else {
                    const payload = {
                        title: title.trim(),
                        description: description.trim(),
                        address: addressPayload,
                        area: String(area).trim(),
                        price: String(price).trim(),
                        category_id: String(categoryId),
                        post_type_id: String(postTypeId),
                        location: locationPayload,
                        details: Object.keys(cleanedDetails).length ? JSON.stringify(cleanedDetails) : null,
                        other_info: otherInfoPayload,
                    };

                    Object.keys(payload).forEach((k) => payload[k] == null && delete payload[k]);

                    await client.patch(ENDPOINTS.POST_DETAIL(resolvedPostId), payload);
                }

                Alert.alert('Thành công', 'Cập nhật bài thành công!');
                navigation.goBack();
                return;
            }

            // ===== CREATE: JSON nếu không có ảnh, multipart nếu có ảnh =====
            let resData = null;

            if (!hasNewImages) {
                const payload = {
                    title: title.trim(),
                    description: description.trim(),
                    address: addressPayload,
                    area: String(area).trim(),
                    price: String(price).trim(),
                    category_id: String(categoryId),
                    post_type_id: String(postTypeId),
                    location: locationPayload,
                    details: Object.keys(cleanedDetails).length ? JSON.stringify(cleanedDetails) : null,
                    other_info: otherInfoPayload,
                };

                Object.keys(payload).forEach((k) => payload[k] == null && delete payload[k]);

                const res = await client.post(ENDPOINTS.POSTS, payload);
                resData = res?.data;
            } else {
                const form = new FormData();

                form.append('title', title.trim());
                form.append('description', description.trim());
                if (addressPayload) form.append('address', addressPayload);

                form.append('area', String(area).trim());
                form.append('price', String(price).trim());

                form.append('category_id', String(categoryId));
                form.append('post_type_id', String(postTypeId));

                form.append('location', locationPayload);

                if (Object.keys(cleanedDetails).length > 0) form.append('details', JSON.stringify(cleanedDetails));
                if (otherInfoPayload) form.append('other_info', otherInfoPayload);

                // images (chỉ upload ảnh local)
                assets.forEach((a, idx) => {
                    if (!a?.uri) return;
                    if (a.__remote) return; // ảnh remote chỉ hiển thị, không upload lại
                    form.append('images', {
                        uri: a.uri,
                        name: `photo_${idx}.jpg`,
                        type: 'image/jpeg',
                    });
                });

                const base = (client?.defaults?.baseURL || '').replace(/\/+$/, '');
                const endpoint = ENDPOINTS.POSTS;
                const url = base ? `${base}${endpoint}` : endpoint;
                const token = await AsyncStorage.getItem('access_token');

                const res = await fetch(url, {
                    method: 'POST',
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    body: form,
                });

                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(`POST failed: ${res.status} ${text}`);
                }

                try {
                    resData = await res.json();
                } catch {
                    resData = null;
                }
            }

            Alert.alert('Thành công', 'Đăng bài thành công!');
            const newId = resData?.id || resData?.result?.id;

            // ✅ sau khi tạo xong: reset để lần sau vào Đăng tin luôn trống
            resetForm({ clearParams: true });

            if (newId) {
                navigation.navigate('Trang chủ', {
                    screen: 'PostDetail',
                    params: { postId: newId, images: resData?.images || [] },
                });
            } else {
                navigation.goBack();
            }
        } catch (e) {
            console.log('Submit post error:', e?.response?.status, e?.response?.data || e.message);
            const status = e?.response?.status;
            const errorCode = e?.response?.data?.error;
            const serverMessage = e?.response?.data?.message || e?.response?.data?.detail;
            const rawMessage = String(serverMessage || '');
            const isDailyLimitError = status === 400 && errorCode === 'MAX_DAILY_POSTS_REACHED';
            if (isDailyLimitError) {
                setUpgradeNotice({
                    message:
                        rawMessage ||
                        'Ban da dat toi da bai dang trong ngay. Vui long nang cap VIP de dang nhieu hon.',
                });
            }
            const isMembershipError =
                status === 402 ||
                status === 403 ||
                /vip|gói|goi|membership|nâng cấp|nang cap/i.test(rawMessage);

            if (isMembershipError) {
                const parentNav = navigation.getParent();
                const goUpgrade = () =>
                    (parentNav || navigation).navigate('Tài khoản', {
                        screen: 'ProfileHome',
                        params: { openVipModal: true },
                    });

                Alert.alert('Thông báo', 'Bạn chưa đăng ký gói, vui lòng mua', [
                    { text: 'Hủy', style: 'cancel' },
                    { text: 'Nâng cấp VIP', onPress: goUpgrade },
                ]);
            } else {
                Alert.alert('Lỗi', rawMessage || 'Không thể thực hiện. Kiểm tra dữ liệu và API.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
                    <Ionicons name="arrow-back" size={22} color="#111" />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>{mode === 'edit' ? 'Sửa tin' : 'Đăng tin'}</Text>

                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 140 }}
                >
                    <Section title="Thông tin cơ bản">
                        <Text style={styles.label}>Tiêu đề *</Text>
                        <TextInput
                            style={styles.input}
                            value={title}
                            onChangeText={setTitle}
                            placeholder="VD: Bán căn hộ 2PN..."
                            placeholderTextColor="#999"
                        />

                        <Text style={styles.label}>Mô tả</Text>
                        <TextInput
                            style={[styles.input, { height: 110, textAlignVertical: 'top' }]}
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Mô tả chi tiết..."
                            placeholderTextColor="#999"
                            multiline
                        />

                        <Text style={styles.label}>Địa chỉ</Text>
                        <View style={styles.pickerBox}>
                            <Picker
                                selectedValue={provinceCode}
                                onValueChange={(v) => {
                                    setProvinceCode(v);
                                    setDistrictCode('');
                                    setWardCode('');
                                }}
                            >
                                <Picker.Item label="Chọn tỉnh/thành" value="" />
                                {provinces.map((p) => (
                                    <Picker.Item key={p.code} label={p.name} value={p.code} />
                                ))}
                            </Picker>
                        </View>

                        <View style={styles.pickerBox}>
                            <Picker
                                selectedValue={districtCode}
                                onValueChange={(v) => {
                                    setDistrictCode(v);
                                    setWardCode('');
                                }}
                            >
                                <Picker.Item label="Chọn quận/huyện" value="" />
                                {districts.map((d) => (
                                    <Picker.Item key={d.code} label={d.name} value={d.code} />
                                ))}
                            </Picker>
                        </View>

                        <View style={styles.pickerBox}>
                            <Picker selectedValue={wardCode} onValueChange={(v) => setWardCode(v)}>
                                <Picker.Item label="Chọn phường/xã" value="" />
                                {wards.map((w) => (
                                    <Picker.Item key={w.code} label={w.name} value={w.code} />
                                ))}
                            </Picker>
                        </View>

                        <TextInput
                            style={styles.input}
                            value={streetText}
                            onChangeText={setStreetText}
                            placeholder="Số nhà, đường (tuỳ chọn)"
                            placeholderTextColor="#999"
                        />

                        <TextInput
                            style={[styles.input, hasLocationSelection ? styles.readOnly : null]}
                            value={addressText}
                            editable={!hasLocationSelection}
                            onChangeText={setAddressText}
                            placeholder="Địa chỉ hiển thị sẽ tự ghép ở đây"
                            placeholderTextColor="#999"
                        />

                        <View style={styles.row2}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Diện tích</Text>
                                <TextInput
                                    style={[styles.input, errArea ? styles.inputError : null]}
                                    value={area}
                                    onChangeText={(t) => {
                                        setArea(t);
                                        if (errArea) setErrArea('');
                                    }}
                                    keyboardType="numeric"
                                    placeholder="m²"
                                    placeholderTextColor="#999"
                                />
                                {!!errArea && <Text style={styles.errText}>{errArea}</Text>}
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Giá</Text>
                                <TextInput
                                    style={[styles.input, errPrice ? styles.inputError : null]}
                                    value={price}
                                    onChangeText={(t) => {
                                        setPrice(t);
                                        if (errPrice) setErrPrice('');
                                    }}
                                    keyboardType="numeric"
                                    placeholder="VND"
                                    placeholderTextColor="#999"
                                />
                                {!!errPrice && <Text style={styles.errText}>{errPrice}</Text>}
                            </View>
                        </View>

                        <View style={styles.row2}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Danh mục</Text>
                                <View style={styles.pickerBox}>
                                    <Picker selectedValue={categoryId} onValueChange={(v) => setCategoryId(v)}>
                                        {CATEGORY_OPTIONS.map((c) => (
                                            <Picker.Item key={c.id} label={c.label} value={c.id} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Loại tin</Text>
                                <View style={styles.pickerBox}>
                                    <Picker selectedValue={postTypeId} onValueChange={(v) => setPostTypeId(v)}>
                                        {POST_TYPE_OPTIONS.map((t) => (
                                            <Picker.Item key={t.id} label={t.label} value={t.id} />
                                        ))}
                                    </Picker>
                                </View>
                            </View>
                        </View>
                    </Section>

                    <Section title="Vị trí">
                        <Text style={styles.label}>Vị trí (tọa độ) *</Text>
                        <TouchableOpacity style={styles.pinBtn} onPress={openPickLocation} activeOpacity={0.9}>
                            <Ionicons name="pin" size={18} color="#111" />
                            <Text style={{ fontWeight: '900', marginLeft: 8 }}>
                                {location?.lat && location?.lng
                                    ? `Đã ghim: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                                    : 'Ghim vị trí trên bản đồ'}
                            </Text>
                        </TouchableOpacity>
                        <Text style={styles.hint}>
                            Nhấn giữ trên bản đồ để ghim. Quay lại sẽ giữ nguyên dữ liệu bạn đã nhập.
                        </Text>
                    </Section>

                    <Section title="Ảnh mô tả">
                        <View style={styles.rowBetween}>
                            <Text style={styles.label}>Chọn ảnh</Text>
                            <TouchableOpacity style={styles.addImgBtn} onPress={pickImages}>
                                <Ionicons name="images-outline" size={18} color="#111" />
                                <Text style={{ fontWeight: '900', marginLeft: 6 }}>Chọn ảnh</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                            {assets.map((a) => (
                                <View key={a.uri} style={styles.thumbWrap}>
                                    <Image source={{ uri: a.uri }} style={styles.thumb} />
                                    <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(a.uri)}>
                                        <Ionicons name="close" size={16} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>

                        {mode === 'edit' ? (
                            <Text style={styles.noteSmall}>
                                * Khi sửa: ảnh cũ chỉ hiển thị để tham khảo. (Backend thường yêu cầu API riêng để cập nhật ảnh)
                            </Text>
                        ) : null}
                    </Section>

                    <Section title="Chi tiết">
                        <KVInput
                            label={prettyLabel('legal')}
                            value={safeStr(details.legal)}
                            onChangeText={(t) => setDetails((p) => ({ ...p, legal: t }))}
                            placeholder="VD: Hợp đồng mua bán / Sổ hồng..."
                        />
                        <KVInput
                            label={prettyLabel('floors')}
                            value={safeStr(details.floors)}
                            onChangeText={(t) => setDetails((p) => ({ ...p, floors: t }))}
                            placeholder="VD: 14"
                            keyboardType="numeric"
                        />
                        <KVInput
                            label={prettyLabel('bedrooms')}
                            value={safeStr(details.bedrooms)}
                            onChangeText={(t) => setDetails((p) => ({ ...p, bedrooms: t }))}
                            placeholder="VD: 2"
                            keyboardType="numeric"
                        />
                        <KVInput
                            label={prettyLabel('bathrooms')}
                            value={safeStr(details.bathrooms)}
                            onChangeText={(t) => setDetails((p) => ({ ...p, bathrooms: t }))}
                            placeholder="VD: 2"
                            keyboardType="numeric"
                        />
                        <KVInput
                            label={prettyLabel('direction')}
                            value={safeStr(details.direction)}
                            onChangeText={(t) => setDetails((p) => ({ ...p, direction: t }))}
                            placeholder="VD: Đông Nam"
                        />
                        <KVInput
                            label={prettyLabel('furniture')}
                            value={safeStr(details.furniture)}
                            onChangeText={(t) => setDetails((p) => ({ ...p, furniture: t }))}
                            placeholder="VD: Hoàn thiện cơ bản"
                        />
                    </Section>

                    <Section title="Thông tin khác">
                        <TextInput
                            style={[styles.input, { minHeight: 46 }]}
                            value={otherInfo}
                            onChangeText={setOtherInfo}
                            placeholder="VD: Liên hệ chính chủ xem nhà trực tiếp..."
                            placeholderTextColor="#999"
                        />
                    </Section>

                    {upgradeNotice ? (
                        <View style={styles.upgradeCard}>
                            <Text style={styles.upgradeTitle}>Gioi han dang bai</Text>
                            <Text style={styles.upgradeText}>{upgradeNotice.message}</Text>
                            <TouchableOpacity style={styles.upgradeBtn} onPress={goUpgrade} activeOpacity={0.9}>
                                <Ionicons name="person-circle-outline" size={18} color="#111" />
                                <Text style={styles.upgradeBtnText}>Di chuyen toi Profile nang cap VIP</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        style={[styles.submitBtn, (!canSubmit || loading) && { opacity: 0.5 }]}
                        onPress={submit}
                        disabled={!canSubmit || loading}
                    >
                        <Text style={styles.submitText}>
                            {loading ? (mode === 'edit' ? 'Đang cập nhật...' : 'Đang đăng...') : mode === 'edit' ? 'Cập nhật' : 'Đăng bài'}
                        </Text>
                    </TouchableOpacity>

                    <Text style={styles.note}>
                        * Bắt buộc: Tiêu đề + Vị trí (lat/lng). Ngoài ra: Giá + Diện tích phải nhập để đăng/cập nhật.
                    </Text>
                </ScrollView>
            </KeyboardAvoidingView>
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

    section: { marginTop: 14 },
    sectionTitle: { fontSize: 14, fontWeight: '900', color: '#333', marginBottom: 8 },
    sectionCard: {
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 14,
        padding: 12,
        backgroundColor: '#fff',
    },

    label: { marginTop: 10, fontWeight: '900', color: '#333' },
    input: {
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#e6e6e6',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#fff',
        color: '#111',
    },
    readOnly: { backgroundColor: '#f7f7f7', color: '#666' },

    inputError: { borderColor: '#ff3b30' },
    errText: { marginTop: 6, color: '#ff3b30', fontWeight: '800', fontSize: 12 },

    row2: { flexDirection: 'row', gap: 10, marginTop: 6 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    pickerBox: {
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#e6e6e6',
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#fff',
    },

    pinBtn: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: '#fff',
    },
    hint: { marginTop: 8, color: '#666', lineHeight: 18 },

    addImgBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#ddd',
        backgroundColor: '#fff',
    },

    thumbWrap: { marginRight: 10, marginTop: 6 },
    thumb: { width: 86, height: 86, borderRadius: 12, backgroundColor: '#eee' },
    removeBtn: {
        position: 'absolute',
        right: -6,
        top: -6,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    kvRowInput: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 },
    kvKey: { color: '#666', fontWeight: '800', width: '38%' },
    kvInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#e6e6e6',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#111',
    },

    submitBtn: {
        marginTop: 18,
        backgroundColor: '#FFB800',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
    },
    submitText: { fontWeight: '900', color: '#111', fontSize: 16 },

    note: { marginTop: 10, color: '#666', lineHeight: 18, paddingHorizontal: 2 },
    noteSmall: { marginTop: 10, color: '#666', lineHeight: 18, fontSize: 12 },

    upgradeCard: {
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#f1d18a',
        backgroundColor: '#fff7e0',
        borderRadius: 14,
        padding: 12,
    },
    upgradeTitle: { fontWeight: '900', color: '#5a3a00' },
    upgradeText: { marginTop: 6, color: '#6b4b12', lineHeight: 18 },
    upgradeBtn: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#e2b44b',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#ffd77a',
    },
    upgradeBtnText: { fontWeight: '900', color: '#111' },
});
