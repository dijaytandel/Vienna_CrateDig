import { NavLink } from 'react-router-dom';
import { TABS } from '../app/routes';

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className="tab">
          <span aria-hidden="true">{tab.icon}</span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
