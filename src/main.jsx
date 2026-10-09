import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { I18nProvider } from './context/I18nContext';
import { AuthProvider } from './context/AuthContext';
import { RevenueProvider } from './context/RevenueContext';
import { ThemeProvider } from './context/ThemeContext';
import './styles/variables.css';
import './styles/global.css';
import './styles/ai-process.css';
import './styles/revenue.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <RevenueProvider>
              <App />
            </RevenueProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
