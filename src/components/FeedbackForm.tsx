import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Feedback } from '../types';
import { Star, Send, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FeedbackFormProps {
  profile: UserProfile;
  onClose: () => void;
}

const ratings = [
  { label: 'Very easy', color: 'bg-emerald-500' },
  { label: 'Easy', color: 'bg-emerald-400' },
  { label: 'Moderate', color: 'bg-amber-400' },
  { label: 'Difficult', color: 'bg-orange-400' },
  { label: 'Very difficult', color: 'bg-red-500' },
];

export default function FeedbackForm({ profile, onClose }: FeedbackFormProps) {
  const [selectedRating, setSelectedRating] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!selectedRating) return;
    
    setLoading(true);
    try {
      const now = new Date();
      const feedback: Omit<Feedback, 'id'> = {
        userId: profile.uid,
        userName: profile.displayName,
        role: profile.role,
        rating: selectedRating as Feedback['rating'],
        timestamp: now.toISOString(),
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
      };

      await addDoc(collection(db, 'feedback'), feedback);
      setSubmitted(true);
      setTimeout(onClose, 2000);
    } catch (error) {
      console.error('Error saving feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-bg rounded-[32px] shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800"
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-surface rounded-2xl text-[#186E23]">
                <Star className="w-6 h-6 fill-current" />
              </div>
              <h3 className="text-xl font-bold text-body">App Feedback</h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-surface rounded-xl transition-all">
              <X className="w-6 h-6 text-slate-400 dark:text-slate-500" />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div 
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-8"
              >
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-12 h-12" />
                </div>
                <h4 className="text-2xl font-bold text-body mb-2">Thank You!</h4>
                <p className="text-slate-500 dark:text-slate-400">Your feedback helps us improve Smart Attend.</p>
              </motion.div>
            ) : (
              <motion.div key="form" className="space-y-6">
                <p className="text-slate-600 dark:text-slate-400 font-medium">How easy is it to use this app?</p>
                
                <div className="space-y-3">
                  {ratings.map((r) => (
                    <button
                      key={r.label}
                      onClick={() => setSelectedRating(r.label)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                        selectedRating === r.label 
                          ? 'border-[#186E23] bg-surface shadow-md' 
                          : 'border-slate-100 dark:border-slate-800 bg-surface hover:border-slate-200 dark:hover:border-slate-700'
                      }`}
                    >
                      <span className={`font-bold ${selectedRating === r.label ? 'text-[#186E23]' : 'text-slate-600 dark:text-slate-400'}`}>
                        {r.label}
                      </span>
                      <div className={`w-3 h-3 rounded-full ${r.color}`} />
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={!selectedRating || loading}
                  className="w-full bg-[#186E23] text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 hover:bg-[#145A1D] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Submit Feedback
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
