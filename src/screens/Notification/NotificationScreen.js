import { Ionicons } from '@expo/vector-icons';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function NotificationScreen({ navigation }) {
    // Dữ liệu thông báo giả
    const notifications = [
        { id: '1', title: 'Khuyến mãi nạp Đồng Tốt', desc: 'Nạp ngay hôm nay để nhận thêm 20% giá trị.', time: '2 giờ trước', isNew: true },
        { id: '2', title: 'Tin đăng của bạn sắp hết hạn', desc: 'Tin "Bán nhà quận 1" sẽ hết hạn vào ngày mai.', time: '1 ngày trước', isNew: false },
        { id: '3', title: 'Cập nhật chính sách bảo mật', desc: 'Chúng tôi vừa cập nhật điều khoản sử dụng.', time: '3 ngày trước', isNew: false },
    ];

    const renderItem = ({ item }) => (
        <View style={[styles.item, item.isNew && styles.newItem]}>
            <View style={styles.iconContainer}>
                <Ionicons name="notifications" size={24} color={item.isNew ? "#FFB800" : "#999"} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.desc}>{item.desc}</Text>
                <Text style={styles.time}>{item.time}</Text>
            </View>
            {item.isNew && <View style={styles.dot} />}
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="black" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Thông báo</Text>
                <View style={{ width: 24 }} />
            </View>

            <FlatList
                data={notifications}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 15 }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#eee' },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },

    item: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', alignItems: 'flex-start' },
    newItem: { backgroundColor: '#fffcf0' }, // Màu nền nhạt cho tin mới
    iconContainer: { marginRight: 15, marginTop: 2 },
    title: { fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
    desc: { fontSize: 13, color: '#555', lineHeight: 18 },
    time: { fontSize: 11, color: '#999', marginTop: 6 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'red', position: 'absolute', right: 10, top: 20 }
});