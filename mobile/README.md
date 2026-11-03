# IT Work Orders: Flutter app

Mobile client for the same Express/MongoDB API the website uses.

> **Status (November 3, 2026):** `flutter analyze` reports no issues and `flutter test` passes (36 tests, a fake HTTP client, no network) with Flutter 3.47.9 / Dart 3.13.7. The app was run on an Android emulator (API 37) against the real Express API: register, unverified-login refusal, login, account, logout, forgot/reset password. The screens use the dark OpsFlow theme from the website (`lib/theme.dart`). Requests wait up to 30 seconds; a timeout is reported as "The server took too long to answer. Your request may have gone through..." because the server can still finish after the app gives up. **Not done yet:** a physical phone and a release build.

## First-time setup

1. Install the [Flutter SDK](https://docs.flutter.dev/get-started/install) and Android Studio (for the Android emulator). iOS needs a Mac; Windows cannot build iOS.
2. Get the packages:

   ```bash
   cd mobile
   flutter pub get
   ```

   The `android/` and `ios/` folders are already generated. If you ever delete them, recreate them around the existing code with `flutter create --platforms=android,ios --project-name work_order_mobile .` (it does not replace existing files) and delete the `test/widget_test.dart` it adds.
3. **Android cleartext HTTP is already allowed for debug builds only** in `android/app/src/debug/AndroidManifest.xml` (`android:usesCleartextTraffic="true"`), because the local API is plain `http://`. The main manifest has the `INTERNET` permission, and release builds do not allow cleartext, so a release build must call an `https://` API.

## Run against the API

Start the API first (`cd backend && npm run dev`, see the root README). Then:

```bash
# Android emulator: 10.0.2.2 is how the emulator reaches your computer
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000

# Real phone on the same Wi-Fi: use your computer's LAN address (the phone's own "localhost" is the phone)
flutter run --dart-define=API_BASE_URL=http://192.168.1.50:5000

# Real phone with a deployed API (best): HTTPS
flutter run --dart-define=API_BASE_URL=https://api.yourdomain.com
```

The default (`http://10.0.2.2:5000`) is for the Android emulator. The API does not need `CORS_ORIGINS` for the phone; CORS is a browser rule. For a real phone on your LAN you may need to allow the API port through your computer's firewall. This project does not change firewall settings for you.

## Behavior to know

- Tokens are kept **in memory**. Closing the app means logging in again.
- Registering does not log you in. Open the verification link from the email (in a browser; the API answers with a short JSON message), then log in. With no email key the link is printed in the API terminal.
- Reset password: request the email on the "Forgot your password?" screen, copy the part after `token=` from the link (or paste the whole link), and enter it on the "I have my reset token" screen. No app links are needed for the base version.
- After login the app opens the **work order list** (search, status and priority filters). Staff (admin, dispatcher) can create, edit, assign, cancel and delete; a technician sees only their own jobs and can start them, tick checklist items and complete them. Pull down on the list to refresh. The account icon shows who you are and has **Log out**.

## Checks

```bash
flutter analyze
flutter test
```

## Code map

| File | Job |
|---|---|
| `lib/config.dart` | `API_BASE_URL` from `--dart-define` |
| `lib/services/api_client.dart` | Small HTTP service: JSON, bearer token, 204 handling, API error shape |
| `lib/services/auth_controller.dart` | Session state (`ChangeNotifier`): login, logout, refresh once and retry once |
| `lib/services/work_order_service.dart` | The work order calls (list, get, create, update, delete, technicians) |
| `lib/models/` | `AppUser`, `WorkOrder`, checklist and people, plus date helpers |
| `lib/screens/*.dart` | Login, register, forgot/reset password, account, work order list, detail and form |
| `lib/main.dart` | Shows the work order list when logged in and the login screen otherwise |
