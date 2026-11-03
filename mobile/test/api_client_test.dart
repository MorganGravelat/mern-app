import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:work_order_mobile/services/api_client.dart';

import 'test_helpers.dart';

void main() {
  group('ApiClient', () {
    test('sends JSON and the bearer token, and returns the decoded body', () async {
      final api = FakeApi((request) => jsonResponse(200, {'ok': true}));

      final result = await api.apiClient.send('POST', '/api/things', body: {'a': 1}, token: 'abc');

      expect(result, {'ok': true});
      final sent = api.requests.single;
      expect(sent.method, 'POST');
      expect(sent.url.toString(), 'http://api.test/api/things');
      expect(sent.body, '{"a":1}');
      expect(sent.headers['Authorization'], 'Bearer abc');
    });

    test('returns null for a 204 reply instead of parsing an empty body', () async {
      final api = FakeApi((request) => http.Response('', 204));

      expect(await api.apiClient.send('POST', '/api/auth/logout', token: 'abc'), isNull);
    });

    test('turns the API error shape into an ApiException', () async {
      final api = FakeApi((request) => apiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before logging in'));

      await expectLater(
        api.apiClient.send('POST', '/api/auth/login', body: {}),
        throwsA(
          isA<ApiException>()
              .having((e) => e.status, 'status', 403)
              .having((e) => e.code, 'code', 'EMAIL_NOT_VERIFIED')
              .having((e) => e.message, 'message', 'Verify your email before logging in'),
        ),
      );
    });

    test('reports an unreachable server as NETWORK_ERROR', () async {
      final api = FakeApi((request) => throw http.ClientException('connection refused'));

      await expectLater(
        api.apiClient.send('GET', '/api/health'),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', 'NETWORK_ERROR')),
      );
    });

    test('reports a slow server as TIMEOUT and says the request may have gone through', () async {
      final client = MockClient((request) => Completer<http.Response>().future); // never answers
      final apiClient = ApiClient(baseUrl: 'http://api.test', client: client, timeout: const Duration(milliseconds: 20));

      await expectLater(
        apiClient.send('POST', '/api/auth/register', body: {}),
        throwsA(
          isA<ApiException>()
              .having((e) => e.code, 'code', 'TIMEOUT')
              .having((e) => e.message, 'message', contains('may have gone through')),
        ),
      );
    });

    test('errorMessage adds validation field messages and hides unknown errors', () {
      final validation = ApiException(400, 'VALIDATION_ERROR', 'Some fields are missing or invalid', [
        'Password must contain a number',
      ]);

      expect(errorMessage(validation), 'Some fields are missing or invalid: Password must contain a number');
      expect(errorMessage(StateError('secret details')), 'Something went wrong. Please try again.');
    });
  });
}
