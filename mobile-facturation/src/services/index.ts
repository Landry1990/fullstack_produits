/**
 * Barrel export — Services
 */
export { default as api, setBaseURL, getBaseURL, loadBaseURL, saveBaseURL, setUnauthorizedCallback, classifyNetworkError } from './api';
export * as authService from './auth';
export * as productSyncService from './productSync';
export * as invoiceSyncService from './invoiceSync';
export * as cashierSyncService from './cashierSync';
export { lotService } from './lotService';
export { websocketService } from './websocket';
export { getWebSocketService, resetWebSocketService, PDAWebSocketService } from './websocketPDA';
export type { WebSocketEvents, ConnectionStatus } from './websocketPDA';
