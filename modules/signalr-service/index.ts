// Reexport the native module. On web, it will be resolved to SignalrServiceModule.web.ts
// and on native platforms to SignalrServiceModule.ts
export { default } from './src/SignalrServiceModule';
export * from  './src/SignalrService.types';
