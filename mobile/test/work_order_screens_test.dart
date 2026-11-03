import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:work_order_mobile/main.dart';

import 'test_helpers.dart';

const orderId = '65f0000000000000000000a1';
const techId = '65f0000000000000000000b1';

void useTallScreen(WidgetTester tester) {
  tester.view.physicalSize = const Size(800, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

Finder field(String label) => find.widgetWithText(TextFormField, label);

// A tiny in-memory "server" for one work order, so a screen can be tapped through several steps.
FakeApi fakeServer({required String role, required Map<String, dynamic> order}) {
  var current = order;
  return FakeApi((request) {
    final route = '${request.method} ${request.url.path}';
    switch (route) {
      case 'POST /api/auth/login':
        return jsonResponse(200, sessionFor(role));
      case 'GET /api/workorders':
        return jsonResponse(200, {'workOrders': [current]});
      case 'GET /api/workorders/$orderId':
        return jsonResponse(200, {'workOrder': current});
      case 'PATCH /api/workorders/$orderId':
        final changes = jsonDecode(request.body) as Map<String, dynamic>;
        final assignedTo = changes.remove('assignedTo');
        current = {...current, ...changes};
        if (assignedTo != null) {
          // Assigning makes a pending work order "assigned", like the real API.
          current = {
            ...current,
            'status': 'assigned',
            'assignedTo': {'_id': techId, 'firstName': 'Morgan', 'lastName': 'Johnson'},
          };
        }
        return jsonResponse(200, {'workOrder': current});
      case 'DELETE /api/workorders/$orderId':
        return http.Response('', 204);
      case 'GET /api/users/technicians':
        return jsonResponse(200, {
          'technicians': [
            {'_id': techId, 'firstName': 'Morgan', 'lastName': 'Johnson', 'isAvailable': true},
          ],
        });
      case 'POST /api/workorders':
        return jsonResponse(201, {'workOrder': current});
      default:
        return apiError(404, 'NOT_FOUND', 'No mock for $route');
    }
  });
}

Future<void> signIn(WidgetTester tester, FakeApi api) async {
  await tester.pumpWidget(WorkOrderApp(auth: api.newAuthController()));
  await tester.enterText(field('Username or email'), 'someone');
  await tester.enterText(field('Password'), 'Password123!');
  await tester.tap(find.widgetWithText(FilledButton, 'Log in'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('a technician sees the list from the API and no New work order button', (tester) async {
    useTallScreen(tester);
    final api = fakeServer(role: 'technician', order: workOrderJson(status: 'assigned'));

    await signIn(tester, api);

    expect(find.text('WO-1001'), findsOneWidget);
    expect(find.text('Printer offline'), findsOneWidget);
    expect(find.text('Lakeside Dental'), findsOneWidget); // the customer is now on the card
    expect(find.text('Medium'), findsOneWidget); // priority chip
    expect(find.textContaining('Assigned'), findsWidgets);
    expect(find.text('New work order'), findsNothing);
  });

  testWidgets('staff see the New work order button and the API error when the list fails', (tester) async {
    useTallScreen(tester);
    final api = FakeApi((request) {
      if (request.url.path == '/api/auth/login') return jsonResponse(200, sessionFor('dispatcher'));
      return apiError(500, 'SERVER_ERROR', 'Something went wrong');
    });

    await signIn(tester, api);

    expect(find.text('New work order'), findsOneWidget);
    expect(find.text('Something went wrong'), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('search text is sent to the API when Apply filters is tapped', (tester) async {
    useTallScreen(tester);
    final api = fakeServer(role: 'dispatcher', order: workOrderJson());
    await signIn(tester, api);

    await tester.enterText(find.widgetWithText(TextField, 'Search'), 'wifi');
    await tester.tap(find.text('Apply filters'));
    await tester.pumpAndSettle();

    final lists = api.requests.where((r) => r.method == 'GET' && r.url.path == '/api/workorders');
    expect(lists.last.url.queryParameters, {'q': 'wifi'});
  });

  testWidgets('a technician starts the job, ticks tasks and completes it', (tester) async {
    useTallScreen(tester);
    final api = fakeServer(
      role: 'technician',
      order: workOrderJson(
        status: 'assigned',
        assignedTo: {'_id': userJson['_id'], 'firstName': 'Jamie', 'lastName': 'Rivera'}, // the logged-in technician
        checklist: [
          {'task': 'Restart printer', 'done': false},
          {'task': 'Print test page', 'done': false},
        ],
      ),
    );
    await signIn(tester, api);
    await tester.tap(find.text('Printer offline'));
    await tester.pumpAndSettle();

    expect(find.text('Assigned to you'), findsOneWidget);
    expect(find.text('0 of 2 complete'), findsOneWidget);

    await tester.tap(find.text('Start work'));
    await tester.pumpAndSettle();
    expect(find.text('In progress'), findsWidgets);
    expect(tester.widget<FilledButton>(find.widgetWithText(FilledButton, 'Mark complete')).onPressed, isNull);
    expect(find.text('Edit'), findsNothing); // staff-only buttons are hidden
    expect(find.text('Delete work order'), findsNothing);

    await tester.tap(find.text('Restart printer'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Print test page'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Mark complete'));
    await tester.pumpAndSettle();

    expect(find.text('Completed'), findsWidgets);
    expect(find.text('Mark complete'), findsNothing);
    final bodies = api.requests.where((r) => r.method == 'PATCH').map((r) => jsonDecode(r.body)).toList();
    expect(bodies, [
      {'status': 'in_progress'},
      {
        'checklist': [
          {'task': 'Restart printer', 'done': true},
          {'task': 'Print test page', 'done': false},
        ],
      },
      {
        'checklist': [
          {'task': 'Restart printer', 'done': true},
          {'task': 'Print test page', 'done': true},
        ],
      },
      {'status': 'completed'},
    ]);
  });

  testWidgets('staff assign a technician from the list', (tester) async {
    useTallScreen(tester);
    final api = fakeServer(role: 'dispatcher', order: workOrderJson());
    await signIn(tester, api);
    await tester.tap(find.text('Printer offline'));
    await tester.pumpAndSettle();

    await tester.tap(find.byType(DropdownButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Morgan Johnson').last);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Assign'));
    await tester.pumpAndSettle();

    expect(find.text('Reassign technician'), findsOneWidget);
    expect(jsonDecode(api.requests.where((r) => r.method == 'PATCH').single.body), {'assignedTo': techId});
  });

  testWidgets('deleting asks for confirmation first and only deletes after "Yes"', (tester) async {
    useTallScreen(tester);
    final api = fakeServer(role: 'admin', order: workOrderJson());
    await signIn(tester, api);
    await tester.tap(find.text('Printer offline'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Delete work order'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Keep it'));
    await tester.pumpAndSettle();
    expect(api.requests.where((r) => r.method == 'DELETE'), isEmpty);

    await tester.tap(find.text('Delete work order'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Yes, delete it'));
    await tester.pumpAndSettle();

    expect(api.requests.where((r) => r.method == 'DELETE').length, 1);
    expect(find.text('Work orders'), findsOneWidget); // back on the list
  });

  testWidgets('staff create a work order with the fields the API expects', (tester) async {
    useTallScreen(tester);
    final api = fakeServer(role: 'dispatcher', order: workOrderJson());
    await signIn(tester, api);

    await tester.tap(find.text('New work order'));
    await tester.pumpAndSettle();
    await tester.enterText(field('Title'), 'Wi-Fi down');
    await tester.tap(field('Due date'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Add a task'));
    await tester.pumpAndSettle();
    await tester.enterText(field('Task 1'), 'Check access point');
    await tester.tap(find.widgetWithText(FilledButton, 'Create work order'));
    await tester.pumpAndSettle();

    final body = jsonDecode(api.requests.singleWhere((r) => r.method == 'POST' && r.url.path == '/api/workorders').body)
        as Map<String, dynamic>;
    expect(body['title'], 'Wi-Fi down');
    expect(body['category'], 'hardware');
    expect(body['priority'], 'medium');
    expect(body['dueDate'], matches(RegExp(r'^\d{4}-\d{2}-\d{2}$')));
    expect(body['checklist'], [
      {'task': 'Check access point'},
    ]);
    expect(find.text('Work orders'), findsOneWidget); // back on the list
  });

  testWidgets('the create form does not call the API without a title and due date', (tester) async {
    useTallScreen(tester);
    final api = fakeServer(role: 'dispatcher', order: workOrderJson());
    await signIn(tester, api);
    await tester.tap(find.text('New work order'));
    await tester.pumpAndSettle();

    await tester.tap(find.widgetWithText(FilledButton, 'Create work order'));
    await tester.pump();

    expect(find.text('Title is required'), findsOneWidget);
    expect(find.text('Due date is required'), findsOneWidget);
    expect(api.requests.where((r) => r.method == 'POST' && r.url.path == '/api/workorders'), isEmpty);
  });
}
