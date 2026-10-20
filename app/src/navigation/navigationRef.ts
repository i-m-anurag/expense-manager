import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// For code outside the navigator (the lock screen's "start again").
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
