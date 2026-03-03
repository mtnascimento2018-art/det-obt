import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate, NavLink } from 'react-router-dom';
import { LogOut, Home, Users, BarChart2, Shield, PlusCircle, Search, MessageSquare, ThumbsUp, Eye, Share2, Camera, CheckCircle, RotateCcw, Building2, Bell, MessageCircle, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Usuario, Notificacao } from './types';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ConsultaDetail from './pages/ConsultaDetail';
import Ranking from './pages/Ranking';
import Admin from './pages/Admin';
import Empresas from './pages/Empresas';
import Chat from './pages/Chat';
import ProfileModal from './components/ProfileModal';

function NotificationBell({ user, notifications, setNotifications }: { user: Usuario, notifications: Notificacao[], setNotifications: React.Dispatch<React.SetStateAction<Notificacao[]>> }) {
  const [show, setShow] = useState(false);
  const unreadCount = notifications.filter(n => !n.lida).length;

  const markAsRead = async (id: number) => {
    try {
      await fetch(`/api/notificacoes/${id}/lida`, { method: 'POST' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, lida: 1 } : n));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setShow(!show)}
        className="p-2 hover:bg-[#39FF14]/10 rounded-full transition-colors text-[#818384] hover:text-[#39FF14] relative"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[#1A1A1B]">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {show && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShow(false)} />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 mt-2 sm:w-80 bg-[#1A1A1B] border border-[#343536] rounded-lg shadow-2xl z-50 overflow-hidden"
              style={{ 
                top: window.innerWidth < 640 ? '4rem' : 'auto',
                transformOrigin: window.innerWidth < 640 ? 'top center' : 'top right'
              }}
            >
              <div className="p-3 border-b border-[#343536] flex items-center justify-between">
                <span className="font-bold text-sm">Notificações</span>
                {unreadCount > 0 && <span className="text-[10px] text-[#39FF14] font-bold uppercase">{unreadCount} novas</span>}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#818384]">Nenhuma notificação por enquanto.</div>
                ) : (
                  notifications.map(n => (
                    <Link 
                      key={n.id} 
                      to={n.link || '#'} 
                      onClick={() => { markAsRead(n.id); setShow(false); }}
                      className={`block p-3 border-b border-[#343536] hover:bg-[#39FF14]/5 transition-colors ${!n.lida ? 'bg-[#39FF14]/5' : ''}`}
                    >
                      <p className="text-xs text-[#FFFFFF] mb-1">{n.mensagem}</p>
                      <span className="text-[10px] text-[#818384]">{new Date(n.data_criacao).toLocaleString()}</span>
                    </Link>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<Usuario | null>(() => {
    const saved = localStorage.getItem('sitec_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [notifications, setNotifications] = useState<Notificacao[]>([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      connectWS();
    }
    return () => {
      if (ws.current) ws.current.close();
    };
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/notificacoes/${user.id}`);
      if (res.ok) setNotifications(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const connectWS = () => {
    if (!user) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'auth', userId: user.id }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'notification') {
        setNotifications(prev => [data.data, ...prev]);
        // Simple visual feedback
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Detetive Obtenção", { body: data.data.mensagem });
        }
      }
    };

    socket.onclose = () => {
      setTimeout(connectWS, 3000);
    };

    ws.current = socket;
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const handleLogin = (userData: Usuario) => {
    setUser(userData);
    localStorage.setItem('sitec_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sitec_user');
    if (ws.current) ws.current.close();
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-[#051A05]">
        {/* Navbar */}
        <nav className="bg-[#0A240A] border-b border-[#1A3A1A] sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-8">
                <Link to="/" className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-[#39FF14] rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(57,255,20,0.3)]">
                    <Search className="w-6 h-6 text-[#051A05]" />
                  </div>
                  <div className="flex flex-col leading-none hidden sm:block">
                    <span className="font-black text-lg tracking-tighter text-[#39FF14] italic">Detetive Obtenção</span>
                  </div>
                </Link>
                <div className="hidden md:flex items-center gap-4">
                  <NavLink to="/" className={({ isActive }) => `flex items-center gap-2 px-3 py-1 rounded-md transition-colors text-sm font-medium ${isActive ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'text-[#818384] hover:bg-[#39FF14]/10 hover:text-[#39FF14]'}`}>
                    <Home className="w-4 h-4" />
                    <span>Início</span>
                  </NavLink>
                  <NavLink to="/empresas" className={({ isActive }) => `flex items-center gap-2 px-3 py-1 rounded-md transition-colors text-sm font-medium ${isActive ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'text-[#818384] hover:bg-[#39FF14]/10 hover:text-[#39FF14]'}`}>
                    <Building2 className="w-4 h-4" />
                    <span>Empresas</span>
                  </NavLink>
                  <NavLink to="/ranking" className={({ isActive }) => `flex items-center gap-2 px-3 py-1 rounded-md transition-colors text-sm font-medium ${isActive ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'text-[#818384] hover:bg-[#39FF14]/10 hover:text-[#39FF14]'}`}>
                    <BarChart2 className="w-4 h-4" />
                    <span>Ranking</span>
                  </NavLink>
                  <NavLink to="/chat" className={({ isActive }) => `flex items-center gap-2 px-3 py-1 rounded-md transition-colors text-sm font-medium ${isActive ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'text-[#818384] hover:bg-[#39FF14]/10 hover:text-[#39FF14]'}`}>
                    <MessageCircle className="w-4 h-4" />
                    <span>Chat</span>
                  </NavLink>
                  <NavLink to="/admin" className={({ isActive }) => `flex items-center gap-2 px-3 py-1 rounded-md transition-colors text-sm font-medium ${isActive ? 'bg-[#39FF14]/20 text-[#39FF14]' : 'text-[#818384] hover:bg-[#39FF14]/10 hover:text-[#39FF14]'}`}>
                    <Shield className="w-4 h-4" />
                    <span>Admin</span>
                  </NavLink>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <NotificationBell user={user} notifications={notifications} setNotifications={setNotifications} />
                
                <div className="h-6 w-px bg-[#1A3A1A] mx-2" />

                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-bold text-[#FFFFFF]">{user.nome}</span>
                    <span className="text-[10px] text-[#39FF14] uppercase tracking-tighter font-mono">{user.codigo_interno}</span>
                  </div>
                  <button 
                    onClick={() => setShowProfileModal(true)}
                    className="p-2 hover:bg-[#39FF14]/10 rounded-full transition-colors text-[#818384] hover:text-[#39FF14]"
                    title="Meu Perfil"
                  >
                    <User className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="p-2 hover:bg-red-500/10 rounded-full transition-colors text-[#818384] hover:text-red-500"
                    title="Sair"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 mb-16 md:mb-0">
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route path="/consulta/:id" element={<ConsultaDetail user={user} />} />
            <Route path="/empresas" element={<Empresas user={user} />} />
            <Route path="/ranking" element={<Ranking />} />
            <Route path="/chat" element={<Chat user={user} />} />
            <Route path="/admin" element={<Admin user={user} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-[#0A240A] border-t border-[#1A3A1A] py-8 pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <p className="text-[10px] text-[#39FF14]/60 uppercase font-bold tracking-widest text-center">
                Catálogo Rápido Retroalimentado pela comunidade
              </p>
              <p className="text-[8px] text-[#818384] uppercase font-bold">
                Desenvolvido pelo Centro de Operações do Abastecimento
              </p>
              <p className="text-[8px] text-[#818384] uppercase font-bold">
                Marinha do Brasil
              </p>
            </div>
          </div>
        </footer>

        <AnimatePresence>
          {showProfileModal && (
            <ProfileModal 
              user={user} 
              onClose={() => setShowProfileModal(false)} 
              onUpdate={(updatedUser) => {
                setUser(updatedUser);
                localStorage.setItem('sitec_user', JSON.stringify(updatedUser));
              }}
            />
          )}
        </AnimatePresence>

        {/* Mobile Nav */}
        <div className="md:hidden bg-[#0A240A] border-t border-[#1A3A1A] fixed bottom-0 left-0 right-0 z-50">
          <div className="flex justify-around items-center h-16">
            <NavLink to="/" className={({ isActive }) => `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-[#39FF14]' : 'text-[#818384] hover:text-[#39FF14]'}`}>
              <Home className="w-5 h-5" />
              <span className="text-[10px] font-bold">Início</span>
            </NavLink>
            <NavLink to="/empresas" className={({ isActive }) => `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-[#39FF14]' : 'text-[#818384] hover:text-[#39FF14]'}`}>
              <Building2 className="w-5 h-5" />
              <span className="text-[10px] font-bold">Empresas</span>
            </NavLink>
            <NavLink to="/chat" className={({ isActive }) => `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-[#39FF14]' : 'text-[#818384] hover:text-[#39FF14]'}`}>
              <MessageCircle className="w-5 h-5" />
              <span className="text-[10px] font-bold">Chat</span>
            </NavLink>
            <NavLink to="/ranking" className={({ isActive }) => `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-[#39FF14]' : 'text-[#818384] hover:text-[#39FF14]'}`}>
              <BarChart2 className="w-5 h-5" />
              <span className="text-[10px] font-bold">Ranking</span>
            </NavLink>
            <NavLink to="/admin" className={({ isActive }) => `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-[#39FF14]' : 'text-[#818384] hover:text-[#39FF14]'}`}>
              <Shield className="w-5 h-5" />
              <span className="text-[10px] font-bold">Admin</span>
            </NavLink>
          </div>
        </div>
      </div>
    </Router>
  );
}
