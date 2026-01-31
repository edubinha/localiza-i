/**
 * Development-only logging utility.
 * Logs are only shown in development mode to prevent information leakage in production.
 */

const isDev = import.meta.env.DEV;

export const devLog = {
  error: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.error(message, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.warn(message, ...args);
    }
  },
  log: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.log(message, ...args);
    }
  },
};
