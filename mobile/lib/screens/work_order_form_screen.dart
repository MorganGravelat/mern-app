import 'package:flutter/material.dart';

import '../models/work_order.dart';
import '../services/api_client.dart';
import '../services/auth_controller.dart';
import '../services/work_order_service.dart';
import '../validators.dart';
import '../widgets/form_page.dart';
import '../widgets/labeled_dropdown.dart';

// One screen for "New work order" (existing == null) and "Edit" (existing is the work order).
// Staff only. The API refuses technicians as well.
class WorkOrderFormScreen extends StatefulWidget {
  const WorkOrderFormScreen({super.key, required this.auth, this.existing});

  final AuthController auth;
  final WorkOrder? existing;

  @override
  State<WorkOrderFormScreen> createState() => _WorkOrderFormScreenState();
}

class _WorkOrderFormScreenState extends State<WorkOrderFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final WorkOrderService _service = WorkOrderService(widget.auth);
  late final TextEditingController _title = TextEditingController(text: widget.existing?.title ?? '');
  late final TextEditingController _description = TextEditingController(text: widget.existing?.description ?? '');
  late final TextEditingController _customer = TextEditingController(text: widget.existing?.customerName ?? '');
  late final TextEditingController _location = TextEditingController(text: widget.existing?.location ?? '');
  late final TextEditingController _dueDate = TextEditingController(
    text: widget.existing == null ? '' : dateForApi(widget.existing!.dueDate),
  );
  late String _category = widget.existing?.category ?? 'hardware';
  late String _priority = widget.existing?.priority ?? 'medium';
  // One text box per task. Editing keeps each task's "done" tick.
  late final List<TextEditingController> _tasks = [
    for (final item in widget.existing?.checklist ?? const <ChecklistItem>[]) TextEditingController(text: item.task),
  ];
  late final List<bool> _done = [
    for (final item in widget.existing?.checklist ?? const <ChecklistItem>[]) item.done,
  ];
  bool _busy = false;
  String? _error;

  bool get _editing => widget.existing != null;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _customer.dispose();
    _location.dispose();
    _dueDate.dispose();
    for (final controller in _tasks) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDate() async {
    final parsed = DateTime.tryParse(_dueDate.text);
    final picked = await showDatePicker(
      context: context,
      initialDate: parsed ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      // Use the picked calendar day, not a time zone conversion of it.
      _dueDate.text = dateForApi(DateTime.utc(picked.year, picked.month, picked.day));
    }
  }

  void _addTask() {
    setState(() {
      _tasks.add(TextEditingController());
      _done.add(false);
    });
  }

  void _removeTask(int index) {
    setState(() {
      _tasks.removeAt(index).dispose();
      _done.removeAt(index);
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    // Blank task boxes are ignored.
    final items = <ChecklistItem>[
      for (var i = 0; i < _tasks.length; i++)
        if (_tasks[i].text.trim().isNotEmpty) ChecklistItem(task: _tasks[i].text.trim(), done: _done[i]),
    ];
    final body = <String, dynamic>{
      'title': _title.text.trim(),
      'description': _description.text.trim(),
      'customerName': _customer.text.trim(),
      'location': _location.text.trim(),
      'category': _category,
      'priority': _priority,
      'dueDate': _dueDate.text.trim(),
      // A new work order sends only the task names; the API starts them all unchecked.
      'checklist': _editing ? items.map((i) => i.toJson()).toList() : items.map((i) => {'task': i.task}).toList(),
    };
    try {
      if (_editing) {
        await _service.update(widget.existing!.id, body);
      } else {
        await _service.create(body);
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = errorMessage(e);
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return FormPage(
      title: _editing ? 'Edit work order' : 'New work order',
      children: [
        Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(
                controller: _title,
                maxLength: 120,
                decoration: const InputDecoration(labelText: 'Title'),
                validator: requiredField('Title'),
              ),
              TextFormField(
                controller: _description,
                maxLength: 2000,
                maxLines: 4,
                decoration: const InputDecoration(labelText: 'Description'),
              ),
              TextFormField(
                controller: _customer,
                maxLength: 100,
                decoration: const InputDecoration(labelText: 'Customer name'),
              ),
              TextFormField(
                controller: _location,
                maxLength: 200,
                decoration: const InputDecoration(labelText: 'Location'),
              ),
              LabeledDropdown(
                label: 'Category',
                value: _category,
                options: {for (final c in workOrderCategories) c: c},
                onChanged: (value) => setState(() => _category = value),
              ),
              const SizedBox(height: 12),
              LabeledDropdown(
                label: 'Priority',
                value: _priority,
                options: {for (final p in workOrderPriorities) p: p},
                onChanged: (value) => setState(() => _priority = value),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _dueDate,
                readOnly: true,
                onTap: _pickDate,
                decoration: const InputDecoration(
                  labelText: 'Due date',
                  helperText: 'Tap to choose a date',
                  suffixIcon: Icon(Icons.calendar_today),
                ),
                validator: requiredField('Due date'),
              ),
              const SizedBox(height: 12),
              Text('Checklist', style: Theme.of(context).textTheme.titleMedium),
              for (var i = 0; i < _tasks.length; i++)
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _tasks[i],
                        maxLength: 200,
                        decoration: InputDecoration(labelText: 'Task ${i + 1}'),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline),
                      tooltip: 'Remove task ${i + 1}',
                      onPressed: () => _removeTask(i),
                    ),
                  ],
                ),
              Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton(onPressed: _addTask, child: const Text('Add a task')),
              ),
              StatusMessage(message: _error),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: _busy ? null : _submit,
                child: Text(_busy ? 'Saving...' : (_editing ? 'Save changes' : 'Create work order')),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
