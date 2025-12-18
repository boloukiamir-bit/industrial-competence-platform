'use client';

import { useEffect } from 'react';
import { logDebugError } from '@/lib/debugStore';

export function GlobalErrorHandler() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      logDebugError({
        type: 'client',
        message: event.message || 'Unknown error',
        stack: event.error?.stack,
      });
    }
    
    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      let message = 'Unhandled promise rejection';
      let stack: string | undefined;
      
      if (reason instanceof Error) {
        message = reason.message;
        stack = reason.stack;
      } else if (typeof reason === 'string') {
        message = reason;
      }
      
      logDebugError({
        type: 'client',
        message,
        stack,
      });
    }
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);
  
  return null;
}
