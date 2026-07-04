/**
 * AppLayout — wraps protected pages with Sidebar + main content area.
 * Stitch design: sidebar 260px + content area with 32px padding on slate-50 bg.
 */
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar />
      <main className="ml-[260px] p-8 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
