import React from 'react';
import ReactDOM from 'react-dom/client';
import OwnerApp from './OwnerApp';
import './index.css';

ReactDOM.createRoot(document.getElementById('owner-root')!).render(
  <React.StrictMode>
    <OwnerApp />
  </React.StrictMode>
);
