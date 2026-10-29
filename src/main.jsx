import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { I18nProvider } from './context/I18nContext';
import { AuthProvider } from './context/AuthContext';
import { RevenueProvider } from './context/RevenueContext';
import { ThemeProvider } from './context/ThemeContext';
// Self-hosted IBM Plex families; CSS selects Arabic or Latin without external font requests.
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import './styles/variables.css';
import './styles/global.css';
import './styles/ai-process.css';
import './styles/revenue.css';
import './styles/record.css';
import './styles/smart-reporting.css';
import './styles/app-foundation.css';
import './styles/ui-completion.css';
import './styles/chart-theme';

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
