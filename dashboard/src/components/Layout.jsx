import React, { useEffect, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { guildId } = useParams();
  const { socket } = useAuth();
  const [guildMeta, setGuildMeta] = useState({ name: '', icon: null });

  useEffect(() => {
    if (guildId) {
      api.get(`/api/guilds/${guildId}/overview`)
        .then(res => {
          setGuildMeta({
            name: res.data.guild?.name || '',
            icon: res.data.guild?.icon || null
          });
        })
        .catch(() => {});

      if (socket) {
        socket.emit('join_guild', guildId);
      }

      return () => {
        if (socket) socket.emit('leave_guild', guildId);
      };
    }
  }, [guildId, socket]);

  return (
    <div className="min-h-screen bg-aura-darker text-aura-textMain flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        {guildId && <Sidebar guildName={guildMeta.name} guildIcon={guildMeta.icon} />}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
