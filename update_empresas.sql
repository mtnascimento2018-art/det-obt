ALTER TABLE empresas ADD COLUMN consulta_id INTEGER;
UPDATE empresas SET consulta_id = (SELECT id FROM consultas WHERE consultas.numero_item = empresas.numero_item LIMIT 1);
