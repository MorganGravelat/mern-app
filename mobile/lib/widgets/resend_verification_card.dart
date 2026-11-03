import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../services/auth_controller.dart';
import 'form_page.dart';

// Asks the API for a new verification email. Used after registering and after a
// login is refused because the email is not verified yet.
class ResendVerificationCard extends StatefulWidget {
  const ResendVerificationCard({super.key, required this.auth, this.initialEmail = ''});

  final AuthController auth;
  final String initialEmail;

  @override
  State<ResendVerificationCard> createState() => _ResendVerificationCardState();
}

class _ResendVerificationCardState extends State<ResendVerificationCard> {
  late final TextEditingController _email = TextEditingController(text: widget.initialEmail);
  bool _busy = false;
  String? _message;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _resend() async {
    setState(() {
      _busy = true;
      _message = null;
      _error = null;
    });
    try {
      final message = await widget.auth.resendVerification(_email.text.trim());
      if (!mounted) return;
      setState(() => _message = message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Resend verification email', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(labelText: 'Email for resend'),
            ),
            StatusMessage(message: _error),
            StatusMessage(message: _message, isError: false),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: _busy ? null : _resend,
              child: Text(_busy ? 'Sending...' : 'Send a new link'),
            ),
          ],
        ),
      ),
    );
  }
}
