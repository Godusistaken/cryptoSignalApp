import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { FavoritesProvider } from './src/store/FavoritesContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <FavoritesProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </FavoritesProvider>
  );
}