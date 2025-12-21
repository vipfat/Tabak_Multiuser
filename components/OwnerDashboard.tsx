import React, { useState, useEffect } from 'react';
import { 
  Store, Plus, Settings, LogOut, BarChart3, Users, 
  CheckCircle, Clock, XCircle, Loader2, MapPin, Code
} from 'lucide-react';

interface Owner {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  emailVerified: boolean;
}

interface Venue {
  id: string;
  title: string;
  city: string;
  address?: string;
  slug?: string;
  visible: boolean;
  created_at: string;
}

interface Application {
  id: string;
  venue_name: string;
  city: string;
  status: string;
  created_at: string;
  admin_notes?: string;
}

interface OwnerDashboardProps {
  owner: Owner;
  onLogout: () => void;
  onTitleClick?: () => void;
}

export const OwnerDashboard: React.FC<OwnerDashboardProps> = ({ owner, onLogout, onTitleClick }) => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [showApiTester, setShowApiTester] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      
      const [venuesRes, appsRes] = await Promise.all([
        fetch('/api/owner/venues', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/owner/applications', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (venuesRes.ok) {
        const venuesData = await venuesRes.json();
        setVenues(venuesData);
      }

      if (appsRes.ok) {
        const appsData = await appsRes.json();
        setApplications(appsData);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Не удалось загрузить данные');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/10 text-yellow-500 text-xs font-medium rounded">
            <Clock className="w-3 h-3" />
            На рассмотрении
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-500 text-xs font-medium rounded">
            <CheckCircle className="w-3 h-3" />
            Одобрено
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-500 text-xs font-medium rounded">
            <XCircle className="w-3 h-3" />
            Отклонено
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-gray-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center gap-3 cursor-pointer select-none"
              onClick={onTitleClick}
              title="7 кликов для активации супер админ панели"
            >
              <Store className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-xl font-bold text-white">Личный кабинет</h1>
                <p className="text-sm text-gray-400">{owner.fullName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/"
                className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-primary transition-colors text-sm"
                title="На главную"
              >
                <span className="hidden sm:inline">На главную</span>
              </a>
              <button
                onClick={() => setShowApiTester(!showApiTester)}
                className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-primary transition-colors text-sm"
                title="API Tester для разработчиков"
              >
                <Code className="w-5 h-5" />
                <span className="hidden sm:inline">API</span>
              </button>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Выйти
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-surface p-6 rounded-xl border border-gray-800">
            <div className="flex items-center gap-3 mb-2">
              <Store className="w-6 h-6 text-primary" />
              <h3 className="text-gray-400 text-sm font-medium">Заведения</h3>
            </div>
            <p className="text-3xl font-bold text-white">{venues.length}</p>
          </div>

          <div className="bg-surface p-6 rounded-xl border border-gray-800">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-6 h-6 text-yellow-500" />
              <h3 className="text-gray-400 text-sm font-medium">Заявки</h3>
            </div>
            <p className="text-3xl font-bold text-white">
              {applications.filter(a => a.status === 'pending').length}
            </p>
          </div>

          <div className="bg-surface p-6 rounded-xl border border-gray-800">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-6 h-6 text-green-500" />
              <h3 className="text-gray-400 text-sm font-medium">Активные</h3>
            </div>
            <p className="text-3xl font-bold text-white">
              {venues.filter(v => v.visible).length}
            </p>
          </div>
        </div>

        {/* Venues List */}
        <div className="bg-surface rounded-xl border border-gray-800 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Мои заведения</h2>
            <button
              onClick={() => setShowApplicationForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Подключить заведение
            </button>
          </div>

          {venues.length === 0 ? (
            <div className="text-center py-12">
              <Store className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">У вас пока нет заведений</p>
              <button
                onClick={() => setShowApplicationForm(true)}
                className="text-primary hover:text-primary/80 font-semibold"
              >
                Подключить первое заведение
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {venues.map((venue) => (
                <div
                  key={venue.id}
                  className="p-4 bg-background rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {venue.title}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <MapPin className="w-4 h-4" />
                        {venue.city}
                        {venue.address && ` • ${venue.address}`}
                      </div>
                      {venue.slug && (
                        <p className="text-xs text-gray-500 mt-2">
                          Ссылка: /app/{venue.slug}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {venue.visible ? (
                        <span className="px-2 py-1 bg-green-500/10 text-green-500 text-xs font-medium rounded">
                          Активно
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-500/10 text-gray-500 text-xs font-medium rounded">
                          Неактивно
                        </span>
                      )}
                      <button className="p-2 text-gray-400 hover:text-white transition-colors">
                        <Settings className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Applications */}
        {applications.length > 0 && (
          <div className="bg-surface rounded-xl border border-gray-800 p-6">
            <h2 className="text-xl font-bold text-white mb-6">Заявки на подключение</h2>
            <div className="space-y-4">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="p-4 bg-background rounded-lg border border-gray-800"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {app.venue_name}
                      </h3>
                      <p className="text-sm text-gray-400 mb-2">{app.city}</p>
                      <p className="text-xs text-gray-500">
                        Подана: {new Date(app.created_at).toLocaleDateString('ru-RU')}
                      </p>
                      {app.admin_notes && (
                        <p className="mt-2 text-sm text-gray-300 p-2 bg-gray-800 rounded">
                          {app.admin_notes}
                        </p>
                      )}
                    </div>
                    <div>
                      {getStatusBadge(app.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Application Form Modal */}
      {showApplicationForm && (
        <VenueApplicationForm
          onClose={() => setShowApplicationForm(false)}
          onSuccess={() => {
            setShowApplicationForm(false);
            loadData();
          }}
        />
      )}

      {/* API Tester Modal */}
      {showApiTester && (
        <ApiTester onClose={() => setShowApiTester(false)} />
      )}
    </div>
  );
};

interface VenueApplicationFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const VenueApplicationForm: React.FC<VenueApplicationFormProps> = ({ onClose, onSuccess }) => {
  const [venueName, setVenueName] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/owner/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          venueName,
          city,
          address,
          phone,
          email,
          description
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка отправки заявки');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Заявка на подключение заведения</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-500 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Название заведения *
            </label>
            <input
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-background border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
              placeholder="Кальянная Дым"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Город *
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                className="w-full px-4 py-3 bg-background border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
                placeholder="Москва"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Телефон
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
                placeholder="+7 900 123 45 67"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Адрес
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
              placeholder="ул. Примерная, д. 1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email для связи
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors"
              placeholder="venue@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Описание (необязательно)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 bg-background border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary transition-colors resize-none"
              placeholder="Расскажите о вашем заведении..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 px-4 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Отправка...
                </>
              ) : (
                'Отправить заявку'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ApiTesterProps {
  onClose: () => void;
}

const ApiTester: React.FC<ApiTesterProps> = ({ onClose }) => {
  const [endpoint, setEndpoint] = useState('GET /api/auth/me');
  const [response, setResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const endpoints = [
    { label: 'GET /api/auth/me', method: 'GET', url: '/api/auth/me' },
    { label: 'GET /api/owner/profile', method: 'GET', url: '/api/owner/profile' },
    { label: 'GET /api/owner/venues', method: 'GET', url: '/api/owner/venues' },
    { label: 'GET /api/owner/applications', method: 'GET', url: '/api/owner/applications' },
    { label: 'POST /api/auth/logout', method: 'POST', url: '/api/auth/logout' },
  ];

  const testEndpoint = async () => {
    setError('');
    setResponse(null);
    setIsLoading(true);

    try {
      const token = localStorage.getItem('accessToken');
      const [method, url] = endpoint.split(' ');

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      setResponse({
        status: response.status,
        statusText: response.statusText,
        data: data
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
      <div className="bg-surface rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Code className="w-6 h-6 text-primary" />
            API Tester
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Выберите endpoint:
            </label>
            <select
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary transition-colors"
            >
              {endpoints.map((ep) => (
                <option key={ep.url} value={`${ep.method} ${ep.url}`}>
                  {ep.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={testEndpoint}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Code className="w-5 h-5" />
                Запустить
              </>
            )}
          </button>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-red-500 font-mono text-sm">{error}</p>
            </div>
          )}

          {response && (
            <div className="p-4 bg-background border border-gray-700 rounded-lg">
              <p className="text-gray-400 text-sm mb-2">
                Статус: <span className="text-white font-mono">{response.status} {response.statusText}</span>
              </p>
              <pre className="bg-gray-950 p-3 rounded text-xs text-gray-300 overflow-x-auto max-h-64">
                {JSON.stringify(response.data, null, 2)}
              </pre>
            </div>
          )}

          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-400 text-xs font-mono break-all">
              {endpoint}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
