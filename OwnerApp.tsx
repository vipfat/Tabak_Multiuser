import React, { useState, useEffect } from 'react';
import { LoginForm, RegisterForm } from './components/OwnerAuth';
import { OwnerDashboard } from './components/OwnerDashboard';
import { SuperAdminPanel } from './components/SuperAdminPanel';
import { Loader2, Shield } from 'lucide-react';

const OwnerApp: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [owner, setOwner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [showSuperAdmin, setShowSuperAdmin] = useState(false);
  const [adminClicks, setAdminClicks] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('accessToken');
    const storedOwner = localStorage.getItem('owner');

    if (!token || !storedOwner) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setOwner(data);
        setIsAuthenticated(true);
      } else if (response.status === 401) {
        // Try to refresh token
        await tryRefreshToken();
      }
    } catch (err) {
      console.error('Auth check failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const tryRefreshToken = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      handleLogout();
      return;
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('accessToken', data.accessToken);
        await checkAuth();
      } else {
        handleLogout();
      }
    } catch (err) {
      handleLogout();
    }
  };

  const handleAuthSuccess = (data: any) => {
    setOwner(data.owner);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (refreshToken) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      }).catch(console.error);
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('owner');
    setIsAuthenticated(false);
    setOwner(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const handleTitleClick = () => {
    setAdminClicks(prev => prev + 1);
    if (adminClicks >= 6) {
      setShowSuperAdmin(true);
      setAdminClicks(0);
    }
    setTimeout(() => setAdminClicks(0), 2000);
  };

  if (isAuthenticated && owner) {
    return (
      <>
        <OwnerDashboard owner={owner} onLogout={handleLogout} />
        {showSuperAdmin && (
          <SuperAdminPanel
            isOpen={showSuperAdmin}
            onClose={() => setShowSuperAdmin(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-8">
          <h1 
            className="text-4xl font-bold text-white mb-2 cursor-pointer select-none"
            onClick={handleTitleClick}
          >
            Кальянный Алхимик
          </h1>
          <p className="text-gray-400">
            Платформа управления кальянными заведениями
          </p>
        </div>

        {showRegister ? (
          <RegisterForm
            onSuccess={handleAuthSuccess}
            onSwitchToLogin={() => setShowRegister(false)}
          />
        ) : (
          <LoginForm
            onSuccess={handleAuthSuccess}
            onSwitchToRegister={() => setShowRegister(true)}
          />
        )}
      </div>
    </div>
  );
};

export default OwnerApp;
