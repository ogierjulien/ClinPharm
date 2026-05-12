import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom';
import {
  FlaskConical,
  TrendingUp,
  AlertTriangle,
  FileText,
  LayoutDashboard,
  ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';
import LoadingSpinner from './components/shared/LoadingSpinner';

const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));
const AllometryModule = lazy(() => import('./components/allometry/AllometryModule'));
const IVIVEModule = lazy(() => import('./components/ivive/IVIVEModule'));
const DDIModule = lazy(() => import('./components/ddi/DDIModule'));
const ReportingModule = lazy(() => import('./components/reporting/ReportingModule'));

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/allometry', label: 'Allometry', icon: TrendingUp, end: false },
  { to: '/ivive', label: 'IVIVE', icon: FlaskConical, end: false },
  { to: '/ddi', label: 'DDI', icon: AlertTriangle, end: false },
  { to: '/reporting', label: 'Reporting', icon: FileText, end: false },
];

function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-56 min-h-screen bg-slate-900 border-r border-slate-700 pt-4 pb-8">
      <nav className="flex flex-col gap-1 px-3 mt-2">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto px-4 pt-6">
        <div className="rounded-lg bg-slate-800 p-3 text-xs text-slate-400 leading-relaxed">
          <p className="font-semibold text-slate-300 mb-1">Formula Set v1.0</p>
          <p>Physiology DB v1.0</p>
        </div>
      </div>
    </aside>
  );
}

function TopNavbar() {
  return (
    <header className="sticky top-0 z-30 flex items-center h-14 bg-indigo-950 border-b border-indigo-900 px-4 lg:px-6 gap-4">
      <Link to="/" className="flex items-center gap-2 text-white font-semibold text-lg shrink-0">
        <FlaskConical className="h-5 w-5 text-indigo-300" />
        <span>ClinPharm Toolkit</span>
      </Link>

      {/* Desktop nav links */}
      <nav className="hidden lg:flex items-center gap-1 ml-6">
        {navItems.slice(1).map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-700 text-white'
                  : 'text-indigo-200 hover:bg-indigo-800 hover:text-white',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Mobile nav links */}
      <nav className="flex lg:hidden items-center gap-1 ml-2 overflow-x-auto">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap',
                isActive
                  ? 'bg-indigo-700 text-white'
                  : 'text-indigo-200 hover:bg-indigo-800 hover:text-white',
              )
            }
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

function DisclaimerBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs text-amber-800">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
      <span>
        <strong>Research Use Only:</strong> Outputs are exploratory and assumption-dependent. Not
        for clinical decision-making or regulatory submission without independent validation.
      </span>
    </div>
  );
}

function Breadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const labelMap: Record<string, string> = {
    allometry: 'Allometric Scaling',
    ivive: 'IVIVE',
    ddi: 'DDI Assessment',
    reporting: 'Reporting',
  };

  return (
    <nav className="flex items-center gap-1 text-xs text-slate-500 px-6 py-2 bg-white border-b border-slate-100">
      <Link to="/" className="hover:text-slate-800 transition-colors">
        Home
      </Link>
      {segments.map((seg) => (
        <React.Fragment key={seg}>
          <ChevronRight className="h-3 w-3" />
          <span className="text-slate-700 font-medium">{labelMap[seg] ?? seg}</span>
        </React.Fragment>
      ))}
    </nav>
  );
}

function AppLayout() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopNavbar />
      <DisclaimerBanner />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-auto">
          <Breadcrumb />
          <div className="flex-1">
            <Suspense fallback={<LoadingSpinner label="Loading module..." />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/allometry" element={<AllometryModule />} />
                <Route path="/ivive" element={<IVIVEModule />} />
                <Route path="/ddi" element={<DDIModule />} />
                <Route path="/reporting" element={<ReportingModule />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
