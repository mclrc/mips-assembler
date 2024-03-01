import './index.css';
import App from './App';
import { StrictMode } from 'react';
import React from 'react';
import { createRoot } from 'react-dom';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
