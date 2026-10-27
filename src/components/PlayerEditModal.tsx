import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  UserPlus,
  Check,
  Trash2,
  ShieldCheck,
  Sparkles,
  Camera,
  RefreshCw,
  Phone,
  Send,
} from 'lucide-react';
import { Player } from '../types/tournament';
import { AVATAR_PRESETS } from '../data/tournamentData';
import { processDeviceImage } from '../utils/imageCompressor';

interface PlayerEditModalProps {
  isOpen: boolean;
  playerToEdit: Player | null; // null means registering a new player
  isRegistrationOpen: boolean; // results.length === 0
  onClose: () => void;
  onSavePlayer: (playerData: {
    id?: string;
    user: string;
    team: string;
    avatarUrl: string;
    phoneNumber?: string;
    telegramUsername?: string;
    clearOldMemberData?: boolean;
  }) => void;
  onDeletePlayer?: (playerId: string) => void;
}

export const PlayerEditModal: React.FC<PlayerEditModalProps> = ({
  isOpen,
  playerToEdit,
  isRegistrationOpen,
  onClose,
  onSavePlayer,
  onDeletePlayer,
}) => {
  const [team, setTeam] = useState('');
  const [user, setUser] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [clearOldMemberData, setClearOldMemberData] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isDevicePhoto, setIsDevicePhoto] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prevent background layer web scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (playerToEdit) {
      setTeam(playerToEdit.team);
      setUser(playerToEdit.user);
      setPhoneNumber(playerToEdit.phoneNumber || '');
      setTelegramUsername(playerToEdit.telegramUsername || '');
      setAvatarUrl(playerToEdit.avatarUrl || '');
      setIsDevicePhoto(playerToEdit.avatarUrl?.startsWith('data:') || false);
      setClearOldMemberData(true);
    } else {
      setTeam('');
      setUser('');
      setPhoneNumber('');
      setTelegramUsername('');
      const randomPreset = AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)];
      setAvatarUrl(randomPreset.url);
      setIsDevicePhoto(false);
      setClearOldMemberData(false);
    }
    setErrorMsg('');
  }, [playerToEdit, isOpen]);

  if (!isOpen) return null;

  const isEditing = !!playerToEdit;

  const handleDeviceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setErrorMsg('');
      const compressedDataUrl = await processDeviceImage(file, 300);
      setAvatarUrl(compressedDataUrl);
      setIsDevicePhoto(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not process the selected image.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSelectPreset = (url: string) => {
    setAvatarUrl(url);
    setIsDevicePhoto(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTeam = team.trim();
    const cleanUser = user.trim();

    if (!cleanTeam) {
      setErrorMsg('Team Name is required.');
      return;
    }

    if (!cleanUser) {
      setErrorMsg('Username is required.');
      return;
    }

    onSavePlayer({
      id: playerToEdit?.id,
      team: cleanTeam,
      user: cleanUser,
      phoneNumber: phoneNumber.trim(),
      telegramUsername: telegramUsername.trim().replace(/^@/, ''),
      avatarUrl: avatarUrl.trim() || AVATAR_PRESETS[0].url,
      clearOldMemberData: isEditing ? clearOldMemberData : false,
    });

    onClose();
  };

  const handleDelete = () => {
    if (!playerToEdit || !onDeletePlayer) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDeletePlayer(playerToEdit.id);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#050842]/85 p-4 backdrop-blur-md overflow-y-auto"
    >
      <div className="relative my-6 w-full max-w-lg rounded-2xl border-2 border-[#3ce7ff] bg-gradient-to-b from-[#0a0f52] to-[#040632] p-5 sm:p-6 shadow-[0_0_35px_rgba(60,231,255,0.25)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-[#8e9bd4] transition-colors hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-[#3ce7ff]/20 pb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#3ce7ff]/50 bg-[#3ce7ff]/20 text-[#3ce7ff]">
            {isEditing ? <ShieldCheck className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />}
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#eaff28]">
              Owner Administration
            </p>
            {isEditing ? (
              <div>
                <h3 className="font-sports text-2xl text-white">
                  {playerToEdit.team}
                </h3>
                <p className="text-[11px] font-mono text-[#3ce7ff]">
                  Username: @{playerToEdit.user}
                </p>
              </div>
            ) : (
              <h3 className="font-sports text-2xl text-white">Register New Team & Player</h3>
            )}
          </div>
        </div>

        {/* Registration Notice */}
        {!isRegistrationOpen && !isEditing && (
          <div className="mt-4 rounded-xl border border-rose-500/50 bg-rose-950/60 p-3 text-xs text-rose-300">
            <strong>Registration Locked:</strong> Matches have already begun. To register new teams/players, reset completed match results first.
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Avatar Preview & Device Upload Control */}
          <div className="rounded-xl border border-[#3ce7ff]/30 bg-[#060a48] p-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Avatar Live Preview */}
              <div className="relative shrink-0">
                <img
                  src={avatarUrl || AVATAR_PRESETS[0].url}
                  alt="Avatar preview"
                  className="h-20 w-20 rounded-full border-2 border-[#eaff28] object-cover shadow-[0_0_15px_rgba(234,255,40,0.35)]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = AVATAR_PRESETS[0].url;
                  }}
                />
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
                    <RefreshCw className="h-5 w-5 animate-spin text-[#eaff28]" />
                  </div>
                )}
                {isDevicePhoto && (
                  <span
                    className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[#050842] shadow"
                    title="Photo selected from device"
                  >
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                )}
              </div>

              {/* Upload from Device button */}
              <div className="flex-1 w-full text-center sm:text-left">
                <label className="block text-xs font-bold text-[#b9c4f0] mb-1.5">
                  Profile Picture
                </label>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#3ce7ff] px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-[#08104e] transition-transform hover:scale-105 hover:bg-[#eaff28] active:scale-95 shadow-md">
                    <Camera className="h-4 w-4" />
                    <span>Choose From Device</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleDeviceUpload}
                      className="hidden"
                    />
                  </label>

                  {isDevicePhoto && (
                    <span className="rounded-full bg-emerald-950/70 border border-emerald-500/50 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
                      Device Photo Ready
                    </span>
                  )}
                </div>

                <p className="mt-1.5 text-[11px] text-[#8e9bd4]">
                  Select photo from your phone or PC. Automatically visible to all viewers.
                </p>
              </div>
            </div>

            {/* Optional URL input */}
            <div className="mt-3 pt-3 border-t border-[#3ce7ff]/15">
              <label className="block text-[11px] font-semibold text-[#8e9bd4] mb-1" htmlFor="player-avatar-url">
                Or paste custom Image URL
              </label>
              <input
                id="player-avatar-url"
                type="url"
                value={avatarUrl.startsWith('data:') ? '' : avatarUrl}
                onChange={(e) => {
                  setAvatarUrl(e.target.value);
                  setIsDevicePhoto(false);
                }}
                placeholder={avatarUrl.startsWith('data:') ? '[Device Photo Loaded]' : 'https://...'}
                className="w-full rounded-lg border border-[#3ce7ff]/40 bg-[#030632] px-3 py-1.5 text-xs text-white placeholder-[#8e9bd4] focus:border-[#eaff28] focus:outline-none"
              />
            </div>
          </div>

          {/* Avatar Preset Picker */}
          <div>
            <label className="block text-xs font-bold text-[#b9c4f0] mb-1.5 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#eaff28]" />
              <span>Or Choose from Esports Presets</span>
            </label>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_PRESETS.map((preset) => {
                const isSelected = avatarUrl === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.url)}
                    className={`group relative overflow-hidden rounded-xl border transition-all ${
                      isSelected
                        ? 'border-[#eaff28] ring-2 ring-[#eaff28] scale-105'
                        : 'border-[#3ce7ff]/30 opacity-70 hover:opacity-100 hover:border-[#3ce7ff]'
                    }`}
                    title={preset.label}
                  >
                    <img
                      src={preset.url}
                      alt={preset.label}
                      className="h-10 w-full object-cover"
                    />
                    {isSelected && (
                      <span className="absolute inset-0 bg-[#eaff28]/25 flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-[#050842] stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Team Name (BIG) & Username (SMALL) */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-extrabold text-[#eaff28] mb-1" htmlFor="player-team">
                Team Name * (Displayed in BIG text)
              </label>
              <input
                id="player-team"
                type="text"
                required
                value={team}
                onChange={(e) => {
                  setTeam(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="e.g. Real Madrid, Arsenal, Bilal FC"
                className="w-full rounded-xl border-2 border-[#eaff28]/70 bg-[#060a48] px-3.5 py-2.5 text-base font-bold text-white placeholder-[#8e9bd4] focus:border-[#3ce7ff] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#b9c4f0] mb-1" htmlFor="player-user">
                Username * (Displayed in small tiny text)
              </label>
              <input
                id="player-user"
                type="text"
                required
                value={user}
                onChange={(e) => {
                  setUser(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="e.g. A-Bilal, mubyzeru, yonas1934"
                className="w-full rounded-xl border border-[#3ce7ff]/60 bg-[#060a48] px-3.5 py-2 text-xs font-mono text-white placeholder-[#8e9bd4] focus:border-[#eaff28] focus:outline-none"
              />
            </div>

            {/* Telegram Username & Phone Number Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-[#3ce7ff] mb-1 flex items-center gap-1.5" htmlFor="player-telegram">
                  <Send className="h-3.5 w-3.5 text-[#3ce7ff]" />
                  <span>Telegram Username</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#3ce7ff]">
                    @
                  </span>
                  <input
                    id="player-telegram"
                    type="text"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                    placeholder="username"
                    className="w-full rounded-xl border border-[#3ce7ff]/40 bg-[#060a48] pl-7 pr-3 py-2 text-xs font-mono text-white placeholder-[#8e9bd4] focus:border-[#eaff28] focus:outline-none"
                  />
                </div>
                <span className="block text-[9.5px] text-[#8e9bd4] mt-0.5 font-mono">For match coordination & announcements</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#eaff28] mb-1 flex items-center gap-1.5" htmlFor="player-phone">
                  <Phone className="h-3.5 w-3.5 text-[#eaff28]" />
                  <span>Phone Number</span>
                </label>
                <input
                  id="player-phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+251 9... or 09..."
                  className="w-full rounded-xl border border-[#3ce7ff]/40 bg-[#060a48] px-3.5 py-2 text-xs font-mono text-white placeholder-[#8e9bd4] focus:border-[#eaff28] focus:outline-none"
                />
                <span className="block text-[9.5px] text-[#8e9bd4] mt-0.5 font-mono">Official player contact hotline</span>
              </div>
            </div>
          </div>

          {/* Purge Old Member Data Option */}
          {isEditing && (
            <div className="rounded-xl border border-[#3ce7ff]/40 bg-[#071158]/80 p-3 text-left">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearOldMemberData}
                  onChange={(e) => setClearOldMemberData(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-[#3ce7ff] text-[#eaff28] focus:ring-0 cursor-pointer"
                />
                <div>
                  <span className="block text-xs font-bold text-[#eaff28]">
                    Purge previous member's old data from Firebase
                  </span>
                  <span className="block text-[10px] text-[#b9c4f0] leading-snug mt-0.5">
                    Removes old member's recorded scores, previous avatar data, and resets match stats to 0 to free up space on Firebase Firestore.
                  </span>
                </div>
              </label>
            </div>
          )}

          {errorMsg && (
            <p className="text-xs font-semibold text-rose-400">{errorMsg}</p>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#3ce7ff]/20 pt-4">
            {isEditing && isRegistrationOpen && onDeletePlayer ? (
              <button
                type="button"
                onClick={handleDelete}
                className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                  confirmDelete
                    ? 'border-rose-500 bg-rose-600 text-white animate-pulse'
                    : 'border-rose-500/40 bg-rose-950/40 text-rose-300 hover:border-rose-400 hover:text-white'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{confirmDelete ? 'Confirm Delete?' : 'Remove Team'}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#3ce7ff]/40 bg-[#060a48] px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#b9c4f0] hover:text-white"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!isEditing && !isRegistrationOpen}
                className="rounded-xl bg-[#eaff28] px-5 py-2 text-xs font-extrabold uppercase tracking-wider text-[#08104e] transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isEditing ? 'Save Changes' : 'Register Team & Player'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
