import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { ActivityScreen } from './src/screens/ActivityScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { LessonScreen } from './src/screens/LessonScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { PuzzleScreen } from './src/screens/PuzzleScreen';
import { RecordScreen } from './src/screens/RecordScreen';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function StudentTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        headerTintColor: colors.primary,
        tabBarActiveTintColor: colors.primaryButton,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size }) => {
          const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home-outline',
            Record: 'checkbox-outline',
            Activity: 'calendar-outline',
            LB: 'bar-chart-outline',
          };
          return (
            <Ionicons
              name={iconMap[route.name] ?? 'ellipse-outline'}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Record"
        component={RecordScreen}
        options={{ title: 'Record' }}
      />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen
        name="LB"
        component={LeaderboardScreen}
        options={{ title: 'LB' }}
      />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primaryButton} />
      </View>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (!user.name || !user.cohortId) {
    return <OnboardingScreen />;
  }

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MainTabs"
        component={StudentTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Lesson"
        component={LessonScreen}
        options={{ title: 'Lesson', headerTintColor: colors.primary }}
      />
      <Stack.Screen
        name="Puzzle"
        component={PuzzleScreen}
        options={{ title: 'Chess Practice', headerTintColor: colors.primary }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
