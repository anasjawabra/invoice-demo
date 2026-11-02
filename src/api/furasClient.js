// Client of the LOCAL Furas dataset endpoints (server/furasData.js). Every figure shown in Furas mode comes through here.
import { post } from './client';
export const furas = {
  summary: () => post('/furas/summary', {}),
  contracts: (body) => post('/furas/contracts', body),
  contract: (no) => post('/furas/contract', { no }),
  decisions: () => post('/furas/decisions', {})
};
