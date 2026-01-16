// src/navigation/ProfileStack.js
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';

import ChangePasswordScreen from '../screens/Profile/ChangePasswordScreen';
import FavoritesScreen from '../screens/Profile/FavoritesScreen';
import MyReviewsScreen from '../screens/Profile/MyReviewsScreen';
import VipOrderHistoryScreen from '../screens/Profile/VipOrderHistoryScreen';

const Stack = createNativeStackNavigator();

export default function ProfileStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="ProfileHome" component={ProfileScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            <Stack.Screen name="MyReviews" component={MyReviewsScreen} />
            <Stack.Screen name="Favorites" component={FavoritesScreen} />
            <Stack.Screen name="VipOrderHistory" component={VipOrderHistoryScreen} />
        </Stack.Navigator>
    );
}
