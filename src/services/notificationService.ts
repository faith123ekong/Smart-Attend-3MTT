import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Notification } from '../types';

export const createNotification = async (
  userId: string,
  title: string,
  message: string,
  type: 'success' | 'warning' | 'info' | 'error' = 'info',
  link?: string
) => {
  try {
    const notificationData: Omit<Notification, 'id'> = {
      userId,
      title,
      message,
      type,
      read: false,
      timestamp: new Date().toISOString(),
      link
    };

    await addDoc(collection(db, 'notifications'), notificationData);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};
