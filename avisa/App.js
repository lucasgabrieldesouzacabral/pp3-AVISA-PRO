import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import discenteAuthRoutes from './services/discenteAuth';
import HtmlRoute from './screens/HtmlRoutes..js';

export default function App() {
  const [route, setRoute] = useState('login');
  const [user, setUser] = useState(null);

  useEffect(() => {
    discenteAuthRoutes.init();
  }, []);

  const handleMessage = (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'route') {
        const nextRoute =
          data.route === 'cadastro.html'
            ? 'cadastro'
            : data.route === 'inicio.html'
              ? 'inicio'
              : data.route === 'perfil.html'
                ? 'perfil'
                : 'login';
        if (nextRoute === 'login') setUser(null);
        setRoute(nextRoute);
        return;
      }

      if (data.type === 'login') {
        const usuario = discenteAuthRoutes.loginUser(data.email, data.password);
        setUser(usuario);
        setRoute('inicio');
        Alert.alert('Login realizado', `Bem-vindo(a), ${usuario.nome_completo}.`);
        return;
      }

      if (data.type === 'register') {
        const usuario = discenteAuthRoutes.registerUser({
          nome_completo: data.name,
          email_institucional: data.email,
          matricula: data.matricula,
          senha: data.password,
          tipo_usuario: data.role,
          curso: data.curso,
          CNDB: data.CNDB,
          cpf: data.cpf,
        });

        setRoute('login');
        Alert.alert('Cadastro realizado', `${usuario.tipo_usuario} cadastrado: ${usuario.nome_completo}`);
        return;
      }

      if (data.type === 'updateInterests') {
        if (!user?.id_usuario) throw new Error('Usuário não autenticado.');
        const interesses = discenteAuthRoutes.updateUserInterests(user.id_usuario, data.interests);
        setUser((currentUser) => ({ ...currentUser, interesses }));
      }
    } catch (error) {
      Alert.alert('Não foi possível concluir', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <HtmlRoute route={route} user={user} onMessage={handleMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
