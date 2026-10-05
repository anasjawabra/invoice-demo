import React from 'react';
import ReactDOM from 'react-dom/client';
import { Chart as ChartJS } from 'chart.js';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { I18nProvider } from './context/I18nContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import './styles/variables.css';
import './styles/global.css';
import './styles/ai-process.css';
import { chartAccessibilityPlugin } from './utils/chartAccessibility';

ChartJS.register(chartAccessibilityPlugin);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
