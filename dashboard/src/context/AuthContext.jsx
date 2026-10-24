import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';
import { io } from 'socket.io-client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [botInfo, setBotInfo] = useState({
    name: 'AURA',
    avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
    guildCount: 0
  });
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // 1. Fetch Bot Info
    api.get('/api/bot/info')
      .then(res => setBotInfo(res.data))
      .catch(() => {});

    // 2. Fetch User Profile
    api.get('/api/auth/user')
      .then(res => {
        if (res.data.user) {
          setUser(res.data.user);
        }
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));

    // 3. Connect Socket.IO
    const socketEndpoint = import.meta.env.VITE_API_URL || undefined;
    const newSocket = io(socketEndpoint, { withCredentials: true });
    setSocket(newSocket);

    return () => newSocket.disconnect();
  }, []);

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
      setUser(null);
      window.location.href = '/';
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, botInfo, socket, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
