import React, { useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Route, Navigation } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';
import { HAS_SEEN_ONBOARDING_KEY } from '@/constants/keys';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  // Функция для завершения онбординга
  const finishOnboarding = async () => {
    try {
      await AsyncStorage.setItem(HAS_SEEN_ONBOARDING_KEY, 'true');
      router.replace('/map');
    } catch (e) {
      console.warn('Ошибка сохранения статуса онбординга', e);
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Логотип / Иконка приложения */}
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.appIcon}
          resizeMode="contain"
        />

        {/* Заголовок */}
        <Text style={[styles.title, { color: colors.accent }]}>
          TheaterGuide
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Ваш персональный гид по театрам Санкт-Петербурга
        </Text>

        {/* Список возможностей */}
        <View style={styles.featureList}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIconContainer, { backgroundColor: colors.surfaceAlt }]}>
              <MapPin size={24} color={colors.accent} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={[styles.featureTitle, { color: colors.text }]}>
                Исследуйте театры
              </Text>
              <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                Узнавайте историю и факты, просто проходя мимо зданий.
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconContainer, { backgroundColor: colors.surfaceAlt }]}>
              <Route size={24} color={colors.accent} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={[styles.featureTitle, { color: colors.text }]}>
                Стройте маршруты
              </Text>
              <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                Выбирайте театры на карте и создавайте собственные экскурсии.
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIconContainer, { backgroundColor: colors.surfaceAlt }]}>
              <Navigation size={24} color={colors.accent} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={[styles.featureTitle, { color: colors.text }]}>
                Навигатор в кармане
              </Text>
              <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
                Следуйте по маршруту с подсказками направления и расстояния.
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Кнопка "Начать" */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: colors.accent }]}
          onPress={finishOnboarding}
        >
          <Text style={[styles.startButtonText, { color: colors.background }]}>
            Начать путешествие
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  appIcon: {
    width: width * 0.35,
    height: width * 0.35,
    borderRadius: 32,
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
  },
  featureList: {
    width: '100%',
    gap: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    padding: 24,
    top: 50,
    position: "relative"
  },
  startButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
