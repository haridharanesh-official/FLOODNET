/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any;
    initFloodnetGoogleMap?: () => void;
  }
}

export {};
