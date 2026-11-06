import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { RequireRoute, LandingRedirect, SettingsLanding, NotAuthorisedPage } from './components/access/AccessGuards';
import Login from './pages/Login';
import Layout from './components/Layout';
import InsightsHub from './pages/InsightsHub';
import SmartReportsPage from './pages/SmartReportsPage';
import DecisionRoom from './pages/DecisionRoom';
import Plans from './pages/Plans';
import PlanDetail from './pages/PlanDetail';
import Metrics from './pages/Metrics';
import MetricDetail from './pages/MetricDetail';
import Invoices from './pages/Invoices';
import Collection from './pages/Collection';
import Exclusions from './pages/Exclusions';
import Products from './pages/Products';
import ProductPage from './pages/ProductPage';
import EnforcementHome from './pages/EnforcementHome';
import EefaaViolationPage from './pages/EefaaViolationPage';
import EnforcementOrderPage from './pages/EnforcementOrderPage';
import InvoicePage from './pages/InvoicePage';
import AnalysisResultPage from './pages/AnalysisResultPage';
import NotFound from './pages/NotFound';
import FurasContracts from './pages/furas/FurasContracts';
import FurasContract from './pages/furas/FurasContract';
import FurasProduct from './pages/furas/FurasProduct';
import UserManagement from './pages/admin/UserManagement';
import RolesPermissions from './pages/admin/RolesPermissions';

// Investment contracts read the local Databank exports (server/furasData.js); the product page of Furas is built on them, every other product on the generated invoices
function ProductRoute() { const { key } = useParams(); return key === 'foras' ? <FurasProduct /> : <ProductPage />; }

function ProtectedRoute({ children }) {
  const { user, checking } = useAuth();
  if (checking) return <div role="status" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>…</div>; // the stored session is being re-validated with the data service
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// A page route: `pattern` is the key of ROUTE_PERMISSIONS (src/data/accessModel.js) — the module(s) that open the page. A route without an entry stays closed.
// (Redirect routes are plain <Navigate>s: the guard of their destination applies.)
const page = (pattern, element) => <Route key={pattern} path={pattern} element={<RequireRoute pattern={pattern}>{element}</RequireRoute>} />;

function Redirect({ make }) { const p = useParams(); return <Navigate to={make(p)} replace />; }

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<LandingRedirect />} />
        {page('insights', <InsightsHub />)}
        {page('planning', <Plans />)}
        {page('planning/:planId', <PlanDetail />)}
        <Route path="executive" element={<Navigate to="/insights?view=dashboard" replace />} />
        <Route path="dashboard" element={<Navigate to="/insights?view=dashboard" replace />} />
        <Route path="reports" element={<Navigate to="/insights" replace />} />
        {page('smart-reports', <SmartReportsPage />)}
        {page('decisions', <DecisionRoom />)}
        <Route path="assistant" element={<Navigate to="/smart-reports" replace />} />
        <Route path="strategic" element={<Navigate to="/planning" replace />} />
        <Route path="decision-room" element={<Navigate to="/planning" replace />} />
        <Route path="what-if" element={<Navigate to="/planning" replace />} />
        <Route path="noncollection" element={<Navigate to="/collection" replace />} />
        <Route path="settings" element={<SettingsLanding />} />
        <Route path="settings/data-sources" element={<Navigate to="/settings/metrics" replace />} />
        <Route path="settings/data-quality" element={<Navigate to="/settings/metrics" replace />} />
        {page('settings/metrics', <Metrics />)}
        {page('settings/metrics/:id', <MetricDetail />)}
        {page('settings/users', <UserManagement />)}
        {page('settings/roles', <RolesPermissions />)}
        <Route path="data-sources" element={<Navigate to="/settings/metrics" replace />} />
        {page('contracts', <FurasContracts />)}
        <Route path="metrics" element={<Navigate to="/settings/metrics" replace />} />
        {page('invoices', <Invoices />)}
        <Route path="risk" element={<Navigate to="/insights" replace />} />
        {page('collection', <Collection />)}
        {page('exclusions', <Exclusions />)}
        {page('products', <Products />)}
        {page('products/:key', <ProductRoute />)}
        {page('invoices/:id', <InvoicePage />)}
        {page('contracts/:no', <FurasContract />)}
        {page('enforcement', <EnforcementHome />)}
        <Route path="enforcement-orders" element={<Navigate to="/enforcement?view=orders" replace />} />
        {page('enforcement/violations/:key', <EefaaViolationPage />)}
        {page('enforcement-orders/:enforceNum', <EnforcementOrderPage />)}
        {page('analysis/:taskId', <AnalysisResultPage />)}
        {/* superseded addresses keep working: they land on the single full-page experience */}
        <Route path="sanad-orders" element={<Navigate to="/enforcement?view=orders" replace />} />
        <Route path="sanad-orders/:enforceNum" element={<Redirect make={(p) => `/enforcement-orders/${encodeURIComponent(p.enforceNum)}`} />} />
        <Route path="investment-invoices" element={<Navigate to="/invoices" replace />} />
        <Route path="investment-invoices/:id" element={<Redirect make={(p) => `/invoices/${encodeURIComponent(p.id)}`} />} />
        <Route path="not-authorised" element={<NotAuthorisedPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
