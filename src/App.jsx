import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import Risk from './pages/Risk';
import Collection from './pages/Collection';
import Assistant from './pages/Assistant';
import SmartReports from './pages/SmartReports';
import StrategicDashboard from './pages/StrategicDashboard';
import DecisionRoom from './pages/decisionRoom/DecisionRoom';
import SanadOrders from './pages/SanadOrders';
import SanadOrderDetail from './pages/SanadOrderDetail';
import InvestmentInvoices from './pages/InvestmentInvoices';
import InvestmentInvoiceDetail from './pages/InvestmentInvoiceDetail';

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
        <Route path="invoices" element={<Invoices />} />
        <Route path="risk" element={<Risk />} />
        <Route path="collection" element={<Collection />} />
        <Route path="assistant" element={<Assistant />} />
        <Route path="smart-reports" element={<SmartReports />} />
        <Route path="what-if" element={<StrategicDashboard />} />
        <Route path="decision-room" element={<DecisionRoom />} />
        <Route path="planning" element={<Navigate to="/decision-room" replace />} />
        <Route path="sanad-orders" element={<SanadOrders />} />
        <Route path="sanad-orders/:enforceNum" element={<SanadOrderDetail />} />
        <Route path="investment-invoices" element={<InvestmentInvoices />} />
        <Route path="investment-invoices/:id" element={<InvestmentInvoiceDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
