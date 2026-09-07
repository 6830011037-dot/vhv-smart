import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  AuthUser, 
  Citizen, 
  HealthRecord, 
  VhvProfile, 
  ActiveTab,
  HouseholdSummary,
  SharedReport,
  SyncStatus
} from '../types';
import { 
  supabase, 
  phoneToAuthEmail, 
  isSupabaseConfigured,
  mapCitizenToSupabase,
  mapSupabaseToCitizen,
  mapHealthRecordToSupabase,
  mapSupabaseToHealthRecord,
  mapProfileToSupabase,
  mapSupabaseToProfile,
  mapSharedReportToSupabase,
  mapSupabaseToSharedReport,
  lookupReceiverProfile,
  getDeterministicImportedCitizenId,
  getDeterministicImportedRecordId,
  isAuthError,
  ensureValidSession,
  executeWithAuthRetry
} from '../lib/supabase';
import { createExcelWorkbookBase64, downloadExcelFromBase64 } from '../utils/exportUtils';

interface AppContextType {
  user: AuthUser | null;
  authLoading: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  syncStatus: SyncStatus;
  supabaseConnected: boolean;
  
  // Auth actions
  loginWithPhone: (phone: string, birthDate: string) => Promise<{ success: boolean; message?: string }>;
  signUpWithPhone: (profileData: VhvProfile) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  
  // Profile
  vhvProfile: VhvProfile;
  updateProfile: (profile: Partial<VhvProfile>) => Promise<void>;
  
  // Citizens
  citizens: Citizen[];
  addCitizen: (citizen: Omit<Citizen, 'id' | 'createdAt'>) => Promise<Citizen>;
  updateCitizen: (id: string, updates: Partial<Citizen>) => Promise<void>;
  deleteCitizen: (id: string) => Promise<void>;
  
  // Health Records
  records: HealthRecord[];
  addHealthRecord: (record: Omit<HealthRecord, 'id' | 'createdAt'>) => Promise<HealthRecord>;
  deleteHealthRecord: (id: string) => Promise<void>;
  
  // Direct Phone-to-Phone / Cross-User Report Transfer
  sharedReportsReceived: SharedReport[];
  sharedReportsSent: SharedReport[];
  unreadReceivedCount: number;
  sendSharedReport: (params: { 
    citizen: Citizen; 
    records?: HealthRecord[]; 
    receiverId?: string;
    receiverPhone?: string; 
    receiverEmail?: string;
    receiverName?: string;
    title?: string; 
    note?: string; 
  }) => Promise<{ success: boolean; message: string; report?: SharedReport }>;
  sendReportToPhone: (params: { 
    receiverPhone: string; 
    title?: string; 
    note?: string; 
    records: HealthRecord[]; 
    periodLabel?: string; 
  }) => Promise<{ success: boolean; message: string; report?: SharedReport }>;
  acceptSharedReport: (report: SharedReport) => Promise<{ success: boolean; message: string; importedCitizens: number; importedRecords: number }>;
  rejectSharedReport: (reportId: string, reason?: string) => Promise<{ success: boolean; message: string }>;
  downloadSharedReport: (report: SharedReport) => void;
  importSharedReport: (report: SharedReport) => Promise<{ success: boolean; message: string; importedCitizens: number; importedRecords: number }>;
  deleteSharedReport: (reportId: string) => Promise<{ success: boolean; message: string }>;
  fetchSharedReports: () => Promise<void>;

  // Utilities
  clearAllRecords: () => void;
  clearAllData: () => void;
  syncWithSupabase: () => Promise<{ success: boolean; message: string }>;
  
  fontSize: 'sm' | 'md' | 'lg';
  setFontSize: (size: 'sm' | 'md' | 'lg') => void;
  
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;

  analyticsViewMode: 'overview' | 'individual';
  setAnalyticsViewMode: (mode: 'overview' | 'individual') => void;

  inboxActiveTab: 'manage' | 'send' | 'receive';
  setInboxActiveTab: (tab: 'manage' | 'send' | 'receive') => void;

  pendingSyncCount: number;
  
  selectedCitizenForProfile: Citizen | null;
  setSelectedCitizenForProfile: (citizen: Citizen | null) => void;
  
  selectedCitizenForCheckup: Citizen | null;
  setSelectedCitizenForCheckup: (citizen: Citizen | null) => void;

  households: HouseholdSummary[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USER: 'vhv_local_user',
  LEGACY_CITIZENS: 'vhv_local_citizens',
  LEGACY_RECORDS: 'vhv_local_records',
  LEGACY_PROFILE: 'vhv_local_profile',
  LEGACY_FONT_SIZE: 'vhv_local_font_size',
  LEGACY_SHARED_REPORTS: 'vhv_local_shared_reports',
  LEGACY_SHARED_REPORTS_SENT: 'vhv_local_shared_reports_sent',
  LEGACY_GLOBAL_QUEUE: 'vhv_pending_sync_queue',
  ORPHANED_QUEUE: 'vhv_orphaned_sync_queue',
};

// Storage helper functions for user data isolation
export function getUserStorageKey(userId: string, resource: string): string {
  return `vhv_local_data_${userId}_${resource}`;
}

export function getSyncQueueStorageKey(userId: string): string {
  return `vhv_sync_queue_${userId}`;
}

export function getFailedQueueStorageKey(userId: string): string {
  return `vhv_failed_sync_queue_${userId}`;
}

export function loadUserData<T>(userId: string, resource: string, fallback: T): T {
  try {
    const key = getUserStorageKey(userId, resource);
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // If the stored value was a plain raw string (such as legacy font_size "md")
      if (typeof fallback === 'string') {
        // Normalize and re-save as valid JSON
        try {
          localStorage.setItem(key, JSON.stringify(raw));
        } catch {}
        return raw as unknown as T;
      }
      return fallback;
    }
  } catch (error) {
    console.error(`[LocalStorage] Load failed: ${resource}`, error);
    return fallback;
  }
}

export function saveUserData<T>(userId: string, resource: string, value: T): void {
  try {
    const key = getUserStorageKey(userId, resource);
    localStorage.setItem(key, JSON.stringify(value));
    console.log('[LocalStorage] Saved:', key);
  } catch (error) {
    console.error(`[LocalStorage] Save failed: ${resource}`, error);
  }
}

export function debugCurrentUserStorage(userId: string): void {
  const prefix = `vhv_local_data_${userId}_`;
  console.group('[LocalStorage] Current User');
  Object.keys(localStorage)
    .filter(key => key.startsWith(prefix))
    .forEach(key => {
      console.log(key, localStorage.getItem(key));
    });
  console.groupEnd();
}

// One-time migration of legacy flat keys to user-specific keys
function migrateLegacyDataIfNeeded(userId: string): void {
  try {
    const citizensKey = getUserStorageKey(userId, 'citizens');
    const recordsKey = getUserStorageKey(userId, 'records');
    const profileKey = getUserStorageKey(userId, 'profile');
    const fontSizeKey = getUserStorageKey(userId, 'font_size');
    const sharedReportsKey = getUserStorageKey(userId, 'shared_reports');
    const sharedReportsSentKey = getUserStorageKey(userId, 'shared_reports_sent');

    const hasLegacy = localStorage.getItem(STORAGE_KEYS.LEGACY_CITIZENS) ||
                      localStorage.getItem(STORAGE_KEYS.LEGACY_RECORDS) ||
                      localStorage.getItem(STORAGE_KEYS.LEGACY_PROFILE);

    if (hasLegacy) {
      if (!localStorage.getItem(citizensKey) && localStorage.getItem(STORAGE_KEYS.LEGACY_CITIZENS)) {
        const legacyCit = localStorage.getItem(STORAGE_KEYS.LEGACY_CITIZENS);
        if (legacyCit) localStorage.setItem(citizensKey, legacyCit);
      }
      if (!localStorage.getItem(recordsKey) && localStorage.getItem(STORAGE_KEYS.LEGACY_RECORDS)) {
        const legacyRec = localStorage.getItem(STORAGE_KEYS.LEGACY_RECORDS);
        if (legacyRec) localStorage.setItem(recordsKey, legacyRec);
      }
      if (!localStorage.getItem(profileKey) && localStorage.getItem(STORAGE_KEYS.LEGACY_PROFILE)) {
        const legacyProf = localStorage.getItem(STORAGE_KEYS.LEGACY_PROFILE);
        if (legacyProf) localStorage.setItem(profileKey, legacyProf);
      }
      if (!localStorage.getItem(fontSizeKey) && localStorage.getItem(STORAGE_KEYS.LEGACY_FONT_SIZE)) {
        const legacyFont = localStorage.getItem(STORAGE_KEYS.LEGACY_FONT_SIZE);
        if (legacyFont) {
          try {
            JSON.parse(legacyFont);
            localStorage.setItem(fontSizeKey, legacyFont);
          } catch {
            localStorage.setItem(fontSizeKey, JSON.stringify(legacyFont));
          }
        }
      }
      if (!localStorage.getItem(sharedReportsKey) && localStorage.getItem(STORAGE_KEYS.LEGACY_SHARED_REPORTS)) {
        const legacySh = localStorage.getItem(STORAGE_KEYS.LEGACY_SHARED_REPORTS);
        if (legacySh) localStorage.setItem(sharedReportsKey, legacySh);
      }
      if (!localStorage.getItem(sharedReportsSentKey) && localStorage.getItem(STORAGE_KEYS.LEGACY_SHARED_REPORTS_SENT)) {
        const legacyShSent = localStorage.getItem(STORAGE_KEYS.LEGACY_SHARED_REPORTS_SENT);
        if (legacyShSent) localStorage.setItem(sharedReportsSentKey, legacyShSent);
      }

      // Remove legacy keys after migration to prevent data leaking across accounts
      localStorage.removeItem(STORAGE_KEYS.LEGACY_CITIZENS);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_RECORDS);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_PROFILE);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_FONT_SIZE);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_SHARED_REPORTS);
      localStorage.removeItem(STORAGE_KEYS.LEGACY_SHARED_REPORTS_SENT);
      console.log(`[LocalStorage] Migrated legacy data to user: ${userId}`);
    }
  } catch (error) {
    console.error('[LocalStorage] Legacy migration failed:', error);
  }
}

// Sync Queue Types and Helpers for Offline Retry (Strictly User-Scoped)
export type SyncErrorType = 'transient' | 'permanent' | 'auth';

export interface SyncQueueItem {
  id: string;
  userId: string;
  action: 
    | 'upsert_citizen' 
    | 'delete_citizen' 
    | 'upsert_record' 
    | 'delete_record' 
    | 'upsert_profile'
    | 'send_shared_report'
    | 'accept_shared_report'
    | 'reject_shared_report'
    | 'delete_shared_report';
  payload: any;
  timestamp: string;
  retryCount?: number;
  lastAttemptAt?: string;
  lastError?: string;
  errorType?: SyncErrorType;
  nextRetryAt?: number;
}

export interface FailedSyncQueueItem extends SyncQueueItem {
  failedAt: string;
  finalError: string;
}

export const SYNC_OPERATION_TIMEOUT_MS = 15000; // 15 seconds bounded timeout per operation

export const SYNC_RETRY_CONFIG = {
  MAX_RETRIES: 5,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 60000, // 1 minute max backoff
  calculateDelay: (attempt: number): number => {
    // Exponential backoff with random jitter (0 - 500ms)
    const exponential = SYNC_RETRY_CONFIG.BASE_DELAY_MS * Math.pow(2, Math.min(attempt, 6));
    const jitter = Math.floor(Math.random() * 500);
    return Math.min(exponential + jitter, SYNC_RETRY_CONFIG.MAX_DELAY_MS);
  }
};

export const classifySyncError = (err: any): SyncErrorType => {
  if (!err) return 'transient';

  // Offline / network checks
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'transient';
  }

  const message = String(err.message || err.details || err.hint || err || '').toLowerCase();
  const code = String(err.code || err.status || '').toUpperCase();
  const status = Number(err.status || err.statusCode || 0);

  // 1. Permanent RLS / Authorization / Permission denial
  // PostgreSQL 42501 = insufficient_privilege (RLS failure).
  // PostgREST returns 403 / 42501 when RLS policy denies access or user role lacks table permission.
  if (
    code === '42501' ||
    message.includes('row-level security') ||
    message.includes('rls') ||
    message.includes('permission denied') ||
    message.includes('insufficient privilege') ||
    (status === 403 && !message.includes('jwt') && !message.includes('token') && !message.includes('expired'))
  ) {
    return 'permanent';
  }

  // 2. Authentication / Session errors (Recoverable via user login / token refresh)
  if (
    status === 401 ||
    code === 'PGRST301' || // JWT expired
    code === 'PGRST302' || // JWT invalid
    code === 'PGRST303' || // JWT expired
    message.includes('jwt expired') ||
    message.includes('token is expired') ||
    message.includes('jwt') ||
    message.includes('token') ||
    message.includes('unauthorized') ||
    message.includes('not logged in') ||
    message.includes('session expired') ||
    message.includes('auth.uid()')
  ) {
    return 'auth';
  }

  // 3. Transient errors (network, 5xx, 408, 429, timeout, connection drop)
  if (
    status === 408 ||
    status === 429 ||
    (status >= 500 && status <= 599) ||
    status === 0 ||
    code === 'PGRST000' ||
    code === '57014' || // query_canceled / statement_timeout
    code === '53300' || // too_many_connections
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('aborted') ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('connection') ||
    message.includes('offline')
  ) {
    return 'transient';
  }

  // 4. Permanent errors (4xx client/validation/schema errors except 401, 408, 429)
  if (
    (status >= 400 && status < 500) ||
    code === '23502' || // not null violation
    code === '22P02' || // invalid text representation
    code === '42703' || // undefined column
    code === '42P01' || // undefined table
    code === '23503' || // foreign key violation
    code === '23505' || // unique violation
    code === '22001'    // string data right truncation
  ) {
    return 'permanent';
  }

  // Default fallback for unknown database/RPC errors
  return 'transient';
};

export const getSyncQueue = (userId: string): SyncQueueItem[] => {
  if (!userId || typeof userId !== 'string') return [];
  try {
    const raw = localStorage.getItem(getSyncQueueStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Strictly isolate: return only items belonging to this userId
    return parsed.filter((item): item is SyncQueueItem => Boolean(item && item.userId === userId));
  } catch (e) {
    console.error(`[SyncQueue] Failed to read queue for user ${userId}:`, e);
    return [];
  }
};

export const saveSyncQueue = (userId: string, queue: SyncQueueItem[]): void => {
  if (!userId || typeof userId !== 'string') return;
  try {
    // Strictly isolate: only persist items belonging to this userId
    const safeQueue = queue.filter(item => Boolean(item && item.userId === userId));
    localStorage.setItem(getSyncQueueStorageKey(userId), JSON.stringify(safeQueue));
  } catch (e) {
    console.error(`[SyncQueue] Failed to save queue for user ${userId}:`, e);
  }
};

export const getFailedSyncQueue = (userId: string): FailedSyncQueueItem[] => {
  if (!userId || typeof userId !== 'string') return [];
  try {
    const raw = localStorage.getItem(getFailedQueueStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is FailedSyncQueueItem => Boolean(item && item.userId === userId));
  } catch (e) {
    console.error(`[SyncQueue] Failed to read dead-letter queue for user ${userId}:`, e);
    return [];
  }
};

export const saveFailedSyncQueue = (userId: string, queue: FailedSyncQueueItem[]): void => {
  if (!userId || typeof userId !== 'string') return;
  try {
    const safeQueue = queue.filter(item => Boolean(item && item.userId === userId));
    // Keep max 100 recent failed items per user to avoid unbounded storage
    const trimmed = safeQueue.slice(-100);
    localStorage.setItem(getFailedQueueStorageKey(userId), JSON.stringify(trimmed));
  } catch (e) {
    console.error(`[SyncQueue] Failed to save dead-letter queue for user ${userId}:`, e);
  }
};

export const addFailedSyncQueueItem = (userId: string, item: FailedSyncQueueItem): void => {
  if (!userId || typeof userId !== 'string') return;
  const existing = getFailedSyncQueue(userId);
  const filtered = existing.filter(i => i.id !== item.id);
  filtered.push(item);
  saveFailedSyncQueue(userId, filtered);
  console.warn(`[SyncQueue] Moved item ${item.id} (${item.action}) to dead-letter queue for user ${userId}. Reason: ${item.finalError}`);
};

export const addToSyncQueue = (
  userId: string, 
  item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'userId'> & { userId?: string }
): void => {
  if (!userId || typeof userId !== 'string') {
    console.warn('[SyncQueue] Cannot addToSyncQueue without a valid authenticated userId');
    return;
  }
  const queue = getSyncQueue(userId);
  const newItem: SyncQueueItem = {
    ...item,
    userId,
    id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    retryCount: 0
  };
  // Deduplicate identical pending action on the same payload entity
  const filtered = queue.filter(q => !(q.action === item.action && q.payload?.id && q.payload?.id === item.payload?.id));
  filtered.push(newItem);
  saveSyncQueue(userId, filtered);
  console.log(`[SyncQueue] Added ${item.action} to user queue (${userId}). Total pending: ${filtered.length}`);
};

// Safe, Idempotent Legacy Queue Migration
function migrateLegacyQueuesIfNeeded(currentUserId?: string): void {
  try {
    // 1. Check for legacy global queue: vhv_pending_sync_queue
    const rawGlobal = localStorage.getItem(STORAGE_KEYS.LEGACY_GLOBAL_QUEUE);
    if (rawGlobal) {
      try {
        const parsed = JSON.parse(rawGlobal);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const orphanedItems: any[] = [];
          for (const item of parsed) {
            // Find reliable userId inside item or payload
            const rawItemUserId = item.userId || item.user_id || item.payload?.user_id || item.payload?.userId;
            if (rawItemUserId && typeof rawItemUserId === 'string' && rawItemUserId.trim()) {
              const itemUserId = rawItemUserId.trim();
              const existingQueue: SyncQueueItem[] = getSyncQueue(itemUserId);
              const exists = existingQueue.some(q => 
                q.id === item.id || 
                (q.action === item.action && JSON.stringify(q.payload) === JSON.stringify(item.payload))
              );
              if (!exists) {
                existingQueue.push({
                  ...item,
                  userId: itemUserId,
                  id: item.id || `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                  timestamp: item.timestamp || new Date().toISOString()
                });
                saveSyncQueue(itemUserId, existingQueue);
              }
            } else {
              // IMPORTANT: Never assign an unknown legacy item to the currently logged in user!
              orphanedItems.push(item);
            }
          }

          if (orphanedItems.length > 0) {
            console.warn(`[SyncQueue] Preserved ${orphanedItems.length} orphaned queue items without owner.`);
            const existingOrphanedRaw = localStorage.getItem(STORAGE_KEYS.ORPHANED_QUEUE);
            const existingOrphaned = existingOrphanedRaw ? JSON.parse(existingOrphanedRaw) : [];
            const mergedOrphaned = [...existingOrphaned, ...orphanedItems];
            localStorage.setItem(STORAGE_KEYS.ORPHANED_QUEUE, JSON.stringify(mergedOrphaned));
          }
        }
      } catch (err) {
        console.error('[SyncQueue] Error parsing legacy global queue:', err);
      }
      localStorage.removeItem(STORAGE_KEYS.LEGACY_GLOBAL_QUEUE);
    }

    // 2. Migrate intermediate key (vhv_local_sync_queue_${userId}) if exists
    if (currentUserId) {
      const intermediateKey = `vhv_local_sync_queue_${currentUserId}`;
      const rawIntermediate = localStorage.getItem(intermediateKey);
      if (rawIntermediate) {
        try {
          const parsed = JSON.parse(rawIntermediate);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const userQueue = getSyncQueue(currentUserId);
            for (const item of parsed) {
              const exists = userQueue.some(q => q.id === item.id || (q.action === item.action && JSON.stringify(q.payload) === JSON.stringify(item.payload)));
              if (!exists) {
                userQueue.push({
                  ...item,
                  userId: currentUserId,
                  id: item.id || `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                  timestamp: item.timestamp || new Date().toISOString()
                });
              }
            }
            saveSyncQueue(currentUserId, userQueue);
          }
        } catch (err) {
          console.error(`[SyncQueue] Error migrating intermediate queue for ${currentUserId}:`, err);
        }
        localStorage.removeItem(intermediateKey);
      }
    }
  } catch (error) {
    console.error('[SyncQueue] Legacy queue migration failed:', error);
  }
}

const DEFAULT_BLANK_PROFILE: VhvProfile = {
  name: '',
  phone: '',
  birthDate: '',
  vhvId: '',
  villageName: '',
  moo: '',
  subdistrict: '',
  district: '',
  province: '',
  healthCenterName: '',
  hospitalReportEmail: '',
  email: '',
  fontSize: 'md'
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(isSupabaseConfigured);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // 1. Initial User load
  const initialUser: AuthUser | null = useMemo(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      if (saved) {
        const parsed = JSON.parse(saved) as AuthUser;
        if (parsed?.id) {
          migrateLegacyDataIfNeeded(parsed.id);
          migrateLegacyQueuesIfNeeded(parsed.id);
          console.log('[LocalStorage] user loaded:', parsed?.phone || parsed?.id);
          return parsed;
        }
      }
    } catch (error) {
      console.error('[LocalStorage] Failed to load user:', error);
    }
    migrateLegacyQueuesIfNeeded();
    return null;
  }, []);

  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const activeUserIdRef = React.useRef<string | null>(initialUser?.id || null);
  const activeDrainUserRef = React.useRef<string | null>(null);
  const fetchGenerationRef = React.useRef<number>(0);
  const authGenerationRef = React.useRef<number>(0);
  
  // 2. Initialize states for the initial user (or empty if not logged in)
  const [vhvProfile, setVhvProfile] = useState<VhvProfile>(() => {
    if (!initialUser?.id) return DEFAULT_BLANK_PROFILE;
    const loaded = loadUserData<VhvProfile>(initialUser.id, 'profile', DEFAULT_BLANK_PROFILE);
    console.log('[LocalStorage] profile loaded');
    return { ...DEFAULT_BLANK_PROFILE, ...loaded };
  });

  const [citizens, setCitizens] = useState<Citizen[]>(() => {
    if (!initialUser?.id) return [];
    const loaded = loadUserData<Citizen[]>(initialUser.id, 'citizens', []);
    if (Array.isArray(loaded)) {
      console.log('[LocalStorage] citizens loaded:', loaded.length);
      return loaded;
    }
    return [];
  });

  const [records, setRecords] = useState<HealthRecord[]>(() => {
    if (!initialUser?.id) return [];
    const loaded = loadUserData<HealthRecord[]>(initialUser.id, 'records', []);
    if (Array.isArray(loaded)) {
      console.log('[LocalStorage] records loaded:', loaded.length);
      return loaded;
    }
    return [];
  });

  const [fontSize, setFontSizeState] = useState<'sm' | 'md' | 'lg'>(() => {
    if (!initialUser?.id) return 'md';
    const loaded = loadUserData<'sm' | 'md' | 'lg'>(initialUser.id, 'font_size', 'md');
    if (loaded === 'sm' || loaded === 'md' || loaded === 'lg') return loaded;
    return 'md';
  });

  // Shared Reports (Received & Sent)
  const [sharedReportsReceived, setSharedReportsReceived] = useState<SharedReport[]>(() => {
    if (!initialUser?.id) return [];
    const loaded = loadUserData<SharedReport[]>(initialUser.id, 'shared_reports', []);
    if (Array.isArray(loaded)) {
      console.log('[LocalStorage] sharedReportsReceived loaded:', loaded.length);
      return loaded;
    }
    return [];
  });

  const [sharedReportsSent, setSharedReportsSent] = useState<SharedReport[]>(() => {
    if (!initialUser?.id) return [];
    const loaded = loadUserData<SharedReport[]>(initialUser.id, 'shared_reports_sent', []);
    if (Array.isArray(loaded)) {
      console.log('[LocalStorage] sharedReportsSent loaded:', loaded.length);
      return loaded;
    }
    return [];
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [analyticsViewMode, setAnalyticsViewMode] = useState<'overview' | 'individual'>('overview');
  const [inboxActiveTab, setInboxActiveTab] = useState<'manage' | 'send' | 'receive'>('manage');
  const [selectedCitizenForProfile, setSelectedCitizenForProfile] = useState<Citizen | null>(null);
  const [selectedCitizenForCheckup, setSelectedCitizenForCheckup] = useState<Citizen | null>(null);

  const pendingSyncCount = useMemo(() => {
    if (!user?.id) return 0;
    return getSyncQueue(user.id).length;
  }, [user?.id, syncStatus, isSyncing]);

  const unreadReceivedCount = useMemo(() => {
    return sharedReportsReceived.filter(r => r.status === 'unread').length;
  }, [sharedReportsReceived]);

  // Process pending offline items in Sync Queue strictly for the authenticated user with exponential backoff & error classification
  const processPendingSyncQueue = useCallback(async (userId: string, options?: { force?: boolean }) => {
    if (!isSupabaseConfigured) return;
    if (!userId || typeof userId !== 'string') {
      console.warn('[SyncQueue] Cannot process queue without a valid userId');
      return;
    }

    // 1. Guard against concurrent drains for the same user
    if (activeDrainUserRef.current === userId) {
      console.log(`[SyncQueue] Drain already in progress for user ${userId}. Skipping duplicate concurrent execution.`);
      return;
    }

    // 2. Guard against active user switch or unauthenticated state
    if (activeUserIdRef.current !== userId) {
      console.warn(`[SyncQueue] Mismatch: activeUserId (${activeUserIdRef.current}) !== target userId (${userId}). Skipping queue.`);
      return;
    }

    // 3. Double-check session authentication to prevent race conditions during switch/logout
    await ensureValidSession();
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUid = sessionData?.session?.user?.id;
    if (!sessionUid || sessionUid !== userId) {
      console.warn(`[SyncQueue] Supabase session uid (${sessionUid}) does not match target queue user (${userId}). Aborting.`);
      return;
    }

    // Acquire drain lock for this user
    activeDrainUserRef.current = userId;

    try {
      const queue = getSyncQueue(userId);
      if (queue.length === 0) return;

      const force = options?.force ?? false;
      const now = Date.now();
      console.log(`[SyncQueue] Evaluating ${queue.length} pending offline actions for user: ${userId} (force=${force})`);
      
      const remainingQueue: SyncQueueItem[] = [];
      let processedCount = 0;
      let authHalted = false;

      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];

        // 4. Strict item-level ownership verification
        if (!item.userId || item.userId !== userId) {
          console.error(`[SyncQueue] Cross-user item found in queue (${item.userId} !== ${userId}). Preserving without executing.`);
          remainingQueue.push(item);
          continue;
        }

        // Check that user has not changed mid-loop
        if (activeUserIdRef.current !== userId) {
          console.warn('[SyncQueue] Active user changed mid-processing. Halting queue drain.');
          remainingQueue.push(...queue.slice(i));
          break;
        }

        // If we previously hit an auth error during this cycle, preserve all remaining items
        if (authHalted) {
          remainingQueue.push(item);
          continue;
        }

        // 5. Exponential Backoff Check: Skip if still within backoff window (unless forced)
        if (!force && item.nextRetryAt && item.nextRetryAt > now) {
          const waitSec = Math.ceil((item.nextRetryAt - now) / 1000);
          console.log(`[SyncQueue] Item ${item.id} (${item.action}) in backoff window (${waitSec}s remaining). Non-blocking skip.`);
          remainingQueue.push(item);
          continue;
        }

        try {
          let err: any = null;

          const executeOpWithTimeout = async (): Promise<{ error: any }> => {
            let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
            const timeoutPromise = new Promise<{ error: any }>((_, reject) => {
              timeoutHandle = setTimeout(() => {
                reject(new Error(`Operation timed out after ${SYNC_OPERATION_TIMEOUT_MS}ms`));
              }, SYNC_OPERATION_TIMEOUT_MS);
            });

            const opPromise = (async () => {
              if (item.action === 'upsert_citizen') {
                return await supabase.from('citizens').upsert(item.payload);
              } else if (item.action === 'delete_citizen') {
                return await supabase.from('citizens').delete().eq('id', item.payload.id).eq('user_id', userId);
              } else if (item.action === 'upsert_record') {
                return await supabase.from('health_records').upsert(item.payload);
              } else if (item.action === 'delete_record') {
                return await supabase.from('health_records').delete().eq('id', item.payload.id).eq('user_id', userId);
              } else if (item.action === 'upsert_profile') {
                return await supabase.from('profiles').upsert(item.payload);
              } else if (item.action === 'send_shared_report') {
                return await supabase.from('shared_reports').insert(item.payload);
              } else if (item.action === 'accept_shared_report') {
                return await supabase.rpc('accept_shared_report', { target_report_id: item.payload.reportId });
              } else if (item.action === 'reject_shared_report') {
                return await supabase.rpc('reject_shared_report', { 
                  target_report_id: item.payload.reportId,
                  reason_note: item.payload.note || null
                });
              } else if (item.action === 'delete_shared_report') {
                return await supabase.from('shared_reports').delete().eq('id', item.payload.id);
              }
              return { error: null };
            })();

            try {
              const res = await Promise.race([opPromise, timeoutPromise]);
              return res as { error: any };
            } finally {
              if (timeoutHandle) clearTimeout(timeoutHandle);
            }
          };

          const result = await executeOpWithTimeout();
          err = result.error;

          // Proactive Auth Error Handling: If JWT expired, refresh session and retry immediately
          if (err && (isAuthError(err) || classifySyncError(err) === 'auth')) {
            console.log(`[SyncQueue] JWT/Auth issue detected during ${item.action}. Attempting session refresh...`);
            const refreshed = await ensureValidSession(true);
            if (refreshed) {
              const retryRes = await executeOpWithTimeout();
              err = retryRes.error;
              if (!err) {
                console.log(`[SyncQueue] Action ${item.action} succeeded after token refresh!`);
              }
            }
          }

          if (err) {
            const errorType = classifySyncError(err);
            const errMsg = err.message || err.details || err.hint || JSON.stringify(err);

            if (errorType === 'auth') {
              // Auth error: Keep current and remaining items, halt processing until re-authenticated
              authHalted = true;
              remainingQueue.push({
                ...item,
                lastAttemptAt: new Date().toISOString(),
                lastError: errMsg,
                errorType: 'auth'
              });
              console.warn(`[SyncQueue] Auth session unavailable for ${item.action} (${item.id}). Halting queue drain until session is restored:`, {
                code: err.code,
                message: err.message,
                classification: 'auth'
              });
            } else if (errorType === 'permanent') {
              console.error(`[SyncQueue] Error processing ${item.action} (${errorType}):`, {
                code: err.code,
                message: err.message,
                details: err.details,
                hint: err.hint,
                classification: errorType
              });
              // Permanent failure: Move to dead-letter queue, do NOT block the rest of the queue
              addFailedSyncQueueItem(userId, {
                ...item,
                lastAttemptAt: new Date().toISOString(),
                lastError: errMsg,
                errorType: 'permanent',
                failedAt: new Date().toISOString(),
                finalError: errMsg
              });
              console.warn(`[SyncQueue] Item ${item.id} (${item.action}) encountered permanent error. Dropped from active queue.`);
            } else {
              console.error(`[SyncQueue] Error processing ${item.action} (${errorType}):`, {
                code: err.code,
                message: err.message,
                details: err.details,
                hint: err.hint,
                classification: errorType
              });
              // Transient failure: Increment retry count and schedule exponential backoff
              const currentRetries = (item.retryCount || 0) + 1;
              if (currentRetries >= SYNC_RETRY_CONFIG.MAX_RETRIES) {
                console.warn(`[SyncQueue] Item ${item.id} (${item.action}) exceeded max retries (${SYNC_RETRY_CONFIG.MAX_RETRIES}). Moving to dead-letter queue.`);
                addFailedSyncQueueItem(userId, {
                  ...item,
                  retryCount: currentRetries,
                  lastAttemptAt: new Date().toISOString(),
                  lastError: errMsg,
                  errorType: 'transient',
                  failedAt: new Date().toISOString(),
                  finalError: `Exceeded max retries (${SYNC_RETRY_CONFIG.MAX_RETRIES}): ${errMsg}`
                });
              } else {
                const delay = SYNC_RETRY_CONFIG.calculateDelay(currentRetries);
                const nextRetryAt = Date.now() + delay;
                console.log(`[SyncQueue] Transient error on item ${item.id}. Attempt ${currentRetries}/${SYNC_RETRY_CONFIG.MAX_RETRIES}. Next retry in ${Math.round(delay)}ms.`);
                remainingQueue.push({
                  ...item,
                  retryCount: currentRetries,
                  lastAttemptAt: new Date().toISOString(),
                  lastError: errMsg,
                  errorType: 'transient',
                  nextRetryAt
                });
              }
            }
          } else {
            processedCount++;
            console.log(`[SyncQueue] Action ${item.action} (${item.id}) completed successfully for user: ${userId}`);
          }
        } catch (e: any) {
          const errorType = classifySyncError(e);
          const errMsg = e?.message || String(e);
          console.error(`[SyncQueue] Exception processing ${item.action} (${errorType}):`, e);

          if (errorType === 'auth') {
            authHalted = true;
            remainingQueue.push({
              ...item,
              lastAttemptAt: new Date().toISOString(),
              lastError: errMsg,
              errorType: 'auth'
            });
          } else if (errorType === 'permanent') {
            addFailedSyncQueueItem(userId, {
              ...item,
              lastAttemptAt: new Date().toISOString(),
              lastError: errMsg,
              errorType: 'permanent',
              failedAt: new Date().toISOString(),
              finalError: errMsg
            });
          } else {
            const currentRetries = (item.retryCount || 0) + 1;
            if (currentRetries >= SYNC_RETRY_CONFIG.MAX_RETRIES) {
              addFailedSyncQueueItem(userId, {
                ...item,
                retryCount: currentRetries,
                lastAttemptAt: new Date().toISOString(),
                lastError: errMsg,
                errorType: 'transient',
                failedAt: new Date().toISOString(),
                finalError: `Exceeded max retries (${SYNC_RETRY_CONFIG.MAX_RETRIES}): ${errMsg}`
              });
            } else {
              const delay = SYNC_RETRY_CONFIG.calculateDelay(currentRetries);
              remainingQueue.push({
                ...item,
                retryCount: currentRetries,
                lastAttemptAt: new Date().toISOString(),
                lastError: errMsg,
                errorType: 'transient',
                nextRetryAt: Date.now() + delay
              });
            }
          }
        }
      }

      if (activeUserIdRef.current === userId) {
        saveSyncQueue(userId, remainingQueue);
        console.log(`[SyncQueue] Drain summary for user ${userId}: ${processedCount} succeeded, ${remainingQueue.length} remaining.`);
      }
    } finally {
      if (activeDrainUserRef.current === userId) {
        activeDrainUserRef.current = null;
      }
    }
  }, []);

  // Atomic user switcher: loads all resources for user without cross-account state flash
  const switchAndLoadUser = useCallback((newUser: AuthUser | null) => {
    // Invalidate pending async fetches and reset drain lock
    fetchGenerationRef.current++;
    activeDrainUserRef.current = null;

    if (!newUser || !newUser.id) {
      activeUserIdRef.current = null;
      setUser(null);
      setCitizens([]);
      setRecords([]);
      setVhvProfile(DEFAULT_BLANK_PROFILE);
      setFontSizeState('md');
      setSharedReportsReceived([]);
      setSharedReportsSent([]);
      setSelectedCitizenForProfile(null);
      setSelectedCitizenForCheckup(null);
      setSyncStatus('synced');
      localStorage.removeItem(STORAGE_KEYS.USER);
      return;
    }

    const userId = newUser.id;
    migrateLegacyDataIfNeeded(userId);
    migrateLegacyQueuesIfNeeded(userId);
    activeUserIdRef.current = userId;

    const loadedProfile = loadUserData<VhvProfile>(userId, 'profile', DEFAULT_BLANK_PROFILE);
    const loadedCitizens = loadUserData<Citizen[]>(userId, 'citizens', []);
    const loadedRecords = loadUserData<HealthRecord[]>(userId, 'records', []);
    const loadedFontSize = loadUserData<'sm' | 'md' | 'lg'>(userId, 'font_size', 'md');
    const loadedSharedReceived = loadUserData<SharedReport[]>(userId, 'shared_reports', []);
    const loadedSharedSent = loadUserData<SharedReport[]>(userId, 'shared_reports_sent', []);

    setUser(newUser);
    setVhvProfile({ ...DEFAULT_BLANK_PROFILE, ...loadedProfile });
    setCitizens(Array.isArray(loadedCitizens) ? loadedCitizens : []);
    setRecords(Array.isArray(loadedRecords) ? loadedRecords : []);
    setFontSizeState(loadedFontSize === 'sm' || loadedFontSize === 'md' || loadedFontSize === 'lg' ? loadedFontSize : 'md');
    setSharedReportsReceived(Array.isArray(loadedSharedReceived) ? loadedSharedReceived : []);
    setSharedReportsSent(Array.isArray(loadedSharedSent) ? loadedSharedSent : []);

    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
    debugCurrentUserStorage(userId);
  }, []);

  // Save states to user-specific localStorage keys (guarded against unauthenticated state or account switch race conditions)
  useEffect(() => {
    if (!user?.id || activeUserIdRef.current !== user.id) return;
    saveUserData(user.id, 'citizens', citizens);
  }, [citizens, user?.id]);

  useEffect(() => {
    if (!user?.id || activeUserIdRef.current !== user.id) return;
    saveUserData(user.id, 'records', records);
  }, [records, user?.id]);

  useEffect(() => {
    if (!user?.id || activeUserIdRef.current !== user.id) return;
    saveUserData(user.id, 'profile', vhvProfile);
  }, [vhvProfile, user?.id]);

  useEffect(() => {
    if (!user?.id || activeUserIdRef.current !== user.id) return;
    saveUserData(user.id, 'font_size', fontSize);
  }, [fontSize, user?.id]);

  useEffect(() => {
    if (!user?.id || activeUserIdRef.current !== user.id) return;
    saveUserData(user.id, 'shared_reports', sharedReportsReceived);
  }, [sharedReportsReceived, user?.id]);

  useEffect(() => {
    if (!user?.id || activeUserIdRef.current !== user.id) return;
    saveUserData(user.id, 'shared_reports_sent', sharedReportsSent);
  }, [sharedReportsSent, user?.id]);

  // Shared Reports: Fetch method (Queries strictly by receiver_id / sender_id)
  const fetchSharedReports = useCallback(async () => {
    const userId = activeUserIdRef.current;
    if (!userId) return;

    if (isSupabaseConfigured) {
      try {
        await ensureValidSession();

        // 1. Fetch received strictly by receiver_id (UUID)
        const { data: recByUserId, error: err1 } = await executeWithAuthRetry(() =>
          supabase
            .from('shared_reports')
            .select('*')
            .eq('receiver_id', userId)
            .order('created_at', { ascending: false })
        );

        if (activeUserIdRef.current !== userId) return;

        if (err1) {
          if (!isAuthError(err1)) {
            console.error('[Supabase fetchSharedReports received error]', {
              code: err1.code,
              message: err1.message,
              details: err1.details,
              hint: err1.hint
            });
          }
        } else if (Array.isArray(recByUserId)) {
          const mappedReceived: SharedReport[] = recByUserId.map(mapSupabaseToSharedReport);
          if (activeUserIdRef.current === userId) {
            setSharedReportsReceived(mappedReceived);
            saveUserData(userId, 'shared_reports', mappedReceived);
          }
        }

        // 2. Fetch sent strictly by sender_id (UUID)
        const { data: sentReports, error: sentErr } = await executeWithAuthRetry(() =>
          supabase
            .from('shared_reports')
            .select('*')
            .eq('sender_id', userId)
            .order('created_at', { ascending: false })
        );

        if (activeUserIdRef.current !== userId) return;

        if (sentErr) {
          if (!isAuthError(sentErr)) {
            console.error('[Supabase fetchSharedReports sent error]', {
              code: sentErr.code,
              message: sentErr.message,
              details: sentErr.details,
              hint: sentErr.hint
            });
          }
        } else if (Array.isArray(sentReports)) {
          const mappedSent: SharedReport[] = sentReports.map(mapSupabaseToSharedReport);
          if (activeUserIdRef.current === userId) {
            setSharedReportsSent(mappedSent);
            saveUserData(userId, 'shared_reports_sent', mappedSent);
          }
        }
      } catch (e) {
        console.error('[Supabase] Fetch shared reports exception:', e);
      }
    }
  }, []);

  // Non-destructive sync data from Supabase (LocalStorage remains SOURCE OF TRUTH)
  const fetchUserDataFromSupabase = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured || !userId) return;
    
    const requestGen = ++fetchGenerationRef.current;
    console.log(`[Supabase] Background sync / fetch started for user: ${userId} (gen: ${requestGen})`);
    
    if (activeUserIdRef.current === userId) {
      setSyncStatus('syncing');
    }

    try {
      await ensureValidSession();

      // 1. Fetch Profile
      const { data: profileRow, error: profileErr } = await executeWithAuthRetry(() =>
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()
      );

      if (fetchGenerationRef.current !== requestGen || activeUserIdRef.current !== userId) {
        console.log(`[Supabase] Stale fetch response ignored for user ${userId} (gen ${requestGen} !== ${fetchGenerationRef.current})`);
        return;
      }

      if (profileErr) {
        if (!isAuthError(profileErr)) console.error('[Supabase] Profile fetch error:', profileErr);
      } else if (profileRow) {
        const remoteProfile = mapSupabaseToProfile(profileRow);
        setVhvProfile(prev => {
          if (activeUserIdRef.current !== userId) return prev;
          const merged: VhvProfile = {
            ...DEFAULT_BLANK_PROFILE,
            ...remoteProfile,
            ...prev,
            name: prev.name || remoteProfile.name,
            phone: prev.phone || remoteProfile.phone,
            birthDate: prev.birthDate || remoteProfile.birthDate
          };
          saveUserData(userId, 'profile', merged);
          return merged;
        });
      }

      // 2. Fetch Citizens (Non-destructive merge)
      const { data: remoteCitizens, error: citErr } = await executeWithAuthRetry(() =>
        supabase
          .from('citizens')
          .select('*')
          .eq('user_id', userId)
      );

      if (fetchGenerationRef.current !== requestGen || activeUserIdRef.current !== userId) {
        return;
      }

      if (citErr) {
        if (!isAuthError(citErr)) console.error('[Supabase] Citizens fetch error:', citErr);
      } else if (Array.isArray(remoteCitizens)) {
        const mappedRemoteCitizens = remoteCitizens.map(mapSupabaseToCitizen);
        
        setCitizens(localCitizens => {
          if (activeUserIdRef.current !== userId) return localCitizens;
          // Local is SOURCE OF TRUTH. Keep all local citizens.
          const localMap = new Map(localCitizens.map(c => [c.id, c]));
          const localIdCardMap = new Map<string, Citizen>();
          for (const c of localCitizens) {
            const cleanId = c.idCard?.trim() || '';
            if (/^[0-9]{13}$/.test(cleanId)) {
              localIdCardMap.set(cleanId, c);
            }
          }
          
          let addedFromCloud = 0;
          const merged = [...localCitizens];

          for (const rc of mappedRemoteCitizens) {
            const cleanRemoteIdCard = rc.idCard?.trim() || '';
            const hasValid13DigitIdCard = /^[0-9]{13}$/.test(cleanRemoteIdCard);

            // Check if already present by exact canonical ID
            if (localMap.has(rc.id)) {
              continue;
            }

            // Check if already present by valid 13-digit National ID Card (do not create duplicates)
            if (hasValid13DigitIdCard && localIdCardMap.has(cleanRemoteIdCard)) {
              continue;
            }

            merged.push(rc);
            localMap.set(rc.id, rc);
            if (hasValid13DigitIdCard) {
              localIdCardMap.set(cleanRemoteIdCard, rc);
            }
            addedFromCloud++;
          }

          if (addedFromCloud > 0) {
            console.log(`[Supabase] Merged ${addedFromCloud} citizens from cloud into local`);
            saveUserData(userId, 'citizens', merged);
          }

          // Check if any local citizen is missing from Supabase, sync them UP in background
          const remoteIdSet = new Set(mappedRemoteCitizens.map(c => c.id));
          const missingInCloud = localCitizens.filter(c => !remoteIdSet.has(c.id));
          if (missingInCloud.length > 0) {
            console.log(`[Supabase] Syncing ${missingInCloud.length} local citizens up to cloud`);
            const payloads = missingInCloud.map(c => mapCitizenToSupabase(c, userId));
            void (async () => {
              try {
                const { error } = await executeWithAuthRetry(() => supabase.from('citizens').upsert(payloads));
                if (error && !isAuthError(error)) console.error('[Supabase] Background upload of local citizens failed:', error);
              } catch (err) {
                console.error('[Supabase] Background upload of local citizens exception:', err);
              }
            })();
          }

          return merged;
        });
      }

      // 3. Fetch Health Records (Strict ID-based merge — CRITICAL SAFETY: Never compare medical values!)
      const { data: remoteRecords, error: recErr } = await executeWithAuthRetry(() =>
        supabase
          .from('health_records')
          .select('*')
          .eq('user_id', userId)
      );

      if (fetchGenerationRef.current !== requestGen || activeUserIdRef.current !== userId) {
        return;
      }

      if (recErr) {
        if (!isAuthError(recErr)) console.error('[Supabase] Health records fetch error:', recErr);
      } else if (Array.isArray(remoteRecords)) {
        const mappedRemoteRecords = remoteRecords.map(r => mapSupabaseToHealthRecord(r));
        
        setRecords(localRecords => {
          if (activeUserIdRef.current !== userId) return localRecords;
          // Local is SOURCE OF TRUTH. Keep all local records.
          const localMap = new Map(localRecords.map(r => [r.id, r]));
          
          let addedFromCloud = 0;
          const merged = [...localRecords];

          for (const rr of mappedRemoteRecords) {
            // Strict ID-based match (Never compare date or blood pressure values)
            if (!localMap.has(rr.id)) {
              merged.push(rr);
              localMap.set(rr.id, rr);
              addedFromCloud++;
            }
          }

          if (addedFromCloud > 0) {
            console.log(`[Supabase] Merged ${addedFromCloud} health records from cloud into local`);
            saveUserData(userId, 'records', merged);
          }

          // Check if any local records are missing from Supabase, sync them UP in background
          const remoteIdSet = new Set(mappedRemoteRecords.map(r => r.id));
          const missingInCloud = localRecords.filter(r => !remoteIdSet.has(r.id));
          if (missingInCloud.length > 0) {
            console.log(`[Supabase] Syncing ${missingInCloud.length} local records up to cloud`);
            const payloads = missingInCloud.map(r => mapHealthRecordToSupabase(r, userId));
            void (async () => {
              try {
                const { error } = await executeWithAuthRetry(() => supabase.from('health_records').upsert(payloads));
                if (error && !isAuthError(error)) console.error('[Supabase] Background upload of local records failed:', error);
              } catch (err) {
                console.error('[Supabase] Background upload of local records exception:', err);
              }
            })();
          }

          return merged;
        });
      }

      // 4. Fetch Shared Reports
      await fetchSharedReports();

      if (fetchGenerationRef.current === requestGen && activeUserIdRef.current === userId) {
        console.log('[Supabase] Background sync completed successfully');
        setSyncStatus('synced');
      }
    } catch (error) {
      if (fetchGenerationRef.current === requestGen && activeUserIdRef.current === userId) {
        console.error('[Supabase] Sync failed with exception:', error);
        setSyncStatus('error');
      }
    }
  }, [fetchSharedReports]);

  // Monitor online status & auto drain queue
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[Network] App is online, triggering sync & queue drain');
      const currentUid = activeUserIdRef.current;
      if (currentUid && !authLoading) {
        void (async () => {
          try {
            await processPendingSyncQueue(currentUid, { force: true });
            if (activeUserIdRef.current === currentUid) {
              await fetchUserDataFromSupabase(currentUid);
            }
          } catch (err) {
            console.error('[OnlineHandler] Error during online auto-drain/fetch:', err);
          }
        })();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      console.log('[Network] App is offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [authLoading, processPendingSyncQueue, fetchUserDataFromSupabase]);

  // Listen to Supabase Auth State changes on mount
  useEffect(() => {
    let mounted = true;

    const handleSession = (sessionUser: any, currentGen: number) => {
      if (!sessionUser) {
        switchAndLoadUser(null);
        if (mounted) {
          setAuthLoading(false);
        }
        return;
      }

      const authUsr: AuthUser = {
        id: sessionUser.id,
        name: sessionUser.user_metadata?.name || 'อสม.',
        phone: sessionUser.user_metadata?.phone || '',
        email: sessionUser.email || '',
        provider: 'supabase',
        vhvCode: sessionUser.user_metadata?.vhvId || '',
        isLoggedIn: true
      };

      if (activeUserIdRef.current !== sessionUser.id) {
        switchAndLoadUser(authUsr);
      }

      if (mounted) {
        setAuthLoading(false);
      }

      // Background drain and fetch - explicitly fire-and-forget (do NOT block authLoading)
      void (async () => {
        try {
          await processPendingSyncQueue(sessionUser.id);
          if (mounted && authGenerationRef.current === currentGen && activeUserIdRef.current === sessionUser.id) {
            await fetchUserDataFromSupabase(sessionUser.id);
          }
        } catch (err) {
          console.error('[Supabase Auth Background Sync Error]:', err);
        }
      })();
    };

    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    // 1. Subscribe to auth changes (handles SIGNED_IN, SIGNED_OUT, INITIAL_SESSION, TOKEN_REFRESHED)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      const authGen = ++authGenerationRef.current;
      console.log(`[Supabase Auth Event] ${event}, user:`, session?.user?.id || 'none');
      try {
        if (session?.user) {
          handleSession(session.user, authGen);
        } else {
          handleSession(null, authGen);
        }
      } catch (err) {
        console.error('[Supabase onAuthStateChange error]:', err);
        if (mounted) setAuthLoading(false);
      }
    });

    // 2. Direct getSession call to guarantee immediate resolution on mount/remount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      const authGen = ++authGenerationRef.current;
      if (session?.user) {
        handleSession(session.user, authGen);
      } else {
        handleSession(null, authGen);
      }
    }).catch(err => {
      console.warn('Supabase getSession fallback error:', err);
      if (mounted) setAuthLoading(false);
    });

    // 3. Safety timeout: Guarantees authLoading is never stuck true if Supabase client stalls
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        setAuthLoading(false);
      }
    }, 1500);

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription?.unsubscribe();
    };
  }, [fetchUserDataFromSupabase, processPendingSyncQueue, switchAndLoadUser]);

  // Login with Phone + 8 digits Birthdate as password
  const loginWithPhone = async (phone: string, birthDate: string): Promise<{ success: boolean; message?: string }> => {
    setAuthLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const cleanBirthDate = birthDate.trim();

      if (!cleanPhone || cleanPhone.length < 9) {
        setAuthLoading(false);
        return { success: false, message: 'กรุณากรอกเบอร์โทรศัพท์ที่ถูกต้อง (9-10 หลัก)' };
      }
      if (!cleanBirthDate || cleanBirthDate.length < 8) {
        setAuthLoading(false);
        return { success: false, message: 'กรุณากรอกรหัสผ่านวันเกิด 8 หลัก (เช่น 08052549)' };
      }

      const authEmail = phoneToAuthEmail(cleanPhone);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: cleanBirthDate
      });

      if (error) {
        let msg = error.message;
        if (msg.includes('Invalid login credentials')) {
          msg = 'เบอร์โทรศัพท์หรือรหัสผ่านวันเกิดไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง';
        }
        setAuthLoading(false);
        return { success: false, message: msg };
      }

      if (data.user) {
        const authUsr: AuthUser = {
          id: data.user.id,
          name: data.user.user_metadata?.name || 'อสม.',
          phone: cleanPhone,
          email: data.user.email || '',
          provider: 'supabase',
          vhvCode: data.user.user_metadata?.vhvId || '',
          isLoggedIn: true
        };
        switchAndLoadUser(authUsr);
        await fetchUserDataFromSupabase(data.user.id);
        setActiveTab('dashboard');
        setAuthLoading(false);
        return { success: true };
      }

      setAuthLoading(false);
      return { success: false, message: 'ไม่พบข้อมูลผู้ใช้' };
    } catch (err: any) {
      setAuthLoading(false);
      return { success: false, message: err?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง' };
    }
  };

  // Sign Up with Phone + Profile + 8 digits Birthdate
  const signUpWithPhone = async (profileData: VhvProfile): Promise<{ success: boolean; message?: string }> => {
    setAuthLoading(true);
    try {
      const cleanPhone = profileData.phone.replace(/\D/g, '');
      const cleanBirthDate = profileData.birthDate.trim();

      if (!profileData.name.trim()) {
        setAuthLoading(false);
        return { success: false, message: 'กรุณาระบุชื่อ-นามสกุล อสม.' };
      }
      if (!cleanPhone || cleanPhone.length < 9) {
        setAuthLoading(false);
        return { success: false, message: 'กรุณากรอกเบอร์โทรศัพท์ติดต่อ (9-10 หลัก)' };
      }
      if (!cleanBirthDate || cleanBirthDate.length < 8) {
        setAuthLoading(false);
        return { success: false, message: 'กรุณากรอกวันเกิด 8 หลักให้ครบถ้วน (เช่น 08052549)' };
      }

      const authEmail = phoneToAuthEmail(cleanPhone);

      // 1. Sign up Supabase Auth User with rich metadata for automatic DB trigger
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: authEmail,
        password: cleanBirthDate,
        options: {
          data: {
            name: profileData.name.trim(),
            phone: cleanPhone,
            birth_date: cleanBirthDate,
            vhv_id: profileData.vhvId?.trim() || '',
            village_name: profileData.villageName?.trim() || '',
            moo: profileData.moo?.trim() || '',
            subdistrict: profileData.subdistrict?.trim() || '',
            district: profileData.district?.trim() || '',
            province: profileData.province?.trim() || '',
            health_center_name: profileData.healthCenterName?.trim() || '',
            hospital_report_email: profileData.hospitalReportEmail?.trim() || '',
            email: profileData.email?.trim() || '',
            font_size: profileData.fontSize || 'md'
          }
        }
      });

      if (authError) {
        let msg = authError.message;
        if (msg.includes('already registered') || msg.includes('User already registered')) {
          msg = 'เบอร์โทรศัพท์นี้ถูกลงทะเบียนไว้ในระบบแล้ว สามารถสลับไปแท็บเข้าสู่ระบบได้ทันที';
        } else if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
          msg = 'Supabase แจ้งเตือน: ติด Rate Limit ส่งอีเมล เนื่องจากยังไม่ได้ปิด Confirm Email ใน Supabase -> กรุณาไปที่ Supabase Dashboard > Authentication > Providers > Email > ปิด Confirm email แล้วกด Save';
        }
        setAuthLoading(false);
        return { success: false, message: msg };
      }

      let userId = authData.user?.id;
      let activeSession = authData.session;

      // If session is null (e.g. Supabase returned user without immediate session), try sign in
      if (!activeSession) {
        const { data: loginData } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: cleanBirthDate
        });
        if (loginData.session) {
          activeSession = loginData.session;
          userId = loginData.user.id;
        }
      }

      if (!userId) {
        setAuthLoading(false);
        return { success: false, message: 'ไม่สามารถสร้างบัญชีผู้ใช้ได้ กรุณาลองใหม่อีกครั้ง' };
      }

      // 2. Save profile to Supabase 'profiles' table
      const profileToSave: VhvProfile = {
        name: profileData.name.trim(),
        phone: cleanPhone,
        birthDate: cleanBirthDate,
        vhvId: profileData.vhvId?.trim() || '',
        villageName: profileData.villageName?.trim() || '',
        moo: profileData.moo?.trim() || '',
        subdistrict: profileData.subdistrict?.trim() || '',
        district: profileData.district?.trim() || '',
        province: profileData.province?.trim() || '',
        healthCenterName: profileData.healthCenterName?.trim() || '',
        hospitalReportEmail: profileData.hospitalReportEmail?.trim() || '',
        email: profileData.email?.trim() || '',
        fontSize: profileData.fontSize || 'md'
      };

      try {
        const payload = mapProfileToSupabase(profileToSave, userId);
        const { error: upsertErr } = await supabase.from('profiles').upsert(payload);
        if (upsertErr) {
          console.error('[Supabase] Profiles upsert warning:', upsertErr);
        } else {
          console.log('[Supabase] Profile upsert success for user:', userId);
        }
      } catch (profileErr) {
        console.error('[Supabase] Profile upsert exception:', profileErr);
      }

      // 3. Update local state and isolated local storage
      const authUsr: AuthUser = {
        id: userId,
        name: profileToSave.name,
        phone: cleanPhone,
        email: authEmail,
        provider: 'supabase',
        vhvCode: profileToSave.vhvId,
        isLoggedIn: true
      };

      saveUserData(userId, 'profile', profileToSave);
      switchAndLoadUser(authUsr);
      setActiveTab('dashboard');
      setAuthLoading(false);
      return { success: true };

    } catch (err: any) {
      setAuthLoading(false);
      return { success: false, message: err?.message || 'เกิดข้อผิดพลาดในการลงทะเบียน' };
    }
  };

  // Logout (Leaves citizens and health records intact in isolated LocalStorage)
  const logout = async () => {
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.warn('Logout error:', e);
    } finally {
      switchAndLoadUser(null);
      setActiveTab('dashboard');
      setAuthLoading(false);
    }
  };

  // Profile Update (Local-First -> Cloud Sync)
  const updateProfile = async (updates: Partial<VhvProfile>) => {
    const updated = { ...vhvProfile, ...updates };
    setVhvProfile(updated);
    if (user?.id) {
      saveUserData(user.id, 'profile', updated);

      if (isSupabaseConfigured) {
        try {
          console.log('[Supabase] Sync started: updateProfile');
          const payload = mapProfileToSupabase(updated, user.id);
          const { error } = await executeWithAuthRetry(() => supabase.from('profiles').upsert(payload));
          if (error) {
            console.error('[Supabase] Sync failed: updateProfile', {
              code: error.code,
              message: error.message,
              details: error.details,
              hint: error.hint
            });
            addToSyncQueue(user.id, { action: 'upsert_profile', payload });
            setSyncStatus('error');
          } else {
            console.log('[Supabase] Sync success: updateProfile');
            setSyncStatus('synced');
          }
        } catch (syncErr) {
          console.error('[Supabase] Unexpected sync error: updateProfile', syncErr);
          const payload = mapProfileToSupabase(updated, user.id);
          addToSyncQueue(user.id, { action: 'upsert_profile', payload });
          setSyncStatus('error');
        }
      }
    }
  };

  const setFontSize = (size: 'sm' | 'md' | 'lg') => {
    setFontSizeState(size);
    updateProfile({ fontSize: size });
  };

  // Citizen Operations (Offline-First LocalStorage -> Cloud Sync)
  const addCitizen = async (citizenData: Omit<Citizen, 'id' | 'createdAt'>): Promise<Citizen> => {
    const newCitizen: Citizen = {
      ...citizenData,
      id: `cit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString().split('T')[0],
      avatarColor: citizenData.avatarColor || ['#5D7052', '#C18C5D', '#78786C', '#A85448'][Math.floor(Math.random() * 4)],
      userId: user?.id
    };

    // 1. Local update first
    setCitizens(prev => [newCitizen, ...prev]);

    // 2. Cloud Sync in background
    if (user?.id && isSupabaseConfigured) {
      console.log('[Supabase] Sync started: addCitizen', newCitizen.id);
      setSyncStatus('syncing');
      try {
        const payload = mapCitizenToSupabase(newCitizen, user.id);
        const { error } = await executeWithAuthRetry(() => supabase.from('citizens').upsert(payload));
        if (error) {
          console.error('[Supabase] Sync failed: addCitizen', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          addToSyncQueue(user.id, { action: 'upsert_citizen', payload });
          setSyncStatus('error');
        } else {
          console.log('[Supabase] Sync success: addCitizen', newCitizen.id);
          setSyncStatus('synced');
        }
      } catch (syncErr) {
        console.error('[Supabase] Unexpected sync error: addCitizen', syncErr);
        const payload = mapCitizenToSupabase(newCitizen, user.id);
        addToSyncQueue(user.id, { action: 'upsert_citizen', payload });
        setSyncStatus('error');
      }
    }

    return newCitizen;
  };

  const updateCitizen = async (id: string, updates: Partial<Citizen>) => {
    let updatedCit: Citizen | null = null;
    setCitizens(prev =>
      prev.map(c => {
        if (c.id === id) {
          updatedCit = { ...c, ...updates };
          return updatedCit;
        }
        return c;
      })
    );

    if (user?.id && isSupabaseConfigured && updatedCit) {
      console.log('[Supabase] Sync started: updateCitizen', id);
      try {
        const payload = mapCitizenToSupabase(updatedCit, user.id);
        const { error } = await executeWithAuthRetry(() => supabase.from('citizens').upsert(payload));
        if (error) {
          console.error('[Supabase] Sync failed: updateCitizen', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          addToSyncQueue(user.id, { action: 'upsert_citizen', payload });
          setSyncStatus('error');
        } else {
          console.log('[Supabase] Sync success: updateCitizen', id);
          setSyncStatus('synced');
        }
      } catch (syncErr) {
        console.error('[Supabase] Unexpected sync error: updateCitizen', syncErr);
        const payload = mapCitizenToSupabase(updatedCit, user.id);
        addToSyncQueue(user.id, { action: 'upsert_citizen', payload });
        setSyncStatus('error');
      }
    }
  };

  const deleteCitizen = async (id: string) => {
    // 1. Local update first
    setCitizens(prev => prev.filter(c => c.id !== id));
    setRecords(prev => prev.filter(r => r.citizenId !== id));

    // 2. Cloud delete in background
    if (user?.id && isSupabaseConfigured) {
      console.log('[Supabase] Sync started: deleteCitizen', id);
      try {
        await executeWithAuthRetry(() =>
          supabase
            .from('health_records')
            .delete()
            .eq('citizen_id', id)
            .eq('user_id', user.id)
        );

        const { error: citErr } = await executeWithAuthRetry(() =>
          supabase
            .from('citizens')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)
        );

        if (citErr) {
          console.error('[Supabase] Sync failed: deleteCitizen', {
            code: citErr.code,
            message: citErr.message,
            details: citErr.details,
            hint: citErr.hint
          });
          addToSyncQueue(user.id, { action: 'delete_citizen', payload: { id } });
          setSyncStatus('error');
        } else {
          console.log('[Supabase] Sync success: deleteCitizen', id);
          setSyncStatus('synced');
        }
      } catch (syncErr) {
        console.error('[Supabase] Unexpected sync error: deleteCitizen', syncErr);
        addToSyncQueue(user.id, { action: 'delete_citizen', payload: { id } });
        setSyncStatus('error');
      }
    }
  };

  // Health Record Operations (Offline-First LocalStorage -> Cloud Sync)
  const addHealthRecord = async (recordData: Omit<HealthRecord, 'id' | 'createdAt'>): Promise<HealthRecord> => {
    const newRecord: HealthRecord = {
      ...recordData,
      id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      userId: user?.id
    };

    // 1. Local update first
    setRecords(prev => [newRecord, ...prev]);

    // 2. Cloud sync in background
    if (user?.id && isSupabaseConfigured) {
      console.log('[Supabase] Sync started: addHealthRecord', newRecord.id);
      setSyncStatus('syncing');
      try {
        const payload = mapHealthRecordToSupabase(newRecord, user.id);
        const { error } = await executeWithAuthRetry(() => supabase.from('health_records').upsert(payload));
        if (error) {
          console.error('[Supabase] Sync failed: addHealthRecord', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          addToSyncQueue(user.id, { action: 'upsert_record', payload });
          setSyncStatus('error');
        } else {
          console.log('[Supabase] Sync success: addHealthRecord', newRecord.id);
          setSyncStatus('synced');
        }
      } catch (syncErr) {
        console.error('[Supabase] Unexpected sync error: addHealthRecord', syncErr);
        const payload = mapHealthRecordToSupabase(newRecord, user.id);
        addToSyncQueue(user.id, { action: 'upsert_record', payload });
        setSyncStatus('error');
      }
    }

    return newRecord;
  };

  const deleteHealthRecord = async (id: string) => {
    // 1. Local delete first
    setRecords(prev => prev.filter(r => r.id !== id));

    // 2. Cloud delete in background
    if (user?.id && isSupabaseConfigured) {
      console.log('[Supabase] Sync started: deleteHealthRecord', id);
      try {
        const { error } = await executeWithAuthRetry(() =>
          supabase
            .from('health_records')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)
        );

        if (error) {
          console.error('[Supabase] Sync failed: deleteHealthRecord', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          addToSyncQueue(user.id, { action: 'delete_record', payload: { id } });
          setSyncStatus('error');
        } else {
          console.log('[Supabase] Sync success: deleteHealthRecord', id);
          setSyncStatus('synced');
        }
      } catch (syncErr) {
        console.error('[Supabase] Unexpected sync error: deleteHealthRecord', syncErr);
        addToSyncQueue(user.id, { action: 'delete_record', payload: { id } });
        setSyncStatus('error');
      }
    }
  };

  // Manual Sync trigger
  const syncWithSupabase = async (): Promise<{ success: boolean; message: string }> => {
    if (!user?.id) {
      return { success: false, message: 'กรุณาเข้าสู่ระบบก่อนทำการซิงค์ข้อมูล' };
    }
    setIsSyncing(true);
    setSyncStatus('syncing');
    console.log('[Supabase] Manual sync triggered for user:', user.id);

    try {
      await ensureValidSession();

      // 0. Process offline sync queue first (force retry of any backoff items)
      await processPendingSyncQueue(user.id, { force: true });

      // 1. Sync Profile
      const profilePayload = mapProfileToSupabase(vhvProfile, user.id);
      const { error: profErr } = await executeWithAuthRetry(() => supabase.from('profiles').upsert(profilePayload));
      if (profErr) {
        console.error('[Supabase] Manual sync profile error:', {
          code: profErr.code,
          message: profErr.message,
          details: profErr.details,
          hint: profErr.hint
        });
      }

      // 2. Sync Local Citizens -> Cloud
      if (citizens.length > 0) {
        const citPayloads = citizens.map(c => mapCitizenToSupabase(c, user.id));
        const { error: citErr } = await executeWithAuthRetry(() => supabase.from('citizens').upsert(citPayloads));
        if (citErr) {
          console.error('[Supabase] Manual sync citizens error:', {
            code: citErr.code,
            message: citErr.message,
            details: citErr.details,
            hint: citErr.hint
          });
        }
      }

      // 3. Sync Local Health Records -> Cloud
      if (records.length > 0) {
        const recPayloads = records.map(r => mapHealthRecordToSupabase(r, user.id));
        const { error: recErr } = await executeWithAuthRetry(() => supabase.from('health_records').upsert(recPayloads));
        if (recErr) {
          console.error('[Supabase] Manual sync records error:', {
            code: recErr.code,
            message: recErr.message,
            details: recErr.details,
            hint: recErr.hint
          });
        }
      }

      // 4. Fetch any new changes from cloud (merge safely)
      await fetchUserDataFromSupabase(user.id);

      setIsSyncing(false);
      setSyncStatus('synced');
      console.log('[Supabase] Manual sync finished successfully');
      return { success: true, message: 'ซิงค์ข้อมูลกับ Supabase Cloud สำเร็จเรียบร้อย' };
    } catch (error: any) {
      console.error('[Supabase] Manual sync failed:', error);
      setIsSyncing(false);
      setSyncStatus('error');
      return { success: false, message: error?.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ Supabase' };
    }
  };

  const clearAllRecords = async () => {
    const currentUid = activeUserIdRef.current;
    setRecords([]);
    if (currentUid) {
      saveUserData(currentUid, 'records', []);
      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase.from('health_records').delete().eq('user_id', currentUid);
          if (error) console.error('[Supabase] Clear all records error:', error);
        } catch (err) {
          console.error('[Supabase] Clear all records exception:', err);
        }
      }
    }
  };

  const clearAllData = async () => {
    const currentUid = activeUserIdRef.current;
    setCitizens([]);
    setRecords([]);
    if (currentUid) {
      saveUserData(currentUid, 'citizens', []);
      saveUserData(currentUid, 'records', []);
      if (isSupabaseConfigured) {
        try {
          const { error: recErr } = await supabase.from('health_records').delete().eq('user_id', currentUid);
          if (recErr) console.error('[Supabase] Clear all records error:', recErr);
          const { error: citErr } = await supabase.from('citizens').delete().eq('user_id', currentUid);
          if (citErr) console.error('[Supabase] Clear all citizens error:', citErr);
        } catch (err) {
          console.error('[Supabase] Clear all data exception:', err);
        }
      }
    }
  };

  // ==========================================================
  // Shared Reports: Send, Accept, Reject, Download, Delete
  // ==========================================================

  // Primary: Send Citizen & Health Records to another User (by Phone, Email, or receiverId)
  const sendSharedReport = async ({
    citizen,
    citizens: multipleCitizens,
    records: selectedRecords = [],
    receiverId,
    receiverPhone,
    receiverEmail,
    receiverName,
    title,
    note
  }: {
    citizen?: Citizen;
    citizens?: Citizen[];
    records?: HealthRecord[];
    receiverId?: string;
    receiverPhone?: string;
    receiverEmail?: string;
    receiverName?: string;
    title?: string;
    note?: string;
  }): Promise<{ success: boolean; message: string; report?: SharedReport }> => {
    const effectiveCitizens = (multipleCitizens && multipleCitizens.length > 0)
      ? multipleCitizens
      : (citizen ? [citizen] : []);

    if (effectiveCitizens.length === 0) {
      return { success: false, message: 'กรุณาเลือกข้อมูลประชาชนที่ต้องการส่งต่อ' };
    }

    const primaryCitizen = effectiveCitizens[0];

    console.log('[DATA LOSS DEBUG]', {
      currentUserId: user?.id,
      citizensBefore: citizens.length,
      healthRecordsBefore: records.length
    });

    const currentUserId = user?.id || 'guest';
    const myPhone = (vhvProfile.phone || user?.phone || '').replace(/\D/g, '');
    let targetReceiverId = receiverId || '';
    let targetPhone = (receiverPhone || '').replace(/\D/g, '');
    let resolvedReceiverName = receiverName || '';

    // Auto lookup receiver if receiverId is missing
    if (!targetReceiverId && (targetPhone || receiverEmail)) {
      const lookupQuery = targetPhone || (receiverEmail || '');
      const lookupResult = await lookupReceiverProfile(lookupQuery);
      if (lookupResult.success && lookupResult.data) {
        targetReceiverId = lookupResult.data.userId;
        resolvedReceiverName = lookupResult.data.name;
        if (!targetPhone && lookupResult.data.phone) {
          targetPhone = lookupResult.data.phone;
        }
      } else {
        return { 
          success: false, 
          message: lookupResult.error || 'ไม่พบบัญชีผู้รับในระบบ กรุณาตรวจสอบเบอร์โทรศัพท์หรืออีเมล' 
        };
      }
    }

    if (!targetReceiverId) {
      return { success: false, message: 'กรุณาระบุข้อมูลผู้รับ (เบอร์โทร หรือ อีเมล) ที่มีอยู่ในระบบ' };
    }

    if (targetReceiverId === currentUserId) {
      return { success: false, message: 'ไม่สามารถส่งข้อมูลให้บัญชีตัวเองได้' };
    }
    if (myPhone && targetPhone && targetPhone === myPhone) {
      return { success: false, message: 'ไม่สามารถส่งข้อมูลหาเบอร์โทรของตัวเองได้' };
    }

    // Filter records for these citizens if not provided
    const citRecords = selectedRecords.length > 0
      ? selectedRecords
      : records.filter(r => effectiveCitizens.some(c => c.id === r.citizenId));

    const fullName = effectiveCitizens.length === 1
      ? `${primaryCitizen.prefix || ''}${primaryCitizen.firstName} ${primaryCitizen.lastName}`.trim()
      : `รายงานรวม (${effectiveCitizens.length} คน)`;
    const reportTitle = title?.trim() || `ส่งต่อข้อมูลสุขภาพ: ${fullName}`;
    const periodLabel = citRecords.length > 0 ? `${citRecords.length} รายการตรวจ` : 'ข้อมูลประวัติ';

    // Generate Excel backup
    const excelObj = createExcelWorkbookBase64(
      citRecords,
      effectiveCitizens,
      vhvProfile,
      effectiveCitizens.length === 1 ? `ส่งต่อ_${primaryCitizen.firstName}_${primaryCitizen.lastName}` : `รายงานสุขภาพ_${effectiveCitizens.length}_คน`,
      periodLabel
    );

    // Generate UUID for Supabase compatibility
    const generatedId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, '0')}`;

    const newReport: SharedReport = {
      id: generatedId,
      senderId: currentUserId,
      senderName: vhvProfile.name || 'อสม.',
      senderPhone: myPhone,
      senderVillage: vhvProfile.villageName || undefined,
      senderHealthCenter: vhvProfile.healthCenterName || undefined,
      receiverId: targetReceiverId,
      receiverPhone: targetPhone,
      receiverName: resolvedReceiverName || undefined,
      title: reportTitle,
      periodLabel: periodLabel,
      recordsCount: citRecords.length,
      citizensCount: effectiveCitizens.length,
      fileName: excelObj.fileName,
      excelBase64: excelObj.base64,
      recordsData: citRecords,
      citizensData: effectiveCitizens,
      citizenData: primaryCitizen,
      healthRecords: citRecords,
      note: note?.trim() || undefined,
      message: note?.trim() || undefined,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const supabasePayload = mapSharedReportToSupabase(newReport, currentUserId, targetReceiverId);

    // 1. Online direct insert to Supabase with error check
    if (user?.id && isSupabaseConfigured && navigator.onLine) {
      try {
        const { error } = await executeWithAuthRetry(() =>
          supabase
            .from('shared_reports')
            .insert(supabasePayload)
            .select()
            .single()
        );

        if (error) {
          console.error('[SharedReport Insert]', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });

          return {
            success: false,
            message: `เกิดข้อผิดพลาดในการส่งข้อมูล: ${error.message}`
          };
        }

        // Successfully inserted to Supabase -> Update local state and storage
        setSharedReportsSent(prev => [newReport, ...prev]);
        saveUserData(user.id, 'shared_reports_sent', [newReport, ...sharedReportsSent]);

        console.log('[DATA LOSS DEBUG AFTER SEND]', {
          currentUserId: user?.id,
          citizensAfter: citizens.length,
          healthRecordsAfter: records.length
        });

        return {
          success: true,
          message: `ส่งต่อข้อมูลของ "${fullName}" ให้ ${resolvedReceiverName || targetPhone || 'ผู้รับ'} เรียบร้อยแล้ว!`,
          report: newReport
        };
      } catch (err: any) {
        console.error('[SharedReport Insert Exception]', err);
        return {
          success: false,
          message: `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err?.message || 'โปรดลองใหม่อีกครั้ง'}`
        };
      }
    }

    // 2. Offline Mode: Optimistic local state update and queue for offline sync
    setSharedReportsSent(prev => [newReport, ...prev]);
    if (user?.id) {
      saveUserData(user.id, 'shared_reports_sent', [newReport, ...sharedReportsSent]);
      addToSyncQueue(user.id, {
        action: 'send_shared_report',
        payload: supabasePayload
      });
    }

    console.log('[DATA LOSS DEBUG AFTER SEND]', {
      currentUserId: user?.id,
      citizensAfter: citizens.length,
      healthRecordsAfter: records.length
    });

    return {
      success: true,
      message: `บันทึกคำสั่งส่งต่อข้อมูลแบบออฟไลน์เรียบร้อย ระบบจะส่งต่ออัตโนมัติเมื่อออนไลน์`,
      report: newReport
    };
  };

  // Backward compatible: Send multiple records to phone
  const sendReportToPhone = async ({
    receiverPhone,
    receiverId,
    title,
    note,
    records: selectedRecords,
    periodLabel = 'ทั้งหมด'
  }: {
    receiverPhone: string;
    receiverId?: string;
    title?: string;
    note?: string;
    records: HealthRecord[];
    periodLabel?: string;
  }): Promise<{ success: boolean; message: string; report?: SharedReport }> => {
    const cleanReceiverPhone = receiverPhone.replace(/\D/g, '').trim();
    if (!cleanReceiverPhone && !receiverId) {
      return { success: false, message: 'กรุณาระบุเบอร์โทรศัพท์ผู้รับให้ถูกต้อง (9-10 หลัก)' };
    }

    const relevantCitizens = citizens.filter(c => selectedRecords.some(r => r.citizenId === c.id));
    const targetCitizen = relevantCitizens[0] || {
      id: `cit-${Date.now()}`,
      idCard: '',
      prefix: '',
      firstName: 'รายงานรวม',
      lastName: '',
      gender: '',
      birthDate: '',
      age: 0,
      phone: '',
      houseNo: '',
      moo: ''
    };

    return sendSharedReport({
      citizen: targetCitizen,
      records: selectedRecords,
      receiverId: receiverId,
      receiverPhone: cleanReceiverPhone,
      title: title || `รายงานตรวจสุขภาพ (${periodLabel})`,
      note: note
    });
  };

  // Accept Shared Report: Uses atomic Database RPC (accept_shared_report) to import into receiver account
  const acceptSharedReport = async (
    report: SharedReport
  ): Promise<{ success: boolean; message: string; importedCitizens: number; importedRecords: number }> => {
    if (report.status === 'accepted') {
      return { success: false, message: 'รายงานนี้ได้รับการตอบรับและนำเข้าข้อมูลแล้ว', importedCitizens: 0, importedRecords: 0 };
    }

    const targetUserId = user?.id;
    if (!targetUserId) {
      return { success: false, message: 'กรุณาเข้าสู่ระบบก่อนตอบรับรายงาน', importedCitizens: 0, importedRecords: 0 };
    }

    // 1. If Online & Supabase Configured -> Execute Atomic RPC Procedure
    if (isSupabaseConfigured && navigator.onLine) {
      try {
        console.log('[Supabase] Executing accept_shared_report RPC for report:', report.id);
        const { data: rpcData, error: rpcErr } = await executeWithAuthRetry(() =>
          supabase.rpc('accept_shared_report', {
            target_report_id: report.id
          })
        );

        if (rpcErr) {
          console.error('[Supabase] accept_shared_report RPC error:', {
            code: rpcErr.code,
            message: rpcErr.message,
            details: rpcErr.details,
            hint: rpcErr.hint
          });
          return {
            success: false,
            message: `ไม่สามารถตอบรับรายงานได้: ${rpcErr.message}`,
            importedCitizens: 0,
            importedRecords: 0
          };
        }

        console.log('[Supabase] accept_shared_report RPC success result:', rpcData);

        // Update local report status
        const updatedReceived = sharedReportsReceived.map(r =>
          r.id === report.id ? { ...r, status: 'accepted' as const, acceptedAt: new Date().toISOString() } : r
        );
        setSharedReportsReceived(updatedReceived);
        saveUserData(targetUserId, 'shared_reports', updatedReceived);

        // Refresh citizens & records from Supabase to get the newly created records with server IDs
        await fetchUserDataFromSupabase(targetUserId);

        const importedCitizens = (rpcData as any)?.imported_citizens || (report.citizensCount || 1);
        const importedRecords = (rpcData as any)?.imported_records || (report.recordsCount || 0);

        return {
          success: true,
          message: `ตอบรับรายงานเรียบร้อย! ข้อมูลประชาชน (${importedCitizens} คน) และผลตรวจสุขภาพ (${importedRecords} รายการ) ถูกนำเข้าสู่บัญชีของคุณแล้ว`,
          importedCitizens,
          importedRecords
        };
      } catch (err: any) {
        console.error('[Supabase] Exception during accept_shared_report RPC:', err);
        return {
          success: false,
          message: `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err?.message || 'โปรดลองใหม่อีกครั้ง'}`,
          importedCitizens: 0,
          importedRecords: 0
        };
      }
    }

    // 2. Offline Mode: Optimistic local state update with deterministic IDs and queue RPC for sync
    let importedCitCount = 0;
    let importedRecCount = 0;

    const rawCitizens = report.citizensData && report.citizensData.length > 0
      ? report.citizensData
      : (report.citizenData ? [report.citizenData] : []);

    const existingCitizensByIdCard = new Map<string, Citizen>();
    for (const c of citizens) {
      const cleanId = c.idCard?.trim() || '';
      if (/^[0-9]{13}$/.test(cleanId)) {
        existingCitizensByIdCard.set(cleanId, c);
      }
    }

    const newCitizensToAdd: Citizen[] = [];
    const citizenIdMap = new Map<string, string>();
    let citIdx = 0;

    for (const cit of rawCitizens) {
      citIdx++;
      const cleanIdCard = cit.idCard ? cit.idCard.trim() : '';
      const existingCit = /^[0-9]{13}$/.test(cleanIdCard) ? existingCitizensByIdCard.get(cleanIdCard) : undefined;

      if (existingCit) {
        citizenIdMap.set(cit.id, existingCit.id);
      } else {
        const sourceCitId = (cit.id || `cit_${citIdx}`).trim();
        const deterministicCitId = getDeterministicImportedCitizenId(report.id, sourceCitId);
        citizenIdMap.set(cit.id, deterministicCitId);

        const alreadyInLocal = citizens.some(c => c.id === deterministicCitId);
        if (!alreadyInLocal) {
          const newCit: Citizen = {
            ...cit,
            id: deterministicCitId,
            userId: targetUserId,
            createdAt: new Date().toISOString().split('T')[0]
          };
          newCitizensToAdd.push(newCit);
          if (/^[0-9]{13}$/.test(cleanIdCard)) {
            existingCitizensByIdCard.set(cleanIdCard, newCit);
          }
          importedCitCount++;
        }
      }
    }

    const rawRecords = report.recordsData && report.recordsData.length > 0
      ? report.recordsData
      : (report.healthRecords || []);

    const existingRecordIds = new Set(records.map(r => r.id));
    const newRecordsToAdd: HealthRecord[] = [];
    let recIdx = 0;

    for (const rec of rawRecords) {
      recIdx++;
      const targetCitId = citizenIdMap.get(rec.citizenId) || (newCitizensToAdd[0]?.id || citizens[0]?.id || rec.citizenId);
      const sourceRecId = (rec.id || `rec_${recIdx}`).trim();
      const deterministicRecId = getDeterministicImportedRecordId(report.id, sourceRecId);

      // Identity is STRICTLY based on unique record ID (Never by date or clinical values!)
      if (!existingRecordIds.has(deterministicRecId)) {
        const newRec: HealthRecord = {
          ...rec,
          id: deterministicRecId,
          citizenId: targetCitId,
          userId: targetUserId,
          createdAt: rec.createdAt || new Date().toISOString()
        };
        newRecordsToAdd.push(newRec);
        existingRecordIds.add(deterministicRecId);
        importedRecCount++;
      }
    }

    const updatedReceived = sharedReportsReceived.map(r =>
      r.id === report.id ? { ...r, status: 'accepted' as const, acceptedAt: new Date().toISOString() } : r
    );
    setSharedReportsReceived(updatedReceived);

    if (newCitizensToAdd.length > 0) {
      setCitizens(prev => [...newCitizensToAdd, ...prev]);
    }
    if (newRecordsToAdd.length > 0) {
      setRecords(prev => [...newRecordsToAdd, ...prev]);
    }

    saveUserData(targetUserId, 'shared_reports', updatedReceived);
    if (newCitizensToAdd.length > 0) saveUserData(targetUserId, 'citizens', [...newCitizensToAdd, ...citizens]);
    if (newRecordsToAdd.length > 0) saveUserData(targetUserId, 'records', [...newRecordsToAdd, ...records]);

    addToSyncQueue(targetUserId, {
      action: 'accept_shared_report',
      payload: { reportId: report.id }
    });

    return {
      success: true,
      message: `บันทึกข้อมูลแบบออฟไลน์เรียบร้อย (${importedCitCount} คน, ${importedRecCount} รายการ) จะซิงค์กับคลาวด์เมื่อออนไลน์`,
      importedCitizens: importedCitCount,
      importedRecords: importedRecCount
    };
  };

  // Reject Shared Report
  const rejectSharedReport = async (
    reportId: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> => {
    const updatedReceived = sharedReportsReceived.map(r => 
      r.id === reportId ? { ...r, status: 'rejected' as const, rejectedAt: new Date().toISOString() } : r
    );
    setSharedReportsReceived(updatedReceived);

    if (user?.id) {
      saveUserData(user.id, 'shared_reports', updatedReceived);
      addToSyncQueue(user.id, {
        action: 'reject_shared_report',
        payload: { reportId, note: reason }
      });
    }

    if (isSupabaseConfigured && navigator.onLine) {
      try {
        let rpcErr: any = null;
        const res1 = await executeWithAuthRetry(() =>
          supabase.rpc('reject_shared_report', { 
            target_report_id: reportId,
            reason: reason || null
          })
        );
        rpcErr = res1.error;

        if (rpcErr && rpcErr.message?.includes('function')) {
          const res2 = await executeWithAuthRetry(() =>
            supabase.rpc('reject_shared_report', { 
              target_report_id: reportId,
              reason_note: reason || null
            })
          );
          rpcErr = res2.error;
        }

        if (rpcErr) {
          console.error('[Supabase] Reject shared report RPC error:', {
            code: rpcErr.code,
            message: rpcErr.message,
            details: rpcErr.details,
            hint: rpcErr.hint
          });
        }
      } catch (err) {
        console.error('[Supabase] Reject shared report error:', err);
      }
    }

    return { success: true, message: 'ปฏิเสธการรับรายงานเรียบร้อยแล้ว' };
  };

  // Download Shared Report as Excel
  const downloadSharedReport = async (report: SharedReport) => {
    const recordsToExport = report.recordsData || report.healthRecords || [];
    const citizensToExport = report.citizensData || (report.citizenData ? [report.citizenData] : []);

    if (!report.excelBase64) {
      const excelObj = createExcelWorkbookBase64(
        recordsToExport,
        citizensToExport,
        { ...vhvProfile, name: report.senderName, villageName: report.senderVillage || vhvProfile.villageName },
        'รายงานผลตรวจสุขภาพ_ที่ได้รับ',
        report.periodLabel
      );
      downloadExcelFromBase64(excelObj.base64, report.fileName || excelObj.fileName);
    } else {
      downloadExcelFromBase64(report.excelBase64, report.fileName);
    }
  };

  // Legacy / Direct Import
  const importSharedReport = async (
    report: SharedReport
  ): Promise<{ success: boolean; message: string; importedCitizens: number; importedRecords: number }> => {
    return acceptSharedReport(report);
  };

  // Delete Shared Report
  const deleteSharedReport = async (reportId: string): Promise<{ success: boolean; message: string }> => {
    setSharedReportsReceived(prev => prev.filter(r => r.id !== reportId));
    setSharedReportsSent(prev => prev.filter(r => r.id !== reportId));

    if (user?.id) {
      saveUserData(user.id, 'shared_reports', sharedReportsReceived.filter(r => r.id !== reportId));
      saveUserData(user.id, 'shared_reports_sent', sharedReportsSent.filter(r => r.id !== reportId));
      addToSyncQueue(user.id, {
        action: 'delete_shared_report',
        payload: { id: reportId }
      });
    }

    if (isSupabaseConfigured) {
      try {
        await executeWithAuthRetry(() => supabase.from('shared_reports').delete().eq('id', reportId));
      } catch (e) {
        console.error('[Supabase] Delete shared report error:', e);
      }
    }

    return { success: true, message: 'ลบรายงานเรียบร้อยแล้ว' };
  };

  // Group citizens into households
  const households: HouseholdSummary[] = useMemo(() => {
    const map = new Map<string, Citizen[]>();
    citizens.forEach(c => {
      const key = `${c.houseNo.trim()}_${c.moo.trim()}`;
      const existing = map.get(key) || [];
      existing.push(c);
      map.set(key, existing);
    });

    const result: HouseholdSummary[] = [];
    map.forEach((members) => {
      const first = members[0];
      const houseRecords = records.filter(r => members.some(m => m.id === r.citizenId));

      let latestDate: string | undefined = undefined;
      if (houseRecords.length > 0) {
        houseRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        latestDate = houseRecords[0].date;
      }

      result.push({
        houseNo: first.houseNo,
        moo: first.moo,
        villageName: first.villageName,
        members,
        memberCount: members.length,
        latestCheckupDate: latestDate,
      });
    });

    return result.sort((a, b) => a.houseNo.localeCompare(b.houseNo, undefined, { numeric: true }));
  }, [citizens, records]);

  return (
    <AppContext.Provider
      value={{
        user,
        authLoading,
        isOnline,
        isSyncing,
        syncStatus,
        supabaseConnected,
        loginWithPhone,
        signUpWithPhone,
        logout,
        vhvProfile,
        updateProfile,
        citizens,
        addCitizen,
        updateCitizen,
        deleteCitizen,
        clearAllRecords,
        clearAllData,
        syncWithSupabase,
        records,
        addHealthRecord,
        deleteHealthRecord,
        sharedReportsReceived,
        sharedReportsSent,
        unreadReceivedCount,
        sendSharedReport,
        sendReportToPhone,
        acceptSharedReport,
        rejectSharedReport,
        downloadSharedReport,
        importSharedReport,
        deleteSharedReport,
        fetchSharedReports,
        fontSize,
        setFontSize,
        activeTab,
        setActiveTab,
        analyticsViewMode,
        setAnalyticsViewMode,
        inboxActiveTab,
        setInboxActiveTab,
        pendingSyncCount,
        selectedCitizenForProfile,
        setSelectedCitizenForProfile,
        selectedCitizenForCheckup,
        setSelectedCitizenForCheckup,
        households,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
