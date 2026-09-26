import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import discenteAuthRoutes from './services/discenteAuth';
import HtmlRoute from './screens/HtmlRoutes..js';

export default function App() {
  const [route, setRoute] = useState('login');
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    discenteAuthRoutes.init();
    setEvents(discenteAuthRoutes.getEvents());
  }, []);

  const handleMessage = (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'route') {
        const routes = {
          'cadastro.html': 'cadastro',
          'inicio.html': 'inicio',
          'calendario.html': 'calendario',
          'notificacoes.html': 'notificacoes',
          'criar-evento.html': 'criar-evento',
          'perfil.html': 'perfil',
        };
        const nextRoute = routes[data.route] || 'login';
        if (nextRoute === 'login') setUser(null);
        setRoute(nextRoute);
        return;
      }

      if (data.type === 'viewEvent') {
        const selected = events.find((event) => Number(event.id_evento) === Number(data.id_evento));
        if (!selected) throw new Error('Não foi possível localizar este evento salvo.');
        setSelectedEvent(selected);
        setRoute('visualizar-evento');
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

      if (data.type === 'createEvent') {
        if (!user?.id_usuario) throw new Error('Entre na sua conta para publicar um evento.');
        discenteAuthRoutes.createEvent({ ...data, organizerId: user.id_usuario });
        setEvents(discenteAuthRoutes.getEvents());
        setRoute('inicio');
        Alert.alert('Evento publicado', 'O evento foi salvo e está aguardando confirmação.');
        return;
      }

      if (data.type === 'updateInterests') {
        if (!user?.id_usuario) throw new Error('Usuário não autenticado.');
        discenteAuthRoutes.updateUserInterests(user.id_usuario, data.interests);
      }
    } catch (error) {
      Alert.alert('Não foi possível concluir', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <HtmlRoute route={route} user={user} events={events} selectedEvent={selectedEvent} onMessage={handleMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
