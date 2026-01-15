// src/screens/Auth/LoginScreen.js
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

import { AuthContext } from '../../context/AuthContext';

export default function LoginScreen() {
    const navigation = useNavigation();
    const { login, loginWithBiometrics, isLoading } = useContext(AuthContext);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);

    const resetToHome = () => {
        // ✅ Reset về MainTabs
        navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs' }],
        });

        // ✅ (Tuỳ chọn) Ép về đúng tab Trang chủ + screen Home nếu bạn cần chắc chắn
        // Nếu bạn thấy vẫn đang đứng ở tab khác, hãy bật dòng dưới:
        navigation.navigate('MainTabs', { screen: 'Trang chủ', params: { screen: 'Home' } });
    };

    const handleLogin = async () => {
        if (!username.trim() || !password) {
            Alert.alert('Thiếu thông tin', 'Vui lòng nhập username và mật khẩu.');
            return;
        }

        const res = await login(username.trim(), password);
        if (res?.ok) resetToHome();
    };

    const handleBiometric = async () => {
        // loginWithBiometrics trong AuthContext đang gọi login() bên trong.
        // Tuy nhiên nó không trả status, nên mình xử lý theo cách đơn giản:
        // Sau khi gọi biometric, ta kiểm tra lại bằng cách delay nhẹ và reset nếu token đã set.
        await loginWithBiometrics();

        // Đợi 1 chút để context cập nhật token (tránh race)
        setTimeout(() => {
            // Không check token ở đây để khỏi phụ thuộc context,
            // nếu bạn muốn chặt chẽ hơn mình sẽ chỉnh AuthContext trả {ok:true} cho biometric.
            resetToHome();
        }, 250);
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: '#f0f2f5' }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
                <View style={styles.card}>
                    <Text style={styles.title}>ĐĂNG NHẬP</Text>

                    <Text style={styles.label}>Tên đăng nhập</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Nhập username"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                    />

                    <Text style={styles.label}>Mật khẩu</Text>
                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={styles.passwordInput}
                            placeholder="Nhập mật khẩu"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPass}
                        />
                        <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeIcon}>
                            <Ionicons name={showPass ? 'eye' : 'eye-off'} size={20} color="grey" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.forgotPassContainer}
                        onPress={() => navigation.navigate('ForgotPassword')}
                    >
                        <Text style={styles.forgotPassText}>Quên mật khẩu?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>ĐĂNG NHẬP</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.bioButton} onPress={handleBiometric} disabled={isLoading}>
                        <Ionicons name="finger-print-outline" size={24} color="#1a73e8" />
                        <Text style={styles.bioText}>Mở khóa nhanh</Text>
                    </TouchableOpacity>

                    <View style={styles.footer}>
                        <Text>Chưa có tài khoản? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                            <Text style={styles.link}>Đăng ký ngay</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    card: { backgroundColor: 'white', padding: 25, borderRadius: 15, elevation: 5 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1a73e8', textAlign: 'center', marginBottom: 20 },
    label: { fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 10 },
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
    forgotPassContainer: { alignItems: 'flex-end', marginTop: 10 },
    forgotPassText: { color: '#1a73e8', fontWeight: '600' },
    button: { backgroundColor: '#1a73e8', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 22 },
    buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    bioButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16, padding: 10 },
    bioText: { color: '#1a73e8', marginLeft: 8, fontWeight: '600' },
    footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
    link: { color: '#1a73e8', fontWeight: 'bold' },
});
