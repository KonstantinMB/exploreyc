import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { api } from '../lib/api';

export function EmailSubscription() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic email validation
    if (!email || !email.includes('@')) {
      setStatus('error');
      setMessage('Please enter a valid email address');
      return;
    }

    setStatus('loading');

    try {
      const response = await api.post('/api/subscribe', {
        email,
        preferences: {}
      });

      if (response.data.success) {
        const emailSent = response.data.email_sent !== false;
        setStatus('success');
        setMessage(
          emailSent
            ? 'Check your email to verify your subscription!'
            : 'Subscription saved, but the verification email could not be sent. Add RESEND_API_KEY to Railway to enable emails.'
        );
        setEmail('');
      } else {
        setStatus('error');
        setMessage('Subscription failed. Please try again.');
      }
    } catch (error: any) {
      setStatus('error');
      setMessage(error.response?.data?.detail || 'Something went wrong. Please try again.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="border-[#FB651E]/20 bg-gradient-to-br from-background to-[#FB651E]/5 rounded-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 font-mono text-lg">
            <Mail className="h-5 w-5 text-[#FB651E]" />
            Daily YC Updates
          </CardTitle>
          <CardDescription className="font-mono text-xs">
            One email a day when new companies join or start hiring.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'success' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
            >
              <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-green-900 dark:text-green-100 text-sm">
                  Subscription Pending
                </h4>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  {message}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatus('idle')}
                  className="mt-2 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30"
                >
                  Subscribe another email
                </Button>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubscribe} className="space-y-2">
              {/* Field and button on one line: this is a single input, and a
                  full-width stacked form made it look like a signup flow. */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="font-mono border-[#FB651E]/20 focus:border-[#FB651E]/50 sm:flex-1"
                  disabled={status === 'loading'}
                />
                <Button
                  type="submit"
                  disabled={status === 'loading'}
                  className="bg-[#FB651E] hover:bg-[#E65C00] text-white font-mono sm:w-auto"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Subscribing…
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Subscribe
                    </>
                  )}
                </Button>
              </div>

              {status === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400"
                >
                  <AlertCircle className="h-4 w-4" />
                  {message}
                </motion.div>
              )}

              {/* The four bullet points, as one line. */}
              <p className="font-mono text-[11px] text-muted-foreground">
                New companies · new roles · batch changes. Unsubscribe in one click.
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
