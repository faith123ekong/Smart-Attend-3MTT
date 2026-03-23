import { collection, addDoc, doc, getDoc, query, where, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { OfflineAttendance, Session, UserProfile, AttendanceRecord } from '../types';
import { logAction } from './logger';
import { createNotification } from '../services/notificationService';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const STORAGE_KEY = 'pending_attendance_sync';

export const saveOfflineAttendance = (record: OfflineAttendance) => {
  const pending = getPendingSync();
  pending.push(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
};

export const getPendingSync = (): OfflineAttendance[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const updateOfflineRecord = (updatedRecord: OfflineAttendance) => {
  const pending = getPendingSync();
  const index = pending.findIndex(r => r.id === updatedRecord.id);
  if (index !== -1) {
    pending[index] = updatedRecord;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
  }
};

export const clearSyncedRecords = () => {
  const pending = getPendingSync();
  const remaining = pending.filter(r => r.syncStatus === 'pending' || r.syncStatus === 'rejected');
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
};

export const syncAttendance = async (profile: UserProfile): Promise<{ success: number, rejected: number }> => {
  const pending = getPendingSync().filter(r => r.syncStatus === 'pending');
  let successCount = 0;
  let rejectedCount = 0;

  if (pending.length === 0) return { success: 0, rejected: 0 };

  for (const record of pending) {
    try {
      // 1. Fetch Session
      let sessionSnap;
      try {
        const sessionRef = doc(db, 'sessions', record.sessionId);
        sessionSnap = await getDoc(sessionRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `sessions/${record.sessionId}`);
        throw err;
      }

      if (!sessionSnap.exists()) {
        record.syncStatus = 'rejected';
        record.syncError = 'Session not found';
        updateOfflineRecord(record);
        rejectedCount++;
        
        // Notify Admins
        const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
        const adminDocs = await getDocs(adminQuery);
        adminDocs.forEach(adminDoc => {
          createNotification(
            adminDoc.id,
            'Sync Rejected',
            `Offline sync rejected for ${profile.displayName}: Session not found.`,
            'error',
            'logs'
          );
        });
        continue;
      }

      const session = sessionSnap.data() as Session;
      const recordTime = new Date(record.timestamp);
      const startTime = new Date(session.startTime);
      const endTime = new Date(session.endTime);

      // 2. Check Expiry
      if (recordTime > endTime) {
        record.syncStatus = 'rejected';
        record.syncError = 'Class had ended at time of check-in';
        updateOfflineRecord(record);
        rejectedCount++;
        
        // Notify Admins
        const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
        const adminDocs = await getDocs(adminQuery);
        adminDocs.forEach(adminDoc => {
          createNotification(
            adminDoc.id,
            'Sync Rejected',
            `Offline sync rejected for ${profile.displayName}: Class ended.`,
            'error',
            'logs'
          );
        });

        await logAction('sync_rejected', `Sync rejected for user ${profile.email}: Class ended.`, record.sessionId, session.courseId, profile.uid, profile.displayName, session.lecturerId);
        continue;
      }

      // 3. Device Check
      if (profile.role === 'student' && profile.deviceId && record.deviceId !== profile.deviceId && !profile.deviceAllowed) {
        record.syncStatus = 'rejected';
        record.syncError = 'Device mismatch';
        updateOfflineRecord(record);
        rejectedCount++;

        // Notify Admins
        const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
        const adminDocs = await getDocs(adminQuery);
        adminDocs.forEach(adminDoc => {
          createNotification(
            adminDoc.id,
            'Sync Rejected',
            `Offline sync rejected for ${profile.displayName}: Device mismatch.`,
            'error',
            'logs'
          );
        });

        await logAction('sync_rejected', `Sync rejected for user ${profile.email}: Device mismatch.`, record.sessionId, session.courseId, profile.uid, profile.displayName, session.lecturerId);
        continue;
      }

      // 4. Check Location (100m range)
      const distance = calculateDistance(
        record.location.lat, record.location.lng,
        session.location.lat, session.location.lng
      );
      
      const isAdmin = profile.email === 'faith123ekong@gmail.com';
      if (distance > 100 && !isAdmin) {
        record.syncStatus = 'rejected';
        record.syncError = 'Attendance not recorded';
        updateOfflineRecord(record);
        rejectedCount++;

        // Notify Admins
        const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
        const adminDocs = await getDocs(adminQuery);
        adminDocs.forEach(adminDoc => {
          createNotification(
            adminDoc.id,
            'Sync Rejected',
            `Offline sync rejected for ${profile.displayName}: Out of range.`,
            'error',
            'logs'
          );
        });

        await logAction('sync_rejected', `Sync rejected for user ${profile.email}: Out of range.`, record.sessionId, session.courseId, profile.uid, profile.displayName, session.lecturerId);
        continue;
      }

      // 5. Check if already marked
      let existing;
      try {
        const q = query(
          collection(db, 'attendance'),
          where('sessionId', '==', record.sessionId),
          where('studentId', '==', profile.uid)
        );
        existing = await getDocs(q);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'attendance');
        throw err;
      }

      if (!existing.empty) {
        record.syncStatus = 'synced'; // Already exists, consider it synced
        updateOfflineRecord(record);
        successCount++;
        continue;
      }

      // 6. Mark Attendance in DB
      try {
        const attendanceRef = doc(db, 'attendance', record.id);
        const { syncStatus, syncError, sessionName, ...dbRecord } = record;
        // Convert timestamp string back to Firestore Timestamp
        const finalRecord = {
          ...dbRecord,
          timestamp: Timestamp.fromDate(new Date(record.timestamp)),
          courseId: session.courseId, // Ensure courseId is correct
          lecturerId: session.lecturerId,
          syncedAt: Timestamp.now()
        };
        await setDoc(attendanceRef, finalRecord);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `attendance/${record.id}`);
        throw err;
      }

      // 7. Update local record
      record.syncStatus = 'synced';
      updateOfflineRecord(record);
      successCount++;

      // Notify Student
      await createNotification(
        profile.uid,
        'Offline Sync Success',
        `Your offline attendance for ${session.courseId} has been synced successfully.`,
        'success',
        'overview'
      );

      // Notify Lecturer
      await createNotification(
        session.lecturerId,
        'Offline Sync Completed',
        `A student (${profile.displayName}) has synced their offline attendance for ${session.courseId}.`,
        'info',
        'sessions'
      );

      // 8. Log success
      await logAction(
        'sync_success',
        `Offline attendance synced successfully for user ${profile.email}`,
        record.sessionId,
        session.courseId,
        profile.uid,
        profile.displayName,
        session.lecturerId
      );

    } catch (error: any) {
      console.error('Sync error for record:', record.id, error);
      // Keep as pending to retry later unless it's a fatal rejection
    }
  }
  return { success: successCount, rejected: rejectedCount };
};

export const cleanupOldLocationData = async () => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // 1. Cleanup Attendance Records
    const qAttendance = query(
      collection(db, 'attendance'),
      where('timestamp', '<=', twentyFourHoursAgo)
    );
    const attendanceDocs = await getDocs(qAttendance);
    for (const docSnap of attendanceDocs.docs) {
      const data = docSnap.data();
      if (data.location) {
        await setDoc(docSnap.ref, { location: null }, { merge: true });
      }
    }

    // 2. Cleanup Sessions
    const qSessions = query(
      collection(db, 'sessions'),
      where('endTime', '<=', twentyFourHoursAgo)
    );
    const sessionDocs = await getDocs(qSessions);
    for (const docSnap of sessionDocs.docs) {
      const data = docSnap.data();
      if (data.location) {
        await setDoc(docSnap.ref, { location: null }, { merge: true });
      }
    }

    console.log('Location data cleanup completed successfully');
  } catch (error) {
    console.error('Cleanup Error:', error);
  }
};
