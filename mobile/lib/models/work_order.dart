// Allowed values. They match the API and database (see backend/src/utils/workOrderRules.js).
const List<String> workOrderStatuses = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];
const List<String> workOrderPriorities = ['low', 'medium', 'high', 'critical'];
const List<String> workOrderCategories = ['network', 'hardware', 'software', 'security', 'account'];

const Map<String, String> statusLabels = {
  'pending': 'Pending',
  'assigned': 'Assigned',
  'in_progress': 'In progress',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
};

String statusLabel(String status) => statusLabels[status] ?? status;

// "high" -> "High", for chips and the filter list.
String priorityLabel(String priority) =>
    priority.isEmpty ? priority : '${priority[0].toUpperCase()}${priority.substring(1)}';

// "hardware" -> "Hardware".
String categoryLabel(String category) => priorityLabel(category);

// Completed and cancelled work orders are final: the API refuses any change.
bool isFinalStatus(String status) => status == 'completed' || status == 'cancelled';

class PersonName {
  const PersonName({required this.id, required this.firstName, required this.lastName});

  factory PersonName.fromJson(Map<String, dynamic> json) {
    return PersonName(
      id: json['_id'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
    );
  }

  final String id;
  final String firstName;
  final String lastName;

  String get fullName => '$firstName $lastName';
}

class ChecklistItem {
  const ChecklistItem({required this.task, required this.done});

  factory ChecklistItem.fromJson(Map<String, dynamic> json) {
    return ChecklistItem(task: json['task'] as String, done: json['done'] as bool);
  }

  final String task;
  final bool done;

  ChecklistItem copyWith({String? task, bool? done}) {
    return ChecklistItem(task: task ?? this.task, done: done ?? this.done);
  }

  Map<String, dynamic> toJson() => {'task': task, 'done': done};
}

class WorkOrder {
  const WorkOrder({
    required this.id,
    required this.orderNumber,
    required this.title,
    required this.description,
    required this.customerName,
    required this.location,
    required this.category,
    required this.priority,
    required this.status,
    required this.checklist,
    required this.createdBy,
    required this.assignedTo,
    required this.dueDate,
    required this.completedAt,
  });

  factory WorkOrder.fromJson(Map<String, dynamic> json) {
    final createdBy = json['createdBy'];
    final assignedTo = json['assignedTo'];
    final completedAt = json['completedAt'];
    return WorkOrder(
      id: json['_id'] as String,
      orderNumber: json['orderNumber'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      customerName: json['customerName'] as String,
      location: json['location'] as String,
      category: json['category'] as String,
      priority: json['priority'] as String,
      status: json['status'] as String,
      checklist: (json['checklist'] as List)
          .cast<Map<String, dynamic>>()
          .map(ChecklistItem.fromJson)
          .toList(),
      createdBy: createdBy is Map<String, dynamic> ? PersonName.fromJson(createdBy) : null,
      assignedTo: assignedTo is Map<String, dynamic> ? PersonName.fromJson(assignedTo) : null,
      dueDate: DateTime.parse(json['dueDate'] as String).toUtc(),
      completedAt: completedAt is String ? DateTime.parse(completedAt).toLocal() : null,
    );
  }

  final String id;
  final String orderNumber;
  final String title;
  final String description;
  final String customerName;
  final String location;
  final String category;
  final String priority;
  final String status;
  final List<ChecklistItem> checklist;
  final PersonName? createdBy;
  final PersonName? assignedTo;
  final DateTime dueDate; // stored at midnight UTC
  final DateTime? completedAt;

  bool get isFinal => isFinalStatus(status);
  bool get checklistDone => checklist.every((item) => item.done); // an empty checklist counts as done
}

// The technician dropdown only needs these three things.
class Technician {
  const Technician({required this.id, required this.fullName});

  factory Technician.fromJson(Map<String, dynamic> json) {
    return Technician(
      id: json['_id'] as String,
      fullName: '${json['firstName']} ${json['lastName']}',
    );
  }

  final String id;
  final String fullName;
}

const List<String> _monthNames = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// "Dec 15, 2026". Due dates are midnight UTC, so read the UTC fields to avoid "yesterday" in US time zones.
String formatDate(DateTime date) {
  final utc = date.toUtc();
  return '${_monthNames[utc.month - 1]} ${utc.day}, ${utc.year}';
}

// "2026-12-15", the text the API accepts for dueDate.
String dateForApi(DateTime date) {
  final utc = date.toUtc();
  final month = utc.month.toString().padLeft(2, '0');
  final day = utc.day.toString().padLeft(2, '0');
  return '${utc.year}-$month-$day';
}
