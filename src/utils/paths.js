// The addresses of the three record pages. Every entry point (dashboards, lists, search results, recommendations, related-record links) builds its link here.
export const invoicePath = (id) => `/invoices/${encodeURIComponent(id)}`;
export const orderPath = (enforceNum) => `/enforcement-orders/${encodeURIComponent(enforceNum)}`;
export const contractPath = (no) => `/contracts/${encodeURIComponent(no)}`;
export const enforcementPath = '/enforcement';
export const ordersListPath = '/enforcement?view=orders';
export const analysisPath = (taskId) => `/analysis/${encodeURIComponent(taskId)}`;
