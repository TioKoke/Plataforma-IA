/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type AlertType = 'success' | 'error' | 'info';

interface AlertState {
  isOpen: boolean;
  message: string;
  type: AlertType;
  title?: string;
}

interface AlertContextProps {
  showAlert: (message: string, type?: AlertType, title?: string) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextProps | undefined>(undefined);

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

export const AlertProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [alert, setAlert] = useState<AlertState>({
    isOpen: false,
    message: '',
    type: 'info',
  });

  const showAlert = (message: string, type: AlertType = 'info', title?: string) => {
    setAlert({ isOpen: true, message, type, title });
  };

  const hideAlert = () => {
    setAlert((prev) => ({ ...prev, isOpen: false }));
  };

  const getIcon = () => {
    switch (alert.type) {
      case 'error': return <AlertCircle className="w-6 h-6 text-red-500" />;
      case 'success': return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
      case 'info':
      default: return <Info className="w-6 h-6 text-blue-500" />;
    }
  };

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <AnimatePresence>
        {alert.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800/80"
            >
              <div className="flex items-start p-6">
                <div className="shrink-0">{getIcon()}</div>
                <div className="ml-4 w-full">
                  <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    {alert.title || (alert.type === 'error' ? 'Error' : alert.type === 'success' ? 'Éxito' : 'Información')}
                  </h3>
                  <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    <p>{alert.message}</p>
                  </div>
                </div>
                <button
                  title="Cerrar ventana"
                  onClick={hideAlert}
                  className="ml-4 shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 rounded-full p-1.5 transition-colors"
                >
                  <span className="sr-only">Cerrar</span>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="bg-slate-50/80 dark:bg-slate-800/50 px-6 py-4 flex justify-end">
                <button
                  type="button"
                  className="inline-flex justify-center rounded-lg border border-transparent bg-orange-600 px-5 py-2 text-sm font-medium text-white hover:bg-orange-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 transition-all shadow-sm"
                  onClick={hideAlert}
                >
                  Aceptar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AlertContext.Provider>
  );
};
