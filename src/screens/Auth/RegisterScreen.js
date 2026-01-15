// src/screens/Auth/RegisterScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useContext, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import apiClient from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';
import { AuthContext } from '../../context/AuthContext';

export default function RegisterScreen() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showPass, setShowPass] = useState(false);
    const [showConfirmPass, setShowConfirmPass] = useState(false);

    const [emailError, setEmailError] = useState('');
    const [phoneError, setPhoneError] = useState('');
    const [usernameError, setUsernameError] = useState('');
    const [passwordErrorClient, setPasswordErrorClient] = useState('');

    const [serverError, setServerError] = useState({});
    const [loading, setLoading] = useState(false);

    const navigation = useNavigation();
    const { login } = useContext(AuthContext);

    const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

    // ✅ CHỈ 10 SỐ
    const validatePhone = (value) => /^[0-9]{10}$/.test(value);

    const convertErrorToVietnamese = (msg) => {
        const dict = {
            'This password is too short. It must contain at least 8 characters.':
                'Mật khẩu quá ngắn (tối thiểu 8 ký tự).',
            'This password is entirely numeric.': 'Mật khẩu không được chỉ chứa mỗi số.',
            'This password is too common.': 'Mật khẩu quá dễ đoán.',
            'This password is too similar to your other personal information.':
                'Mật khẩu quá giống với thông tin cá nhân.',
            'A user with that username already exists.': 'Tên đăng nhập đã được sử dụng.',
            'user with this email already exists.': 'Email đã được sử dụng.',
            'user with this phone already exists.': 'Số điện thoại đã được sử dụng.',
            'This field must be unique.': 'Giá trị này đã tồn tại, vui lòng dùng giá trị khác.',
            'This field is required.': 'Trường này là bắt buộc.',
        };
        return dict[msg] || msg;
    };

    const validateForm = () => {
        let ok = true;

        setEmailError('');
        setPhoneError('');
        setUsernameError('');
        setPasswordErrorClient('');
        setServerError({});

        if (!username.trim()) {
            setUsernameError('Vui lòng nhập tên đăng nhập.');
            ok = false;
        }

        if (!email.trim()) {
            setEmailError('Vui lòng nhập Email.');
            ok = false;
        } else if (!validateEmail(email.trim())) {
            setEmailError('Email không hợp lệ.');
            ok = false;
        }

        const phoneTrim = phone.trim();
        if (!phoneTrim) {
            setPhoneError('Vui lòng nhập SĐT.');
            ok = false;
        } else if (!validatePhone(phoneTrim)) {
            setPhoneError('SĐT phải đúng 10 số.');
            ok = false;
        }

        if (!password) {
            setPasswordErrorClient('Vui lòng nhập mật khẩu.');
            ok = false;
        } else if (password.length < 8) {
            setPasswordErrorClient('Mật khẩu phải ≥ 8 ký tự.');
            ok = false;
        } else if (/^\d+$/.test(password)) {
            setPasswordErrorClient('Mật khẩu không được toàn số.');
            ok = false;
        }

        if (password !== confirmPassword) {
            Alert.alert('Lỗi', 'Mật khẩu xác nhận không khớp!');
            ok = false;
        }

        return ok;
    };

    const autoLoginAndGoHome = async (u, p) => {
        const loginRes = await login(u, p);
        if (loginRes?.ok) {
            navigation.reset({
                index: 0,
                routes: [{ name: 'MainTabs' }],
            });
            return true;
        }
        return false;
    };

    const handleRegister = async () => {
        if (!validateForm()) return;

        setLoading(true);

        try {
            const phoneTrim = phone.trim();

            const payload = {
                username: username.trim(),
                email: email.trim(),

                // gửi nhiều key để backend nào cũng nhận
                phone: phoneTrim,
                so_dien_thoai: phoneTrim,
                phone_number: phoneTrim,

                password,
                confirm_password: confirmPassword,
            };

            const res = await apiClient.post(ENDPOINTS.REGISTER, payload);
            console.log('REGISTER OK:', res.data);

            // ✅ auto login
            const ok = await autoLoginAndGoHome(username.trim(), password);

            if (ok) {
                Alert.alert('Thành công', 'Đăng ký & đăng nhập thành công!');
            } else {
                Alert.alert('Thành công', 'Tài khoản đã được tạo! Vui lòng đăng nhập.', [
                    { text: 'Đăng nhập', onPress: () => navigation.goBack() },
                ]);
            }
        } catch (err) {
            console.log('REGISTER ERROR:', err?.response?.status, err?.response?.data || err?.message);

            if (!err.response) {
                Alert.alert('Lỗi', 'Không kết nối được server. Kiểm tra WiFi hoặc IP.');
                setLoading(false);
                return;
            }

            const data = err.response.data || {};
            const newErr = {};

            if (data.username) {
                const msg = Array.isArray(data.username) ? data.username[0] : data.username;
                newErr.username = [convertErrorToVietnamese(msg)];
            }

            if (data.email) {
                const msg = Array.isArray(data.email) ? data.email[0] : data.email;
                newErr.email = [convertErrorToVietnamese(msg)];
            }

            // phone error từ nhiều key
            for (const k of ['phone', 'so_dien_thoai', 'phone_number']) {
                if (data[k]) {
                    const msg = Array.isArray(data[k]) ? data[k][0] : data[k];
                    newErr.phone = [convertErrorToVietnamese(msg)];
                    break;
                }
            }

            if (data.password) {
                const list = Array.isArray(data.password) ? data.password : [data.password];
                newErr.password = list.map(convertErrorToVietnamese);
            }

            if (data.confirm_password) {
                const msg = Array.isArray(data.confirm_password)
                    ? data.confirm_password[0]
                    : data.confirm_password;
                newErr.confirm_password = [convertErrorToVietnamese(msg)];
            }

            setServerError(newErr);

            if (!Object.keys(newErr).length) {
                Alert.alert('Lỗi', 'Đăng ký thất bại. Vui lòng thử lại.');
            }
        }

        setLoading(false);
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.card}>
                    <Text style={styles.title}>ĐĂNG KÝ TÀI KHOẢN</Text>

                    <Text style={styles.label}>Tên đăng nhập</Text>
                    <TextInput
                        style={[styles.input, (usernameError || serverError.username) && styles.inputError]}
                        placeholder="Nhập tên đăng nhập"
                        value={username}
                        onChangeText={(t) => {
                            setUsername(t);
                            setUsernameError('');
                        }}
                        autoCapitalize="none"
                    />
                    {usernameError ? <Text style={styles.errorText}>{usernameError}</Text> : null}
                    {serverError.username && <Text style={styles.errorText}>{serverError.username[0]}</Text>}

                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={[styles.input, (emailError || serverError.email) && styles.inputError]}
                        placeholder="Nhập Email"
                        value={email}
                        onChangeText={(t) => {
                            setEmail(t);
                            setEmailError('');
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                    {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
                    {serverError.email && <Text style={styles.errorText}>{serverError.email[0]}</Text>}

                    <Text style={styles.label}>Số điện thoại</Text>
                    <TextInput
                        style={[styles.input, (phoneError || serverError.phone) && styles.inputError]}
                        placeholder="Nhập SĐT (10 số)"
                        value={phone}
                        onChangeText={(t) => {
                            const onlyDigits = t.replace(/[^0-9]/g, '');
                            setPhone(onlyDigits);
                            setPhoneError('');
                        }}
                        keyboardType="number-pad"
                        maxLength={10}   // ✅ CHỈ 10 SỐ
                    />
                    {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
                    {serverError.phone && <Text style={styles.errorText}>{serverError.phone[0]}</Text>}

                    <Text style={styles.label}>Mật khẩu</Text>
                    <View style={[styles.passwordContainer, (passwordErrorClient || serverError.password) && styles.inputError]}>
                        <TextInput
                            style={styles.passwordInput}
                            placeholder="Nhập mật khẩu"
                            value={password}
                            onChangeText={(t) => {
                                setPassword(t);
                                setPasswordErrorClient('');
                            }}
                            secureTextEntry={!showPass}
                        />
                        <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeIcon}>
                            <Ionicons name={showPass ? 'eye' : 'eye-off'} size={20} color="grey" />
                        </TouchableOpacity>
                    </View>
                    {passwordErrorClient ? <Text style={styles.errorText}>{passwordErrorClient}</Text> : null}
                    {serverError.password &&
                        serverError.password.map((err, idx) => (
                            <Text key={idx} style={styles.errorText}>
                                • {err}
                            </Text>
                        ))}

                    <Text style={styles.label}>Xác nhận mật khẩu</Text>
                    <View style={[styles.passwordContainer, serverError.confirm_password && styles.inputError]}>
                        <TextInput
                            style={styles.passwordInput}
                            placeholder="Nhập lại mật khẩu"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showConfirmPass}
                        />
                        <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)} style={styles.eyeIcon}>
                            <Ionicons name={showConfirmPass ? 'eye' : 'eye-off'} size={20} color="grey" />
                        </TouchableOpacity>
                    </View>
                    {serverError.confirm_password && (
                        <Text style={styles.errorText}>{serverError.confirm_password[0]}</Text>
                    )}

                    <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>ĐĂNG KÝ</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20, paddingBottom: 20 }}>
                        <Text style={styles.link}>← Quay lại Đăng nhập</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f0f2f5' },
    card: { backgroundColor: 'white', padding: 20, borderRadius: 15, elevation: 4 },
    title: { fontSize: 22, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 20 },
    label: { fontWeight: '600', color: '#555', marginBottom: 5, marginTop: 10 },
    input: { borderWidth: 1, borderColor: '#ddd', padding: 12, borderRadius: 8, backgroundColor: '#fafafa' },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        backgroundColor: '#fafafa',
    },
    passwordInput: { flex: 1, padding: 12 },
    eyeIcon: { padding: 10 },
    inputError: { borderColor: 'red', backgroundColor: '#fff0f0' },
    errorText: { color: 'red', fontSize: 12, marginTop: 4, marginLeft: 2 },
    button: { backgroundColor: '#28a745', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 25 },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    link: { color: '#1a73e8', textAlign: 'center', fontWeight: 'bold' },
});
