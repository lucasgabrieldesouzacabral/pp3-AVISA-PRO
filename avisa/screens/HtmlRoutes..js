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

function addBridge(html, css, route, user) {
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
        if (href === 'index.html' || href === 'cadastro.html' || href === 'inicio.html' || href === 'calendario.html' || href === 'notificacoes.html' || href === 'perfil.html') {
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
          type: '${route}' === 'cadastro' ? 'register' : 'login',
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

  return personalizedPage.replace('</head>', `<style>${css}</style>${bridge}</head>`);
}

export default function HtmlRoute({ route, user, onMessage }) {
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

        if (active) setHtml(addBridge(pageContent, css, route, user));
      } catch (error) {
        if (active) setLoadError(error?.message || 'Não foi possível carregar esta tela.');
      }
    }

    loadPage();
    return () => {
      active = false;
    };
  }, [route, user]);

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