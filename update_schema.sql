-- Execute este script no SQL Editor do seu painel do Supabase para corrigir as tabelas

-- Adicionar coluna de visualizações na tabela de consultas
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS visualizacoes INTEGER DEFAULT 0;

-- Adicionar coluna de data de indicação na tabela de empresas
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS data_indicacao TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Garantir que as tabelas de amizade e notificações tenham as permissões corretas (caso RLS esteja ativo)
-- (Opcional, pois o backend agora usa a chave de serviço para contornar, mas é bom ter)
ALTER TABLE amizades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir tudo para amizades" ON amizades FOR ALL USING (true);

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir tudo para notificacoes" ON notificacoes FOR ALL USING (true);
