import { NativeTabs } from 'expo-router/native-tabs';
import { useTheme } from '@/hooks/useTheme';

export default function AppTabs() {
  const { colors } = useTheme();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.surface}
      labelStyle={{ selected: { color: colors.text } }}
    >
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Label>О приложении</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="info" md="info" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="map">
          <NativeTabs.Trigger.Label>Карта</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="map" md="map" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="theater-list">
          <NativeTabs.Trigger.Label>Театры</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf="list.bullet" md="list" />
        </NativeTabs.Trigger>
    </NativeTabs>
  );
}
