/**
 * AppLayout — minimal shell: light sidebar + clean content area.
 * Responsive: drawer on mobile, fixed sidebar on desktop.
 */
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Sidebar, { SidebarContent } from './Sidebar';
import { useAuth } from '../../context/AuthContext';

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { employee } = useAuth();

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Sidebar />

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/30"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-white shadow-xl animate-fade-in">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-md text-slate-400 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-md text-slate-600 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <p className="text-[15px] font-semibold text-slate-900 tracking-tight">FinTrust</p>
          <div className="ml-auto w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 text-[13px] font-semibold">
            {employee?.full_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
        </div>
      </header>

      <main className="lg:ml-[248px]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 min-h-screen">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
