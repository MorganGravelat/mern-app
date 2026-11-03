import 'package:flutter/material.dart';

import '../models/app_user.dart';
import '../services/api_client.dart';
import '../services/auth_controller.dart';

// Shows who the API says we are (GET /api/auth/me), with the Log out button.
class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key, required this.auth});

  final AuthController auth;

  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  late Future<AppUser> _me;

  @override
  void initState() {
    super.initState();
    _me = widget.auth.fetchMe();
  }

  void _reload() {
    setState(() {
      _me = widget.auth.fetchMe();
    });
  }

  // Logging out clears the session, so the app returns to the login screen by itself.
  Future<void> _logout() async {
    final navigator = Navigator.of(context);
    await widget.auth.logout();
    navigator.popUntil((route) => route.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Account'),
        actions: [TextButton(onPressed: _logout, child: const Text('Log out'))],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: FutureBuilder<AppUser>(
              future: _me,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Center(child: CircularProgressIndicator());
                }
                final error = snapshot.error;
                if (error != null) {
                  return Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(errorMessage(error), style: TextStyle(color: Theme.of(context).colorScheme.error)),
                        const SizedBox(height: 12),
                        OutlinedButton(onPressed: _reload, child: const Text('Try again')),
                      ],
                    ),
                  );
                }
                return _AccountDetails(user: snapshot.data!);
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _AccountDetails extends StatelessWidget {
  const _AccountDetails({required this.user});

  final AppUser user;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Welcome, ${user.firstName}', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 16),
        Card(
          child: Column(
            children: [
              ListTile(title: const Text('Name'), subtitle: Text(user.fullName)),
              ListTile(title: const Text('Username'), subtitle: Text(user.login)),
              ListTile(title: const Text('Email'), subtitle: Text(user.email)),
              ListTile(title: const Text('Role'), subtitle: Text(user.role)),
            ],
          ),
        ),
        const SizedBox(height: 8),
        const Text('Your session is kept only in memory. If you close the app you will need to log in again.'),
      ],
    );
  }
}
