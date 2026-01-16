// src/screens/Profile/ProfileScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useContext, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import client from '../../api/client';
import { ENDPOINTS } from '../../api/endpoints';
import { AuthContext } from '../../context/AuthContext';

const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

export default function ProfileScreen() {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const { logout } = useContext(AuthContext);

    const [profile, setProfile] = useState(null);
    const [membership, setMembership] = useState(null);

    const [loading, setLoading] = useState(false);
    const [vipLoading, setVipLoading] = useState(false);
    const [upgradeLoading, setUpgradeLoading] = useState(false);
    const [vipModalVisible, setVipModalVisible] = useState(false);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const res = await client.get(ENDPOINTS.PROFILE);
            setProfile(res.data);
        } catch (e) {
            console.log('Lỗi load profile:', e?.response?.data || e.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchMembership = async () => {
        try {
            setVipLoading(true);
            const res = await client.get(ENDPOINTS.MEMBERSHIP_ME);
            setMembership(res.data);
        } catch (e) {
            console.log('Lỗi load membership:', e?.response?.data || e.message);
            setMembership(null);
        } finally {
            setVipLoading(false);
        }
    };

    useEffect(() => {
        if (isFocused) {
            fetchProfile();
            fetchMembership();
        }
    }, [isFocused]);

    const displayName = useMemo(() => {
        const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
        if (fullName) return fullName;
        if (profile?.email?.trim()?.length > 0) return profile.email;
        return profile?.username || 'Người dùng';
    }, [profile]);

    const avatarUri = profile?.anh_dai_dien?.trim() ? profile.anh_dai_dien : DEFAULT_AVATAR;
    const phoneText = (profile?.so_dien_thoai || profile?.phone || '').toString().trim();
    const cccdText = (profile?.cccd_number || profile?.cccd || profile?.so_cccd || '').toString().trim();

    const isVip = !!membership?.is_vip;

    const startUpgradeVip = async (planCode, planLabel) => {
        try {
            setUpgradeLoading(true);

            const res = await client.post(ENDPOINTS.MEMBERSHIP_UPGRADE_INIT, {
                plan_code: planCode,
            });

            const data = res.data || {};
            const qr = data.qr_image_url;
            const note = data.transfer_note;
            const amount = data.amount_vnd;

            Alert.alert(
                'Nâng cấp VIP',
                `Gói: ${planLabel}\nSố tiền: ${amount ? `${amount} VND` : '—'}\nNội dung CK: ${note || '—'}\n\nMở QR để thanh toán?`,
                [
                    { text: 'Đóng', style: 'cancel' },
                    {
                        text: 'Mở QR',
                        onPress: async () => {
                            if (qr) {
                                // qr_image_url của BE là một URL VietQR → mở bằng browser
                                await Linking.openURL(qr);
                            } else {
                                Alert.alert('Lỗi', 'Không có QR URL từ server.');
                            }
                        },
                    },
                ]
            );
        } catch (e) {
            console.log('upgrade vip error:', e?.response?.data || e.message);
            Alert.alert('Lỗi', e?.response?.data?.detail || 'Không khởi tạo được yêu cầu nâng cấp VIP.');
        } finally {
            setUpgradeLoading(false);
        }
    };

    const chooseVipPlan = () => {
        setVipModalVisible(true);
    };

    return (
        <ScrollView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ alignItems: 'center' }}>
                    <Image source={{ uri: avatarUri }} style={styles.avatar} />

                    <TouchableOpacity
                        style={styles.editIcon}
                        onPress={() => navigation.navigate('EditProfile', { profile })}
                        disabled={!profile}
                    >
                        <Ionicons name="pencil" size={16} color="#fff" />
                    </TouchableOpacity>

                    <Text style={styles.emailText}>{displayName}</Text>

                    <View style={styles.badgeRow}>
                        {vipLoading ? (
                            <View style={[styles.badge, { backgroundColor: '#EEE' }]}>
                                <Text style={[styles.badgeText, { color: '#333' }]}>Đang kiểm tra VIP...</Text>
                            </View>
                        ) : isVip ? (
                            <View style={[styles.badge, { backgroundColor: '#F4B400' }]}>
                                <Ionicons name="sparkles" size={14} color="#000" />
                                <Text style={[styles.badgeText, { color: '#000' }]}>
                                    VIP • {membership?.plan_name || 'Gói VIP'}
                                </Text>
                            </View>
                        ) : (
                            <View style={[styles.badge, { backgroundColor: '#EEE' }]}>
                                <Text style={[styles.badgeText, { color: '#333' }]}>Tài khoản thường</Text>
                            </View>
                        )}
                    </View>

                    {isVip ? (
                        <Text style={styles.followText}>
                            Hết hạn: {membership?.expired_at ? String(membership.expired_at) : '—'} • Còn{' '}
                            {membership?.remaining_days ?? 0} ngày
                        </Text>
                    ) : (
                        <Text style={styles.followText}>Người theo dõi 0 • Đang theo dõi 0</Text>
                    )}

                    <TouchableOpacity
                        style={[styles.vipButton, upgradeLoading && { opacity: 0.7 }]}
                        onPress={chooseVipPlan}
                        disabled={upgradeLoading}
                    >
                        {upgradeLoading ? (
                            <ActivityIndicator />
                        ) : (
                            <>
                                <Ionicons name="flash-outline" size={18} color="#fff" />
                                <Text style={styles.vipButtonText}>{isVip ? 'Gia hạn VIP' : 'Nâng cấp VIP'}</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <Modal
                transparent
                visible={vipModalVisible}
                animationType="fade"
                onRequestClose={() => setVipModalVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setVipModalVisible(false)} />
                <View style={styles.modalSheet}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Gia hạn VIP</Text>
                        <TouchableOpacity onPress={() => setVipModalVisible(false)} style={styles.modalClose}>
                            <Ionicons name="close" size={18} color="#111" />
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.modalSub}>
                        Chọn gói và xem ưu đãi bạn nhận được.
                    </Text>

                    <View style={styles.planCard}>
                        <Text style={styles.planTitle}>Gói 1 tháng</Text>
                        <Text style={styles.planPrice}>Thời hạn: 30 ngày</Text>
                        <Text style={styles.planBenefit}>• Bump tối đa 10 lượt/ngày</Text>
                        <Text style={styles.planBenefit}>• Ưu tiên hiển thị so với tin thường</Text>
                        <Text style={styles.planBenefit}>• Hỗ trợ đăng nhiều ảnh hơn</Text>
                        <TouchableOpacity
                            style={styles.planBtn}
                            onPress={() => {
                                setVipModalVisible(false);
                                startUpgradeVip('AGENT_1M', '1 tháng');
                            }}
                        >
                            <Text style={styles.planBtnText}>Chọn gói 1 tháng</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.planCard}>
                        <Text style={styles.planTitle}>Gói 3 tháng</Text>
                        <Text style={styles.planPrice}>Thời hạn: 90 ngày</Text>
                        <Text style={styles.planBenefit}>• Bump tối đa 20 lượt/ngày</Text>
                        <Text style={styles.planBenefit}>• Ưu tiên hiển thị cao hơn</Text>
                        <Text style={styles.planBenefit}>• Hỗ trợ đăng nhiều ảnh hơn</Text>
                        <Text style={styles.planBenefit}>• Tiết kiệm chi phí so với 1 tháng</Text>
                        <TouchableOpacity
                            style={styles.planBtn}
                            onPress={() => {
                                setVipModalVisible(false);
                                startUpgradeVip('AGENT_3M', '3 tháng');
                            }}
                        >
                            <Text style={styles.planBtnText}>Chọn gói 3 tháng</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Loading */}
            {loading && (
                <View style={{ paddingVertical: 20 }}>
                    <ActivityIndicator />
                </View>
            )}

            {/* Card info */}
            <View style={styles.card}>
                <View style={styles.rowBetween}>
                    <Text style={styles.cardTitle}>Thông tin tài khoản</Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Tên đăng nhập</Text>
                    <Text style={styles.infoValue}>{profile?.username || 'Chưa cập nhật'}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Họ</Text>
                    <Text style={styles.infoValue}>{profile?.first_name?.trim() ? profile.first_name : 'Chưa cập nhật'}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Tên</Text>
                    <Text style={styles.infoValue}>{profile?.last_name?.trim() ? profile.last_name : 'Chưa cập nhật'}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{profile?.email || 'Chưa cập nhật'}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Số điện thoại</Text>
                    <Text style={styles.infoValue}>{phoneText ? phoneText : 'Chưa cập nhật'}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Số CCCD</Text>
                    <Text style={styles.infoValue}>{cccdText ? cccdText : 'Chưa cập nhật'}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Địa chỉ</Text>
                    <Text style={styles.infoValue}>{profile?.address?.trim() ? profile.address : 'Chưa cập nhật'}</Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Giới thiệu</Text>
                    <Text style={styles.infoValue}>{profile?.bio?.trim() ? profile.bio : 'Chưa cập nhật'}</Text>
                </View>
            </View>

            {/* Menu */}
            <View style={styles.menu}>
                <Text style={styles.menuHeader}>Tiện ích</Text>


                <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() =>
                        navigation.navigate('VipOrderHistory', {
                            userId: profile?.id || profile?.user_id || profile?.userId,
                        })
                    }
                >
                    <Ionicons name="receipt-outline" size={22} color="#333" />
                    <Text style={styles.menuText}>Lịch sử nâng cấp VIP</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>


                <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('Favorites')}>
                    <Ionicons name="heart-outline" size={22} color="#333" />
                    <Text style={styles.menuText}>Tin đăng đã lưu</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('ChangePassword')}>
                    <Ionicons name="key-outline" size={22} color="#333" />
                    <Text style={styles.menuText}>Đổi mật khẩu</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>

                {/* ✅ “Đánh giá về tôi” = thống kê tất cả đánh giá của tài khoản này */}
                <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => navigation.navigate('MyReviews')}
                >
                    <Ionicons name="star-outline" size={22} color="#333" />
                    <Text style={styles.menuText}>Đánh giá của tôi</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.menuItem, { marginTop: 10 }]} onPress={logout}>
                    <Ionicons name="log-out-outline" size={22} color="#E53935" />
                    <Text style={[styles.menuText, { color: '#E53935' }]}>Đăng xuất</Text>
                    <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },

    header: { padding: 16, paddingTop: 22, alignItems: 'center' },
    avatar: { width: 110, height: 110, borderRadius: 55 },

    editIcon: {
        position: 'absolute',
        right: 0,
        top: 78,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F4B400',
        alignItems: 'center',
        justifyContent: 'center',
    },

    emailText: { marginTop: 12, fontSize: 22, fontWeight: '800', color: '#000' },
    followText: { marginTop: 6, fontSize: 14, color: '#666', textAlign: 'center' },

    badgeRow: { marginTop: 10, flexDirection: 'row', gap: 8 },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
    },
    badgeText: { fontWeight: '800', fontSize: 12 },

    vipButton: {
        marginTop: 12,
        backgroundColor: '#111',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    vipButtonText: { color: '#fff', fontWeight: '800' },

    card: {
        marginHorizontal: 16,
        marginTop: 16,
        padding: 14,
        borderRadius: 14,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#EEE',
    },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
    cardTitle: { fontSize: 16, fontWeight: '800', color: '#333' },

    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    infoLabel: { fontSize: 14, color: '#666' },
    infoValue: { fontSize: 14, color: '#111', maxWidth: '60%', textAlign: 'right' },

    menu: { marginTop: 18, paddingHorizontal: 16, paddingBottom: 24 },
    menuHeader: { fontSize: 16, fontWeight: '800', color: '#666', marginBottom: 10 },

    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
    },
    menuText: { flex: 1, marginLeft: 12, fontSize: 16, color: '#333' },

    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
    },
    modalSheet: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 24,
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#EEE',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#111' },
    modalClose: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3F3F3',
    },
    modalSub: { marginTop: 6, color: '#666' },

    planCard: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#EEE',
        backgroundColor: '#fff',
    },
    planTitle: { fontSize: 16, fontWeight: '800', color: '#111' },
    planPrice: { marginTop: 4, color: '#666' },
    planBenefit: { marginTop: 4, color: '#444' },
    planBtn: {
        marginTop: 10,
        backgroundColor: '#111',
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    planBtnText: { color: '#fff', fontWeight: '800' },
});
