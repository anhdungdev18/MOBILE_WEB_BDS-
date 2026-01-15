// src/screens/Posts/PostHubScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const categories = ['Căn hộ/Chung cư', 'Nhà ở', 'Đất', 'Văn phòng/Mặt bằng'];

const cityCards = [
    { id: 1, name: 'TP Hồ Chí Minh', posts: 3963 },
    { id: 2, name: 'Hà Nội', posts: 1354 },
];

export default function PostHubScreen() {
    const [tabType, setTabType] = useState('buy');

    const [activeCat, setActiveCat] = useState(categories[0]);

    return (
        <View style={styles.container}>
            {/* HEADER TRẮNG + SEARCH */}
            <View style={styles.header}>
                <TouchableOpacity>
                    <Ionicons name="arrow-back" size={22} color="#000" />
                </TouchableOpacity>

                <View style={styles.searchBar}>
                    <Ionicons name="search" size={18} color="#999" />
                    <TextInput
                        placeholder="Tìm bất động sản..."
                        placeholderTextColor="#aaa"
                        style={{ marginLeft: 8, flex: 1 }}
                    />
                </View>

                <TouchableOpacity style={{ marginLeft: 8 }}>
                    <Ionicons name="heart-outline" size={22} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity style={{ marginLeft: 8 }}>
                    <Ionicons name="notifications-outline" size={22} color="#000" />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* BẤT ĐỘNG SẢN THEO KHU VỰC */}
                <View style={{ paddingHorizontal: 15, paddingTop: 10 }}>
                    <Text style={styles.sectionTitle}>Bất động sản theo khu vực</Text>

                    {/* Mua bán / Cho thuê */}
                    <View style={styles.typeSwitch}>
                        <TouchableOpacity
                            style={[
                                styles.typeButton,
                                tabType === 'buy' && styles.typeButtonActive,
                            ]}
                            onPress={() => setTabType('buy')}
                        >
                            <Text
                                style={[
                                    styles.typeText,
                                    tabType === 'buy' && styles.typeTextActive,
                                ]}
                            >
                                Mua bán
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.typeButton,
                                tabType === 'rent' && styles.typeButtonActive,
                            ]}
                            onPress={() => setTabType('rent')}
                        >
                            <Text
                                style={[
                                    styles.typeText,
                                    tabType === 'rent' && styles.typeTextActive,
                                ]}
                            >
                                Cho thuê
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* CÁC LOẠI HÌNH BĐS */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ marginTop: 10 }}
                    >
                        {categories.map((c) => (
                            <TouchableOpacity
                                key={c}
                                style={[
                                    styles.catChip,
                                    activeCat === c && styles.catChipActive,
                                ]}
                                onPress={() => setActiveCat(c)}
                            >
                                <Text
                                    style={[
                                        styles.catText,
                                        activeCat === c && styles.catTextActive,
                                    ]}
                                >
                                    {c}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* THẺ THÀNH PHỐ */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ marginTop: 15 }}
                    >
                        {cityCards.map((city) => (
                            <View key={city.id} style={styles.cityCard}>
                                <View style={styles.cityImagePlaceholder} />
                                <View style={{ position: 'absolute', bottom: 10, left: 10 }}>
                                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                                        {city.name}
                                    </Text>
                                    <Text style={{ color: '#fff', fontSize: 12 }}>
                                        {city.posts.toLocaleString('vi-VN')} tin đăng
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* THAM KHẢO GIÁ BĐS (fake) */}
                <View style={{ paddingHorizontal: 15, paddingTop: 20 }}>
                    <Text style={styles.sectionTitle}>Tham khảo giá bất động sản</Text>
                    <Text style={styles.sectionSub}>
                        Cập nhật dữ liệu biến động giá mới nhất (demo).
                    </Text>

                    <View style={styles.priceCard}>
                        <View>
                            <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>
                                Thành phố Thủ Đức
                            </Text>
                            <Text style={{ fontSize: 12, color: '#555' }}>
                                Biến động giá trong 1 năm: <Text style={{ color: '#2e7d32' }}>+4,2%</Text>
                            </Text>
                            <Text style={{ fontSize: 12, color: '#555' }}>
                                Đơn giá phổ biến: 60,8 tr/m²
                            </Text>
                        </View>
                        <View style={styles.mapMock} />
                    </View>
                </View>

                {/* Tin mới đăng (mẫu đơn giản) */}
                <View style={{ paddingHorizontal: 15, paddingTop: 20, paddingBottom: 30 }}>
                    <Text style={styles.sectionTitle}>
                        Tin {tabType === 'buy' ? 'mua bán' : 'cho thuê'} mới đăng
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                        {[1, 2, 3].map((i) => (
                            <View key={i} style={styles.postCard}>
                                <View style={styles.postImage} />
                                <Text numberOfLines={2} style={styles.postTitle}>
                                    BĐS demo {i} – {tabType === 'buy' ? 'Bán' : 'Cho thuê'}
                                </Text>
                                <Text style={styles.postPrice}>
                                    {tabType === 'buy' ? '3,5 tỷ' : '10 triệu/tháng'}
                                </Text>
                                <Text style={styles.postArea}>70 m² • Quận 1, TP.HCM</Text>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 45,
        paddingHorizontal: 12,
        paddingBottom: 10,
        backgroundColor: '#fff',
    },
    searchBar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f1f1f1',
        borderRadius: 20,
        paddingHorizontal: 10,
        marginHorizontal: 8,
        height: 36,
    },

    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#222' },
    sectionSub: { fontSize: 12, color: '#555', marginTop: 4 },

    typeSwitch: {
        flexDirection: 'row',
        marginTop: 10,
        backgroundColor: '#eee',
        borderRadius: 20,
        padding: 3,
        alignSelf: 'flex-start',
    },
    typeButton: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16 },
    typeButtonActive: { backgroundColor: '#000' },
    typeText: { fontSize: 12, color: '#555' },
    typeTextActive: { color: '#fff', fontWeight: 'bold' },

    catChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 18,
        backgroundColor: '#f1f1f1',
        marginRight: 8,
    },
    catChipActive: {
        backgroundColor: '#000',
    },
    catText: { fontSize: 13, color: '#555' },
    catTextActive: { color: '#fff', fontWeight: 'bold' },

    cityCard: {
        width: 220,
        height: 130,
        borderRadius: 12,
        marginRight: 12,
        overflow: 'hidden',
        backgroundColor: '#ccc',
    },
    cityImagePlaceholder: {
        flex: 1,
        backgroundColor: '#90caf9',
    },

    priceCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginTop: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        elevation: 2,
    },
    mapMock: {
        width: 80,
        height: 60,
        borderRadius: 10,
        backgroundColor: '#e0e0e0',
    },

    postCard: {
        width: 180,
        borderRadius: 10,
        backgroundColor: '#fff',
        marginRight: 12,
        paddingBottom: 10,
        overflow: 'hidden',
        elevation: 2,
    },
    postImage: {
        height: 100,
        backgroundColor: '#ddd',
    },
    postTitle: {
        marginTop: 6,
        paddingHorizontal: 8,
        fontSize: 13,
        fontWeight: '500',
    },
    postPrice: {
        paddingHorizontal: 8,
        marginTop: 2,
        color: '#e53935',
        fontWeight: 'bold',
    },
    postArea: {
        paddingHorizontal: 8,
        fontSize: 11,
        color: '#555',
        marginTop: 2,
    },
});