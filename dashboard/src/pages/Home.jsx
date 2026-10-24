import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  Award,
  Mic,
  Ticket,
  Cake,
  Gamepad2,
  Pin,
  Flame,
  BarChart3,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

export default function Home() {
  const { user, botInfo } = useAuth();

  const features = [
    {
      icon: Award,
      title: 'XP & Leveling System',
      description: 'Fully customizable XP rates, level-up announcements, role rewards, and rank cards.'
    },
    {
      icon: Mic,
      title: 'Join-to-Create Voice',
      description: 'Dynamic temporary voice lounges with automatic cleanup and creator controls.'
    },
    {
      icon: Ticket,
      title: 'Ticket & Support Desk',
      description: 'Custom embed panels, private staff channels, and complete transcript logging.'
    },
    {
      icon: Cake,
      title: 'Birthday Celebrations',
      description: 'Automatic birthday wishes, timezone awareness, and special birthday roles.'
    },
    {
      icon: Gamepad2,
      title: 'Minigames & Counting',
      description: 'Interactive Counting, Word Chain, Rock Paper Scissors, and Trivia.'
    },
    {
      icon: Pin,
      title: 'Sticky Messages',
      description: 'Keep vital guidelines or announcements pinned right at the bottom of channels.'
    },
    {
      icon: Flame,
      title: 'Bump Reminders',
      description: 'Never miss a server bump. Auto-detects Disboard and pings staff on time.'
    },
    {
      icon: BarChart3,
      title: 'Real-time Server Stats',
      description: 'Dynamic voice counters and historical activity graphs right on your dashboard.'
    }
  ];

  return (
    <div className="space-y-20 max-w-7xl mx-auto py-12 px-4 sm:px-6">
      {/* Hero Section */}
      <div className="flex flex-col items-center text-center space-y-6 pt-8">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-aura-purple to-aura-red rounded-full blur-xl opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
          <img
            src={botInfo.avatar}
            alt={botInfo.name}
            className="relative w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-aura-purple/50 shadow-2xl"
          />
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-aura-card border border-aura-border text-xs font-semibold text-aura-purpleLight">
          <Sparkles className="w-3.5 h-3.5" />
          The All-In-One Discord Powerhouse
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight max-w-4xl">
          Supercharge Your Discord Server With{' '}
          <span className="bg-gradient-to-r from-aura-purple via-purple-300 to-aura-red bg-clip-text text-transparent">
            AURA
          </span>
        </h1>

        <p className="text-lg md:text-xl text-aura-textMuted max-w-2xl">
          Leveling, temporary voice channels, tickets, minigames, bump reminders, and sticky messages — all powered by a single bot and a stunning real-time web dashboard.
        </p>

        <div className="flex flex-wrap justify-center gap-4 pt-4">
          {user ? (
            <Link
              to="/servers"
              className="px-8 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-aura-purple to-aura-red hover:opacity-95 shadow-purple-glow transition flex items-center gap-2 text-base"
            >
              Open Dashboard
              <ChevronRight className="w-5 h-5" />
            </Link>
          ) : (
            <a
              href="/api/auth/login"
              className="px-8 py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-aura-purple to-aura-red hover:opacity-95 shadow-purple-glow transition flex items-center gap-2 text-base"
            >
              <Sparkles className="w-5 h-5" />
              Sign in with Discord
            </a>
          )}

          <a
            href={`https://discord.com/oauth2/authorize?client_id=${botInfo.id || '123456789'}&permissions=8&scope=bot%20applications.commands`}
            target="_blank"
            rel="noreferrer"
            className="px-8 py-3.5 rounded-xl font-bold text-white bg-aura-card border border-aura-border hover:border-aura-purple transition flex items-center gap-2 text-base"
          >
            Invite AURA Bot
          </a>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Everything You Need In One Bot</h2>
          <p className="text-aura-textMuted text-sm sm:text-base">No more managing 10 different single-purpose bots.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-aura-card border border-aura-border hover:border-aura-purple/50 transition-all duration-300 group hover:-translate-y-1 hover:shadow-purple-glow"
              >
                <div className="w-12 h-12 rounded-xl bg-aura-purple/10 border border-aura-purple/20 flex items-center justify-center mb-4 text-aura-purpleLight group-hover:scale-110 group-hover:bg-aura-purple/20 transition-all">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-lg text-white mb-2">{feat.title}</h3>
                <p className="text-sm text-aura-textMuted leading-relaxed">{feat.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
