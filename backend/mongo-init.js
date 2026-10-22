// mongo-init.js
// Runs ONCE, automatically, the first time the MongoDB container starts with an
// empty data volume (Docker mounts it into /docker-entrypoint-initdb.d/).
// To run it again: `docker compose down -v` then `docker compose up -d`.
//
// It creates the WorkOrderDB database with two collections:
//   users       - everyone who uses the system (admins, dispatchers, technicians)
//   workorders  - IT service jobs; each one points back to users twice:
//                 createdBy  -> users._id  (who opened the request)
//                 assignedTo -> users._id  (which technician is doing it, or null)

db = db.getSiblingDB('WorkOrderDB');

// ---------------------------------------------------------------------------
// 1. Collections with validation rules
//    MongoDB doesn't require a fixed structure, so we add a $jsonSchema
//    validator: every document must have these fields with these types, or the
//    insert/update is rejected. This keeps every document in a collection
//    consistent. (Visible in Compass on each collection's "Validation" tab.)
// ---------------------------------------------------------------------------

db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['firstName', 'lastName', 'login', 'email', 'password', 'role',
                 'skills', 'phone', 'isAvailable', 'emailVerified', 'createdAt'],
      additionalProperties: false,
      properties: {
        _id:           { bsonType: 'objectId' },
        firstName:     { bsonType: 'string', minLength: 1 },
        lastName:      { bsonType: 'string', minLength: 1 },
        login:         { bsonType: 'string', minLength: 3 },
        email:         { bsonType: 'string', pattern: '^.+@.+\\..+$' },
        password:      { bsonType: 'string', description: 'bcrypt hash, never plain text' },
        role:          { enum: ['admin', 'dispatcher', 'technician'] },
        skills:        { bsonType: 'array', items: { bsonType: 'string' } },
        phone:         { bsonType: 'string' },
        isAvailable:   { bsonType: 'bool' },
        emailVerified: { bsonType: 'bool' },
        createdAt:     { bsonType: 'date' }
      }
    }
  },
  validationLevel: 'strict',
  validationAction: 'error'
});

db.createCollection('workorders', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['orderNumber', 'title', 'description', 'customerName', 'location',
                 'category', 'priority', 'status', 'checklist', 'createdBy',
                 'assignedTo', 'dueDate', 'completedAt', 'createdAt', 'updatedAt'],
      additionalProperties: false,
      properties: {
        _id:          { bsonType: 'objectId' },
        orderNumber:  { bsonType: 'string', pattern: '^WO-[0-9]+$' },
        title:        { bsonType: 'string', minLength: 1 },
        description:  { bsonType: 'string' },
        customerName: { bsonType: 'string' },
        location:     { bsonType: 'string' },
        category:     { enum: ['network', 'hardware', 'software', 'security', 'account'] },
        priority:     { enum: ['low', 'medium', 'high', 'critical'] },
        status:       { enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'] },
        checklist: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['task', 'done'],
            additionalProperties: false,
            properties: {
              task: { bsonType: 'string' },
              done: { bsonType: 'bool' }
            }
          }
        },
        createdBy:   { bsonType: 'objectId', description: 'references users._id' },
        assignedTo:  { bsonType: ['objectId', 'null'], description: 'references users._id; null until assigned' },
        dueDate:     { bsonType: 'date' },
        completedAt: { bsonType: ['date', 'null'], description: 'null until completed' },
        createdAt:   { bsonType: 'date' },
        updatedAt:   { bsonType: 'date' }
      }
    }
  },
  validationLevel: 'strict',
  validationAction: 'error'
});

// ---------------------------------------------------------------------------
// 2. Indexes (Compass: "Indexes" tab)
//    unique indexes stop duplicate logins/emails/order numbers;
//    the others make the dashboard's common lookups fast.
// ---------------------------------------------------------------------------

db.users.createIndex({ login: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.workorders.createIndex({ orderNumber: 1 }, { unique: true });
db.workorders.createIndex({ assignedTo: 1, status: 1 });  // "my open jobs" for a technician
db.workorders.createIndex({ status: 1, priority: 1 });    // dispatcher queue

// ---------------------------------------------------------------------------
// 3. Test users
//    Every test account's password is: Password123!
//    (stored only as this bcrypt hash)
// ---------------------------------------------------------------------------

const PASSWORD_HASH = '$2b$10$rTA4yX08oav0glRZeyRHpukk9/XUhF7c.H28rkUkWvHGZD.i/4Ose';

function user(firstName, lastName, login, role, skills, phone, isAvailable, emailVerified, createdAt) {
  return {
    _id: new ObjectId(),
    firstName,
    lastName,
    login,
    email: login + '@fieldops.test',
    password: PASSWORD_HASH,
    role,
    skills,
    phone,
    isAvailable,
    emailVerified,
    createdAt: new Date(createdAt)
  };
}

const u = {
  admin:    user('Alicia',  'Moreno',  'amoreno',  'admin',      [],                               '407-555-0101', true,  true,  '2026-09-01T13:00:00Z'),
  dispatch: user('Derek',   'Chen',    'dchen',    'dispatcher', [],                               '407-555-0102', true,  true,  '2026-09-01T13:05:00Z'),
  dispatch2:user('Priya',   'Natarajan','pnatarajan','dispatcher', [],                             '407-555-0103', true,  true,  '2026-09-02T14:00:00Z'),
  tech1:    user('Marcus',  'Johnson', 'mjohnson', 'technician', ['network', 'hardware'],          '407-555-0110', false, true,  '2026-09-03T12:00:00Z'),
  tech2:    user('Sofia',   'Ramirez', 'sramirez', 'technician', ['software', 'account'],          '407-555-0111', true,  true,  '2026-09-03T12:10:00Z'),
  tech3:    user('Kevin',   'Okafor',  'kokafor',  'technician', ['security', 'network'],          '407-555-0112', true,  true,  '2026-09-04T15:30:00Z'),
  tech4:    user('Hannah',  'Lee',     'hlee',     'technician', ['hardware', 'software'],         '407-555-0113', false, true,  '2026-09-05T16:45:00Z'),
  tech5:    user('Tyler',   'Brooks',  'tbrooks',  'technician', ['network', 'security', 'hardware'], '407-555-0114', true, false, '2026-10-20T18:00:00Z')
};

db.users.insertMany(Object.values(u));

// ---------------------------------------------------------------------------
// 4. Test work orders
//    createdBy / assignedTo hold the _id of a user above: the "foreign key"
//    link between the two collections.
// ---------------------------------------------------------------------------

let nextNumber = 1001;
function order(o) {
  const now = new Date(o.createdAt);
  return {
    _id: new ObjectId(),
    orderNumber: 'WO-' + (nextNumber++),
    title: o.title,
    description: o.description,
    customerName: o.customerName,
    location: o.location,
    category: o.category,
    priority: o.priority,
    status: o.status,
    checklist: o.checklist.map(([task, done]) => ({ task, done })),
    createdBy: o.createdBy._id,
    assignedTo: o.assignedTo ? o.assignedTo._id : null,
    dueDate: new Date(o.dueDate),
    completedAt: o.completedAt ? new Date(o.completedAt) : null,
    createdAt: now,
    updatedAt: new Date(o.updatedAt || o.createdAt)
  };
}

db.workorders.insertMany([
  order({
    title: 'Office Wi-Fi keeps disconnecting',
    description: 'Wi-Fi drops every 10-15 minutes. Twelve employees are affected.',
    customerName: 'Lakeside Dental Group', location: '1200 Lake Ave, Orlando, FL',
    category: 'network', priority: 'high', status: 'in_progress',
    checklist: [['Check access point logs', true], ['Update AP firmware', true], ['Check for channel interference', false], ['Confirm stable for 1 hour', false]],
    createdBy: u.admin, assignedTo: u.tech1,
    dueDate: '2026-10-23T21:00:00Z', createdAt: '2026-10-21T14:12:00Z', updatedAt: '2026-10-22T15:40:00Z'
  }),
  order({
    title: 'New hire laptop setup',
    description: 'Set up a laptop for a new accountant starting Monday: image, Office, VPN.',
    customerName: 'Brightline Accounting', location: '55 Orange Ave Suite 400, Orlando, FL',
    category: 'hardware', priority: 'medium', status: 'assigned',
    checklist: [['Install company image', false], ['Install Microsoft Office', false], ['Configure VPN', false], ['Hand off to employee', false]],
    createdBy: u.dispatch, assignedTo: u.tech4,
    dueDate: '2026-10-26T13:00:00Z', createdAt: '2026-10-22T13:00:00Z'
  }),
  order({
    title: 'Suspicious login alerts',
    description: 'Several users got MFA prompts they did not request overnight.',
    customerName: 'Sunrise Property Management', location: '890 Colonial Dr, Orlando, FL',
    category: 'security', priority: 'critical', status: 'in_progress',
    checklist: [['Review sign-in logs', true], ['Reset affected passwords', false], ['Block suspicious IPs', false], ['Write incident summary', false]],
    createdBy: u.admin, assignedTo: u.tech3,
    dueDate: '2026-10-22T22:00:00Z', createdAt: '2026-10-22T11:30:00Z', updatedAt: '2026-10-22T14:05:00Z'
  }),
  order({
    title: 'Printer offline on 2nd floor',
    description: 'HP LaserJet shows offline for all users on floor 2.',
    customerName: 'Brightline Accounting', location: '55 Orange Ave Suite 400, Orlando, FL',
    category: 'hardware', priority: 'low', status: 'completed',
    checklist: [['Check network cable and IP', true], ['Reinstall print driver', true], ['Print test page', true]],
    createdBy: u.dispatch, assignedTo: u.tech4,
    dueDate: '2026-10-15T21:00:00Z', completedAt: '2026-10-14T19:20:00Z',
    createdAt: '2026-10-13T15:00:00Z', updatedAt: '2026-10-14T19:20:00Z'
  }),
  order({
    title: 'Email not syncing on phones',
    description: 'Staff phones stopped receiving email after the password policy change.',
    customerName: 'Lakeside Dental Group', location: '1200 Lake Ave, Orlando, FL',
    category: 'account', priority: 'medium', status: 'completed',
    checklist: [['Identify affected accounts', true], ['Re-add mail profiles', true], ['Confirm sync on each phone', true]],
    createdBy: u.dispatch2, assignedTo: u.tech2,
    dueDate: '2026-10-10T21:00:00Z', completedAt: '2026-10-09T17:45:00Z',
    createdAt: '2026-10-08T14:00:00Z', updatedAt: '2026-10-09T17:45:00Z'
  }),
  order({
    title: 'Install accounting software update',
    description: 'QuickBooks needs the 2026 R4 update on 6 workstations.',
    customerName: 'Brightline Accounting', location: '55 Orange Ave Suite 400, Orlando, FL',
    category: 'software', priority: 'medium', status: 'pending',
    checklist: [['Back up company file', false], ['Install update on 6 PCs', false], ['Verify multi-user mode', false]],
    createdBy: u.admin, assignedTo: null,
    dueDate: '2026-10-28T21:00:00Z', createdAt: '2026-10-22T16:10:00Z'
  }),
  order({
    title: 'Firewall rule request for new vendor',
    description: 'Allow the new imaging vendor to reach the X-ray server over VPN.',
    customerName: 'Lakeside Dental Group', location: '1200 Lake Ave, Orlando, FL',
    category: 'security', priority: 'high', status: 'pending',
    checklist: [['Get vendor IP ranges', false], ['Create restricted VPN rule', false], ['Test vendor access', false]],
    createdBy: u.dispatch, assignedTo: null,
    dueDate: '2026-10-24T21:00:00Z', createdAt: '2026-10-22T17:30:00Z'
  }),
  order({
    title: 'Conference room display not working',
    description: 'TV in the main conference room shows "no signal" from the HDMI wall plate.',
    customerName: 'Sunrise Property Management', location: '890 Colonial Dr, Orlando, FL',
    category: 'hardware', priority: 'low', status: 'assigned',
    checklist: [['Test HDMI cable', false], ['Test wall plate', false], ['Replace faulty part', false]],
    createdBy: u.dispatch2, assignedTo: u.tech1,
    dueDate: '2026-10-27T21:00:00Z', createdAt: '2026-10-21T19:00:00Z'
  }),
  order({
    title: 'Reset locked-out user account',
    description: 'Front desk user locked out after too many attempts.',
    customerName: 'Lakeside Dental Group', location: '1200 Lake Ave, Orlando, FL',
    category: 'account', priority: 'medium', status: 'completed',
    checklist: [['Verify identity with manager', true], ['Unlock and reset password', true]],
    createdBy: u.dispatch, assignedTo: u.tech2,
    dueDate: '2026-10-20T15:00:00Z', completedAt: '2026-10-20T13:25:00Z',
    createdAt: '2026-10-20T12:50:00Z', updatedAt: '2026-10-20T13:25:00Z'
  }),
  order({
    title: 'Slow internet at branch office',
    description: 'Speed tests show 10 Mbps on a 500 Mbps line since yesterday.',
    customerName: 'Sunrise Property Management', location: '42 Park Ave, Winter Park, FL',
    category: 'network', priority: 'high', status: 'assigned',
    checklist: [['Run speed test at modem', false], ['Check switch for errors', false], ['Open ticket with ISP if needed', false]],
    createdBy: u.admin, assignedTo: u.tech5,
    dueDate: '2026-10-23T18:00:00Z', createdAt: '2026-10-22T12:15:00Z'
  }),
  order({
    title: 'Antivirus expired on reception PC',
    description: 'Security center reports antivirus subscription expired.',
    customerName: 'Brightline Accounting', location: '55 Orange Ave Suite 400, Orlando, FL',
    category: 'security', priority: 'medium', status: 'cancelled',
    checklist: [['Renew license', false]],
    createdBy: u.dispatch2, assignedTo: null,
    dueDate: '2026-10-18T21:00:00Z', createdAt: '2026-10-16T14:00:00Z', updatedAt: '2026-10-16T18:00:00Z'
  }),
  order({
    title: 'Set up shared drive permissions',
    description: 'Create a Finance folder that only the finance team can open.',
    customerName: 'Brightline Accounting', location: '55 Orange Ave Suite 400, Orlando, FL',
    category: 'account', priority: 'low', status: 'in_progress',
    checklist: [['Create security group', true], ['Create folder and set permissions', false], ['Test with a finance user', false]],
    createdBy: u.dispatch, assignedTo: u.tech2,
    dueDate: '2026-10-25T21:00:00Z', createdAt: '2026-10-21T15:00:00Z', updatedAt: '2026-10-22T13:30:00Z'
  })
]);

print('WorkOrderDB seeded: ' + db.users.countDocuments() + ' users, ' + db.workorders.countDocuments() + ' work orders');
