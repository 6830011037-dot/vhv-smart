import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (title: string, description?: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((title: string, description?: string, type: ToastType = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newToast: ToastMessage = { id, title, description, type };
    
    setToasts(prev => [...prev, newToast]);

    // Auto remove after 3.5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Render Overlay */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map(toast => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start justify-between gap-3 p-4 rounded-2xl border shadow-float transition-all duration-300 animate-in slide-in-from-top-3 ${
                isSuccess
                  ? 'bg-[#FEFEFA] border-[#5D7052]/40 text-[#2C2C24]'
                  : isError
                  ? 'bg-[#FEFEFA] border-[#A85448]/40 text-[#2C2C24]'
                  : 'bg-[#FEFEFA] border-[#DED8CF] text-[#2C2C24]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    isSuccess
                      ? 'bg-[#5D7052] text-white'
                      : isError
                      ? 'bg-[#A85448] text-white'
                      : 'bg-[#78786C] text-white'
                  }`}
                >
                  {isSuccess && <CheckCircle2 className="w-4 h-4" />}
                  {isError && <AlertCircle className="w-4 h-4" />}
                  {!isSuccess && !isError && <Info className="w-4 h-4" />}
                </div>

                <div>
                  <h5 className="font-semibold text-xs sm:text-sm text-[#2C2C24] leading-snug">
                    {toast.title}
                  </h5>
                  {toast.description && (
                    <p className="text-[11px] sm:text-xs text-[#78786C] mt-0.5 leading-relaxed">
                      {toast.description}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-[#78786C] hover:text-[#2C2C24] p-1 rounded-lg hover:bg-[#F0EBE5] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
