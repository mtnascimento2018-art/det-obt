export type Perfil = 'usuario' | 'obtencao' | 'catalogacao' | 'diretoria' | 'especialista' | 'admin';

export interface Usuario {
  id: number;
  nome: string; // Nome de Guerra
  nome_completo?: string;
  posto_graduacao?: string;
  codigo_interno: string; // NIP
  organizacao_militar: string;
  ramal?: string;
  perfil: Perfil;
  foto_perfil?: string;
  funcao?: string;
  conhecimento_material?: string;
  ativo?: number; // 1 for true, 0 for false
}

export type StatusConsulta = 'aberto' | 'resolvido' | 'reaberto';

export interface Consulta {
  id: number;
  numero_item: string;
  nome_item: string;
  aplicacao?: string;
  nome_coloquial?: string;
  meio_operacional?: string;
  classificacao?: string;
  descricao: string;
  arquivo_url?: string;
  usuario_id: number;
  status: StatusConsulta;
  alterado_por?: string;
  data_status?: string;
  visualizacoes: number;
  data_criacao: string;
  autor_nome: string;
  autor_om: string;
  autor_perfil?: string;
  total_comentarios: number;
  total_curtidas: number;
}

export interface Comentario {
  id: number;
  consulta_id: number;
  usuario_id: number;
  texto: string;
  arquivo_url?: string;
  data_criacao: string;
  autor_nome: string;
  autor_om: string;
  autor_codigo: string;
  autor_foto?: string;
  autor_funcao?: string;
  autor_posto?: string;
  autor_perfil?: string;
  total_curtidas: number;
}

export interface Empresa {
  id: number;
  numero_item: string;
  cnpj?: string;
  razao_social: string;
  telefones?: string; // Armazenado como JSON string
  emails?: string; // Armazenado como JSON string
  tipo: 'fabrica' | 'fornece' | 'similar';
  usuario_id: number;
  indicado_por: string;
  data_indicacao: string;
  total_validacoes: number;
  validado_por_mim?: boolean;
}

export interface RankingItem {
  nome: string;
  codigo_interno: string;
  organizacao_militar: string;
  total_respostas: number;
  total_curtidas_recebidas: number;
  total_consultas: number;
  total_fornecedores: number;
  total_validacoes_feitas: number;
  pontuacao_total: number;
}

export interface Notificacao {
  id: number;
  usuario_id: number;
  tipo: 'resposta' | 'mencao' | 'status';
  mensagem: string;
  link?: string;
  lida: number;
  data_criacao: string;
}

export interface Conversa {
  id: number;
  usuario1_id: number;
  usuario2_id: number;
  u1_nome: string;
  u1_codigo: string;
  u2_nome: string;
  u2_codigo: string;
  ultima_mensagem?: string;
  data_ultima_mensagem: string;
}

export interface MensagemChat {
  id: number;
  conversa_id: number;
  remetente_id: number;
  remetente_nome: string;
  texto?: string;
  arquivo_url?: string;
  data_envio: string;
}

export interface AuditoriaLog {
  id: number;
  usuario_id: number | null;
  nome_guerra: string;
  perfil: string;
  acao: string;
  descricao: string;
  objeto_afetado: string | null;
  organizacao_militar: string;
  data_hora: string;
}
