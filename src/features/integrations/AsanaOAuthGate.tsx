import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { consumePendingAsanaOAuth } from './asana';

/** Mounted once for every internal role (AppShell). Asana's redirect URI is
 * the app's bare origin — no hash/route survives the round trip — so this
 * has to live somewhere that's always mounted to catch it.
 *
 * This runs inside the popup connectAsana() opened. It drops the returned
 * code/state into localStorage for the opener to pick up and closes itself
 * — the opener does the actual verification + exchange and updates its own
 * UI directly. The navigate() below only matters if window.close() didn't
 * actually close this window (e.g. it wasn't opened via script after all,
 * or the browser blocked self-close) — a backstop so the tab lands
 * somewhere sane instead of showing a dangling half-connected state. */
export function AsanaOAuthGate() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionStorage.getItem('ph.asanaOAuthCode')) return;
    consumePendingAsanaOAuth().then((handled) => {
      if (handled) navigate('/integrations');
    });
  }, [navigate]);

  return null;
}
