import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import React from 'react';
import App from './App';

// SafeAreaProvider nécessaire pour useSafeAreaInsets (edgeToEdge Android :
// le contenu dessine sous la barre de statut / nav sinon).
const Root = () => React.createElement(SafeAreaProvider, null, React.createElement(App));

registerRootComponent(Root);
