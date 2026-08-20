import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import './AppShell.css';

export default function AppShell() {
  return (
    <div className="app-shell">
      <div className="app-shell-content">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
