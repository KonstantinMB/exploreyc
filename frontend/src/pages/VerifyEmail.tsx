import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

export function VerifyEmail() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link');
      return;
    }

    api
      .get(`/api/verify-email/${token}`)
      .then((res) => {
        if (res.data.success) {
          setStatus('success');
          setMessage('Email verified! You\'ll receive your first digest soon.');
        } else {
          setStatus('error');
          setMessage('Verification failed');
        }
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.response?.data?.detail || 'Verification failed. The link may have expired.');
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#F6F6EF] dark:bg-[#0a0a0a] flex items-center justify-center p-4">
      <motion.div
        className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-xl shadow-lg p-8 text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 text-[#FB651E] animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Verifying your email...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-xl font-bold mb-2">You're all set!</h1>
            <p className="text-muted-foreground mb-6">{message}</p>
            <a
              href="/"
              className="inline-block px-6 py-3 bg-[#FB651E] text-white rounded-lg font-medium hover:bg-[#E65C00] transition-colors"
            >
              Explore companies →
            </a>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-xl font-bold mb-2">Verification failed</h1>
            <p className="text-muted-foreground mb-6">{message}</p>
            <a
              href="/"
              className="inline-block px-6 py-3 bg-[#FB651E] text-white rounded-lg font-medium hover:bg-[#E65C00] transition-colors"
            >
              Back to home
            </a>
          </>
        )}
      </motion.div>
    </div>
  );
}
