import React, { useState, useEffect } from 'react';
import { 
  Store, CheckCircle, XCircle, Loader2, MapPin, 
  Eye, EyeOff, X, ExternalLink, RefreshCw, Shield
} from 'lucide-react';

interface VenueApplication {
  id: string;
  venue_name: string;
  city: string;
  address?: string;
  slug?: string;
  owner_id: string;
  owner_email: string;
  owner_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  admin_notes?: string;
}

interface SuperAdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SuperAdminPanel: React.FC<SuperAdminPanelProps> = ({ isOpen, onClose }) => {
  const [applications, setApplications] = useState<VenueApplication[]>([]);
  const [allVenues, setAllVenues] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'venues'>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load applications
      const appsResponse = await fetch('/api/owner/applications/all', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('ownerToken')}` }
      });
      
      if (appsResponse.ok) {
        const appsData = await appsResponse.json();
        setApplications(appsData);
      }

      // Load all venues
      const venuesResponse = await fetch('/api/venues');
      if (venuesResponse.ok) {
        const venuesData = await venuesResponse.json();
        setAllVenues(venuesData);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (applicationId: string) => {
    try {
      const response = await fetch(`/api/owner/applications/${applicationId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ownerToken')}`
        },
        body: JSON.stringify({ 
          admin_notes: notes[applicationId] || '' 
        })
      });

      if (response.ok) {
        await loadData();
        setNotes(prev => ({ ...prev, [applicationId]: '' }));
      } else {
        alert('Ошибка при одобрении заявки');
      }
    } catch (error) {
      console.error('Failed to approve:', error);
      alert('Ошибка при одобрении заявки');
    }
  };

  const handleReject = async (applicationId: string) => {
    const reason = notes[applicationId] || prompt('Причина отклонения:');
    if (!reason) return;

    try {
      const response = await fetch(`/api/owner/applications/${applicationId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ownerToken')}`
        },
        body: JSON.stringify({ 
          admin_notes: reason 
        })
      });

      if (response.ok) {
        await loadData();
        setNotes(prev => ({ ...prev, [applicationId]: '' }));
      } else {
        alert('Ошибка при отклонении заявки');
      }
    } catch (error) {
      console.error('Failed to reject:', error);
      alert('Ошибка при отклонении заявки');
    }
  };

  const toggleVenueVisibility = async (venueId: string, currentVisibility: boolean) => {
    try {
      const response = await fetch(`/api/owner/venues/${venueId}/visibility`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ownerToken')}`
        },
        body: JSON.stringify({ visible: !currentVisibility })
      });

      if (response.ok) {
        await loadData();
      } else {
        alert('Ошибка при изменении видимости');
      }
    } catch (error) {
      console.error('Failed to toggle visibility:', error);
    }
  };

  if (!isOpen) return null;

  const pendingApplications = applications.filter(a => a.status === 'pending');
  const displayedApplications = activeTab === 'pending' 
    ? pendingApplications 
    : applications;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg">
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Супер Админ</h1>
              <p className="text-sm text-slate-400">Управление заявками и заведениями</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={24} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-900/50 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex gap-2 p-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'pending'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Store size={18} />
            На рассмотрении ({pendingApplications.length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'all'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Все заявки ({applications.length})
          </button>
          <button
            onClick={() => setActiveTab('venues')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'venues'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Заведения ({allVenues.length})
          </button>
          <button
            onClick={loadData}
            className="ml-auto p-2 hover:bg-slate-800 rounded-lg transition-colors"
            title="Обновить"
          >
            <RefreshCw size={18} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-4 overflow-y-auto" style={{ height: 'calc(100vh - 180px)' }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-purple-500" size={32} />
          </div>
        ) : activeTab === 'venues' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allVenues.map(venue => (
              <div
                key={venue.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{venue.title}</h3>
                    <div className="flex items-center gap-1 text-sm text-slate-400 mt-1">
                      <MapPin size={14} />
                      <span>{venue.city}{venue.address && `, ${venue.address}`}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleVenueVisibility(venue.id, venue.visible)}
                    className={`p-2 rounded-lg transition-colors ${
                      venue.visible
                        ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                        : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                    }`}
                    title={venue.visible ? 'Скрыть' : 'Показать'}
                  >
                    {venue.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
                {venue.slug && (
                  <a
                    href={`https://hookahmix.ru/app/${venue.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
                  >
                    <ExternalLink size={14} />
                    {venue.slug}
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : displayedApplications.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <Store size={48} className="mx-auto mb-4 opacity-30" />
            <p>
              {activeTab === 'pending' 
                ? 'Нет заявок на рассмотрении' 
                : 'Нет заявок'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedApplications.map(app => (
              <div
                key={app.id}
                className={`bg-slate-900 border rounded-xl p-6 ${
                  app.status === 'pending'
                    ? 'border-yellow-700/50'
                    : app.status === 'approved'
                    ? 'border-green-700/50'
                    : 'border-red-700/50'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      {app.venue_name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <MapPin size={14} />
                      <span>{app.city}{app.address && `, ${app.address}`}</span>
                    </div>
                    {app.slug && (
                      <p className="text-sm text-slate-500 mt-1">
                        Slug: <span className="font-mono text-purple-400">{app.slug}</span>
                      </p>
                    )}
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    app.status === 'pending'
                      ? 'bg-yellow-900/30 text-yellow-400'
                      : app.status === 'approved'
                      ? 'bg-green-900/30 text-green-400'
                      : 'bg-red-900/30 text-red-400'
                  }`}>
                    {app.status === 'pending' && 'На рассмотрении'}
                    {app.status === 'approved' && 'Одобрено'}
                    {app.status === 'rejected' && 'Отклонено'}
                  </div>
                </div>

                <div className="bg-slate-950 rounded-lg p-4 mb-4">
                  <p className="text-xs text-slate-500 mb-1">Владелец</p>
                  <p className="text-sm font-semibold text-white">{app.owner_name}</p>
                  <p className="text-sm text-slate-400">{app.owner_email}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    Подано: {new Date(app.created_at).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                {app.admin_notes && (
                  <div className="bg-slate-950 rounded-lg p-4 mb-4 border border-slate-800">
                    <p className="text-xs text-slate-500 mb-1">Примечания админа</p>
                    <p className="text-sm text-slate-300">{app.admin_notes}</p>
                  </div>
                )}

                {app.status === 'pending' && (
                  <div className="space-y-3">
                    <textarea
                      value={notes[app.id] || ''}
                      onChange={(e) => setNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                      placeholder="Примечания (необязательно)"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white text-sm focus:outline-none focus:border-purple-500"
                      rows={2}
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(app.id)}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                      >
                        <CheckCircle size={18} />
                        Одобрить
                      </button>
                      <button
                        onClick={() => handleReject(app.id)}
                        className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                      >
                        <XCircle size={18} />
                        Отклонить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
