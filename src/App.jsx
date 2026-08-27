import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Pipeline from './pages/Pipeline';
import Invoices from './pages/Invoices';
import Recon from './pages/Recon';
import Approvals from './pages/Approvals';
import Risk from './pages/Risk';
import Collection from './pages/Collection';
import Violations from './pages/Violations';
import Revenue from './pages/Revenue';
import Audit from './pages/Audit';
import Assistant from './pages/Assistant';
import Agents from './pages/Agents';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="recon" element={<Recon />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="risk" element={<Risk />} />
        <Route path="collection" element={<Collection />} />
        <Route path="violations" element={<Violations />} />
        <Route path="revenue" element={<Revenue />} />
        <Route path="audit" element={<Audit />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="agents" element={<Agents />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
