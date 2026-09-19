import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { Asset } from 'expo-asset';
import { WebView } from 'react-native-webview';

const pages = {
  login: require('../Telas/index.html'),
  cadastro: require('../Telas/cadastro.html'),
  inicio: require('../Telas/inicio.html'),
  perfil: require('../Telas/perfil.html'),
};

const stylesheet = require('../Telas/css/styles.css');

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
        if (href === 'index.html' || href === 'cadastro.html' || href === 'inicio.html' || href === 'perfil.html') {
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

  useEffect(() => {
    let active = true;

    async function loadPage() {
      const [pageAsset, stylesheetAsset] = await Promise.all([
        Asset.loadAsync(pages[route]),
        Asset.loadAsync(stylesheet),
      ]);
      const [pageResponse, stylesheetResponse] = await Promise.all([
        fetch(pageAsset[0].localUri || pageAsset[0].uri),
        fetch(stylesheetAsset[0].localUri || stylesheetAsset[0].uri),
      ]);
      const pageContent = await pageResponse.text();
      const css = await stylesheetResponse.text();

      if (active) setHtml(addBridge(pageContent, css, route, user));
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
        <ActivityIndicator />
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
  },
  webFrame: {
    width: '100%',
    height: '100%',
    border: 0,
  },
});