import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView,
  TextInput,
} from 'react-native';
import { YandexMapView, Marker, Polyline, type CameraPosition } from 'expo-yandex-mapkit';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MapPin, Navigation, X, Trash2, Sun, Moon, Save,
  ChevronDown, ChevronUp, Route as RouteIcon, Eye,
  Check, Pencil,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { THEATERS } from '@/constants/theaters';
import { useTheme } from '@/hooks/useTheme';
import { STORAGE_KEY } from '@/constants/keys';

type Theater = (typeof THEATERS)[number];
type SavedRoute = { id: string; name: string; theaterIds: string[] };
type InteractionMode = 'view' | 'build';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false,
    shouldShowBanner: true, shouldShowList: true,
  }),
});

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function bearingToText(b: number): string {
  if (b >= 337.5 || b < 22.5) return 'Север';
  if (b < 67.5) return 'Северо-восток';
  if (b < 112.5) return 'Восток';
  if (b < 157.5) return 'Юго-восток';
  if (b < 202.5) return 'Юг';
  if (b < 247.5) return 'Юго-запад';
  if (b < 292.5) return 'Запад';
  return 'Северо-запад';
}

export default function MapScreen() {
  const router = useRouter();
  const { theme, colors, toggleTheme } = useTheme();
  const { focusTheaterId, ts } = useLocalSearchParams<{ focusTheaterId?: string; ts?: string }>();

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [route, setRoute] = useState<Theater[]>([]);
  const [currentRouteId, setCurrentRouteId] = useState<string | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [isNavigatorMode, setIsNavigatorMode] = useState(false);
  const [navTargetIndex, setNavTargetIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [routePanelCollapsed, setRoutePanelCollapsed] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('view');

  const mapRef = useRef<any>(null);
  const isNavigatorModeRef = useRef(isNavigatorMode);
  const notifiedTheaters = useRef(new Set<string>());
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const pendingFocusRef = useRef<string | null>(null);

  const lastCameraPositionRef = useRef<CameraPosition | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const routesJson = await AsyncStorage.getItem(STORAGE_KEY);
        if (routesJson) setSavedRoutes(JSON.parse(routesJson));
      } catch (e) {
        console.warn('Не удалось загрузить маршруты', e);
      }
    })();
  }, []);

  useEffect(() => { isNavigatorModeRef.current = isNavigatorMode; }, [isNavigatorMode]);

  useEffect(() => {
    if (focusTheaterId) {
      pendingFocusRef.current = focusTheaterId;
      setIsNavigatorMode(false);
      setTimeout(() => applyPendingFocus(), 1000);
    }
  }, [focusTheaterId, ts]);

  const applyPendingFocus = useCallback(() => {
    const id = pendingFocusRef.current;
    if (!id || !mapRef.current?.setCenter) return;
    const theater = THEATERS.find(t => t.id === id);
    if (!theater) return;

    mapRef.current.setCenter(
      { latitude: theater.latitude, longitude: theater.longitude, zoom: 15 },
      { durationSeconds: 0.6, animation: 'smooth' }
    );
    pendingFocusRef.current = null;
  }, []);

  const handleMapReady = useCallback(() => {
    if (lastCameraPositionRef.current && mapRef.current?.setCenter) {
      mapRef.current.setCenter(lastCameraPositionRef.current, { durationSeconds: 0 });
    }
    applyPendingFocus();
  }, [applyPendingFocus]);

  const checkProximity = useCallback((coords: { latitude: number; longitude: number }) => {
    THEATERS.forEach((theater) => {
      const dist = getDistance(coords.latitude, coords.longitude, theater.latitude, theater.longitude);
      if (dist < 100 && !notifiedTheaters.current.has(theater.id)) {
        notifiedTheaters.current.add(theater.id);
        Notifications.scheduleNotificationAsync({
          content: {
            title: `Вы рядом с ${theater.name}`,
            body: 'Нажмите, чтобы узнать историю театра',
            data: { theaterId: theater.id },
          },
          trigger: null,
        });
      }
      if (dist > 200) notifiedTheaters.current.delete(theater.id);
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('Нет разрешения на геолокацию');
        await Notifications.requestPermissionsAsync();

        if (locationSubscriptionRef.current) locationSubscriptionRef.current.remove();

        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 10 },
          (loc) => {
            if (!isMounted) return;
            const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            setUserLocation(coords);
            checkProximity(coords);
          }
        );
        if (isMounted) { locationSubscriptionRef.current = sub; setIsLoading(false); }
        else sub.remove();
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Ошибка');
          setIsLoading(false);
        }
      }
    })();
    return () => {
      isMounted = false;
      if (locationSubscriptionRef.current) locationSubscriptionRef.current.remove();
    };
  }, [checkProximity]);

  useEffect(() => {
    const listener = Notifications.addNotificationResponseReceivedListener((response) => {
      const theaterId = Number(response.notification.request.content.data?.theaterId);
      if (theaterId) {
        router.push({ pathname: '/theater-list', params: { id: theaterId } });
      }
    });
    return () => listener.remove();
  }, [router]);

  const persistRoutes = useCallback(async (routes: SavedRoute[]) => {
    setSavedRoutes(routes);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(routes)); } catch {}
  }, []);

  const saveCurrentRoute = useCallback(async () => {
    if (route.length === 0) return;
    const newRoute: SavedRoute = {
      id: currentRouteId ?? `route_${Date.now()}`,
      name: currentRouteId
        ? (savedRoutes.find(r => r.id === currentRouteId)?.name ?? `Маршрут ${savedRoutes.length + 1}`)
        : `Маршрут ${savedRoutes.length + 1}`,
      theaterIds: route.map(t => t.id),
    };
    const idx = savedRoutes.findIndex(r => r.id === newRoute.id);
    const next = idx >= 0
      ? savedRoutes.map((r, i) => (i === idx ? newRoute : r))
      : [...savedRoutes, newRoute];
    setCurrentRouteId(newRoute.id);
    await persistRoutes(next);
  }, [route, savedRoutes, currentRouteId, persistRoutes]);

  const loadRoute = useCallback((saved: SavedRoute) => {
    const theaters = saved.theaterIds
      .map(id => THEATERS.find(t => t.id === id))
      .filter((t): t is Theater => Boolean(t));
    setRoute(theaters);
    setCurrentRouteId(saved.id);
    setNavTargetIndex(0);
    if (theaters.length > 0 && mapRef.current?.setCenter) {
      mapRef.current.setCenter(
        {
          latitude: theaters[0].latitude,
          longitude: theaters[0].longitude,
          zoom: 14,
        },
        { durationSeconds: 0.6, animation: 'smooth' }
      );
    }
  }, []);

  const commitRename = useCallback(async (id: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setEditingRouteId(null);
      setEditingName('');
      return;
    }
    const next = savedRoutes.map(r => (r.id === id ? { ...r, name: trimmed } : r));
    setEditingRouteId(null);
    setEditingName('');
    await persistRoutes(next);
  }, [editingName, savedRoutes, persistRoutes]);

  const deleteRoute = useCallback(async (id: string) => {
    const next = savedRoutes.filter(r => r.id !== id);
    if (currentRouteId === id) setCurrentRouteId(null);
    await persistRoutes(next);
  }, [savedRoutes, currentRouteId, persistRoutes]);

  const handleMarkerPress = useCallback((theater: Theater) => {
    if (interactionMode === 'build') {
      setRoute(prev => {
        if (prev.some(t => t.id === theater.id)) {
          return prev.filter(t => t.id !== theater.id);
        }
        return [...prev, theater];
      });
    } else {
      router.push({ pathname: '/theater-list', params: { id: theater.id } });
    }
  }, [interactionMode, router]);

  const removeFromRoute = useCallback((id: string) => {
    setRoute(prev => prev.filter(t => t.id !== id));
    setNavTargetIndex(prev => Math.max(0, prev - 1));
  }, []);

  const navInfo = useMemo(() => {
    if (route.length === 0 || !userLocation) return null;
    const safeIndex = Math.min(navTargetIndex, route.length - 1);
    const target = route[safeIndex];
    const dist = getDistance(userLocation.latitude, userLocation.longitude, target.latitude, target.longitude);
    const bearing = getBearing(userLocation.latitude, userLocation.longitude, target.latitude, target.longitude);
    return { target, dist, bearing, directionText: bearingToText(bearing), index: safeIndex };
  }, [route, userLocation, navTargetIndex]);

  useEffect(() => {
    if (!isNavigatorMode || !navInfo) return;
    if (navInfo.dist < 30 && navTargetIndex < route.length - 1) {
      setNavTargetIndex(prev => prev + 1);
    }
  }, [isNavigatorMode, navInfo, navTargetIndex, route.length]);

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.danger }]}>Ошибка</Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>{error}</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Загрузка карты...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <YandexMapView
        key={`map-${theme}`}
        ref={mapRef}
        style={styles.map}
        cameraPosition={
          lastCameraPositionRef.current ?? {
            latitude: 59.93,
            longitude: 30.31,
            zoom: 13,
          }
        }
        nightMode={theme === 'dark'}
        showUserPosition={true}
        followUser={isNavigatorMode}
        onMapReady={handleMapReady}
        onCameraPositionChanged={(event) => {
          lastCameraPositionRef.current = {
            latitude: event.nativeEvent.cameraPosition.latitude,
            longitude: event.nativeEvent.cameraPosition.longitude,
            zoom: event.nativeEvent.cameraPosition.zoom,
          };
        }}
        onUserLocationChange={(event) => {
          const { latitude, longitude } = event.nativeEvent.point;
          setUserLocation({ latitude, longitude });
          checkProximity({ latitude, longitude });
        }}
      >
        {route.length > 1 && (
          <Polyline
            points={route.map(t => ({ latitude: t.latitude, longitude: t.longitude }))}
            strokeColor={colors.accent}
            strokeWidth={3}
          />
        )}

        {isNavigatorMode && userLocation && navInfo && (
          <Polyline
            points={[
              { latitude: userLocation.latitude, longitude: userLocation.longitude },
              { latitude: navInfo.target.latitude, longitude: navInfo.target.longitude },
            ]}
            strokeColor={colors.info}
            strokeWidth={2}
            dashLength={8}
            gapLength={6}
          />
        )}

        {THEATERS.map((t) => {
          const isInRoute = route.some(r => r.id === t.id);
          const isCurrentTarget = isNavigatorMode && navInfo?.target.id === t.id;
          const orderNumber = isInRoute ? route.findIndex(r => r.id === t.id) + 1 : null;
          return (
            <Marker
              key={t.id}
              point={{ latitude: t.latitude, longitude: t.longitude }}
              onPress={() => handleMarkerPress(t)}
            >
              <View style={[
                styles.markerContainer,
                { backgroundColor: colors.background, borderColor: colors.accent },
                isInRoute && { borderColor: colors.accent, backgroundColor: colors.surface },
                isCurrentTarget && { borderColor: colors.info, transform: [{ scale: 1.15 }] },
              ]}>
                {orderNumber ? (
                  <Text style={[styles.markerNumber, { color: colors.accent }]}>{orderNumber}</Text>
                ) : (
                  <MapPin
                    size={24}
                    color={isCurrentTarget ? colors.info : colors.accent}
                    fill={isCurrentTarget ? colors.info : 'transparent'}
                  />
                )}
              </View>
            </Marker>
          );
        })}

        {userLocation && (
          <Marker point={userLocation}>
            <View style={styles.userMarkerContainer}>
              <Navigation size={30} color={colors.accent} fill={colors.accent} />
            </View>
          </Marker>
        )}
      </YandexMapView>

      {/* Кнопка темы */}
      {!isNavigatorMode && (
        <TouchableOpacity
          style={[styles.themeButton, { backgroundColor: colors.surface, borderColor: colors.accent }]}
          onPress={toggleTheme}
          accessibilityLabel="Переключить тему"
        >
          {theme === 'dark'
            ? <Sun size={20} color={colors.accent} />
            : <Moon size={20} color={colors.accent} />}
        </TouchableOpacity>
      )}

      {/* Переключатель режима */}
      {!isNavigatorMode && (
        <View style={[styles.modeSwitcher, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
          <TouchableOpacity
            style={[styles.modeBtn, interactionMode === 'view' && { backgroundColor: colors.accent }]}
            onPress={() => setInteractionMode('view')}
          >
            <Eye size={16} color={interactionMode === 'view' ? colors.background : colors.text} />
            <Text style={[styles.modeText, { color: interactionMode === 'view' ? colors.background : colors.text }]}>
              Просмотр
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, interactionMode === 'build' && { backgroundColor: colors.accent }]}
            onPress={() => setInteractionMode('build')}
          >
            <RouteIcon size={16} color={interactionMode === 'build' ? colors.background : colors.text} />
            <Text style={[styles.modeText, { color: interactionMode === 'build' ? colors.background : colors.text }]}>
              Маршрут
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Подсказка о режиме */}
      {!isNavigatorMode && (
        <View style={[styles.hintBar, { backgroundColor: colors.surface }]}>
          <Text style={[styles.hintText, { color: colors.textSecondary }]}>
            {interactionMode === 'build'
              ? 'Нажимайте на маркеры, чтобы добавить театры в маршрут по порядку'
              : 'Нажмите на маркер, чтобы открыть описание театра'}
          </Text>
        </View>
      )}

      {/* Панель маршрута */}
      {!isNavigatorMode && (
        <View style={[styles.routePanel, { backgroundColor: colors.surface, borderColor: 'rgba(245,209,152,0.2)', zIndex: 56 }]}>
          <View style={styles.routeHeaderRow}>
            <Text style={[styles.panelTitle, { color: colors.accent }]}>Маршрут ({route.length})</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {route.length > 0 && (
                <TouchableOpacity onPress={saveCurrentRoute} style={[styles.iconBtn, { backgroundColor: colors.surfaceAlt }]}>
                  <Save size={16} color={colors.accent} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setRoutePanelCollapsed(v => !v)}
                style={[styles.iconBtn, { backgroundColor: colors.surfaceAlt }]}
              >
                {routePanelCollapsed
                  ? <ChevronDown size={16} color={colors.accent} />
                  : <ChevronUp size={16} color={colors.accent} />}
              </TouchableOpacity>
            </View>
          </View>

          {!routePanelCollapsed && (
            <>
              {route.length === 0 ? (
                <Text style={[styles.routeEmpty, { color: colors.textSecondary }]}>
                  {interactionMode === 'build'
                    ? 'Кликайте по маркерам, чтобы добавить театры'
                    : 'Переключитесь в режим «Маршрут», чтобы строить путь'}
                </Text>
              ) : (
                <View>
                  {route.map((t, idx) => (
                    <View key={t.id} style={styles.routeItemRow}>
                      <Text style={[styles.routeItem, { color: colors.text }]}>
                        {idx + 1}. {t.name}
                      </Text>
                      <TouchableOpacity onPress={() => removeFromRoute(t.id)}>
                        <X size={16} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    onPress={() => { setRoute([]); setCurrentRouteId(null); setNavTargetIndex(0); }}
                    style={[styles.clearBtn, { backgroundColor: 'rgba(192,57,43,0.2)' }]}
                  >
                    <Text style={[styles.clearBtnText, { color: colors.danger }]}>Очистить весь маршрут</Text>
                  </TouchableOpacity>
                </View>
              )}

              <ScrollView style={{ maxHeight: 220, marginTop: 10 }}>
                <Text style={[styles.savedTitle, { color: colors.textSecondary }]}>Сохранённые маршруты</Text>
                {savedRoutes.length === 0 && (
                  <Text style={[styles.routeEmpty, { color: colors.textSecondary }]}>Пока нет сохранённых маршрутов</Text>
                )}
                {savedRoutes.map(r => {
                  const isEditing = editingRouteId === r.id;
                  return (
                    <View key={r.id} style={[styles.savedRow, { backgroundColor: colors.surfaceAlt }]}>
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() => !isEditing && loadRoute(r)}
                        disabled={isEditing}
                      >
                        {isEditing ? (
                          <TextInput
                            value={editingName}
                            onChangeText={setEditingName}
                            autoFocus
                            style={[
                              styles.savedNameInput,
                              { color: colors.text, borderColor: colors.accent },
                            ]}
                            placeholder="Название маршрута"
                            placeholderTextColor={colors.textSecondary}
                            onSubmitEditing={() => commitRename(r.id)}
                          />
                        ) : (
                          <Text style={[styles.savedName, { color: colors.text }]}>{r.name}</Text>
                        )}
                        <Text style={[styles.savedMeta, { color: colors.textSecondary }]}>
                          {r.theaterIds.length} театр(ов){currentRouteId === r.id ? ' · активен' : ''}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => {
                          if (isEditing) {
                            commitRename(r.id);
                          } else {
                            setEditingRouteId(r.id);
                            setEditingName(r.name);
                          }
                        }}
                        style={{ padding: 6 }}
                      >
                        {isEditing ? (
                          <Check size={16} color={colors.accent} />
                        ) : (
                          <Pencil size={16} color={colors.accent} />
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity onPress={() => deleteRoute(r.id)} style={{ padding: 6 }}>
                        <Trash2 size={16} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      )}

      {/* Навигационная панель */}
      <View style={[styles.navPanel, { backgroundColor: colors.surface, borderColor: 'rgba(245,209,152,0.2)' }]}>
        <TouchableOpacity
          style={[styles.navToggle, { backgroundColor: isNavigatorMode ? colors.danger : colors.surfaceAlt }]}
          onPress={() => {
            const nextMode = !isNavigatorMode;
            setIsNavigatorMode(nextMode);
            setNavTargetIndex(0);

            if (nextMode && userLocation && mapRef.current?.setCenter) {
              mapRef.current.setCenter(
                {
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                  zoom: 16,
                },
                { durationSeconds: 0.6, animation: 'smooth' }
              );
            }
          }}
        >
          <Text style={[styles.navToggleText, { color: colors.accent }]}>
            {isNavigatorMode ? 'Выйти из навигатора' : 'Режим навигатора'}
          </Text>
        </TouchableOpacity>

        {isNavigatorMode && navInfo && (
          <View style={styles.navInfo}>
            <Text style={[styles.navDest, { color: colors.accent }]}>
              {navInfo.index + 1}/{route.length}: {navInfo.target.name}
            </Text>
            <Text style={[styles.navDist, { color: colors.text }]}>Расстояние: {Math.round(navInfo.dist)} м</Text>
            <Text style={[styles.navDir, { color: colors.text }]}>
              Направление: {navInfo.directionText} ({Math.round(navInfo.bearing)}°)
            </Text>
            {route.length > 1 && (
              <View style={styles.navNavRow}>
                <TouchableOpacity
                  onPress={() => setNavTargetIndex(i => Math.max(i - 1, 0))}
                  disabled={navInfo.index === 0}
                  style={[
                    styles.skipBtn,
                    { backgroundColor: colors.surfaceAlt },
                    navInfo.index === 0 && styles.skipBtnDisabled,
                  ]}
                >
                  <Text style={[
                    styles.skipText,
                    { color: navInfo.index === 0 ? colors.textSecondary : colors.accent },
                  ]}>← Предыдущий</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setNavTargetIndex(i => Math.min(i + 1, route.length - 1))}
                  disabled={navInfo.index === route.length - 1}
                  style={[
                    styles.skipBtn,
                    { backgroundColor: colors.surfaceAlt },
                    navInfo.index === route.length - 1 && styles.skipBtnDisabled,
                  ]}
                >
                  <Text style={[
                    styles.skipText,
                    { color: navInfo.index === route.length - 1 ? colors.textSecondary : colors.accent },
                  ]}>Следующий →</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        {isNavigatorMode && !navInfo && (
          <Text style={[styles.navHint, { color: colors.textSecondary }]}>
            Добавьте театры в маршрут, чтобы начать навигацию
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },

  markerContainer: {
    minWidth: 34, height: 34, borderRadius: 17, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', padding: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5, shadowRadius: 3, elevation: 5,
  },
  markerNumber: { fontSize: 16, fontWeight: '700' },
  userMarkerContainer: {
    borderRadius: 15, padding: 6
  },

  themeButton: {
    position: 'absolute', top: 50, right: 15, width: 44, height: 44,
    borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center',
    zIndex: 60,
  },

  modeSwitcher: {
    position: 'absolute', top: 50, left: 15,
    flexDirection: 'row', borderRadius: 22, borderWidth: 1,
    padding: 4, zIndex: 60,
  },
  modeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, gap: 6,
  },
  modeText: { fontSize: 12, fontWeight: '600' },

  hintBar: {
    position: 'absolute', top: 105, left: 15, right: 15,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12,
    zIndex: 55,
  },
  hintText: { fontSize: 12, textAlign: 'center' },

  routePanel: {
    position: 'absolute', top: 145, left: 15, right: 15,
    borderRadius: 16, padding: 14, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6, zIndex: 50,
    maxWidth: '75%',
  },
  routeHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  panelTitle: { fontSize: 16, fontWeight: '700' },
  iconBtn: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  routeItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 2 },
  routeItem: { fontSize: 14, flex: 1, marginRight: 8 },
  routeEmpty: { fontSize: 13, fontStyle: 'italic' },
  clearBtn: { marginTop: 10, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  clearBtnText: { fontSize: 12, fontWeight: '600' },
  savedTitle: { fontSize: 12, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase' },
  savedRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 10, marginBottom: 6 },
  savedName: { fontSize: 14, fontWeight: '600' },
  savedMeta: { fontSize: 11, marginTop: 2 },
  savedNameInput: {
    fontSize: 14,
    fontWeight: '600',
    borderBottomWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },

  navPanel: {
    position: 'absolute', bottom: 20, left: 15, right: 15,
    borderRadius: 20, padding: 16, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 8, zIndex: 40,
  },
  navToggle: { paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  navToggleText: { fontWeight: '700', fontSize: 16 },
  navInfo: { marginTop: 14 },
  navDest: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  navDist: { fontSize: 14, marginTop: 3 },
  navDir: { fontSize: 14, marginTop: 3 },
  navHint: { textAlign: 'center', marginTop: 12, fontStyle: 'italic', fontSize: 13 },
  skipBtn: { marginTop: 10, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  skipText: { fontSize: 12, fontWeight: '600' },
  navNavRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  skipBtnDisabled: { opacity: 0.5 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, marginTop: 10 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  errorMessage: { fontSize: 14, textAlign: 'center' },
});
