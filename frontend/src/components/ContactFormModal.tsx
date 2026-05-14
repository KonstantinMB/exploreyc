import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { api } from '../lib/api';

interface ContactFormModalProps {
  open: boolean;
  onClose: () => void;
}

export function ContactFormModal({ open, onClose }: ContactFormModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !message.trim()) return;
    setStatus('sending');
    setErrorMsg('');
    try {
      const response = await api.post('/api/contact', {
        email: email.trim(),
        name: name.trim(),
        message: message.trim(),
      });
      if (response.data?.success) {
        setSubmittedEmail(email.trim());
        setStatus('success');
        setEmail('');
        setName('');
        setMessage('');
      } else {
        setStatus('error');
        setErrorMsg('Something went wrong. Please try again.');
      }
    } catch (err: unknown) {
      setStatus('error');
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : 'Failed to send. Please try again.';
      setErrorMsg(typeof msg === 'string' ? msg : 'Failed to send. Please try again.');
    }
  };

  const handleClose = () => {
    setStatus('idle');
    setErrorMsg('');
    setSubmittedEmail('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-[#FB651E]">Got a feature idea?</DialogTitle>
          <DialogDescription>
            Share your feedback and we'll get back to you.
          </DialogDescription>
        </DialogHeader>

        {status === 'success' ? (
          <div className="py-6 text-center">
            <p className="text-green-600 font-medium">Thanks! We got your message.</p>
            <p className="text-sm text-muted-foreground mt-1">We'll reply to {submittedEmail} soon.</p>
            <Button onClick={handleClose} className="mt-4">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="contact-email">Email *</Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={status === 'sending'}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="contact-name">Name</Label>
              <Input
                id="contact-name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={status === 'sending'}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="contact-message">Message *</Label>
              <textarea
                id="contact-message"
                rows={4}
                placeholder="Tell us about your feature idea..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                disabled={status === 'sending'}
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            {errorMsg && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={handleClose} disabled={status === 'sending'}>
                Cancel
              </Button>
              <Button type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
