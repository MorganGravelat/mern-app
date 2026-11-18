// The user as the API sends it (password and token fields are never included).
class AppUser {
  const AppUser({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.login,
    required this.email,
    required this.role,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) {
    return AppUser(
      id: json['_id'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
      login: json['login'] as String,
      email: json['email'] as String,
      role: json['role'] as String,
    );
  }

  final String id;
  final String firstName;
  final String lastName;
  final String login;
  final String email;
  final String role; // admin, dispatcher or technician

  String get fullName => '$firstName $lastName';

  bool get isStaff => role == 'admin' || role == 'dispatcher';
}
