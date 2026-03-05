import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Search, MessageSquare, ThumbsUp, Eye, Share2, Camera, Loader2, Filter, X, RotateCcw, CheckCircle, Sparkles, ChevronDown, ChevronUp, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Consulta, Usuario, StatusConsulta } from '../types';
import { GoogleGenAI } from "@google/genai";
import MentionInput from '../components/MentionInput';
import PublicProfileModal from '../components/PublicProfileModal';

interface DashboardProps {
  user: Usuario;
}

const AI_EXPERT_CONTEXT = "Você é um especialista em logística militar, catalogação de suprimentos, sobressalentes, equipamentos industriais, motores, reposição de estoque e identificação de itens. Possui conhecimento em fornecedores, peças, equipamentos e equipagens navais, aeronaves e materiais em geral. Muitas vezes, as características técnicas ou manuais estarão em inglês; você deve traduzir e interpretar esses termos técnicos para o português de forma precisa, ajudando na identificação correta do item.";

export default function Dashboard({ user }: DashboardProps) {
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [activeTab, setActiveTab] = useState<'aberto' | 'resolvido'>('aberto');
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  
  // Advanced Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeios, setSelectedMeios] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [selectedClassificacoes, setSelectedClassificacoes] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [classificacoes, setClassificacoes] = useState<{id: number, nome: string}[]>([]);

  // AI State
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // New Consulta Form State
  const [newConsulta, setNewConsulta] = useState({
    numero_item: '',
    nome_item: '',
    aplicacao: '',
    nome_coloquial: '',
    meio_operacional: '',
    classificacao: '',
    descricao: '',
  });
  const [selectedFiles, setSelectedFiles] = useState<{ name: string, data: string, type: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConsultas();
    fetchClassificacoes();
  }, []);

  const fetchClassificacoes = async () => {
    try {
      const res = await fetch('/api/config/classificacoes');
      if (res.ok) setClassificacoes(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchConsultas = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/consultas');
      if (response.ok) {
        const data = await response.json();
        setConsultas(data);
      }
    } catch (err) {
      console.error('Erro ao buscar consultas', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMentionClick = async (e: React.MouseEvent, mention: string) => {
    e.preventDefault();
    e.stopPropagation();
    const nip = mention.substring(1); // Remove @
    try {
      const res = await fetch(`/api/users/nip/${nip}`);
      if (res.ok) {
        const u = await res.json();
        setSelectedUser(u);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLikeConsulta = async (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await fetch(`/api/consultas/${id}/curtir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: user.id }),
      });
      if (response.ok) {
        // Refresh only the liked consultation or all
        fetchConsultas();
      }
    } catch (err) {
      console.error('Erro ao curtir consulta', err);
    }
  };

  const handleCreateConsulta = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/consultas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...newConsulta, 
          arquivo_url: selectedFiles.length > 0 ? JSON.stringify(selectedFiles) : null,
          usuario_id: user.id 
        }),
      });

      if (response.ok) {
        setShowNewForm(false);
        setNewConsulta({
          numero_item: '',
          nome_item: '',
          aplicacao: '',
          nome_coloquial: '',
          meio_operacional: '',
          descricao: '',
        });
        setSelectedFiles([]);
        fetchConsultas();
      } else {
        const data = await response.json();
        setError(data.error || 'Erro ao publicar consulta. Verifique os campos.');
      }
    } catch (err) {
      console.error('Erro ao criar consulta', err);
      setError('Erro de conexão ao publicar consulta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles: { name: string, data: string, type: string }[] = [];
    
    for (const file of files) {
      const reader = new FileReader();
      const promise = new Promise<void>((resolve) => {
        reader.onloadend = () => {
          newFiles.push({
            name: (file as File).name,
            data: reader.result as string,
            type: (file as File).type
          });
          resolve();
        };
      });
      reader.readAsDataURL(file as File);
      await promise;
    }
    
    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const getAiHelp = async () => {
    if (!newConsulta.descricao && !newConsulta.nome_item && selectedFiles.length === 0) return;
    setAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      const parts: any[] = [
        { text: `${AI_EXPERT_CONTEXT} Você é um assistente que ajuda a melhorar a clareza de textos técnicos de logística militar. Reescreva o texto abaixo para torná-lo mais claro, direto e profissional, mantendo o contexto original da consulta. NÃO invente informações, NÃO alucine. Apenas melhore a redação.
        Item: ${newConsulta.nome_item}
        Descrição: ${newConsulta.descricao}
        Responda de forma curta e direta (máximo 3 frases).` }
      ];

      if (selectedFiles.length > 0) {
        const firstImage = selectedFiles.find(f => f.type.startsWith('image/'));
        if (firstImage) {
          parts.push({
            inlineData: {
              data: firstImage.data.split(',')[1],
              mimeType: firstImage.type
            }
          });
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-flash-lite-latest",
        contents: { parts },
      });
      setAiSuggestion(response.text || "Não foi possível gerar sugestão.");
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  // Extract unique values for filters
  const uniqueMeios = Array.from(new Set(consultas.map(c => c.meio_operacional).filter(Boolean))) as string[];

  const filteredConsultas = consultas.filter(c => {
    const matchesTab = activeTab === 'aberto' ? (c.status === 'aberto' || c.status === 'reaberto') : c.status === 'resolvido';
    
    const matchesSearch = searchQuery === '' || 
      c.numero_item.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.nome_item.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.nome_coloquial?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesMeio = selectedMeios.length === 0 || (c.meio_operacional && selectedMeios.includes(c.meio_operacional));
    const matchesStatus = selectedStatus.length === 0 || selectedStatus.includes(c.status);
    const matchesClassificacao = selectedClassificacoes.length === 0 || (c.classificacao && selectedClassificacoes.includes(c.classificacao));

    return matchesTab && matchesSearch && matchesMeio && matchesStatus && matchesClassificacao;
  });

  const toggleMeio = (meio: string) => {
    setSelectedMeios(prev => prev.includes(meio) ? prev.filter(m => m !== meio) : [...prev, meio]);
  };

  const toggleClassificacao = (cls: string) => {
    setSelectedClassificacoes(prev => prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]);
  };

  const toggleStatus = (status: string) => {
    setSelectedStatus(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
  };

  return (
    <div className="space-y-6">
      {/* Search & AI Help */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#818384]" />
            <input
              type="text"
              placeholder="Pesquisar por PI, nome, aplicação..."
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
          <button
            onClick={() => setShowNewForm(true)}
            className="w-full md:w-auto reddit-button-primary flex items-center justify-center gap-2 h-11"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Nova Consulta</span>
          </button>
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
                  <p className="text-[10px] font-bold text-[#39FF14] uppercase mb-2 tracking-widest">Status</p>
                  <div className="flex flex-wrap gap-2">
                    {['aberto', 'reaberto', 'resolvido'].map(status => (
                      <button
                        key={status}
                        onClick={() => toggleStatus(status)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all border capitalize ${
                          selectedStatus.includes(status) 
                          ? 'bg-[#39FF14] text-[#051A05] border-[#39FF14]' 
                          : 'bg-transparent text-[#818384] border-[#1A3A1A] hover:border-[#39FF14]/50'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end">
                  <button 
                    onClick={() => { setSelectedMeios([]); setSelectedStatus([]); setSearchQuery(''); }}
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

      {/* Tabs */}
      <div className="flex border-b border-[#1A3A1A] gap-8">
        <button
          onClick={() => setActiveTab('aberto')}
          className={`pb-3 px-1 text-sm font-bold transition-colors relative ${
            activeTab === 'aberto' ? 'text-[#39FF14]' : 'text-[#818384] hover:text-[#39FF14]'
          }`}
        >
          Consultas Abertas
          {activeTab === 'aberto' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#39FF14]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('resolvido')}
          className={`pb-3 px-1 text-sm font-bold transition-colors relative ${
            activeTab === 'resolvido' ? 'text-[#39FF14]' : 'text-[#818384] hover:text-[#39FF14]'
          }`}
        >
          Consultas Resolvidas
          {activeTab === 'resolvido' && (
            <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#39FF14]" />
          )}
        </button>
      </div>

      {/* New Consulta Modal */}
      <AnimatePresence>
        {showNewForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0A240A] border border-[#1A3A1A] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-4 border-b border-[#1A3A1A] flex items-center justify-between">
                <h2 className="text-lg font-bold text-[#39FF14]">Criar Nova Consulta</h2>
                <button onClick={() => setShowNewForm(false)} className="p-1 hover:bg-[#39FF14]/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateConsulta} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#818384] uppercase mb-1">Número do Item / PI</label>
                    <input
                      required
                      value={newConsulta.numero_item}
                      onChange={(e) => setNewConsulta({ ...newConsulta, numero_item: e.target.value })}
                      className="w-full reddit-input"
                      placeholder="Ex: 1234-56-789"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#818384] uppercase mb-1">Nome do Item</label>
                    <input
                      required
                      value={newConsulta.nome_item}
                      onChange={(e) => setNewConsulta({ ...newConsulta, nome_item: e.target.value })}
                      className="w-full reddit-input"
                      placeholder="Ex: Válvula de Pressão"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#818384] uppercase mb-1">Aplicação</label>
                    <input
                      value={newConsulta.aplicacao}
                      onChange={(e) => setNewConsulta({ ...newConsulta, aplicacao: e.target.value })}
                      className="w-full reddit-input"
                      placeholder="Ex: Sistema Hidráulico"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#818384] uppercase mb-1">Nome Coloquial</label>
                    <input
                      value={newConsulta.nome_coloquial}
                      onChange={(e) => setNewConsulta({ ...newConsulta, nome_coloquial: e.target.value })}
                      className="w-full reddit-input"
                      placeholder="Ex: Válvula de Alívio"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#818384] uppercase mb-1">Meio Operacional</label>
                    <input
                      value={newConsulta.meio_operacional}
                      onChange={(e) => setNewConsulta({ ...newConsulta, meio_operacional: e.target.value })}
                      className="w-full reddit-input"
                      placeholder="Ex: Aeronave X, Navio Y"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#818384] uppercase mb-1">Classificação</label>
                    <select
                      value={newConsulta.classificacao}
                      onChange={(e) => setNewConsulta({ ...newConsulta, classificacao: e.target.value })}
                      className="w-full reddit-input"
                    >
                      <option value="">Selecione...</option>
                      {classificacoes.map(c => (
                        <option key={c.id} value={c.nome}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#818384] uppercase mb-1">Anexos (Fotos ou Documentos)</label>
                  <div className="space-y-3">
                    <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-[#1A3A1A] rounded-lg hover:border-[#39FF14] hover:bg-[#39FF14]/5 transition-all cursor-pointer group">
                      <input type="file" className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx" multiple />
                      <Camera className="w-5 h-5 text-[#818384] group-hover:text-[#39FF14]" />
                      <span className="text-xs text-[#818384] group-hover:text-[#39FF14]">
                        Clique para anexar fotos ou PDFs técnicos (múltiplos permitidos)
                      </span>
                    </label>
                    
                    {selectedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-1.5 bg-[#0D2D0D] border border-[#39FF14]/30 rounded-lg max-w-[200px]">
                            {file.type.startsWith('image/') ? (
                              <img src={file.data} className="w-6 h-6 object-cover rounded" alt="Preview" />
                            ) : (
                              <div className="w-6 h-6 bg-red-500/20 rounded flex items-center justify-center text-red-500">
                                <Paperclip className="w-3 h-3" />
                              </div>
                            )}
                            <p className="text-[9px] font-bold text-white truncate flex-1">{file.name}</p>
                            <button 
                              type="button"
                              onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} 
                              className="p-1 hover:bg-red-500/20 rounded-full text-red-500"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <label className="block text-xs font-bold text-[#818384] uppercase mb-1 flex items-center justify-between">
                    <span>Descrição da Dúvida</span>
                    <button 
                      type="button"
                      onClick={getAiHelp}
                      disabled={aiLoading}
                      className="text-[10px] flex items-center gap-1 text-[#39FF14] hover:underline disabled:opacity-50"
                    >
                      {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                      Sugestão IA
                    </button>
                  </label>
                  <MentionInput
                    required
                    value={newConsulta.descricao}
                    onChange={(val) => setNewConsulta({ ...newConsulta, descricao: val })}
                    placeholder="Descreva detalhadamente sua dúvida técnica... Use @ para mencionar alguém."
                    rows={4}
                    className="w-full reddit-input resize-none"
                  />
                  <AnimatePresence>
                    {aiSuggestion && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 p-3 bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg text-xs text-[#39FF14] relative"
                      >
                        <button onClick={() => setAiSuggestion(null)} className="absolute top-2 right-2"><X className="w-3 h-3" /></button>
                        <p className="font-bold mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Sugestão Técnica:</p>
                        {aiSuggestion}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {error && (
                  <p className="text-red-500 text-xs font-bold uppercase text-center">{error}</p>
                )}
                <div className="flex items-center gap-4 pt-4">
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setShowNewForm(false)}
                    className="reddit-button-secondary py-2"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="reddit-button-primary py-2"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Publicar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Consultas List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-[#39FF14]" />
            <p className="text-[#818384]">Carregando consultas...</p>
          </div>
        ) : filteredConsultas.length === 0 ? (
          <div className="text-center py-20 bg-[#0A240A] border border-[#1A3A1A] rounded-lg">
            <p className="text-[#818384]">Nenhuma consulta encontrada com esses filtros.</p>
          </div>
        ) : (
          filteredConsultas.map((c) => (
            <Link key={c.id} to={`/consulta/${c.id}`} className="block">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="reddit-card p-4 flex gap-4"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] text-[#818384] uppercase font-bold">
                    <span className="text-[#39FF14]">{c.autor_om}</span>
                    <span>•</span>
                    <span>Postado por {c.autor_nome}</span>
                    {c.autor_perfil && (
                      <>
                        <span>•</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] border ${
                          c.autor_perfil === 'admin' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                          c.autor_perfil === 'obtencao' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                          c.autor_perfil === 'catalogacao' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' :
                          c.autor_perfil === 'diretoria' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                          c.autor_perfil === 'especialista' ? 'bg-orange-500/10 text-orange-500 border-orange-500/20' :
                          'bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/20'
                        }`}>
                          {c.autor_perfil === 'admin' ? 'Administrador' :
                           c.autor_perfil === 'obtencao' ? 'Obtenção' :
                           c.autor_perfil === 'catalogacao' ? 'Catalogação' :
                           c.autor_perfil === 'diretoria' ? 'Diretoria' :
                           c.autor_perfil === 'especialista' ? 'Especialista' : 'Usuário'}
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <span>{new Date(c.data_criacao).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-lg font-bold leading-tight text-white line-clamp-2 flex-1">{c.nome_item}</h3>
                    <div className="flex items-center gap-2 shrink-0 pt-1">
                      {c.status === 'aberto' && (
                        <span className="status-badge status-aberto flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse-slow" />
                          Aberto
                        </span>
                      )}
                      {c.status === 'reaberto' && (
                        <span className="status-badge status-reaberto flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" />
                          Reaberto
                        </span>
                      )}
                      {c.status === 'resolvido' && (
                        <span className="status-badge status-resolvido flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Resolvido
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-0.5 bg-[#0D2D0D] rounded text-[10px] font-bold uppercase text-[#39FF14] border border-[#1A3A1A]">PI: {c.numero_item}</span>
                    {c.meio_operacional && (
                      <span className="px-2 py-0.5 bg-[#0D2D0D] rounded text-[10px] font-bold uppercase text-[#39FF14] border border-[#1A3A1A]">{c.meio_operacional}</span>
                    )}
                    {c.classificacao && (
                      <span className="px-2 py-0.5 bg-[#0D2D0D] rounded text-[10px] font-bold uppercase text-[#39FF14] border border-[#1A3A1A]">{c.classificacao}</span>
                    )}
                  </div>

                  <p className="text-sm text-[#FFFFFF]/80 line-clamp-2">
                    {c.descricao.split(/(@\w+)/g).map((part, i) => 
                      part.startsWith('@') ? (
                        <button 
                          key={i} 
                          onClick={(e) => handleMentionClick(e, part)} 
                          className="text-[#39FF14] font-bold hover:underline bg-transparent border-none p-0 cursor-pointer"
                        >
                          {part}
                        </button>
                      ) : part
                    )}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-3 text-[#818384] border-t border-[#1A3A1A]/50">
                    <button 
                      onClick={(e) => handleLikeConsulta(e, c.id)}
                      className="flex items-center gap-1.5 hover:bg-[#39FF14]/10 px-2 py-1 rounded transition-colors"
                    >
                      <ThumbsUp className="w-4 h-4 text-orange-500" />
                      <span className="text-xs font-bold">{c.total_curtidas} Curtidas</span>
                    </button>
                    <div className="flex items-center gap-1.5 hover:bg-[#39FF14]/10 px-2 py-1 rounded transition-colors">
                      <MessageSquare className="w-4 h-4 text-[#39FF14]" />
                      <span className="text-xs font-bold">{c.total_comentarios} Comentários</span>
                    </div>
                    <div className="flex items-center gap-1.5 hover:bg-[#39FF14]/10 px-2 py-1 rounded transition-colors">
                      <Eye className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold">{c.visualizacoes} Visualizações</span>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigator.clipboard.writeText(`${window.location.origin}/consulta/${c.id}`);
                        alert('Link copiado para a área de transferência!');
                      }}
                      className="flex items-center gap-1.5 hover:bg-[#39FF14]/10 px-2 py-1 rounded transition-colors"
                    >
                      <Share2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold">Compartilhar</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </Link>
          ))
        )}
      </div>
      {selectedUser && (
        <PublicProfileModal 
          user={selectedUser} 
          currentUser={user} 
          onClose={() => setSelectedUser(null)} 
        />
      )}
    </div>
  );
}
