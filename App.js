// App.js
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useContext } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AuthContext, AuthProvider } from './src/context/AuthContext';

import MainTabNavigator from './src/navigation/MainTabNavigator';

// Auth screens
import ForgotPasswordScreen from './src/screens/Auth/ForgotPasswordScreen';
import LoginScreen from './src/screens/Auth/LoginScreen';
import RegisterScreen from './src/screens/Auth/RegisterScreen';

// Profile screens (nếu bạn navigate ra ngoài tab)
import EditProfileScreen from './src/screens/Profile/EditProfileScreen';

const Stack = createNativeStackNavigator();

function RootNavigator() {
    const { authReady } = useContext(AuthContext);

    // ✅ Chờ hydrate token xong (để gate private ổn định)
    if (!authReady) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#FFB800" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {/* ✅ Guest vẫn vào app xem bài */}
                <Stack.Screen name="MainTabs" component={MainTabNavigator} />

                {/* ✅ Auth routes để các tab private điều hướng sang */}
                <Stack.Screen name="Login" component={LoginScreen} />
                <Stack.Screen name="Register" component={RegisterScreen} />
                <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />

                {/* (tuỳ bạn dùng) */}
                <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <RootNavigator />
        </AuthProvider>
    );
}
