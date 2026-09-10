import React, { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import AdminWorkspace from './workspaces/AdminWorkspace';
import AuditorWorkspace from './workspaces/AuditorWorkspace';
import { resolveWorkspace } from './constants/navigation';

export default function App() {
  // Persistent User Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('imvitals_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Offline Sync Queue Handler
  useEffect(() => {
    const processOfflineQueue = () => {
      if (!navigator.onLine || typeof google === 'undefined' || !google.script) return;

      const rawQueue = localStorage.getItem('offline_sync_queue');
      if (!rawQueue) return;

      try {
        const queue = JSON.parse(rawQueue);
        if (!Array.isArray(queue) || queue.length === 0) return;

        const syncNext = (index) => {
          if (index >= queue.length) {
            localStorage.removeItem('offline_sync_queue');
            return;
          }

          const item = queue[index];
          google.script.run
            .withSuccessHandler(() => syncNext(index + 1))
            .withFailureHandler(() => syncNext(index + 1))
            .apiSubmitAudit(item);
        };

        syncNext(0);
      } catch (err) {
        console.error('Failed to parse offline sync queue:', err);
      }
    };

    // Attempt processing on initial load and when online event fires
    processOfflineQueue();
    window.addEventListener('online', processOfflineQueue);
    return () => window.removeEventListener('online', processOfflineQueue);
  }, []);

  const handleAuthenticated = (user) => {
    setCurrentUser(user);
    localStorage.setItem('imvitals_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('imvitals_user');
  };

  if (!currentUser) {
    return <LoginScreen onAuthenticated={handleAuthenticated} />;
  }

  const workspace = resolveWorkspace(currentUser.role);

  return workspace === 'ADMIN' ? (
    <AdminWorkspace currentUser={currentUser} onLogout={handleLogout} />
  ) : (
    <AuditorWorkspace currentUser={currentUser} onLogout={handleLogout} />
  );
}