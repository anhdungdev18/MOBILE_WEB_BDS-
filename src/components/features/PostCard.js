import { Ionicons } from '@expo/vector-icons';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const kingIcon = require('../../../assets/images/king.png');

const formatPrice = (price) => {
    if (price == null) return '—';
    try {
        return Number(price).toLocaleString('vi-VN') + ' đ';
    } catch {
        return String(price) + ' đ';
    }
};

export default function PostCard({ post, onPress, favMap, categoryName, onToggleFavorite }) {
    if (!post) return null;

    const title = post?.title || '—';
    const area = post?.area || post?.dien_tich || '—';
    const price = post?.price;

    const address =
        typeof post?.address === 'string'
            ? post.address
            : post?.address?.full || post?.address?.text || '';

    const txLabel = post?.post_type_id === 1 ? 'Bán' : post?.post_type_id === 2 ? 'Cho thuê' : '—';

    const images = post?.images || [];
    const thumb = images?.length > 0 ? images[0]?.url || images[0]?.image_url || images[0] : null;
    const isVip = Boolean(post?.owner_is_agent);

    const isFav = !!favMap?.[String(post?.id)];

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
            {isVip ? (
                <View style={styles.vipBadge}>
                    <Image source={kingIcon} style={styles.vipCrown} resizeMode="contain" />
                </View>
            ) : null}
            {/* Image */}
            <View style={styles.imageWrap}>
                {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.image} />
                ) : (
                    <View style={styles.imagePlaceholder}>
                        <Ionicons name="image-outline" size={28} color="#999" />
                    </View>
                )}
            </View>

            {/* Content */}
            <View style={styles.content}>
                <View style={styles.rowBetween}>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{txLabel}</Text>
                    </View>

                    <Text style={styles.price}>{formatPrice(price)}</Text>
                </View>

                <Text style={styles.title} numberOfLines={2}>
                    {title}
                </Text>

                {!!address && (
                    <Text style={styles.address} numberOfLines={1}>
                        {address}
                    </Text>
                )}

                <View style={styles.rowInfo}>
                    <Text style={styles.meta}>DT: {area} m²</Text>

                    {/* ✅ ĐÃ ĐỔI: Type -> Loại BĐS */}
                    <Text style={styles.meta}>Loại: {categoryName || '—'}</Text>
                </View>
            </View>

            {/* Favorite icon */}
            <TouchableOpacity style={styles.heartWrap} onPress={onToggleFavorite} activeOpacity={0.85}>
                <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? '#E53935' : '#111'} />
            </TouchableOpacity>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#EEE',
        padding: 10,
        marginBottom: 12,
        position: 'relative',
    },

    imageWrap: {
        width: '100%',
        height: 160,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#F3F3F3',
        position: 'relative',
    },
    image: { width: '100%', height: '100%' },
    imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    vipBadge: {
        position: 'absolute',
        top: -12,
        left: -14,
        width: 78,
        height: 54,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
    },
    vipCrown: {
        width: 78,
        height: 54,
        transform: [{ rotate: '-45deg' }],
    },

    content: { marginTop: 10 },

    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

    badge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#DDD',
    },
    badgeText: { fontWeight: '800', color: '#111' },

    price: { fontWeight: '900', fontSize: 16, color: '#111' },

    title: { marginTop: 8, fontWeight: '800', fontSize: 15, color: '#111' },

    address: { marginTop: 6, color: '#666' },

    rowInfo: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
    meta: { color: '#666', fontSize: 12 },

    heartWrap: {
        position: 'absolute',
        right: 10,
        top: 10,
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#EEE',
    },
});
