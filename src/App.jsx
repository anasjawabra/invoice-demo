import React from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Noncollection from './pages/Noncollection';
import DataSources from './pages/DataSources';
import InsightsHub from './pages/InsightsHub';
import PlanningArea from './pages/PlanningArea';
import Contracts from './pages/Contracts';
import Metrics from './pages/Metrics';
import Invoices from './pages/Invoices';
import Risk from './pages/Risk';
import Collection from './pages/Collection';
import EnforcementHome from './pages/EnforcementHome';
import EnforcementOrderPage from './pages/EnforcementOrderPage';
import InvoicePage from './pages/InvoicePage';
import ContractPage from './pages/ContractPage';
import AnalysisResultPage from './pages/AnalysisResultPage';
import NotFound from './pages/NotFound';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// old links keep their query (?q=, ?r=, ?view=) when they land on the new management area
function LegacyRedirect({ to, fallbackView }) {
  const loc = useLocation(); const sp = new URLSearchParams(loc.search); if (!sp.get('view') && !sp.get('r')) sp.set('view', fallbackView);
  return <Navigate to={`${to}?${sp.toString()}`} replace />;
}

function Redirect({ make }) { const p = useParams(); return <Navigate to={make(p)} replace />; }

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/insights" replace />} />
        <Route path="insights" element={<InsightsHub />} />
        <Route path="planning" element={<PlanningArea />} />
        <Route path="executive" element={<Navigate to="/insights?view=dashboard" replace />} />
        <Route path="dashboard" element={<Navigate to="/insights?view=dashboard" replace />} />
        <Route path="reports" element={<LegacyRedirect to="/insights" fallbackView="reports" />} />
        <Route path="smart-reports" element={<LegacyRedirect to="/insights" fallbackView="smart" />} />
        <Route path="assistant" element={<LegacyRedirect to="/insights" fallbackView="smart" />} />
        <Route path="strategic" element={<Navigate to="/planning" replace />} />
        <Route path="decision-room" element={<Navigate to="/planning" replace />} />
        <Route path="what-if" element={<Navigate to="/planning" replace />} />
        <Route path="noncollection" element={<Noncollection />} />
        <Route path="data-sources" element={<DataSources />} />
        <Route path="contracts" element={<Contracts />} />
        <Route path="metrics" element={<Metrics />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="risk" element={<Risk />} />
        <Route path="collection" element={<Collection />} />
        <Route path="invoices/:id" element={<InvoicePage />} />
        <Route path="contracts/:no" element={<ContractPage />} />
        <Route path="enforcement" element={<EnforcementHome />} />
        <Route path="enforcement-orders" element={<Navigate to="/enforcement?view=orders" replace />} />
        <Route path="enforcement-orders/:enforceNum" element={<EnforcementOrderPage />} />
        <Route path="analysis/:taskId" element={<AnalysisResultPage />} />
        {/* superseded addresses keep working: they land on the single full-page experience */}
        <Route path="sanad-orders" element={<Navigate to="/enforcement?view=orders" replace />} />
        <Route path="sanad-orders/:enforceNum" element={<Redirect make={(p) => `/enforcement-orders/${encodeURIComponent(p.enforceNum)}`} />} />
        <Route path="investment-invoices" element={<Navigate to="/invoices" replace />} />
        <Route path="investment-invoices/:id" element={<Redirect make={(p) => `/invoices/${encodeURIComponent(p.id)}`} />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
