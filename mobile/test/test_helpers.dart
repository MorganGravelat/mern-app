import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:work_order_mobile/services/api_client.dart';
import 'package:work_order_mobile/services/auth_controller.dart';

const userJson = {
  '_id': '65f000000000000000000001',
  'firstName': 'Jamie',
  'lastName': 'Rivera',
  'login': 'jrivera',
  'email': 'jamie@example.com',
  'role': 'technician',
};

Map<String, dynamic> sessionJson([String token = 'access-1']) => {
      'accessToken': token,
      'refreshToken': 'refresh-for-$token',
      'user': userJson,
    };

http.Response jsonResponse(int status, Object? body) {
  return http.Response(jsonEncode(body), status, headers: {'content-type': 'application/json'});
}

http.Response apiError(int status, String code, String message) {
  return jsonResponse(status, {
    'error': {'code': code, 'message': message},
  });
}

// A work order as the API sends it (people are populated with just their names).
Map<String, dynamic> workOrderJson({
  String id = '65f0000000000000000000a1',
  String orderNumber = 'WO-1001',
  String title = 'Printer offline',
  String status = 'pending',
  Map<String, dynamic>? assignedTo,
  List<Map<String, dynamic>> checklist = const [],
}) {
  return {
    '_id': id,
    'orderNumber': orderNumber,
    'title': title,
    'description': 'Front desk printer does not respond.',
    'customerName': 'Lakeside Dental',
    'location': '1200 Lake Ave',
    'category': 'hardware',
    'priority': 'medium',
    'status': status,
    'checklist': checklist,
    'createdBy': {'_id': 'u-dispatcher', 'firstName': 'Dana', 'lastName': 'Chen'},
    'assignedTo': assignedTo,
    'dueDate': '2026-12-15T00:00:00.000Z',
    'completedAt': null,
    'createdAt': '2026-11-01T12:00:00.000Z',
    'updatedAt': '2026-11-01T12:00:00.000Z',
  };
}

Map<String, dynamic> sessionFor(String role) {
  return {
    'accessToken': 'access-1',
    'refreshToken': 'refresh-for-access-1',
    'user': {...userJson, 'role': role},
  };
}

// A fake API for tests: records every request it receives and answers with [handler].
class FakeApi {
  FakeApi(this.handler) {
    client = MockClient((request) async {
      requests.add(request);
      return handler(request);
    });
  }

  final http.Response Function(http.Request request) handler;
  final List<http.Request> requests = [];
  late final MockClient client;

  ApiClient get apiClient => ApiClient(baseUrl: 'http://api.test', client: client);

  AuthController newAuthController() => AuthController(apiClient);

  int countFor(String path) => requests.where((r) => r.url.path == path).length;
}
