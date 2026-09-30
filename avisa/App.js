import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import discenteAuthRoutes from './services/discenteAuth';
import HtmlRoute from './screens/HtmlRoutes..js';

export default function App() {
  const [route, setRoute] = useState('login');
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    discenteAuthRoutes.init();
    setEvents(discenteAuthRoutes.getEvents());
  }, []);

  const handleMessage = (message) => {
    try {
      const data = typeof message === 'string' ? JSON.parse(message) : message;

      if (data.type === 'route') {
        const routes = {
          'cadastro.html': 'cadastro',
          'inicio.html': 'inicio',
          'calendario.html': 'calendario',
          'notificacoes.html': 'notificacoes',
          'criar-evento.html': 'criar-evento',
          'perfil.html': 'perfil',
          'editar-perfil.html': 'editar-perfil',
        };
        const nextRoute = routes[data.route] || 'login';
        if (nextRoute === 'login') setUser(null);
        if (nextRoute === 'notificacoes' && user?.id_usuario) {
          setNotifications(discenteAuthRoutes.getNotifications(user.id_usuario));
        }
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
        setNotifications(discenteAuthRoutes.getNotifications(usuario.id_usuario));
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
        const createdEvent = discenteAuthRoutes.createEvent({ ...data, organizerId: user.id_usuario });
        setEvents(discenteAuthRoutes.getEvents());
        setNotifications(discenteAuthRoutes.getNotifications(user.id_usuario));
        setRoute('inicio');
        Alert.alert(
          'Evento publicado',
          createdEvent.status === 'Confirmado'
            ? 'O evento foi salvo e confirmado automaticamente.'
            : 'O evento foi salvo e está aguardando confirmação.'
        );
        return;
      }

      if (data.type === 'eventAction') {
        if (!user?.id_usuario) throw new Error('Entre na sua conta para alterar um evento.');
        const updatedEvent = discenteAuthRoutes.updateEventStatus(
          data.id_evento,
          user.id_usuario,
          data.action,
          data
        );
        const refreshedEvents = discenteAuthRoutes.getEvents();
        const refreshedEvent = refreshedEvents.find((event) => Number(event.id_evento) === Number(data.id_evento));
        setEvents(refreshedEvents);
        setNotifications(discenteAuthRoutes.getNotifications(user.id_usuario));
        setSelectedEvent(refreshedEvent || updatedEvent);
        Alert.alert(
          data.action === 'cancel' ? 'Evento cancelado' : 'Evento remarcado',
          data.action === 'cancel'
            ? 'O evento foi cancelado e uma notificação foi criada.'
            : 'A nova data foi salva e uma notificação foi criada.'
        );
        return;
      }

      if (data.type === 'confirmEvent') {
        if (!user?.id_usuario) throw new Error('Entre na sua conta para confirmar um evento.');
        const updatedEvent = discenteAuthRoutes.confirmEvent(data.id_evento, user.id_usuario);
        const refreshedEvents = discenteAuthRoutes.getEvents();
        const refreshedEvent = refreshedEvents.find((event) => Number(event.id_evento) === Number(data.id_evento));
        setEvents(refreshedEvents);
        setNotifications(discenteAuthRoutes.getNotifications(user.id_usuario));
        setSelectedEvent(refreshedEvent || updatedEvent);
        Alert.alert('Evento confirmado', 'O organizador foi notificado sobre a confirmação.');
        return;
      }

      if (data.type === 'rejectEvent') {
        if (!user?.id_usuario) throw new Error('Entre na sua conta para recusar um evento.');
        const updatedEvent = discenteAuthRoutes.rejectEvent(
          data.id_evento,
          user.id_usuario,
          data.justification
        );
        const refreshedEvents = discenteAuthRoutes.getEvents();
        const refreshedEvent = refreshedEvents.find((event) => Number(event.id_evento) === Number(data.id_evento));
        setEvents(refreshedEvents);
        setNotifications(discenteAuthRoutes.getNotifications(user.id_usuario));
        setSelectedEvent(refreshedEvent || updatedEvent);
        Alert.alert('Evento recusado', 'O organizador foi notificado e a justificativa foi registrada.');
        return;
      }

      if (data.type === 'markNotificationAsRead') {
        if (!user?.id_usuario) throw new Error('Usuário não autenticado.');
        discenteAuthRoutes.markNotificationAsRead(data.id_notificacao, user.id_usuario);
        setNotifications(discenteAuthRoutes.getNotifications(user.id_usuario));
        return;
      }

      if (data.type === 'markAllNotificationsAsRead') {
        if (!user?.id_usuario) throw new Error('Usuário não autenticado.');
        discenteAuthRoutes.markAllNotificationsAsRead(user.id_usuario);
        setNotifications(discenteAuthRoutes.getNotifications(user.id_usuario));
        return;
      }

      if (data.type === 'updateInterests') {
        if (!user?.id_usuario) throw new Error('Usuário não autenticado.');
        discenteAuthRoutes.updateUserInterests(user.id_usuario, data.interests);
      }

      if (data.type === 'updateProfile') {
        if (!user?.id_usuario) throw new Error('Usuário não autenticado.');
        const updatedUser = discenteAuthRoutes.updateUserProfile(user.id_usuario, data);
        setUser(updatedUser);
        setRoute('perfil');
        Alert.alert('Perfil atualizado', 'Suas informações foram salvas com sucesso.');
      }
    } catch (error) {
      Alert.alert('Não foi possível concluir', error.message);
    }
  };

  return (
    <View style={styles.container}>
      <HtmlRoute route={route} user={user} events={events} notifications={notifications} selectedEvent={selectedEvent} onMessage={handleMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
