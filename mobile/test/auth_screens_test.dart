import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:work_order_mobile/main.dart';

import 'test_helpers.dart';

// Makes the fake phone screen tall enough that the whole form is visible.
void useTallScreen(WidgetTester tester) {
  tester.view.physicalSize = const Size(800, 1800);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

Finder field(String label) => find.widgetWithText(TextFormField, label);

void main() {
  testWidgets('shows the login form first', (tester) async {
    useTallScreen(tester);
    final api = FakeApi((request) => jsonResponse(200, {}));

    await tester.pumpWidget(WorkOrderApp(auth: api.newAuthController()));

    expect(field('Username or email'), findsOneWidget);
    expect(field('Password'), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Log in'), findsOneWidget);
  });

  testWidgets('logs in, lands on the work orders, shows the account from /me, and logs out', (tester) async {
    useTallScreen(tester);
    final api = FakeApi((request) {
      switch (request.url.path) {
        case '/api/auth/login':
          return jsonResponse(200, sessionJson());
        case '/api/workorders':
          return jsonResponse(200, {'workOrders': []});
        case '/api/auth/me':
          return jsonResponse(200, {'user': userJson});
        default:
          return http.Response('', 204); // logout
      }
    });
    await tester.pumpWidget(WorkOrderApp(auth: api.newAuthController()));

    await tester.enterText(field('Username or email'), 'jrivera');
    await tester.enterText(field('Password'), 'Password123!');
    await tester.tap(find.widgetWithText(FilledButton, 'Log in'));
    await tester.pumpAndSettle();

    expect(find.text('Work orders'), findsOneWidget);
    await tester.tap(find.byTooltip('Account'));
    await tester.pumpAndSettle();

    expect(find.text('Welcome, Jamie'), findsOneWidget);
    expect(find.text('jamie@example.com'), findsOneWidget);

    await tester.tap(find.text('Log out'));
    await tester.pumpAndSettle();

    expect(field('Username or email'), findsOneWidget);
    expect(api.countFor('/api/auth/logout'), 1);
  });

  testWidgets('shows the API message and a resend form when the email is not verified', (tester) async {
    useTallScreen(tester);
    final api = FakeApi((request) {
      return request.url.path == '/api/auth/login'
          ? apiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before logging in')
          : jsonResponse(200, {'message': 'If that email belongs to an account, we sent it a link.'});
    });
    await tester.pumpWidget(WorkOrderApp(auth: api.newAuthController()));

    await tester.enterText(field('Username or email'), 'jamie@example.com');
    await tester.enterText(field('Password'), 'Password123!');
    await tester.tap(find.widgetWithText(FilledButton, 'Log in'));
    await tester.pumpAndSettle();

    expect(find.text('Verify your email before logging in'), findsOneWidget);
    expect(find.text('Resend verification email'), findsOneWidget);

    await tester.tap(find.widgetWithText(OutlinedButton, 'Send a new link'));
    await tester.pumpAndSettle();

    expect(find.text('If that email belongs to an account, we sent it a link.'), findsOneWidget);
    expect(api.countFor('/api/auth/resend-verification'), 1);
  });

  testWidgets('does not call the API when required fields are empty', (tester) async {
    useTallScreen(tester);
    final api = FakeApi((request) => jsonResponse(200, {}));
    await tester.pumpWidget(WorkOrderApp(auth: api.newAuthController()));

    await tester.tap(find.widgetWithText(FilledButton, 'Log in'));
    await tester.pump();

    expect(find.text('Username or email is required'), findsOneWidget);
    expect(api.requests, isEmpty);
  });

  testWidgets('registers and then tells the user to verify before logging in', (tester) async {
    useTallScreen(tester);
    final api = FakeApi((request) {
      return jsonResponse(201, {'message': 'Account created. Check your email for a verification link.', 'user': userJson});
    });
    await tester.pumpWidget(WorkOrderApp(auth: api.newAuthController()));

    await tester.tap(find.text('New here? Create an account'));
    await tester.pumpAndSettle();
    await tester.enterText(field('First name'), 'Jamie');
    await tester.enterText(field('Last name'), 'Rivera');
    await tester.enterText(field('Username'), 'jrivera');
    await tester.enterText(field('Email'), 'jamie@example.com');
    await tester.enterText(field('Password'), 'Password123!');
    await tester.tap(find.widgetWithText(FilledButton, 'Create account'));
    await tester.pumpAndSettle();

    expect(find.text('Check your email'), findsOneWidget);
    expect(find.textContaining('jamie@example.com'), findsWidgets);
    expect(api.requests.single.url.path, '/api/auth/register');
  });

  testWidgets('sends the pasted token and new password to reset-password', (tester) async {
    useTallScreen(tester);
    final api = FakeApi((request) => jsonResponse(200, {'message': 'Password updated. You can now log in.'}));
    await tester.pumpWidget(WorkOrderApp(auth: api.newAuthController()));

    await tester.tap(find.text('Forgot your password?'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('I have my reset token'));
    await tester.pumpAndSettle();
    await tester.enterText(field('Reset token'), 'http://localhost:5173/reset-password?token=abc123');
    await tester.enterText(field('New password'), 'NewPassword456');
    await tester.enterText(field('Confirm new password'), 'NewPassword456');
    await tester.tap(find.widgetWithText(FilledButton, 'Save new password'));
    await tester.pumpAndSettle();

    expect(find.text('Password updated. You can now log in.'), findsOneWidget);
    expect(api.requests.single.body, '{"token":"abc123","password":"NewPassword456"}');
  });
}
