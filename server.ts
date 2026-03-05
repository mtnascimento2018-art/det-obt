import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("sitec.db");
db.pragma('foreign_keys = ON');

// Supabase Client for migration
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL, -- Nome de Guerra
    nome_completo TEXT,
    posto_graduacao TEXT,
    codigo_interno TEXT UNIQUE NOT NULL, -- NIP
    organizacao_militar TEXT NOT NULL,
    ramal TEXT,
    perfil TEXT CHECK(perfil IN ('usuario', 'obtencao', 'admin')) DEFAULT 'usuario',
    foto_perfil TEXT,
    funcao TEXT,
    conhecimento_material TEXT,
    ativo INTEGER DEFAULT 1 -- 1 for true, 0 for false
  );

  CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    nome_guerra TEXT,
    perfil TEXT,
    acao TEXT NOT NULL,
    descricao TEXT,
    objeto_afetado TEXT,
    organizacao_militar TEXT,
    data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS classificacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE NOT NULL
  );
`);

// Seed initial classifications if empty
const classCount = (db.prepare("SELECT COUNT(*) as count FROM classificacoes").get() as { count: number }).count;
if (classCount === 0) {
  const initialClasses = ['Comum', 'Saúde', 'Sobressalentes', 'Fardamento'];
  const insertClass = db.prepare("INSERT INTO classificacoes (nome) VALUES (?)");
  initialClasses.forEach(c => insertClass.run(c));
}

db.exec(`
  CREATE TABLE IF NOT EXISTS consultas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_item TEXT NOT NULL,
    nome_item TEXT NOT NULL,
    aplicacao TEXT,
    nome_coloquial TEXT,
    meio_operacional TEXT,
    classificacao TEXT,
    descricao TEXT NOT NULL,
    arquivo_url TEXT,
    usuario_id INTEGER NOT NULL,
    status TEXT CHECK(status IN ('aberto', 'resolvido', 'reaberto')) DEFAULT 'aberto',
    alterado_por TEXT,
    data_status DATETIME,
    visualizacoes INTEGER DEFAULT 0,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comentarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consulta_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    texto TEXT NOT NULL,
    arquivo_url TEXT,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(consulta_id) REFERENCES consultas(id) ON DELETE CASCADE,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS empresas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_item TEXT NOT NULL,
    cnpj TEXT,
    razao_social TEXT NOT NULL,
    telefones TEXT, -- JSON array string
    emails TEXT, -- JSON array string
    tipo TEXT CHECK(tipo IN ('fabrica', 'fornece', 'similar')),
    indicado_por_id INTEGER NOT NULL,
    data_indicacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(indicado_por_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS validacoes_empresas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    empresa_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    data_validacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(empresa_id, usuario_id),
    FOREIGN KEY(empresa_id) REFERENCES empresas(id) ON DELETE CASCADE,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS curtidas_comentarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comentario_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    UNIQUE(comentario_id, usuario_id),
    FOREIGN KEY(comentario_id) REFERENCES comentarios(id) ON DELETE CASCADE,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS curtidas_consultas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consulta_id INTEGER NOT NULL,
    usuario_id INTEGER NOT NULL,
    UNIQUE(consulta_id, usuario_id),
    FOREIGN KEY(consulta_id) REFERENCES consultas(id) ON DELETE CASCADE,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notificacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    tipo TEXT NOT NULL, -- 'resposta', 'mencao', 'status'
    mensagem TEXT NOT NULL,
    link TEXT,
    lida INTEGER DEFAULT 0,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS amizades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    amigo_id INTEGER NOT NULL,
    status TEXT CHECK(status IN ('pendente', 'aceito')) DEFAULT 'pendente',
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(usuario_id, amigo_id),
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY(amigo_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS conversas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario1_id INTEGER NOT NULL,
    usuario2_id INTEGER NOT NULL,
    data_ultima_mensagem DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(usuario1_id, usuario2_id),
    FOREIGN KEY(usuario1_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY(usuario2_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS mensagens_chat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversa_id INTEGER NOT NULL,
    remetente_id INTEGER NOT NULL,
    texto TEXT,
    arquivo_url TEXT,
    data_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(conversa_id) REFERENCES conversas(id) ON DELETE CASCADE,
    FOREIGN KEY(remetente_id) REFERENCES usuarios(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS oms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS funcoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conhecimentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE NOT NULL
  );
`);

// Migrations for existing databases
const tableInfo = db.prepare("PRAGMA table_info(comentarios)").all() as any[];
const hasArquivoUrl = tableInfo.some(col => col.name === 'arquivo_url');
if (!hasArquivoUrl) {
  try {
    db.prepare("ALTER TABLE comentarios ADD COLUMN arquivo_url TEXT").run();
    console.log("Migração: Coluna 'arquivo_url' adicionada à tabela 'comentarios'.");
  } catch (e) {
    console.error("Erro na migração comentarios:", e);
  }
}

const consultasTableInfo = db.prepare("PRAGMA table_info(consultas)").all() as any[];
const hasClassificacao = consultasTableInfo.some(col => col.name === 'classificacao');
if (!hasClassificacao) {
  try {
    db.prepare("ALTER TABLE consultas ADD COLUMN classificacao TEXT").run();
    console.log("Migração: Coluna 'classificacao' adicionada à tabela 'consultas'.");
  } catch (e) {
    console.error("Erro na migração consultas:", e);
  }
}

const empresasTableInfo = db.prepare("PRAGMA table_info(empresas)").all() as any[];
const hasConsultaId = empresasTableInfo.some(col => col.name === 'consulta_id');
if (!hasConsultaId) {
  try {
    db.prepare("ALTER TABLE empresas ADD COLUMN consulta_id INTEGER").run();
    console.log("Migração: Coluna 'consulta_id' adicionada à tabela 'empresas'.");
  } catch (e) {
    console.error("Erro na migração empresas:", e);
  }
}

const userTableInfo = db.prepare("PRAGMA table_info(usuarios)").all() as any[];
const newColumns = [
  { name: 'nome_completo', type: 'TEXT' },
  { name: 'posto_graduacao', type: 'TEXT' },
  { name: 'foto_perfil', type: 'TEXT' },
  { name: 'funcao', type: 'TEXT' },
  { name: 'conhecimento_material', type: 'TEXT' },
  { name: 'ativo', type: 'INTEGER DEFAULT 1' }
];

newColumns.forEach(col => {
  if (!userTableInfo.some(c => c.name === col.name)) {
    try {
      db.prepare(`ALTER TABLE usuarios ADD COLUMN ${col.name} ${col.type}`).run();
      console.log(`Migração: Coluna '${col.name}' adicionada à tabela 'usuarios'.`);
    } catch (e) {
      console.error(`Erro na migração usuarios (${col.name}):`, e);
    }
  }
});

// Seed Admin if not exists
const adminExists = db.prepare("SELECT id FROM usuarios WHERE codigo_interno = ?").get("admin");
if (!adminExists) {
  db.prepare("INSERT INTO usuarios (nome, codigo_interno, organizacao_militar, perfil) VALUES (?, ?, ?, ?)").run(
    "Administrador", "admin", "OM Central", "admin"
  );
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json({ limit: '50mb' }));

  app.get("/api/admin/migrate-to-supabase", async (req, res) => {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase não configurado nos secrets." });
    }

    const results: any = {};

    const migrate = async (tableName: string, sqliteTable: string, transform?: (row: any) => any) => {
      try {
        const rows = db.prepare(`SELECT * FROM ${sqliteTable}`).all();
        if (rows.length === 0) {
          results[tableName] = "Vazia";
          return;
        }
        const transformed = transform ? rows.map(transform) : rows;
        
        // Delete existing to avoid conflicts during migration
        await supabase.from(tableName).delete().neq('id', -1); 

        const { error } = await supabase.from(tableName).insert(transformed);
        if (error) throw error;
        results[tableName] = `Sucesso (${rows.length} registros)`;
      } catch (err: any) {
        results[tableName] = `Erro: ${err.message}`;
      }
    };

    await migrate('usuarios', 'usuarios', (r) => ({
      ...r,
      ativo: r.ativo === 1
    }));
    await migrate('consultas', 'consultas');
    await migrate('comentarios', 'comentarios');
    await migrate('empresas', 'empresas', (r) => ({
      ...r,
      indicado_por_id: r.indicado_por_id
    }));
    await migrate('curtidas_consultas', 'curtidas_consultas', (r) => {
      const { id, ...rest } = r;
      return rest;
    });
    await migrate('curtidas_comentarios', 'curtidas_comentarios', (r) => {
      const { id, ...rest } = r;
      return rest;
    });
    await migrate('validacoes_empresas', 'validacoes_empresas', (r) => {
      const { id, ...rest } = r;
      return rest;
    });
    await migrate('notificacoes', 'notificacoes', (r) => ({
      ...r,
      lida: r.lida === 1
    }));
    await migrate('amizades', 'amizades', (r) => {
      const { id, ...rest } = r;
      return rest;
    });
    await migrate('auditoria', 'auditoria');

    res.json(results);
  });

  const PORT = 3000;

  // WebSocket logic for real-time notifications and chat
  const clients = new Map<number, WebSocket>();

  wss.on("connection", (ws, req) => {
    let userId: number | null = null;

    ws.on("message", (message) => {
      const data = JSON.parse(message.toString());
      if (data.type === "auth") {
        userId = data.userId;
        if (userId) clients.set(userId, ws);
      }
    });

    ws.on("close", () => {
      if (userId) clients.delete(userId);
    });
  });

  const sendNotification = (userId: number, notification: any) => {
    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "notification", data: notification }));
    }
  };

  const logAuditoria = (usuario_id: number | null, acao: string, descricao: string, objeto_afetado?: string) => {
    let user = null;
    if (usuario_id) {
      user = db.prepare("SELECT nome, perfil, organizacao_militar FROM usuarios WHERE id = ?").get(usuario_id);
    }
    
    db.prepare(`
      INSERT INTO auditoria (usuario_id, nome_guerra, perfil, acao, descricao, objeto_afetado, organizacao_militar)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      usuario_id, 
      user ? user.nome : 'Sistema/Deslogado', 
      user ? user.perfil : 'N/A', 
      acao, 
      descricao, 
      objeto_afetado || null, 
      user ? user.organizacao_militar : 'N/A'
    );
  };

  // Auth API
  app.post("/api/login", (req, res) => {
    const { codigo_interno } = req.body;
    let user = db.prepare("SELECT * FROM usuarios WHERE codigo_interno = ?").get(codigo_interno);
    
    if (!user) {
      logAuditoria(null, 'Login Inválido', `Tentativa de login com NIP: ${codigo_interno}`);
      return res.status(404).json({ error: "Militar não cadastrado. Por favor, realize o cadastro." });
    }

    if (user.ativo === 0) {
      logAuditoria(user.id, 'Login Bloqueado', `Usuário desativado tentou acessar o sistema.`);
      return res.status(403).json({ error: "Sua conta está desativada. Entre em contato com o administrador." });
    }
    
    logAuditoria(user.id, 'Login Realizado', `Usuário ${user.nome} acessou o sistema.`);
    res.json(user);
  });

  app.post("/api/register", (req, res) => {
    const { 
      nome, 
      nome_completo, 
      posto_graduacao, 
      codigo_interno, 
      organizacao_militar, 
      foto_perfil, 
      funcao, 
      conhecimento_material 
    } = req.body;

    try {
      // Auto-feed the lists if they are new
      if (organizacao_militar) {
        db.prepare("INSERT OR IGNORE INTO oms (nome) VALUES (?)").run(organizacao_militar.trim());
      }
      if (funcao) {
        db.prepare("INSERT OR IGNORE INTO funcoes (nome) VALUES (?)").run(funcao.trim());
      }
      if (conhecimento_material) {
        db.prepare("INSERT OR IGNORE INTO conhecimentos (nome) VALUES (?)").run(conhecimento_material.trim());
      }

      const info = db.prepare(`
        INSERT INTO usuarios (
          nome, nome_completo, posto_graduacao, codigo_interno, 
          organizacao_militar, foto_perfil, funcao, conhecimento_material, perfil
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'usuario')
      `).run(
        nome, nome_completo, posto_graduacao, codigo_interno, 
        organizacao_militar, foto_perfil, funcao, conhecimento_material
      );
      
      const user = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(info.lastInsertRowid);
      logAuditoria(user.id, 'Cadastro Realizado', `Novo militar cadastrado: ${user.nome_completo} (${user.codigo_interno})`);
      res.json(user);
    } catch (e) {
      console.error("Erro no cadastro:", e);
      res.status(400).json({ error: "NIP já cadastrado ou erro nos dados." });
    }
  });

  // Notifications API
  app.get("/api/notificacoes/:userId", (req, res) => {
    const notifications = db.prepare("SELECT * FROM notificacoes WHERE usuario_id = ? ORDER BY data_criacao DESC LIMIT 50").all(req.params.userId);
    res.json(notifications);
  });

  app.post("/api/notificacoes/:id/lida", (req, res) => {
    db.prepare("UPDATE notificacoes SET lida = 1 WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Chat API
  app.get("/api/conversas/:userId", (req, res) => {
    const conversas = db.prepare(`
      SELECT c.*, 
      u1.nome as u1_nome, u1.codigo_interno as u1_codigo,
      u2.nome as u2_nome, u2.codigo_interno as u2_codigo,
      (SELECT texto FROM mensagens_chat WHERE conversa_id = c.id ORDER BY data_envio DESC LIMIT 1) as ultima_mensagem
      FROM conversas c
      JOIN usuarios u1 ON c.usuario1_id = u1.id
      JOIN usuarios u2 ON c.usuario2_id = u2.id
      WHERE c.usuario1_id = ? OR c.usuario2_id = ?
      ORDER BY c.data_ultima_mensagem DESC
    `).all(req.params.userId, req.params.userId);
    res.json(conversas);
  });

  app.get("/api/mensagens/:conversaId", (req, res) => {
    const mensagens = db.prepare(`
      SELECT m.*, u.nome as remetente_nome
      FROM mensagens_chat m
      JOIN usuarios u ON m.remetente_id = u.id
      WHERE m.conversa_id = ?
      ORDER BY m.data_envio ASC
    `).all(req.params.conversaId);
    res.json(mensagens);
  });

  app.post("/api/mensagens", (req, res) => {
    const { conversa_id, remetente_id, texto, arquivo_url, destinatario_id } = req.body;
    
    let cid = conversa_id;
    if (!cid && destinatario_id) {
      // Find or create conversation
      const u1 = Math.min(remetente_id, destinatario_id);
      const u2 = Math.max(remetente_id, destinatario_id);
      const existing = db.prepare("SELECT id FROM conversas WHERE usuario1_id = ? AND usuario2_id = ?").get(u1, u2);
      if (existing) {
        cid = existing.id;
      } else {
        const info = db.prepare("INSERT INTO conversas (usuario1_id, usuario2_id) VALUES (?, ?)").run(u1, u2);
        cid = info.lastInsertRowid;
      }
    }

    const info = db.prepare("INSERT INTO mensagens_chat (conversa_id, remetente_id, texto, arquivo_url) VALUES (?, ?, ?, ?)").run(
      cid, remetente_id, texto, arquivo_url
    );
    db.prepare("UPDATE conversas SET data_ultima_mensagem = CURRENT_TIMESTAMP WHERE id = ?").run(cid);
    
    const msg = db.prepare("SELECT m.*, u.nome as remetente_nome FROM mensagens_chat m JOIN usuarios u ON m.remetente_id = u.id WHERE m.id = ?").get(info.lastInsertRowid);
    
    // Notify recipient via WS
    const conversa = db.prepare("SELECT * FROM conversas WHERE id = ?").get(cid);
    const otherId = conversa.usuario1_id === remetente_id ? conversa.usuario2_id : conversa.usuario1_id;
    const client = clients.get(otherId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "chat_message", data: msg }));
    }

    logAuditoria(remetente_id, 'Mensagem Enviada', `Mensagem enviada no chat.`, cid.toString());
    res.json(msg);
  });

  // Profile Update API
  app.patch("/api/users/:id/profile", (req, res) => {
    const { id } = req.params;
    const { nome, nome_completo, posto_graduacao, organizacao_militar, foto_perfil, funcao, conhecimento_material } = req.body;
    
    try {
      db.prepare(`
        UPDATE usuarios SET 
          nome = ?, nome_completo = ?, posto_graduacao = ?, 
          organizacao_militar = ?, foto_perfil = ?, funcao = ?, 
          conhecimento_material = ?
        WHERE id = ?
      `).run(nome, nome_completo, posto_graduacao, organizacao_militar, foto_perfil, funcao, conhecimento_material, id);
      
      const user = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id);
      logAuditoria(parseInt(id), 'Alteração de Perfil', `Usuário atualizou seus dados cadastrais.`);
      res.json(user);
    } catch (e) {
      res.status(400).json({ error: "Erro ao atualizar perfil." });
    }
  });

  // Audit Logs API
  app.get("/api/auditoria", (req, res) => {
    const { objeto_afetado } = req.query;
    let query = `
      SELECT a.*, u.nome as nome_guerra, u.perfil, u.organizacao_militar
      FROM auditoria a
      LEFT JOIN usuarios u ON a.usuario_id = u.id
    `;
    let params = [];
    if (objeto_afetado) {
      query += " WHERE a.objeto_afetado = ?";
      params.push(objeto_afetado);
    }
    query += " ORDER BY a.data_hora DESC LIMIT 500";
    const logs = db.prepare(query).all(...params);
    res.json(logs);
  });

  app.get("/api/stats", (req, res) => {
    const stats: any = {};
    
    // OM com mais chamados abertos
    stats.oms_abertos = db.prepare(`
      SELECT u.organizacao_militar as label, COUNT(*) as value
      FROM consultas c
      JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.status = 'aberto'
      GROUP BY u.organizacao_militar
      ORDER BY value DESC
      LIMIT 10
    `).all();

    // OM com mais chamados resolvidos
    stats.oms_resolvidos = db.prepare(`
      SELECT u.organizacao_militar as label, COUNT(*) as value
      FROM consultas c
      JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.status = 'resolvido'
      GROUP BY u.organizacao_militar
      ORDER BY value DESC
      LIMIT 10
    `).all();

    // Itens com mais comentários
    stats.itens_comentarios = db.prepare(`
      SELECT c.numero_item as label, COUNT(com.id) as value
      FROM consultas c
      LEFT JOIN comentarios com ON c.id = com.consulta_id
      GROUP BY c.numero_item
      ORDER BY value DESC
      LIMIT 10
    `).all();

    // Itens com mais aplicações (usando o campo aplicacao)
    stats.itens_aplicacao = db.prepare(`
      SELECT aplicacao as label, COUNT(*) as value
      FROM consultas
      WHERE aplicacao IS NOT NULL AND aplicacao != ''
      GROUP BY aplicacao
      ORDER BY value DESC
      LIMIT 10
    `).all();

    // Itens com mais fornecedores
    stats.itens_fornecedores = db.prepare(`
      SELECT numero_item as label, COUNT(*) as value
      FROM empresas
      GROUP BY numero_item
      ORDER BY value DESC
      LIMIT 10
    `).all();

    res.json(stats);
  });

  // Users API (Admin)
  app.get("/api/users", (req, res) => {
    const { q } = req.query;
    if (q) {
      const users = db.prepare(`
        SELECT id, nome, codigo_interno, organizacao_militar, perfil, funcao 
        FROM usuarios 
        WHERE nome LIKE ? OR codigo_interno LIKE ? OR organizacao_militar LIKE ?
        LIMIT 10
      `).all(`%${q}%`, `%${q}%`, `%${q}%`);
      return res.json(users);
    }
    const users = db.prepare("SELECT * FROM usuarios").all();
    res.json(users);
  });

  app.get("/api/users/nip/:nip", (req, res) => {
    const { nip } = req.params;
    const user = db.prepare("SELECT * FROM usuarios WHERE codigo_interno = ?").get(nip);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json(user);
  });

  app.get("/api/users/nip/:nip", (req, res) => {
    const { nip } = req.params;
    const user = db.prepare("SELECT * FROM usuarios WHERE codigo_interno = ?").get(nip);
    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: "Usuário não encontrado" });
    }
  });

  app.post("/api/users", (req, res) => {
    const { nome, codigo_interno, organizacao_militar, ramal, perfil, admin_id } = req.body;
    try {
      const info = db.prepare("INSERT INTO usuarios (nome, codigo_interno, organizacao_militar, ramal, perfil) VALUES (?, ?, ?, ?, ?)").run(
        nome, codigo_interno, organizacao_militar, ramal, perfil
      );
      logAuditoria(admin_id, 'Criação de Usuário', `Admin criou novo usuário: ${nome} (${codigo_interno})`, info.lastInsertRowid.toString());
      res.json({ id: info.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: "Código interno já existe." });
    }
  });

  app.patch("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const { nome, codigo_interno, organizacao_militar, ramal, perfil, posto_graduacao, funcao, ativo, admin_id } = req.body;
    
    try {
      db.prepare(`
        UPDATE usuarios SET 
          nome = ?, codigo_interno = ?, organizacao_militar = ?, 
          ramal = ?, perfil = ?, posto_graduacao = ?, 
          funcao = ?, ativo = ?
        WHERE id = ?
      `).run(nome, codigo_interno, organizacao_militar, ramal, perfil, posto_graduacao, funcao, ativo ? 1 : 0, id);
      
      logAuditoria(admin_id, 'Alteração de Usuário', `Admin alterou dados do usuário ID: ${id}`);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: "Erro ao atualizar usuário." });
    }
  });

  app.delete("/api/users/:id", (req, res) => {
    const userId = req.params.id;
    try {
      const deleteUser = db.transaction(() => {
        // Manual cleanup for existing databases without ON DELETE CASCADE
        db.prepare("DELETE FROM curtidas_comentarios WHERE usuario_id = ?").run(userId);
        db.prepare("DELETE FROM curtidas_consultas WHERE usuario_id = ?").run(userId);
        db.prepare("DELETE FROM notificacoes WHERE usuario_id = ?").run(userId);
        db.prepare("DELETE FROM mensagens_chat WHERE remetente_id = ?").run(userId);
        
        // Find conversations to clean up their messages
        const userConversas = db.prepare("SELECT id FROM conversas WHERE usuario1_id = ? OR usuario2_id = ?").all(userId, userId);
        userConversas.forEach((c: any) => {
          db.prepare("DELETE FROM mensagens_chat WHERE conversa_id = ?").run(c.id);
        });
        db.prepare("DELETE FROM conversas WHERE usuario1_id = ? OR usuario2_id = ?").run(userId, userId);
        
        // Find consultations to clean up their comments and likes
        const userConsultas = db.prepare("SELECT id FROM consultas WHERE usuario_id = ?").all(userId);
        userConsultas.forEach((c: any) => {
          db.prepare("DELETE FROM comentarios WHERE consulta_id = ?").run(c.id);
          db.prepare("DELETE FROM curtidas_consultas WHERE consulta_id = ?").run(c.id);
        });
        
        db.prepare("DELETE FROM comentarios WHERE usuario_id = ?").run(userId);
        db.prepare("DELETE FROM consultas WHERE usuario_id = ?").run(userId);
        db.prepare("DELETE FROM empresas WHERE indicado_por_id = ?").run(userId);
        db.prepare("DELETE FROM usuarios WHERE id = ?").run(userId);
      });
      deleteUser();
      res.json({ success: true });
    } catch (e) {
      console.error("Erro ao deletar usuário:", e);
      res.status(500).json({ error: "Erro ao deletar usuário e seus registros vinculados." });
    }
  });

  // Friends API
  app.get("/api/amigos/:userId", (req, res) => {
    const amigos = db.prepare(`
      SELECT u.* FROM usuarios u
      JOIN amizades a ON (a.usuario_id = u.id OR a.amigo_id = u.id)
      WHERE (a.usuario_id = ? OR a.amigo_id = ?) AND a.status = 'aceito' AND u.id != ?
    `).all(req.params.userId, req.params.userId, req.params.userId);
    res.json(amigos);
  });

  app.get("/api/amizades/pendentes/:userId", (req, res) => {
    const pendentes = db.prepare(`
      SELECT a.id as amizade_id, u.* FROM usuarios u
      JOIN amizades a ON a.usuario_id = u.id
      WHERE a.amigo_id = ? AND a.status = 'pendente'
    `).all(req.params.userId);
    res.json(pendentes);
  });

  app.post("/api/amizades/solicitar", (req, res) => {
    const { usuario_id, amigo_id } = req.body;
    try {
      const info = db.prepare("INSERT INTO amizades (usuario_id, amigo_id, status) VALUES (?, ?, 'pendente')").run(usuario_id, amigo_id);
      
      // Notify recipient
      const sender = db.prepare("SELECT nome FROM usuarios WHERE id = ?").get(usuario_id);
      const msg = `${sender.nome} enviou um pedido de amizade.`;
      const notifInfo = db.prepare("INSERT INTO notificacoes (usuario_id, tipo, mensagem, link) VALUES (?, ?, ?, ?)").run(
        amigo_id, 'pedido_amizade', msg, '/chat'
      );
      const notif = db.prepare("SELECT * FROM notificacoes WHERE id = ?").get(notifInfo.lastInsertRowid);
      sendNotification(amigo_id, notif);

      res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: "Pedido já existe ou erro ao processar." });
    }
  });

  app.post("/api/amizades/responder", (req, res) => {
    const { amizade_id, aceitar, usuario_id } = req.body; // usuario_id is the one responding
    if (aceitar) {
      db.prepare("UPDATE amizades SET status = 'aceito' WHERE id = ?").run(amizade_id);
      
      // Notify requester
      const amizade = db.prepare("SELECT * FROM amizades WHERE id = ?").get(amizade_id);
      const responder = db.prepare("SELECT nome FROM usuarios WHERE id = ?").get(usuario_id);
      const msg = `${responder.nome} aceitou seu pedido de amizade.`;
      const notifInfo = db.prepare("INSERT INTO notificacoes (usuario_id, tipo, mensagem, link) VALUES (?, ?, ?, ?)").run(
        amizade.usuario_id, 'amizade_aceita', msg, '/chat'
      );
      const notif = db.prepare("SELECT * FROM notificacoes WHERE id = ?").get(notifInfo.lastInsertRowid);
      sendNotification(amizade.usuario_id, notif);

      res.json({ success: true });
    } else {
      db.prepare("DELETE FROM amizades WHERE id = ?").run(amizade_id);
      res.json({ success: true, recusado: true });
    }
  });

  // Classifications API
  app.get("/api/config/classificacoes", (req, res) => {
    res.json(db.prepare("SELECT * FROM classificacoes ORDER BY nome").all());
  });
  app.post("/api/config/classificacoes", (req, res) => {
    try {
      const info = db.prepare("INSERT INTO classificacoes (nome) VALUES (?)").run(req.body.nome);
      res.json({ id: info.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: "Classificação já cadastrada" });
    }
  });
  app.delete("/api/config/classificacoes/:id", (req, res) => {
    db.prepare("DELETE FROM classificacoes WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/amizades/status/:u1/:u2", (req, res) => {
    const { u1, u2 } = req.params;
    const amizade = db.prepare(`
      SELECT * FROM amizades 
      WHERE (usuario_id = ? AND amigo_id = ?) OR (usuario_id = ? AND amigo_id = ?)
    `).get(u1, u2, u2, u1);
    res.json(amizade || null);
  });

  // Consultations API
  app.get("/api/consultas", (req, res) => {
    const consultas = db.prepare(`
      SELECT c.*, u.nome as autor_nome, u.organizacao_militar as autor_om,
      (SELECT COUNT(*) FROM comentarios WHERE consulta_id = c.id) as total_comentarios,
      (SELECT COUNT(*) FROM curtidas_consultas WHERE consulta_id = c.id) as total_curtidas
      FROM consultas c
      JOIN usuarios u ON c.usuario_id = u.id
      ORDER BY c.data_criacao DESC
    `).all();
    res.json(consultas);
  });

  app.get("/api/consultas/:id", (req, res) => {
    const consulta = db.prepare(`
      SELECT c.*, u.nome as autor_nome, u.organizacao_militar as autor_om,
      (SELECT COUNT(*) FROM curtidas_consultas WHERE consulta_id = c.id) as total_curtidas
      FROM consultas c
      JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.id = ?
    `).get(req.params.id);
    
    if (consulta) {
      db.prepare("UPDATE consultas SET visualizacoes = visualizacoes + 1 WHERE id = ?").run(req.params.id);
      res.json(consulta);
    } else {
      res.status(404).json({ error: "Consulta não encontrada" });
    }
  });

  app.post("/api/consultas", (req, res) => {
    const { numero_item, nome_item, aplicacao, nome_coloquial, meio_operacional, classificacao, descricao, usuario_id, arquivo_url } = req.body;
    
    if (!numero_item || !nome_item || !descricao || !usuario_id) {
      return res.status(400).json({ error: "Os campos Número do Item, Nome do Item e Descrição são obrigatórios." });
    }

    const info = db.prepare(`
      INSERT INTO consultas (numero_item, nome_item, aplicacao, nome_coloquial, meio_operacional, classificacao, descricao, usuario_id, arquivo_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(numero_item, nome_item, aplicacao, nome_coloquial, meio_operacional, classificacao, descricao, usuario_id, arquivo_url);
    
    const consultaId = info.lastInsertRowid;
    logAuditoria(usuario_id, 'Criação de Chamado', `Novo chamado criado para o item: ${nome_item}`, consultaId.toString());
    const author = db.prepare("SELECT nome FROM usuarios WHERE id = ?").get(usuario_id);

    // Handle mentions (@codigo) in description
    const mentions = descricao.match(/@(\w+)/g);
    if (mentions) {
      const uniqueMentions = [...new Set(mentions)];
      uniqueMentions.forEach((m: string) => {
        const codigo = m.substring(1);
        const mentionedUser = db.prepare("SELECT id FROM usuarios WHERE codigo_interno = ?").get(codigo);
        if (mentionedUser && mentionedUser.id !== usuario_id) {
          const msg = `${author.nome} mencionou você na nova consulta "${nome_item}".`;
          const notifInfo = db.prepare("INSERT INTO notificacoes (usuario_id, tipo, mensagem, link) VALUES (?, ?, ?, ?)").run(
            mentionedUser.id, 'mencao', msg, `/consulta/${consultaId}`
          );
          const notif = db.prepare("SELECT * FROM notificacoes WHERE id = ?").get(notifInfo.lastInsertRowid);
          sendNotification(mentionedUser.id, notif);
        }
      });
    }

    res.json({ id: consultaId });
  });

  app.patch("/api/consultas/:id/status", (req, res) => {
    const { status, alterado_por, alterado_por_id } = req.body;
    console.log(`Alterando status do chamado ${req.params.id} para ${status} por ${alterado_por_id}`);
    const oldStatus = db.prepare("SELECT status FROM consultas WHERE id = ?").get(req.params.id).status;
    
    db.prepare("UPDATE consultas SET status = ?, alterado_por = ?, data_status = CURRENT_TIMESTAMP WHERE id = ?").run(
      status, alterado_por, req.params.id
    );
    
    logAuditoria(alterado_por_id, 'Alteração de Status', `Status alterado de ${oldStatus} para ${status}`, req.params.id);
    console.log(`Log de auditoria criado para o chamado ${req.params.id}`);
    
    // Notify author
    const consulta = db.prepare("SELECT * FROM consultas WHERE id = ?").get(req.params.id);
    if (consulta.usuario_id !== alterado_por_id) {
      const msg = `O status da sua consulta "${consulta.nome_item}" foi alterado para ${status} por ${alterado_por}.`;
      const notifInfo = db.prepare("INSERT INTO notificacoes (usuario_id, tipo, mensagem, link) VALUES (?, ?, ?, ?)").run(
        consulta.usuario_id, 'status', msg, `/consulta/${req.params.id}`
      );
      const notif = db.prepare("SELECT * FROM notificacoes WHERE id = ?").get(notifInfo.lastInsertRowid);
      sendNotification(consulta.usuario_id, notif);
    }

    res.json({ success: true });
  });

  // Comments API
  app.get("/api/consultas/:id/comentarios", (req, res) => {
    const comments = db.prepare(`
      SELECT c.*, u.nome as autor_nome, u.organizacao_militar as autor_om, u.codigo_interno as autor_codigo, 
      u.foto_perfil as autor_foto, u.funcao as autor_funcao, u.posto_graduacao as autor_posto, u.perfil as autor_perfil,
      (SELECT COUNT(*) FROM curtidas_comentarios WHERE comentario_id = c.id) as total_curtidas
      FROM comentarios c
      JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.consulta_id = ?
      ORDER BY c.data_criacao ASC
    `).all(req.params.id);
    res.json(comments);
  });

  app.post("/api/comentarios", (req, res) => {
    const { consulta_id, usuario_id, texto, arquivo_url } = req.body;
    const info = db.prepare("INSERT INTO comentarios (consulta_id, usuario_id, texto, arquivo_url) VALUES (?, ?, ?, ?)").run(
      consulta_id, usuario_id, texto, arquivo_url
    );

    logAuditoria(usuario_id, 'Comentário Realizado', `Usuário comentou no chamado ID: ${consulta_id}`, consulta_id.toString());

    // Notify author of consulta
    const consulta = db.prepare("SELECT * FROM consultas WHERE id = ?").get(consulta_id);
    const author = db.prepare("SELECT nome FROM usuarios WHERE id = ?").get(usuario_id);
    
    if (consulta.usuario_id !== usuario_id) {
      const msg = `${author.nome} respondeu à sua consulta "${consulta.nome_item}".`;
      const notifInfo = db.prepare("INSERT INTO notificacoes (usuario_id, tipo, mensagem, link) VALUES (?, ?, ?, ?)").run(
        consulta.usuario_id, 'resposta', msg, `/consulta/${consulta_id}`
      );
      const notif = db.prepare("SELECT * FROM notificacoes WHERE id = ?").get(notifInfo.lastInsertRowid);
      sendNotification(consulta.usuario_id, notif);
    }

    // Handle mentions (@codigo)
    const mentions = texto.match(/@(\w+)/g);
    if (mentions) {
      mentions.forEach((m: string) => {
        const codigo = m.substring(1);
        const mentionedUser = db.prepare("SELECT id FROM usuarios WHERE codigo_interno = ?").get(codigo);
        if (mentionedUser && mentionedUser.id !== usuario_id) {
          const msg = `${author.nome} mencionou você em um comentário na consulta "${consulta.nome_item}".`;
          const notifInfo = db.prepare("INSERT INTO notificacoes (usuario_id, tipo, mensagem, link) VALUES (?, ?, ?, ?)").run(
            mentionedUser.id, 'mencao', msg, `/consulta/${consulta_id}`
          );
          const notif = db.prepare("SELECT * FROM notificacoes WHERE id = ?").get(notifInfo.lastInsertRowid);
          sendNotification(mentionedUser.id, notif);
        }
      });
    }

    res.json({ id: info.lastInsertRowid });
  });

  // Likes API
  app.post("/api/consultas/:id/curtir", (req, res) => {
    const { usuario_id } = req.body;
    try {
      db.prepare("INSERT INTO curtidas_consultas (consulta_id, usuario_id) VALUES (?, ?)").run(req.params.id, usuario_id);
      logAuditoria(usuario_id, 'Curtida', `Usuário curtiu o chamado ID: ${req.params.id}`, req.params.id);
      res.json({ success: true });
    } catch (e) {
      db.prepare("DELETE FROM curtidas_consultas WHERE consulta_id = ? AND usuario_id = ?").run(req.params.id, usuario_id);
      res.json({ success: true, removed: true });
    }
  });

  app.post("/api/comentarios/:id/curtir", (req, res) => {
    const { usuario_id } = req.body;
    try {
      db.prepare("INSERT INTO curtidas_comentarios (comentario_id, usuario_id) VALUES (?, ?)").run(req.params.id, usuario_id);
      res.json({ success: true });
    } catch (e) {
      db.prepare("DELETE FROM curtidas_comentarios WHERE comentario_id = ? AND usuario_id = ?").run(req.params.id, usuario_id);
      res.json({ success: true, removed: true });
    }
  });

  // Ranking API
  app.get("/api/ranking", (req, res) => {
    const ranking = db.prepare(`
      SELECT u.nome, u.codigo_interno, u.organizacao_militar,
      (SELECT COUNT(*) FROM comentarios WHERE usuario_id = u.id) as total_respostas,
      (SELECT COUNT(*) FROM curtidas_comentarios WHERE comentario_id IN (SELECT id FROM comentarios WHERE usuario_id = u.id)) as total_curtidas_recebidas,
      (SELECT COUNT(*) FROM consultas WHERE usuario_id = u.id) as total_consultas,
      (SELECT COUNT(*) FROM empresas WHERE indicado_por_id = u.id) as total_fornecedores,
      (SELECT COUNT(*) FROM validacoes_empresas WHERE usuario_id = u.id) as total_validacoes_feitas,
      (
        (SELECT COUNT(*) FROM comentarios WHERE usuario_id = u.id) * 2 + 
        (SELECT COUNT(*) FROM curtidas_comentarios WHERE comentario_id IN (SELECT id FROM comentarios WHERE usuario_id = u.id)) +
        (SELECT COUNT(*) FROM empresas WHERE indicado_por_id = u.id) * 3 +
        (SELECT COUNT(*) FROM validacoes_empresas WHERE usuario_id = u.id) * 2
      ) as pontuacao_total
      FROM usuarios u
      WHERE u.perfil != 'admin'
      ORDER BY pontuacao_total DESC
      LIMIT 10
    `).all();
    res.json(ranking);
  });

  app.get("/api/itens", (req, res) => {
    const itens = db.prepare("SELECT DISTINCT numero_item, nome_item, classificacao, meio_operacional FROM consultas").all();
    res.json(itens);
  });

  // Companies API
  app.get("/api/empresas", (req, res) => {
    const { consulta_id, usuario_id } = req.query;
    let query = `
      SELECT e.*, e.indicado_por_id as usuario_id, u.nome as indicado_por,
      (SELECT COUNT(*) FROM validacoes_empresas WHERE empresa_id = e.id) as total_validacoes
      ${usuario_id ? `, (SELECT COUNT(*) FROM validacoes_empresas WHERE empresa_id = e.id AND usuario_id = ?) as validado_por_mim` : ''}
      FROM empresas e 
      JOIN usuarios u ON e.indicado_por_id = u.id
      LEFT JOIN consultas c ON e.consulta_id = c.id
    `;
    let params = [];
    if (usuario_id) params.push(usuario_id);
    if (consulta_id) {
      query += " WHERE e.consulta_id = ? OR (e.consulta_id IS NULL AND e.numero_item = (SELECT numero_item FROM consultas WHERE id = ?))";
      params.push(consulta_id, consulta_id);
    }
    const empresas = db.prepare(query).all(...params);
    res.json(empresas);
  });

  app.post("/api/empresas", (req, res) => {
    const { consulta_id, numero_item, cnpj, razao_social, telefones, emails, tipo, indicado_por_id } = req.body;
    const info = db.prepare(`
      INSERT INTO empresas (consulta_id, numero_item, cnpj, razao_social, telefones, emails, tipo, indicado_por_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(consulta_id, numero_item, cnpj, razao_social, JSON.stringify(telefones), JSON.stringify(emails), tipo, indicado_por_id);
    
    logAuditoria(indicado_por_id, 'Indicação de Fornecedor', `Novo fornecedor indicado: ${razao_social}`, info.lastInsertRowid.toString());
    res.json({ id: info.lastInsertRowid });
  });

  app.post("/api/empresas/:id/validar", (req, res) => {
    const { usuario_id } = req.body;
    const empresaId = req.params.id;
    
    const empresa = db.prepare("SELECT indicado_por_id FROM empresas WHERE id = ?").get(empresaId);
    if (!empresa) return res.status(404).json({ error: "Fornecedor não encontrado" });
    
    if (empresa.indicado_por_id === usuario_id) {
      return res.status(400).json({ error: "Você não pode validar sua própria informação." });
    }
    
    try {
      db.prepare("INSERT INTO validacoes_empresas (empresa_id, usuario_id) VALUES (?, ?)").run(empresaId, usuario_id);
      logAuditoria(usuario_id, 'Validação de Fornecedor', `Validou fornecedor ID: ${empresaId}`);
      res.json({ success: true });
    } catch (e) {
      db.prepare("DELETE FROM validacoes_empresas WHERE empresa_id = ? AND usuario_id = ?").run(empresaId, usuario_id);
      res.json({ success: true, removed: true });
    }
  });

  // Config Lists API
  app.get("/api/config/oms", (req, res) => {
    res.json(db.prepare("SELECT * FROM oms ORDER BY nome").all());
  });
  app.post("/api/config/oms", (req, res) => {
    try {
      const info = db.prepare("INSERT INTO oms (nome) VALUES (?)").run(req.body.nome);
      res.json({ id: info.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: "OM já cadastrada" });
    }
  });
  app.delete("/api/config/oms/:id", (req, res) => {
    db.prepare("DELETE FROM oms WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/config/funcoes", (req, res) => {
    res.json(db.prepare("SELECT * FROM funcoes ORDER BY nome").all());
  });
  app.post("/api/config/funcoes", (req, res) => {
    try {
      const info = db.prepare("INSERT INTO funcoes (nome) VALUES (?)").run(req.body.nome);
      res.json({ id: info.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: "Função já cadastrada" });
    }
  });
  app.delete("/api/config/funcoes/:id", (req, res) => {
    db.prepare("DELETE FROM funcoes WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/config/conhecimentos", (req, res) => {
    res.json(db.prepare("SELECT * FROM conhecimentos ORDER BY nome").all());
  });
  app.post("/api/config/conhecimentos", (req, res) => {
    try {
      const info = db.prepare("INSERT INTO conhecimentos (nome) VALUES (?)").run(req.body.nome);
      res.json({ id: info.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: "Conhecimento já cadastrado" });
    }
  });
  app.delete("/api/config/conhecimentos/:id", (req, res) => {
    db.prepare("DELETE FROM conhecimentos WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
