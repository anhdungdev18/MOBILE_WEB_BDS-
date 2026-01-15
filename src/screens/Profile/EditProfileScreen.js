// src/screens/Profile/EditProfileScreen.js
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
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

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

const onlyDigits = (s) => (s || '').toString().replace(/\D+/g, '');

const toAbsoluteMediaUrl = (maybePath) => {
    if (!maybePath) return '';
    const s = String(maybePath).trim();
    if (!s) return '';
    if (s.startsWith('http://') || s.startsWith('https://')) return s;

    const base = (client?.defaults?.baseURL || '').replace(/\/+$/, '');
    const path = s.replace(/^\/+/, '');
    return base ? `${base}/${path}` : s;
};

const guessMime = (uri) => {
    const u = (uri || '').toLowerCase();
    if (u.endsWith('.png')) return 'image/png';
    if (u.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
};

export default function EditProfileScreen({ route, navigation }) {
    const { profile } = route.params || {};

    const [email] = useState(profile?.email ?? '');
    const [username] = useState(profile?.username ?? ''); // ✅ khóa

    const [firstName, setFirstName] = useState(profile?.first_name ?? '');
    const [lastName, setLastName] = useState(profile?.last_name ?? '');

    const [phone, setPhone] = useState(profile?.so_dien_thoai ?? profile?.phone ?? '');
    const [cccd, setCccd] = useState(profile?.cccd_number ?? profile?.cccd ?? profile?.so_cccd ?? '');

    const [address, setAddress] = useState(profile?.address ?? '');
    const [bio, setBio] = useState(profile?.bio ?? '');

    const initialAvatarAbs = toAbsoluteMediaUrl(profile?.anh_dai_dien) || DEFAULT_AVATAR;
    const [avatar, setAvatar] = useState(initialAvatarAbs);
    const [avatarLocal, setAvatarLocal] = useState(null);

    const [loading, setLoading] = useState(false);

    const phoneDigits = useMemo(() => onlyDigits(phone).slice(0, 10), [phone]);
    const cccdDigits = useMemo(() => onlyDigits(cccd).slice(0, 12), [cccd]);

    const validatePhone = (v) => {
        const s = onlyDigits(v);
        if (!s) return true;
        return /^\d{10}$/.test(s);
    };

    const validateCCCD = (v) => {
        const s = onlyDigits(v);
        if (!s) return true;
        return /^\d{12}$/.test(s);
    };

    const pickAvatar = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Lỗi', 'Cần cấp quyền truy cập thư viện ảnh');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.9,
            });


            if (!result.canceled) {
                const asset = result.assets?.[0];
                if (!asset?.uri) return;

                setAvatarLocal({
                    uri: asset.uri,
                    name: asset.fileName || asset.filename || null,
                    type: asset.mimeType || asset.type || null,
                });
                setAvatar(asset.uri);
            }
        } catch (e) {
            console.log('pickAvatar error:', e?.message || e);
            Alert.alert('Lỗi', 'Không thể chọn ảnh. Vui lòng thử lại.');
        }
    };

    const handleSave = async () => {
        try {
            const firstNameTrim = (firstName || '').trim();
            const lastNameTrim = (lastName || '').trim();

            const phoneTrim = onlyDigits(phoneDigits).slice(0, 10);
            const cccdTrim = onlyDigits(cccdDigits).slice(0, 12);

            const addressTrim = (address || '').trim();
            const bioTrim = (bio || '').trim();

            if (!validatePhone(phoneTrim)) return Alert.alert('Lỗi', 'Số điện thoại phải đúng 10 chữ số');
            if (!validateCCCD(cccdTrim)) return Alert.alert('Lỗi', 'Số CCCD phải đúng 12 chữ số');

            setLoading(true);

            // 1) Upload avatar (nếu có) bằng API riêng
            if (avatarLocal?.uri) {
                const avatarForm = new FormData();
                const name = avatarLocal.name || `avatar_${Date.now()}.jpg`;

                if (Platform.OS === 'web') {
                    const blob = await fetch(avatarLocal.uri).then((r) => r.blob());
                    const file = new File([blob], name, {
                        type: avatarLocal.type || blob.type || guessMime(name),
                    });
                    avatarForm.append('avatar', file);
                } else {
                    avatarForm.append('avatar', {
                        uri: avatarLocal.uri,
                        name,
                        type: avatarLocal.type || guessMime(avatarLocal.uri),
                    });
                }

                await client.post(ENDPOINTS.AVATAR_UPLOAD, avatarForm);
            }

            // 2) Update profile info
            const form = new FormData();
            form.append('first_name', firstNameTrim);
            form.append('last_name', lastNameTrim);
            // Backend expects "phone" (ProfileUpdateSerializer).
            form.append('phone', phoneTrim || '');
            form.append('cccd_number', cccdTrim || '');
            form.append('address', addressTrim || '');
            form.append('bio', bioTrim || '');

            // ✅ Backend không cho PATCH -> dùng PUT
            // ✅ Không set Content-Type thủ công (axios tự thêm boundary)
            const res = await client.put(ENDPOINTS.PROFILE_UPDATE, form);

            console.log('Cập nhật profile:', res.data);

            // cache-bust (ưu tiên dữ liệu từ API update)
            const newAbs = toAbsoluteMediaUrl(res.data?.anh_dai_dien) || initialAvatarAbs || DEFAULT_AVATAR;
            setAvatar(`${newAbs}?t=${Date.now()}`);
            setAvatarLocal(null);

            Alert.alert('Thành công', 'Đã cập nhật thông tin tài khoản');
            navigation.goBack();
        } catch (e) {
            console.log('STATUS:', e?.response?.status);
            console.log('DATA:', e?.response?.data || e.message);
            Alert.alert('Thất bại', 'Không cập nhật được thông tin. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
            >
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="arrow-back" size={24} color="#000" />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>Chỉnh sửa hồ sơ</Text>

                    <TouchableOpacity onPress={handleSave} disabled={loading}>
                        {loading ? <ActivityIndicator size="small" /> : <Text style={styles.saveText}>Lưu</Text>}
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <View style={styles.avatarWrapper}>
                        <TouchableOpacity onPress={pickAvatar} activeOpacity={0.85}>
                            <Image source={{ uri: avatar || DEFAULT_AVATAR }} style={styles.avatar} />
                            <Text style={styles.changeAvatarText}>Đổi ảnh đại diện</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>Email</Text>
                    <TextInput value={email} editable={false} style={[styles.input, styles.readOnly]} />

                    <Text style={styles.label}>Tên đăng nhập</Text>
                    <TextInput value={username} editable={false} style={[styles.input, styles.readOnly]} />

                    <Text style={styles.label}>Họ</Text>
                    <TextInput value={firstName} onChangeText={setFirstName} style={styles.input} />

                    <Text style={styles.label}>Tên</Text>
                    <TextInput value={lastName} onChangeText={setLastName} style={styles.input} />

                    <Text style={styles.label}>Số điện thoại (10 số)</Text>
                    <TextInput
                        value={phoneDigits}
                        onChangeText={(v) => setPhone(onlyDigits(v).slice(0, 10))}
                        style={styles.input}
                        keyboardType="phone-pad"
                        maxLength={10}
                        placeholder="Nhập số điện thoại"
                    />

                    <Text style={styles.label}>Số CCCD (12 số)</Text>
                    <TextInput
                        value={cccdDigits}
                        onChangeText={(v) => setCccd(onlyDigits(v).slice(0, 12))}
                        style={styles.input}
                        keyboardType="number-pad"
                        maxLength={12}
                        placeholder="Nhập số CCCD"
                    />

                    <Text style={styles.label}>Địa chỉ</Text>
                    <TextInput value={address} onChangeText={setAddress} style={styles.input} placeholder="Nhập địa chỉ" />

                    <Text style={styles.label}>Giới thiệu</Text>
                    <TextInput
                        value={bio}
                        onChangeText={setBio}
                        style={[styles.input, styles.textArea]}
                        multiline
                        placeholder="Nhập giới thiệu"
                    />

                    <View style={{ height: 80 }} />
                </ScrollView>
            </KeyboardAvoidingView>
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
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#000' },
    saveText: { fontSize: 16, fontWeight: '700', color: '#F4B400' },

    content: { padding: 16, paddingBottom: 80, flexGrow: 1 },
    avatarWrapper: { alignItems: 'center', marginVertical: 16 },
    avatar: { width: 110, height: 110, borderRadius: 55 },
    changeAvatarText: { marginTop: 10, textAlign: 'center', color: '#F4B400', fontWeight: '700' },

    label: { fontSize: 14, color: '#444', marginTop: 12, marginBottom: 6 },
    input: {
        borderWidth: 1,
        borderColor: '#E5E5E5',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    readOnly: { backgroundColor: '#F6F6F6', color: '#666' },
    textArea: { height: 110, textAlignVertical: 'top' },
});
