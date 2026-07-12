import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from './src/screens/LoginScreen';
import { FacturationScreen } from './src/screens/FacturationScreen';
import { HistoriqueScreen } from './src/screens/HistoriqueScreen';
import { useAuthStore } from './src/stores/useAuthStore';

const Stack = createNativeStackNavigator();

export default function App() {
  const { isAuthenticated } = useAuthStore();
  const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated);

  const handleLoginSuccess = () => setIsLoggedIn(true);
  const handleLogout = () => setIsLoggedIn(false);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isLoggedIn ? (
          <Stack.Screen name="Login">
            {(props) => <LoginScreen {...props} onLoginSuccess={handleLoginSuccess} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Facturation">
              {(props) => <FacturationScreen {...props} onLogout={handleLogout} />}
            </Stack.Screen>
            <Stack.Screen name="Historique" component={HistoriqueScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
