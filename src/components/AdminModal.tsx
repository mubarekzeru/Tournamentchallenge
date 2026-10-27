import React, { useState, useEffect } from 'react';
import { Lock, X, Eye, EyeOff, KeyRound } from 'lucide-react';
import { ADMIN_PASSCODE } from '../data/tournamentData';

interface AdminModalProps {
  isOpen: boolean;
  activePasscode?: string;
  onClose: () => void;
  onSuccess: () => void;
  onOpenChangePassword?: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  activePasscode,
  onClose,
  onSuccess,
  onOpenChangePassword,
}) => {
  const [passcode, setPasscode] = useState('');
  const passToMatch = activePasscode || ADMIN_PASSCODE;
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim() === passToMatch) {
      setErrorMsg('');
      setPasscode('');
      onSuccess();
    } else {
      setErrorMsg('Incorrect passcode.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#050842]/85 p-4 backdrop-blur-md"
    >
      <div className="relative w-full max-w-sm rounded-2xl border-2 border-[#3ce7ff] bg-gradient-to-b from-[#0a0f52] to-[#040632] p-6 text-center shadow-[0_0_35px_rgba(60,231,255,0.25)] select-text">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-[#8e9bd4] transition-colors hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto mb-3.5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#3ce7ff]/50 bg-[#3ce7ff]/20 text-[#3ce7ff] shadow-[0_0_15px_rgba(60,231,255,0.3)]">
          <Lock className="h-6 w-6" />
        </div>

        <h3 className="font-sports text-2xl text-white">Owner Access Desk</h3>
        <p className="mt-1 text-xs text-[#b9c4f0]">
          Enter your passcode to unlock match scoring & league management controls.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          <div className="space-y-2.5">
            <div className="relative">
              <input
                id="admin-passcode-input"
                name="admin-passcode"
                type={showPassword ? 'text' : 'password'}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Enter passcode..."
                className="w-full rounded-xl border border-[#3ce7ff]/70 bg-[#030632] px-4 py-2.5 pr-10 text-center text-sm font-mono tracking-wider text-white placeholder-[#8e9bd4] focus:border-[#eaff28] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8e9bd4] hover:text-white p-1"
                title={showPassword ? 'Mask password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs font-semibold text-rose-400">{errorMsg}</p>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[#3ce7ff]/40 bg-[#060a48] py-2 text-xs font-bold uppercase tracking-wider text-[#b9c4f0] transition-colors hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-[#eaff28] py-2 text-xs font-extrabold uppercase tracking-wider text-[#08104e] transition-transform hover:scale-105 active:scale-95"
            >
              Unlock Desk
            </button>
          </div>

          {onOpenChangePassword && (
            <div className="pt-2 text-center border-t border-[#3ce7ff]/15">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenChangePassword();
                }}
                className="text-[11px] font-bold text-[#3ce7ff] hover:text-[#eaff28] transition-colors inline-flex items-center gap-1"
              >
                <KeyRound className="h-3 w-3" />
                <span>Change Admin Password (2-Step Verification)</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
