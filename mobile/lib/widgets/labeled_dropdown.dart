import 'package:flutter/material.dart';

// A drop-down with a visible label. "options" maps the value sent to the API to the text shown.
class LabeledDropdown extends StatelessWidget {
  const LabeledDropdown({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  final String label;
  final String value;
  final Map<String, String> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      container: true,
      child: InputDecorator(
        decoration: InputDecoration(labelText: label),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            value: value,
            isExpanded: true,
            items: [
              for (final entry in options.entries)
                DropdownMenuItem<String>(value: entry.key, child: Text(entry.value)),
            ],
            onChanged: (chosen) {
              if (chosen != null) onChanged(chosen);
            },
          ),
        ),
      ),
    );
  }
}
