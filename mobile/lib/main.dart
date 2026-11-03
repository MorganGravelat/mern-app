import 'package:flutter/material.dart';

import 'config.dart';
import 'screens/login_screen.dart';
import 'screens/work_order_list_screen.dart';
import 'services/api_client.dart';
import 'services/auth_controller.dart';
import 'theme.dart';

void main() {
  runApp(WorkOrderApp(auth: AuthController(ApiClient(baseUrl: apiBaseUrl))));
}

class WorkOrderApp extends StatelessWidget {
  const WorkOrderApp({super.key, required this.auth});

  final AuthController auth;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OpsFlow IT Work Orders',
      theme: buildTheme(),
      // Logged in -> work order list, logged out (or session ended) -> login screen.
      home: ListenableBuilder(
        listenable: auth,
        builder: (context, _) {
          return auth.isLoggedIn ? WorkOrderListScreen(auth: auth) : LoginScreen(auth: auth);
        },
      ),
    );
  }
}
