import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/Home/HomeScreen';
import PostDetailScreen from '../screens/Home/PostDetailScreen';
import NotificationScreen from '../screens/Notification/NotificationScreen';
import OwnerProfileScreen from '../screens/Profile/OwnerProfileScreen';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="PostDetail" component={PostDetailScreen} />
            <Stack.Screen name="Notifications" component={NotificationScreen} />
            <Stack.Screen name="OwnerProfile" component={OwnerProfileScreen} />
        </Stack.Navigator>
    );
}
