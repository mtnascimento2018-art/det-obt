import React, { useState, useEffect, useRef } from 'react';
import { Search, Send, Paperclip, Image as ImageIcon, Loader2, User, ArrowLeft, MessageSquare, PlusCircle, X, Share2, UserPlus, Check, UserCheck, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Usuario, Conversa, MensagemChat } from '../types';

interface AmizadePendente extends Usuario {
  amizade_id: number;
}

interface ChatProps {
  user: Usuario;
}

export default function Chat({ user }: ChatProps) {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [activeConversa, setActiveConversa] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgText, setMsgText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<{ name: string, data: string, type: string }[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchUser, setSearchUser] = useState('');
  const [usersList, setUsersList] = useState<Usuario[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [activeTab, setActiveTab] = useState<'mensagens' | 'amigos'>('mensagens');
  const [amigos, setAmigos] = useState<Usuario[]>([]);
  const [pendentes, setPendentes] = useState<AmizadePendente[]>([]);
  const [friendStatuses, setFriendStatuses] = useState<Record<number, any>>({});
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    fetchConversas();
    fetchAmigos();
    fetchPendentes();
    connectWS();
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const fetchAmigos = async () => {
    try {
      const res = await fetch(`/api/amigos/${user.id}`);
      if (res.ok) setAmigos(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPendentes = async () => {
    try {
      const res = await fetch(`/api/amizades/pendentes/${user.id}`);
      if (res.ok) setPendentes(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const checkFriendStatus = async (targetId: number) => {
    try {
      const res = await fetch(`/api/amizades/status/${user.id}/${targetId}`);
      if (res.ok) {
        const status = await res.json();
        setFriendStatuses(prev => ({ ...prev, [targetId]: status }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddFriend = async (targetId: number) => {
    try {
      const res = await fetch('/api/amizades/solicitar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: user.id, amigo_id: targetId }),
      });
      if (res.ok) {
        checkFriendStatus(targetId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRespondFriend = async (amizadeId: number, aceitar: boolean) => {
    try {
      const res = await fetch('/api/amizades/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amizade_id: amizadeId, aceitar, usuario_id: user.id }),
      });
      if (res.ok) {
        fetchAmigos();
        fetchPendentes();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeConversa) {
      fetchMensagens(activeConversa.id);
    }
  }, [activeConversa]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  const connectWS = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'auth', userId: user.id }));
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat_message') {
        const msg = data.data as MensagemChat;
        if (activeConversa && msg.conversa_id === activeConversa.id) {
          setMensagens(prev => [...prev, msg]);
        }
        fetchConversas(); // Refresh list to show last message
      }
    };

    ws.current = socket;
  };

  const fetchConversas = async () => {
    try {
      const res = await fetch(`/api/conversas/${user.id}`);
      if (res.ok) setConversas(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMensagens = async (cid: number) => {
    try {
      const res = await fetch(`/api/mensagens/${cid}`);
      if (res.ok) setMensagens(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgText.trim() && selectedFiles.length === 0 && !activeConversa) return;

    setSending(true);
    try {
      const res = await fetch('/api/mensagens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversa_id: activeConversa?.id || null,
          remetente_id: user.id,
          texto: msgText,
          arquivo_url: selectedFiles.length > 0 ? JSON.stringify(selectedFiles) : null,
          destinatario_id: activeConversa?.id === 0 ? activeConversa.usuario2_id : (activeConversa ? null : usersList.find(u => u.codigo_interno === searchUser)?.id)
        }),
      });

      if (res.ok) {
        const msg = await res.json();
        setMensagens(prev => [...prev, msg]);
        setMsgText('');
        setSelectedFiles([]);
        if (!activeConversa || activeConversa.id === 0) {
          fetchConversas();
          setShowNewChat(false);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const newFiles: { name: string, data: string, type: string }[] = [];
    
    for (const file of files) {
      const reader = new FileReader();
      const promise = new Promise<void>((resolve) => {
        reader.onloadend = () => {
          newFiles.push({
            name: file.name,
            data: reader.result as string,
            type: file.type
          });
          resolve();
        };
      });
      reader.readAsDataURL(file);
      await promise;
    }
    
    setSelectedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startNewChat = async (targetUser: Usuario) => {
    // Check if conversation exists
    const existing = conversas.find(c => c.usuario1_id === targetUser.id || c.usuario2_id === targetUser.id);
    if (existing) {
      setActiveConversa(existing);
    } else {
      // Create a "virtual" conversation object until first message is sent
      setActiveConversa({
        id: 0,
        usuario1_id: user.id,
        usuario2_id: targetUser.id,
        u1_nome: user.nome,
        u1_codigo: user.codigo_interno,
        u2_nome: targetUser.nome,
        u2_codigo: targetUser.codigo_interno,
        data_ultima_mensagem: new Date().toISOString()
      });
    }
    setShowNewChat(false);
  };

  const fetchUsers = async (q: string) => {
    if (q.length < 2) {
      setUsersList([]);
      return;
    }
    try {
      const res = await fetch(`/api/users?q=${q}`);
      if (res.ok) {
        const filtered = await res.json() as Usuario[];
        setUsersList(filtered.filter(u => u.id !== user.id));
        // Check friend status for each found user
        filtered.forEach(u => {
          if (u.id !== user.id) checkFriendStatus(u.id);
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-[calc(100vh-12rem)] flex bg-[#0A240A] border border-[#1A3A1A] rounded-lg overflow-hidden">
      {/* Sidebar */}
      <div className={`w-full md:w-80 border-r border-[#1A3A1A] flex flex-col ${activeConversa ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-[#1A3A1A] flex items-center justify-between">
          <h2 className="font-bold text-[#39FF14]">Detetive Obtenção Chat</h2>
          <button 
            onClick={() => setShowNewChat(true)}
            className="p-1.5 bg-[#39FF14] text-[#051A05] rounded-full hover:bg-white transition-colors"
          >
            <PlusCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-[#1A3A1A]">
          <button 
            onClick={() => setActiveTab('mensagens')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${activeTab === 'mensagens' ? 'text-[#39FF14] border-b-2 border-[#39FF14]' : 'text-[#818384] hover:text-white'}`}
          >
            Mensagens
          </button>
          <button 
            onClick={() => setActiveTab('amigos')}
            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'amigos' ? 'text-[#39FF14] border-b-2 border-[#39FF14]' : 'text-[#818384] hover:text-white'}`}
          >
            Amigos
            {pendentes.length > 0 && (
              <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'mensagens' ? (
            conversas.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#818384]">Nenhuma conversa iniciada.</div>
            ) : (
              conversas.map(c => {
                const otherName = c.usuario1_id === user.id ? c.u2_nome : c.u1_nome;
                const otherCode = c.usuario1_id === user.id ? c.u2_codigo : c.u1_codigo;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveConversa(c)}
                    className={`w-full p-4 flex items-center gap-3 border-b border-[#1A3A1A] hover:bg-[#39FF14]/5 transition-colors text-left ${activeConversa?.id === c.id ? 'bg-[#39FF14]/10' : ''}`}
                  >
                    <div className="w-10 h-10 bg-[#0D2D0D] rounded-full flex items-center justify-center text-[#39FF14] font-bold">
                      {otherName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <p className="font-bold text-sm truncate">{otherName}</p>
                        <span className="text-[10px] text-[#818384]">{new Date(c.data_ultima_mensagem).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-[#818384] truncate">{c.ultima_mensagem || 'Inicie a conversa...'}</p>
                    </div>
                  </button>
                );
              })
            )
          ) : (
            <div className="space-y-1">
              {pendentes.length > 0 && (
                <div className="p-4 bg-[#39FF14]/5 border-b border-[#1A3A1A]">
                  <p className="text-[10px] font-bold text-[#39FF14] uppercase mb-3">Solicitações Pendentes</p>
                  <div className="space-y-3">
                    {pendentes.map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 bg-[#0D2D0D] rounded-full flex items-center justify-center text-[#39FF14] text-xs font-bold">
                            {p.nome[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{p.nome}</p>
                            <p className="text-[10px] text-[#818384] font-mono">{p.codigo_interno}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleRespondFriend(p.amizade_id, true)}
                            className="p-1.5 bg-[#39FF14] text-[#051A05] rounded-full hover:bg-white transition-colors"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => handleRespondFriend(p.amizade_id, false)}
                            className="p-1.5 bg-red-500/20 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="p-4">
                <p className="text-[10px] font-bold text-[#818384] uppercase mb-3">Seus Amigos ({amigos.length})</p>
                {amigos.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#818384]">Você ainda não tem amigos adicionados.</div>
                ) : (
                  <div className="space-y-2">
                    {amigos.map(a => (
                      <button
                        key={a.id}
                        onClick={() => startNewChat(a)}
                        className="w-full p-3 flex items-center gap-3 bg-[#0D2D0D] border border-[#1A3A1A] rounded-lg hover:border-[#39FF14]/50 transition-all text-left group"
                      >
                        <div className="w-10 h-10 bg-[#1A3A1A] rounded-full flex items-center justify-center text-[#39FF14] font-bold group-hover:bg-[#39FF14] group-hover:text-[#051A05] transition-colors">
                          {a.nome[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{a.nome}</p>
                          <p className="text-[10px] text-[#818384] font-mono uppercase">{a.codigo_interno}</p>
                        </div>
                        <MessageSquare className="w-4 h-4 text-[#818384] group-hover:text-[#39FF14]" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className={`flex-1 flex flex-col ${!activeConversa ? 'hidden md:flex' : 'flex'}`}>
        {activeConversa ? (
          <>
            <div className="p-4 border-b border-[#1A3A1A] flex items-center gap-4 bg-[#0D2D0D]">
              <button onClick={() => setActiveConversa(null)} className="md:hidden p-1">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-10 h-10 bg-[#1A3A1A] rounded-full flex items-center justify-center text-[#39FF14] font-bold">
                {(activeConversa.usuario1_id === user.id ? activeConversa.u2_nome : activeConversa.u1_nome)[0]}
              </div>
              <div>
                <p className="font-bold text-sm">{activeConversa.usuario1_id === user.id ? activeConversa.u2_nome : activeConversa.u1_nome}</p>
                <p className="text-[10px] text-[#39FF14] font-mono uppercase tracking-widest">
                  {activeConversa.usuario1_id === user.id ? activeConversa.u2_codigo : activeConversa.u1_codigo}
                </p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#051A05]/50">
              {mensagens.map(m => (
                <div key={m.id} className={`flex ${m.remetente_id === user.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-lg text-sm ${m.remetente_id === user.id ? 'bg-[#39FF14] text-[#051A05] rounded-tr-none' : 'bg-[#1A3A1A] text-white rounded-tl-none'}`}>
                    {m.texto && <p>{m.texto}</p>}
                    {m.arquivo_url && (
                      <div className="mt-2 space-y-2">
                        {(() => {
                          let files: { name: string, data: string, type: string }[] = [];
                          try {
                            if (m.arquivo_url.startsWith('[')) {
                              files = JSON.parse(m.arquivo_url);
                            } else {
                              files = [{ name: 'Anexo', data: m.arquivo_url, type: m.arquivo_url.startsWith('data:image/') ? 'image/png' : 'application/octet-stream' }];
                            }
                          } catch (e) {
                            files = [{ name: 'Anexo', data: m.arquivo_url, type: m.arquivo_url.startsWith('data:image/') ? 'image/png' : 'application/octet-stream' }];
                          }

                          return files.map((file, idx) => (
                            <div key={idx}>
                              {file.type.startsWith('image/') || file.data.startsWith('data:image/') ? (
                                <div className="relative group">
                                  <img 
                                    src={file.data} 
                                    alt={file.name} 
                                    className="rounded border border-white/10 max-h-48 object-contain cursor-pointer"
                                    onClick={() => window.open(file.data, '_blank')}
                                  />
                                  <a 
                                    href={file.data} 
                                    download={file.name}
                                    className="absolute top-1 right-1 p-1.5 bg-black/50 hover:bg-black/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Share2 className="w-3 h-3 text-white" />
                                  </a>
                                </div>
                              ) : (
                                <a 
                                  href={file.data} 
                                  download={file.name}
                                  className="flex items-center gap-2 p-2 bg-black/20 rounded border border-white/10 hover:bg-black/40 transition-colors group"
                                >
                                  <Paperclip className="w-4 h-4 text-[#39FF14]" />
                                  <span className="text-xs truncate max-w-[150px]">{file.name}</span>
                                  <Share2 className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                                </a>
                              )}
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                    <p className={`text-[10px] mt-1 ${m.remetente_id === user.id ? 'text-[#051A05]/60' : 'text-[#818384]'}`}>
                      {new Date(m.data_envio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-[#1A3A1A] bg-[#0D2D0D] space-y-3">
              {selectedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-1.5 bg-[#1A1A1B] border border-[#39FF14]/30 rounded-lg max-w-[200px]">
                      {file.type.startsWith('image/') ? (
                        <img src={file.data} className="w-6 h-6 object-cover rounded" alt="Preview" />
                      ) : (
                        <div className="w-6 h-6 bg-red-500/20 rounded flex items-center justify-center text-red-500">
                          <Paperclip className="w-3 h-3" />
                        </div>
                      )}
                      <p className="text-[9px] font-bold text-white truncate flex-1">{file.name}</p>
                      <button 
                        onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} 
                        className="p-1 hover:bg-red-500/20 rounded-full text-red-500"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx"
                  multiple
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-[#818384] hover:text-[#39FF14] transition-colors"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 bg-[#1A3A1A] border border-[#1A3A1A] rounded-full px-4 py-2 text-sm focus:outline-none focus:border-[#39FF14]"
                />
                <button 
                  type="submit" 
                  disabled={sending || (!msgText.trim() && selectedFiles.length === 0)}
                  className="p-2 bg-[#39FF14] text-[#051A05] rounded-full hover:bg-white transition-colors disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[#818384] gap-4">
            <div className="w-20 h-20 bg-[#1A3A1A] rounded-full flex items-center justify-center">
              <MessageSquare className="w-10 h-10" />
            </div>
            <p className="text-sm">Selecione uma conversa para começar</p>
            <button 
              onClick={() => setShowNewChat(true)}
              className="reddit-button-secondary text-xs"
            >
              Nova Conversa
            </button>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <AnimatePresence>
        {showNewChat && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1A1A1B] border border-[#343536] rounded-lg w-full max-w-md"
            >
              <div className="p-4 border-b border-[#343536] flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#39FF14]">Nova Conversa</h2>
                <button onClick={() => setShowNewChat(false)} className="p-1 hover:bg-[#39FF14]/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#818384]" />
                  <input
                    type="text"
                    placeholder="Pesquisar por nome, código ou OM..."
                    onChange={(e) => fetchUsers(e.target.value)}
                    className="w-full reddit-input reddit-input-search py-2"
                  />
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-[#343536] custom-scrollbar">
                  {usersList.map(u => (
                    <div
                      key={u.id}
                      className="w-full p-4 flex items-center justify-between hover:bg-[#39FF14]/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#0D2D0D] rounded-full flex items-center justify-center text-[#39FF14] font-bold">
                          {u.nome[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{u.nome}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] text-[#39FF14] font-mono uppercase">{u.codigo_interno}</span>
                            <span className="text-[10px] text-[#818384]">•</span>
                            <span className="text-[10px] text-[#818384] uppercase font-bold">{u.organizacao_militar}</span>
                            <span className="text-[10px] text-[#818384]">•</span>
                            <span className="text-[10px] text-[#818384] uppercase font-bold">{u.funcao}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startNewChat(u)}
                          className="px-3 py-1.5 bg-[#39FF14]/10 text-[#39FF14] hover:bg-[#39FF14] hover:text-[#051A05] rounded-full text-[10px] font-bold uppercase transition-all flex items-center gap-1"
                        >
                          <MessageSquare className="w-3 h-3" />
                          Mensagem
                        </button>
                        
                        {friendStatuses[u.id]?.status === 'aceito' ? (
                          <div className="px-3 py-1.5 bg-[#39FF14]/20 text-[#39FF14] rounded-full text-[10px] font-bold uppercase flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            Amigo
                          </div>
                        ) : friendStatuses[u.id]?.status === 'pendente' ? (
                          <div className="px-3 py-1.5 bg-[#818384]/20 text-[#818384] rounded-full text-[10px] font-bold uppercase flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Pendente
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddFriend(u.id)}
                            className="px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-full text-[10px] font-bold uppercase transition-all flex items-center gap-1"
                          >
                            <UserPlus className="w-3 h-3" />
                            Adicionar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {usersList.length === 0 && (
                    <div className="py-10 text-center space-y-2">
                      <User className="w-8 h-8 text-[#818384] mx-auto opacity-20" />
                      <p className="text-xs text-[#818384]">Pesquise militares para iniciar uma conversa</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
