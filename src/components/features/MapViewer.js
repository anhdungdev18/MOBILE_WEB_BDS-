// src/components/features/MapViewer.js
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

const isWeb = Platform.OS === 'web';
const maps = !isWeb ? require('react-native-maps') : null;
const MapView = maps ? maps.default : null;
const Marker = maps ? maps.Marker : null;

const MapViewer = ({ location, title }) => {
    if (!location) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={{ color: 'gray' }}>Không có thông tin bản đồ</Text>
            </View>
        );
    }

    if (isWeb) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={{ color: 'gray', textAlign: 'center' }}>
                    Bản đồ chưa hỗ trợ trên web. Hãy mở trên Android emulator hoặc thiết bị thật.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <MapView
                style={styles.map}
                initialRegion={{
                    ...location,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                }}
                scrollEnabled={false} // Chỉ xem, không cho trượt lung tung
            >
                <Marker coordinate={location} title={title} />
            </MapView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { height: 200, borderRadius: 10, overflow: 'hidden', marginVertical: 10 },
    map: { flex: 1 },
    emptyContainer: { height: 100, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 10 }
});

export default MapViewer;
