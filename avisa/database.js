import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

let db;
const WEB_USERS_KEY = 'meuavisa.usuarios';
const WEB_INTERESTS_KEY = 'meuavisa.interesses';
const WEB_EVENTS_KEY = 'meuavisa.eventos';
const WEB_NOTIFICATIONS_KEY = 'meuavisa.notificacoes';

function getDatabase() {
  if (Platform.OS === 'web') {
    throw new Error('O banco local está disponível apenas no aplicativo mobile.');
  }

  if (!db) {
    db = SQLite.openDatabaseSync('meuavisa.db');
  }

  return db;
}

function getWebUsers() {
  return JSON.parse(window.localStorage.getItem(WEB_USERS_KEY) || '[]');
}

function saveWebUsers(users) {
  window.localStorage.setItem(WEB_USERS_KEY, JSON.stringify(users));
}

export function initDatabase() {
  if (Platform.OS === 'web') {
    return;
  }

  getDatabase().execSync(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS usuarios (
      id_usuario INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_completo TEXT NOT NULL,
      email_institucional TEXT UNIQUE NOT NULL,
      matricula TEXT UNIQUE,
      senha TEXT NOT NULL,
      tipo_usuario TEXT NOT NULL CHECK (tipo_usuario IN ('Discente', 'Docente', 'Servidor')),
      data_cadastro TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS discentes (
      id_usuario INTEGER PRIMARY KEY,
      curso TEXT NOT NULL,
      FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS docentes (
      id_usuario INTEGER PRIMARY KEY,
      CNDB INTEGER NOT NULL,
      FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS servidores (
      id_usuario INTEGER PRIMARY KEY,
      cpf TEXT NOT NULL,
      FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS eventos (
      id_evento INTEGER PRIMARY KEY AUTOINCREMENT,
      titulo TEXT NOT NULL,
      descricao TEXT NOT NULL,
      data_evento TEXT NOT NULL,
      horario TEXT NOT NULL,
      local TEXT NOT NULL,
      vagas_disponiveis INTEGER,
      suporte_terceiros INTEGER NOT NULL DEFAULT 0 CHECK (suporte_terceiros IN (0, 1)),
      suporte_detalhes TEXT,
      status TEXT NOT NULL DEFAULT 'Pendente'
        CHECK (status IN ('Pendente', 'Confirmado', 'Cancelado', 'Adiado')),
      justificativa_status TEXT,
      data_criacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      id_organizador_principal INTEGER NOT NULL,
      FOREIGN KEY (id_organizador_principal) REFERENCES usuarios (id_usuario)
    );

    CREATE TABLE IF NOT EXISTS solicitacoes_evento (
      id_solicitacao INTEGER PRIMARY KEY AUTOINCREMENT,
      id_evento INTEGER,
      id_discente INTEGER,
      id_avaliador INTEGER,
      status_solicitacao TEXT NOT NULL DEFAULT 'Pendente'
        CHECK (status_solicitacao IN ('Pendente', 'Aceito', 'Recusado')),
      motivo_recusa TEXT,
      data_solicitacao TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id_evento) REFERENCES eventos (id_evento),
      FOREIGN KEY (id_discente) REFERENCES usuarios (id_usuario),
      FOREIGN KEY (id_avaliador) REFERENCES usuarios (id_usuario)
    );

    CREATE TABLE IF NOT EXISTS inscricoes_evento (
      id_usuario INTEGER NOT NULL,
      id_evento INTEGER NOT NULL,
      tipo_inscricao TEXT NOT NULL CHECK (tipo_inscricao IN ('Participante', 'Colaborador')),
      justificativa_contribuicao TEXT,
      presenca_confirmada INTEGER NOT NULL DEFAULT 0 CHECK (presenca_confirmada IN (0, 1)),
      PRIMARY KEY (id_usuario, id_evento),
      FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario),
      FOREIGN KEY (id_evento) REFERENCES eventos (id_evento)
    );

    CREATE TABLE IF NOT EXISTS notificacoes (
      id_notificacao INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER,
      mensagem TEXT NOT NULL,
      data_envio TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lida INTEGER NOT NULL DEFAULT 0 CHECK (lida IN (0, 1)),
      FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario)
    );

    CREATE TABLE IF NOT EXISTS usuario_interesses (
      id_usuario INTEGER NOT NULL,
      interesse TEXT NOT NULL,
      PRIMARY KEY (id_usuario, interesse),
      FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE
    );
  `);

  const eventColumns = getDatabase().getAllSync('PRAGMA table_info(eventos)');
  if (!eventColumns.some((column) => column.name === 'suporte_detalhes')) {
    getDatabase().execSync('ALTER TABLE eventos ADD COLUMN suporte_detalhes TEXT');
  }
  if (!eventColumns.some((column) => column.name === 'data_criacao')) {
    getDatabase().execSync(`
      ALTER TABLE eventos ADD COLUMN data_criacao TEXT;
      UPDATE eventos SET data_criacao = CURRENT_TIMESTAMP WHERE data_criacao IS NULL;
    `);
  }
  if (!eventColumns.some((column) => column.name === 'justificativa_status')) {
    getDatabase().execSync('ALTER TABLE eventos ADD COLUMN justificativa_status TEXT');
  }
}

function normalizeEventPayload(payload) {
  const support = String(payload.support || '').trim();
  const spots = Number(payload.spots);
  const normalized = {
    titulo: String(payload.title || '').trim(),
    descricao: String(payload.description || '').trim(),
    data_evento: String(payload.date || '').trim(),
    horario: String(payload.time || '').trim(),
    local: String(payload.location || '').trim(),
    suporte_terceiros: support === 'yes' ? 1 : support === 'no' ? 0 : null,
    suporte_detalhes: String(payload.supportDetails || '').trim(),
    vagas_disponiveis: spots,
    id_organizador_principal: Number(payload.organizerId),
  };

  if (!normalized.titulo || !normalized.descricao || !normalized.local) {
    throw new Error('Preencha o título, a descrição e o local do evento.');
  }

  const dateParts = normalized.data_evento.split('-').map(Number);
  const validDate = dateParts.length === 3
    && dateParts[0] > 0
    && dateParts[1] >= 1
    && dateParts[1] <= 12
    && dateParts[2] >= 1
    && dateParts[2] <= new Date(Date.UTC(dateParts[0], dateParts[1], 0)).getUTCDate();
  if (!validDate) throw new Error('Informe uma data válida para o evento.');

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized.horario)) {
    throw new Error('Informe um horário válido para o evento.');
  }

  if (!Number.isSafeInteger(normalized.vagas_disponiveis) || normalized.vagas_disponiveis < 1) {
    throw new Error('As vagas disponíveis devem ser um número inteiro maior que zero.');
  }

  if (normalized.suporte_terceiros === null) {
    throw new Error('Informe se o evento precisa de suporte de terceiros.');
  }

  if (normalized.suporte_terceiros && !normalized.suporte_detalhes) {
    throw new Error('Descreva o tipo de colaboração necessária.');
  }

  if (!Number.isSafeInteger(normalized.id_organizador_principal) || normalized.id_organizador_principal < 1) {
    throw new Error('Entre na sua conta para publicar um evento.');
  }

  if (!normalized.suporte_terceiros) normalized.suporte_detalhes = '';
  return normalized;
}

function getWebEvents() {
  return JSON.parse(window.localStorage.getItem(WEB_EVENTS_KEY) || '[]');
}

function getWebNotifications() {
  return JSON.parse(window.localStorage.getItem(WEB_NOTIFICATIONS_KEY) || '[]');
}

function saveWebNotifications(notifications) {
  window.localStorage.setItem(WEB_NOTIFICATIONS_KEY, JSON.stringify(notifications));
}

function createNotification(id_usuario, mensagem) {
  const notification = {
    id_notificacao: Date.now(),
    id_usuario: Number(id_usuario),
    mensagem,
    data_envio: new Date().toISOString(),
    lida: 0,
  };

  if (Platform.OS === 'web') {
    saveWebNotifications([notification, ...getWebNotifications()]);
    return notification;
  }

  const database = getDatabase();
  const result = database.runSync(
    'INSERT INTO notificacoes (id_usuario, mensagem) VALUES (?, ?)',
    [notification.id_usuario, notification.mensagem]
  );

  return database.getFirstSync(
    'SELECT id_notificacao, id_usuario, mensagem, data_envio, lida FROM notificacoes WHERE id_notificacao = ?',
    [result.lastInsertRowId]
  );
}

export function getNotifications(id_usuario) {
  const userId = Number(id_usuario);

  if (Platform.OS === 'web') {
    return getWebNotifications()
      .filter((notification) => Number(notification.id_usuario) === userId)
      .sort((first, second) => String(second.data_envio).localeCompare(String(first.data_envio)));
  }

  return getDatabase().getAllSync(
    `SELECT id_notificacao, id_usuario, mensagem, data_envio, lida
     FROM notificacoes
     WHERE id_usuario = ?
     ORDER BY datetime(data_envio) DESC, id_notificacao DESC`,
    [userId]
  );
}

export function markNotificationAsRead(id_notificacao, id_usuario) {
  const notificationId = Number(id_notificacao);
  const userId = Number(id_usuario);

  if (Platform.OS === 'web') {
    const notifications = getWebNotifications().map((notification) => (
      Number(notification.id_notificacao) === notificationId && Number(notification.id_usuario) === userId
        ? { ...notification, lida: 1 }
        : notification
    ));
    saveWebNotifications(notifications);
    return;
  }

  getDatabase().runSync(
    'UPDATE notificacoes SET lida = 1 WHERE id_notificacao = ? AND id_usuario = ?',
    [notificationId, userId]
  );
}

export function markAllNotificationsAsRead(id_usuario) {
  const userId = Number(id_usuario);

  if (Platform.OS === 'web') {
    const notifications = getWebNotifications().map((notification) => (
      Number(notification.id_usuario) === userId ? { ...notification, lida: 1 } : notification
    ));
    saveWebNotifications(notifications);
    return;
  }

  getDatabase().runSync('UPDATE notificacoes SET lida = 1 WHERE id_usuario = ?', [userId]);
}

export function createEvent(payload) {
  const event = normalizeEventPayload(payload);

  if (Platform.OS === 'web') {
    const users = getWebUsers();
    const organizer = users.find((user) => user.id_usuario === event.id_organizador_principal);
    if (!organizer) throw new Error('O usuário organizador não foi encontrado.');

    const events = getWebEvents();
    const savedEvent = {
      ...event,
      id_evento: events.reduce((maxId, item) => Math.max(maxId, item.id_evento), 0) + 1,
      status: 'Pendente',
      data_criacao: new Date().toISOString(),
      nome_organizador: organizer.nome_completo,
    };
    window.localStorage.setItem(WEB_EVENTS_KEY, JSON.stringify([savedEvent, ...events]));
    createNotification(
      event.id_organizador_principal,
      `Seu evento "${savedEvent.titulo}" foi publicado e está aguardando confirmação.`
    );
    return savedEvent;
  }

  const database = getDatabase();
  const createdAt = new Date().toISOString();
  const organizer = database.getFirstSync(
    'SELECT id_usuario FROM usuarios WHERE id_usuario = ?',
    [event.id_organizador_principal]
  );
  if (!organizer) throw new Error('O usuário organizador não foi encontrado.');

  const result = database.runSync(
    `INSERT INTO eventos (
       titulo, descricao, data_evento, horario, local, vagas_disponiveis,
       suporte_terceiros, suporte_detalhes, data_criacao, id_organizador_principal
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.titulo,
      event.descricao,
      event.data_evento,
      event.horario,
      event.local,
      event.vagas_disponiveis,
      event.suporte_terceiros,
      event.suporte_detalhes || null,
      createdAt,
      event.id_organizador_principal,
    ]
  );

  const savedEvent = database.getFirstSync(
    `SELECT e.*, u.nome_completo AS nome_organizador
     FROM eventos e
     JOIN usuarios u ON u.id_usuario = e.id_organizador_principal
     WHERE e.id_evento = ?`,
    [result.lastInsertRowId]
  );

  createNotification(
    event.id_organizador_principal,
    `Seu evento "${savedEvent.titulo}" foi publicado e está aguardando confirmação.`
  );
  return savedEvent;
}

export function getEvents() {
  if (Platform.OS === 'web') {
    const users = getWebUsers();
    return getWebEvents()
      .map((event) => ({
        ...event,
        nome_organizador: users.find((user) => user.id_usuario === event.id_organizador_principal)?.nome_completo || '',
      }))
      .sort((first, second) => `${first.data_evento} ${first.horario}`.localeCompare(`${second.data_evento} ${second.horario}`));
  }

  return getDatabase().getAllSync(
    `SELECT e.*, u.nome_completo AS nome_organizador
     FROM eventos e
     JOIN usuarios u ON u.id_usuario = e.id_organizador_principal
    ORDER BY e.data_evento, e.horario`
  );
}

export function updateEventStatus(id_evento, id_usuario, action, payload = {}) {
  const eventId = Number(id_evento);
  const userId = Number(id_usuario);
  const normalizedAction = String(action || '').trim();
  const justification = String(payload.justification || '').trim();

  if (!Number.isSafeInteger(eventId) || eventId < 1 || !Number.isSafeInteger(userId) || userId < 1) {
    throw new Error('Evento ou usuário inválido.');
  }

  if (!['cancel', 'reschedule'].includes(normalizedAction)) {
    throw new Error('Ação de evento inválida.');
  }

  const status = normalizedAction === 'cancel' ? 'Cancelado' : 'Adiado';
  const date = String(payload.date || '').trim();
  const time = String(payload.time || '').trim();

  if (normalizedAction === 'reschedule' && (!date || !time)) {
    throw new Error('Informe a nova data e o novo horário do evento.');
  }

  if (Platform.OS === 'web') {
    const events = getWebEvents();
    const eventIndex = events.findIndex((event) => Number(event.id_evento) === eventId);
    const event = events[eventIndex];

    if (!event) throw new Error('Evento não encontrado.');
    if (Number(event.id_organizador_principal) !== userId) {
      throw new Error('Somente o organizador pode alterar este evento.');
    }

    const updatedEvent = {
      ...event,
      status,
      justificativa_status: justification,
      ...(normalizedAction === 'reschedule' ? { data_evento: date, horario: time } : {}),
    };
    events[eventIndex] = updatedEvent;
    window.localStorage.setItem(WEB_EVENTS_KEY, JSON.stringify(events));
    createNotification(
      userId,
      normalizedAction === 'cancel'
        ? `O evento "${event.titulo}" foi cancelado.`
        : `O evento "${event.titulo}" foi remarcado para ${date} às ${time}.`
    );
    return updatedEvent;
  }

  const database = getDatabase();
  const event = database.getFirstSync(
    'SELECT * FROM eventos WHERE id_evento = ? AND id_organizador_principal = ?',
    [eventId, userId]
  );
  if (!event) throw new Error('Evento não encontrado ou você não é o organizador.');

  database.runSync(
    `UPDATE eventos
     SET status = ?, justificativa_status = ?, data_evento = COALESCE(?, data_evento), horario = COALESCE(?, horario)
     WHERE id_evento = ? AND id_organizador_principal = ?`,
    [status, justification || null, normalizedAction === 'reschedule' ? date : null, normalizedAction === 'reschedule' ? time : null, eventId, userId]
  );
  createNotification(
    userId,
    normalizedAction === 'cancel'
      ? `O evento "${event.titulo}" foi cancelado.`
      : `O evento "${event.titulo}" foi remarcado para ${date} às ${time}.`
  );

  return database.getFirstSync(
    `SELECT e.*, u.nome_completo AS nome_organizador
     FROM eventos e
     JOIN usuarios u ON u.id_usuario = e.id_organizador_principal
     WHERE e.id_evento = ?`,
    [eventId]
  );
}

export function normalizeRegistrationPayload(payload) {
  return {
    nome_completo: String(payload.nome_completo || '').trim(),
    email_institucional: String(payload.email_institucional || '').trim().toLowerCase(),
    matricula: String(payload.matricula || '').trim(),
    senha: String(payload.senha || '').trim(),
    tipo_usuario: String(payload.tipo_usuario || 'Discente').trim(),
    curso: String(payload.curso || '').trim(),
    CNDB: String(payload.CNDB || '').trim(),
    cpf: String(payload.cpf || '').trim(),
  };
}

export function validateRegistrationPayload(payload) {
  const normalized = normalizeRegistrationPayload(payload);

  if (!['Discente', 'Docente', 'Servidor'].includes(normalized.tipo_usuario)) {
    throw new Error('Selecione um tipo de usuário válido.');
  }

  const specificField = normalized.tipo_usuario === 'Discente'
    ? normalized.curso
    : normalized.tipo_usuario === 'Docente'
      ? normalized.CNDB
      : normalized.cpf;

  const requiresMatricula = normalized.tipo_usuario === 'Discente';

  if (!normalized.nome_completo || !normalized.email_institucional || (requiresMatricula && !normalized.matricula) || !normalized.senha || !specificField) {
    throw new Error('Preencha todos os campos do cadastro.');
  }

  if (!normalized.email_institucional.includes('@')) {
    throw new Error('Informe um e-mail institucional válido.');
  }

  if (normalized.senha.length < 6) {
    throw new Error('A senha deve ter pelo menos 6 caracteres.');
  }

  return normalized;
}

function getSpecificUserData(data) {
  if (data.tipo_usuario === 'Discente') return { curso: data.curso };
  if (data.tipo_usuario === 'Docente') return { CNDB: data.CNDB };
  return { cpf: data.cpf };
}

export function registerUser(payload) {
  const data = validateRegistrationPayload(payload);
  const specificData = getSpecificUserData(data);

  if (Platform.OS === 'web') {
    const users = getWebUsers();

    if (users.some((user) => user.email_institucional === data.email_institucional)) {
      throw new Error('E-mail institucional já cadastrado.');
    }

    if (data.matricula && users.some((user) => user.matricula === data.matricula)) {
      throw new Error('Matrícula já cadastrada.');
    }

    const usuario = {
      id_usuario: users.length + 1,
      nome_completo: data.nome_completo,
      email_institucional: data.email_institucional,
      matricula: data.matricula || null,
      senha: data.senha,
      tipo_usuario: data.tipo_usuario,
      ...specificData,
    };

    saveWebUsers([...users, usuario]);
    return usuario;
  }

  const database = getDatabase();

  const existsEmail = database.getFirstSync(
    'SELECT id_usuario FROM usuarios WHERE email_institucional = ?',
    [data.email_institucional]
  );

  if (existsEmail) {
    throw new Error('E-mail institucional já cadastrado.');
  }

  if (data.matricula) {
    const existsMatricula = database.getFirstSync(
      'SELECT id_usuario FROM usuarios WHERE matricula = ?',
      [data.matricula]
    );

    if (existsMatricula) {
      throw new Error('Matrícula já cadastrada.');
    }
  }

  database.runSync(
    `INSERT INTO usuarios (nome_completo, email_institucional, matricula, senha, tipo_usuario)
     VALUES (?, ?, ?, ?, ?)`,
    [data.nome_completo, data.email_institucional, data.matricula || null, data.senha, data.tipo_usuario]
  );

  const usuario = database.getFirstSync(
    'SELECT id_usuario FROM usuarios WHERE email_institucional = ?',
    [data.email_institucional]
  );

  const table = data.tipo_usuario === 'Discente' ? 'discentes' : data.tipo_usuario === 'Docente' ? 'docentes' : 'servidores';
  const column = data.tipo_usuario === 'Discente' ? 'curso' : data.tipo_usuario === 'Docente' ? 'CNDB' : 'cpf';
  database.runSync(`INSERT INTO ${table} (id_usuario, ${column}) VALUES (?, ?)`, [usuario.id_usuario, specificData[column]]);

  return database.getFirstSync(
    'SELECT id_usuario, nome_completo, email_institucional, matricula, tipo_usuario FROM usuarios WHERE id_usuario = ?',
    [usuario.id_usuario]
  );
}

export function registerDiscente(payload) {
  return registerUser({ ...payload, tipo_usuario: 'Discente' });
}

export function registerDocente(payload) {
  return registerUser({ ...payload, tipo_usuario: 'Docente' });
}

export function registerServidor(payload) {
  return registerUser({ ...payload, tipo_usuario: 'Servidor' });
}

export function loginDiscente(email_institucional, senha) {
  const usuario = loginUser(email_institucional, senha);

  if (usuario.tipo_usuario !== 'Discente') {
    throw new Error('O usuário encontrado não é um discente válido.');
  }

  return usuario;
}

export function loginUser(email_institucional, senha) {
  const email = String(email_institucional || '').trim().toLowerCase();
  const password = String(senha || '').trim();

  if (!email || !password) {
    throw new Error('Informe o e-mail institucional e a senha.');
  }

  if (Platform.OS === 'web') {
    const usuario = getWebUsers().find(
      (item) => item.email_institucional === email && item.senha === password
    );

    if (!usuario) {
      throw new Error('Credenciais inválidas.');
    }

    return { ...usuario, interesses: getWebInterests(usuario.id_usuario) };
  }

  const database = getDatabase();
  const usuario = database.getFirstSync(
    `SELECT u.*
     FROM usuarios u
     WHERE u.email_institucional = ? AND u.senha = ?`,
    [email, password]
  );

  if (!usuario) {
    throw new Error('Credenciais inválidas.');
  }

  const specificTable = usuario.tipo_usuario === 'Discente'
    ? 'discentes'
    : usuario.tipo_usuario === 'Docente'
      ? 'docentes'
      : 'servidores';
  const specificColumn = usuario.tipo_usuario === 'Discente'
    ? 'curso'
    : usuario.tipo_usuario === 'Docente'
      ? 'CNDB'
      : 'cpf';
  const specificData = database.getFirstSync(
    `SELECT ${specificColumn} FROM ${specificTable} WHERE id_usuario = ?`,
    [usuario.id_usuario]
  );

  if (!specificData) {
    throw new Error('Os dados específicos do usuário não foram encontrados.');
  }

  return {
    id_usuario: usuario.id_usuario,
    nome_completo: usuario.nome_completo,
    email_institucional: usuario.email_institucional,
    matricula: usuario.matricula,
    tipo_usuario: usuario.tipo_usuario,
    [specificColumn]: specificData[specificColumn],
    interesses: getUserInterests(usuario.id_usuario),
  };
}

function getWebInterests(id_usuario) {
  const interests = JSON.parse(window.localStorage.getItem(WEB_INTERESTS_KEY) || '{}');
  return interests[String(id_usuario)] || [];
}

export function getUserInterests(id_usuario) {
  if (Platform.OS === 'web') return getWebInterests(id_usuario);

  return getDatabase()
    .getAllSync('SELECT interesse FROM usuario_interesses WHERE id_usuario = ? ORDER BY interesse', [id_usuario])
    .map((row) => row.interesse);
}

export function updateUserInterests(id_usuario, interests) {
  const normalized = [...new Set((interests || []).map((interest) => String(interest).trim()).filter(Boolean))].slice(0, 8);

  if (Platform.OS === 'web') {
    const stored = JSON.parse(window.localStorage.getItem(WEB_INTERESTS_KEY) || '{}');
    stored[String(id_usuario)] = normalized;
    window.localStorage.setItem(WEB_INTERESTS_KEY, JSON.stringify(stored));
    return normalized;
  }

  const database = getDatabase();
  database.withTransactionSync(() => {
    database.runSync('DELETE FROM usuario_interesses WHERE id_usuario = ?', [id_usuario]);
    normalized.forEach((interest) => {
      database.runSync(
        'INSERT INTO usuario_interesses (id_usuario, interesse) VALUES (?, ?)',
        [id_usuario, interest]
      );
    });
  });

  return normalized;
}

export function getDiscenteById(id_usuario) {
  return getDatabase().getFirstSync(
    `SELECT u.id_usuario, u.nome_completo, u.email_institucional, u.matricula, u.tipo_usuario, d.curso
     FROM usuarios u
     JOIN discentes d ON d.id_usuario = u.id_usuario
     WHERE u.id_usuario = ?`,
    [id_usuario]
  );
}

export function getUserById(id_usuario) {
  if (Platform.OS === 'web') {
    const user = getWebUsers().find((item) => item.id_usuario === Number(id_usuario));
    return user ? { ...user, interesses: getWebInterests(user.id_usuario) } : null;
  }

  const database = getDatabase();
  const usuario = database.getFirstSync(
    'SELECT id_usuario, nome_completo, email_institucional, matricula, tipo_usuario FROM usuarios WHERE id_usuario = ?',
    [id_usuario]
  );

  if (!usuario) return null;

  const specificTable = usuario.tipo_usuario === 'Discente'
    ? 'discentes'
    : usuario.tipo_usuario === 'Docente'
      ? 'docentes'
      : 'servidores';
  const specificColumn = usuario.tipo_usuario === 'Discente'
    ? 'curso'
    : usuario.tipo_usuario === 'Docente'
      ? 'CNDB'
      : 'cpf';
  const specificData = database.getFirstSync(
    `SELECT ${specificColumn} FROM ${specificTable} WHERE id_usuario = ?`,
    [id_usuario]
  );

  return { ...usuario, ...(specificData || {}), interesses: getUserInterests(id_usuario) };
}

export function updateUserProfile(id_usuario, payload) {
  const userId = Number(id_usuario);
  const name = String(payload.nome_completo || '').trim();
  const email = String(payload.email_institucional || '').trim().toLowerCase();
  const matricula = String(payload.matricula || '').trim();

  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error('Usuário não autenticado.');
  if (!name || !email.includes('@')) throw new Error('Informe seu nome e um e-mail válido.');

  if (Platform.OS === 'web') {
    const users = getWebUsers();
    const userIndex = users.findIndex((user) => Number(user.id_usuario) === userId);
    if (userIndex < 0) throw new Error('Usuário não encontrado.');

    const currentUser = users[userIndex];
    const specificColumn = currentUser.tipo_usuario === 'Discente'
      ? 'curso'
      : currentUser.tipo_usuario === 'Docente'
        ? 'CNDB'
        : 'cpf';
    const specificValue = String(payload[specificColumn] || '').trim();
    if (!specificValue) throw new Error('Preencha o dado específico do seu perfil.');
    if (users.some((user) => Number(user.id_usuario) !== userId && user.email_institucional === email)) {
      throw new Error('E-mail institucional já cadastrado.');
    }
    if (matricula && users.some((user) => Number(user.id_usuario) !== userId && user.matricula === matricula)) {
      throw new Error('Matrícula já cadastrada.');
    }

    users[userIndex] = {
      ...currentUser,
      nome_completo: name,
      email_institucional: email,
      matricula: matricula || null,
      [specificColumn]: specificValue,
    };
    saveWebUsers(users);
    return { ...users[userIndex], interesses: getWebInterests(userId) };
  }

  const database = getDatabase();
  const currentUser = database.getFirstSync(
    'SELECT id_usuario, tipo_usuario FROM usuarios WHERE id_usuario = ?',
    [userId]
  );
  if (!currentUser) throw new Error('Usuário não encontrado.');

  const specificColumn = currentUser.tipo_usuario === 'Discente'
    ? 'curso'
    : currentUser.tipo_usuario === 'Docente'
      ? 'CNDB'
      : 'cpf';
  const specificValue = String(payload[specificColumn] || '').trim();
  if (!specificValue) throw new Error('Preencha o dado específico do seu perfil.');

  const emailInUse = database.getFirstSync(
    'SELECT id_usuario FROM usuarios WHERE email_institucional = ? AND id_usuario != ?',
    [email, userId]
  );
  if (emailInUse) throw new Error('E-mail institucional já cadastrado.');

  if (matricula) {
    const matriculaInUse = database.getFirstSync(
      'SELECT id_usuario FROM usuarios WHERE matricula = ? AND id_usuario != ?',
      [matricula, userId]
    );
    if (matriculaInUse) throw new Error('Matrícula já cadastrada.');
  }

  const specificTable = currentUser.tipo_usuario === 'Discente'
    ? 'discentes'
    : currentUser.tipo_usuario === 'Docente'
      ? 'docentes'
      : 'servidores';
  database.withTransactionSync(() => {
    database.runSync(
      'UPDATE usuarios SET nome_completo = ?, email_institucional = ?, matricula = ? WHERE id_usuario = ?',
      [name, email, matricula || null, userId]
    );
    const existingSpecificData = database.getFirstSync(
      `SELECT id_usuario FROM ${specificTable} WHERE id_usuario = ?`,
      [userId]
    );
    if (existingSpecificData) {
      database.runSync(
        `UPDATE ${specificTable} SET ${specificColumn} = ? WHERE id_usuario = ?`,
        [specificValue, userId]
      );
    } else {
      database.runSync(
        `INSERT INTO ${specificTable} (id_usuario, ${specificColumn}) VALUES (?, ?)`,
        [userId, specificValue]
      );
    }
  });

  return getUserById(userId);
}

export default { getDatabase };
