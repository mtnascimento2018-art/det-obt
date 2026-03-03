import React, { useState, useEffect } from 'react';
import { Search, Building2, Phone, Mail, User, Calendar, Loader2, Filter, Package, Plus, X, CheckCircle, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Empresa, Usuario } from '../types';

interface EmpresasProps {
  user: Usuario;
}

export default function Empresas({ user }: EmpresasProps) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [itens, setItens] = useState<{numero_item: string, nome_item: string, classificacao?: string, meio_operacional?: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItemNum, setSelectedItemNum] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Advanced Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeios, setSelectedMeios] = useState<string[]>([]);
  const [selectedClassificacoes, setSelectedClassificacoes] = useState<string[]>([]);
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [classificacoes, setClassificacoes] = useState<{id: number, nome: string}[]>([]);

  const [newEmpresa, setNewEmpresa] = useState({
    cnpj: '',
    razao_social: '',
    telefones: ['', '', ''],
    emails: ['', '', ''],
    tipo: 'fornece' as 'fabrica' | 'fornece' | 'similar',
  });

  useEffect(() => {
    Promise.all([fetchEmpresas(), fetchItens(), fetchClassificacoes()]).finally(() => setLoading(false));
  }, []);

  const fetchClassificacoes = async () => {
    try {
      const res = await fetch('/api/config/classificacoes');
      if (res.ok) setClassificacoes(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchEmpresas = async () => {
    try {
      const response = await fetch(`/api/empresas?usuario_id=${user.id}`);
      if (response.ok) {
        setEmpresas(await response.json());
      }
    } catch (err) {
      console.error('Erro ao buscar empresas', err);
    }
  };

  const fetchItens = async () => {
    try {
      const response = await fetch('/api/itens');
      if (response.ok) {
        setItens(await response.json());
      }
    } catch (err) {
      console.error('Erro ao buscar itens', err);
    }
  };

  const handleAddEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEmpresa,
          numero_item: selectedItemNum,
          indicado_por_id: user.id,
          telefones: newEmpresa.telefones.filter(t => t.trim() !== ''),
          emails: newEmpresa.emails.filter(e => e.trim() !== '')
        })
      });
      if (res.ok) {
        setShowAddModal(false);
        setNewEmpresa({
          cnpj: '',
          razao_social: '',
          telefones: ['', '', ''],
          emails: ['', '', ''],
          tipo: 'fornece',
        });
        fetchEmpresas();
        alert('Fornecedor cadastrado com sucesso!');
      } else {
        const errorData = await res.json();
        alert(`Erro ao cadastrar: ${errorData.error || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao cadastrar fornecedor.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidar = async (empresaId: number) => {
    try {
      const res = await fetch(`/api/empresas/${empresaId}/validar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: user.id })
      });
      if (res.ok) {
        fetchEmpresas();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Group companies by item number
  const groupedItems = empresas.reduce((acc, emp) => {
    if (!acc[emp.numero_item]) {
      acc[emp.numero_item] = { nome: '', classificacao: '', meio_operacional: '', empresas: [] };
    }
    acc[emp.numero_item].empresas.push(emp);
    return acc;
  }, {} as Record<string, { nome: string, classificacao?: string, meio_operacional?: string, empresas: Empresa[] }>);

  // Add items from consultations that don't have companies yet
  itens.forEach(item => {
    if (!groupedItems[item.numero_item]) {
      groupedItems[item.numero_item] = { nome: item.nome_item, classificacao: item.classificacao, meio_operacional: item.meio_operacional, empresas: [] };
    } else {
      if (!groupedItems[item.numero_item].nome) {
        groupedItems[item.numero_item].nome = item.nome_item;
      }
      if (!groupedItems[item.numero_item].classificacao && item.classificacao) {
        groupedItems[item.numero_item].classificacao = item.classificacao;
      }
      if (!groupedItems[item.numero_item].meio_operacional && item.meio_operacional) {
        groupedItems[item.numero_item].meio_operacional = item.meio_operacional;
      }
    }
  });

  const uniqueMeios = Array.from(new Set(Object.values(groupedItems).map(g => g.meio_operacional).filter(Boolean))) as string[];

  const toggleMeio = (meio: string) => {
    setSelectedMeios(prev => prev.includes(meio) ? prev.filter(m => m !== meio) : [...prev, meio]);
  };

  const toggleClassificacao = (cls: string) => {
    setSelectedClassificacoes(prev => prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]);
  };

  const toggleTipo = (tipo: string) => {
    setSelectedTipos(prev => prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]);
  };

  const filteredItemNumbers = Object.keys(groupedItems).filter(num => {
    const group = groupedItems[num];
    const matchesSearch = searchQuery === '' || 
      num.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.empresas.some(e => e.razao_social.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesClassificacao = selectedClassificacoes.length === 0 || 
      (group.classificacao && selectedClassificacoes.includes(group.classificacao));

    const matchesMeio = selectedMeios.length === 0 || 
      (group.meio_operacional && selectedMeios.includes(group.meio_operacional));

    const matchesTipo = selectedTipos.length === 0 || 
      group.empresas.some(e => selectedTipos.includes(e.tipo));

    return matchesSearch && matchesClassificacao && matchesMeio && matchesTipo;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#39FF14]" />
        <p className="text-[#818384]">Carregando base de fornecedores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#818384]" />
            <input 
              type="text" 
              placeholder="Pesquisar por PI, nome, empresa..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full reddit-input reddit-input-search h-11"
            />
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[#39FF14]/10 rounded text-[#39FF14]"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Advanced Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-[#0A240A] border border-[#1A3A1A] rounded-lg p-4 space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-[#39FF14] uppercase mb-2 tracking-widest">Meio Operacional</p>
                  <div className="flex flex-wrap gap-2">
                    {uniqueMeios.map(meio => (
                      <button
                        key={meio}
                        onClick={() => toggleMeio(meio)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                          selectedMeios.includes(meio) 
                          ? 'bg-[#39FF14] text-[#051A05] border-[#39FF14]' 
                          : 'bg-transparent text-[#818384] border-[#1A3A1A] hover:border-[#39FF14]/50'
                        }`}
                      >
                        {meio}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#39FF14] uppercase mb-2 tracking-widest">Classificação</p>
                  <div className="flex flex-wrap gap-2">
                    {classificacoes.map(cls => (
                      <button
                        key={cls.id}
                        onClick={() => toggleClassificacao(cls.nome)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                          selectedClassificacoes.includes(cls.nome) 
                          ? 'bg-[#39FF14] text-[#051A05] border-[#39FF14]' 
                          : 'bg-transparent text-[#818384] border-[#1A3A1A] hover:border-[#39FF14]/50'
                        }`}
                      >
                        {cls.nome}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#39FF14] uppercase mb-2 tracking-widest">Tipo de Fornecedor</p>
                  <div className="flex flex-wrap gap-2">
                    {['fabrica', 'fornece', 'similar'].map(tipo => (
                      <button
                        key={tipo}
                        onClick={() => toggleTipo(tipo)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all border capitalize ${
                          selectedTipos.includes(tipo) 
                          ? 'bg-[#39FF14] text-[#051A05] border-[#39FF14]' 
                          : 'bg-transparent text-[#818384] border-[#1A3A1A] hover:border-[#39FF14]/50'
                        }`}
                      >
                        {tipo}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end">
                  <button 
                    onClick={() => { setSelectedMeios([]); setSelectedClassificacoes([]); setSelectedTipos([]); setSearchQuery(''); }}
                    className="text-[10px] font-bold text-[#818384] hover:text-[#39FF14] uppercase underline"
                  >
                    Limpar Filtros
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-2 text-xs font-bold text-[#818384] uppercase">
        <Filter className="w-4 h-4" />
        <span>{filteredItemNumbers.length} Itens catalogados</span>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {filteredItemNumbers.length === 0 ? (
          <div className="text-center py-20 bg-[#0A240A] border border-[#1A3A1A] rounded-lg">
            <p className="text-[#818384]">Nenhum item ou fornecedor encontrado.</p>
          </div>
        ) : (
          filteredItemNumbers.map((itemNum) => (
            <motion.div
              key={itemNum}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="reddit-card overflow-hidden"
            >
              <div className="p-4 bg-[#0D2D0D] border-b border-[#1A3A1A] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#1A3A1A] rounded flex items-center justify-center">
                    <Package className="w-6 h-6 text-[#39FF14]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg font-mono text-white">{itemNum}</h3>
                      {groupedItems[itemNum].classificacao && (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-[#1A3A1A] rounded text-[#818384] border border-[#1A3A1A]">
                          {groupedItems[itemNum].classificacao}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#39FF14] uppercase font-black tracking-tighter">{groupedItems[itemNum].nome || 'Item sem nome'}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedItemNum(itemNum); setShowAddModal(true); }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#39FF14]/10 text-[#39FF14] hover:bg-[#39FF14]/20 rounded-full text-xs font-bold transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Cadastrar Fornecedor
                </button>
              </div>
              <div className="p-4">
                {groupedItems[itemNum].empresas.length === 0 ? (
                  <div className="py-10 text-center space-y-3">
                    <Building2 className="w-12 h-12 text-[#1A3A1A] mx-auto opacity-50" />
                    <p className="text-sm text-[#818384]">Nenhum fornecedor indicado para este item ainda.</p>
                    <p className="text-[10px] text-[#39FF14]/40 uppercase font-bold tracking-widest">Contribua com a comunidade indicando um fornecedor válido</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedItems[itemNum].empresas.map((emp) => {
                      const phones = emp.telefones ? JSON.parse(emp.telefones) : [];
                      const emails = emp.emails ? JSON.parse(emp.emails) : [];
                      
                      return (
                        <div key={emp.id} className="bg-[#0D2D0D]/50 border border-[#1A3A1A] rounded-lg p-4 space-y-3 hover:border-[#39FF14]/30 transition-colors flex flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-sm leading-tight text-white">{emp.razao_social}</h4>
                            <span className="shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 bg-[#1A3A1A] rounded text-[#39FF14] border border-[#39FF14]/20">
                              {emp.tipo}
                            </span>
                          </div>
                          
                          <div className="space-y-2 text-xs text-[#818384] flex-1">
                            {emp.cnpj && (
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[10px] uppercase w-10">CNPJ</span>
                                <span className="font-mono text-[#FFFFFF]/80">{emp.cnpj}</span>
                              </div>
                            )}
                            
                            {phones.length > 0 && (
                              <div className="space-y-1">
                                {phones.map((p: string, i: number) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <Phone className="w-3 h-3 text-[#39FF14]/60" />
                                    <span>{p}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {emails.length > 0 && (
                              <div className="space-y-1">
                                {emails.map((e: string, i: number) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <Mail className="w-3 h-3 text-[#39FF14]/60" />
                                    <span className="truncate">{e}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="pt-3 mt-auto border-t border-[#1A3A1A] space-y-3">
                            <div className="flex items-center justify-between text-[10px] text-[#818384]">
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span className="font-bold text-[#39FF14]/80">{emp.indicado_por}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(emp.data_indicacao).toLocaleDateString()}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-yellow-500">
                                <ShieldCheck className="w-4 h-4" />
                                <span className="text-xs font-black">{emp.total_validacoes}</span>
                                <span className="text-[9px] uppercase font-bold text-[#818384]">Validações</span>
                              </div>
                              
                              {emp.usuario_id !== user.id && (
                                <button
                                  onClick={() => handleValidar(emp.id)}
                                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all ${
                                    emp.validado_por_mim 
                                    ? 'bg-yellow-500 text-[#051A05]' 
                                    : 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'
                                  }`}
                                >
                                  <CheckCircle className="w-3 h-3" />
                                  {emp.validado_por_mim ? 'Validado' : 'Validar Info'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Add Supplier Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0A240A] border border-[#1A3A1A] rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-4 border-b border-[#1A3A1A] flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#39FF14]">Cadastrar Fornecedor</h2>
                  <p className="text-xs text-[#818384]">Item: <span className="font-mono text-[#39FF14]">{selectedItemNum}</span></p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-[#39FF14]/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleAddEmpresa} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-[#818384] uppercase mb-1">Razão Social / Nome Fantasia</label>
                    <input
                      required
                      value={newEmpresa.razao_social}
                      onChange={(e) => setNewEmpresa({ ...newEmpresa, razao_social: e.target.value })}
                      className="w-full reddit-input"
                      placeholder="Ex: Peças Navais LTDA"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#818384] uppercase mb-1">CNPJ</label>
                    <input
                      value={newEmpresa.cnpj}
                      onChange={(e) => setNewEmpresa({ ...newEmpresa, cnpj: e.target.value })}
                      className="w-full reddit-input font-mono"
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#818384] uppercase mb-1">Tipo de Relação</label>
                    <select
                      value={newEmpresa.tipo}
                      onChange={(e) => setNewEmpresa({ ...newEmpresa, tipo: e.target.value as any })}
                      className="w-full reddit-input"
                    >
                      <option value="fabrica">Fábrica / Fabricante</option>
                      <option value="fornece">Fornecedor / Revenda</option>
                      <option value="similar">Similar / Alternativo</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-[#39FF14] uppercase tracking-widest">Contatos Telefônicos (Até 3)</label>
                  <div className="grid grid-cols-1 gap-2">
                    {newEmpresa.telefones.map((tel, i) => (
                      <input
                        key={i}
                        value={tel}
                        onChange={(e) => {
                          const newTels = [...newEmpresa.telefones];
                          newTels[i] = e.target.value;
                          setNewEmpresa({ ...newEmpresa, telefones: newTels });
                        }}
                        className="w-full reddit-input text-sm"
                        placeholder={`Telefone ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-[#39FF14] uppercase tracking-widest">Contatos de E-mail (Até 3)</label>
                  <div className="grid grid-cols-1 gap-2">
                    {newEmpresa.emails.map((email, i) => (
                      <input
                        key={i}
                        type="email"
                        value={email}
                        onChange={(e) => {
                          const newEmails = [...newEmpresa.emails];
                          newEmails[i] = e.target.value;
                          setNewEmpresa({ ...newEmpresa, emails: newEmails });
                        }}
                        className="w-full reddit-input text-sm"
                        placeholder={`E-mail ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="reddit-button-secondary py-2"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="reddit-button-primary py-2 px-8"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cadastrar'}
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
