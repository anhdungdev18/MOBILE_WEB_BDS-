// src/navigation/MainTabNavigator.js
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useContext } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthContext } from '../context/AuthContext';

import ManagePostsScreen from '../screens/Post/ManagePostsScreen';
import HomeStack from './HomeStack';
import PostStack from './PostStack';
import ProfileStack from './ProfileStack';

const Tab = createBottomTabNavigator();

function RequireAuth({ children, message }) {
    const { userToken } = useContext(AuthContext);
    const navigation = useNavigation();

    if (userToken) return children;

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text style={{ fontSize: 16, marginBottom: 20, textAlign: 'center' }}>
                {message || 'Bạn cần đăng nhập để sử dụng chức năng này.'}
            </Text>

            <TouchableOpacity
                style={{ backgroundColor: '#FFB800', padding: 12, borderRadius: 8, width: '70%', marginBottom: 10 }}
                onPress={() => navigation.navigate('Login')}
            >
                <Text style={{ textAlign: 'center', fontWeight: 'bold' }}>Đăng nhập</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={{ borderColor: '#FFB800', borderWidth: 1, padding: 12, borderRadius: 8, width: '70%' }}
                onPress={() => navigation.navigate('Register')}
            >
                <Text style={{ textAlign: 'center', fontWeight: 'bold', color: '#FFB800' }}>Đăng ký</Text>
            </TouchableOpacity>
        </View>
    );
}

function ChatScreen() {
    return (
        <RequireAuth message="Bạn cần đăng nhập để dùng Chat.">
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text>Chat (sau này nối realtime/chat server)</Text>
            </View>
        </RequireAuth>
    );
}

function ManagePostsGate() {
    return (
        <RequireAuth message="Bạn cần đăng nhập để quản lý tin đã đăng.">
            <ManagePostsScreen />
        </RequireAuth>
    );
}

function AccountGate() {
    return (
        <RequireAuth message="Bạn cần đăng nhập để xem tài khoản, tin đã lưu, chỉnh sửa hồ sơ.">
            <ProfileStack />
        </RequireAuth>
    );
}

export default function MainTabNavigator() {
    const insets = useSafeAreaInsets();

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: '#FFB800',
                tabBarInactiveTintColor: 'gray',
                tabBarStyle: {
                    height: 60 + insets.bottom,
                    paddingBottom: Math.max(6, insets.bottom),
                    paddingTop: 4,
                    borderTopWidth: 0.5,
                    borderTopColor: '#ddd',
                },
                tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;

                    if (route.name === 'Trang chủ') iconName = focused ? 'home' : 'home-outline';
                    else if (route.name === 'Quản lý tin') iconName = focused ? 'pricetag' : 'pricetag-outline';
                    else if (route.name === 'Chat') iconName = focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
                    else if (route.name === 'Tài khoản') iconName = focused ? 'person' : 'person-outline';

                    if (route.name === 'Đăng tin') {
                        return (
                            <View
                                style={{
                                    backgroundColor: '#FFB800',
                                    width: 54,
                                    height: 54,
                                    borderRadius: 27,
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    marginBottom: 20,
                                    elevation: 5,
                                }}
                            >
                                <Ionicons name="add" size={32} color="#000" />
                            </View>
                        );
                    }

                    return <Ionicons name={iconName} size={size} color={color} />;
                },
            })}
        >
            {/* ✅ Public: cho lướt bài đăng khi chưa login */}
            <Tab.Screen name="Trang chủ" component={HomeStack} />

            {/* ✅ Require login */}
            <Tab.Screen name="Quản lý tin" component={ManagePostsGate} />
            <Tab.Screen
                name="Đăng tin"
                component={PostStack}
                options={{ tabBarLabel: 'Đăng tin' }}
                listeners={({ navigation }) => ({
                    tabPress: (e) => {
                        // ✅ 1) CHẶN behavior mặc định (nếu không chặn, nó sẽ restore state cũ của stack)
                        e.preventDefault();

                        // ✅ 2) Luôn ép CreatePost về CREATE + ghi đè params cũ
                        navigation.navigate({
                            name: 'Đăng tin',
                            params: {
                                screen: 'CreatePost',
                                params: {
                                    mode: 'create',
                                    postId: undefined,
                                    initialPost: undefined,
                                    draft: undefined,
                                    pickedLocation: undefined,
                                },
                            },
                            merge: false, // ✅ cực quan trọng: không merge với params edit cũ
                        });
                    },
                })}
            />

            <Tab.Screen name="Chat" component={ChatScreen} />
            <Tab.Screen name="Tài khoản" component={AccountGate} />
        </Tab.Navigator>
    );
}
