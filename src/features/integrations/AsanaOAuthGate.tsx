import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { consumePendingAsanaOAuth } from './asana';

/** Mounted once for every internal role (AppShell). Asana's redirect URI is
 * the app's bare origin — no hash/route survives the round trip — so this
 * has to live somewhere that's always mounted, detect the pending callback
 * itself, and navigate back to /integrations once it's handled. */
export function AsanaOAuthGate() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!sessionStorage.getItem('ph.asanaOAuthCode')) return;
    consumePendingAsanaOAuth()
      .then((handled) => {
        if (!handled) return;
        qc.invalidateQueries({ queryKey: ['integration', 'asana'] });
        navigate('/integrations');
      })
      .catch((err) => {
        sessionStorage.setItem('ph.asanaOAuthError', err instanceof Error ? err.message : 'Connection failed.');
        navigate('/integrations');
      });
  }, [navigate, qc]);

  return null;
}
