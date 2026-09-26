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

  return events.map((event) => {
    const [year, month, day] = event.data_evento.split('-');
    const monthName = months[Number(month) - 1] || month;
    const statusClass = event.status === 'Pendente' ? 'badge pending' : 'badge';

    return `<article class="event-card">
      <div class="date-chip"><strong>${escapeHtml(day)}</strong><span>${escapeHtml(monthName)}</span></div>
      <div>
        <div class="event-top"><h2>${escapeHtml(event.titulo)}</h2><span class="${statusClass}">${escapeHtml(event.status)}</span></div>
        <div class="meta">
          <span>${escapeHtml(`${day} ${monthName} ${year} • ${event.horario}`)}</span>
          <span>${escapeHtml(event.local)}</span>
          <span>${escapeHtml(event.vagas_disponiveis)} vagas</span>
        </div>
      </div>
    </article>`;
  }).join('');
}

function renderRecentHistory(events, user) {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const userEvents = events
    .filter((event) => Number(event.id_organizador_principal) === Number(user?.id_usuario))
    .sort((first, second) => String(second.data_criacao || '').localeCompare(String(first.data_criacao || '')))
    .slice(0, 10);

  if (!userEvents.length) {
    return '<p>Você ainda não criou eventos.</p>';
  }

  return userEvents.map((event) => {
    const createdDate = String(event.data_criacao || event.data_evento).split(/[T ]/)[0];
    const [year, month, day] = createdDate.split('-');
    const dateLabel = `${day} ${months[Number(month) - 1] || ''}`.trim();

    return `<div class="timeline-item">
      <span class="dot"></span>
      <div><strong>${escapeHtml(event.titulo)}</strong><p>Você criou este evento. Status: ${escapeHtml(event.status)}.</p></div>
      <time>${escapeHtml(dateLabel)}</time>
    </div>`;
  }).join('');
}

function addBridge(html, css, route, user, events) {
  const profileData = JSON.stringify({
    id_usuario: user?.id_usuario || null,
    interesses: user?.interesses || [],
  });
  const bridge = `
    <script>
      window.__AVISA_PROFILE__ = ${profileData};

      document.addEventListener('click', function (event) {
        const link = event.target.closest('a');
        if (!link || !link.getAttribute('href')) return;
        const href = link.getAttribute('href');
        if (href === 'index.html' || href === 'cadastro.html' || href === 'inicio.html' || href === 'calendario.html' || href === 'notificacoes.html' || href === 'criar-evento.html' || href === 'perfil.html') {
          event.preventDefault();
          const message = JSON.stringify({ type: 'route', route: href });
          if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
          else window.parent.postMessage(message, '*');
        }
      });

      document.addEventListener('submit', function (event) {
        event.preventDefault();
        const form = new FormData(event.target);
        const data = Object.fromEntries(form.entries());
        const message = JSON.stringify({
          type: '${route}' === 'cadastro' ? 'register' : '${route}' === 'criar-evento' ? 'createEvent' : 'login',
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
    .replaceAll('{{INICIAIS_USUARIO}}', initials);

  const pageWithEvents = route === 'inicio'
    ? personalizedPage.replace('<section class="event-list">', `<section class="event-list">${renderEvents(events)}`)
    : personalizedPage;
  const pageWithHistory = route === 'perfil'
    ? pageWithEvents.replace('<div class="timeline">', `<div class="timeline">${renderRecentHistory(events, user)}`)
    : pageWithEvents;

  return pageWithHistory.replace('</head>', `<style>${css}</style>${bridge}</head>`);
}

export default function HtmlRoute({ route, user, events, onMessage }) {
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

        if (active) setHtml(addBridge(pageContent, css, route, user, events || []));
      } catch (error) {
        if (active) setLoadError(error?.message || 'Não foi possível carregar esta tela.');
      }
    }

    loadPage();
    return () => {
      active = false;
    };
  }, [route, user, events]);

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