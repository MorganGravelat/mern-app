import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:work_order_mobile/services/api_client.dart';
import 'package:work_order_mobile/services/auth_controller.dart';

import 'test_helpers.dart';

Future<AuthController> loggedIn(FakeApi api) async {
  final auth = api.newAuthController();
  await auth.login('jrivera', 'Password123!');
  return auth;
}

void main() {
  group('AuthController', () {
    test('keeps the user and notifies listeners after a successful login', () async {
      final api = FakeApi((request) => jsonResponse(200, sessionJson()));
      final auth = api.newAuthController();
      var notified = 0;
      auth.addListener(() => notified++);

      await auth.login('jrivera', 'Password123!');

      expect(auth.isLoggedIn, isTrue);
      expect(auth.user?.login, 'jrivera');
      expect(notified, 1);
    });

    test('does not log in when the API says the email is not verified', () async {
      final api = FakeApi((request) => apiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before logging in'));
      final auth = api.newAuthController();

      await expectLater(
        auth.login('jrivera', 'Password123!'),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', 'EMAIL_NOT_VERIFIED')),
      );
      expect(auth.isLoggedIn, isFalse);
    });

    test('refreshes the token once when the access token is rejected, then retries once', () async {
      final api = FakeApi((request) {
        switch (request.url.path) {
          case '/api/auth/login':
            return jsonResponse(200, sessionJson('old'));
          case '/api/auth/refresh':
            return jsonResponse(200, sessionJson('new'));
          default:
            return request.headers['Authorization'] == 'Bearer new'
                ? jsonResponse(200, {'user': userJson})
                : apiError(401, 'INVALID_TOKEN', 'Access token is invalid or expired');
        }
      });
      final auth = await loggedIn(api);

      final user = await auth.fetchMe();

      expect(user.login, 'jrivera');
      expect(api.countFor('/api/auth/me'), 2); // old token, then one retry with the new token
      expect(api.countFor('/api/auth/refresh'), 1);
    });

    test('stops after one refresh and one retry when the server keeps saying 401', () async {
      final api = FakeApi((request) {
        switch (request.url.path) {
          case '/api/auth/login':
            return jsonResponse(200, sessionJson('old'));
          case '/api/auth/refresh':
            return jsonResponse(200, sessionJson('new'));
          default:
            return apiError(401, 'INVALID_TOKEN', 'Access token has been revoked');
        }
      });
      final auth = await loggedIn(api);

      await expectLater(auth.fetchMe(), throwsA(isA<ApiException>().having((e) => e.status, 'status', 401)));

      expect(api.requests.length, 4); // login, me, refresh, me again, never more
      expect(auth.isLoggedIn, isFalse);
    });

    test('ends the session when the refresh itself fails', () async {
      final api = FakeApi((request) {
        switch (request.url.path) {
          case '/api/auth/login':
            return jsonResponse(200, sessionJson('old'));
          case '/api/auth/refresh':
            return apiError(401, 'INVALID_TOKEN', 'Refresh token has been revoked');
          default:
            return apiError(401, 'INVALID_TOKEN', 'Access token is invalid or expired');
        }
      });
      final auth = await loggedIn(api);

      await expectLater(auth.fetchMe(), throwsA(isA<ApiException>()));

      expect(auth.isLoggedIn, isFalse);
      expect(api.countFor('/api/auth/refresh'), 1);
    });

    test('logs out on a 204 reply and forgets the user', () async {
      final api = FakeApi((request) {
        return request.url.path == '/api/auth/login' ? jsonResponse(200, sessionJson()) : http.Response('', 204);
      });
      final auth = await loggedIn(api);

      await auth.logout();

      expect(auth.isLoggedIn, isFalse);
      final logout = api.requests.last;
      expect(logout.url.path, '/api/auth/logout');
      expect(logout.headers['Authorization'], 'Bearer access-1');
    });

    test('register, resend, forgot and reset send the bodies the API expects', () async {
      final api = FakeApi((request) => jsonResponse(200, {'message': 'ok'}));
      final auth = api.newAuthController();

      await auth.register(
        firstName: 'Jamie',
        lastName: 'Rivera',
        login: 'jrivera',
        email: 'jamie@example.com',
        password: 'Password123!',
      );
      await auth.resendVerification('jamie@example.com');
      await auth.forgotPassword('jamie@example.com');
      await auth.resetPassword('abc123', 'NewPassword456');

      expect(api.requests.map((r) => r.url.path), [
        '/api/auth/register',
        '/api/auth/resend-verification',
        '/api/auth/forgot-password',
        '/api/auth/reset-password',
      ]);
      expect(api.requests[0].body, contains('"login":"jrivera"'));
      expect(api.requests[3].body, '{"token":"abc123","password":"NewPassword456"}');
    });
  });
}
