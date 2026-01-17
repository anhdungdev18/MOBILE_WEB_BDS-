// src/api/client.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { ENDPOINTS } from './endpoints';

const client = axios.create({
    // ⚠️ Sửa đúng IP backend của bạn
    baseURL: 'http://10.48.9.21:8000',
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    },
});

// ===== Request: gắn Authorization =====
client.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('access_token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
        else delete config.headers.Authorization;

        // If sending FormData, let axios set the correct multipart boundary.
        if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
            if (config.headers && config.headers['Content-Type']) {
                delete config.headers['Content-Type'];
            }
            if (config.headers && config.headers['content-type']) {
                delete config.headers['content-type'];
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ===== Response: auto refresh khi 401 =====
let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
    refreshQueue.forEach((p) => {
        if (error) p.reject(error);
        else p.resolve(token);
    });
    refreshQueue = [];
};

client.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;

        if (!error.response) return Promise.reject(error);

        if (error.response.status === 401 && !original._retry) {
            original._retry = true;

            const refresh = await AsyncStorage.getItem('refresh_token');
            if (!refresh) {
                // ✅ không có refresh => coi như logout
                await AsyncStorage.removeItem('access_token');
                await AsyncStorage.removeItem('refresh_token');
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    refreshQueue.push({
                        resolve: (token) => {
                            original.headers.Authorization = `Bearer ${token}`;
                            resolve(client(original));
                        },
                        reject,
                    });
                });
            }

            isRefreshing = true;

            try {
                const res = await axios.post(client.defaults.baseURL + ENDPOINTS.REFRESH, { refresh });
                const newAccess = res.data?.access;
                if (!newAccess) throw new Error('No access token returned');

                await AsyncStorage.setItem('access_token', newAccess);
                client.defaults.headers.common.Authorization = `Bearer ${newAccess}`;

                processQueue(null, newAccess);

                original.headers.Authorization = `Bearer ${newAccess}`;
                return client(original);
            } catch (refreshErr) {
                processQueue(refreshErr, null);

                // ✅ refresh fail => clear tokens để UI quay về guest
                await AsyncStorage.removeItem('access_token');
                await AsyncStorage.removeItem('refresh_token');

                return Promise.reject(refreshErr);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default client;
