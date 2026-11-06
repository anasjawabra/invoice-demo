// The «invoice status / due position» of the shared scope belongs to the Uncollected list (it is its «موقف الاستحقاق» control). A page whose list has its own
// state (Collected invoices, Exclusions) ignores that field in its request, so a value left over from the Uncollected list is reset to «all» when the page opens
// instead of leaving a chip that claims to narrow figures it does not narrow.
import { useEffect } from 'react';

export default function useClearStatusOnEnter(rev) {
  useEffect(() => { if (rev.scope.status && rev.scope.status !== 'all') rev.setStatus('all'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
