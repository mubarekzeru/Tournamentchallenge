import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
} from 'lucide-react';
import { TWO_STEP_MASTER_KEY } from '../data/tournamentData';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPasswordChanged: (newPassword: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  onPasswordChanged,
}) => {
  const [twoStepKey, setTwoStepKey] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [showTwoStep, setShowTwoStep] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prevent background layer web scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (twoStepKey.trim() !== TWO_STEP_MASTER_KEY) {
      setErrorMsg('Incorrect 2-step verification master key.');
      return;
    }

    if (!newPasscode || newPasscode.trim().length < 3) {
      setErrorMsg('New passcode cannot be empty.');
      return;
    }

    if (newPasscode !== confirmPasscode) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twoStepKey: twoStepKey.trim(),
          newPasscode: newPasscode.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorMsg('Incorrect 2-step verification master key.');
        setIsSubmitting(false);
        return;
      }

      onPasswordChanged(newPasscode.trim());
      onClose();
    } catch (err: any) {
      // In offline/standalone mode, still apply if key matches
      if (twoStepKey.trim() === TWO_STEP_MASTER_KEY) {
        onPasswordChanged(newPasscode.trim());
        onClose();
      } else {
        setErrorMsg('Incorrect 2-step verification master key.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#050842]/85 p-4 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative my-6 w-full max-w-lg rounded-2xl border-2 border-[#eaff28] bg-gradient-to-b from-[#0a0f52] to-[#040632] p-5 sm:p-7 shadow-[0_0_35px_rgba(234,255,40,0.25)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-[#8e9bd4] transition-colors hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-[#3ce7ff]/20 pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#eaff28]/50 bg-[#eaff28]/20 text-[#eaff28]">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-950/70 border border-emerald-500/50 px-2 py-0.5 text-[9px] font-extrabold uppercase text-emerald-300">
                2-Step Verification Protected
              </span>
            </div>
            <h3 className="font-sports text-2xl text-white">Change Admin Password</h3>
          </div>
        </div>

        <p className="mt-3 text-xs text-[#b9c4f0] leading-relaxed">
          To modify the administrator password, enter the confidential 2-step verification master
          key. Once changed, all future logins will require your new password.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Step 1: 2-Step Master Key (Hidden) */}
          <div className="rounded-xl border border-[#eaff28]/40 bg-[#060a48] p-3.5 space-y-2">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#eaff28]" htmlFor="two-step-key">
                Step 1: 2-Step Master Security Key *
              </label>
            </div>

            <div className="relative">
              <input
                id="two-step-key"
                type={showTwoStep ? 'text' : 'password'}
                required
                autoComplete="off"
                spellCheck={false}
                value={twoStepKey}
                onChange={(e) => {
                  setTwoStepKey(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Enter 2-step security key..."
                className="w-full rounded-xl border border-[#3ce7ff]/60 bg-[#030632] px-3.5 py-2 pr-10 text-xs font-mono text-white placeholder-[#8e9bd4] focus:border-[#eaff28] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowTwoStep(!showTwoStep)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e9bd4] hover:text-white"
                tabIndex={-1}
              >
                {showTwoStep ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Step 2: New Password */}
          <div>
            <label className="block text-xs font-bold text-[#b9c4f0] mb-1" htmlFor="new-admin-pass">
              Step 2: New Administrator Password *
            </label>
            <div className="relative">
              <input
                id="new-admin-pass"
                type={showNewPass ? 'text' : 'password'}
                required
                value={newPasscode}
                onChange={(e) => {
                  setNewPasscode(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Enter new administrator password..."
                className="w-full rounded-xl border border-[#3ce7ff]/60 bg-[#060a48] px-3.5 py-2.5 pr-10 text-xs font-mono font-bold text-white placeholder-[#8e9bd4] focus:border-[#eaff28] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewPass(!showNewPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e9bd4] hover:text-white"
                tabIndex={-1}
              >
                {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Step 3: Confirm New Password */}
          <div>
            <label className="block text-xs font-bold text-[#b9c4f0] mb-1" htmlFor="confirm-admin-pass">
              Step 3: Confirm New Administrator Password *
            </label>
            <input
              id="confirm-admin-pass"
              type={showNewPass ? 'text' : 'password'}
              required
              value={confirmPasscode}
              onChange={(e) => {
                setConfirmPasscode(e.target.value);
                if (errorMsg) setErrorMsg('');
              }}
              placeholder="Confirm new administrator password..."
              className="w-full rounded-xl border border-[#3ce7ff]/60 bg-[#060a48] px-3.5 py-2.5 text-xs font-mono font-bold text-white placeholder-[#8e9bd4] focus:border-[#eaff28] focus:outline-none"
            />
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/50 bg-rose-950/60 p-3 text-xs font-semibold text-rose-300">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 border-t border-[#3ce7ff]/20 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#3ce7ff]/40 bg-[#060a48] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#b9c4f0] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-[#eaff28] px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-[#08104e] transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{isSubmitting ? 'Updating...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
