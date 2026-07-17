import { useNavigate, useParams } from 'react-router-dom';
import { TopNav } from '@/components/layout/TopNav';
import { ItemDetailBody } from '@/components/board/ItemDetailBody';
import { useAuth } from '@/features/auth/AuthProvider';
import { roleHome } from '@/features/auth/guards';

/** Standalone /items/:id route — direct-link fallback (e.g. notifications).
 * The primary interaction is the ItemDetailPanel slide-over opened from
 * list/board/swimlane rows via useItemPanel(); this full-page view reuses
 * the same body component so behavior never diverges between the two. */
export function ItemDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <>
      <TopNav center={<span className="text-[13px] text-body">Item</span>} notificationCount={4} />
      <div className="flex-1 bg-canvas flex justify-center overflow-hidden">
        <div className="w-full max-w-xl bg-surface border-x-[0.5px] border-hairline">
          <ItemDetailBody itemId={id ?? ''} onClose={() => navigate(user ? roleHome(user.role) : '/')} />
        </div>
      </div>
    </>
  );
}
