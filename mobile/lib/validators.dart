// Quick checks on the phone so people get fast feedback.
// The API repeats every check on the server, which is the one that really counts.

String? Function(String?) requiredField(String label) {
  return (value) => (value == null || value.trim().isEmpty) ? '$label is required' : null;
}

String? emailField(String? value) {
  final text = value?.trim() ?? '';
  if (text.isEmpty) return 'Email is required';
  if (!text.contains('@') || !text.contains('.')) return 'Enter a valid email address';
  return null;
}

// Same rules as the API: 8 to 72 characters, at least one letter and one number.
String? passwordField(String? value) {
  final text = value ?? '';
  if (text.length < 8) return 'Password must be at least 8 characters';
  if (text.length > 72) return 'Password must be at most 72 characters';
  if (!RegExp('[A-Za-z]').hasMatch(text)) return 'Password must contain a letter';
  if (!RegExp('[0-9]').hasMatch(text)) return 'Password must contain a number';
  return null;
}
