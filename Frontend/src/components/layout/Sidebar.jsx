/**
 * Sidebar — minimal light navigation.
 * White surface, slate borders, single active state.
 */
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  Users,
  ScrollText,
  LogOut,
  ShieldCheck,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const ROLE_LABELS = {
  admin: 'Administrator',
  risk_analyst: 'Risk Analyst',
  relationship_manager: 'Relationship Manager',
};

export function SidebarContent({ onNavigate }) {
  const { employee, logout } = useAuth();
  const navigate = useNavigate();
  const [adminOpen, setAdminOpen] = useState(true);
  const role = employee?.role;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    onNavigate?.();
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-colors ${
      isActive
        ? 'bg-slate-900 text-white'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4.5 h-4.5 text-white" size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-slate-900 leading-none tracking-tight">FinTrust</p>
            <p className="text-[11.5px] text-slate-500 mt-1 leading-none">Intervention Engine</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Workspace
        </p>
        <NavLink to="/dashboard" className={linkClass} end onClick={onNavigate}>
          <LayoutDashboard size={17} strokeWidth={2} />
          Dashboard
        </NavLink>

        <NavLink to="/at-risk" className={linkClass} onClick={onNavigate}>
          <AlertTriangle size={17} strokeWidth={2} />
          At-Risk Customers
        </NavLink>

        {(role === 'admin' || role === 'risk_analyst') && (
          <NavLink to="/stats" className={linkClass} onClick={onNavigate}>
            <BarChart3 size={17} strokeWidth={2} />
            Statistics
          </NavLink>
        )}

        {role === 'admin' && (
          <div className="pt-4">
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Administration
            </p>
            <button
              onClick={() => setAdminOpen(!adminOpen)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 w-full transition-colors"
            >
              <Users size={17} strokeWidth={2} />
              Admin
              <ChevronDown
                size={15}
                className={`ml-auto transition-transform ${adminOpen ? '' : '-rotate-90'}`}
              />
            </button>
            {adminOpen && (
              <div className="mt-0.5 ml-4 pl-3 border-l border-slate-200 space-y-0.5 animate-slide-down">
                <NavLink to="/admin/employees" className={linkClass} onClick={onNavigate}>
                  <Users size={16} strokeWidth={2} />
                  Employees
                </NavLink>
                <NavLink to="/admin/audit-log" className={linkClass} onClick={onNavigate}>
                  <ScrollText size={16} strokeWidth={2} />
                  Audit Log
                </NavLink>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-slate-200">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-semibold text-[13px] shrink-0">
            {employee?.full_name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-slate-900 truncate leading-tight">
              {employee?.full_name}
            </p>
            <p className="text-[11.5px] text-slate-500 truncate">{ROLE_LABELS[role] || role}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-[248px] bg-white border-r border-slate-200 z-40">
      <SidebarContent />
    </aside>
  );
}
