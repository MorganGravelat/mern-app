import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../services/auth_controller.dart';
import '../validators.dart';
import '../theme.dart';
import '../widgets/form_page.dart';
import '../widgets/password_form_field.dart';
import '../widgets/resend_verification_card.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key, required this.auth});

  final AuthController auth;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _login = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _registeredEmail;

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _login.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.auth.register(
        firstName: _firstName.text.trim(),
        lastName: _lastName.text.trim(),
        login: _login.text.trim(),
        email: _email.text.trim(),
        password: _password.text,
      );
      if (!mounted) return;
      setState(() => _registeredEmail = _email.text.trim());
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final registeredEmail = _registeredEmail;
    if (registeredEmail != null) return _buildCheckEmail(context, registeredEmail);

    return FormPage(
      brand: true,
      title: 'Create your account',
      subtitle: "Join your team's IT workspace.",
      children: [
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _firstName,
                      autofillHints: const [AutofillHints.givenName],
                      decoration: const InputDecoration(labelText: 'First name'),
                      validator: requiredField('First name'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _lastName,
                      autofillHints: const [AutofillHints.familyName],
                      decoration: const InputDecoration(labelText: 'Last name'),
                      validator: requiredField('Last name'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _login,
                autocorrect: false,
                autofillHints: const [AutofillHints.newUsername],
                decoration: const InputDecoration(
                  labelText: 'Username',
                  helperText: '3 to 30 letters, numbers, dots, dashes or underscores',
                  helperMaxLines: 2,
                ),
                validator: (value) {
                  final text = value?.trim() ?? '';
                  if (text.length < 3) return 'Username must be at least 3 characters';
                  if (!RegExp(r'^[A-Za-z0-9._-]+$').hasMatch(text)) {
                    return 'Use only letters, numbers, dots, dashes and underscores';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(labelText: 'Email'),
                validator: emailField,
              ),
              const SizedBox(height: 12),
              PasswordFormField(
                controller: _password,
                label: 'Password',
                helperText: '8 to 72 characters with a letter and a number',
                autofillHints: const [AutofillHints.newPassword],
                validator: passwordField,
              ),
              StatusMessage(message: _error),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: Text(_busy ? 'Creating account...' : 'Create account'),
              ),
              const Padding(
                padding: EdgeInsets.only(top: 12),
                child: Text(
                  'New accounts are registered as technicians. Verify your email before logging in.',
                  style: TextStyle(color: mutedColor, fontSize: 13),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildCheckEmail(BuildContext context, String email) {
    return FormPage(
      brand: true,
      title: 'Check your email',
      children: [
        StatusMessage(
          message: 'Account created. We sent a verification link to $email.',
          isError: false,
        ),
        const Text(
          '1. Open the link in the email, in a browser. It shows a short message saying the email is verified.\n'
          '2. Come back to the app and log in. Logging in is blocked until the email is verified.',
        ),
        const SizedBox(height: 16),
        ResendVerificationCard(auth: widget.auth, initialEmail: email),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Back to log in'),
        ),
      ],
    );
  }
}
