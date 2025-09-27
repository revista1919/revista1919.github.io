import React from 'react';
import { NavLink } from 'react-router-dom';

const Tabs = ({ sections }) => {
  return (
    <div className="tabs-container">
      <div className="tabs-scroll-container">
        {sections.map((section) => (
          <NavLink
            key={section.name}
            to={section.path}
            className={({ isActive }) =>
              `tab-item ${isActive ? 'active' : ''}`
            }
          >
            {section.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
};

export default Tabs;
