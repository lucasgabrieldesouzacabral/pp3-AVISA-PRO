import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

function getExpoVariable(name) {
  const readProcess = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  const readExtra = Constants?.expoConfig?.extra?.[name];
  return readProcess || readExtra || undefined;
}

const SUPABASE_URL = getExpoVariable('EXPO_PUBLIC_SUPABASE_URL') || getExpoVariable('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY =
  getExpoVariable('EXPO_PUBLIC_SUPABASE_ANON_KEY') ||
  getExpoVariable('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
  getExpoVariable('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
  getExpoVariable('NEXT_PUBLIC_SUPABASE_ANON_KEY');

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY para usar o banco compartilhado.');
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

export function initDatabase() {
  return true;
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeEventPayload(payload = {}) {
  const support = normalizeText(payload.support);
  const spots = Number(payload.spots);
  const normalized = {
    titulo: normalizeText(payload.title),
    descricao: normalizeText(payload.description),
    data_evento: normalizeText(payload.date),
    horario: normalizeText(payload.time),
    local: normalizeText(payload.location),
    suporte_terceiros: support === 'yes' ? 1 : support === 'no' ? 0 : null,
    suporte_detalhes: normalizeText(payload.supportDetails),
    vagas_disponiveis: spots,
    id_organizador_principal: Number(payload.organizerId),
  };

  if (!normalized.titulo || !normalized.descricao || !normalized.local) {
    throw new Error('Preencha o título, a descrição e o local do evento.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized.data_evento)) {
    throw new Error('Informe uma data válida para o evento.');
  }

  const [year, month, day] = normalized.data_evento.split('-').map(Number);
  const validDate = Number.isInteger(year)
    && Number.isInteger(month)
    && Number.isInteger(day)
    && month >= 1
    && month <= 12
    && day >= 1
    && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();

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

function normalizeUserRecord(row) {
  if (!row) return null;

  return {
    ...row,
    id_usuario: Number(row.id_usuario),
    matricula: row.matricula || null,
    interesses: row.interesses ?? [],
  };
}

async function fetchUsersByIds(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean).map(Number))];
  if (!uniqueIds.length) return {};

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('usuarios')
    .select('id_usuario, nome_completo, email_institucional, matricula, tipo_usuario')
    .in('id_usuario', uniqueIds);

  if (error) throw error;

  return Object.fromEntries((data || []).map((user) => [Number(user.id_usuario), user]));
}

async function createNotification(id_usuario, mensagem) {
  const client = getSupabaseClient();
  const createdAt = new Date().toISOString();

  const { data, error } = await client
    .from('notificacoes')
    .insert({
      id_usuario: Number(id_usuario),
      mensagem,
      data_envio: createdAt,
      lida: 0,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function notifyAuthorities(mensagem) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('usuarios')
    .select('id_usuario')
    .in('tipo_usuario', ['Docente', 'Servidor']);

  if (error) throw error;
  await Promise.all((data || []).map((user) => createNotification(user.id_usuario, mensagem)));
}

export function normalizeRegistrationPayload(payload = {}) {
  return {
    nome_completo: normalizeText(payload.nome_completo),
    email_institucional: normalizeText(payload.email_institucional).toLowerCase(),
    matricula: normalizeText(payload.matricula),
    senha: normalizeText(payload.senha),
    tipo_usuario: normalizeText(payload.tipo_usuario),
    curso: normalizeText(payload.curso),
    CNDB: normalizeText(payload.CNDB),
    cpf: normalizeText(payload.cpf),
  };
}

export function validateRegistrationPayload(payload = {}) {
  const normalized = normalizeRegistrationPayload(payload);

  if (!normalized.nome_completo) throw new Error('Informe o nome completo.');
  if (!normalized.email_institucional || !normalized.email_institucional.includes('@')) {
    throw new Error('Informe um e-mail institucional válido.');
  }
  if (!normalized.senha) throw new Error('Informe a senha.');
  if (!['Discente', 'Docente', 'Servidor'].includes(normalized.tipo_usuario)) {
    throw new Error('Selecione um tipo de usuário válido.');
  }

  if (normalized.tipo_usuario === 'Discente' && !normalized.curso) {
    throw new Error('Informe o curso do discente.');
  }

  if (normalized.tipo_usuario === 'Docente' && !normalized.CNDB) {
    throw new Error('Informe o CNDB do docente.');
  }

  if (normalized.tipo_usuario === 'Servidor' && !normalized.cpf) {
    throw new Error('Informe o CPF do servidor.');
  }

  return normalized;
}

export async function registerUser(payload = {}) {
  const normalized = validateRegistrationPayload(payload);
  const client = getSupabaseClient();

  const { data: existingUser } = await client
    .from('usuarios')
    .select('id_usuario')
    .eq('email_institucional', normalized.email_institucional)
    .maybeSingle();

  if (existingUser) throw new Error('E-mail institucional já cadastrado.');

  if (normalized.matricula) {
    const { data: existingMatricula } = await client
      .from('usuarios')
      .select('id_usuario')
      .eq('matricula', normalized.matricula)
      .maybeSingle();

    if (existingMatricula) throw new Error('Matrícula já cadastrada.');
  }

  const { data: userData, error: userError } = await client
    .from('usuarios')
    .insert({
      nome_completo: normalized.nome_completo,
      email_institucional: normalized.email_institucional,
      matricula: normalized.matricula || null,
      senha: normalized.senha,
      tipo_usuario: normalized.tipo_usuario,
    })
    .select('*')
    .single();

  if (userError) throw userError;

  const userId = Number(userData.id_usuario);

  if (normalized.tipo_usuario === 'Discente') {
    const { error: detailError } = await client.from('discentes').insert({ id_usuario: userId, curso: normalized.curso });
    if (detailError) throw detailError;
  }

  if (normalized.tipo_usuario === 'Docente') {
    const { error: detailError } = await client.from('docentes').insert({ id_usuario: userId, CNDB: Number(normalized.CNDB) });
    if (detailError) throw detailError;
  }

  if (normalized.tipo_usuario === 'Servidor') {
    const { error: detailError } = await client.from('servidores').insert({ id_usuario: userId, cpf: normalized.cpf });
    if (detailError) throw detailError;
  }

  return normalizeUserRecord({ ...userData, interesses: [] });
}

export async function registerDiscente(payload) {
  return registerUser({ ...payload, tipo_usuario: 'Discente' });
}

export async function registerDocente(payload) {
  return registerUser({ ...payload, tipo_usuario: 'Docente' });
}

export async function registerServidor(payload) {
  return registerUser({ ...payload, tipo_usuario: 'Servidor' });
}

export async function loginDiscente(email_institucional, senha) {
  return loginUser(email_institucional, senha);
}

export async function loginUser(email_institucional, senha) {
  const client = getSupabaseClient();
  const normalizedEmail = normalizeText(email_institucional).toLowerCase();
  const normalizedPassword = normalizeText(senha);

  if (!normalizedEmail || !normalizedPassword) {
    throw new Error('Informe e-mail e senha para entrar.');
  }

  const { data, error } = await client
    .from('usuarios')
    .select('*')
    .eq('email_institucional', normalizedEmail)
    .eq('senha', normalizedPassword)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('E-mail ou senha inválidos.');

  return normalizeUserRecord({ ...data, interesses: await getUserInterests(data.id_usuario) });
}

export async function getUserInterests(id_usuario) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('usuario_interesses')
    .select('interesse')
    .eq('id_usuario', Number(id_usuario))
    .order('interesse', { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => row.interesse);
}

export async function updateUserInterests(id_usuario, interests = []) {
  const client = getSupabaseClient();
  const normalized = [...new Set((interests || []).map((interest) => String(interest).trim()).filter(Boolean))].slice(0, 8);

  const { error: deleteError } = await client.from('usuario_interesses').delete().eq('id_usuario', Number(id_usuario));
  if (deleteError) throw deleteError;

  if (!normalized.length) return normalized;

  const { error } = await client
    .from('usuario_interesses')
    .insert(normalized.map((interesse) => ({ id_usuario: Number(id_usuario), interesse: interesse })));

  if (error) throw error;
  return normalized;
}

export async function getDiscenteById(id_usuario) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('usuarios')
    .select('id_usuario, nome_completo, email_institucional, matricula, tipo_usuario')
    .eq('id_usuario', Number(id_usuario))
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { data: discenteData, error: discenteError } = await client
    .from('discentes')
    .select('curso')
    .eq('id_usuario', Number(id_usuario))
    .maybeSingle();

  if (discenteError) throw discenteError;
  return { ...data, curso: discenteData?.curso || '' };
}

export async function getUserById(id_usuario) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('usuarios')
    .select('*')
    .eq('id_usuario', Number(id_usuario))
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  let specificData = {};
  if (data.tipo_usuario === 'Discente') {
    const { data: discenteData } = await client.from('discentes').select('curso').eq('id_usuario', Number(id_usuario)).maybeSingle();
    specificData = discenteData || {};
  }

  if (data.tipo_usuario === 'Docente') {
    const { data: docenteData } = await client.from('docentes').select('CNDB').eq('id_usuario', Number(id_usuario)).maybeSingle();
    specificData = docenteData || {};
  }

  if (data.tipo_usuario === 'Servidor') {
    const { data: servidorData } = await client.from('servidores').select('cpf').eq('id_usuario', Number(id_usuario)).maybeSingle();
    specificData = servidorData || {};
  }

  return {
    ...data,
    ...specificData,
    interesses: await getUserInterests(id_usuario),
  };
}

export async function updateUserProfile(id_usuario, payload = {}) {
  const userId = Number(id_usuario);
  const name = normalizeText(payload.nome_completo);
  const email = normalizeText(payload.email_institucional).toLowerCase();
  const matricula = normalizeText(payload.matricula);

  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error('Usuário não autenticado.');
  if (!name || !email.includes('@')) throw new Error('Informe seu nome e um e-mail válido.');

  const client = getSupabaseClient();
  const currentUser = await getUserById(userId);
  if (!currentUser) throw new Error('Usuário não encontrado.');

  const specificColumn = currentUser.tipo_usuario === 'Discente'
    ? 'curso'
    : currentUser.tipo_usuario === 'Docente'
      ? 'CNDB'
      : 'cpf';
  const specificValue = normalizeText(payload[specificColumn]);
  if (!specificValue) throw new Error('Preencha o dado específico do seu perfil.');

  const { data: emailConflict } = await client
    .from('usuarios')
    .select('id_usuario')
    .eq('email_institucional', email)
    .neq('id_usuario', userId)
    .maybeSingle();

  if (emailConflict) throw new Error('E-mail institucional já cadastrado.');

  if (matricula) {
    const { data: matriculaConflict } = await client
      .from('usuarios')
      .select('id_usuario')
      .eq('matricula', matricula)
      .neq('id_usuario', userId)
      .maybeSingle();

    if (matriculaConflict) throw new Error('Matrícula já cadastrada.');
  }

  const { error: userError } = await client
    .from('usuarios')
    .update({
      nome_completo: name,
      email_institucional: email,
      matricula: matricula || null,
    })
    .eq('id_usuario', userId);

  if (userError) throw userError;

  const table = currentUser.tipo_usuario === 'Discente'
    ? 'discentes'
    : currentUser.tipo_usuario === 'Docente'
      ? 'docentes'
      : 'servidores';

  const { data: rowExists } = await client
    .from(table)
    .select('id_usuario')
    .eq('id_usuario', userId)
    .maybeSingle();

  if (rowExists) {
    const { error: profileError } = await client
      .from(table)
      .update({ [specificColumn]: currentUser.tipo_usuario === 'Docente' ? Number(specificValue) : specificValue })
      .eq('id_usuario', userId);

    if (profileError) throw profileError;
  } else {
    const { error: profileError } = await client
      .from(table)
      .insert({ id_usuario: userId, [specificColumn]: currentUser.tipo_usuario === 'Docente' ? Number(specificValue) : specificValue });

    if (profileError) throw profileError;
  }

  return getUserById(userId);
}

export async function createEvent(payload = {}) {
  const event = normalizeEventPayload(payload);
  const organizer = await getUserById(event.id_organizador_principal);
  if (!organizer) throw new Error('O usuário organizador não foi encontrado.');

  const autoConfirmed = ['Docente', 'Servidor'].includes(organizer.tipo_usuario);
  const createdAt = new Date().toISOString();
  const client = getSupabaseClient();

  const { data: savedEvent, error } = await client
    .from('eventos')
    .insert({
      titulo: event.titulo,
      descricao: event.descricao,
      data_evento: event.data_evento,
      horario: event.horario,
      local: event.local,
      vagas_disponiveis: event.vagas_disponiveis,
      suporte_terceiros: event.suporte_terceiros,
      suporte_detalhes: event.suporte_detalhes || null,
      status: autoConfirmed ? 'Confirmado' : 'Pendente',
      id_confirmador: autoConfirmed ? organizer.id_usuario : null,
      data_confirmacao: autoConfirmed ? createdAt : null,
      data_criacao: createdAt,
      id_organizador_principal: event.id_organizador_principal,
    })
    .select('*')
    .single();

  if (error) throw error;

  const message = autoConfirmed
    ? `Seu evento "${savedEvent.titulo}" foi publicado e confirmado automaticamente.`
    : `Seu evento "${savedEvent.titulo}" foi publicado e está aguardando confirmação.`;

  await createNotification(event.id_organizador_principal, message);

  if (!autoConfirmed) {
    await notifyAuthorities(`Novo evento de ${organizer.nome_completo}: "${savedEvent.titulo}" aguarda confirmação.`);
  }

  return {
    ...savedEvent,
    nome_organizador: organizer.nome_completo,
    tipo_organizador: organizer.tipo_usuario,
    nome_confirmador: autoConfirmed ? organizer.nome_completo : '',
  };
}

export async function getEvents() {
  const client = getSupabaseClient();
  const { data: events, error } = await client
    .from('eventos')
    .select('*')
    .order('data_evento', { ascending: true })
    .order('horario', { ascending: true });

  if (error) throw error;

  const uniqueUserIds = [...new Set((events || []).flatMap((event) => [
    event.id_organizador_principal,
    event.id_confirmador,
    event.id_rejeitador,
  ]).filter(Boolean).map(Number))];

  const users = await fetchUsersByIds(uniqueUserIds);

  const { data: subscriptionsData } = await client.from('inscricoes_evento').select('id_evento');

  return (events || []).map((event) => ({
    ...event,
    nome_organizador: users[Number(event.id_organizador_principal)]?.nome_completo || '',
    tipo_organizador: users[Number(event.id_organizador_principal)]?.tipo_usuario || '',
    nome_confirmador: users[Number(event.id_confirmador)]?.nome_completo || '',
    nome_rejeitador: users[Number(event.id_rejeitador)]?.nome_completo || '',
    total_inscritos: (subscriptionsData || []).filter((subscription) => Number(subscription.id_evento) === Number(event.id_evento)).length,
  }));
}

export async function getEventSubscribers(id_evento) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('inscricoes_evento')
    .select('*')
    .eq('id_evento', Number(id_evento))
    .order('id_usuario', { ascending: true });

  if (error) throw error;
  if (!data?.length) return [];

  const users = await fetchUsersByIds(data.map((subscription) => subscription.id_usuario));
  return data
    .map((subscription) => ({
      ...subscription,
      nome_completo: users[Number(subscription.id_usuario)]?.nome_completo || 'Usuário',
      tipo_usuario: users[Number(subscription.id_usuario)]?.tipo_usuario || '',
    }))
    .sort((first, second) => String(first.nome_completo).localeCompare(String(second.nome_completo)));
}

export async function getEventById(id_evento) {
  const eventId = Number(id_evento);
  const client = getSupabaseClient();
  const { data: event, error } = await client.from('eventos').select('*').eq('id_evento', eventId).maybeSingle();

  if (error) throw error;
  if (!event) return null;

  const users = await fetchUsersByIds([
    event.id_organizador_principal,
    event.id_confirmador,
    event.id_rejeitador,
  ]);

  const { data: subscriptionsData } = await client.from('inscricoes_evento').select('id_usuario').eq('id_evento', eventId);

  return {
    ...event,
    nome_organizador: users[Number(event.id_organizador_principal)]?.nome_completo || '',
    tipo_organizador: users[Number(event.id_organizador_principal)]?.tipo_usuario || '',
    nome_confirmador: users[Number(event.id_confirmador)]?.nome_completo || '',
    nome_rejeitador: users[Number(event.id_rejeitador)]?.nome_completo || '',
    total_inscritos: subscriptionsData?.length || 0,
    inscricoes: await getEventSubscribers(eventId),
  };
}

export async function subscribeToEvent(payload = {}) {
  const eventId = Number(payload.id_evento);
  const userId = Number(payload.id_usuario);
  const tipoInscricao = normalizeText(payload.tipo_inscricao || 'Participante');
  const justificativaContribuicao = normalizeText(payload.justificativa_contribuicao || '');

  if (!Number.isSafeInteger(eventId) || eventId < 1) throw new Error('Evento inválido.');
  if (!Number.isSafeInteger(userId) || userId < 1) throw new Error('Usuário inválido.');
  if (!['Participante', 'Colaborador'].includes(tipoInscricao)) throw new Error('Selecione um tipo de inscrição válido.');

  const client = getSupabaseClient();
  const { data: user, error: userError } = await client.from('usuarios').select('id_usuario, tipo_usuario').eq('id_usuario', userId).maybeSingle();
  if (userError) throw userError;
  if (!user) throw new Error('Usuário não encontrado.');

  const { data: event, error: eventError } = await client.from('eventos').select('*').eq('id_evento', eventId).maybeSingle();
  if (eventError) throw eventError;
  if (!event) throw new Error('Evento não encontrado.');
  if (event.status !== 'Confirmado') throw new Error('Somente eventos confirmados aceitam inscrições.');
  if (Number(event.id_organizador_principal) === userId) throw new Error('O organizador não pode se inscrever no próprio evento.');

  const { data: alreadyRegistered } = await client
    .from('inscricoes_evento')
    .select('id_usuario')
    .eq('id_evento', eventId)
    .eq('id_usuario', userId)
    .maybeSingle();

  if (alreadyRegistered) throw new Error('Você já está inscrito neste evento.');

  const remainingSpots = Number(event.vagas_disponiveis || 0);
  if (remainingSpots < 1) throw new Error('Este evento já está lotado.');

  const { error: insertError } = await client.from('inscricoes_evento').insert({
    id_usuario: userId,
    id_evento: eventId,
    tipo_inscricao: tipoInscricao,
    justificativa_contribuicao: justificativaContribuicao || null,
    presenca_confirmada: 0,
  });

  if (insertError) throw insertError;

  const nextSpots = Math.max(0, remainingSpots - 1);
  const { error: updateError } = await client.from('eventos').update({ vagas_disponiveis: nextSpots }).eq('id_evento', eventId);
  if (updateError) throw updateError;

  await createNotification(userId, `Sua inscrição no evento "${event.titulo}" foi registrada com sucesso.`);
  return getEventById(eventId);
}

export async function confirmEvent(id_evento, id_usuario) {
  const eventId = Number(id_evento);
  const userId = Number(id_usuario);
  const client = getSupabaseClient();

  if (!Number.isSafeInteger(eventId) || eventId < 1 || !Number.isSafeInteger(userId) || userId < 1) {
    throw new Error('Evento ou usuário inválido.');
  }

  const { data: confirmer } = await client
    .from('usuarios')
    .select('id_usuario, nome_completo, tipo_usuario')
    .eq('id_usuario', userId)
    .in('tipo_usuario', ['Docente', 'Servidor'])
    .maybeSingle();

  if (!confirmer) throw new Error('Somente docentes e servidores podem confirmar eventos.');

  const { data: event } = await client
    .from('eventos')
    .select('*, usuarios!id_organizador_principal(tipo_usuario)')
    .eq('id_evento', eventId)
    .in('status', ['Pendente', 'Adiado'])
    .maybeSingle();

  if (!event) throw new Error('Evento não encontrado ou já confirmado.');

  if (event.usuarios?.tipo_usuario !== 'Discente') {
    throw new Error('Eventos criados por autoridades não precisam de confirmação.');
  }

  const confirmedAt = new Date().toISOString();
  const { data: updatedEvent, error } = await client
    .from('eventos')
    .update({
      status: 'Confirmado',
      id_confirmador: userId,
      data_confirmacao: confirmedAt,
      id_rejeitador: null,
      data_rejeicao: null,
    })
    .eq('id_evento', eventId)
    .select('*')
    .single();

  if (error) throw error;
  await createNotification(event.id_organizador_principal, `Seu evento "${event.titulo}" foi confirmado por ${confirmer.nome_completo}.`);
  await createNotification(userId, `Você confirmou o evento "${event.titulo}".`);
  return { ...updatedEvent, nome_organizador: event.usuarios?.nome_completo || '', nome_confirmador: confirmer.nome_completo };
}

export async function rejectEvent(id_evento, id_usuario, justification) {
  const eventId = Number(id_evento);
  const userId = Number(id_usuario);
  const reason = normalizeText(justification);

  if (!Number.isSafeInteger(eventId) || eventId < 1 || !Number.isSafeInteger(userId) || userId < 1) {
    throw new Error('Evento ou usuário inválido.');
  }

  if (!reason) throw new Error('Informe uma justificativa para recusar o evento.');

  const client = getSupabaseClient();
  const { data: rejecter } = await client
    .from('usuarios')
    .select('id_usuario, nome_completo')
    .eq('id_usuario', userId)
    .in('tipo_usuario', ['Docente', 'Servidor'])
    .maybeSingle();

  if (!rejecter) throw new Error('Somente docentes e servidores podem recusar eventos.');

  const { data: event } = await client
    .from('eventos')
    .select('*')
    .eq('id_evento', eventId)
    .in('status', ['Pendente', 'Adiado'])
    .maybeSingle();

  if (!event) throw new Error('Evento não encontrado ou já analisado.');

  const organizer = await getUserById(event.id_organizador_principal);
  if (!organizer || organizer.tipo_usuario !== 'Discente') {
    throw new Error('Eventos criados por autoridades não precisam de confirmação.');
  }

  const rejectedAt = new Date().toISOString();
  const { data: updatedEvent } = await client
    .from('eventos')
    .update({
      status: 'Cancelado',
      justificativa_status: reason,
      id_rejeitador: userId,
      data_rejeicao: rejectedAt,
    })
    .eq('id_evento', eventId)
    .select('*')
    .single();

  await createNotification(event.id_organizador_principal, `A criação do evento "${event.titulo}" foi recusada por ${rejecter.nome_completo}. Motivo: ${reason}`);
  await createNotification(userId, `Você recusou a criação do evento "${event.titulo}".`);

  return { ...updatedEvent, nome_rejeitador: rejecter.nome_completo };
}

export async function updateEventStatus(id_evento, id_usuario, action, payload = {}) {
  const eventId = Number(id_evento);
  const userId = Number(id_usuario);
  const normalizedAction = String(action || '').trim();
  const justification = normalizeText(payload.justification);

  if (!Number.isSafeInteger(eventId) || eventId < 1 || !Number.isSafeInteger(userId) || userId < 1) {
    throw new Error('Evento ou usuário inválido.');
  }

  if (!['cancel', 'reschedule'].includes(normalizedAction)) {
    throw new Error('Ação de evento inválida.');
  }

  const client = getSupabaseClient();
  const { data: event, error: eventError } = await client.from('eventos').select('*').eq('id_evento', eventId).maybeSingle();
  if (eventError) throw eventError;
  if (!event) throw new Error('Evento não encontrado.');

  if (normalizedAction === 'cancel') {
    const { data: updatedEvent, error } = await client
      .from('eventos')
      .update({ status: 'Cancelado', justificativa_status: justification || 'Evento cancelado pelo organizador.' })
      .eq('id_evento', eventId)
      .select('*')
      .single();

    if (error) throw error;
    await createNotification(event.id_organizador_principal, `O evento "${event.titulo}" foi cancelado.`);
    return updatedEvent;
  }

  const date = normalizeText(payload.date);
  const time = normalizeText(payload.time);
  if (!date || !time) throw new Error('Informe a nova data e o novo horário do evento.');

  const { data: updatedEvent, error } = await client
    .from('eventos')
    .update({
      data_evento: date,
      horario: time,
      status: 'Adiado',
      justificativa_status: justification || 'Evento remarcado pelo organizador.',
    })
    .eq('id_evento', eventId)
    .select('*')
    .single();

  if (error) throw error;
  await createNotification(event.id_organizador_principal, `O evento "${event.titulo}" foi remarcado para ${date} às ${time}.`);
  return updatedEvent;
}

export async function getNotifications(id_usuario) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('notificacoes')
    .select('*')
    .eq('id_usuario', Number(id_usuario))
    .order('data_envio', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function markNotificationAsRead(id_notificacao, id_usuario) {
  const client = getSupabaseClient();
  const { error } = await client
    .from('notificacoes')
    .update({ lida: 1 })
    .eq('id_notificacao', Number(id_notificacao))
    .eq('id_usuario', Number(id_usuario));

  if (error) throw error;
}

export async function markAllNotificationsAsRead(id_usuario) {
  const client = getSupabaseClient();
  const { error } = await client
    .from('notificacoes')
    .update({ lida: 1 })
    .eq('id_usuario', Number(id_usuario));

  if (error) throw error;
}

export default {
  initDatabase,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createEvent,
  getEvents,
  getEventSubscribers,
  getEventById,
  subscribeToEvent,
  rejectEvent,
  confirmEvent,
  updateEventStatus,
  normalizeRegistrationPayload,
  validateRegistrationPayload,
  registerUser,
  registerDiscente,
  registerDocente,
  registerServidor,
  loginDiscente,
  loginUser,
  getUserInterests,
  updateUserInterests,
  getDiscenteById,
  getUserById,
  updateUserProfile,
};
