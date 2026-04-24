import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './AuthProvider';
import { ContractProvider } from './ContractProvider';
import { ToastProvider } from '@fsa/shared-ui';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ContractProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ContractProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
