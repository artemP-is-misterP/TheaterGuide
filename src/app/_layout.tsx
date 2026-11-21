import { ThemeProvider } from '@/hooks/useTheme';
import AppTabs from '@/components/AppTabs';

export default function TabLayout() {
  return (
    <ThemeProvider>
      <AppTabs />
    </ThemeProvider>
  );
}
