import React, { useState, useEffect } from 'react';
import LoginScreen from './components/LoginScreen';
import AdminWorkspace from './workspaces/AdminWorkspace';
import AuditorWorkspace from './workspaces/AuditorWorkspace';
import { resolveWorkspace } from './constants/navigation';
import { supabase } from './supabaseClient'; // 1. Import your Supabase client
import AuditManagerWorkspace from './workspaces/AuditManagerWorkspace';
import ActionOwnerWorkspace from './workspaces/ActionOwnerWorkspace';

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

  // Offline Sync Queue Handler (Updated for Supabase)
  useEffect(() => {
    const processOfflineQueue = async () => {
      // If offline, do nothing and wait for reconnection
      if (!navigator.onLine) return;

      const rawQueue = localStorage.getItem('offline_sync_queue');
      if (!rawQueue) return;

      try {
        const queue = JSON.parse(rawQueue);
        if (!Array.isArray(queue) || queue.length === 0) return;

        // Process queue items sequentially
        for (let i = 0; i < queue.length; i++) {
          const item = queue[i];

          try {
            // 2. Update the parent audit record to SUBMITTED
            const { error: auditError } = await supabase
              .from('audits')
              .update({
                status: 'SUBMITTED',
                submitted_at: new Date().toISOString(),
                total_score: item.summary?.score || 0,
                max_score: item.summary?.max || 0,
                score_percent: item.summary?.percent || 0,
                rating: item.summary?.rating || '—',
                critical_failures: item.summary?.criticalFailures || 0,
                failure_count: item.summary?.failures || 0,
                answered_questions: item.summary?.answered || 0,
                total_questions: item.summary?.total || 0,
                result: (item.summary?.percent >= 75 && item.summary?.criticalFailures === 0) ? 'PASSED' : 'FAILED', 
                audit_manager_id: item.audit_manager_id || null,
              })
              .eq('audit_id', item.audit_id);
              
            if (auditError) throw auditError;

            // 3. Insert responses into the database
            if (item.answers) {
              const responsesToInsert = Object.entries(item.answers).map(([qId, ans]) => ({
                response_id: `RES-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                audit_id: item.audit_id,
                question_id: qId,
                template_id: item.template_id,
                response_value: ans.na ? 'N/A' : ans.value,
                comment: ans.comment || '',
                answered_by: item.auditor_id,
                answered_at: new Date().toISOString()
              }));
              
              if (responsesToInsert.length > 0) {
                 const { error: responsesError } = await supabase
                  .from('responses')
                  .insert(responsesToInsert);

                 if (responsesError) throw responsesError;
              }
            }

            if (Array.isArray(item.actions) && item.actions.length > 0) {
              const { error: actionsError } = await supabase
                .from('actions')
                .upsert(item.actions, { onConflict: 'action_id' });

              if (actionsError) throw actionsError;
            }
          } catch (err) {
            console.error('Failed to sync offline item:', item.audit_id, err);
            // Stop processing if an error occurs so we don't clear the queue prematurely
            return; 
          }
        }

        // If we get here, all items synced successfully! Clear the queue.
        localStorage.removeItem('offline_sync_queue');

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

  if (workspace === 'ADMIN') {
    return (
      <AdminWorkspace
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }

  if (workspace === 'ACTION_OWNER') {
    return (
      <ActionOwnerWorkspace
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    );
  }
if (
  String(currentUser.role || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_') === 'AUDIT_MANAGER'
) {
  return (
    <AuditManagerWorkspace
      currentUser={currentUser}
      onLogout={handleLogout}
    />
  );
}

return (
  <AuditorWorkspace
    currentUser={currentUser}
    onLogout={handleLogout}
  />
);
}
