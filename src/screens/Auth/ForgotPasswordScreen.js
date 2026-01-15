// src/screens/Auth/ForgotPasswordScreen.js

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import apiClient from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';

export default function ForgotPasswordScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const validateEmail = () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email.trim()) {
            setError('• Vui lòng nhập Email đã đăng ký.');
            return false;
        }

        if (!emailRegex.test(email.trim())) {
            setError('• Email không hợp lệ. Vui lòng nhập đúng định dạng.');
            return false;
        }

        return true;
    };

    const handleResetPassword = async () => {
        Keyboard.dismiss();
        setError('');

        if (!validateEmail()) return;

        setLoading(true);

        try {
            const payload = { email: email.trim() };

            console.log('FORGOT PASSWORD CALL:', ENDPOINTS.FORGOT_PASSWORD, payload);

            const res = await apiClient.post(ENDPOINTS.FORGOT_PASSWORD, payload);

            console.log('FORGOT PASSWORD OK:', res.status, res.data);

            const message = `Link đặt lại mật khẩu đã được gửi tới email: ${email.trim()}`;

            Alert.alert('Đã gửi yêu cầu', message, [
                { text: 'Quay lại Đăng nhập', onPress: () => navigation.goBack() },
            ]);
        } catch (err) {
            console.log(
                'FORGOT PASSWORD ERROR:',
                err.message,
                err.response?.status,
                err.response?.data
            );

            if (!err.response) {
                Alert.alert(
                    'Lỗi',
                    'Không kết nối được server. Kiểm tra lại WiFi, IP backend hoặc Docker port.'
                );
            } else if (err.response.status === 400 && err.response.data) {
                const data = err.response.data;

                if (data.email) {
                    const msg = Array.isArray(data.email) ? data.email[0] : data.email;
                    setError(`• ${msg}`);
                } else if (data.detail) {
                    Alert.alert('Lỗi', data.detail);
                } else {
                    Alert.alert('Lỗi', 'Yêu cầu lấy lại mật khẩu không hợp lệ.');
                }
            } else {
                Alert.alert('Lỗi', 'Không thể xử lý yêu cầu. Vui lòng thử lại.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>

            <View style={styles.content}>
                <Text style={styles.title}>Quên mật khẩu?</Text>
                <Text style={styles.subTitle}>
                    Nhập địa chỉ Email đã đăng ký để nhận link đặt lại mật khẩu.
                </Text>

                <Text style={styles.label}>Email</Text>
                <TextInput
                    style={[styles.input, error ? styles.inputError : null]}
                    placeholder="Ví dụ: abc@gmail.com"
                    value={email}
                    onChangeText={(text) => {
                        setEmail(text);
                        setError('');
                    }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity
                    style={styles.button}
                    onPress={handleResetPassword}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>GỬI YÊU CẦU</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff', padding: 20 },
    backButton: { marginTop: 30, marginBottom: 20 },
    content: { flex: 1, justifyContent: 'center', paddingBottom: 100 },

    title: { fontSize: 28, fontWeight: 'bold', color: '#1a73e8', marginBottom: 10 },
    subTitle: { fontSize: 14, color: '#666', marginBottom: 30, lineHeight: 20 },

    label: { fontWeight: '600', color: '#333', marginBottom: 8 },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fafafa',
        color: '#333',
    },
    inputError: { borderColor: '#d93025', borderWidth: 1 },
    errorText: { color: '#d93025', marginTop: 8, fontSize: 13, fontWeight: '500' },

    button: {
        backgroundColor: '#1a73e8',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 30,
        elevation: 2,
    },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
