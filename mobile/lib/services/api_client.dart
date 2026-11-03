import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

// What went wrong, in the API's error shape: { "error": { "code", "message", "details" } }.
class ApiException implements Exception {
  ApiException(this.status, this.code, this.message, [this.details = const []]);

  final int status; // HTTP status, or 0 if the server could not be reached
  final String code;
  final String message;
  final List<String> details;

  @override
  String toString() => message;
}

// Text to show on screen for any error, including the per-field validation messages.
String errorMessage(Object error) {
  if (error is ApiException) {
    if (error.details.isEmpty) return error.message;
    return '${error.message}: ${error.details.join('; ')}';
  }
  return 'Something went wrong. Please try again.';
}

// The small HTTP service. Every call to the Express API goes through send().
class ApiClient {
  ApiClient({required this.baseUrl, http.Client? client, this.timeout = const Duration(seconds: 30)})
      : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;
  final Duration timeout;

  // Returns the decoded JSON, or null for an empty 204 reply (logout).
  Future<Object?> send(
    String method,
    String path, {
    Map<String, dynamic>? body,
    String? token,
  }) async {
    final request = http.Request(method, Uri.parse('$baseUrl$path'));
    request.headers['Accept'] = 'application/json';
    if (body != null) {
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode(body);
    }
    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    final http.Response response;
    try {
      final streamed = await _client.send(request).timeout(timeout);
      response = await http.Response.fromStream(streamed);
    } on TimeoutException {
      // The server may still finish the job after the app gives up (for example a new
      // account), so do not claim it was unreachable.
      throw ApiException(
        0,
        'TIMEOUT',
        'The server took too long to answer. Your request may have gone through, so try logging in or reloading before trying again.',
      );
    } on Exception {
      // SocketException and ClientException land here.
      throw ApiException(
        0,
        'NETWORK_ERROR',
        'Cannot reach the server at $baseUrl. Check that the API is running and the address is right.',
      );
    }

    if (response.statusCode == 204) return null;

    Object? data;
    if (response.body.isNotEmpty) {
      try {
        data = jsonDecode(response.body);
      } on FormatException {
        data = null;
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _errorFrom(response.statusCode, data);
    }
    return data;
  }

  ApiException _errorFrom(int status, Object? data) {
    final error = data is Map<String, dynamic> ? data['error'] : null;
    if (error is Map<String, dynamic>) {
      final details = error['details'];
      return ApiException(
        status,
        (error['code'] as String?) ?? 'UNKNOWN_ERROR',
        (error['message'] as String?) ?? 'Request failed with status $status',
        details is List
            ? details
                .whereType<Map<String, dynamic>>()
                .map((d) => '${d['message']}')
                .toList()
            : const [],
      );
    }
    return ApiException(status, 'UNKNOWN_ERROR', 'Request failed with status $status');
  }
}
