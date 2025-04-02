/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SLEEPER_API_URL: string;
  readonly VITE_COLLEGE_FOOTBALL_API_KEY: string;
  readonly VITE_COLLEGE_FOOTBALL_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 