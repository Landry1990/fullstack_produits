import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import App from './App';

if (Platform.OS === 'web') {
  require('./global.css');
}

const Root = () => React.createElement(SafeAreaProvider, null, React.createElement(App));

registerRootComponent(Root);
