import React, { useState, useEffect } from 'react';
import { X, Camera, Loader2, Save, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Usuario } from '../types';

interface ProfileModalProps {
  user: Usuario;
  onClose: () => void;
  onUpdate: (updatedUser: Usuario) => void;
}

export default function ProfileModal({ user, onClose, onUpdate }: ProfileModalProps) {
  const [formData, setFormData] = useState({
    nome: user.nome || '',
    nome_completo: user.nome_completo || '',
    posto_graduacao: user.posto_graduacao || '',
    organizacao_militar: user.organizacao_militar || '',
    foto_perfil: user.foto_perfil || '',
    funcao: user.funcao || '',
    conhecimento_material: user.conhecimento_material || '',
    perfil: user.perfil || 'usuario',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [oms, setOms] = useState<{id: number, nome: string}[]>([]);
  const [funcoes, setFuncoes] = useState<{id: number, nome: string}[]>([]);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const [omsRes, funcoesRes] = await Promise.all([
          fetch('/api/config/oms'),
          fetch('/api/config/funcoes')
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

        if (omsData) setOms(omsData);
        if (funcoesData) setFuncoes(funcoesData);
      } catch (err) {
        console.error('Erro ao carregar configurações', err);
      }
    };
    fetchConfigs();
  }, []);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, foto_perfil: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/users/${user.id}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        onUpdate(updatedUser);
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || 'Erro ao atualizar perfil');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor');
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
        className="bg-[#0A240A] border border-[#1A3A1A] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="p-4 border-b border-[#1A3A1A] flex items-center justify-between sticky top-0 bg-[#0A240A] z-10">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-[#39FF14]" />
            <h2 className="text-lg font-bold text-[#39FF14]">Meu Perfil Militar</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-[#39FF14]/10 rounded-full text-[#818384] hover:text-[#39FF14] transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex flex-col items-center mb-6">
            <div className="relative group">
              <div className="w-28 h-28 rounded-full bg-[#051A05] border-2 border-dashed border-[#1A3A1A] flex items-center justify-center overflow-hidden group-hover:border-[#39FF14] transition-colors">
                {formData.foto_perfil ? (
                  <img src={formData.foto_perfil} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <Camera className="w-10 h-10 text-[#818384] group-hover:text-[#39FF14]" />
                )}
              </div>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handlePhotoUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <div className="absolute bottom-0 right-0 p-1.5 bg-[#39FF14] rounded-full text-[#051A05] shadow-lg">
                <Camera className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[10px] text-[#818384] mt-3 uppercase font-bold tracking-widest">Alterar Foto de Perfil</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">Nome Completo</label>
              <input
                required
                type="text"
                value={formData.nome_completo}
                onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                className="w-full reddit-input text-sm"
                placeholder="Nome Completo"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">Posto / Graduação</label>
              <input
                required
                type="text"
                value={formData.posto_graduacao}
                onChange={(e) => setFormData({ ...formData, posto_graduacao: e.target.value })}
                className="w-full reddit-input text-sm"
                placeholder="Ex: 1º Ten, SO, 2º SG..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">NIP (Código Militar)</label>
              <input
                disabled
                type="text"
                value={user.codigo_interno}
                className="w-full reddit-input text-sm font-mono opacity-50 cursor-not-allowed bg-[#051A05]"
              />
              <p className="text-[8px] text-[#818384] italic">O NIP não pode ser alterado pelo usuário.</p>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">Nome de Guerra</label>
              <input
                required
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="w-full reddit-input text-sm"
                placeholder="Ex: Silva, Santos..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">OM (Organização Militar)</label>
              <select
                required
                value={formData.organizacao_militar}
                onChange={(e) => setFormData({ ...formData, organizacao_militar: e.target.value })}
                className="w-full reddit-input text-sm"
              >
                <option value="">Selecione a OM</option>
                {oms.map(o => <option key={o.id} value={o.nome}>{o.nome}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">Perfil de Acesso</label>
              <select
                required
                disabled={user.perfil === 'admin'}
                value={formData.perfil}
                onChange={(e) => setFormData({ ...formData, perfil: e.target.value as any })}
                className={`w-full reddit-input text-sm ${user.perfil === 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <option value="usuario">Militar Usuário</option>
                <option value="obtencao">Seção de Obtenção</option>
                <option value="catalogacao">Seção de Catalogação</option>
                <option value="diretoria">Diretoria</option>
                <option value="especialista">Especialista</option>
                {user.perfil === 'admin' && <option value="admin">Administrador</option>}
              </select>
              {user.perfil === 'admin' && <p className="text-[8px] text-[#818384] italic">O perfil Admin só pode ser alterado por outro Admin.</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">Função Atual</label>
              <select
                required
                value={formData.funcao}
                onChange={(e) => setFormData({ ...formData, funcao: e.target.value })}
                className="w-full reddit-input text-sm"
              >
                <option value="">Selecione a Função</option>
                {funcoes.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-[#39FF14] uppercase tracking-widest">Conhecimento de Material / Especialidade</label>
            <textarea
              required
              value={formData.conhecimento_material}
              onChange={(e) => setFormData({ ...formData, conhecimento_material: e.target.value })}
              className="w-full reddit-input text-sm h-24 resize-none"
              placeholder="Descreva brevemente suas especialidades técnicas..."
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs text-center font-bold uppercase tracking-tight">{error}</p>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-[#1A3A1A]">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 text-xs font-bold uppercase tracking-widest text-[#818384] hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="reddit-button-primary flex items-center justify-center gap-2 px-8 py-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar Alterações</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
