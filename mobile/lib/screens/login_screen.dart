import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../services/auth_controller.dart';
import '../validators.dart';
import '../theme.dart';
import '../widgets/form_page.dart';
import '../widgets/password_form_field.dart';
import '../widgets/resend_verification_card.dart';
import 'forgot_password_screen.dart';
import 'register_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.auth});

  final AuthController auth;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _login = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  String? _error;
  bool _needsVerification = false;

  @override
  void dispose() {
    _login.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
      _needsVerification = false;
    });
    try {
      await widget.auth.login(_login.text.trim(), _password.text);
      // Nothing else to do: the app listens to AuthController and shows the home screen.
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = errorMessage(e);
        _needsVerification = e is ApiException && e.code == 'EMAIL_NOT_VERIFIED';
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return FormPage(
      brand: true,
      eyebrow: 'WELCOME BACK',
      title: 'Log in to OpsFlow',
      subtitle: 'Your next work order starts here.',
      children: [
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _login,
                autofillHints: const [AutofillHints.username],
                autocorrect: false,
                decoration: const InputDecoration(labelText: 'Username or email'),
                validator: requiredField('Username or email'),
              ),
              const SizedBox(height: 12),
              PasswordFormField(
                controller: _password,
                label: 'Password',
                autofillHints: const [AutofillHints.password],
                validator: requiredField('Password'),
                onFieldSubmitted: (_) => _busy ? null : _submit(),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(builder: (_) => ForgotPasswordScreen(auth: widget.auth)),
                  ),
                  child: const Text('Forgot your password?'),
                ),
              ),
              StatusMessage(message: _error),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: Text(_busy ? 'Logging in...' : 'Log in'),
              ),
            ],
          ),
        ),
        if (_needsVerification) ...[
          const SizedBox(height: 16),
          const Text('Open the verification link we emailed you (in a browser), then log in again. Lost the email?'),
          ResendVerificationCard(
            auth: widget.auth,
            initialEmail: _login.text.contains('@') ? _login.text.trim() : '',
          ),
        ],
        const SizedBox(height: 8),
        TextButton(
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => RegisterScreen(auth: widget.auth)),
          ),
          child: const Text('New here? Create an account'),
        ),
        // The session lives only in memory (see AuthController), so say so up front.
        const Padding(
          padding: EdgeInsets.only(top: 8),
          child: Text(
            'Closing the app will sign you out.',
            textAlign: TextAlign.center,
            style: TextStyle(color: mutedColor, fontSize: 13),
          ),
        ),
      ],
    );
  }
}
