import React, { useState, useEffect } from 'react';
import LoginScreen from '../features/auth/LoginScreen';
import AdminWorkspace from '../roles/admin/AdminWorkspace';
import AuditorWorkspace from '../roles/auditor/AuditorWorkspace';
import { resolveWorkspace } from '../shared/config/navigation';
import { supabase } from '../shared/lib/supabaseClient'; // 1. Import your local data store client
import AuditManagerWorkspace from '../roles/audit-manager/AuditManagerWorkspace';
import ActionOwnerWorkspace from '../roles/action-owner/ActionOwnerWorkspace';

export default function App() {
  // Persistent User Authentication State
  const [currentUser, setCurrentUser] = useState(null);

  // Restore the app session from Supabase Auth (never from client-editable localStorage).
  useEffect(() => {
    let disposed = false;
    let sessionRevision = 0;
    const loadProfile = async (authUser, revision) => {
      const { data: profiles, error } = await supabase.rpc('get_my_profile');
      const profile = Array.isArray(profiles) ? profiles[0] : profiles;
      if (disposed || revision !== sessionRevision) return;
      if (error || !profile || !profile.active) {
        setCurrentUser(null);
        if (error) console.error('Could not restore user profile:', error);
        return;
      }
      setCurrentUser({
        user_id: profile.user_id,
        name: profile.full_name || authUser.email,
        email: profile.email,
        role: profile.role,
        home_cluster: profile.home_cluster || '',
        additional_cluster: profile.additional_cluster || ''
      });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        sessionRevision += 1;
        setCurrentUser(null);
      } else if (event === 'INITIAL_SESSION' && session) {
        const revision = ++sessionRevision;
        setTimeout(() => loadProfile(session.user, revision), 0);
      }
    });
    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, []);

  // Offline Sync Queue Handler (Updated for local data store)
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
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
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

