import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { WebView } from 'react-native-webview';

const pages = {
  login: require('../Telas/index.html'),
  cadastro: require('../Telas/cadastro.html'),
  inicio: require('../Telas/inicio.html'),
  calendario: require('../Telas/calendario.html'),
  notificacoes: require('../Telas/notificacoes.html'),
  'criar-evento': require('../Telas/criar-evento.html'),
  perfil: require('../Telas/perfil.html'),
  'editar-perfil': require('../Telas/editar-perfil.html'),
  'visualizar-evento': require('../Telas/visualizar-evento.html'),
};

const stylesheet = require('../Telas/css/styles.css');

async function readAssetText(asset) {
  if (Platform.OS === 'web') {
    const response = await fetch(asset.localUri || asset.uri);
    if (!response.ok) throw new Error(`Falha ao ler asset: ${response.status}`);
    return response.text();
  }

  if (!asset.localUri) throw new Error('O asset não foi baixado para o dispositivo.');
  return new File(asset.localUri).text();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function renderEvents(events) {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const statusOrder = [
    { key: 'Confirmado', label: 'Confirmados' },
    { key: 'Pendente', label: 'Pendentes' },
    { key: 'Adiado', label: 'Adiados' },
    { key: 'Cancelado', label: 'Cancelados' },
  ];

  if (!events.length) return '<p class="event-empty">Ainda não há eventos armazenados.</p>';

  const groupedEvents = events.reduce((groups, event) => {
    const groupKey = event.id_rejeitador ? 'Cancelado' : event.status;
    if (groups[groupKey]) groups[groupKey].push(event);
    return groups;
  }, { Confirmado: [], Pendente: [], Adiado: [], Cancelado: [] });

  return statusOrder.filter(({ key }) => groupedEvents[key].length).map(({ key, label }) => `<section class="event-group">
    <div class="event-group-head"><h2>${label}</h2><span>${groupedEvents[key].length}</span></div>
    <div class="event-group-list">${groupedEvents[key].map((event) => {
    const [year, month, day] = event.data_evento.split('-');
    const monthName = months[Number(month) - 1] || month;
    const statusLabel = event.id_rejeitador ? 'Recusado' : event.status;
    const statusClass = statusLabel === 'Pendente'
      ? 'badge pending'
      : statusLabel === 'Cancelado' || statusLabel === 'Recusado'
        ? 'badge cancelled'
        : statusLabel === 'Adiado'
          ? 'badge postponed'
          : 'badge';

    return `<article class="event-card stored-event" data-event-id="${escapeHtml(event.id_evento)}" role="button" tabindex="0" aria-label="Visualizar ${escapeHtml(event.titulo)}">
      <div class="date-chip"><strong>${escapeHtml(day)}</strong><span>${escapeHtml(monthName)}</span></div>
      <div>
        <div class="event-top"><h2>${escapeHtml(event.titulo)}</h2><span class="${statusClass}">${escapeHtml(statusLabel)}</span></div>
        <div class="meta">
          <span>${escapeHtml(`${day} ${monthName} ${year} • ${event.horario}`)}</span>
          <span>${escapeHtml(event.local)}</span>
          <span>${escapeHtml(event.vagas_disponiveis)} vagas</span>
        </div>
      </div>
    </article>`;
    }).join('')}</div>
  </section>`).join('');
}

function renderRecentHistory(events, user) {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const isModerator = ['Docente', 'Servidor'].includes(user?.tipo_usuario);
  const userEvents = events
    .filter((event) => isModerator
      ? Number(event.id_confirmador) === Number(user?.id_usuario)
      : Number(event.id_organizador_principal) === Number(user?.id_usuario))
    .sort((first, second) => String(second.data_confirmacao || second.data_criacao || '').localeCompare(String(first.data_confirmacao || first.data_criacao || '')))
    .slice(0, 10);

  if (!userEvents.length) {
    return isModerator
      ? '<p>Você ainda não confirmou nenhum evento.</p>'
      : '<p>Você ainda não criou eventos.</p>';
  }

  return userEvents.map((event) => {
    const activityDate = isModerator
      ? String(event.data_confirmacao || event.data_criacao || event.data_evento)
      : String(event.data_criacao || event.data_evento);
    const [year, month, day] = activityDate.split(/[T ]/)[0].split('-');
    const dateLabel = `${day} ${months[Number(month) - 1] || ''}`.trim();
    const description = isModerator
      ? Number(event.id_confirmador) === Number(event.id_organizador_principal)
        ? 'Você criou este evento já confirmado.'
        : `Você confirmou este evento criado por ${escapeHtml(event.nome_organizador || 'um discente')}.`
      : `Você criou este evento. Status: ${escapeHtml(event.status)}.`;

    return `<div class="timeline-item">
      <span class="dot"></span>
      <div><strong>${escapeHtml(event.titulo)}</strong><p>${description}</p></div>
      <time>${escapeHtml(dateLabel)}</time>
    </div>`;
  }).join('');
}

function formatDate(value) {
  const dateParts = String(value || '').split(/[T ]/)[0].split('-');
  return dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : 'Não informado';
}

function formatNotificationDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Agora';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function renderNotifications(notifications) {
  if (!notifications.length) {
    return '<div class="notification-empty"><strong>Tudo em dia</strong><p>Você ainda não recebeu nenhuma notificação.</p></div>';
  }

  return notifications.map((notification) => `
    <article class="notification-item${Number(notification.lida) ? '' : ' unread'}">
      <span class="notification-icon" aria-hidden="true">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
      </span>
      <div class="notification-content">
        <p>${escapeHtml(notification.mensagem)}</p>
        <time>${escapeHtml(formatNotificationDate(notification.data_envio))}</time>
      </div>
      ${Number(notification.lida) ? '' : `<button class="notification-read" type="button" data-notification-id="${escapeHtml(notification.id_notificacao)}">Marcar como lida</button>`}
    </article>`
  ).join('');
}

function renderEventActions(event, user) {
  if (Number(event?.id_organizador_principal) !== Number(user?.id_usuario)) return '';
  if (event.status === 'Cancelado') {
    return `<div class="event-actions-note">Este evento já está marcado como <strong>${escapeHtml(event.status.toLowerCase())}</strong>.</div>`;
  }

  return `<section class="event-owner-actions">
    <div>
      <span class="page-kicker">Ações do organizador</span>
      <h2>Precisa atualizar este evento?</h2>
      <p>Você pode cancelar ou informar uma nova data. A justificativa é opcional.</p>
    </div>
    <div class="event-action-grid">
      <form class="event-action-card cancel-action" data-form-type="eventAction">
        <input type="hidden" name="id_evento" value="${escapeHtml(event.id_evento)}" />
        <input type="hidden" name="action" value="cancel" />
        <label for="cancel-justification">Justificativa <span>(opcional)</span></label>
        <textarea id="cancel-justification" name="justification" rows="3" placeholder="Conte, se quiser, por que o evento foi cancelado."></textarea>
        <button class="btn btn-danger" type="submit">Cancelar evento</button>
      </form>
      <form class="event-action-card" data-form-type="eventAction">
        <input type="hidden" name="id_evento" value="${escapeHtml(event.id_evento)}" />
        <input type="hidden" name="action" value="reschedule" />
        <div class="event-action-fields">
          <label>Nova data<input type="date" name="date" value="${escapeHtml(event.data_evento)}" required /></label>
          <label>Novo horário<input type="time" name="time" value="${escapeHtml(event.horario)}" required /></label>
        </div>
        <label for="reschedule-justification">Justificativa <span>(opcional)</span></label>
        <textarea id="reschedule-justification" name="justification" rows="3" placeholder="Conte, se quiser, o motivo da remarcação."></textarea>
        <button class="btn btn-secondary" type="submit">Remarcar evento</button>
      </form>
    </div>
  </section>`;
}

function renderEventModeration(event, user) {
  const canConfirm = ['Docente', 'Servidor'].includes(user?.tipo_usuario);
  if (!canConfirm || event.tipo_organizador !== 'Discente' || !['Pendente', 'Adiado'].includes(event.status)) return '';

  return `<section class="event-moderation">
    <div>
      <span class="page-kicker">Avaliação institucional</span>
      <h2>Este evento aguarda confirmação</h2>
      <p>Confirme a criação para liberar o evento como aprovado para os participantes.</p>
    </div>
    <div class="moderation-actions">
      <form data-form-type="confirmEvent">
        <input type="hidden" name="id_evento" value="${escapeHtml(event.id_evento)}" />
        <button class="btn" type="submit">Confirmar criação do evento</button>
      </form>
      <form class="reject-form" data-form-type="rejectEvent">
        <input type="hidden" name="id_evento" value="${escapeHtml(event.id_evento)}" />
        <button class="btn btn-danger" type="submit">Recusar criação</button>
        <label for="reject-justification">Justificativa obrigatória</label>
        <textarea id="reject-justification" name="justification" rows="3" required placeholder="Explique por que a criação foi recusada."></textarea>
      </form>
    </div>
  </section>`;
}

function addBridge(html, css, route, user, events, notifications, selectedEvent) {
  const profileData = JSON.stringify({
    id_usuario: user?.id_usuario || null,
    interesses: user?.interesses || [],
  });
  const bridge = `
    <script>
      window.__AVISA_PROFILE__ = ${profileData};

      document.addEventListener('click', function (event) {
        const eventCard = event.target.closest('[data-event-id]');
        if (!eventCard) return;
        const message = JSON.stringify({ type: 'viewEvent', id_evento: Number(eventCard.dataset.eventId) });
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
        else window.parent.postMessage(message, '*');
      });

      document.addEventListener('keydown', function (event) {
        const eventCard = event.target.closest('[data-event-id]');
        if (!eventCard || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        eventCard.click();
      });

      document.addEventListener('click', function (event) {
        const readButton = event.target.closest('[data-notification-id]');
        if (!readButton) return;
        event.preventDefault();
        event.stopPropagation();
        const message = JSON.stringify({ type: 'markNotificationAsRead', id_notificacao: Number(readButton.dataset.notificationId) });
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
        else window.parent.postMessage(message, '*');
      });

      document.addEventListener('click', function (event) {
        const markAllButton = event.target.closest('[data-mark-all-notifications]');
        if (!markAllButton) return;
        event.preventDefault();
        event.stopPropagation();
        const message = JSON.stringify({ type: 'markAllNotificationsAsRead' });
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
        else window.parent.postMessage(message, '*');
      });

      document.addEventListener('click', function (event) {
        const link = event.target.closest('a');
        if (!link || !link.getAttribute('href')) return;
        const href = link.getAttribute('href');
        if (href === 'index.html' || href === 'cadastro.html' || href === 'inicio.html' || href === 'calendario.html' || href === 'notificacoes.html' || href === 'criar-evento.html' || href === 'perfil.html' || href === 'editar-perfil.html') {
          event.preventDefault();
          const message = JSON.stringify({ type: 'route', route: href });
          if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
          else window.parent.postMessage(message, '*');
        }
      });

      document.addEventListener('submit', function (event) {
        event.preventDefault();
        const formElement = event.target;
        const form = new FormData(formElement);
        const data = Object.fromEntries(form.entries());
        const message = JSON.stringify({
          type: formElement.getAttribute('data-form-type') || ('${route}' === 'cadastro' ? 'register' : '${route}' === 'criar-evento' ? 'createEvent' : '${route}' === 'editar-perfil' ? 'updateProfile' : 'login'),
          ...data,
          password: data.password
        });
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
        else window.parent.postMessage(message, '*');
      });
    </script>
  `;

  const pageWithoutExternalStylesheet = html.replace(
    /<link[^>]+href=["']css\/styles\.css["'][^>]*>/i,
    ''
  );

  const currentUser = user || {};
  const initials = (currentUser.nome_completo || 'Usuário')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0])
    .join('')
    .toUpperCase();
  const specificField = currentUser.tipo_usuario === 'Docente'
    ? { label: 'CNDB', value: currentUser.CNDB }
    : currentUser.tipo_usuario === 'Servidor'
      ? { label: 'CPF', value: currentUser.cpf }
      : { label: 'Curso', value: currentUser.curso };
  const personalizedPage = pageWithoutExternalStylesheet
    .replaceAll('{{NOME_USUARIO}}', currentUser.nome_completo || 'Usuário')
    .replaceAll('{{EMAIL_USUARIO}}', currentUser.email_institucional || '')
    .replaceAll('{{MATRICULA_USUARIO}}', currentUser.matricula || '')
    .replaceAll('{{CURSO_USUARIO}}', currentUser.curso || '')
    .replaceAll('{{TIPO_USUARIO}}', currentUser.tipo_usuario || '')
    .replaceAll('{{DADO_ESPECIFICO_ROTULO}}', specificField.label)
    .replaceAll('{{DADO_ESPECIFICO}}', specificField.value || '')
    .replaceAll('{{DADO_ESPECIFICO_CHAVE}}', currentUser.tipo_usuario === 'Docente' ? 'CNDB' : currentUser.tipo_usuario === 'Servidor' ? 'cpf' : 'curso')
    .replaceAll('{{EDIT_PROFILE_NOME}}', escapeHtml(currentUser.nome_completo || ''))
    .replaceAll('{{EDIT_PROFILE_EMAIL}}', escapeHtml(currentUser.email_institucional || ''))
    .replaceAll('{{EDIT_PROFILE_MATRICULA}}', escapeHtml(currentUser.matricula || ''))
    .replaceAll('{{EDIT_PROFILE_DADO}}', escapeHtml(specificField.value || ''))
    .replaceAll('{{EDIT_PROFILE_TIPO}}', escapeHtml(currentUser.tipo_usuario || ''))
    .replaceAll('{{INICIAIS_USUARIO}}', initials);

  const supportNeeded = Number(selectedEvent?.suporte_terceiros) === 1;
  const pageWithEventDetails = route === 'visualizar-evento' && selectedEvent
    ? personalizedPage
      .replaceAll('{{EVENT_TITLE}}', escapeHtml(selectedEvent.titulo))
      .replaceAll('{{EVENT_STATUS_CLASS}}', selectedEvent.status === 'Pendente' ? 'pending' : selectedEvent.id_rejeitador ? 'cancelled' : selectedEvent.status === 'Cancelado' ? 'cancelled' : selectedEvent.status === 'Adiado' ? 'postponed' : '')
      .replaceAll('{{EVENT_STATUS}}', escapeHtml(selectedEvent.id_rejeitador ? 'Recusado' : selectedEvent.status))
      .replaceAll('{{EVENT_DESCRIPTION}}', escapeHtml(selectedEvent.descricao))
      .replaceAll('{{EVENT_ID}}', escapeHtml(selectedEvent.id_evento))
      .replaceAll('{{EVENT_DATE}}', escapeHtml(formatDate(selectedEvent.data_evento)))
      .replaceAll('{{EVENT_TIME}}', escapeHtml(selectedEvent.horario))
      .replaceAll('{{EVENT_LOCATION}}', escapeHtml(selectedEvent.local))
      .replaceAll('{{EVENT_SPOTS}}', escapeHtml(selectedEvent.vagas_disponiveis))
      .replaceAll('{{EVENT_SUPPORT}}', supportNeeded ? 'Sim' : 'Não')
      .replaceAll('{{EVENT_SUPPORT_DETAILS}}', escapeHtml(selectedEvent.suporte_detalhes || 'Não informado'))
      .replaceAll('{{EVENT_ORGANIZER}}', escapeHtml(selectedEvent.nome_organizador || 'Não informado'))
      .replaceAll('{{EVENT_CREATED_AT}}', escapeHtml(formatDate(selectedEvent.data_criacao)))
      .replaceAll('{{EVENT_STATUS_REASON}}', escapeHtml(selectedEvent.justificativa_status || 'Não informada'))
      .replaceAll('{{EVENT_MODERATION_LABEL}}', selectedEvent.id_rejeitador ? 'Recusado por' : 'Confirmado por')
      .replaceAll('{{EVENT_MODERATION_PERSON}}', escapeHtml(selectedEvent.id_rejeitador ? (selectedEvent.nome_rejeitador || 'Não informado') : (selectedEvent.nome_confirmador || 'Ainda não confirmado')))
      .replaceAll('{{EVENT_ACTIONS}}', renderEventActions(selectedEvent, user))
      .replaceAll('{{EVENT_MODERATION_ACTION}}', renderEventModeration(selectedEvent, user))
    : personalizedPage;

  const pageWithEvents = route === 'inicio'
    ? pageWithEventDetails.replace(
      /<section class="event-list">[\s\S]*?<\/section>/,
      `<section class="event-list">${renderEvents(events)}</section>`
    )
    : pageWithEventDetails;
  const pageWithHistory = route === 'perfil'
    ? pageWithEvents.replace('<div class="timeline">', `<div class="timeline">${renderRecentHistory(events, user)}`)
    : pageWithEvents;
  const pageWithNotifications = route === 'notificacoes'
    ? pageWithHistory
      .replace('<div class="notification-list"></div>', `<div class="notification-list">${renderNotifications(notifications || [])}</div>`)
      .replace('{{NOTIFICATION_COUNT}}', String((notifications || []).filter((notification) => !Number(notification.lida)).length))
    : pageWithHistory;

  return pageWithNotifications.replace('</head>', `<style>${css}</style>${bridge}</head>`);
}

export default function HtmlRoute({ route, user, events, notifications, selectedEvent, onMessage }) {
  const [html, setHtml] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    setHtml('');
    setLoadError('');

    async function loadPage() {
      try {
        const [pageAsset, stylesheetAsset] = await Promise.all([
          Asset.loadAsync(pages[route]),
          Asset.loadAsync(stylesheet),
        ]);
        const [pageContent, css] = await Promise.all([
          readAssetText(pageAsset[0]),
          readAssetText(stylesheetAsset[0]),
        ]);

        if (active) setHtml(addBridge(pageContent, css, route, user, events || [], notifications || [], selectedEvent));
      } catch (error) {
        if (active) setLoadError(error?.message || 'Não foi possível carregar esta tela.');
      }
    }

    loadPage();
    return () => {
      active = false;
    };
  }, [route, user, events, notifications, selectedEvent]);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;

    const handleWebMessage = (event) => {
      if (event.source === window) return;
      onMessage(event.data);
    };

    window.addEventListener('message', handleWebMessage);
    return () => window.removeEventListener('message', handleWebMessage);
  }, [onMessage]);

  if (!html) {
    return (
      <View style={styles.loading}>
        {loadError ? <Text style={styles.error}>{loadError}</Text> : <ActivityIndicator />}
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return React.createElement('iframe', {
      title: 'AVISA',
      srcDoc: html,
      style: styles.webFrame,
    });
  }

  return <WebView originWhitelist={['*']} source={{ html }} onMessage={(event) => onMessage(event.nativeEvent.data)} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  error: {
    color: '#b42318',
    textAlign: 'center',
  },
  webFrame: {
    width: '100%',
    height: '100%',
    border: 0,
  },
});