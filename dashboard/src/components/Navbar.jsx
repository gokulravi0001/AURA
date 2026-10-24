import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sparkles, LogOut, LayoutDashboard, Shield } from 'lucide-react';

export default function Navbar() {
  const { user, botInfo, logout } = useAuth();

  return (
    <nav className="h-16 border-b border-aura-border bg-aura-darker/90 backdrop-blur-md sticky top-0 z-50 px-6 flex items-center justify-between">
      {/* Brand & Bot Avatar */}
      <Link to="/" className="flex items-center gap-3 group">
        <div className="relative">
          <img
            src={botInfo.avatar}
            alt={botInfo.name}
            className="w-10 h-10 rounded-full border-2 border-aura-purple group-hover:border-aura-red transition-all duration-300 shadow-purple-glow"
          />
          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-aura-darker"></div>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-lg tracking-wider bg-gradient-to-r from-aura-purple via-purple-300 to-aura-red bg-clip-text text-transparent">
              {botInfo.name || 'AURA'}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 bg-aura-purple/20 text-aura-purpleLight rounded border border-aura-purple/30">
              V1.0
            </span>
          </div>
          <span className="text-xs text-aura-textMuted font-mono">Multipurpose Bot</span>
        </div>
      </Link>

      {/* Center Links */}
      <div className="hidden md:flex items-center gap-6">
        <Link to="/servers" className="text-sm font-medium text-aura-textMuted hover:text-white transition flex items-center gap-2">
          <LayoutDashboard className="w-4 h-4 text-aura-purple" />
          Servers
        </Link>
        <a
          href="https://discord.gg"
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-aura-textMuted hover:text-white transition"
        >
          Support Server
        </a>
      </div>

      {/* User Actions */}
      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-3">
            <Link
              to="/servers"
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-aura-card border border-aura-border hover:border-aura-purple transition"
            >
              <img
                src={user.avatarUrl}
                alt={user.username}
                className="w-7 h-7 rounded-full"
              />
              <span className="text-sm font-medium text-white hidden sm:inline">
                {user.username}
              </span>
            </Link>
            <button
              onClick={logout}
              title="Log Out"
              className="p-2 text-aura-textMuted hover:text-aura-red transition rounded-lg hover:bg-aura-red/10"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <a
            href="/api/auth/login"
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm bg-gradient-to-r from-aura-purple to-aura-red hover:opacity-95 transition shadow-purple-glow text-white"
          >
            <Sparkles className="w-4 h-4" />
            Login with Discord
          </a>
        )}
      </div>
    </nav>
  );
}
