import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

function Tabs({ sections }) {
  return (
    <div className="w-full max-w-7xl mx-auto px-4">
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}

export default Tabs;