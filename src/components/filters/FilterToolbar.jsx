// FilterToolbar — the layout shell shared by every page (presentational; FilterBar / ScopeFilters / LocalFilterToolbar fill it).
//   <FilterToolbar lang primary={nodes} search={node} more={node} info={node} actions={node} onClear showClear chips={node} resultCount={node}
//                  mobile activeCount drawerOpen onDrawerOpen onDrawerClose drawerBody drawerFooter />
// Desktop: [primary controls · search · «المزيد من الفلاتر» · «مسح الفلاتر» (only when something is non-default)] … [info · actions], then the chips row, then the result count.
// Mobile (≤ 720px): the primary row collapses into ONE «تصفية / Filter» button with the active-filter count that opens a bottom drawer holding every control + Apply / Clear.
import React from 'react';
import { Drawer } from './overlay';

const Funnel = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4-2v-4z" /></svg>;

export default function FilterToolbar({ lang = 'ar', label, primary, search, more, info, actions, onClear, showClear, chips, resultCount, mobile, activeCount = 0, drawerOpen, onDrawerOpen, onDrawerClose, drawerBody, drawerFooter, footer, children }) {
  const ar = lang === 'ar'; const name = label || (ar ? 'التصفية' : 'Filters');
  return (
    <section className={`ft-bar${mobile ? ' is-mobile' : ''}`} role="region" aria-label={ar ? 'عناصر التصفية' : 'Filters'}>
      <div className="ft-row">
        {mobile ? (
          <>
            {search && <div className="ft-search-slot">{search}</div>}
            <button type="button" className={`btn btn-sm ft-open${activeCount ? ' is-active' : ''}`} aria-haspopup="dialog" aria-expanded={!!drawerOpen} onClick={onDrawerOpen}>
              <Funnel />{ar ? 'تصفية' : 'Filter'}{activeCount > 0 && <span className="ft-badge" aria-label={ar ? `${activeCount} فلتر مطبّق` : `${activeCount} applied`}>{activeCount}</span>}
            </button>
            {info}{actions && <div className="ft-actions">{actions}</div>}
          </>
        ) : (
          <>
            <div className="ft-primary">{primary}</div>
            {search && <div className="ft-search-slot">{search}</div>}
            <div className="ft-tools">
              {more}
              {showClear && <button type="button" className="btn btn-sm btn-ghost ft-clear" onClick={onClear}>{ar ? 'مسح الفلاتر' : 'Clear filters'}</button>}
            </div>
            <div className="ft-end">{info}{actions && <div className="ft-actions">{actions}</div>}</div>
          </>
        )}
      </div>
      {chips}
      {resultCount && <div className="ft-count" role="status" aria-live="polite">{resultCount}</div>}
      {footer}
      {children}
      {mobile && (
        <Drawer open={!!drawerOpen} onClose={onDrawerClose} title={name} closeLabel={ar ? 'إغلاق' : 'Close'} footer={drawerFooter}>{drawerBody}</Drawer>
      )}
    </section>
  );
}
