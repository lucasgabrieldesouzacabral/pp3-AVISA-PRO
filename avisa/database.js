import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

let db;
const WEB_USERS_KEY = 'meuavisa.usuarios';

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
      status TEXT NOT NULL DEFAULT 'Pendente'
        CHECK (status IN ('Pendente', 'Confirmado', 'Cancelado', 'Adiado')),
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
  `);
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

export function loginDiscente(email_institucional, senha) {
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

    return usuario;
  }

  const database = getDatabase();
  const usuario = database.getFirstSync(
    `SELECT u.*
     FROM usuarios u
     LEFT JOIN discentes d ON d.id_usuario = u.id_usuario
     WHERE u.email_institucional = ? AND u.senha = ? AND u.tipo_usuario = 'Discente'`,
    [email, password]
  );

  if (!usuario) {
    throw new Error('Credenciais inválidas.');
  }

  const discente = database.getFirstSync(
    'SELECT id_usuario, curso FROM discentes WHERE id_usuario = ?',
    [usuario.id_usuario]
  );

  if (!discente) {
    throw new Error('O usuário encontrado não é um discente válido.');
  }

  return {
    id_usuario: usuario.id_usuario,
    nome_completo: usuario.nome_completo,
    email_institucional: usuario.email_institucional,
    matricula: usuario.matricula,
    tipo_usuario: usuario.tipo_usuario,
    curso: discente.curso,
  };
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

export default { getDatabase };
