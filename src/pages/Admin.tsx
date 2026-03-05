import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Search, Shield, ShieldAlert, ShieldCheck, Loader2, X, Check, Settings, Plus, Anchor, Briefcase, BookOpen, History, Download, Filter, UserMinus, UserCheck, Edit2, BarChart3, PieChart, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Usuario, AuditoriaLog } from '../types';

type Tab = 'usuarios' | 'configuracoes' | 'auditoria' | 'estatisticas';

export default function Admin({ user }: { user: Usuario }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('usuarios');
  const [users, setUsers] = useState<Usuario[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditoriaLog[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedStatType, setSelectedStatType] = useState('oms_abertos');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);

  // Audit Filters
  const [auditFilter, setAuditFilter] = useState({
    nome: '',
    acao: '',
    om: ''
  });

  // Config Lists State
  const [oms, setOms] = useState<{id: number, nome: string}[]>([]);
  const [funcoes, setFuncoes] = useState<{id: number, nome: string}[]>([]);
  const [conhecimentos, setConhecimentos] = useState<{id: number, nome: string}[]>([]);
  const [classificacoes, setClassificacoes] = useState<{id: number, nome: string}[]>([]);
  const [newConfigItem, setNewConfigItem] = useState({ type: 'oms', nome: '' });
  const [configLoading, setConfigLoading] = useState(false);

  // New User State
  const [newUser, setNewUser] = useState({
    nome: '', // Nome de Guerra
    nome_completo: '',
    posto_graduacao: '',
    codigo_interno: '', // NIP
    organizacao_militar: '',
    funcao: '',
    conhecimento_material: '',
    perfil: 'usuario' as 'usuario' | 'obtencao' | 'admin'
  });

  const [showOtherOm, setShowOtherOm] = useState(false);
  const [showOtherFuncao, setShowOtherFuncao] = useState(false);
  const [showOtherConhecimento, setShowOtherConhecimento] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUsers();
      fetchConfigs();
      fetchAuditLogs();
      fetchStats();
    }
  }, [isAuthenticated]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/auditoria');
      if (res.ok) setAuditLogs(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === 'admin1234') {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Senha errada.');
    }
  };

  const fetchConfigs = async () => {
    setConfigLoading(true);
    try {
      const [omsRes, funcoesRes, conhecimentosRes, classificacoesRes] = await Promise.all([
        fetch('/api/config/oms'),
        fetch('/api/config/funcoes'),
        fetch('/api/config/conhecimentos'),
        fetch('/api/config/classificacoes')
      ]);
      if (omsRes.ok) setOms(await omsRes.json());
      if (funcoesRes.ok) setFuncoes(await funcoesRes.json());
      if (conhecimentosRes.ok) setConhecimentos(await conhecimentosRes.json());
      if (classificacoesRes.ok) setClassificacoes(await classificacoesRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleAddConfigItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConfigItem.nome.trim()) return;
    try {
      const res = await fetch(`/api/config/${newConfigItem.type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: newConfigItem.nome })
      });
      if (res.ok) {
        setNewConfigItem({ ...newConfigItem, nome: '' });
        fetchConfigs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteConfigItem = async (type: string, id: number) => {
    if (!confirm('Excluir este item?')) return;
    try {
      const res = await fetch(`/api/config/${type}/${id}`, { method: 'DELETE' });
      if (res.ok) fetchConfigs();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) setUsers(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newUser, admin_id: user.id })
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewUser({ 
          nome: '', 
          nome_completo: '', 
          posto_graduacao: '', 
          codigo_interno: '', 
          organizacao_militar: '', 
          funcao: '', 
          conhecimento_material: '', 
          perfil: 'usuario' 
        });
        setShowOtherOm(false);
        setShowOtherFuncao(false);
        setShowOtherConhecimento(false);
        fetchUsers();
        fetchConfigs();
        fetchAuditLogs();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao adicionar usuário');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingUser, admin_id: user.id })
      });
      
      const safeJson = async (r: Response) => {
        const text = await r.text();
        try { return JSON.parse(text); } catch (e) { return { error: text || 'Erro desconhecido' }; }
      };

      if (res.ok) {
        setShowEditModal(false);
        setEditingUser(null);
        fetchUsers();
        fetchAuditLogs();
      } else {
        const data = await safeJson(res);
        alert(data.error || 'Erro ao atualizar usuário');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao atualizar usuário');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleUserStatus = async (targetUser: Usuario) => {
    const newStatus = targetUser.ativo === 0 ? 1 : 0;
    const action = newStatus === 1 ? 'ativar' : 'desativar';
    if (!confirm(`Deseja ${action} este usuário?`)) return;
    
    try {
      const res = await fetch(`/api/users/${targetUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...targetUser, ativo: newStatus, admin_id: user.id })
      });
      if (res.ok) {
        fetchUsers();
        fetchAuditLogs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredUsers = users.filter(u => 
    u.nome.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.codigo_interno.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.organizacao_militar.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesNome = log.nome_guerra?.toLowerCase().includes(auditFilter.nome.toLowerCase()) ?? false;
    const matchesAcao = log.acao?.toLowerCase().includes(auditFilter.acao.toLowerCase()) ?? false;
    const matchesOM = log.organizacao_militar?.toLowerCase().includes(auditFilter.om.toLowerCase()) ?? false;
    return matchesNome && matchesAcao && matchesOM;
  });

  const exportAuditToCSV = () => {
    const headers = ['Data/Hora', 'Nome de Guerra', 'Perfil', 'OM', 'Ação', 'Descrição', 'Objeto'];
    const rows = filteredAuditLogs.map(log => [
      new Date(log.data_hora).toLocaleString(),
      log.nome_guerra,
      log.perfil,
      log.organizacao_militar,
      log.acao,
      log.descricao,
      log.objeto_afetado || ''
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `auditoria_obtenção_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0A240A] border border-[#1A3A1A] p-8 rounded-2xl shadow-2xl w-full max-w-md text-center"
        >
          <ShieldAlert className="w-16 h-16 text-[#39FF14] mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Acesso Restrito</h2>
          <p className="text-sm text-[#818384] mb-6">Digite a senha administrativa para acessar o painel de controle.</p>
          <form onSubmit={handleAdminAuth} className="space-y-4">
            <input 
              type="password" 
              value={adminPassword}
              onChange={(e) => {
                setAdminPassword(e.target.value);
                setAuthError('');
              }}
              placeholder="Senha Admin"
              className="w-full reddit-input text-center text-xl tracking-[0.5em]"
              autoFocus
            />
            {authError && <p className="text-red-500 text-xs font-bold">{authError}</p>}
            <button type="submit" className="w-full reddit-button-primary py-3">
              Autenticar
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#39FF14] flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Painel Administrativo
          </h1>
          <p className="text-sm text-[#818384]">Gerencie usuários, configurações e auditoria do sistema.</p>
        </div>
        <div className="flex bg-[#0D2D0D] p-1 rounded-lg border border-[#1A3A1A] overflow-x-auto">
          <button 
            onClick={() => setActiveTab('usuarios')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'usuarios' ? 'bg-[#39FF14] text-[#051A05]' : 'text-[#818384] hover:text-[#39FF14]'}`}
          >
            <Users className="w-4 h-4" />
            Usuários
          </button>
          <button 
            onClick={() => setActiveTab('configuracoes')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'configuracoes' ? 'bg-[#39FF14] text-[#051A05]' : 'text-[#818384] hover:text-[#39FF14]'}`}
          >
            <Settings className="w-4 h-4" />
            Listas
          </button>
          <button 
            onClick={() => setActiveTab('auditoria')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'auditoria' ? 'bg-[#39FF14] text-[#051A05]' : 'text-[#818384] hover:text-[#39FF14]'}`}
          >
            <History className="w-4 h-4" />
            Auditoria
          </button>
          <button 
            onClick={() => setActiveTab('estatisticas')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'estatisticas' ? 'bg-[#39FF14] text-[#051A05]' : 'text-[#818384] hover:text-[#39FF14]'}`}
          >
            <BarChart3 className="w-4 h-4" />
            Estatísticas
          </button>
        </div>
      </div>

      {activeTab === 'usuarios' ? (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddModal(true)}
              className="reddit-button-primary flex items-center justify-center gap-2 py-2 px-6"
            >
              <UserPlus className="w-5 h-5" />
              <span>Novo Usuário</span>
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#818384]" />
            <input
              type="text"
              placeholder="Pesquisar por nome, código ou OM..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full reddit-input reddit-input-search h-11"
            />
          </div>

          <div className="reddit-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-[#0D2D0D] border-b border-[#1A3A1A]">
                      <th className="px-6 py-4 text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">Militar</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">NIP</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">OM</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">Perfil</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-[#39FF14] uppercase tracking-widest text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1A3A1A]">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-20 text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-[#39FF14] mx-auto mb-2" />
                          <span className="text-sm text-[#818384]">Carregando usuários...</span>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-20 text-center text-sm text-[#818384]">
                          Nenhum usuário encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map(u => (
                        <tr key={u.id} className={`hover:bg-[#39FF14]/5 transition-colors ${u.ativo === 0 ? 'opacity-50 grayscale' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {u.foto_perfil ? (
                                <img src={u.foto_perfil} alt={u.nome} className="w-8 h-8 rounded-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-8 h-8 bg-[#0D2D0D] rounded-full flex items-center justify-center text-[#39FF14] font-bold text-xs">
                                  {u.nome?.[0] || '?'}
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-white">{u.nome}</span>
                                <span className="text-[9px] text-[#818384] uppercase">{u.posto_graduacao}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-[#39FF14] uppercase">{u.codigo_interno}</td>
                          <td className="px-6 py-4 text-xs text-[#818384]">{u.organizacao_militar}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 w-fit ${
                              u.perfil === 'admin' ? 'bg-red-500/20 text-red-500' :
                              u.perfil === 'obtencao' ? 'bg-blue-500/20 text-blue-500' :
                              u.perfil === 'catalogacao' ? 'bg-purple-500/20 text-purple-500' :
                              u.perfil === 'diretoria' ? 'bg-yellow-500/20 text-yellow-500' :
                              u.perfil === 'especialista' ? 'bg-orange-500/20 text-orange-500' :
                              'bg-[#39FF14]/20 text-[#39FF14]'
                            }`}>
                              {u.perfil === 'admin' ? <ShieldAlert className="w-3 h-3" /> : 
                               u.perfil === 'obtencao' ? <ShieldCheck className="w-3 h-3" /> : 
                               u.perfil === 'catalogacao' ? <BookOpen className="w-3 h-3" /> :
                               u.perfil === 'diretoria' ? <Anchor className="w-3 h-3" /> :
                               u.perfil === 'especialista' ? <Sparkles className="w-3 h-3" /> :
                               <Users className="w-3 h-3" />}
                              {u.perfil}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => toggleUserStatus(u)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase transition-all ${
                                u.ativo === 0 ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'bg-[#39FF14]/10 text-[#39FF14] hover:bg-[#39FF14]/20'
                              }`}
                            >
                              {u.ativo === 0 ? <UserMinus className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
                              {u.ativo === 0 ? 'Inativo' : 'Ativo'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingUser(u);
                                  setShowEditModal(true);
                                }}
                                className="p-2 hover:bg-[#39FF14]/10 rounded-full text-[#818384] hover:text-[#39FF14] transition-colors"
                                title="Editar Usuário"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
              </table>
            </div>
          </div>
        </>
      ) : activeTab === 'configuracoes' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* OMs Section */}
          <div className="reddit-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#39FF14] flex items-center gap-2 uppercase tracking-widest">
                <Anchor className="w-4 h-4" />
                Organizações (OM)
              </h3>
            </div>
            <form onSubmit={handleAddConfigItem} className="flex gap-2">
              <input 
                type="text" 
                value={newConfigItem.type === 'oms' ? newConfigItem.nome : ''}
                onChange={(e) => setNewConfigItem({ type: 'oms', nome: e.target.value })}
                placeholder="Nova OM..."
                className="flex-1 reddit-input text-xs py-2"
              />
              <button 
                type="submit" 
                onClick={() => setNewConfigItem({ ...newConfigItem, type: 'oms' })}
                className="p-2 bg-[#39FF14] text-[#051A05] rounded-lg hover:bg-[#39FF14]/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {oms.map(o => (
                <div key={o.id} className="flex items-center justify-between p-2 bg-[#0D2D0D] border border-[#1A3A1A] rounded-lg group">
                  <span className="text-xs text-white">{o.nome}</span>
                  <button onClick={() => handleDeleteConfigItem('oms', o.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-500/10 rounded transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Funções Section */}
          <div className="reddit-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#39FF14] flex items-center gap-2 uppercase tracking-widest">
                <Briefcase className="w-4 h-4" />
                Funções
              </h3>
            </div>
            <form onSubmit={handleAddConfigItem} className="flex gap-2">
              <input 
                type="text" 
                value={newConfigItem.type === 'funcoes' ? newConfigItem.nome : ''}
                onChange={(e) => setNewConfigItem({ type: 'funcoes', nome: e.target.value })}
                placeholder="Nova Função..."
                className="flex-1 reddit-input text-xs py-2"
              />
              <button 
                type="submit" 
                onClick={() => setNewConfigItem({ ...newConfigItem, type: 'funcoes' })}
                className="p-2 bg-[#39FF14] text-[#051A05] rounded-lg hover:bg-[#39FF14]/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {funcoes.map(f => (
                <div key={f.id} className="flex items-center justify-between p-2 bg-[#0D2D0D] border border-[#1A3A1A] rounded-lg group">
                  <span className="text-xs text-white">{f.nome}</span>
                  <button onClick={() => handleDeleteConfigItem('funcoes', f.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-500/10 rounded transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Conhecimentos Section */}
          <div className="reddit-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#39FF14] flex items-center gap-2 uppercase tracking-widest">
                <BookOpen className="w-4 h-4" />
                Especialidades
              </h3>
            </div>
            <form onSubmit={handleAddConfigItem} className="flex gap-2">
              <input 
                type="text" 
                value={newConfigItem.type === 'conhecimentos' ? newConfigItem.nome : ''}
                onChange={(e) => setNewConfigItem({ type: 'conhecimentos', nome: e.target.value })}
                placeholder="Novo Conhecimento..."
                className="flex-1 reddit-input text-xs py-2"
              />
              <button 
                type="submit" 
                onClick={() => setNewConfigItem({ ...newConfigItem, type: 'conhecimentos' })}
                className="p-2 bg-[#39FF14] text-[#051A05] rounded-lg hover:bg-[#39FF14]/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {conhecimentos.map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 bg-[#0D2D0D] border border-[#1A3A1A] rounded-lg group">
                  <span className="text-xs text-white">{c.nome}</span>
                  <button onClick={() => handleDeleteConfigItem('conhecimentos', c.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-500/10 rounded transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          {/* Classificações Section */}
          <div className="reddit-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#39FF14] flex items-center gap-2 uppercase tracking-widest">
                <Filter className="w-4 h-4" />
                Classificações
              </h3>
            </div>
            <form onSubmit={handleAddConfigItem} className="flex gap-2">
              <input 
                type="text" 
                value={newConfigItem.type === 'classificacoes' ? newConfigItem.nome : ''}
                onChange={(e) => setNewConfigItem({ type: 'classificacoes', nome: e.target.value })}
                placeholder="Nova Classificação..."
                className="flex-1 reddit-input text-xs py-2"
              />
              <button 
                type="submit" 
                onClick={() => setNewConfigItem({ ...newConfigItem, type: 'classificacoes' })}
                className="p-2 bg-[#39FF14] text-[#051A05] rounded-lg hover:bg-[#39FF14]/80 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {classificacoes.map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 bg-[#0D2D0D] border border-[#1A3A1A] rounded-lg group">
                  <span className="text-xs text-white">{c.nome}</span>
                  <button onClick={() => handleDeleteConfigItem('classificacoes', c.id)} className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-500/10 rounded transition-all">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'estatisticas' ? (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-[#0A240A] p-4 rounded-lg border border-[#1A3A1A]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#39FF14]/10 rounded-lg text-[#39FF14]">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Métricas do Sistema</h3>
                <p className="text-[10px] text-[#818384]">Visualize o desempenho e engajamento da comunidade</p>
              </div>
            </div>
            <select
              value={selectedStatType}
              onChange={(e) => setSelectedStatType(e.target.value)}
              className="reddit-input text-xs min-w-[250px]"
            >
              <option value="oms_abertos">OM com mais chamados abertos</option>
              <option value="oms_resolvidos">OM com mais chamados resolvidos</option>
              <option value="itens_comentarios">Itens com mais comentários</option>
              <option value="itens_aplicacao">Aplicações mais frequentes</option>
              <option value="itens_fornecedores">Itens com mais fornecedores</option>
            </select>
          </div>

          <div className="reddit-card p-6 min-h-[400px]">
            {stats && stats[selectedStatType] ? (
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats[selectedStatType]}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1A3A1A" horizontal={false} />
                    <XAxis type="number" stroke="#818384" fontSize={10} />
                    <YAxis 
                      dataKey="label" 
                      type="category" 
                      stroke="#818384" 
                      fontSize={10} 
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0A240A', border: '1px solid #1A3A1A', borderRadius: '8px' }}
                      itemStyle={{ color: '#39FF14', fontSize: '12px' }}
                      labelStyle={{ color: '#818384', fontSize: '10px', marginBottom: '4px' }}
                    />
                    <Bar dataKey="value" fill="#39FF14" radius={[0, 4, 4, 0]}>
                      {stats[selectedStatType].map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#39FF14' : '#39FF14/60'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-20 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-[#39FF14]" />
                <p className="text-[#818384]">Carregando estatísticas...</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0A240A] border border-[#1A3A1A] p-4 rounded-lg">
              <p className="text-[10px] text-[#818384] uppercase font-bold mb-1">Total de Usuários</p>
              <p className="text-2xl font-black text-white">{users.length}</p>
            </div>
            <div className="bg-[#0A240A] border border-[#1A3A1A] p-4 rounded-lg">
              <p className="text-[10px] text-[#818384] uppercase font-bold mb-1">Logs de Auditoria</p>
              <p className="text-2xl font-black text-white">{auditLogs.length}</p>
            </div>
            <div className="bg-[#0A240A] border border-[#1A3A1A] p-4 rounded-lg">
              <p className="text-[10px] text-[#818384] uppercase font-bold mb-1">OMs Cadastradas</p>
              <p className="text-2xl font-black text-white">{oms.length}</p>
            </div>
            <div className="bg-[#0A240A] border border-[#1A3A1A] p-4 rounded-lg">
              <p className="text-[10px] text-[#818384] uppercase font-bold mb-1">Ações Recentes</p>
              <p className="text-2xl font-black text-[#39FF14]">{auditLogs.filter(l => {
                const logDate = new Date(l.data_hora);
                const today = new Date();
                return logDate.toDateString() === today.toDateString();
              }).length}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#818384]" />
              <input 
                type="text" 
                placeholder="Filtrar por nome..." 
                value={auditFilter.nome}
                onChange={(e) => setAuditFilter({...auditFilter, nome: e.target.value})}
                className="w-full reddit-input reddit-input-search"
              />
            </div>
            <div className="flex-1 relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#818384]" />
              <input 
                type="text" 
                placeholder="Filtrar por ação..." 
                value={auditFilter.acao}
                onChange={(e) => setAuditFilter({...auditFilter, acao: e.target.value})}
                className="w-full reddit-input reddit-input-search"
              />
            </div>
            <button 
              onClick={exportAuditToCSV}
              className="reddit-button-secondary flex items-center justify-center gap-2 px-6"
            >
              <Download className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>
          </div>

          <div className="reddit-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#0D2D0D] border-b border-[#1A3A1A]">
                    <th className="px-6 py-4 text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">Data/Hora</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">Militar</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">OM</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">Ação</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A3A1A]">
                  {filteredAuditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-[#39FF14]/5 transition-colors">
                      <td className="px-6 py-4 text-[10px] font-mono text-[#818384]">
                        {new Date(log.data_hora).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white">{log.nome_guerra}</span>
                          <span className="text-[9px] text-[#39FF14] uppercase">{log.perfil}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-[10px] text-[#818384]">{log.organizacao_militar}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-[#39FF14]/10 text-[#39FF14] rounded text-[9px] font-bold uppercase">
                          {log.acao}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[10px] text-[#818384] max-w-xs truncate" title={log.descricao}>
                        {log.descricao}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      <AnimatePresence>
        {showEditModal && editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0A240A] border border-[#1A3A1A] rounded-lg w-full max-w-md"
            >
              <div className="p-4 border-b border-[#1A3A1A] flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#39FF14]">Editar Usuário</h2>
                <button onClick={() => { setShowEditModal(false); setEditingUser(null); }} className="p-1 hover:bg-[#39FF14]/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleEditUser} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#818384] uppercase mb-1">Nome de Guerra</label>
                    <input
                      required
                      value={editingUser.nome}
                      onChange={(e) => setEditingUser({ ...editingUser, nome: e.target.value })}
                      className="w-full reddit-input"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#818384] uppercase mb-1">NIP (Código)</label>
                    <input
                      required
                      value={editingUser.codigo_interno}
                      onChange={(e) => setEditingUser({ ...editingUser, codigo_interno: e.target.value })}
                      className="w-full reddit-input font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#818384] uppercase mb-1">Posto/Graduação</label>
                    <input
                      value={editingUser.posto_graduacao || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, posto_graduacao: e.target.value })}
                      className="w-full reddit-input"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#818384] uppercase mb-1">Ramal</label>
                    <input
                      value={editingUser.ramal || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, ramal: e.target.value })}
                      className="w-full reddit-input"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#818384] uppercase mb-1">Organização Militar</label>
                  <select
                    value={editingUser.organizacao_militar}
                    onChange={(e) => setEditingUser({ ...editingUser, organizacao_militar: e.target.value })}
                    className="w-full reddit-input text-xs"
                  >
                    <option value="">Selecione a OM</option>
                    {oms.map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#818384] uppercase mb-1">Função</label>
                    <input
                      value={editingUser.funcao || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, funcao: e.target.value })}
                      className="w-full reddit-input"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#818384] uppercase mb-1">Perfil de Acesso</label>
                    <select
                      value={editingUser.perfil}
                      onChange={(e) => setEditingUser({ ...editingUser, perfil: e.target.value as any })}
                      className="w-full reddit-input"
                    >
                      <option value="usuario">Militar Usuário</option>
                      <option value="obtencao">Seção de Obtenção</option>
                      <option value="catalogacao">Seção de Catalogação</option>
                      <option value="diretoria">Diretoria</option>
                      <option value="especialista">Especialista</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-[#0D2D0D] rounded-lg border border-[#1A3A1A]">
                  <input 
                    type="checkbox" 
                    id="user-active"
                    checked={editingUser.ativo === 1}
                    onChange={(e) => setEditingUser({ ...editingUser, ativo: e.target.checked ? 1 : 0 })}
                    className="w-4 h-4 accent-[#39FF14]"
                  />
                  <label htmlFor="user-active" className="text-xs font-bold text-white uppercase">Usuário Ativo</label>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); setEditingUser(null); }}
                    className="reddit-button-secondary py-2 px-6"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="reddit-button-primary py-2 px-6 flex items-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Salvar Alterações</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0A240A] border border-[#1A3A1A] rounded-lg w-full max-w-md"
            >
              <div className="p-4 border-b border-[#1A3A1A] flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#39FF14]">Novo Usuário</h2>
                <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-[#39FF14]/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddUser} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#818384] uppercase mb-1">Nome Completo</label>
                    <input
                      required
                      value={newUser.nome_completo}
                      onChange={(e) => setNewUser({ ...newUser, nome_completo: e.target.value })}
                      className="w-full reddit-input"
                      placeholder="Ex: João Silva"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#818384] uppercase mb-1">Nome de Guerra</label>
                    <input
                      required
                      value={newUser.nome}
                      onChange={(e) => setNewUser({ ...newUser, nome: e.target.value })}
                      className="w-full reddit-input"
                      placeholder="Ex: Silva"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#818384] uppercase mb-1">NIP (Código)</label>
                    <input
                      required
                      value={newUser.codigo_interno}
                      onChange={(e) => setNewUser({ ...newUser, codigo_interno: e.target.value })}
                      className="w-full reddit-input font-mono"
                      placeholder="Ex: 123456"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#818384] uppercase mb-1">Posto/Graduação</label>
                    <input
                      required
                      value={newUser.posto_graduacao}
                      onChange={(e) => setNewUser({ ...newUser, posto_graduacao: e.target.value })}
                      className="w-full reddit-input"
                      placeholder="Ex: 1º Ten"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#818384] uppercase mb-1">Organização Militar</label>
                    {!showOtherOm ? (
                      <select
                        required
                        value={newUser.organizacao_militar}
                        onChange={(e) => {
                          if (e.target.value === 'outro') {
                            setShowOtherOm(true);
                            setNewUser({ ...newUser, organizacao_militar: '' });
                          } else {
                            setNewUser({ ...newUser, organizacao_militar: e.target.value });
                          }
                        }}
                        className="w-full reddit-input text-xs"
                      >
                        <option value="">Selecione a OM</option>
                        {oms.map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
                        <option value="outro" className="text-[#39FF14] font-bold">Outro...</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          required
                          value={newUser.organizacao_militar}
                          onChange={(e) => setNewUser({ ...newUser, organizacao_militar: e.target.value })}
                          className="w-full reddit-input text-xs"
                          placeholder="Digite a OM"
                        />
                        <button type="button" onClick={() => setShowOtherOm(false)} className="text-[10px] text-[#39FF14]">Voltar</button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#818384] uppercase mb-1">Função</label>
                    {!showOtherFuncao ? (
                      <select
                        required
                        value={newUser.funcao}
                        onChange={(e) => {
                          if (e.target.value === 'outro') {
                            setShowOtherFuncao(true);
                            setNewUser({ ...newUser, funcao: '' });
                          } else {
                            setNewUser({ ...newUser, funcao: e.target.value });
                          }
                        }}
                        className="w-full reddit-input text-xs"
                      >
                        <option value="">Selecione a Função</option>
                        {funcoes.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                        <option value="outro" className="text-[#39FF14] font-bold">Outro...</option>
                      </select>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          required
                          value={newUser.funcao}
                          onChange={(e) => setNewUser({ ...newUser, funcao: e.target.value })}
                          className="w-full reddit-input text-xs"
                          placeholder="Digite a Função"
                        />
                        <button type="button" onClick={() => setShowOtherFuncao(false)} className="text-[10px] text-[#39FF14]">Voltar</button>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#818384] uppercase mb-1">Conhecimento de Material</label>
                  {!showOtherConhecimento ? (
                    <select
                      required
                      value={newUser.conhecimento_material}
                      onChange={(e) => {
                        if (e.target.value === 'outro') {
                          setShowOtherConhecimento(true);
                          setNewUser({ ...newUser, conhecimento_material: '' });
                        } else {
                          setNewUser({ ...newUser, conhecimento_material: e.target.value });
                        }
                      }}
                      className="w-full reddit-input text-xs"
                    >
                      <option value="">Selecione a Especialidade</option>
                      {conhecimentos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                      <option value="outro" className="text-[#39FF14] font-bold">Outro...</option>
                    </select>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <textarea
                        required
                        value={newUser.conhecimento_material}
                        onChange={(e) => setNewUser({ ...newUser, conhecimento_material: e.target.value })}
                        className="w-full reddit-input h-20 resize-none text-xs"
                        placeholder="Descreva as especialidades..."
                      />
                      <button type="button" onClick={() => setShowOtherConhecimento(false)} className="text-[10px] text-[#39FF14] self-end">Voltar</button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#818384] uppercase mb-1">Perfil de Acesso</label>
                  <select
                    value={newUser.perfil}
                    onChange={(e) => setNewUser({ ...newUser, perfil: e.target.value as any })}
                    className="w-full reddit-input"
                  >
                    <option value="usuario">Militar Usuário</option>
                    <option value="obtencao">Seção de Obtenção</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="reddit-button-secondary py-2 px-6"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="reddit-button-primary py-2 px-6 flex items-center gap-2"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>Salvar</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
