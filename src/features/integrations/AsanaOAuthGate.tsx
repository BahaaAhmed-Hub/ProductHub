import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { consumePendingAsanaOAuth } from './asana';

/** Mounted once for every internal role (AppShell). Asana's redirect URI is
 * the app's bare origin — no hash/route survives the round trip — so this
 * has to live somewhere that's always mounted to catch it.
 *
 * Normal case: this runs inside the popup connectAsana() opened. It just
 * forwards the code/state to window.opener and closes itself — the opener
 * does the actual verification + exchange and updates its own UI directly,
 * so there's nothing further to do here.
 *
 * Fallback case (no window.opener — popups were blocked and this somehow
 * still ran as a plain redirect): do the exchange locally and navigate back,
 * so the flow degrades gracefully instead of silently doing nothing. */
export function AsanaOAuthGate() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!sessionStorage.getItem('ph.asanaOAuthCode')) return;
    const isPopup = Boolean(window.opener);
    consumePendingAsanaOAuth()
      .then((handled) => {
        if (!handled || isPopup) return; // popup path: opener already handled it
        qc.invalidateQueries({ queryKey: ['integration', 'asana'] });
        navigate('/integrations');
      })
      .catch((err) => {
        if (isPopup) return; // opener will surface its own error via the rejected promise
        sessionStorage.setItem('ph.asanaOAuthError', err instanceof Error ? err.message : 'Connection failed.');
        navigate('/integrations');
      });
  }, [navigate, qc]);

  return null;
}
