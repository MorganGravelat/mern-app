import '../models/work_order.dart';
import 'auth_controller.dart';

// The work order calls to the API. Every call sends the access token and refreshes it once if needed.
class WorkOrderService {
  WorkOrderService(this._auth);

  final AuthController _auth;

  // Staff get every work order; a technician gets only their own (the API decides).
  Future<List<WorkOrder>> list({String q = '', String status = '', String priority = ''}) async {
    final query = <String, String>{
      if (q.isNotEmpty) 'q': q,
      if (status.isNotEmpty) 'status': status,
      if (priority.isNotEmpty) 'priority': priority,
    };
    final path = Uri(path: '/api/workorders', queryParameters: query.isEmpty ? null : query).toString();
    final data = await _auth.authedRequest('GET', path);
    return ((data! as Map<String, dynamic>)['workOrders'] as List)
        .cast<Map<String, dynamic>>()
        .map(WorkOrder.fromJson)
        .toList();
  }

  Future<WorkOrder> get(String id) async {
    return _orderFrom(await _auth.authedRequest('GET', '/api/workorders/$id'));
  }

  // Staff only. The API makes the new work order pending and unassigned.
  Future<WorkOrder> create(Map<String, dynamic> body) async {
    return _orderFrom(await _auth.authedRequest('POST', '/api/workorders', body: body));
  }

  // Send only the fields to change. Technicians may send only "status" and "checklist".
  Future<WorkOrder> update(String id, Map<String, dynamic> changes) async {
    return _orderFrom(await _auth.authedRequest('PATCH', '/api/workorders/$id', body: changes));
  }

  Future<void> delete(String id) async {
    await _auth.authedRequest('DELETE', '/api/workorders/$id');
  }

  // Staff only: available technicians for the assignment list.
  Future<List<Technician>> technicians() async {
    final data = await _auth.authedRequest('GET', '/api/users/technicians');
    return ((data! as Map<String, dynamic>)['technicians'] as List)
        .cast<Map<String, dynamic>>()
        .map(Technician.fromJson)
        .toList();
  }

  WorkOrder _orderFrom(Object? data) {
    return WorkOrder.fromJson((data! as Map<String, dynamic>)['workOrder'] as Map<String, dynamic>);
  }
}
