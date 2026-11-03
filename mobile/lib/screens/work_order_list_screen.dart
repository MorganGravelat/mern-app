import 'package:flutter/material.dart';

import '../models/work_order.dart';
import '../services/api_client.dart';
import '../services/auth_controller.dart';
import '../services/work_order_service.dart';
import '../theme.dart';
import '../widgets/chips.dart';
import '../widgets/labeled_dropdown.dart';
import 'account_screen.dart';
import 'work_order_detail_screen.dart';
import 'work_order_form_screen.dart';

// The home screen after login: a list with search and filters.
class WorkOrderListScreen extends StatefulWidget {
  const WorkOrderListScreen({super.key, required this.auth});

  final AuthController auth;

  @override
  State<WorkOrderListScreen> createState() => _WorkOrderListScreenState();
}

class _WorkOrderListScreenState extends State<WorkOrderListScreen> {
  late final WorkOrderService _service = WorkOrderService(widget.auth);
  final _search = TextEditingController();
  String _status = '';
  String _priority = '';
  late Future<List<WorkOrder>> _orders;

  @override
  void initState() {
    super.initState();
    _orders = _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<List<WorkOrder>> _load() {
    return _service.list(q: _search.text.trim(), status: _status, priority: _priority);
  }

  void _reload() {
    setState(() {
      _orders = _load();
    });
  }

  Future<void> _refresh() async {
    _reload();
    try {
      await _orders;
    } catch (_) {
      // The error is shown by the list itself.
    }
  }

  void _clearFilters() {
    _search.clear();
    _status = '';
    _priority = '';
    _reload();
  }

  // The detail and form screens send back "true" when something changed, so the list is reloaded.
  Future<void> _open(Widget screen) async {
    await Navigator.of(context).push<bool>(MaterialPageRoute<bool>(builder: (_) => screen));
    if (mounted) _reload();
  }

  @override
  Widget build(BuildContext context) {
    final isStaff = widget.auth.user?.isStaff ?? false;
    return Scaffold(
      appBar: AppBar(
        title: const OpsFlowBrand(),
        actions: [
          IconButton(
            icon: const Icon(Icons.account_circle),
            tooltip: 'Account',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => AccountScreen(auth: widget.auth)),
            ),
          ),
        ],
      ),
      floatingActionButton: isStaff
          ? FloatingActionButton.extended(
              onPressed: () => _open(WorkOrderFormScreen(auth: widget.auth)),
              icon: const Icon(Icons.add),
              label: const Text('New work order'),
            )
          : null,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: RefreshIndicator(
              onRefresh: _refresh,
              child: FutureBuilder<List<WorkOrder>>(
                future: _orders,
                builder: _buildBody,
              ),
            ),
          ),
        ),
      ),
    );
  }

  // One scrolling page: title, filters, then the results. The header and filters always
  // stay at the same positions, so typing in the search box is not interrupted by a reload.
  Widget _buildBody(BuildContext context, AsyncSnapshot<List<WorkOrder>> snapshot) {
    final isStaff = widget.auth.user?.isStaff ?? false;
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      // Extra space at the bottom so the New work order button does not cover the last card.
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 96),
      children: [
        _buildHeader(isStaff),
        _buildFilters(),
        ..._buildResults(context, snapshot, isStaff),
      ],
    );
  }

  Widget _buildHeader(bool isStaff) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 0, 4, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(isStaff ? 'WORKSPACE / DISPATCH' : 'WORKSPACE / MY JOBS', style: monoStyle(size: 12)),
          Text(
            'Work orders',
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          Text(
            isStaff ? 'Create, assign, and track IT service requests.' : 'Your assigned IT service requests.',
            style: const TextStyle(color: mutedColor),
          ),
        ],
      ),
    );
  }

  Widget _buildFilters() {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _search,
              textInputAction: TextInputAction.search,
              decoration: const InputDecoration(labelText: 'Search', hintText: 'Title or order number'),
              onSubmitted: (_) => _reload(),
            ),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: LabeledDropdown(
                    label: 'Status',
                    value: _status,
                    options: {'': 'All statuses', for (final s in workOrderStatuses) s: statusLabel(s)},
                    onChanged: (value) => setState(() => _status = value),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: LabeledDropdown(
                    label: 'Priority',
                    value: _priority,
                    options: {'': 'All priorities', for (final p in workOrderPriorities) p: priorityLabel(p)},
                    onChanged: (value) => setState(() => _priority = value),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: OutlinedButton(onPressed: _reload, child: const Text('Apply filters'))),
                const SizedBox(width: 8),
                TextButton(onPressed: _clearFilters, child: const Text('Clear')),
              ],
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildResults(BuildContext context, AsyncSnapshot<List<WorkOrder>> snapshot, bool isStaff) {
    if (snapshot.connectionState != ConnectionState.done) {
      return const [Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator()))];
    }
    final error = snapshot.error;
    if (error != null) {
      return [
        Text(errorMessage(error), style: const TextStyle(color: errorColor)),
        const SizedBox(height: 12),
        OutlinedButton(onPressed: _reload, child: const Text('Try again')),
      ];
    }
    final orders = snapshot.data!;
    if (orders.isEmpty) {
      return [Text(isStaff ? 'No work orders match.' : 'No work orders are assigned to you right now.')];
    }
    return [
      Padding(
        padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('${orders.length} work ${orders.length == 1 ? 'order' : 'orders'}', style: const TextStyle(color: mutedColor)),
            // The API sorts by creation date, newest first (backend/src/routes/workorders.js).
            const Text('Newest first', style: TextStyle(color: mutedColor)),
          ],
        ),
      ),
      for (final order in orders) _buildOrderCard(order),
    ];
  }

  Widget _buildOrderCard(WorkOrder order) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _open(WorkOrderDetailScreen(auth: widget.auth, orderId: order.id)),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(order.orderNumber, style: monoStyle(size: 13)),
              Text(order.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              if (order.customerName.isNotEmpty)
                Text(order.customerName, style: const TextStyle(color: mutedColor)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [StatusChip(status: order.status), PriorityChip(priority: order.priority)],
              ),
              const SizedBox(height: 8),
              Text(
                '${order.assignedTo?.fullName ?? 'Unassigned'} · Due ${formatDate(order.dueDate)}',
                style: const TextStyle(color: mutedColor, fontSize: 13),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
