/// <reference types="vite/client" />

declare module 'react-katex' {
  import type { ComponentType } from 'react';

  export const InlineMath: ComponentType<{ math: string }>;
  export const BlockMath: ComponentType<{ math: string }>;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
