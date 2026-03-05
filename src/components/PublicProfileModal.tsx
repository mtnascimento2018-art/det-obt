import React, { useState, useEffect } from 'react';
import { X, User, UserPlus, Check, Clock, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Usuario } from '../types';

interface PublicProfileModalProps {
  user: Usuario;
  currentUser: Usuario;
  onClose: () => void;
}

export default function PublicProfileModal({ user, currentUser, onClose }: PublicProfileModalProps) {
  const [friendStatus, setFriendStatus] = useState<'none' | 'pendente' | 'aceito'>('none');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const checkFriendship = async () => {
      try {
        const res = await fetch(`/api/amizades/status/${currentUser.id}/${user.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setFriendStatus(data.status);
          } else {
            setFriendStatus('none');
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    if (currentUser.id !== user.id) {
      checkFriendship();
    }
  }, [currentUser.id, user.id]);

  const handleAddFriend = async () => {
    console.log("Adding friend:", user.id, "Current user:", currentUser.id);
    setLoading(true);
    try {
      const res = await fetch('/api/amizades/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: currentUser.id, amigo_id: user.id }),
      });
      console.log("Add friend response:", res);
      if (res.ok) {
        setFriendStatus('pendente');
        alert('Solicitação de amizade enviada!');
      } else {
        const errData = await res.json();
        console.error("Error adding friend:", errData);
        alert(`Erro ao enviar solicitação: ${errData.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[#0A240A] border border-[#1A3A1A] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="h-32 bg-[#0D2D0D] relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-[#39FF14]/10 rounded-full text-[#818384] hover:text-[#39FF14] transition-colors z-10">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="px-6 pb-6 -mt-16 flex flex-col items-center relative z-0">
          <div className="w-32 h-32 rounded-full bg-[#051A05] border-4 border-[#0A240A] flex items-center justify-center overflow-hidden mb-4 shadow-lg">
            {user.foto_perfil ? (
              <img src={user.foto_perfil} alt={user.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-[#0D2D0D] flex items-center justify-center text-[#39FF14] text-4xl font-bold">
                {user.nome?.[0] || '?'}
              </div>
            )}
          </div>

          <h2 className="text-xl font-bold text-white mb-1">{user.nome}</h2>
          <p className="text-xs text-[#39FF14] font-mono uppercase tracking-widest mb-4">{user.codigo_interno}</p>

          <div className="w-full space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0D2D0D] p-3 rounded-lg border border-[#1A3A1A]">
                <p className="text-[10px] text-[#818384] uppercase font-bold mb-1">Posto/Graduação</p>
                <p className="text-sm text-white font-bold">{user.posto_graduacao || '-'}</p>
              </div>
              <div className="bg-[#0D2D0D] p-3 rounded-lg border border-[#1A3A1A]">
                <p className="text-[10px] text-[#818384] uppercase font-bold mb-1">OM</p>
                <p className="text-sm text-white font-bold">{user.organizacao_militar || '-'}</p>
              </div>
            </div>
            
            <div className="bg-[#0D2D0D] p-3 rounded-lg border border-[#1A3A1A]">
              <p className="text-[10px] text-[#818384] uppercase font-bold mb-1">Função</p>
              <p className="text-sm text-white font-bold">{user.funcao || '-'}</p>
            </div>

            <div className="bg-[#0D2D0D] p-3 rounded-lg border border-[#1A3A1A]">
              <p className="text-[10px] text-[#818384] uppercase font-bold mb-1">Especialidade</p>
              <p className="text-sm text-white font-bold">{user.conhecimento_material || '-'}</p>
            </div>
          </div>

          {currentUser.id !== user.id && (
            <div className="w-full">
              {friendStatus === 'aceito' ? (
                <div className="w-full py-2 bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] rounded-lg flex items-center justify-center gap-2 font-bold uppercase text-xs">
                  <Check className="w-4 h-4" />
                  Amigo
                </div>
              ) : friendStatus === 'pendente' ? (
                <div className="w-full py-2 bg-[#818384]/10 border border-[#818384]/30 text-[#818384] rounded-lg flex items-center justify-center gap-2 font-bold uppercase text-xs">
                  <Clock className="w-4 h-4" />
                  Solicitação Enviada
                </div>
              ) : (
                <button
                  onClick={handleAddFriend}
                  disabled={loading}
                  className="w-full py-2 bg-[#39FF14] hover:bg-[#32E612] text-[#051A05] rounded-lg flex items-center justify-center gap-2 font-bold uppercase text-xs transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Adicionar Amigo
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
