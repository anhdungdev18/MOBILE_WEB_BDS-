import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useContext } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { AuthContext } from '../context/AuthContext';
import CreatePostScreen from '../screens/Post/CreatePostScreen';
import PickLocationScreen from '../screens/Post/PickLocationScreen';

const Stack = createNativeStackNavigator();

function RequireAuthScreen({ children, message, navigation }) {
    const { userToken } = useContext(AuthContext);

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

function CreatePostGate(props) {
    return (
        <RequireAuthScreen message="Bạn cần đăng nhập để đăng tin." navigation={props.navigation}>
            <CreatePostScreen {...props} />
        </RequireAuthScreen>
    );
}

function PickLocationGate(props) {
    return (
        <RequireAuthScreen message="Bạn cần đăng nhập để chọn vị trí." navigation={props.navigation}>
            <PickLocationScreen {...props} />
        </RequireAuthScreen>
    );
}

export default function PostStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="CreatePost" component={CreatePostGate} />
            <Stack.Screen name="PickLocation" component={PickLocationGate} />
        </Stack.Navigator>
    );
}
