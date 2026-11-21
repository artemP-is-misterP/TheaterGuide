import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin, Info } from 'lucide-react-native';
import { THEATERS } from '@/constants/theaters';
import { useTheme } from '@/hooks/useTheme';

export default function TheaterListScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id: focusedId } = useLocalSearchParams<{ id?: string }>();

  const listRef = useRef<FlatList<(typeof THEATERS)[number]>>(null);

  // Прокрутка к театру, если пришли с карты по параметру id
  useEffect(() => {
    if (!focusedId) return;
    const index = THEATERS.findIndex(t => t.id === focusedId);
    if (index < 0) return;

    // Небольшая задержка, чтобы FlatList успел отрисоваться
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
    }, 250);
    return () => clearTimeout(timer);
  }, [focusedId]);

  const showOnMap = (theaterId: string) => {
    router.push({
      pathname: '/map',
      params: { focusTheaterId: theaterId, ts: Date.now().toString() },
    });
  };

  const renderItem = ({ item }: { item: (typeof THEATERS)[number] }) => {
    const isFocused = focusedId === item.id;
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderLeftColor: isFocused ? colors.info : colors.accent,
            borderWidth: isFocused ? 1 : 0,
            borderColor: isFocused ? colors.info : 'transparent',
          },
        ]}
      >
        {item.image ? (
          <Image source={item.image} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: colors.surfaceAlt }]}>
            <Info size={32} color={colors.textSecondary} />
          </View>
        )}

        <View style={styles.cardBody}>
          <Text style={[styles.name, { color: colors.accent }]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.desc, { color: colors.textSecondary }]} numberOfLines={3}>
            {item.description}
          </Text>

          <TouchableOpacity
            style={[styles.mapButton, { backgroundColor: colors.surfaceAlt }]}
            onPress={() => showOnMap(item.id)}
          >
            <MapPin size={16} color={colors.accent} />
            <Text style={[styles.mapButtonText, { color: colors.accent }]}>Показать на карте</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const getItemLayout = useCallback(
    (_: ArrayLike<(typeof THEATERS)[number]> | null | undefined, index: number) => {
      // Оценка высоты карточки: фото 160 + тело ~160 + отступ 16
      const ITEM_HEIGHT = 336;
      return { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index };
    },
    [],
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={listRef}
        data={THEATERS}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={(info) => {
          // Если оценка высоты не совпала, пробуем ещё раз с задержкой
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.2 });
          }, 300);
        }}
        ListHeaderComponent={
          <Text style={[styles.header, { color: colors.text }]}>
            Театры Санкт-Петербурга
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 32 },
  header: { fontSize: 22, fontWeight: '700', marginBottom: 16, marginTop: 40 },

  card: {
    borderRadius: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  image: { width: '100%', height: 160 },
  imagePlaceholder: { justifyContent: 'center', alignItems: 'center' },

  cardBody: { padding: 16 },
  name: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  desc: { fontSize: 14, lineHeight: 20, marginBottom: 12 },

  mapButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10,
  },
  mapButtonText: { fontWeight: '600', marginLeft: 6, fontSize: 13 },
});
