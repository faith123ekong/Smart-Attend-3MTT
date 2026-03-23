import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { SessionLog } from '../types';

export const logAction = async (
  action: SessionLog['action'],
  details: string,
  sessionId?: string,
  courseId?: string,
  userId?: string,
  userName?: string,
  lecturerId?: string
) => {
  try {
    await addDoc(collection(db, 'logs'), {
      action,
      details,
      sessionId: sessionId || null,
      courseId: courseId || null,
      userId: userId || null,
      userName: userName || null,
      lecturerId: lecturerId || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Logging Error:', error);
  }
};
