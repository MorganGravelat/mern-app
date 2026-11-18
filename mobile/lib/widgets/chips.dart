import 'package:flutter/material.dart';

import '../models/work_order.dart';

// Colors match the .badge-* and .priority-* rules in web/src/index.css.
// The status and priority are always written as words, never color alone.
class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.textColor, required this.background, this.border});

  final String label;
  final Color textColor;
  final Color background;
  final Color? border;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: border ?? const Color(0xFF30363D)),
      ),
      child: Text(label, style: TextStyle(color: textColor, fontSize: 13, fontWeight: FontWeight.w600)),
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip({super.key, required this.status});

  final String status;

  static const Map<String, (Color, Color)> _colors = {
    'pending': (Color(0xFFC9D1D9), Color(0xFF2D333B)),
    'assigned': (Color(0xFF79C0FF), Color(0xFF12233A)),
    'in_progress': (Color(0xFFE3B341), Color(0xFF3A2F10)),
    'completed': (Color(0xFF7EE787), Color(0xFF12261A)),
    'cancelled': (Color(0xFF9DA7B3), Color(0xFF21262D)),
  };

  @override
  Widget build(BuildContext context) {
    final (text, background) = _colors[status] ?? (const Color(0xFFC9D1D9), const Color(0xFF2D333B));
    return _Pill(label: statusLabel(status), textColor: text, background: background);
  }
}

class PriorityChip extends StatelessWidget {
  const PriorityChip({super.key, required this.priority});

  final String priority;

  static const Map<String, (Color, Color)> _colors = {
    'low': (Color(0xFF7EE787), Color(0xFF12261A)),
    'medium': (Color(0xFFE3B341), Color(0xFF3A2F10)),
    'high': (Color(0xFFFF9B94), Color(0xFF3D1A1A)),
    'critical': (Color(0xFFFFB4AE), Color(0xFF5A1D1D)),
  };

  @override
  Widget build(BuildContext context) {
    final (text, background) = _colors[priority] ?? (const Color(0xFFC9D1D9), const Color(0xFF2D333B));
    return _Pill(
      label: priorityLabel(priority),
      textColor: text,
      background: background,
      border: priority == 'critical' ? const Color(0xFFFF7B72) : null,
    );
  }
}
