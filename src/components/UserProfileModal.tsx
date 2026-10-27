import React, { useState, useEffect } from 'react';
import { X, LogIn, LogOut, ShieldCheck, Heart, User, Check, Sparkles, Clock } from 'lucide-react';
import { AppUserProfile, signInWithGoogle, logOut, syncUserProfile } from '../lib/firebase';
import { Player } from '../types/tournament';
import { EFootballLogo } from './EFootballLogo';

interface UserProfileModalProps {
  isOpen: boolean;
  currentUser: AppUserProfile | null;
  players: Player[];
  showCountdown?: boolean;
  onToggleShowCountdown?: (val?: boolean) => void;
  onClose: () => void;
  onUserUpdated: (user: AppUserProfile | null) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  currentUser,
  players,
  showCountdown = true,
  onToggleShowCountdown,
  onClose,
  onUserUpdated,
}) => {
  const [selectedTeam, setSelectedTeam] = useState<string>(currentUser?.favoriteTeam || '');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  const handleSignIn = async () => {
    try {
      setAuthError(null);
      const user = await signInWithGoogle();
      if (user) {
        onUserUpdated({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          favoriteTeam: '',
          lastLoginAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to sign in with Google');
    }
  };

  const handleSignOut = async () => {
    await logOut();
    onUserUpdated(null);
    onClose();
  };

  const handleSaveFavoriteTeam = async () => {
    if (!currentUser) return;
    setSaving(true);
    setSavedSuccess(false);
    try {
      const updated = await syncUserProfile(
        {
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
        } as any,
        { favoriteTeam: selectedTeam }
      );
      if (updated) {
        onUserUpdated(updated);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
      }
    } catch (err: any) {
      setAuthError('Could not save favorite team preference');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#050842]/85 p-4 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative my-8 w-full max-w-md rounded-2xl border-2 border-[#3ce7ff] bg-gradient-to-b from-[#0a0f52] to-[#040632] p-6 shadow-[0_0_35px_rgba(60,231,255,0.25)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-[#8e9bd4] transition-colors hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-[#3ce7ff]/20 pb-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#3ce7ff] bg-[#071056] text-[#3ce7ff] p-1.5">
            <EFootballLogo className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-sports text-xl text-white">eFootball Account</h3>
            <p className="text-xs text-[#8e9bd4]">
              Firebase Authentication & Cloud Firestore Persistence
            </p>
          </div>
        </div>

        {authError && (
          <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-950/40 p-2.5 text-xs text-rose-300">
            {authError}
          </div>
        )}

        {currentUser ? (
          <div className="mt-5 space-y-4">
            {/* User Info card */}
            <div className="flex items-center gap-3 rounded-xl border border-[#3ce7ff]/30 bg-[#060a48] p-3">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="h-12 w-12 rounded-full border-2 border-[#3ce7ff] object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[#071056] text-[#3ce7ff] border-2 border-[#3ce7ff] p-2">
                  <EFootballLogo className="h-7 w-7" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-sports truncate text-base text-white">
                  {currentUser.displayName || 'Tournament Member'}
                </p>
                <p className="truncate text-xs text-[#3ce7ff]">{currentUser.email}</p>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-400">
                  <ShieldCheck className="h-3 w-3" />
                  <span>Authenticated via Google Firebase</span>
                </div>
              </div>
            </div>

            {/* Favorite Team Preference in Firestore */}
            <div className="rounded-xl border border-[#3ce7ff]/20 bg-[#050842] p-3.5">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#eaff28]">
                <Heart className="h-3.5 w-3.5 text-rose-400 fill-rose-400" />
                <span>Cheer for Favorite Team (Saved to Firestore)</span>
              </label>
              <p className="mt-0.5 text-[11px] text-[#8e9bd4]">
                Select your favorite team to personalize your tournament view.
              </p>

              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="mt-2.5 w-full rounded-lg border border-[#3ce7ff]/50 bg-[#060a48] px-3 py-2 text-xs text-white focus:border-[#eaff28] focus:outline-none"
              >
                <option value="">-- Choose your favorite team --</option>
                {players.map((p) => (
                  <option key={p.id} value={p.team}>
                    {p.team} (@{p.user})
                  </option>
                ))}
              </select>

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleSaveFavoriteTeam}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-[#3ce7ff] px-3 py-1.5 text-xs font-bold text-[#050842] transition-transform hover:scale-105"
                >
                  {savedSuccess ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-800" />
                      <span>Saved to Cloud!</span>
                    </>
                  ) : (
                    <span>Save Preference</span>
                  )}
                </button>

                {savedSuccess && (
                  <span className="text-[10px] font-bold text-emerald-400">
                    Synced with Firestore!
                  </span>
                )}
              </div>
            </div>

            {/* Matchday Countdown Timer Option (User / Authenticator Preferences) */}
            <div className="rounded-xl border border-[#3ce7ff]/20 bg-[#050842] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg border border-[#3ce7ff]/40 bg-[#071056] text-[#eaff28]">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-[#eaff28]">
                      Hero Matchday Countdown Timer
                    </span>
                    <span className="block text-[11px] text-[#8e9bd4]">
                      Shows live time remaining until next scheduled matchday (optional)
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleShowCountdown && onToggleShowCountdown(!showCountdown)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                    showCountdown
                      ? 'bg-emerald-500 text-[#050842] shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      : 'border border-gray-600 bg-gray-800 text-gray-400'
                  }`}
                >
                  {showCountdown ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            {/* Sign out and switch account */}
            <div className="border-t border-[#3ce7ff]/20 pt-4 flex flex-wrap gap-2 justify-between items-center">
              <span className="text-[11px] text-[#8e9bd4]">UID: {currentUser.uid.slice(0, 8)}...</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await handleSignOut();
                    setTimeout(() => handleSignIn(), 150);
                  }}
                  className="rounded-lg border border-[#3ce7ff]/40 bg-[#071056] px-2.5 py-1.5 text-xs font-semibold text-[#3ce7ff] transition-colors hover:border-[#3ce7ff] hover:text-white"
                  title="Sign in with a different Google account"
                >
                  Switch Account
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-500/50 bg-rose-950/30 px-3 py-1.5 text-xs font-bold text-rose-300 transition-colors hover:bg-rose-900/50"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-[#3ce7ff]/40 bg-[#071056] text-[#3ce7ff] shadow-[0_0_20px_rgba(60,231,255,0.25)]">
              <LogIn className="h-8 w-8 text-[#eaff28]" />
            </div>
            <h4 className="font-sports mt-4 text-lg text-white">Join with Google Account</h4>
            <p className="mt-1 text-xs text-[#b9c4f0]">
              Sign in with your Google account to save your favorite team, cheer for tournament players, and keep your data persisted in Google Cloud Firestore.
            </p>

            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                onClick={handleSignIn}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#3ce7ff] bg-white py-2.5 text-xs font-bold text-gray-900 shadow-lg transition-transform hover:scale-[1.02]"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <button
                type="button"
                onClick={handleSignIn}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#3ce7ff]/40 bg-[#071056] py-2 text-xs font-semibold text-[#3ce7ff] transition-colors hover:border-[#3ce7ff] hover:text-white"
                title="Choose which Google account you want to sign in with"
              >
                <span>Choose or Switch Another Google Account</span>
              </button>
            </div>

            {/* Matchday Countdown Timer Option (Guest Preferences) */}
            <div className="mt-5 rounded-xl border border-[#3ce7ff]/20 bg-[#050842] p-3 text-left">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#eaff28] shrink-0" />
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-[#eaff28]">
                      Hero Countdown Timer
                    </span>
                    <span className="block text-[10px] text-[#8e9bd4]">
                      Countdown until next scheduled matchday
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleShowCountdown && onToggleShowCountdown(!showCountdown)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition-all shrink-0 ${
                    showCountdown
                      ? 'bg-emerald-500 text-[#050842] shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                      : 'border border-gray-600 bg-gray-800 text-gray-400'
                  }`}
                >
                  {showCountdown ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
