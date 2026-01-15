// src/screens/Profile/ChangePasswordScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
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

const PasswordInput = ({
    value,
    onChangeText,
    placeholder,
    inputRef,
    secure,
    onToggleSecure,
    onSubmitEditing,
    returnKeyType,
}) => {
    return (
        <View style={styles.passwordWrap}>
            <TextInput
                ref={inputRef}
                value={value}
                onChangeText={onChangeText}
                style={styles.passwordInput}
                secureTextEntry={secure}
                placeholder={placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                blurOnSubmit={false}
                returnKeyType={returnKeyType}
                onSubmitEditing={onSubmitEditing}
            />
            <Pressable
                onPress={onToggleSecure}
                hitSlop={12}
                style={styles.eyeBtn}
            >
                <Ionicons name={secure ? 'eye' : 'eye-off'} size={22} color="#666" />
            </Pressable>
        </View>
    );
};

export default function ChangePasswordScreen({ navigation }) {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // secure = true nghĩa là đang ẩn
    const [secureOld, setSecureOld] = useState(true);
    const [secureNew, setSecureNew] = useState(true);
    const [secureConfirm, setSecureConfirm] = useState(true);

    const newRef = useRef(null);
    const confirmRef = useRef(null);

    const canSubmit = useMemo(() => {
        return oldPassword.length > 0 && newPassword.length > 0 && confirmPassword.length > 0;
    }, [oldPassword, newPassword, confirmPassword]);

    const handleChange = async () => {
        const oldP = oldPassword.trim();
        const newP = newPassword.trim();
        const cfP = confirmPassword.trim();

        if (!oldP) return Alert.alert('Lỗi', 'Vui lòng nhập mật khẩu cũ');
        if (!newP) return Alert.alert('Lỗi', 'Vui lòng nhập mật khẩu mới');
        if (newP.length < 6) return Alert.alert('Lỗi', 'Mật khẩu mới tối thiểu 6 ký tự');
        if (newP !== cfP) return Alert.alert('Lỗi', 'Xác nhận mật khẩu không khớp');

        try {
            setLoading(true);
            await client.post(ENDPOINTS.PASSWORD_CHANGE, {
                old_password: oldP,
                new_password: newP,
                confirm_password: cfP,
            });

            Alert.alert('Thành công', 'Đổi mật khẩu thành công');
            navigation.goBack();
        } catch (e) {
            console.log('Change password error:', e?.response?.data || e.message);
            const msg =
                e?.response?.data?.detail ||
                e?.response?.data?.message ||
                'Không đổi được mật khẩu. Vui lòng thử lại.';
            Alert.alert('Thất bại', msg);
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
                    <Text style={styles.headerTitle}>Đổi mật khẩu</Text>
                    <View style={{ width: 24 }} />
                </View>

                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="always">
                    <Text style={styles.label}>Mật khẩu cũ</Text>
                    <PasswordInput
                        value={oldPassword}
                        onChangeText={setOldPassword}
                        placeholder="Nhập mật khẩu cũ"
                        secure={secureOld}
                        onToggleSecure={() => setSecureOld((v) => !v)}
                        returnKeyType="next"
                        onSubmitEditing={() => newRef.current?.focus()}
                    />

                    <Text style={styles.label}>Mật khẩu mới</Text>
                    <PasswordInput
                        inputRef={newRef}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        placeholder="Nhập mật khẩu mới"
                        secure={secureNew}
                        onToggleSecure={() => setSecureNew((v) => !v)}
                        returnKeyType="next"
                        onSubmitEditing={() => confirmRef.current?.focus()}
                    />

                    <Text style={styles.label}>Xác nhận mật khẩu mới</Text>
                    <PasswordInput
                        inputRef={confirmRef}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="Nhập lại mật khẩu mới"
                        secure={secureConfirm}
                        onToggleSecure={() => setSecureConfirm((v) => !v)}
                        returnKeyType="done"
                        onSubmitEditing={handleChange}
                    />

                    <TouchableOpacity
                        style={[styles.btn, (!canSubmit || loading) && { opacity: 0.7 }]}
                        onPress={handleChange}
                        disabled={!canSubmit || loading}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Lưu</Text>}
                    </TouchableOpacity>

                    <View style={{ height: 30 }} />
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

    content: { padding: 16, paddingBottom: 40 },
    label: { fontSize: 14, color: '#444', marginTop: 12, marginBottom: 6 },

    passwordWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E5E5',
        borderRadius: 10,
        paddingHorizontal: 12,
        backgroundColor: '#fff',
    },
    passwordInput: {
        flex: 1,
        paddingVertical: 10,
        fontSize: 16,
    },
    eyeBtn: {
        paddingLeft: 10,
        paddingVertical: 8,
    },

    btn: {
        marginTop: 18,
        backgroundColor: '#F4B400',
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
