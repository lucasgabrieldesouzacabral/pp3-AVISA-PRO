CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario BIGSERIAL PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  email_institucional TEXT UNIQUE NOT NULL,
  matricula TEXT UNIQUE,
  senha TEXT NOT NULL,
  tipo_usuario TEXT NOT NULL CHECK (tipo_usuario IN ('Discente', 'Docente', 'Servidor')),
  data_cadastro TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discentes (
  id_usuario BIGINT PRIMARY KEY REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
  curso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS docentes (
  id_usuario BIGINT PRIMARY KEY REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
  CNDB INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS servidores (
  id_usuario BIGINT PRIMARY KEY REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
  cpf TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS eventos (
  id_evento BIGSERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  data_evento DATE NOT NULL,
  horario TIME NOT NULL,
  local TEXT NOT NULL,
  vagas_disponiveis INTEGER,
  suporte_terceiros INTEGER NOT NULL DEFAULT 0 CHECK (suporte_terceiros IN (0, 1)),
  suporte_detalhes TEXT,
  status TEXT NOT NULL DEFAULT 'Pendente' CHECK (status IN ('Pendente', 'Confirmado', 'Cancelado', 'Adiado')),
  justificativa_status TEXT,
  id_confirmador BIGINT REFERENCES usuarios (id_usuario),
  data_confirmacao TIMESTAMPTZ,
  id_rejeitador BIGINT REFERENCES usuarios (id_usuario),
  data_rejeicao TIMESTAMPTZ,
  data_criacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  id_organizador_principal BIGINT NOT NULL REFERENCES usuarios (id_usuario)
);

CREATE TABLE IF NOT EXISTS inscricoes_evento (
  id_usuario BIGINT NOT NULL REFERENCES usuarios (id_usuario),
  id_evento BIGINT NOT NULL REFERENCES eventos (id_evento),
  tipo_inscricao TEXT NOT NULL CHECK (tipo_inscricao IN ('Participante', 'Colaborador')),
  justificativa_contribuicao TEXT,
  presenca_confirmada INTEGER NOT NULL DEFAULT 0 CHECK (presenca_confirmada IN (0, 1)),
  PRIMARY KEY (id_usuario, id_evento)
);

CREATE TABLE IF NOT EXISTS notificacoes (
  id_notificacao BIGSERIAL PRIMARY KEY,
  id_usuario BIGINT REFERENCES usuarios (id_usuario),
  mensagem TEXT NOT NULL,
  data_envio TIMESTAMPTZ NOT NULL DEFAULT now(),
  lida INTEGER NOT NULL DEFAULT 0 CHECK (lida IN (0, 1))
);

CREATE TABLE IF NOT EXISTS usuario_interesses (
  id_usuario BIGINT NOT NULL REFERENCES usuarios (id_usuario) ON DELETE CASCADE,
  interesse TEXT NOT NULL,
  PRIMARY KEY (id_usuario, interesse)
);

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE discentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE docentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE servidores ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE inscricoes_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuario_interesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_public_register"
ON usuarios
FOR INSERT
WITH CHECK (true);

CREATE POLICY "usuarios_public_login_select"
ON usuarios
FOR SELECT
USING (true);

CREATE POLICY "usuarios_self_update"
ON usuarios
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "discentes_public_select"
ON discentes
FOR SELECT
USING (true);

CREATE POLICY "discentes_public_insert"
ON discentes
FOR INSERT
WITH CHECK (true);

CREATE POLICY "docentes_public_select"
ON docentes
FOR SELECT
USING (true);

CREATE POLICY "docentes_public_insert"
ON docentes
FOR INSERT
WITH CHECK (true);

CREATE POLICY "servidores_public_select"
ON servidores
FOR SELECT
USING (true);

CREATE POLICY "servidores_public_insert"
ON servidores
FOR INSERT
WITH CHECK (true);

CREATE POLICY "eventos_public_select"
ON eventos
FOR SELECT
USING (true);

CREATE POLICY "eventos_public_insert"
ON eventos
FOR INSERT
WITH CHECK (true);

CREATE POLICY "eventos_public_update"
ON eventos
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "inscricoes_public_select"
ON inscricoes_evento
FOR SELECT
USING (true);

CREATE POLICY "inscricoes_public_insert"
ON inscricoes_evento
FOR INSERT
WITH CHECK (true);

CREATE POLICY "inscricoes_public_update"
ON inscricoes_evento
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "notificacoes_public_select"
ON notificacoes
FOR SELECT
USING (true);

CREATE POLICY "notificacoes_public_insert"
ON notificacoes
FOR INSERT
WITH CHECK (true);

CREATE POLICY "notificacoes_public_update"
ON notificacoes
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "interesses_public_select"
ON usuario_interesses
FOR SELECT
USING (true);

CREATE POLICY "interesses_public_insert"
ON usuario_interesses
FOR INSERT
WITH CHECK (true);

CREATE POLICY "interesses_public_update"
ON usuario_interesses
FOR UPDATE
USING (true)
WITH CHECK (true);
