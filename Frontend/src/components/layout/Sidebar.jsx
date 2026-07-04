/**
 * Sidebar navigation — consistent dark navy sidebar across all protected pages.
 * Design from Stitch: 260px fixed, dark navy (#1E3A5F), white text.
 * Role-conditional nav items based on ROLE_PERMISSIONS from permissions.py.
 */
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  Users,
  ScrollText,
  LogOut,
  Shield,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const ROLE_LABELS = {
  admin: 'Administrator',
  risk_analyst: 'Risk Analyst',
  relationship_manager: 'Relationship Mgr',
};

export default function Sidebar() {
  const { employee, logout } = useAuth();
  const navigate = useNavigate();
  const [adminOpen, setAdminOpen] = useState(false);
  const role = employee?.role;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 ${
      isActive
        ? 'bg-white/15 text-white border-l-[3px] border-accent-light'
        : 'text-white/70 hover:bg-white/10 hover:text-white border-l-[3px] border-transparent'
    }`;

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[260px] bg-navy flex flex-col z-40">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-base leading-tight">FinTrust</h1>
            <p className="text-white/50 text-xs">Intervention Engine</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <NavLink to="/dashboard" className={linkClass} end>
          <LayoutDashboard className="w-[18px] h-[18px]" />
          Dashboard
        </NavLink>

        {/* Stats — risk_analyst and admin only */}
        {(role === 'admin' || role === 'risk_analyst') && (
          <NavLink to="/stats" className={linkClass}>
            <BarChart3 className="w-[18px] h-[18px]" />
            Statistics
          </NavLink>
        )}

        {/* Admin section — admin only */}
        {role === 'admin' && (
          <>
            <button
              onClick={() => setAdminOpen(!adminOpen)}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white w-full transition-colors duration-150"
            >
              <Users className="w-[18px] h-[18px]" />
              Admin
              {adminOpen ? (
                <ChevronDown className="w-4 h-4 ml-auto" />
              ) : (
                <ChevronRight className="w-4 h-4 ml-auto" />
              )}
            </button>
            {adminOpen && (
              <div className="ml-4 space-y-1 animate-slide-down">
                <NavLink to="/admin/employees" className={linkClass}>
                  <Users className="w-[18px] h-[18px]" />
                  Employees
                </NavLink>
                <NavLink to="/admin/audit-log" className={linkClass}>
                  <ScrollText className="w-[18px] h-[18px]" />
                  Audit Log
                </NavLink>
              </div>
            )}
          </>
        )}
      </nav>

      {/* User Info */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-sm">
            {employee?.full_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{employee?.full_name}</p>
            <p className="text-white/50 text-xs">{ROLE_LABELS[role] || role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-white/60 hover:text-white text-sm w-full px-1 py-1.5 rounded transition-colors duration-150"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
