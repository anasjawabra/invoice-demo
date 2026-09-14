import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Chart as ChartJS } from 'chart.js';
import App from './App';
import { I18nProvider } from './context/I18nContext';
import { AuthProvider } from './context/AuthContext';
import './styles/variables.css';
import './styles/global.css';
import './styles/ai-process.css';

// Unify Chart.js font with the global CSS font stack
const globalFont = getComputedStyle(document.documentElement).getPropertyValue('--font').trim() ||
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Naskh Arabic', 'Geeza Pro', 'Segoe UI Historic', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif";
ChartJS.defaults.font.family = globalFont;
ChartJS.defaults.locale = 'en-US';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);
