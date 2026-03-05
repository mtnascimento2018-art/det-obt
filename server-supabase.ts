import express from "express";
import { createServer as createViteServer } from "vite";
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from "ws";
import http from "http";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase: any = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log(`Supabase initialized with ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON'} key`);
  } catch (e) {
    console.error('Erro ao inicializar Supabase:', e);
  }
} else {
  console.error('CRITICAL: Supabase URL or Key is missing!');
}

async function startServer() {
  const app = express();
  const PORT = 3000;
  
  app.use(express.json({ limit: '50mb' }));
  
  // Middleware to check Supabase
  app.use((req, res, next) => {
    if (!supabase && req.path.startsWith('/api') && req.path !== '/api/health' && req.path !== '/api/debug-env') {
      return res.status(503).json({ 
        error: "Supabase não configurado.",
        details: "As chaves VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não foram encontradas no ambiente.",
        help: "Adicione estas chaves nos 'Secrets' do projeto no AI Studio."
      });
    }
    next();
  });
  
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const clients = new Map<number, WebSocket>();

  wss.on("connection", (ws) => {
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

  const createNotification = async (userId: number, type: string, content: string, link: string) => {
    try {
      const { data } = await supabase.from('notificacoes').insert({
        usuario_id: userId,
        tipo: type,
        mensagem: content, // Changed from 'conteudo' to 'mensagem'
        link: link,
        lida: false
      }).select().single();
      
      if (data) {
        sendNotification(userId, data);
      }
    } catch (err) {
      console.error('Erro ao criar notificação:', err);
    }
  };

  const logAuditoria = async (usuario_id: number | null, acao: string, descricao: string, objeto_afetado?: string) => {
    await supabase.from('auditoria').insert({
      usuario_id, acao, descricao, objeto_afetado
    });
  };

  // Helper to upload base64 to Supabase Storage
  const uploadBase64ToStorage = async (base64Data: string, bucket: string, path: string) => {
    try {
      // Extract mime type and base64 data
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) return null;
      
      const mimeType = matches[1];
      const buffer = Buffer.from(matches[2], 'base64');
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, buffer, {
          contentType: mimeType,
          upsert: true
        });
        
      if (error) throw error;
      
      const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);
      return publicUrlData.publicUrl;
    } catch (err) {
      console.error('Erro ao fazer upload para o storage:', err);
      return null;
    }
  };

  // --- API ROUTES ---
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  app.get("/api/config/oms", async (req, res) => {
    const { data } = await supabase.from('oms').select('*').order('nome');
    res.json(data || []);
  });

  app.get("/api/config/funcoes", async (req, res) => {
    const { data } = await supabase.from('funcoes').select('*').order('nome');
    res.json(data || []);
  });

  app.get("/api/config/conhecimentos", async (req, res) => {
    const { data } = await supabase.from('conhecimentos').select('*').order('nome');
    res.json(data || []);
  });

  app.get("/api/config/classificacoes", async (req, res) => {
    const { data } = await supabase.from('conhecimentos').select('*').order('nome');
    res.json(data || []);
  });

  app.post("/api/login", async (req, res) => {
    const { codigo_interno } = req.body;
    const { data: user, error } = await supabase.from('usuarios').select('*').eq('codigo_interno', codigo_interno).single();
    
    if (error || !user) {
      await logAuditoria(null, 'Login Inválido', `Tentativa de login com NIP: ${codigo_interno}`);
      return res.status(404).json({ error: "Militar não cadastrado. Por favor, realize o cadastro." });
    }
    if (!user.ativo) {
      await logAuditoria(user.id, 'Login Bloqueado', `Usuário desativado tentou acessar o sistema.`);
      return res.status(403).json({ error: "Sua conta está desativada. Entre em contato com o administrador." });
    }
    
    await logAuditoria(user.id, 'Login Realizado', `Usuário ${user.nome} acessou o sistema.`);
    res.json(user);
  });

  app.post("/api/register", async (req, res) => {
    const { nome, nome_completo, posto_graduacao, codigo_interno, organizacao_militar, foto_perfil, funcao, conhecimento_material } = req.body;
    try {
      if (organizacao_militar) await supabase.from('oms').insert({ nome: organizacao_militar.trim() }).select();
      if (funcao) await supabase.from('funcoes').insert({ nome: funcao.trim() }).select();
      if (conhecimento_material) await supabase.from('conhecimentos').insert({ nome: conhecimento_material.trim() }).select();

      let finalFotoUrl = foto_perfil;
      if (foto_perfil && foto_perfil.startsWith('data:')) {
        const fileName = `avatar_${codigo_interno}_${Date.now()}`;
        const uploadedUrl = await uploadBase64ToStorage(foto_perfil, 'avatares', fileName);
        if (uploadedUrl) finalFotoUrl = uploadedUrl;
      }

      const { data: user, error } = await supabase.from('usuarios').insert({
        nome, nome_completo, posto_graduacao, codigo_interno, organizacao_militar, foto_perfil: finalFotoUrl, funcao, conhecimento_material, perfil: 'usuario'
      }).select().single();

      if (error) throw error;
      await logAuditoria(user.id, 'Cadastro', `Novo usuário cadastrado: ${nome}`);
      res.json(user);
    } catch (e) {
      res.status(400).json({ error: "NIP já cadastrado ou erro nos dados." });
    }
  });

  app.get("/api/notificacoes/:userId", async (req, res) => {
    const { data } = await supabase.from('notificacoes').select('*').eq('usuario_id', req.params.userId).order('data_criacao', { ascending: false }).limit(50);
    res.json(data || []);
  });

  app.post("/api/notificacoes/:id/lida", async (req, res) => {
    await supabase.from('notificacoes').update({ lida: true }).eq('id', req.params.id);
    res.json({ success: true });
  });

  app.get("/api/users", async (req, res) => {
    const { q } = req.query;
    if (q) {
      const { data } = await supabase
        .from('usuarios')
        .select('id, nome, codigo_interno, organizacao_militar, perfil, funcao')
        .eq('ativo', true)
        .or(`nome.ilike.%${q}%,codigo_interno.ilike.%${q}%,organizacao_militar.ilike.%${q}%`)
        .limit(10);
      return res.json(data || []);
    }
    const { data } = await supabase.from('usuarios').select('*').order('nome');
    res.json(data || []);
  });

  app.get("/api/users/nip/:nip", async (req, res) => {
    const { data, error } = await supabase
      .from('usuarios')
      .select('*')
      .eq('codigo_interno', req.params.nip)
      .single();
    if (error || !data) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json(data);
  });

  app.post("/api/users", async (req, res) => {
    const { nome, codigo_interno, organizacao_militar, ramal, perfil, admin_id, posto_graduacao, funcao, nome_completo, conhecimento_material } = req.body;
    try {
      const { data, error } = await supabase.from('usuarios').insert({
        nome, codigo_interno, organizacao_militar, ramal, perfil, posto_graduacao, funcao, nome_completo, conhecimento_material, ativo: true
      }).select().single();

      if (error) throw error;
      if (admin_id) {
        await logAuditoria(Number(admin_id), 'Criação de Usuário', `Admin criou novo usuário: ${nome} (${codigo_interno})`, data.id.toString());
      }
      res.json({ id: data.id });
    } catch (error: any) {
      console.error('Erro ao criar usuário:', error);
      res.status(400).json({ error: error.message || "Erro ao criar usuário ou NIP já existe." });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    const { nome, codigo_interno, organizacao_militar, ramal, perfil, posto_graduacao, funcao, ativo, admin_id, nome_completo, conhecimento_material } = req.body;
    
    try {
      const updateData: any = {
        nome, codigo_interno, organizacao_militar, ramal, perfil, posto_graduacao, funcao, nome_completo, conhecimento_material
      };
      
      if (ativo !== undefined) {
        updateData.ativo = (ativo === 1 || ativo === true);
      }

      const { error } = await supabase.from('usuarios').update(updateData).eq('id', id);

      if (error) throw error;
      if (admin_id) {
        await logAuditoria(Number(admin_id), 'Alteração de Usuário', `Admin alterou dados do usuário ID: ${id}`);
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error);
      res.status(400).json({ error: error.message || "Erro ao atualizar usuário." });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    const { id } = req.params;
    // Supabase handles CASCADE if configured, but we can do a simple delete here
    const { error } = await supabase.from('usuarios').delete().eq('id', id);
    if (error) return res.status(500).json({ error: "Erro ao deletar usuário." });
    res.json({ success: true });
  });

  app.patch("/api/users/:id/profile", async (req, res) => {
    const { id } = req.params;
    const { nome, nome_completo, posto_graduacao, organizacao_militar, funcao, conhecimento_material, foto_perfil, ramal } = req.body;
    
    let finalFoto = foto_perfil;
    if (foto_perfil && foto_perfil.startsWith('data:')) {
      const fileName = `avatar_${id}_${Date.now()}`;
      const uploadedUrl = await uploadBase64ToStorage(foto_perfil, 'avatars', fileName);
      if (uploadedUrl) finalFoto = uploadedUrl;
    }

    const { error } = await supabase.from('usuarios').update({
      nome, nome_completo, posto_graduacao, organizacao_militar, funcao, conhecimento_material, foto_perfil: finalFoto, ramal
    }).eq('id', id);

    if (error) return res.status(400).json({ error: "Erro ao atualizar perfil." });
    await logAuditoria(Number(id), 'Perfil Atualizado', `Usuário atualizou seus próprios dados de perfil.`);
    res.json({ success: true });
  });

  app.get("/api/consultas", async (req, res) => {
    // Para simplificar a query complexa do SQLite, buscamos as consultas e depois os contadores
    const { data: consultas, error } = await supabase
      .from('consultas')
      .select(`
        *,
        usuarios:usuario_id (nome, organizacao_militar, foto_perfil, perfil),
        comentarios (count),
        curtidas_consultas (count)
      `)
      .order('data_criacao', { ascending: false });

    if (error) {
      console.error("Error fetching consultas:", error);
      return res.status(500).json({ error: error.message });
    }

    const formatted = consultas.map((c: any) => ({
      ...c,
      autor_nome: c.usuarios?.nome,
      autor_om: c.usuarios?.organizacao_militar,
      autor_foto: c.usuarios?.foto_perfil,
      autor_perfil: c.usuarios?.perfil,
      total_comentarios: c.comentarios?.[0]?.count || 0,
      total_curtidas: c.curtidas_consultas?.[0]?.count || 0,
      visualizacoes: c.visualizacoes || 0
    }));

    res.json(formatted);
  });

  app.post("/api/consultas", async (req, res) => {
    const { usuario_id, numero_item, nome_item, classificacao, meio_operacional, descricao, arquivo_url } = req.body;
    
    let finalUrl = arquivo_url;
    if (arquivo_url && arquivo_url.startsWith('data:')) {
      const fileName = `consulta_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const uploadedUrl = await uploadBase64ToStorage(arquivo_url, 'arquivos', fileName);
      if (uploadedUrl) finalUrl = uploadedUrl;
    }

    const { data: info, error } = await supabase.from('consultas').insert({
      usuario_id, numero_item, nome_item, classificacao, meio_operacional, descricao, arquivo_url: finalUrl
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    await logAuditoria(usuario_id, 'Consulta Criada', `Nova consulta criada para o item: ${numero_item}`, info.id.toString());
    res.json({ id: info.id });
  });

  app.get("/api/consultas/:id", async (req, res) => {
    const { data: c, error } = await supabase
      .from('consultas')
      .select(`*, usuarios:usuario_id (nome, organizacao_militar, foto_perfil, perfil)`)
      .eq('id', req.params.id)
      .single();

    if (error || !c) return res.status(404).json({ error: "Consulta não encontrada" });

    const { count: total_comentarios } = await supabase.from('comentarios').select('*', { count: 'exact', head: true }).eq('consulta_id', c.id);
    const { count: total_curtidas } = await supabase.from('curtidas_consultas').select('*', { count: 'exact', head: true }).eq('consulta_id', c.id);

    res.json({
      ...c,
      autor_nome: c.usuarios?.nome,
      autor_om: c.usuarios?.organizacao_militar,
      autor_foto: c.usuarios?.foto_perfil,
      autor_perfil: c.usuarios?.perfil,
      total_comentarios: total_comentarios || 0,
      total_curtidas: total_curtidas || 0
    });
  });

  app.get("/api/consultas/:id/comentarios", async (req, res) => {
    const { data: comentarios, error } = await supabase
      .from('comentarios')
      .select(`
        *,
        usuarios:usuario_id (nome, organizacao_militar, foto_perfil, perfil),
        curtidas_comentarios (count)
      `)
      .eq('consulta_id', req.params.id)
      .order('data_criacao', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    const formatted = comentarios.map((c: any) => ({
      ...c,
      autor_nome: c.usuarios?.nome,
      autor_om: c.usuarios?.organizacao_militar,
      autor_foto: c.usuarios?.foto_perfil,
      autor_perfil: c.usuarios?.perfil,
      total_curtidas: c.curtidas_comentarios?.[0]?.count || 0
    }));

    res.json(formatted);
  });

  app.post("/api/comentarios", async (req, res) => {
    const { consulta_id, usuario_id, texto, arquivo_url } = req.body;
    
    let finalUrl = arquivo_url;
    if (arquivo_url && arquivo_url.startsWith('data:')) {
      const fileName = `comentario_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const uploadedUrl = await uploadBase64ToStorage(arquivo_url, 'arquivos', fileName);
      if (uploadedUrl) finalUrl = uploadedUrl;
    }

    const { data: info, error } = await supabase.from('comentarios').insert({
      consulta_id, usuario_id, texto, arquivo_url: finalUrl
    }).select().single();

    if (error) return res.status(500).json({ error: error.message });
    await logAuditoria(usuario_id, 'Comentário Realizado', `Usuário comentou no chamado ID: ${consulta_id}`, consulta_id.toString());
    
    // Notify author
    const { data: consulta } = await supabase.from('consultas').select('usuario_id, numero_item').eq('id', consulta_id).single();
    if (consulta && consulta.usuario_id !== usuario_id) {
      await createNotification(consulta.usuario_id, 'comentario', `Novo comentário no seu chamado ${consulta.numero_item}.`, `/consulta/${consulta_id}`);
    }
    
    res.json({ id: info.id });
  });

  app.post("/api/consultas/:id/visualizar", async (req, res) => {
    const { data: c } = await supabase.from('consultas').select('visualizacoes').eq('id', req.params.id).single();
    if (c) {
      const newViews = (c.visualizacoes || 0) + 1;
      await supabase.from('consultas').update({ visualizacoes: newViews }).eq('id', req.params.id);
      console.log(`Updated views for consultation ${req.params.id} to ${newViews}`);
    }
    res.json({ success: true });
  });

  app.post("/api/consultas/:id/curtir", async (req, res) => {
    const { usuario_id } = req.body;
    try {
      await supabase.from('curtidas_consultas').insert({ consulta_id: req.params.id, usuario_id });
      res.json({ success: true });
    } catch (e) {
      await supabase.from('curtidas_consultas').delete().match({ consulta_id: req.params.id, usuario_id });
      res.json({ success: true, removed: true });
    }
  });

  app.post("/api/comentarios/:id/curtir", async (req, res) => {
    const { usuario_id } = req.body;
    try {
      await supabase.from('curtidas_comentarios').insert({ comentario_id: req.params.id, usuario_id });
      res.json({ success: true });
    } catch (e) {
      await supabase.from('curtidas_comentarios').delete().match({ comentario_id: req.params.id, usuario_id });
      res.json({ success: true, removed: true });
    }
  });

  app.get("/api/amizades/status/:uid/:fid", async (req, res) => {
    const { uid, fid } = req.params;
    try {
      const { data, error } = await supabase
        .from('amizades')
        .select('status')
        .or(`and(usuario_id.eq.${uid},amigo_id.eq.${fid}),and(usuario_id.eq.${fid},amigo_id.eq.${uid})`)
        .maybeSingle();
      
      if (error) {
        if (error.code === '42703') { // undefined_column
           // Fallback: check if friendship exists at all
           const { data: exists } = await supabase
             .from('amizades')
             .select('id')
             .or(`and(usuario_id.eq.${uid},amigo_id.eq.${fid}),and(usuario_id.eq.${fid},amigo_id.eq.${uid})`)
             .maybeSingle();
           return res.json(exists ? { status: 'aceito' } : null);
        }
        throw error;
      }
      res.json(data);
    } catch (err: any) {
      console.error("Error checking friendship status:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/amigos/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const { data, error } = await supabase
        .from('amizades')
        .select(`
          id,
          status,
          u1:usuario_id (id, nome, codigo_interno, organizacao_militar, foto_perfil, funcao),
          u2:amigo_id (id, nome, codigo_interno, organizacao_militar, foto_perfil, funcao)
        `)
        .eq('status', 'aceito')
        .or(`usuario_id.eq.${userId},amigo_id.eq.${userId}`);
      
      if (error) {
        if (error.code === '42703') { // undefined_column
           // Fallback: return all friendships as accepted
           const { data: allData } = await supabase
             .from('amizades')
             .select(`
               id,
               u1:usuario_id (id, nome, codigo_interno, organizacao_militar, foto_perfil, funcao),
               u2:amigo_id (id, nome, codigo_interno, organizacao_militar, foto_perfil, funcao)
             `)
             .or(`usuario_id.eq.${userId},amigo_id.eq.${userId}`);
             
           const amigos = allData?.map((a: any) => {
             const amigo = a.u1.id == userId ? a.u2 : a.u1;
             return { ...amigo, amizade_id: a.id, status: 'aceito' };
           }) || [];
           return res.json(amigos);
        }
        throw error;
      }

      const amigos = data.map((a: any) => {
        const amigo = a.u1.id == userId ? a.u2 : a.u1;
        return { ...amigo, amizade_id: a.id };
      });
      res.json(amigos);
    } catch (err: any) {
      console.error("Error fetching friends:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/amizades/pendentes/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      const { data, error } = await supabase
        .from('amizades')
        .select(`
          id,
          status,
          u1:usuario_id (id, nome, codigo_interno, organizacao_militar, foto_perfil, funcao)
        `)
        .eq('amigo_id', userId)
        .eq('status', 'pendente');
      
      if (error) {
        if (error.code === '42703') { // undefined_column
           return res.json([]); // No pending requests if column missing
        }
        throw error;
      }
      
      const pendentes = data?.map((a: any) => ({
        ...a.u1,
        amizade_id: a.id
      })) || [];
      res.json(pendentes);
    } catch (err: any) {
      console.error("Error fetching pending friends:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/amizades/responder", async (req, res) => {
    const { amizade_id, aceitar, usuario_id } = req.body; // usuario_id is who is responding (the target of original request)
    if (aceitar) {
      const { data: amizade } = await supabase.from('amizades').update({ status: 'aceito' }).eq('id', amizade_id).select().single();
      if (amizade) {
        // Notify the original requester
        const requesterId = amizade.usuario_id === usuario_id ? amizade.amigo_id : amizade.usuario_id;
        const { data: responder } = await supabase.from('usuarios').select('nome').eq('id', usuario_id).single();
        await createNotification(requesterId, 'amizade', `${responder?.nome || 'Alguém'} aceitou sua solicitação de amizade.`, `/chat`);
      }
    } else {
      await supabase.from('amizades').delete().eq('id', amizade_id);
    }
    res.json({ success: true });
  });

  app.post("/api/amizades/solicitar", async (req, res) => {
    const usuario_id = parseInt(req.body.usuario_id);
    const amigo_id = parseInt(req.body.amigo_id);

    if (isNaN(usuario_id) || isNaN(amigo_id)) {
      return res.status(400).json({ error: "IDs inválidos." });
    }

    // Check if friendship already exists
    const { data: existing } = await supabase
      .from('amizades')
      .select('id, status')
      .or(`and(usuario_id.eq.${usuario_id},amigo_id.eq.${amigo_id}),and(usuario_id.eq.${amigo_id},amigo_id.eq.${usuario_id})`)
      .maybeSingle();

    if (existing) {
      if (existing.status === 'pendente') {
        return res.status(400).json({ error: "Já existe uma solicitação pendente." });
      }
      if (existing.status === 'aceito') {
        return res.status(400).json({ error: "Vocês já são amigos." });
      }
      return res.status(400).json({ error: "Solicitação já enviada." });
    }

    // Try to insert with status
    const { error } = await supabase.from('amizades').insert({ usuario_id, amigo_id, status: 'pendente' });
    
    if (error) {
      console.error("Error inserting amizade:", JSON.stringify(error, null, 2));
      
      // Handle unique violation (race condition)
      if (error.code === '23505') {
        return res.status(400).json({ error: "Solicitação já enviada ou amizade já existe." });
      }

      // Fallback for missing column (if user didn't run migration)
      if (error.code === '42703') { // undefined_column
         const { error: retryError } = await supabase.from('amizades').insert({ usuario_id, amigo_id });
         if (retryError) {
            console.error("Error retrying insert:", retryError);
            return res.status(500).json({ error: retryError.message });
         }
         
         // Notify target (instant friendship fallback)
         const { data: sender } = await supabase.from('usuarios').select('nome').eq('id', usuario_id).single();
         await createNotification(amigo_id, 'amizade', `${sender?.nome || 'Alguém'} adicionou você como amigo.`, `/chat`);
         return res.json({ success: true, warning: "Migration not applied, friendship created instantly." });
      }
      return res.status(500).json({ error: error.message || "Erro desconhecido ao adicionar amigo." });
    }
    
    // Notify target
    const { data: sender } = await supabase.from('usuarios').select('nome').eq('id', usuario_id).single();
    await createNotification(amigo_id, 'amizade', `${sender?.nome || 'Alguém'} enviou uma solicitação de amizade.`, `/chat`);
    
    res.json({ success: true });
  });

  app.get("/api/itens", async (req, res) => {
    // Supabase não tem SELECT DISTINCT fácil via JS, então pegamos tudo e filtramos
    const { data } = await supabase.from('consultas').select('numero_item, nome_item, classificacao, meio_operacional');
    const unique = Array.from(new Set(data?.map(i => JSON.stringify(i)))).map((i: any) => JSON.parse(i));
    res.json(unique);
  });

  app.get("/api/empresas", async (req, res) => {
    const { data: empresas, error } = await supabase
      .from('empresas')
      .select(`
        *,
        usuarios:indicado_por_id (nome),
        validacoes_empresas (count)
      `)
      .order('data_cadastro', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const formatted = empresas.map((e: any) => ({
      ...e,
      indicado_por: e.usuarios?.nome,
      total_validacoes: e.validacoes_empresas?.[0]?.count || 0,
      data_indicacao: e.data_indicacao || e.data_cadastro || e.created_at
    }));

    res.json(formatted);
  });

  app.post("/api/empresas", async (req, res) => {
    const { cnpj, razao_social, telefones, emails, tipo, numero_item, usuario_id } = req.body;
    const now = new Date().toISOString();
    const { data: info, error } = await supabase.from('empresas').insert({
      cnpj, 
      razao_social, 
      telefones: JSON.stringify(telefones), 
      emails: JSON.stringify(emails), 
      tipo, 
      numero_item, 
      indicado_por_id: usuario_id,
      data_indicacao: now,
      data_cadastro: now
    }).select().single();

    if (error) return res.status(400).json({ error: "Erro ao cadastrar empresa ou CNPJ já existe." });
    await logAuditoria(usuario_id, 'Empresa Cadastrada', `Nova empresa cadastrada: ${razao_social}`);
    res.json({ id: info.id });
  });

  app.get("/api/ranking", async (req, res) => {
    try {
      console.log("Fetching ranking data...");
      // Fetch users
      const { data: users, error } = await supabase.from('usuarios').select('id, nome, organizacao_militar, foto_perfil, codigo_interno').eq('ativo', true);
      if (error) throw error;

      // Fetch counts manually to avoid join issues
      // Consultas
      const { data: consultas } = await supabase.from('consultas').select('usuario_id');
      const consultasMap: Record<number, number> = {};
      consultas?.forEach((c: any) => consultasMap[c.usuario_id] = (consultasMap[c.usuario_id] || 0) + 1);

      // Comentarios
      const { data: comentarios } = await supabase.from('comentarios').select('usuario_id');
      const comentariosMap: Record<number, number> = {};
      comentarios?.forEach((c: any) => comentariosMap[c.usuario_id] = (comentariosMap[c.usuario_id] || 0) + 1);

      // Empresas
      const { data: empresas } = await supabase.from('empresas').select('indicado_por_id');
      const empresasMap: Record<number, number> = {};
      empresas?.forEach((e: any) => empresasMap[e.indicado_por_id] = (empresasMap[e.indicado_por_id] || 0) + 1);

      // Validacoes
      const { data: validacoes } = await supabase.from('validacoes_empresas').select('usuario_id');
      const validacoesMap: Record<number, number> = {};
      validacoes?.forEach((v: any) => validacoesMap[v.usuario_id] = (validacoesMap[v.usuario_id] || 0) + 1);
      
      console.log("Validacoes map:", validacoesMap);

      // Curtidas em Comentarios (Received)
      const { data: allComments } = await supabase.from('comentarios').select('usuario_id, curtidas_comentarios(count)');
      const likesReceivedMap: Record<number, number> = {};
      allComments?.forEach((c: any) => {
         const likes = c.curtidas_comentarios?.[0]?.count || 0;
         if (likes > 0) likesReceivedMap[c.usuario_id] = (likesReceivedMap[c.usuario_id] || 0) + likes;
      });
      
      console.log("Ranking maps built. Users:", users?.length);

      const formatted = users.map((u: any) => {
        const total_consultas = consultasMap[u.id] || 0;
        const total_respostas = comentariosMap[u.id] || 0;
        const total_fornecedores = empresasMap[u.id] || 0;
        const total_validacoes_feitas = validacoesMap[u.id] || 0;
        const total_curtidas_recebidas = likesReceivedMap[u.id] || 0;

        // Pontuação: Consulta (10), Resposta (2), Curtida (1), Fornecedor (3), Validação (2)
        const pontuacao_total = (total_consultas * 10) + (total_respostas * 2) + (total_curtidas_recebidas * 1) + (total_fornecedores * 3) + (total_validacoes_feitas * 2);

        return {
          nome: u.nome,
          codigo_interno: u.codigo_interno,
          organizacao_militar: u.organizacao_militar,
          total_respostas,
          total_curtidas_recebidas,
          total_consultas,
          total_fornecedores,
          total_validacoes_feitas,
          pontuacao_total
        };
      }).sort((a: any, b: any) => b.pontuacao_total - a.pontuacao_total);

      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/conversas/:userId", async (req, res) => {
    const { data: conversas, error } = await supabase
      .from('conversas')
      .select(`
        *,
        u1:usuario1_id (nome, codigo_interno),
        u2:usuario2_id (nome, codigo_interno)
      `)
      .or(`usuario1_id.eq.${req.params.userId},usuario2_id.eq.${req.params.userId}`)
      .order('data_ultima_mensagem', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const formatted = conversas.map((c: any) => ({
      ...c,
      u1_nome: c.u1?.nome,
      u1_codigo: c.u1?.codigo_interno,
      u2_nome: c.u2?.nome,
      u2_codigo: c.u2?.codigo_interno
    }));

    res.json(formatted);
  });

  app.get("/api/mensagens/:conversaId", async (req, res) => {
    const { data, error } = await supabase
      .from('mensagens_chat')
      .select('*')
      .eq('conversa_id', req.params.conversaId)
      .order('data_envio', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/mensagens", async (req, res) => {
    const { conversa_id, remetente_id, texto, arquivo_url, destinatario_id } = req.body;
    let cid = conversa_id;

    if (!cid && destinatario_id) {
      const { data: existing } = await supabase
        .from('conversas')
        .select('id')
        .or(`and(usuario1_id.eq.${remetente_id},usuario2_id.eq.${destinatario_id}),and(usuario1_id.eq.${destinatario_id},usuario2_id.eq.${remetente_id})`)
        .single();

      if (existing) {
        cid = existing.id;
      } else {
        const { data: newConv } = await supabase
          .from('conversas')
          .insert({ usuario1_id: remetente_id, usuario2_id: destinatario_id })
          .select().single();
        cid = newConv.id;
      }
    }

    let finalUrl = arquivo_url;
    if (arquivo_url && arquivo_url.startsWith('data:')) {
      const fileName = `chat_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const uploadedUrl = await uploadBase64ToStorage(arquivo_url, 'arquivos', fileName);
      if (uploadedUrl) finalUrl = uploadedUrl;
    }

    const { data: msg, error } = await supabase
      .from('mensagens_chat')
      .insert({ conversa_id: cid, remetente_id, texto, arquivo_url: finalUrl })
      .select().single();

    if (error) return res.status(500).json({ error: error.message });

    await supabase.from('conversas').update({ data_ultima_mensagem: new Date().toISOString() }).eq('id', cid);

    // Notify recipient
    if (destinatario_id) {
      const { data: sender } = await supabase.from('usuarios').select('nome').eq('id', remetente_id).single();
      await createNotification(destinatario_id, 'mensagem', `Nova mensagem de ${sender?.nome || 'Alguém'}.`, `/chat`);
    }

    res.json(msg);
  });

  app.patch("/api/consultas/:id/status", async (req, res) => {
    const { status, usuario_id } = req.body;
    const { error } = await supabase.from('consultas').update({ 
      status
    }).eq('id', req.params.id);
    if (error) {
      console.error("Error updating status:", error);
      return res.status(500).json({ error: error.message });
    }
    await logAuditoria(usuario_id, 'Alteração de Status', `Status da consulta ${req.params.id} alterado para: ${status}`, req.params.id);
    
    // Notify author
    const { data: consulta } = await supabase.from('consultas').select('usuario_id, numero_item').eq('id', req.params.id).single();
    if (consulta && consulta.usuario_id !== usuario_id) {
      await createNotification(consulta.usuario_id, 'status', `O status do seu chamado ${consulta.numero_item} foi alterado para ${status}.`, `/consulta/${req.params.id}`);
    }
    
    res.json({ success: true });
  });

  app.post("/api/empresas/:id/validar", async (req, res) => {
    const { usuario_id } = req.body;
    const empresaId = req.params.id;
    
    const { data: empresa } = await supabase.from('empresas').select('indicado_por_id').eq('id', empresaId).single();
    if (!empresa) return res.status(404).json({ error: "Fornecedor não encontrado" });
    
    if (empresa.indicado_por_id === usuario_id) {
      return res.status(400).json({ error: "Você não pode validar sua própria informação." });
    }
    
    try {
      const { error } = await supabase.from('validacoes_empresas').insert({ empresa_id: empresaId, usuario_id });
      if (error) throw error;
      await logAuditoria(usuario_id, 'Validação de Fornecedor', `Validou fornecedor ID: ${empresaId}`);
      res.json({ success: true });
    } catch (e) {
      await supabase.from('validacoes_empresas').delete().match({ empresa_id: empresaId, usuario_id });
      res.json({ success: true, removed: true });
    }
  });

  app.get("/api/auditoria", async (req, res) => {
    const { data } = await supabase
      .from('auditoria')
      .select(`*, usuarios:usuario_id (nome, organizacao_militar)`)
      .order('data_hora', { ascending: false })
      .limit(100);
    
    const formatted = data?.map((a: any) => ({
      ...a,
      nome_guerra: a.usuarios?.nome,
      organizacao_militar: a.usuarios?.organizacao_militar
    }));
    res.json(formatted || []);
  });

  app.get("/api/stats", async (req, res) => {
    try {
      const stats: any = {};
      
      // OM com mais chamados abertos
      const { data: abertosData } = await supabase
        .from('consultas')
        .select('status, usuarios!inner(organizacao_militar)')
        .eq('status', 'aberto');
      
      const omsAbertos: Record<string, number> = {};
      abertosData?.forEach((c: any) => {
        const om = c.usuarios?.organizacao_militar;
        if (om) omsAbertos[om] = (omsAbertos[om] || 0) + 1;
      });
      stats.oms_abertos = Object.entries(omsAbertos)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      // OM com mais chamados resolvidos
      const { data: resolvidosData } = await supabase
        .from('consultas')
        .select('status, usuarios!inner(organizacao_militar)')
        .eq('status', 'resolvido');
      
      const omsResolvidos: Record<string, number> = {};
      resolvidosData?.forEach((c: any) => {
        const om = c.usuarios?.organizacao_militar;
        if (om) omsResolvidos[om] = (omsResolvidos[om] || 0) + 1;
      });
      stats.oms_resolvidos = Object.entries(omsResolvidos)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      // Itens com mais comentários
      const { data: itensComData } = await supabase
        .from('consultas')
        .select('numero_item, comentarios(count)');
      
      stats.itens_comentarios = itensComData?.map((c: any) => ({
        label: c.numero_item,
        value: c.comentarios?.[0]?.count || 0
      })).sort((a, b) => b.value - a.value).slice(0, 10) || [];

      // Itens com mais fornecedores
      const { data: itensFornData } = await supabase
        .from('empresas')
        .select('numero_item');
      
      const itensForn: Record<string, number> = {};
      itensFornData?.forEach((e: any) => {
        if (e.numero_item) itensForn[e.numero_item] = (itensForn[e.numero_item] || 0) + 1;
      });
      stats.itens_fornecedores = Object.entries(itensForn)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      res.json(stats);
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    const { data } = await supabase.from('usuarios').select('*').order('nome');
    res.json(data || []);
  });

  app.post("/api/admin/users/:id/toggle", async (req, res) => {
    const { ativo } = req.body;
    await supabase.from('usuarios').update({ ativo }).eq('id', req.params.id);
    res.json({ success: true });
  });

  app.post("/api/admin/users/:id/perfil", async (req, res) => {
    const { perfil } = req.body;
    await supabase.from('usuarios').update({ perfil }).eq('id', req.params.id);
    res.json({ success: true });
  });

  app.get("/api/debug-env", (req, res) => {
    res.json({
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 10) + '...' : 'missing',
      envKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE'))
    });
  });

  app.get("/api/test", (req, res) => {
    res.json({ status: "ok", server: "supabase" });
  });

  app.get("/api/admin/migrate-to-supabase", async (req, res) => {
    const results: any = {};
    const db = new (await import('better-sqlite3')).default("sitec.db");

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
      ativo: r.ativo === 1,
      ramal: r.ramal
    }));
    await migrate('consultas', 'consultas');
    await migrate('comentarios', 'comentarios');
    await migrate('empresas', 'empresas');
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

  // Catch-all for unhandled API routes to prevent HTML response
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Rota API não encontrada: ${req.method} ${req.path}` });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT} (Supabase Backend)`);
  });
}

startServer();
