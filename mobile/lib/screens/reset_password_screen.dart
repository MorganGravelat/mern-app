import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../services/auth_controller.dart';
import '../validators.dart';
import '../widgets/form_page.dart';
import '../widgets/password_form_field.dart';

// The emailed link looks like https://your-site/reset-password?token=LONG_TEXT.
// Paste only the LONG_TEXT after "token=" (or the whole link, we pick the token out of it).
class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, required this.auth});

  final AuthController auth;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _token = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _doneMessage;

  @override
  void dispose() {
    _token.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  // Lets people paste either the bare token or the whole link from the email.
  String _cleanToken(String text) {
    final trimmed = text.trim();
    final marker = trimmed.indexOf('token=');
    if (marker == -1) return trimmed;
    return trimmed.substring(marker + 'token='.length).split('&').first;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final message = await widget.auth.resetPassword(_cleanToken(_token.text), _password.text);
      if (!mounted) return;
      setState(() => _doneMessage = message);
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final doneMessage = _doneMessage;
    if (doneMessage != null) {
      return FormPage(
        brand: true,
        title: 'Password updated',
        children: [
          StatusMessage(message: doneMessage, isError: false),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: () => Navigator.of(context).popUntil((route) => route.isFirst),
            child: const Text('Back to log in'),
          ),
        ],
      );
    }

    return FormPage(
      brand: true,
      title: 'Choose a new password',
      children: [
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _token,
                autocorrect: false,
                decoration: const InputDecoration(
                  labelText: 'Reset token',
                  helperText: 'The text after token= in the email link',
                ),
                validator: requiredField('Reset token'),
              ),
              const SizedBox(height: 12),
              PasswordFormField(
                controller: _password,
                label: 'New password',
                helperText: '8 to 72 characters with a letter and a number',
                autofillHints: const [AutofillHints.newPassword],
                validator: passwordField,
              ),
              const SizedBox(height: 12),
              PasswordFormField(
                controller: _confirm,
                label: 'Confirm new password',
                validator: (value) => value == _password.text ? null : 'The two passwords do not match',
              ),
              StatusMessage(message: _error),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: Text(_busy ? 'Saving...' : 'Save new password'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
