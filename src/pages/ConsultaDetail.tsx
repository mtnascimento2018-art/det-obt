import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ThumbsUp, MessageSquare, Eye, Share2, Camera, Loader2, CheckCircle, RotateCcw, ArrowLeft, Send, Building2, Mic, MicOff, Sparkles, X, Paperclip, Phone, Mail, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Consulta, Comentario, Usuario, Empresa, AuditoriaLog } from '../types';
import { GoogleGenAI } from "@google/genai";
import MentionInput from '../components/MentionInput';
import PublicProfileModal from '../components/PublicProfileModal';

interface ConsultaDetailProps {
  user: Usuario;
}

const AI_EXPERT_CONTEXT = "Você é um especialista em logística militar, catalogação de suprimentos, sobressalentes, equipamentos industriais, motores, reposição de estoque e identificação de itens. Possui conhecimento profundo em fornecedores, peças, equipamentos e equipagens navais, aeronaves e materiais em geral. Muitas vezes, as características técnicas ou manuais estarão em inglês; você deve traduzir e interpretar esses termos técnicos para o português de forma precisa, ajudando na identificação correta do item.";

export default function ConsultaDetail({ user }: ConsultaDetailProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [statusHistory, setStatusHistory] = useState<AuditoriaLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<{ name: string, data: string, type: string }[]>([]);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showEmpresaForm, setShowEmpresaForm] = useState(false);
  const [submittingEmpresa, setSubmittingEmpresa] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [newEmpresa, setNewEmpresa] = useState({
    cnpj: '',
    razao_social: '',
    telefones: ['', '', ''],
    emails: ['', '', ''],
    tipo: 'fornece' as 'fabrica' | 'fornece' | 'similar',
  });

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Summary State
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cRes, comRes] = await Promise.all([
        fetch(`/api/consultas/${id}`),
        fetch(`/api/consultas/${id}/comentarios`)
      ]);

      if (cRes.ok) {
        const cData = await cRes.json();
        setConsulta(cData);
        const [empRes, auditRes] = await Promise.all([
          fetch(`/api/empresas?numero_item=${cData.numero_item}&usuario_id=${user.id}`),
          fetch(`/api/auditoria?objeto_afetado=${id}`)
        ]);
        if (empRes.ok) setEmpresas(await empRes.json());
        if (auditRes.ok) {
          const logs: AuditoriaLog[] = await auditRes.json();
          setStatusHistory(logs.filter(l => l.acao === 'Alteração de Status'));
        }
      }
      if (comRes.ok) setComentarios(await comRes.json());
    } catch (err) {
      console.error('Erro ao buscar dados', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePostEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consulta) return;
    setSubmittingEmpresa(true);
    try {
      const response = await fetch('/api/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEmpresa,
          numero_item: consulta.numero_item,
          indicado_por_id: user.id,
          telefones: newEmpresa.telefones.filter(t => t.trim() !== ''),
          emails: newEmpresa.emails.filter(e => e.trim() !== '')
        }),
      });

      if (response.ok) {
        setShowEmpresaForm(false);
        setNewEmpresa({
          cnpj: '',
          razao_social: '',
          telefones: ['', '', ''],
          emails: ['', '', ''],
          tipo: 'fornece',
        });
        const empRes = await fetch(`/api/empresas?numero_item=${consulta.numero_item}&usuario_id=${user.id}`);
        if (empRes.ok) setEmpresas(await empRes.json());
        alert('Fornecedor indicado com sucesso!');
      } else {
        const errorData = await response.json();
        alert(`Erro ao indicar fornecedor: ${errorData.error || 'Erro desconhecido'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao indicar fornecedor.');
    } finally {
      setSubmittingEmpresa(false);
    }
  };

  const handleValidarEmpresa = async (empresaId: number) => {
    try {
      const res = await fetch(`/api/empresas/${empresaId}/validar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: user.id })
      });
      if (res.ok) {
        const empRes = await fetch(`/api/empresas?numero_item=${consulta?.numero_item}&usuario_id=${user.id}`);
        if (empRes.ok) setEmpresas(await empRes.json());
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newComment.trim() && selectedFiles.length === 0) return;

    setSubmittingComment(true);
    try {
      const response = await fetch('/api/comentarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consulta_id: id,
          usuario_id: user.id,
          texto: newComment,
          arquivo_url: selectedFiles.length > 0 ? JSON.stringify(selectedFiles) : null
        }),
      });

      if (response.ok) {
        setNewComment('');
        setSelectedFiles([]);
        const comRes = await fetch(`/api/consultas/${id}/comentarios`);
        setComentarios(await comRes.json());
      }
    } catch (err) {
      console.error('Erro ao postar comentário', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUpdateStatus = async (status: 'resolvido' | 'reaberto') => {
    try {
      const response = await fetch(`/api/consultas/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          alterado_por: user.nome,
          alterado_por_id: user.id
        }),
      });

      if (response.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Erro ao atualizar status', err);
    }
  };

  const handleLikeConsulta = async () => {
    try {
      const response = await fetch(`/api/consultas/${id}/curtir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: user.id }),
      });
      if (response.ok) {
        const cRes = await fetch(`/api/consultas/${id}`);
        if (cRes.ok) setConsulta(await cRes.json());
      }
    } catch (err) {
      console.error('Erro ao curtir consulta', err);
    }
  };

  const handleLikeComentario = async (comentarioId: number) => {
    try {
      const response = await fetch(`/api/comentarios/${comentarioId}/curtir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: user.id }),
      });
      if (response.ok) {
        const comRes = await fetch(`/api/consultas/${id}/comentarios`);
        if (comRes.ok) setComentarios(await comRes.json());
      }
    } catch (err) {
      console.error('Erro ao curtir comentário', err);
    }
  };

  const handleReply = (autorCodigo: string) => {
    setNewComment(prev => `@${autorCodigo} ${prev}`);
    // Scroll to input
    const input = document.querySelector('textarea');
    if (input) {
      input.focus();
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Check supported types
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        setAudioBlob(blob);
        transcribeAudio(blob, mimeType);
      };

      recorder.start();
      mediaRecorder.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Erro ao acessar microfone", err);
      alert("Erro ao acessar microfone. Verifique as permissões do navegador.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (blob: Blob, mimeType: string) => {
    setTranscribing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          alert("Chave API Gemini não configurada.");
          setTranscribing(false);
          return;
        }
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            {
              parts: [
                { inlineData: { data: base64Data, mimeType } },
                { text: `${AI_EXPERT_CONTEXT} Transcreva este áudio militar para texto. Seja preciso com termos técnicos de catalogação, peças, motores e siglas militares. Retorne apenas o texto transcrito.` }
              ]
            }
          ],
        });
        const text = response.text;
        if (text) {
          setNewComment(prev => prev + (prev ? ' ' : '') + text.trim());
        }
        setTranscribing(false);
      };
    } catch (err) {
      console.error("Erro na transcrição:", err);
      setTranscribing(false);
    }
  };

  const generateSummary = async () => {
    if (comentarios.length === 0) return;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      alert("Chave API Gemini não configurada.");
      return;
    }
    setSummarizing(true);
    try {
      const discussion = comentarios.map(c => `${c.autor_nome}: ${c.texto}`).join('\n');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `${AI_EXPERT_CONTEXT} Você é um especialista em logística militar e suprimentos. Com base no contexto da consulta e nos comentários fornecidos, crie um resumo organizado para que um fornecedor possa identificar o item corretamente.
        Regras:
        1. NÃO alucine ou invente informações.
        2. Traduza termos técnicos em inglês para português e sugira como o item pode ser conhecido.
        3. Organize as informações de forma clara (Ex: Descrição, Aplicação, Especificações Técnicas).
        4. Utilize apenas as informações presentes no chamado e nos comentários.
        
        Descrição do Item: ${consulta?.nome_item} - ${consulta?.descricao}
        Discussão:
        ${discussion}`,
      });
      setAiSummary(response.text || "Não foi possível gerar resumo.");
    } catch (err) {
      console.error(err);
    } finally {
      setSummarizing(false);
    }
  };

  const suggestComment = async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      alert("Chave API Gemini não configurada.");
      return;
    }
    setSuggesting(true);
    try {
      const discussion = comentarios.map(c => `${c.autor_nome}: ${c.texto}`).join('\n');
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `${AI_EXPERT_CONTEXT} Você é um assistente que ajuda a melhorar a clareza de textos técnicos de logística militar. Reescreva o texto abaixo para torná-lo mais claro, direto e profissional, mantendo o contexto original da consulta. NÃO invente informações, NÃO alucine. Apenas melhore a redação.
        Item: ${consulta?.nome_item} (${consulta?.numero_item})
        Descrição: ${consulta?.descricao}
        Discussão Atual:
        ${discussion || 'Nenhum comentário ainda.'}
        Retorne apenas o texto da sugestão.`,
      });
      if (response.text) {
        setNewComment(response.text.trim());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSuggesting(false);
    }
  };

  const handleMentionClick = async (mention: string) => {
    const nip = mention.substring(1); // Remove @
    try {
      const res = await fetch(`/api/users/nip/${nip}`);
      if (res.ok) {
        const u = await res.json();
        setSelectedUser(u);
      } else {
        // alert("Usuário não encontrado");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#39FF14]" />
        <p className="text-[#818384]">Carregando detalhes...</p>
      </div>
    );
  }

  if (!consulta) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#818384] hover:text-[#39FF14] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>
        <button 
          onClick={generateSummary}
          disabled={summarizing || comentarios.length === 0}
          className="text-xs flex items-center gap-2 text-[#39FF14] hover:underline disabled:opacity-50"
        >
          {summarizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          Resumo Inteligente
        </button>
      </div>

      <AnimatePresence>
        {aiSummary && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg p-4 relative"
          >
            <button onClick={() => setAiSummary(null)} className="absolute top-2 right-2 text-[#39FF14]"><X className="w-4 h-4" /></button>
            <h3 className="text-sm font-bold text-[#39FF14] mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Resumo da Discussão
            </h3>
            <p className="text-sm text-[#FFFFFF]/90 whitespace-pre-wrap leading-relaxed">{aiSummary}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="reddit-card overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-2 text-[10px] text-[#818384] uppercase font-bold">
              <span className="text-[#39FF14]">{consulta.autor_om}</span>
              <span>•</span>
              <span>Postado por {consulta.autor_nome}</span>
              <span>•</span>
              <span>{new Date(consulta.data_criacao).toLocaleString()}</span>
            </div>

            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold leading-tight text-white flex-1">{consulta.nome_item}</h1>
              <div className="flex items-center gap-2 shrink-0 pt-1">
                {consulta.status === 'aberto' && (
                  <span className="status-badge status-aberto flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse-slow" />
                    Aberto
                  </span>
                )}
                {consulta.status === 'reaberto' && (
                  <span className="status-badge status-reaberto flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" />
                    Reaberto
                  </span>
                )}
                {consulta.status === 'resolvido' && (
                  <span className="status-badge status-resolvido flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Resolvido
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#0D2D0D] rounded-lg border border-[#1A3A1A]">
              <div>
                <p className="text-[10px] font-bold text-[#39FF14] uppercase">Número Item / PI</p>
                <p className="text-sm font-mono">{consulta.numero_item}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#39FF14] uppercase">Aplicação</p>
                <p className="text-sm">{consulta.aplicacao || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#39FF14] uppercase">Classificação</p>
                <p className="text-sm">{consulta.classificacao || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#39FF14] uppercase">Meio Operacional</p>
                <p className="text-sm">{consulta.meio_operacional || '-'}</p>
              </div>
            </div>

            <div className="prose prose-invert max-w-none">
              <p className="text-[#FFFFFF]/90 whitespace-pre-wrap leading-relaxed">
                {consulta.descricao.split(/(@\w+)/g).map((part, i) => 
                  part.startsWith('@') ? (
                    <button 
                      key={i} 
                      onClick={() => handleMentionClick(part)} 
                      className="text-[#39FF14] font-bold hover:underline bg-transparent border-none p-0 cursor-pointer"
                    >
                      {part}
                    </button>
                  ) : part
                )}
              </p>
            </div>

            {/* Fornecedores Section */}
            <div className="mt-6 space-y-4 pt-6 border-t border-[#1A3A1A]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#39FF14] uppercase tracking-widest flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> Fornecedores Identificados
                </h3>
                <button
                  onClick={() => setShowEmpresaForm(true)}
                  className="text-[10px] font-black uppercase px-3 py-1 bg-[#39FF14]/10 text-[#39FF14] hover:bg-[#39FF14]/20 rounded-full transition-all"
                >
                  Indicar Fornecedor
                </button>
              </div>

              {empresas.length === 0 ? (
                <div className="p-4 bg-[#0D2D0D] border border-[#1A3A1A] rounded-lg text-center">
                  <p className="text-xs text-[#818384]">Nenhum fornecedor indicado para este item ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {empresas.map((emp) => {
                    const phones = emp.telefones ? JSON.parse(emp.telefones) : [];
                    const emails = emp.emails ? JSON.parse(emp.emails) : [];
                    
                    return (
                      <div key={emp.id} className="bg-[#0D2D0D] border border-[#1A3A1A] rounded-lg p-3 space-y-2 hover:border-[#39FF14]/30 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-xs text-white leading-tight">{emp.razao_social}</h4>
                          <div className="flex flex-col items-end gap-1">
                            <span className="shrink-0 text-[8px] font-black uppercase px-1.5 py-0.5 bg-[#1A3A1A] rounded text-[#39FF14] border border-[#39FF14]/20">
                              {emp.tipo}
                            </span>
                            {consulta.classificacao && (
                              <span className="shrink-0 text-[8px] font-bold uppercase px-1.5 py-0.5 bg-[#0D2D0D] rounded text-[#818384] border border-[#1A3A1A]">
                                {consulta.classificacao}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="space-y-1 text-[10px] text-[#818384]">
                          {emp.cnpj && (
                            <div className="flex items-center gap-2">
                              <span className="font-bold uppercase w-8">CNPJ</span>
                              <span className="font-mono text-white/70">{emp.cnpj}</span>
                            </div>
                          )}
                          {phones.length > 0 && (
                            <div className="flex items-start gap-2">
                              <Phone className="w-3 h-3 mt-0.5 text-[#39FF14]/60" />
                              <div className="flex flex-col">
                                {phones.map((p: string, i: number) => <span key={i}>{p}</span>)}
                              </div>
                            </div>
                          )}
                          {emails.length > 0 && (
                            <div className="flex items-start gap-2">
                              <Mail className="w-3 h-3 mt-0.5 text-[#39FF14]/60" />
                              <div className="flex flex-col truncate">
                                {emails.map((e: string, i: number) => <span key={i} className="truncate">{e}</span>)}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-[#1A3A1A] flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[#39FF14]">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span className="text-xs font-black">{emp.total_validacoes}</span>
                          </div>
                          
                          {emp.usuario_id !== user.id && (
                            <button
                              onClick={() => handleValidarEmpresa(emp.id)}
                              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase transition-all ${
                                emp.validado_por_mim 
                                ? 'bg-[#39FF14] text-[#051A05]' 
                                : 'bg-[#39FF14]/10 text-[#39FF14] hover:bg-[#39FF14]/20'
                              }`}
                            >
                              <CheckCircle className="w-2.5 h-2.5" />
                              {emp.validado_por_mim ? 'Validado' : 'Validar'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {consulta.arquivo_url && (
              <div className="mt-4 p-4 bg-[#0D2D0D] rounded-lg border border-[#1A3A1A] space-y-4">
                <p className="text-[10px] font-bold text-[#39FF14] uppercase mb-2">Anexos da Consulta</p>
                {(() => {
                  let files: { name: string, data: string, type: string }[] = [];
                  try {
                    if (consulta.arquivo_url.startsWith('[')) {
                      files = JSON.parse(consulta.arquivo_url);
                    } else {
                      files = [{ 
                        name: 'Anexo Técnico', 
                        data: consulta.arquivo_url, 
                        type: consulta.arquivo_url.startsWith('data:image/') ? 'image/png' : 'application/octet-stream' 
                      }];
                    }
                  } catch (e) {
                    files = [{ 
                      name: 'Anexo Técnico', 
                      data: consulta.arquivo_url, 
                      type: consulta.arquivo_url.startsWith('data:image/') ? 'image/png' : 'application/octet-stream' 
                    }];
                  }

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {files.map((file, idx) => (
                        <div key={idx}>
                          {file.type.startsWith('image/') || file.data.startsWith('data:image/') ? (
                            <div className="relative group max-w-md">
                              <img 
                                src={file.data} 
                                alt={file.name} 
                                className="rounded-lg border border-[#1A3A1A] max-h-96 object-contain cursor-pointer"
                                referrerPolicy="no-referrer"
                                onClick={() => window.open(file.data, '_blank')}
                              />
                              <a 
                                href={file.data} 
                                download={file.name}
                                className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Share2 className="w-4 h-4 text-white" />
                              </a>
                            </div>
                          ) : (
                            <a 
                              href={file.data} 
                              download={file.name}
                              className="flex items-center gap-3 p-3 bg-[#1A3A1A] border border-[#39FF14]/20 rounded-lg hover:bg-[#39FF14]/5 transition-colors group"
                            >
                              <div className="p-2 bg-red-500/20 rounded text-red-500">
                                <Paperclip className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white truncate">{file.name}</p>
                                <p className="text-[10px] text-[#818384]">Clique para baixar</p>
                              </div>
                              <Share2 className="w-4 h-4 text-[#818384] group-hover:text-[#39FF14]" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

            {statusHistory.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">Histórico de Status</p>
                <div className="space-y-2">
                  {statusHistory.map(log => (
                    <div key={log.id} className="p-3 bg-[#0D2D0D] rounded-lg border border-[#1A3A1A] flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#39FF14] uppercase">{log.descricao}</span>
                        <span className="text-[9px] text-[#818384] font-mono">{new Date(log.data_hora).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className="text-[#818384]">Alterado por:</span>
                        <span className="text-white font-bold">{log.nome_guerra}</span>
                        <span className="px-1.5 py-0.5 bg-[#39FF14]/10 text-[#39FF14] rounded text-[8px] font-black uppercase">{log.perfil}</span>
                        <span className="text-[#818384]">({log.organizacao_militar})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-4 border-t border-[#1A3A1A]">
              <button 
                onClick={handleLikeConsulta}
                className="flex items-center gap-1.5 hover:bg-[#39FF14]/10 px-2 py-1 rounded transition-colors text-[#818384]"
              >
                <ThumbsUp className="w-4 h-4 text-orange-500" />
                <span className="text-xs font-bold">{consulta.total_curtidas} Curtidas</span>
              </button>
              <div className="flex items-center gap-1.5 text-[#818384] hover:bg-[#39FF14]/10 px-2 py-1 rounded transition-colors cursor-default">
                <MessageSquare className="w-4 h-4 text-[#39FF14]" />
                <span className="text-xs font-bold">{comentarios.length} Comentários</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#818384] hover:bg-[#39FF14]/10 px-2 py-1 rounded transition-colors cursor-default">
                <Eye className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold">{consulta.visualizacoes} Visualizações</span>
              </div>
              <button 
                onClick={async () => {
                  const isMobile = window.matchMedia('(pointer: coarse)').matches;
                  try {
                    if (isMobile && navigator.share) {
                      await navigator.share({
                        title: consulta?.nome_item || 'Consulta',
                        url: window.location.href
                      });
                    } else {
                      await navigator.clipboard.writeText(window.location.href);
                      alert('Link copiado para a área de transferência!');
                    }
                  } catch (err) {
                    console.error('Erro ao compartilhar:', err);
                    try {
                      await navigator.clipboard.writeText(window.location.href);
                      alert('Link copiado para a área de transferência!');
                    } catch (clipboardErr) {
                      console.error('Erro ao copiar para clipboard:', clipboardErr);
                      alert('Não foi possível compartilhar ou copiar o link.');
                    }
                  }
                }}
                className="flex items-center gap-1.5 hover:bg-[#39FF14]/10 px-2 py-1 rounded transition-colors text-[#818384]"
              >
                <Share2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold">Compartilhar</span>
              </button>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                {(user.perfil === 'obtencao' || user.perfil === 'admin') && consulta.status !== 'resolvido' && (
                  <button
                    onClick={() => handleUpdateStatus('resolvido')}
                    className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full text-xs font-bold transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Marcar como Resolvido
                  </button>
                )}
                {(user.perfil === 'obtencao' || user.perfil === 'admin') && consulta.status === 'resolvido' && (
                  <button
                    onClick={() => handleUpdateStatus('reaberto')}
                    className="flex items-center gap-2 px-4 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-full text-xs font-bold transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reabrir Consulta
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comments Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-[#39FF14]">Comentários</h2>
        
        <div className="space-y-2">
          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 p-1.5 bg-[#0D2D0D] border border-[#39FF14]/30 rounded-lg max-w-[200px]">
                  {file.type.startsWith('image/') ? (
                    <img src={file.data} className="w-8 h-8 object-cover rounded" alt="Preview" />
                  ) : (
                    <div className="w-8 h-8 bg-red-500/20 rounded flex items-center justify-center text-red-500">
                      <Paperclip className="w-4 h-4" />
                    </div>
                  )}
                  <p className="text-[10px] font-bold text-white truncate flex-1">{file.name}</p>
                  <button 
                    onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))} 
                    className="p-1 hover:bg-red-500/20 rounded-full text-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="relative">
            <MentionInput
              value={newComment}
              onChange={(val) => setNewComment(val)}
              placeholder="O que você acha? Use @ para mencionar alguém."
              className="w-full reddit-input min-h-[120px] resize-none pr-12"
              rows={4}
            />
            <div className="absolute right-3 bottom-3 flex flex-col gap-2">
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
                className="p-2 bg-[#1A3A1A] text-[#39FF14] hover:bg-[#39FF14]/20 rounded-full transition-all"
                title="Anexar arquivo ou foto"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-2 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-[#1A3A1A] text-[#39FF14] hover:bg-[#39FF14]/20'}`}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          <AnimatePresence>
            {transcribing && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-xs text-[#39FF14]"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Transcrevendo áudio...</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-end gap-3">
            <button
              onClick={suggestComment}
              disabled={suggesting}
              className="text-xs flex items-center gap-2 text-[#39FF14] hover:bg-[#39FF14]/10 px-3 py-1 rounded-full transition-colors disabled:opacity-50"
            >
              {suggesting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              Sugerir Resposta
            </button>
            <button
              onClick={() => handlePostComment()}
              disabled={submittingComment || (!newComment.trim() && selectedFiles.length === 0)}
              className="reddit-button-primary py-2 px-8 flex items-center gap-2"
            >
              {submittingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>Comentar</span>
            </button>
          </div>
        </div>

        <div className="space-y-6 pt-4">
          {comentarios.map((com) => (
            <div key={com.id} className="flex gap-4">
              {com.autor_foto ? (
                <img 
                  src={com.autor_foto} 
                  alt={com.autor_nome} 
                  className="w-10 h-10 rounded-full object-cover shrink-0 border border-[#1A3A1A]" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 bg-[#0D2D0D] border border-[#1A3A1A] rounded-full shrink-0 flex items-center justify-center text-[#39FF14] font-bold">
                  {com.autor_nome[0]}
                </div>
              )}
              <div className="flex-1 space-y-2">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-[#FFFFFF]">{com.autor_nome}</span>
                    <span className="text-[#39FF14] font-mono text-[10px]">{com.autor_codigo}</span>
                    <span className="text-[#818384]">•</span>
                    <span className="text-[#818384]">{new Date(com.data_criacao).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-[#818384] uppercase font-bold">
                    <span>{com.autor_posto}</span>
                    <span>•</span>
                    <span>{com.autor_funcao}</span>
                    <span>•</span>
                    <span className="text-[#39FF14]/60">{com.autor_om}</span>
                    {com.autor_perfil && (
                      <>
                        <span>•</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] border ${
                          com.autor_perfil === 'admin' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                          com.autor_perfil === 'obtencao' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                          'bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/20'
                        }`}>
                          {com.autor_perfil === 'admin' ? 'Administrador' :
                           com.autor_perfil === 'obtencao' ? 'Obtenção' : 'Usuário'}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm text-[#FFFFFF]/80 whitespace-pre-wrap leading-relaxed">
                  {com.texto.split(/(@\w+)/g).map((part, i) => 
                    part.startsWith('@') ? (
                      <button 
                        key={i} 
                        onClick={() => handleMentionClick(part)} 
                        className="text-[#39FF14] font-bold hover:underline bg-transparent border-none p-0 cursor-pointer"
                      >
                        {part}
                      </button>
                    ) : part
                  )}
                </p>
                {com.arquivo_url && (
                  <div className="mt-2 space-y-2">
                    {(() => {
                      let files: { name: string, data: string, type: string }[] = [];
                      try {
                        if (com.arquivo_url.startsWith('[')) {
                          files = JSON.parse(com.arquivo_url);
                        } else {
                          files = [{ name: 'Anexo', data: com.arquivo_url, type: com.arquivo_url.startsWith('data:image/') ? 'image/png' : 'application/octet-stream' }];
                        }
                      } catch (e) {
                        files = [{ name: 'Anexo', data: com.arquivo_url, type: com.arquivo_url.startsWith('data:image/') ? 'image/png' : 'application/octet-stream' }];
                      }

                      return files.map((file, idx) => (
                        <div key={idx}>
                          {file.type.startsWith('image/') || file.data.startsWith('data:image/') ? (
                            <div className="relative group max-w-sm">
                              <img 
                                src={file.data} 
                                alt={file.name} 
                                className="rounded-lg border border-[#1A3A1A] max-h-64 object-contain cursor-pointer"
                                referrerPolicy="no-referrer"
                                onClick={() => window.open(file.data, '_blank')}
                              />
                              <a 
                                href={file.data} 
                                download={file.name}
                                className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Baixar imagem"
                              >
                                <Share2 className="w-4 h-4 text-white" />
                              </a>
                            </div>
                          ) : (
                            <a 
                              href={file.data} 
                              download={file.name}
                              className="flex items-center gap-3 p-3 bg-[#0D2D0D] border border-[#1A3A1A] rounded-lg hover:bg-[#1A3A1A] transition-colors group max-w-sm"
                            >
                              <div className="p-2 bg-red-500/20 rounded text-red-500">
                                <Paperclip className="w-5 h-5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white truncate">{file.name}</p>
                                <p className="text-[10px] text-[#818384]">Clique para baixar</p>
                              </div>
                              <Share2 className="w-4 h-4 text-[#818384] group-hover:text-[#39FF14]" />
                            </a>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                )}
                <div className="flex items-center gap-4 pt-1">
                  <button 
                    onClick={() => handleLikeComentario(com.id)}
                    className="flex items-center gap-1 text-[#818384] hover:text-orange-500 transition-colors"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span className="text-xs font-bold">{com.total_curtidas}</span>
                  </button>
                  <button 
                    onClick={() => handleReply(com.autor_codigo)}
                    className="text-xs font-bold text-[#818384] hover:text-[#39FF14]"
                  >
                    Responder
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Fornecedor Modal */}
      <AnimatePresence>
        {showEmpresaForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#0A240A] border border-[#1A3A1A] rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-4 border-b border-[#1A3A1A] flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#39FF14]">Indicar Fornecedor</h2>
                  <p className="text-xs text-[#818384]">Item: <span className="font-mono text-[#39FF14]">{consulta.numero_item}</span></p>
                </div>
                <button onClick={() => setShowEmpresaForm(false)} className="p-1 hover:bg-[#39FF14]/10 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handlePostEmpresa} className="p-6 space-y-4">
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
                    onClick={() => setShowEmpresaForm(false)}
                    className="reddit-button-secondary py-2"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingEmpresa}
                    className="reddit-button-primary py-2 px-8"
                  >
                    {submittingEmpresa ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cadastrar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
