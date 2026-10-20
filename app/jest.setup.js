/* eslint-env jest */
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('@react-native-community/slider', () => 'Slider');

// The encrypted op-sqlite connection needs the device; tests get an in-memory
// SQLite with the same schema instead.
jest.mock('./src/db/connection', () => {
  const { memorySql } = require('./__tests__/helpers/memorySql');
  let db;
  return {
    getDb: () => (db ??= memorySql()),
    SecureStore: {
      getDatabaseKey: async () => 'test',
      setPin: async () => true,
      verifyPin: async () => true,
      hasPin: async () => false,
      clearPin: async () => true,
      setSecureWindow: () => {},
    },
  };
});
