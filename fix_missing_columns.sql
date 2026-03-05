-- Execute este script no SQL Editor do seu painel do Supabase para adicionar as colunas que faltam

-- 1. Adicionar status na tabela de amizades (para gerenciar pendente/aceito)
ALTER TABLE amizades ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente';

-- 2. Adicionar colunas de controle de status na tabela de consultas
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS alterado_por TEXT;
ALTER TABLE consultas ADD COLUMN IF NOT EXISTS data_status TIMESTAMP WITH TIME ZONE;
