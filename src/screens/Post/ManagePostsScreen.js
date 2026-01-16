// src/screens/Post/ManagePostsScreen.js
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import client from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";

const POST_STATUS = {
    HIDDEN: 1,
    PUBLISHED: 2,
    ARCHIVED: 3,
};

const safeLower = (v) => (v == null ? "" : String(v)).toLowerCase().trim();

function normalizeApproval(v) {
    const s = safeLower(v);
    if (
        s.includes("approve") ||
        s.includes("duyệt") ||
        s === "approved" ||
        s === "1" ||
        s === "true"
    )
        return "approved";
    if (s.includes("reject") || s.includes("từ chối") || s === "rejected") return "rejected";
    if (
        s.includes("pending") ||
        s.includes("wait") ||
        s.includes("review") ||
        s.includes("chờ") ||
        s === "0" ||
        s === "false"
    )
        return "pending";
    return s || "unknown";
}

function normalizePostStatus(v) {
    if (v && typeof v === "object") {
        const id = Number(v?.id);
        const name = safeLower(v?.name || v?.title);
        if (!Number.isNaN(id)) {
            if (id === POST_STATUS.HIDDEN) return "hidden";
            if (id === POST_STATUS.PUBLISHED) return "active";
            if (id === POST_STATUS.ARCHIVED) return "archived";
        }
        if (name.includes("hidden") || name.includes("ẩn")) return "hidden";
        if (name.includes("publish")) return "active";
        if (name.includes("archived") || name.includes("lưu")) return "archived";
        return "unknown";
    }

    if (typeof v === "number") {
        if (v === POST_STATUS.HIDDEN) return "hidden";
        if (v === POST_STATUS.PUBLISHED) return "active";
        if (v === POST_STATUS.ARCHIVED) return "archived";
    }

    const s = safeLower(v);
    if (s.includes("hidden") || s.includes("hide") || s.includes("ẩn") || s === "0") return "hidden";
    if (s.includes("archived") || s.includes("lưu")) return "archived";
    if (s.includes("publish") || s.includes("active") || s.includes("show") || s === "1") return "active";
    return s || "unknown";
}

function getFirstImageUrl(post) {
    const imgs = post?.images;
    if (!Array.isArray(imgs) || imgs.length === 0) return null;
    const u = imgs[0]?.image_url || imgs[0]?.url || imgs[0]?.image || null;
    return u ? String(u) : null;
}

function getImagesCount(post) {
    const imgs = post?.images;
    return Array.isArray(imgs) ? imgs.length : 0;
}

function formatPriceVND(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return "";
    try {
        return new Intl.NumberFormat("vi-VN").format(num) + " đ";
    } catch {
        return String(num) + " đ";
    }
}

export default function ManagePostsScreen() {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const insets = useSafeAreaInsets();

    const [posts, setPosts] = useState([]);
    const [activeTab, setActiveTab] = useState("all");
    const [query, setQuery] = useState("");

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async (opts = { silent: false }) => {
        if (!opts?.silent) setLoading(true);
        try {
            const res = await client.get(ENDPOINTS.MY_POSTS);
            const data = res?.data;
            const items = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
            setPosts(items);
        } catch (e) {
            console.log("Fetch MY_POSTS error:", e?.response?.status, e?.response?.data || e?.message);
            Alert.alert("Lỗi", "Không tải được danh sách tin của bạn. Vui lòng thử lại.");
        } finally {
            if (!opts?.silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isFocused) load();
    }, [isFocused, load]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await load({ silent: true });
        } finally {
            setRefreshing(false);
        }
    }, [load]);

    const counts = useMemo(() => {
        const c = { all: posts.length, approved: 0, pending: 0, rejected: 0, hidden: 0 };
        for (const p of posts) {
            const appr = normalizeApproval(p.approval_status ?? p.approvalStatus);
            const st = normalizePostStatus(p.post_status ?? p.postStatus ?? p.post_status_id);
            if (st === "hidden") c.hidden += 1;
            if (appr === "approved") c.approved += 1;
            if (appr === "pending") c.pending += 1;
            if (appr === "rejected") c.rejected += 1;
        }
        return c;
    }, [posts]);

    const filtered = useMemo(() => {
        const q = safeLower(query).trim();
        return posts
            .filter((p) => {
                const appr = normalizeApproval(p.approval_status ?? p.approvalStatus);
                const st = normalizePostStatus(p.post_status ?? p.postStatus ?? p.post_status_id);

                if (activeTab === "approved") return appr === "approved" && st !== "hidden";
                if (activeTab === "pending") return appr === "pending" && st !== "hidden";
                if (activeTab === "rejected") return appr === "rejected";
                if (activeTab === "hidden") return st === "hidden";
                return true;
            })
            .filter((p) => {
                if (!q) return true;
                const title = safeLower(p.title);
                const id = safeLower(p.id);
                return title.includes(q) || id.includes(q);
            });
    }, [posts, activeTab, query]);

    // ✅ SỬA: mở CreatePostScreen và truyền dữ liệu cũ
    const handleEdit = useCallback(
        (post) => {
            navigation.navigate("Đăng tin", {
                screen: "CreatePost",
                params: {
                    mode: "edit",
                    postId: post?.id,
                    initialPost: post,
                },
            });
        },
        [navigation]
    );

    // ✅ ẨN/HIỆN: đúng endpoint owner-status
    const handleToggleHide = useCallback(
        async (post) => {
            const current = normalizePostStatus(post?.post_status ?? post?.postStatus ?? post?.post_status_id);
            const nextId = current === "hidden" ? POST_STATUS.PUBLISHED : POST_STATUS.HIDDEN;

            try {
                await client.patch(ENDPOINTS.POST_OWNER_STATUS(post.id), { post_status_id: nextId });

                // update UI ngay (không cần đợi reload)
                setPosts((prev) =>
                    prev.map((p) =>
                        p.id === post.id
                            ? {
                                ...p,
                                post_status_id: nextId,
                                post_status:
                                    nextId === POST_STATUS.HIDDEN
                                        ? "Hidden"
                                        : nextId === POST_STATUS.PUBLISHED
                                            ? "Published"
                                            : "Archived",
                            }
                            : p
                    )
                );

                Alert.alert("Thành công", nextId === POST_STATUS.HIDDEN ? "Đã ẩn tin." : "Đã hiện lại tin.");
            } catch (e) {
                console.log("Toggle hide error:", e?.response?.status, e?.response?.data || e?.message);
                Alert.alert("Lỗi", "Không đổi trạng thái ẩn/hiện được.");
            }
        },
        [setPosts]
    );

    // ✅ XÓA: đúng endpoint posts/<id> (KHÔNG có dấu / cuối)
    const openDetail = useCallback(
        (postId) => {
            if (!postId) return;
            try {
                navigation.navigate("Trang chủ", {
                    screen: "PostDetail",
                    params: { postId },
                });
            } catch (e) {
                navigation.navigate("PostDetail", { postId });
            }
        },
        [navigation]
    );

    const handleDelete = useCallback(
        async (post) => {
            Alert.alert("Xác nhận", "Bạn có chắc muốn xóa tin này?", [
                { text: "Hủy", style: "cancel" },
                {
                    text: "Xóa",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await client.delete(ENDPOINTS.POST_DETAIL(post.id)); // ✅ no trailing slash
                            setPosts((prev) => prev.filter((p) => p.id !== post.id));
                            Alert.alert("Thành công", "Đã xóa tin.");
                        } catch (e) {
                            console.log("Delete error:", e?.response?.status, e?.response?.data || e?.message);
                            Alert.alert("Lỗi", "Không xóa được tin.");
                        }
                    },
                },
            ]);
        },
        [setPosts]
    );

    const renderItem = ({ item }) => {
        const appr = normalizeApproval(item.approval_status ?? item.approvalStatus);
        const st = normalizePostStatus(item.post_status ?? item.postStatus ?? item.post_status_id);

        const thumb = getFirstImageUrl(item);
        const imgCount = getImagesCount(item);

        const canToggleHide = appr === "approved";
        const canEdit = true; // bạn muốn sửa luôn => mở cho tất cả
        const canDelete = true; // bạn muốn xóa luôn => mở cho tất cả

        return (
            <View style={styles.card}>
                <TouchableOpacity style={styles.row} activeOpacity={0.85} onPress={() => openDetail(item?.id)}>
                    <View style={styles.thumbWrap}>
                        {thumb ? (
                            <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
                        ) : (
                            <View style={styles.thumbPlaceholder}>
                                <Ionicons name="image-outline" size={22} color="#777" />
                                <Text style={styles.thumbPlaceholderText}>No image</Text>
                            </View>
                        )}

                        {imgCount > 1 ? (
                            <View style={styles.badge}>
                                <Ionicons name="images-outline" size={14} color="#fff" />
                                <Text style={styles.badgeText}>{imgCount}</Text>
                            </View>
                        ) : null}
                    </View>

                    <View style={styles.info}>
                        <Text style={styles.title} numberOfLines={2}>
                            {item?.title || "(Không có tiêu đề)"}
                        </Text>

                        <Text style={styles.meta}>
                            ID: <Text style={styles.metaStrong}>{item?.id}</Text>
                        </Text>

                        <Text style={styles.meta}>
                            Giá: <Text style={styles.metaStrong}>{formatPriceVND(item?.price)}</Text> · Diện tích:{" "}
                            <Text style={styles.metaStrong}>{item?.area || 0} m²</Text>
                        </Text>

                        <View style={styles.statusRow}>
                            <View style={[styles.pill, appr === "approved" ? styles.pillOk : appr === "pending" ? styles.pillWarn : styles.pillBad]}>
                                <Text style={styles.pillText}>
                                    {appr === "approved" ? "Đã duyệt" : appr === "pending" ? "Chờ duyệt" : appr === "rejected" ? "Từ chối" : "?"}
                                </Text>
                            </View>

                            <View style={[styles.pill, st === "hidden" ? styles.pillHidden : styles.pillOk]}>
                                <Text style={styles.pillText}>{st === "hidden" ? "Đã ẩn" : "Đang hiển thị"}</Text>
                            </View>
                        </View>
                    </View>
                </TouchableOpacity>

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.actionOutline]}
                        onPress={() => canEdit && handleEdit(item)}
                    >
                        <Ionicons name="create-outline" size={18} color="#111" />
                        <Text style={styles.actionText}>Sửa</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, styles.actionOutline]}
                        onPress={() => canToggleHide && handleToggleHide(item)}
                        disabled={!canToggleHide}
                    >
                        <Ionicons name={st === "hidden" ? "eye-outline" : "eye-off-outline"} size={18} color={canToggleHide ? "#111" : "#999"} />
                        <Text style={[styles.actionText, !canToggleHide && { color: "#999" }]}>
                            {st === "hidden" ? "Hiện" : "Ẩn"}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionBtn, styles.actionDanger]}
                        onPress={() => canDelete && handleDelete(item)}
                    >
                        <Ionicons name="trash-outline" size={18} color="#fff" />
                        <Text style={[styles.actionText, { color: "#fff" }]}>Xóa</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const TabBtn = ({ keyName, label }) => {
        const active = activeTab === keyName;
        const count = counts?.[keyName] ?? 0;
        return (
            <TouchableOpacity onPress={() => setActiveTab(keyName)} style={[styles.tab, active && styles.tabActive]}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {label} ({count})
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { paddingTop: Math.max(insets.top - 20, 0) }]} edges={["top", "left", "right"]}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Quản lý tin</Text>
            </View>

            <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={18} color="#777" />
                <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Tìm theo tiêu đề / ID..."
                    style={styles.searchInput}
                    placeholderTextColor="#999"
                />
            </View>

            <View style={styles.tabRow}>
                <TabBtn keyName="all" label="Tất cả" />
                <TabBtn keyName="approved" label="Đã duyệt" />
                <TabBtn keyName="pending" label="Chờ duyệt" />
                <TabBtn keyName="rejected" label="Từ chối" />
                <TabBtn keyName="hidden" label="Đã ẩn" />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator />
                    <Text style={{ marginTop: 8, color: "#666" }}>Đang tải...</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(item) => String(item?.id)}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Ionicons name="document-text-outline" size={32} color="#999" />
                            <Text style={{ marginTop: 8, color: "#777" }}>Không có bài đăng nào.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f5f5f5" },

    header: { paddingHorizontal: 16, paddingBottom: 10 },
    headerTitle: { fontSize: 20, fontWeight: "800", color: "#111" },

    searchWrap: {
        marginHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#fff",
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: "#eee",
    },
    searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: "#111" },

    tabRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, marginTop: 10, gap: 8 },
    tab: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#eee",
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 999,
    },
    tabActive: { backgroundColor: "#111", borderColor: "#111" },
    tabText: { fontSize: 12, color: "#333", fontWeight: "700" },
    tabTextActive: { color: "#fff" },

    card: {
        backgroundColor: "#fff",
        marginHorizontal: 16,
        marginTop: 12,
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: "#eee",
    },
    row: { flexDirection: "row", gap: 12 },

    thumbWrap: { width: 90, height: 90, borderRadius: 12, overflow: "hidden", backgroundColor: "#f0f0f0" },
    thumb: { width: "100%", height: "100%" },
    thumbPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
    thumbPlaceholderText: { marginTop: 4, fontSize: 11, color: "#777" },
    badge: {
        position: "absolute",
        right: 6,
        bottom: 6,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "rgba(0,0,0,0.72)",
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },

    info: { flex: 1 },
    title: { fontSize: 15, fontWeight: "800", color: "#111" },
    meta: { marginTop: 4, color: "#666", fontSize: 12 },
    metaStrong: { color: "#111", fontWeight: "800" },

    statusRow: { flexDirection: "row", gap: 8, marginTop: 8 },
    pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
    pillOk: { backgroundColor: "#111" },
    pillWarn: { backgroundColor: "#f4b400" },
    pillBad: { backgroundColor: "#ea4335" },
    pillHidden: { backgroundColor: "#666" },
    pillText: { color: "#fff", fontSize: 12, fontWeight: "800" },

    actions: { flexDirection: "row", gap: 10, marginTop: 12 },
    actionBtn: {
        flex: 1,
        flexDirection: "row",
        gap: 8,
        justifyContent: "center",
        alignItems: "center",
        paddingVertical: 10,
        borderRadius: 12,
    },
    actionOutline: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#ddd" },
    actionDanger: { backgroundColor: "#111" },
    actionText: { fontSize: 13, fontWeight: "800", color: "#111" },

    center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
});
