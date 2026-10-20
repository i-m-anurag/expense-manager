/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { quickTagTask, smsReceivedTask } from './src/sms/headlessTask';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerHeadlessTask('SmsReceived', () => smsReceivedTask);
AppRegistry.registerHeadlessTask('QuickTag', () => quickTagTask);
