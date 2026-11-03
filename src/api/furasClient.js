// Client of the LOCAL Furas dataset endpoints (server/furasData.js). Every figure shown in Furas mode comes through here.
import { post } from './client';
// the data service answers 404 «furas_unavailable» when the local exports are not configured (always so on a deployment)
export const furasUnavailable = (e) => !!e && e.status === 404 && e.body?.error === 'furas_unavailable';
export const furas = {
  summary: () => post('/furas/summary', {}),
  contracts: (body) => post('/furas/contracts', body),
  contract: (no) => post('/furas/contract', { no }),
  decisions: () => post('/furas/decisions', {})
};
