import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:work_order_mobile/models/work_order.dart';
import 'package:work_order_mobile/services/api_client.dart';
import 'package:work_order_mobile/services/work_order_service.dart';

import 'test_helpers.dart';

// Logs in through the fake API, then returns a service that talks to it.
Future<(FakeApi, WorkOrderService)> serviceFor(
  http.Response Function(http.Request request) handler,
) async {
  final api = FakeApi((request) {
    if (request.url.path == '/api/auth/login') return jsonResponse(200, sessionFor('dispatcher'));
    return handler(request);
  });
  final auth = api.newAuthController();
  await auth.login('dchen', 'Password123!');
  return (api, WorkOrderService(auth));
}

void main() {
  group('WorkOrder model', () {
    test('reads the API shape, including a missing assignee', () {
      final order = WorkOrder.fromJson(workOrderJson(
        status: 'in_progress',
        assignedTo: {'_id': 'u1', 'firstName': 'Morgan', 'lastName': 'Johnson'},
        checklist: [
          {'task': 'Restart printer', 'done': true},
          {'task': 'Print test page', 'done': false},
        ],
      ));

      expect(order.orderNumber, 'WO-1001');
      expect(order.assignedTo?.fullName, 'Morgan Johnson');
      expect(order.checklist.length, 2);
      expect(order.checklistDone, isFalse);
      expect(order.isFinal, isFalse);
      expect(WorkOrder.fromJson(workOrderJson()).assignedTo, isNull);
    });

    test('an empty checklist counts as done, and completed or cancelled are final', () {
      expect(WorkOrder.fromJson(workOrderJson()).checklistDone, isTrue);
      expect(WorkOrder.fromJson(workOrderJson(status: 'completed')).isFinal, isTrue);
      expect(WorkOrder.fromJson(workOrderJson(status: 'cancelled')).isFinal, isTrue);
    });

    test('shows and sends due dates in UTC so they never move a day', () {
      final due = DateTime.parse('2026-12-15T00:00:00.000Z');
      expect(formatDate(due), 'Dec 15, 2026');
      expect(dateForApi(due), '2026-12-15');
    });
  });

  group('WorkOrderService', () {
    test('lists work orders and puts the search and filters in the query', () async {
      final (api, service) = await serviceFor((request) => jsonResponse(200, {'workOrders': [workOrderJson()]}));

      final orders = await service.list(q: 'wi fi', status: 'pending', priority: 'high');

      expect(orders.single.title, 'Printer offline');
      final sent = api.requests.last;
      expect(sent.method, 'GET');
      expect(sent.url.path, '/api/workorders');
      expect(sent.url.queryParameters, {'q': 'wi fi', 'status': 'pending', 'priority': 'high'});
      expect(sent.headers['Authorization'], 'Bearer access-1');
    });

    test('sends no query when there are no filters', () async {
      final (api, service) = await serviceFor((request) => jsonResponse(200, {'workOrders': []}));

      await service.list();

      expect(api.requests.last.url.hasQuery, isFalse);
    });

    test('gets one work order', () async {
      final (api, service) = await serviceFor((request) => jsonResponse(200, {'workOrder': workOrderJson()}));

      final order = await service.get('65f0000000000000000000a1');

      expect(order.orderNumber, 'WO-1001');
      expect(api.requests.last.url.path, '/api/workorders/65f0000000000000000000a1');
    });

    test('creates, updates and deletes with the right method, path and body', () async {
      final (api, service) = await serviceFor((request) {
        if (request.method == 'DELETE') return http.Response('', 204);
        return jsonResponse(request.method == 'POST' ? 201 : 200, {'workOrder': workOrderJson()});
      });

      await service.create({'title': 'Printer offline', 'category': 'hardware'});
      await service.update('65f0000000000000000000a1', {'status': 'in_progress'});
      await service.delete('65f0000000000000000000a1');

      final sent = api.requests.skip(1).toList(); // the first request is the login
      expect(sent.map((r) => '${r.method} ${r.url.path}'), [
        'POST /api/workorders',
        'PATCH /api/workorders/65f0000000000000000000a1',
        'DELETE /api/workorders/65f0000000000000000000a1',
      ]);
      expect(sent[0].body, '{"title":"Printer offline","category":"hardware"}');
      expect(sent[1].body, '{"status":"in_progress"}');
    });

    test('lists the technicians for assignment', () async {
      final (api, service) = await serviceFor((request) {
        return jsonResponse(200, {
          'technicians': [
            {'_id': 't1', 'firstName': 'Morgan', 'lastName': 'Johnson', 'isAvailable': true},
          ],
        });
      });

      final technicians = await service.technicians();

      expect(technicians.single.fullName, 'Morgan Johnson');
      expect(api.requests.last.url.path, '/api/users/technicians');
    });

    test('passes the API error through when a change is refused', () async {
      final (_, service) = await serviceFor(
        (request) => apiError(409, 'INVALID_TRANSITION', 'A pending work order cannot change to in_progress.'),
      );

      await expectLater(
        service.update('65f0000000000000000000a1', {'status': 'in_progress'}),
        throwsA(
          isA<ApiException>()
              .having((e) => e.status, 'status', 409)
              .having((e) => e.code, 'code', 'INVALID_TRANSITION'),
        ),
      );
    });
  });
}
