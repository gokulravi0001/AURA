import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  Layers,
  Award,
  Mic,
  Cake,
  Gamepad2,
  Ticket,
  Pin,
  MessageSquareShare,
  Flame,
  Terminal,
  Settings,
  ArrowLeft
} from 'lucide-react';

export default function Sidebar({ guildName, guildIcon }) {
  const { guildId } = useParams();

  const navItems = [
    { label: 'Overview', icon: LayoutDashboard, path: `/servers/${guildId}` },
    { label: 'Server Modules', icon: Layers, path: `/servers/${guildId}/modules` },
    { label: 'Leveling & XP', icon: Award, path: `/servers/${guildId}/leveling` },
    { label: 'Voice Channels', icon: Mic, path: `/servers/${guildId}/voice` },
    { label: 'Birthdays', icon: Cake, path: `/servers/${guildId}/birthdays` },
    { label: 'Minigames', icon: Gamepad2, path: `/servers/${guildId}/games` },
    { label: 'Tickets & Support', icon: Ticket, path: `/servers/${guildId}/tickets` },
    { label: 'Sticky Messages', icon: Pin, path: `/servers/${guildId}/sticky` },
    { label: 'Image Threads', icon: MessageSquareShare, path: `/servers/${guildId}/threads` },
    { label: 'Bump Settings', icon: Flame, path: `/servers/${guildId}/bump` },
    { label: 'Commands & Docs', icon: Terminal, path: `/servers/${guildId}/commands` },
    { label: 'Bot Settings', icon: Settings, path: `/servers/${guildId}/settings` }
  ];

  return (
    <aside className="w-64 min-h-[calc(100vh-4rem)] bg-aura-card border-r border-aura-border flex flex-col p-4 shrink-0">
      {/* Current Guild Card */}
      <div className="flex items-center gap-3 p-3 mb-4 rounded-xl bg-aura-darker/60 border border-aura-border">
        {guildIcon ? (
          <img src={guildIcon} alt={guildName} className="w-10 h-10 rounded-xl" />
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-aura-purple to-aura-red flex items-center justify-center font-bold text-white">
            {guildName ? guildName.substring(0, 2).toUpperCase() : 'GS'}
          </div>
        )}
        <div className="overflow-hidden">
          <h2 className="font-bold text-sm text-white truncate">{guildName || 'Loading Server...'}</h2>
          <NavLink
            to="/servers"
            className="text-xs text-aura-purpleLight hover:text-white flex items-center gap-1 transition mt-0.5"
          >
            <ArrowLeft className="w-3 h-3" />
            Switch Server
          </NavLink>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === `/servers/${guildId}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-aura-purple/20 to-aura-red/20 text-white border-l-4 border-aura-purple shadow-purple-glow font-semibold'
                    : 'text-aura-textMuted hover:text-white hover:bg-aura-cardHover'
                }`
              }
            >
              <Icon className="w-4 h-4 text-aura-purpleLight" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
