// Where the API lives. Set it when you run the app:
//   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000
//
//   Android emulator -> http://10.0.2.2:5000   (10.0.2.2 is the emulator's name for your computer)
//   Real phone, same Wi-Fi -> http://YOUR_COMPUTER_LAN_IP:5000, or better an https:// server address
//   Never use localhost on a phone: that means the phone itself, not your computer.
//
// This value is public (it is inside the app). Never put database passwords or JWT secrets here.
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:5000',
);
