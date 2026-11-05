import React, { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import discenteAuthRoutes from './services/discenteAuth';
import HtmlRoute from './screens/HtmlRoutes..js';

export default function App() {
  const [route, setRoute] = useState('login');
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    const onLoad = async () => {
      await discenteAuthRoutes.init();
      setEvents(await discenteAuthRoutes.getEvents());
    };

    onLoad();
  }, []);

  const handleMessage = async (message) => {
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
          setNotifications(await discenteAuthRoutes.getNotifications(user.id_usuario));
        }
        setRoute(nextRoute);
        return;
      }

      if (data.type === 'viewEvent') {
        const selected = await discenteAuthRoutes.getEventById(data.id_evento);
        if (!selected) throw new Error('Não foi possível localizar este evento salvo.');
        const registrations = await discenteAuthRoutes.getEventSubscribers(data.id_evento);
        setSelectedEvent({
          ...selected,
          inscricoes: registrations,
          ja_inscrito: !!user?.id_usuario && registrations.some((subscription) => Number(subscription.id_usuario) === Number(user.id_usuario)),
        });
        setRoute('visualizar-evento');
        return;
      }

      if (data.type === 'login') {
        try {
          const usuario = await discenteAuthRoutes.loginUser(data.email, data.password);
          setUser(usuario);
          setNotifications(await discenteAuthRoutes.getNotifications(usuario.id_usuario));
          setRoute('inicio');
          Alert.alert('Login realizado', `Bem-vindo(a), ${usuario.nome_completo}.`);
        } catch (error) {
          if (Platform.OS === 'web') {
            window.alert(`Erro ao entrar\n\n${error.message}`);
          } else {
            Alert.alert('Erro ao entrar', error.message);
          }
        }
        return;
      }

      if (data.type === 'register') {
        const usuario = await discenteAuthRoutes.registerUser({
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
        const createdEvent = await discenteAuthRoutes.createEvent({ ...data, organizerId: user.id_usuario });
        setEvents(await discenteAuthRoutes.getEvents());
        setNotifications(await discenteAuthRoutes.getNotifications(user.id_usuario));
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
        const updatedEvent = await discenteAuthRoutes.updateEventStatus(
          data.id_evento,
          user.id_usuario,
          data.action,
          data
        );
        const refreshedEvents = await discenteAuthRoutes.getEvents();
        const refreshedEvent = refreshedEvents.find((event) => Number(event.id_evento) === Number(data.id_evento));
        setEvents(refreshedEvents);
        setNotifications(await discenteAuthRoutes.getNotifications(user.id_usuario));
        setSelectedEvent(refreshedEvent || updatedEvent);
        Alert.alert(
          data.action === 'cancel' ? 'Evento cancelado' : 'Evento remarcado',
          data.action === 'cancel'
            ? 'O evento foi cancelado e uma notificação foi criada.'
            : 'A nova data foi salva e uma notificação foi criada.'
        );
        return;
      }

      if (data.type === 'subscribeEvent') {
        if (!user?.id_usuario) throw new Error('Entre na sua conta para se inscrever.');
        const updatedEvent = await discenteAuthRoutes.subscribeToEvent({
          id_evento: data.id_evento,
          id_usuario: user.id_usuario,
          tipo_inscricao: data.tipo_inscricao || 'Participante',
          justificativa_contribuicao: data.justificativa_contribuicao || '',
        });
        const refreshedEvents = await discenteAuthRoutes.getEvents();
        setEvents(refreshedEvents);
        setNotifications(await discenteAuthRoutes.getNotifications(user.id_usuario));
        setSelectedEvent({
          ...updatedEvent,
          inscricoes: await discenteAuthRoutes.getEventSubscribers(data.id_evento),
          ja_inscrito: true,
        });
        setRoute('visualizar-evento');
        Alert.alert('Inscrição confirmada', 'Sua inscrição foi registrada com sucesso.');
        return;
      }

      if (data.type === 'confirmEvent') {
        if (!user?.id_usuario) throw new Error('Entre na sua conta para confirmar um evento.');
        const updatedEvent = await discenteAuthRoutes.confirmEvent(data.id_evento, user.id_usuario);
        const refreshedEvents = await discenteAuthRoutes.getEvents();
        const refreshedEvent = refreshedEvents.find((event) => Number(event.id_evento) === Number(data.id_evento));
        setEvents(refreshedEvents);
        setNotifications(await discenteAuthRoutes.getNotifications(user.id_usuario));
        setSelectedEvent(refreshedEvent || updatedEvent);
        Alert.alert('Evento confirmado', 'O organizador foi notificado sobre a confirmação.');
        return;
      }

      if (data.type === 'rejectEvent') {
        if (!user?.id_usuario) throw new Error('Entre na sua conta para recusar um evento.');
        const updatedEvent = await discenteAuthRoutes.rejectEvent(
          data.id_evento,
          user.id_usuario,
          data.justification
        );
        const refreshedEvents = await discenteAuthRoutes.getEvents();
        const refreshedEvent = refreshedEvents.find((event) => Number(event.id_evento) === Number(data.id_evento));
        setEvents(refreshedEvents);
        setNotifications(await discenteAuthRoutes.getNotifications(user.id_usuario));
        setSelectedEvent(refreshedEvent || updatedEvent);
        Alert.alert('Evento recusado', 'O organizador foi notificado e a justificativa foi registrada.');
        return;
      }

      if (data.type === 'markNotificationAsRead') {
        if (!user?.id_usuario) throw new Error('Usuário não autenticado.');
        await discenteAuthRoutes.markNotificationAsRead(data.id_notificacao, user.id_usuario);
        setNotifications(await discenteAuthRoutes.getNotifications(user.id_usuario));
        return;
      }

      if (data.type === 'markAllNotificationsAsRead') {
        if (!user?.id_usuario) throw new Error('Usuário não autenticado.');
        await discenteAuthRoutes.markAllNotificationsAsRead(user.id_usuario);
        setNotifications(await discenteAuthRoutes.getNotifications(user.id_usuario));
        return;
      }

      if (data.type === 'updateInterests') {
        if (!user?.id_usuario) throw new Error('Usuário não autenticado.');
        await discenteAuthRoutes.updateUserInterests(user.id_usuario, data.interests);
      }

      if (data.type === 'updateProfile') {
        if (!user?.id_usuario) throw new Error('Usuário não autenticado.');
        const updatedUser = await discenteAuthRoutes.updateUserProfile(user.id_usuario, data);
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
