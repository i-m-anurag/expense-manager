import { Linking, PermissionsAndroid, Platform } from 'react-native';

export type PermissionResult = 'granted' | 'denied' | 'blocked';

const { READ_SMS, RECEIVE_SMS, POST_NOTIFICATIONS } =
  PermissionsAndroid.PERMISSIONS;
const { GRANTED, NEVER_ASK_AGAIN } = PermissionsAndroid.RESULTS;

export async function requestSms(): Promise<PermissionResult> {
  const res = await PermissionsAndroid.requestMultiple([READ_SMS, RECEIVE_SMS]);
  if (res[READ_SMS] === GRANTED && res[RECEIVE_SMS] === GRANTED) {
    return 'granted';
  }
  return res[READ_SMS] === NEVER_ASK_AGAIN ? 'blocked' : 'denied';
}

// POST_NOTIFICATIONS only exists on Android 13 (API 33) and later; older
// versions grant notifications at install time.
export async function requestNotifications(): Promise<PermissionResult> {
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    return 'granted';
  }
  const res = await PermissionsAndroid.request(POST_NOTIFICATIONS);
  if (res === GRANTED) {
    return 'granted';
  }
  return res === NEVER_ASK_AGAIN ? 'blocked' : 'denied';
}

export const openAppSettings = () => Linking.openSettings();
