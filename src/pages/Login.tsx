import React, { useState, useEffect } from 'react';
import { Search, Loader2, Sparkles, Camera, Anchor } from 'lucide-react';
import { motion } from 'motion/react';
import { Usuario, Perfil } from '../types';

interface LoginProps {
  onLogin: (user: Usuario) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [codigo, setCodigo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Register state
  const [regData, setRegData] = useState({
    nome: '', // Nome de Guerra
    nome_completo: '',
    posto_graduacao: '',
    codigo_interno: '', // NIP
    organizacao_militar: '',
    funcao: '',
    conhecimento_material: '',
    foto_perfil: '',
    perfil: 'usuario' as Perfil
  });

  const [oms, setOms] = useState<{id: number, nome: string}[]>([]);
  const [funcoes, setFuncoes] = useState<{id: number, nome: string}[]>([]);
  const [conhecimentos, setConhecimentos] = useState<{id: number, nome: string}[]>([]);

  const [showOtherOm, setShowOtherOm] = useState(false);
  const [showOtherFuncao, setShowOtherFuncao] = useState(false);
  const [showOtherConhecimento, setShowOtherConhecimento] = useState(false);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const [omsRes, funcoesRes, conhecimentosRes] = await Promise.all([
          fetch('/api/config/oms'),
          fetch('/api/config/funcoes'),
          fetch('/api/config/conhecimentos')
        ]);
        
        const safeJson = async (res: Response) => {
          if (!res.ok) return null;
          const text = await res.text();
          try {
            return JSON.parse(text);
          } catch (e) {
            console.error('Falha ao parsear JSON da rota:', res.url, text.substring(0, 100));
            return null;
          }
        };

        const omsData = await safeJson(omsRes);
        const funcoesData = await safeJson(funcoesRes);
        const conhecimentosData = await safeJson(conhecimentosRes);

        if (omsData) setOms(omsData);
        if (funcoesData) setFuncoes(funcoesData);
        if (conhecimentosData) setConhecimentos(conhecimentosData);
      } catch (err) {
        console.error('Erro ao carregar configurações', err);
      }
    };
    fetchConfigs();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigo) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo_interno: codigo }),
      });

      if (response.ok) {
        const user = await response.json();
        onLogin(user);
      } else {
        const data = await response.json();
        if (response.status === 403) {
          setError("Usuário desativado, contate o Administrador");
        } else {
          setError(data.error || 'Erro ao fazer login');
        }
      }
    } catch (err) {
      setError('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regData),
      });

      if (response.ok) {
        const user = await response.json();
        onLogin(user);
      } else {
        const data = await response.json();
        setError(data.error || 'Erro ao realizar cadastro');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setRegData({ ...regData, foto_perfil: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#051A05] px-4 py-12 overflow-y-auto relative">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#39FF14]/10 blur-[120px] rounded-full pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`max-w-md w-full relative z-10 ${mode === 'register' ? 'max-w-2xl' : ''}`}
      >
        <div className="text-center mb-10">
          <motion.div 
            animate={{ 
              boxShadow: ["0 0 20px rgba(57,255,20,0.2)", "0 0 40px rgba(57,255,20,0.4)", "0 0 20px rgba(57,255,20,0.2)"]
            }}
            transition={{ duration: 3, repeat: Infinity }}
            className="w-16 h-16 bg-[#39FF14] rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <Search className="w-10 h-10 text-[#051A05]" />
          </motion.div>
          <h1 className="text-4xl font-black tracking-tighter mb-1 text-[#39FF14] italic">Detetive Obtenção</h1>
          <p className="text-[#818384] text-[10px] uppercase tracking-[0.3em] font-bold">Uma base de apoio a obtenção</p>
          <p className="text-[#39FF14] text-[12px] uppercase tracking-[0.4em] font-black mt-2">Marinha do Brasil</p>
        </div>

        <div className="bg-[#0A240A] border border-[#1A3A1A] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          {/* Decorative line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#39FF14] to-transparent opacity-50" />
          
          <div className="flex mb-8 bg-[#051A05] p-1 rounded-lg border border-[#1A3A1A]">
            <button 
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded transition-all ${mode === 'login' ? 'bg-[#39FF14] text-[#051A05]' : 'text-[#818384] hover:text-[#39FF14]'}`}
            >
              Acessar
            </button>
            <button 
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest rounded transition-all ${mode === 'register' ? 'bg-[#39FF14] text-[#051A05]' : 'text-[#818384] hover:text-[#39FF14]'}`}
            >
              Cadastrar
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label htmlFor="codigo" className="block text-[10px] font-bold mb-2 text-[#39FF14] uppercase tracking-widest">
                  NIP (Código Militar)
                </label>
                <input
                  id="codigo"
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="Digite seu NIP"
                  className="w-full reddit-input text-xl font-mono tracking-widest text-center"
                  required
                />
              </div>

              {error && (
                <p className="text-red-500 text-xs text-center font-bold uppercase tracking-tight">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full reddit-button-primary flex items-center justify-center gap-3 py-4 text-lg shadow-[0_0_20px_rgba(57,255,20,0.3)]"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <span>Acessar Sistema</span>
                    <Sparkles className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="flex flex-col items-center mb-6">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full bg-[#051A05] border-2 border-dashed border-[#1A3A1A] flex items-center justify-center overflow-hidden group-hover:border-[#39FF14] transition-colors">
                    {regData.foto_perfil ? (
                      <img src={regData.foto_perfil} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Camera className="w-8 h-8 text-[#818384] group-hover:text-[#39FF14]" />
                    )}
                  </div>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handlePhotoUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <p className="text-[10px] text-[#818384] mt-2 uppercase font-bold">Foto de Perfil (Opcional)</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold mb-1 text-[#39FF14] uppercase">Nome Completo</label>
                  <input
                    required
                    type="text"
                    value={regData.nome_completo}
                    onChange={(e) => setRegData({ ...regData, nome_completo: e.target.value })}
                    className="w-full reddit-input text-sm"
                    placeholder="Nome Completo"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1 text-[#39FF14] uppercase">Posto / Graduação</label>
                  <input
                    required
                    type="text"
                    value={regData.posto_graduacao}
                    onChange={(e) => setRegData({ ...regData, posto_graduacao: e.target.value })}
                    className="w-full reddit-input text-sm"
                    placeholder="Ex: 1º Ten, SO, 2º SG..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold mb-1 text-[#39FF14] uppercase">NIP (Código Militar)</label>
                  <input
                    required
                    type="text"
                    value={regData.codigo_interno}
                    onChange={(e) => setRegData({ ...regData, codigo_interno: e.target.value })}
                    className="w-full reddit-input text-sm font-mono"
                    placeholder="Ex: 12345678"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1 text-[#39FF14] uppercase">Nome de Guerra</label>
                  <input
                    required
                    type="text"
                    value={regData.nome}
                    onChange={(e) => setRegData({ ...regData, nome: e.target.value })}
                    className="w-full reddit-input text-sm"
                    placeholder="Ex: Silva, Santos..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold mb-1 text-[#39FF14] uppercase">OM (Organização Militar)</label>
                  {!showOtherOm ? (
                    <select
                      required
                      value={regData.organizacao_militar}
                      onChange={(e) => {
                        if (e.target.value === 'outro') {
                          setShowOtherOm(true);
                          setRegData({ ...regData, organizacao_militar: '' });
                        } else {
                          setRegData({ ...regData, organizacao_militar: e.target.value });
                        }
                      }}
                      className="w-full reddit-input text-sm"
                    >
                      <option value="">Selecione a OM</option>
                      {oms.map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
                      <option value="outro" className="text-[#39FF14] font-bold">Outro...</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        required
                        type="text"
                        value={regData.organizacao_militar}
                        onChange={(e) => setRegData({ ...regData, organizacao_militar: e.target.value })}
                        className="w-full reddit-input text-sm"
                        placeholder="Digite a OM"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowOtherOm(false)}
                        className="text-[10px] text-[#818384] hover:text-[#39FF14]"
                      >
                        Voltar
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1 text-[#39FF14] uppercase">Perfil de Acesso</label>
                  <select
                    required
                    value={regData.perfil}
                    onChange={(e) => setRegData({ ...regData, perfil: e.target.value as Perfil })}
                    className="w-full reddit-input text-sm"
                  >
                    <option value="usuario">Militar Usuário</option>
                    <option value="obtencao">Seção de Obtenção</option>
                    <option value="catalogacao">Seção de Catalogação</option>
                    <option value="diretoria">Diretoria</option>
                    <option value="especialista">Especialista</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-1 text-[#39FF14] uppercase">Função Atual</label>
                {!showOtherFuncao ? (
                  <select
                    required
                    value={regData.funcao}
                    onChange={(e) => {
                      if (e.target.value === 'outro') {
                        setShowOtherFuncao(true);
                        setRegData({ ...regData, funcao: '' });
                      } else {
                        setRegData({ ...regData, funcao: e.target.value });
                      }
                    }}
                    className="w-full reddit-input text-sm"
                  >
                    <option value="">Selecione a Função</option>
                    {funcoes.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                    <option value="outro" className="text-[#39FF14] font-bold">Outro...</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      required
                      type="text"
                      value={regData.funcao}
                      onChange={(e) => setRegData({ ...regData, funcao: e.target.value })}
                      className="w-full reddit-input text-sm"
                      placeholder="Digite a Função"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowOtherFuncao(false)}
                      className="text-[10px] text-[#818384] hover:text-[#39FF14]"
                    >
                      Voltar
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-1 text-[#39FF14] uppercase">Conhecimento de Material / Especialidade</label>
                {!showOtherConhecimento ? (
                  <select
                    required
                    value={regData.conhecimento_material}
                    onChange={(e) => {
                      if (e.target.value === 'outro') {
                        setShowOtherConhecimento(true);
                        setRegData({ ...regData, conhecimento_material: '' });
                      } else {
                        setRegData({ ...regData, conhecimento_material: e.target.value });
                      }
                    }}
                    className="w-full reddit-input text-sm"
                  >
                    <option value="">Selecione a Especialidade</option>
                    {conhecimentos.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                    <option value="outro" className="text-[#39FF14] font-bold">Outro...</option>
                  </select>
                ) : (
                  <div className="flex flex-col gap-2">
                    <textarea
                      required
                      value={regData.conhecimento_material}
                      onChange={(e) => setRegData({ ...regData, conhecimento_material: e.target.value })}
                      className="w-full reddit-input text-sm h-20 resize-none"
                      placeholder="Descreva brevemente suas especialidades técnicas..."
                    />
                    <button 
                      type="button"
                      onClick={() => setShowOtherConhecimento(false)}
                      className="text-[10px] text-[#818384] hover:text-[#39FF14] self-end"
                    >
                      Voltar para lista
                    </button>
                  </div>
                )}
              </div>

              {error && (
                <p className="text-red-500 text-xs text-center font-bold uppercase tracking-tight">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full reddit-button-primary flex items-center justify-center gap-3 py-4 text-lg shadow-[0_0_20px_rgba(57,255,20,0.3)]"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <span>Finalizar Cadastro</span>
                    <Sparkles className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-[#1A3A1A] text-center">
            <p className="text-[10px] text-[#818384] uppercase font-bold tracking-tighter leading-relaxed">
              {mode === 'login' 
                ? "Acesso restrito a militares cadastrados." 
                : "Todos os campos são obrigatórios para a segurança do sistema."}
            </p>
          </div>
        </div>

        <div className="mt-8 text-center space-y-2">
          <p className="text-[10px] text-[#39FF14]/40 font-mono uppercase tracking-[0.2em]">
            Tecnologia + Operacional + Intendência
          </p>
          <p className="text-[9px] text-[#818384] uppercase tracking-[0.3em] font-bold">
            Desenvolvido por COpAb
          </p>
        </div>
      </motion.div>
    </div>
  );
}
