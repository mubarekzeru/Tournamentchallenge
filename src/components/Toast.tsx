import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  text: string;
  type?: 'success' | 'error' | 'info';
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isSuccess = toast.type === 'success' || !toast.type;

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-bold shadow-2xl backdrop-blur-md transition-all animate-bounce-in ${
              isError
                ? 'border-rose-500/60 bg-rose-950/90 text-rose-200'
                : isSuccess
                ? 'border-[#3ce7ff] bg-[#070c50]/95 text-white'
                : 'border-[#eaff28]/60 bg-[#060a48]/95 text-[#eaff28]'
            }`}
          >
            <div className="flex items-center gap-2">
              {isError ? (
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              ) : isSuccess ? (
                <CheckCircle2 className="h-4 w-4 text-[#eaff28] shrink-0" />
              ) : (
                <Info className="h-4 w-4 text-[#3ce7ff] shrink-0" />
              )}
              <span>{toast.text}</span>
            </div>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-[#8e9bd4] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
