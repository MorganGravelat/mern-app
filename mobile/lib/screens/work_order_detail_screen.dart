import 'package:flutter/material.dart';

import '../models/work_order.dart';
import '../services/api_client.dart';
import '../services/auth_controller.dart';
import '../services/work_order_service.dart';
import '../theme.dart';
import '../widgets/chips.dart';
import '../widgets/form_page.dart';
import '../widgets/labeled_dropdown.dart';
import 'work_order_form_screen.dart';

class WorkOrderDetailScreen extends StatefulWidget {
  const WorkOrderDetailScreen({super.key, required this.auth, required this.orderId});

  final AuthController auth;
  final String orderId;

  @override
  State<WorkOrderDetailScreen> createState() => _WorkOrderDetailScreenState();
}

class _WorkOrderDetailScreenState extends State<WorkOrderDetailScreen> {
  late final WorkOrderService _service = WorkOrderService(widget.auth);
  WorkOrder? _order;
  String? _loadError;
  String? _actionError;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final order = await _service.get(widget.orderId);
      if (!mounted) return;
      setState(() {
        _order = order;
        _loadError = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loadError = errorMessage(e));
    }
  }

  // Sends a PATCH and shows the updated work order the API sends back.
  Future<void> _update(Map<String, dynamic> changes) async {
    setState(() {
      _busy = true;
      _actionError = null;
    });
    try {
      final order = await _service.update(widget.orderId, changes);
      if (!mounted) return;
      setState(() => _order = order);
    } catch (e) {
      if (!mounted) return;
      setState(() => _actionError = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _toggleTask(WorkOrder order, int index) {
    final checklist = [
      for (var i = 0; i < order.checklist.length; i++)
        i == index ? order.checklist[i].copyWith(done: !order.checklist[i].done) : order.checklist[i],
    ];
    _update({'checklist': checklist.map((item) => item.toJson()).toList()});
  }

  // A dialog asks "are you sure?" before anything is cancelled or deleted.
  Future<bool> _confirm(String title, String message, String yesLabel) async {
    final answer = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Keep it')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: Text(yesLabel)),
        ],
      ),
    );
    return answer ?? false;
  }

  Future<void> _cancelOrder(WorkOrder order) async {
    final yes = await _confirm(
      'Cancel work order?',
      'Cancel ${order.orderNumber}? A cancelled work order cannot be changed again.',
      'Yes, cancel it',
    );
    if (yes && mounted) await _update({'status': 'cancelled'});
  }

  Future<void> _deleteOrder(WorkOrder order) async {
    final yes = await _confirm(
      'Delete work order?',
      'Delete ${order.orderNumber} permanently? This cannot be undone.',
      'Yes, delete it',
    );
    if (!yes || !mounted) return;
    setState(() {
      _busy = true;
      _actionError = null;
    });
    try {
      await _service.delete(widget.orderId);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _actionError = errorMessage(e);
        _busy = false;
      });
    }
  }

  Future<void> _edit(WorkOrder order) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(builder: (_) => WorkOrderFormScreen(auth: widget.auth, existing: order)),
    );
    if (saved == true && mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final order = _order;
    if (order == null) {
      return FormPage(
        title: 'Work order',
        children: [
          if (_loadError != null) ...[
            StatusMessage(message: _loadError),
            OutlinedButton(onPressed: _load, child: const Text('Try again')),
          ] else
            const Center(child: CircularProgressIndicator()),
        ],
      );
    }

    final isStaff = widget.auth.user?.isStaff ?? false;
    final canTick = order.status == 'assigned' || order.status == 'in_progress';
    final doneCount = order.checklist.where((item) => item.done).length;
    final assignedToMe = order.assignedTo != null && order.assignedTo!.id == widget.auth.user?.id;
    final textTheme = Theme.of(context).textTheme;

    return FormPage(
      title: order.orderNumber,
      children: [
        Text(order.title, style: textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 4,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [StatusChip(status: order.status), PriorityChip(priority: order.priority)],
        ),
        const SizedBox(height: 4),
        Text(
          '${order.customerName.isEmpty ? 'No customer' : order.customerName} · ${categoryLabel(order.category)}',
          style: const TextStyle(color: mutedColor),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Description', style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Text(order.description.isEmpty ? 'No description.' : order.description),
              ],
            ),
          ),
        ),
        if (assignedToMe)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF12261A),
              border: Border.all(color: buttonColor),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Text('Assigned to you', style: TextStyle(color: accentColor, fontWeight: FontWeight.w600)),
          ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Checklist', style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                    if (order.checklist.isNotEmpty)
                      Text('$doneCount of ${order.checklist.length} complete', style: const TextStyle(color: mutedColor)),
                  ],
                ),
                const SizedBox(height: 8),
                if (order.checklist.isEmpty) const Text('No checklist items.'),
                if (order.checklist.isNotEmpty)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(
                      value: doneCount / order.checklist.length,
                      minHeight: 8,
                      semanticsLabel: 'Checklist progress',
                    ),
                  ),
                for (var i = 0; i < order.checklist.length; i++)
                  CheckboxListTile(
                    value: order.checklist[i].done,
                    title: Text(
                      order.checklist[i].task,
                      style: TextStyle(
                        decoration: order.checklist[i].done ? TextDecoration.lineThrough : null,
                        color: order.checklist[i].done ? mutedColor : null,
                      ),
                    ),
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    onChanged: canTick && !_busy ? (_) => _toggleTask(order, i) : null,
                  ),
                StatusMessage(message: _actionError),
                const SizedBox(height: 8),
                if (order.status == 'assigned')
                  FilledButton(
                    onPressed: _busy ? null : () => _update({'status': 'in_progress'}),
                    child: const Text('Start work'),
                  ),
                if (order.status == 'in_progress') ...[
                  FilledButton(
                    onPressed: _busy || !order.checklistDone ? null : () => _update({'status': 'completed'}),
                    child: const Text('Mark complete'),
                  ),
                  if (!order.checklistDone)
                    const Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: Text(
                        'Check off every task to complete this work order.',
                        style: TextStyle(color: mutedColor),
                      ),
                    ),
                ],
              ],
            ),
          ),
        ),
        Card(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Work order details', style: textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                _detail('Customer', order.customerName),
                _detail('Location', order.location),
                _detail('Category', categoryLabel(order.category)),
                _detail('Priority', priorityLabel(order.priority)),
                _detail('Assigned to', order.assignedTo?.fullName ?? 'Unassigned'),
                _detail('Due date', formatDate(order.dueDate)),
                _detail('Created by', order.createdBy?.fullName ?? 'Unknown'),
                if (order.completedAt != null) _detail('Completed', order.completedAt!.toString().split('.').first),
              ],
            ),
          ),
        ),
        if (isStaff) ..._staffActions(order),
      ],
    );
  }

  Widget _detail(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 110, child: Text(label, style: const TextStyle(color: mutedColor))),
          Expanded(child: Text(value.isEmpty ? '—' : value)),
        ],
      ),
    );
  }

  List<Widget> _staffActions(WorkOrder order) {
    return [
      const SizedBox(height: 8),
      if (!order.isFinal) ...[
        OutlinedButton(onPressed: _busy ? null : () => _edit(order), child: const Text('Edit')),
        const SizedBox(height: 8),
        _AssignCard(
          order: order,
          service: _service,
          busy: _busy,
          onAssign: (technicianId) => _update({'assignedTo': technicianId}),
        ),
        OutlinedButton(onPressed: _busy ? null : () => _cancelOrder(order), child: const Text('Cancel work order')),
      ],
      const SizedBox(height: 8),
      FilledButton(
        style: FilledButton.styleFrom(backgroundColor: dangerButtonColor),
        onPressed: _busy ? null : () => _deleteOrder(order),
        child: const Text('Delete work order'),
      ),
    ];
  }
}

// Staff only: pick an available technician (GET /api/users/technicians) and assign or reassign.
class _AssignCard extends StatefulWidget {
  const _AssignCard({
    required this.order,
    required this.service,
    required this.busy,
    required this.onAssign,
  });

  final WorkOrder order;
  final WorkOrderService service;
  final bool busy;
  final ValueChanged<String> onAssign;

  @override
  State<_AssignCard> createState() => _AssignCardState();
}

class _AssignCardState extends State<_AssignCard> {
  late final Future<List<Technician>> _technicians = widget.service.technicians();
  String _chosen = '';

  @override
  Widget build(BuildContext context) {
    final verb = widget.order.assignedTo == null ? 'Assign' : 'Reassign';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: FutureBuilder<List<Technician>>(
          future: _technicians,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Text('Loading technicians...');
            }
            final error = snapshot.error;
            if (error != null) return StatusMessage(message: errorMessage(error));
            final options = {
              '': 'Choose a technician',
              for (final t in snapshot.data!) t.id: t.fullName,
            };
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('$verb technician', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 12),
                LabeledDropdown(
                  label: 'Technician',
                  value: _chosen,
                  options: options,
                  onChanged: (value) => setState(() => _chosen = value),
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: _chosen.isEmpty || widget.busy ? null : () => widget.onAssign(_chosen),
                  child: Text(verb),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
