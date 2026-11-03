import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../services/auth_controller.dart';
import '../validators.dart';
import '../widgets/form_page.dart';
import 'reset_password_screen.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key, required this.auth});

  final AuthController auth;

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _message;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
      _message = null;
    });
    try {
      final message = await widget.auth.forgotPassword(_email.text.trim());
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
    return FormPage(
      brand: true,
      title: 'Forgot your password?',
      subtitle: 'Enter your email and we will send a link to choose a new password.',
      children: [
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(labelText: 'Email'),
                validator: emailField,
              ),
              StatusMessage(message: _error),
              StatusMessage(message: _message, isError: false),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: Text(_busy ? 'Sending...' : 'Send reset link'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        // The reset email opens the website. On a phone the simplest base-version path
        // is to copy the token from that link and paste it on the next screen.
        OutlinedButton(
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => ResetPasswordScreen(auth: widget.auth)),
          ),
          child: const Text('I have my reset token'),
        ),
      ],
    );
  }
}
