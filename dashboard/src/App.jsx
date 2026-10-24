import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import ServerSelect from './pages/ServerSelect';
import Overview from './pages/Overview';
import Modules from './pages/Modules';
import Leveling from './pages/Leveling';
import Voice from './pages/Voice';
import Tickets from './pages/Tickets';
import StickyMessages from './pages/StickyMessages';
import Birthdays from './pages/Birthdays';
import Games from './pages/Games';
import BumpSettings from './pages/BumpSettings';
import Threads from './pages/Threads';
import CommandsList from './pages/CommandsList';
import BotSettings from './pages/BotSettings';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Home Page with Navbar only */}
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/servers" element={<ServerSelect />} />

            {/* Guild Dashboard Routes */}
            <Route path="/servers/:guildId" element={<Overview />} />
            <Route path="/servers/:guildId/modules" element={<Modules />} />
            <Route path="/servers/:guildId/leveling" element={<Leveling />} />
            <Route path="/servers/:guildId/voice" element={<Voice />} />
            <Route path="/servers/:guildId/tickets" element={<Tickets />} />
            <Route path="/servers/:guildId/sticky" element={<StickyMessages />} />
            <Route path="/servers/:guildId/birthdays" element={<Birthdays />} />
            <Route path="/servers/:guildId/games" element={<Games />} />
            <Route path="/servers/:guildId/bump" element={<BumpSettings />} />
            <Route path="/servers/:guildId/threads" element={<Threads />} />
            <Route path="/servers/:guildId/commands" element={<CommandsList />} />
            <Route path="/servers/:guildId/settings" element={<BotSettings />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
