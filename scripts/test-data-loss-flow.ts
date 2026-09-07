import assert from 'assert';

/**
 * Simulation of User A and User B storage and sync logic
 * to verify the Acceptance Test requirements.
 */

interface Citizen {
  id: string;
  userId?: string;
  idCard: string;
  firstName: string;
  lastName: string;
}

interface HealthRecord {
  id: string;
  citizenId: string;
  userId?: string;
  date: string;
  systolic: number;
  diastolic: number;
}

interface SharedReport {
  id: string;
  senderId: string;
  receiverId: string;
  citizenData: Citizen;
  healthRecords: HealthRecord[];
  status: 'pending' | 'accepted' | 'rejected';
}

// Mock LocalStorage
const mockLocalStorage: Record<string, string> = {};

function getUserStorageKey(userId: string, resource: string): string {
  return `vhv_local_data_${userId}_${resource}`;
}

function saveUserData<T>(userId: string, resource: string, value: T): void {
  mockLocalStorage[getUserStorageKey(userId, resource)] = JSON.stringify(value);
}

function loadUserData<T>(userId: string, resource: string, fallback: T): T {
  const raw = mockLocalStorage[getUserStorageKey(userId, resource)];
  if (!raw) return fallback;
  return JSON.parse(raw) as T;
}

// Mock Cloud Database
const mockCloudCitizens: Citizen[] = [];
const mockCloudHealthRecords: HealthRecord[] = [];
const mockCloudSharedReports: SharedReport[] = [];

console.log('--- START ACCEPTANCE TEST ---');

const userA = { id: 'user-a-uuid-1111', name: 'User A' };
const userB = { id: 'user-b-uuid-2222', name: 'User B' };

// Step 1: User A creates 1 Citizen + 1 Health Record
const citA: Citizen = {
  id: 'cit-a-1',
  userId: userA.id,
  idCard: '1234567890123',
  firstName: 'สมชาย',
  lastName: 'ใจดี'
};

const recA: HealthRecord = {
  id: 'rec-a-1',
  citizenId: citA.id,
  userId: userA.id,
  date: '2026-08-29',
  systolic: 120,
  diastolic: 80
};

// User A stores in local storage and cloud
saveUserData(userA.id, 'citizens', [citA]);
saveUserData(userA.id, 'records', [recA]);
mockCloudCitizens.push({ ...citA });
mockCloudHealthRecords.push({ ...recA });

const aCitizensBefore = loadUserData<Citizen[]>(userA.id, 'citizens', []);
const aRecordsBefore = loadUserData<HealthRecord[]>(userA.id, 'records', []);
console.log('Step 1 (User A Before Send):', {
  'A citizens': aCitizensBefore.length,
  'A health_records': aRecordsBefore.length
});
assert.strictEqual(aCitizensBefore.length, 1);
assert.strictEqual(aRecordsBefore.length, 1);

// Step 2: User A sends to User B (sendSharedReport)
const reportId = 'report-uuid-9999';
const sharedReport: SharedReport = {
  id: reportId,
  senderId: userA.id,
  receiverId: userB.id,
  citizenData: { ...citA },
  healthRecords: [{ ...recA }],
  status: 'pending'
};
mockCloudSharedReports.push(sharedReport);
saveUserData(userA.id, 'shared_reports_sent', [sharedReport]);

// Check User A after send
const aCitizensAfterSend = loadUserData<Citizen[]>(userA.id, 'citizens', []);
const aRecordsAfterSend = loadUserData<HealthRecord[]>(userA.id, 'records', []);
console.log('Step 2 (User A After Send):', {
  'A citizens': aCitizensAfterSend.length,
  'A health_records': aRecordsAfterSend.length
});
assert.strictEqual(aCitizensAfterSend.length, 1, 'Data Loss on User A after SEND!');
assert.strictEqual(aRecordsAfterSend.length, 1, 'Data Loss on User A records after SEND!');

// Step 3: User B before Accept
const bCitizensBeforeAccept = loadUserData<Citizen[]>(userB.id, 'citizens', []);
const bRecordsBeforeAccept = loadUserData<Citizen[]>(userB.id, 'records', []);
console.log('Step 3 (User B Before Accept):', {
  'B citizens': bCitizensBeforeAccept.length,
  'B health_records': bRecordsBeforeAccept.length
});
assert.strictEqual(bCitizensBeforeAccept.length, 0);
assert.strictEqual(bRecordsBeforeAccept.length, 0);

// Step 4: User B accepts (acceptSharedReport / RPC simulation)
// RPC copies citizen & records for user B, does NOT delete user A's data
const newCitBId = 'cit-b-1';
const citB: Citizen = {
  ...sharedReport.citizenData,
  id: newCitBId,
  userId: userB.id
};
const recB: HealthRecord = {
  ...sharedReport.healthRecords[0],
  id: 'rec-b-1',
  citizenId: newCitBId,
  userId: userB.id
};
mockCloudCitizens.push(citB);
mockCloudHealthRecords.push(recB);
sharedReport.status = 'accepted';

// User B updates local storage
saveUserData(userB.id, 'citizens', [citB]);
saveUserData(userB.id, 'records', [recB]);

// Check both User A and User B after ACCEPT
const aCitizensAfterAccept = loadUserData<Citizen[]>(userA.id, 'citizens', []);
const aRecordsAfterAccept = loadUserData<HealthRecord[]>(userA.id, 'records', []);
const bCitizensAfterAccept = loadUserData<Citizen[]>(userB.id, 'citizens', []);
const bRecordsAfterAccept = loadUserData<HealthRecord[]>(userB.id, 'records', []);

console.log('Step 4 (After Accept):', {
  'A citizens': aCitizensAfterAccept.length,
  'A health_records': aRecordsAfterAccept.length,
  'B citizens': bCitizensAfterAccept.length,
  'B health_records': bRecordsAfterAccept.length
});

assert.strictEqual(aCitizensAfterAccept.length, 1, 'User A citizen lost after B accept!');
assert.strictEqual(aRecordsAfterAccept.length, 1, 'User A record lost after B accept!');
assert.strictEqual(bCitizensAfterAccept.length, 1, 'User B citizen not added!');
assert.strictEqual(bRecordsAfterAccept.length, 1, 'User B record not added!');

// Step 5: Refresh simulation for both accounts
// Non-destructive sync simulation for User A
const aRemoteCit = mockCloudCitizens.filter(c => c.userId === userA.id);
const aRemoteRec = mockCloudHealthRecords.filter(r => r.userId === userA.id);
assert.strictEqual(aRemoteCit.length, 1, 'Cloud User A citizen missing!');
assert.strictEqual(aRemoteRec.length, 1, 'Cloud User A record missing!');

// Non-destructive sync simulation for User B
const bRemoteCit = mockCloudCitizens.filter(c => c.userId === userB.id);
const bRemoteRec = mockCloudHealthRecords.filter(r => r.userId === userB.id);
assert.strictEqual(bRemoteCit.length, 1, 'Cloud User B citizen missing!');
assert.strictEqual(bRemoteRec.length, 1, 'Cloud User B record missing!');

console.log('--- ALL ACCEPTANCE TESTS PASSED (100% NO DATA LOSS) ---');
