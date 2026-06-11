import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { BarberProfileScreen } from '../screens/BarberProfileScreen';
import { BookingScreen } from '../screens/BookingScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { MyCutsScreen } from '../screens/MyCutsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ShopScreen } from '../screens/ShopScreen';
import { colors } from '../theme';

export type RootStackParamList = {
  Tabs: undefined;
  BarberProfile: { barberId: string };
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const tabIcon = (icon: string) =>
  ({ focused }: { focused: boolean }) => (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{icon}</Text>
  );

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.anthracite, borderTopColor: colors.anthracite },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tab.Screen name="Accueil" component={HomeScreen} options={{ tabBarIcon: tabIcon('💈') }} />
      <Tab.Screen name="Réserver" component={BookingScreen} options={{ tabBarIcon: tabIcon('📅') }} />
      <Tab.Screen name="Mes Coupes" component={MyCutsScreen} options={{ tabBarIcon: tabIcon('📸') }} />
      <Tab.Screen name="Boutique" component={ShopScreen} options={{ tabBarIcon: tabIcon('🛍️') }} />
      <Tab.Screen name="Profil" component={ProfileScreen} options={{ tabBarIcon: tabIcon('👤') }} />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="BarberProfile"
        component={BarberProfileScreen}
        options={{ title: 'Profil barber', headerTintColor: colors.gold }}
      />
    </Stack.Navigator>
  );
}
