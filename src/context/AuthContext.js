// src/context/AuthContext.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import client from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [userToken, setUserToken] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // ✅ thêm: boot gate
    const [authReady, setAuthReady] = useState(false);

    const register = async (username, password, email, phone, confirmPassword) => {
        setIsLoading(true);
        try {
            await client.post(ENDPOINTS.REGISTER, {
                username,
                password,
                email,
                phone,
                confirm_password: confirmPassword,
            });
            Alert.alert('Thành công', 'Đăng ký tài khoản thành công! Vui lòng đăng nhập.');
            return { success: true };
        } catch (error) {
            console.log('Lỗi đăng ký:', error.response?.data || error?.message);
            return { success: false, error: error.response?.data || { detail: 'Lỗi kết nối mạng' } };
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (username, password) => {
        setIsLoading(true);
        try {
            const response = await client.post(ENDPOINTS.LOGIN, { username, password });
            const { access, refresh } = response.data || {};

            if (access) {
                await AsyncStorage.setItem('access_token', access);
                if (refresh) await AsyncStorage.setItem('refresh_token', refresh);
                setUserToken(access);

                await SecureStore.setItemAsync('saved_username', username);
                await SecureStore.setItemAsync('saved_password', password);
                console.log('Đăng nhập & Lưu credentials thành công!');
            }

            return { ok: true };
        } catch (error) {
            console.log('Lỗi đăng nhập:', error?.response?.status, error?.response?.data || error?.message);
            Alert.alert('Thất bại', 'Sai tài khoản hoặc mật khẩu!');
            return { ok: false };
        } finally {
            setIsLoading(false);
        }
    };

    const loginWithBiometrics = async () => {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        if (!hasHardware) {
            Alert.alert('Thông báo', 'Thiết bị không hỗ trợ FaceID/Vân tay');
            return;
        }

        const savedUser = await SecureStore.getItemAsync('saved_username');
        const savedPass = await SecureStore.getItemAsync('saved_password');

        if (!savedUser || !savedPass) {
            Alert.alert('Chú ý', 'Bạn cần đăng nhập bằng mật khẩu lần đầu tiên để kích hoạt FaceID.');
            return;
        }

        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Xác thực để đăng nhập',
            disableDeviceFallback: true,
        });

        if (result.success) {
            await login(savedUser, savedPass);
        }
    };

    const logout = async () => {
        setIsLoading(true);
        try {
            await AsyncStorage.removeItem('access_token');
            await AsyncStorage.removeItem('refresh_token');
        } finally {
            setUserToken(null);
            setIsLoading(false);
        }
    };

    // ✅ Bootstrapping token
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const token = await AsyncStorage.getItem('access_token');
                if (!alive) return;
                if (token) setUserToken(token);
            } catch (e) {
                console.log(e);
            } finally {
                if (alive) setAuthReady(true);
            }
        })();

        return () => {
            alive = false;
        };
    }, []);

    const value = useMemo(
        () => ({
            login,
            register,
            loginWithBiometrics,
            logout,
            userToken,
            isLoading,
            authReady,
        }),
        [userToken, isLoading, authReady]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
