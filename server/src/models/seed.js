const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function seedData() {
  const usersCheck = await db.query('SELECT COUNT(*) as count FROM users');
  const count = parseInt(usersCheck.rows[0].count || 0, 10);
  if (count > 0) {
    console.log('Database already contains data, skipping seed.');
    return;
  }

  console.log('Seeding initial database records...');

  const passwordHashAdmin = await bcrypt.hash('admin123', 10);
  const passwordHashTech = await bcrypt.hash('tech123', 10);

  // Users
  const users = [
    {
      id: 'usr-admin-01',
      username: 'admin',
      email: 'admin@syncguard.internal',
      password_hash: passwordHashAdmin,
      role: 'ADMIN',
      full_name: 'Sarah Connor (Operations Lead)'
    },
    {
      id: 'usr-tech-01',
      username: 'tech1',
      email: 'marcus@syncguard.internal',
      password_hash: passwordHashTech,
      role: 'TECHNICIAN',
      full_name: 'Marcus Vance (Senior Field Tech)'
    },
    {
      id: 'usr-tech-02',
      username: 'tech2',
      email: 'elena@syncguard.internal',
      password_hash: passwordHashTech,
      role: 'TECHNICIAN',
      full_name: 'Elena Rostova (HVAC Specialist)'
    }
  ];

  for (const u of users) {
    await db.query(
      `INSERT INTO users (id, username, email, password_hash, role, full_name)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [u.id, u.username, u.email, u.password_hash, u.role, u.full_name]
    );
  }

  // Devices
  const devices = [
    {
      device_id: 'dev-alpha-01',
      user_id: 'usr-tech-01',
      device_name: 'Rugged Toughbook A (Marcus)'
    },
    {
      device_id: 'dev-beta-02',
      user_id: 'usr-tech-02',
      device_name: 'Field Tablet B (Elena)'
    },
    {
      device_id: 'dev-hq-desk',
      user_id: 'usr-admin-01',
      device_name: 'Operations Console (HQ)'
    }
  ];

  for (const d of devices) {
    await db.query(
      `INSERT INTO devices (device_id, user_id, device_name, is_active)
       VALUES ($1, $2, $3, $4)`,
      [d.device_id, d.user_id, d.device_name, 1]
    );
  }

  // Tasks
  // Notice TASK-7701 starts at version 7 as requested by the Hackathon demo scenario!
  const tasks = [
    {
      id: 'tsk-7701',
      title: 'CNC Milling Unit #4 - Spindle Bearing Inspection',
      description: 'Perform thermal camera scan, vibration diagnostic, and inspect ceramic spindle bearings for pitting.',
      machine_name: 'Haas VF-4 SS CNC Mill',
      location: 'Sector 4 - Heavy Fabrication Bay',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      quantity: 40,
      notes: 'Initial sensor baseline recorded at 42°C. Pre-flight check nominal.',
      assigned_to: 'usr-tech-01',
      version: 7,
      updated_by: 'usr-tech-01'
    },
    {
      id: 'tsk-7702',
      title: 'Substation Transformer Delta-Y Coolant Flush',
      description: 'Drain dielectric oil, test breakdown voltage, flush radiators, and refill with inhibited mineral oil.',
      machine_name: 'Siemens 1500kVA Step-Down Transformer',
      location: 'Substation Alpha-1 Outdoor Yard',
      priority: 'CRITICAL',
      status: 'PENDING',
      quantity: 120,
      notes: 'Lockout/tagout protocol LOTO-092 in effect. High voltage clearance permit secured.',
      assigned_to: 'usr-tech-02',
      version: 3,
      updated_by: 'usr-admin-01'
    },
    {
      id: 'tsk-7703',
      title: 'Air Handling Unit 12 Filter Replacement & Motor Balance',
      description: 'Replace HEPA primary filters, lubricate blower pillow block bearings, and check V-belt tension.',
      machine_name: 'Trane IntelliPak AHU-12',
      location: 'Rooftop Zone B Mechanical Penthouse',
      priority: 'MEDIUM',
      status: 'PENDING',
      quantity: 12,
      notes: 'Quarterly preventative service cycle.',
      assigned_to: 'usr-tech-02',
      version: 1,
      updated_by: 'usr-admin-01'
    },
    {
      id: 'tsk-7704',
      title: 'Hydraulic Press Pump O-Ring Overhaul',
      description: 'Replace high-pressure polyurethane seals, bleed air traps, calibrate relief valve to 320 bar.',
      machine_name: 'Schuler 500-Ton Hydraulic Press',
      location: 'Stamping Plant Hall 2',
      priority: 'HIGH',
      status: 'COMPLETED',
      quantity: 8,
      notes: 'All seal tolerances within +/- 0.02mm. Runout test passed 100 cycles.',
      assigned_to: 'usr-tech-01',
      version: 4,
      updated_by: 'usr-tech-01'
    }
  ];

  for (const t of tasks) {
    await db.query(
      `INSERT INTO tasks (id, title, description, machine_name, location, priority, status, quantity, notes, assigned_to, version, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [t.id, t.title, t.description, t.machine_name, t.location, t.priority, t.status, t.quantity, t.notes, t.assigned_to, t.version, t.updated_by]
    );

    // Initial update history log for tasks
    await db.query(
      `INSERT INTO task_updates (id, task_id, version, changed_fields, snapshot, updated_by, device_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        `upd-${t.id}-${t.version}`,
        t.id,
        t.version,
        JSON.stringify(['title', 'status', 'quantity']),
        JSON.stringify(t),
        t.updated_by,
        'dev-hq-desk'
      ]
    );
  }

  // Checklists
  const checklists = [
    { id: 'chk-7701-1', task_id: 'tsk-7701', item_text: 'Lockout electrical mains & disconnect air supply', is_completed: 1, order_index: 1, version: 1 },
    { id: 'chk-7701-2', task_id: 'tsk-7701', item_text: 'Inspect drive belt alignment and pulley wear', is_completed: 1, order_index: 2, version: 1 },
    { id: 'chk-7701-3', task_id: 'tsk-7701', item_text: 'Measure spindle radial runout with dial indicator (<0.005mm)', is_completed: 0, order_index: 3, version: 1 },
    { id: 'chk-7701-4', task_id: 'tsk-7701', item_text: 'Replenish synthetic spindle grease (Kluber Isoflex NBU 15)', is_completed: 0, order_index: 4, version: 1 },

    { id: 'chk-7702-1', task_id: 'tsk-7702', item_text: 'Verify zero voltage on high and low sides', is_completed: 1, order_index: 1, version: 1 },
    { id: 'chk-7702-2', task_id: 'tsk-7702', item_text: 'Attach grounding clusters', is_completed: 0, order_index: 2, version: 1 },
    { id: 'chk-7702-3', task_id: 'tsk-7702', item_text: 'Sample oil for dissolved gas analysis (DGA)', is_completed: 0, order_index: 3, version: 1 },

    { id: 'chk-7703-1', task_id: 'tsk-7703', item_text: 'Inspect pre-filter differential pressure gauge', is_completed: 0, order_index: 1, version: 1 },
    { id: 'chk-7703-2', task_id: 'tsk-7703', item_text: 'Replace MERV 14 cartridge filters', is_completed: 0, order_index: 2, version: 1 }
  ];

  for (const c of checklists) {
    await db.query(
      `INSERT INTO task_checklists (id, task_id, item_text, is_completed, order_index, version)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [c.id, c.task_id, c.item_text, c.is_completed, c.order_index, c.version]
    );
  }

  // Activity logs
  await db.query(
    `INSERT INTO activity_logs (id, user_id, user_name, device_id, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      'act-init-01',
      'usr-admin-01',
      'Sarah Connor (Operations Lead)',
      'dev-hq-desk',
      'SYSTEM_INITIALIZED',
      'system',
      'system',
      JSON.stringify({ note: 'SyncGuard base catalog provisioned. Initial tasks and devices active.' })
    ]
  );

  console.log('Database seeded successfully.');
}

module.exports = {
  seedData
};
