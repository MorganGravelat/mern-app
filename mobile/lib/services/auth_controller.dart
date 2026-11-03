import 'package:flutter/foundation.dart';

import '../models/app_user.dart';
import 'api_client.dart';

// Holds the logged-in user and the tokens. Screens listen to it (ChangeNotifier),
// so when the session ends the app goes back to the login screen by itself.
//
// Tokens are kept in memory only. Closing the app means logging in again.
class AuthController extends ChangeNotifier {
  AuthController(this._api);

  final ApiClient _api;
  AppUser? _user;
  String? _accessToken;
  String? _refreshToken;
  Future<void>? _refreshInFlight;

  AppUser? get user => _user;
  bool get isLoggedIn => _user != null;

  Future<void> login(String login, String password) async {
    final data = await _api.send(
      'POST',
      '/api/auth/login',
      body: {'login': login, 'password': password},
    );
    _saveSession(data! as Map<String, dynamic>);
  }

  // Registering does not log you in. The API sends a verification email first.
  Future<String> register({
    required String firstName,
    required String lastName,
    required String login,
    required String email,
    required String password,
  }) async {
    final data = await _api.send('POST', '/api/auth/register', body: {
      'firstName': firstName,
      'lastName': lastName,
      'login': login,
      'email': email,
      'password': password,
    });
    return (data! as Map<String, dynamic>)['message'] as String;
  }

  Future<String> resendVerification(String email) => _sendEmailOnly('/api/auth/resend-verification', email);

  Future<String> forgotPassword(String email) => _sendEmailOnly('/api/auth/forgot-password', email);

  Future<String> resetPassword(String token, String password) async {
    final data = await _api.send(
      'POST',
      '/api/auth/reset-password',
      body: {'token': token, 'password': password},
    );
    return (data! as Map<String, dynamic>)['message'] as String;
  }

  // Asks the API who we are (GET /api/auth/me) instead of trusting only what we remember.
  Future<AppUser> fetchMe() async {
    final data = await authedRequest('GET', '/api/auth/me');
    return AppUser.fromJson((data! as Map<String, dynamic>)['user'] as Map<String, dynamic>);
  }

  // Sends the access token. If the API says 401, refresh the tokens ONCE and retry ONCE.
  Future<Object?> authedRequest(
    String method,
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final token = _accessToken;
    if (token == null) {
      throw ApiException(401, 'UNAUTHENTICATED', 'Please log in');
    }
    try {
      return await _api.send(method, path, body: body, token: token);
    } on ApiException catch (e) {
      if (e.status != 401) rethrow;
    }

    await _refresh();
    try {
      return await _api.send(method, path, body: body, token: _accessToken);
    } on ApiException catch (e) {
      if (e.status == 401) _clearSession();
      rethrow;
    }
  }

  // Logs out of every device (the API bumps the user's tokenVersion).
  Future<void> logout() async {
    try {
      await authedRequest('POST', '/api/auth/logout');
    } on ApiException {
      // Even if the server can't be reached, forget the tokens on this phone.
    }
    _clearSession();
  }

  Future<String> _sendEmailOnly(String path, String email) async {
    final data = await _api.send('POST', path, body: {'email': email});
    return (data! as Map<String, dynamic>)['message'] as String;
  }

  // Several requests can fail at once; they all wait for the same single refresh.
  Future<void> _refresh() {
    return _refreshInFlight ??= _doRefresh().whenComplete(() => _refreshInFlight = null);
  }

  Future<void> _doRefresh() async {
    final refreshToken = _refreshToken;
    if (refreshToken == null) {
      throw ApiException(401, 'UNAUTHENTICATED', 'Please log in');
    }
    try {
      final data = await _api.send(
        'POST',
        '/api/auth/refresh',
        body: {'refreshToken': refreshToken},
      );
      _saveSession(data! as Map<String, dynamic>);
    } catch (_) {
      _clearSession(); // a failed refresh ends the session instead of looping
      rethrow;
    }
  }

  void _saveSession(Map<String, dynamic> data) {
    _accessToken = data['accessToken'] as String;
    _refreshToken = data['refreshToken'] as String;
    _user = AppUser.fromJson(data['user'] as Map<String, dynamic>);
    notifyListeners();
  }

  void _clearSession() {
    _accessToken = null;
    _refreshToken = null;
    _user = null;
    notifyListeners();
  }
}
