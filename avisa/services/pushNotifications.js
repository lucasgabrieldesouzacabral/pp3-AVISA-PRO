import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export function getPushNotificationUnavailableReason() {
  if (Platform.OS === 'android' && Constants.appOwnership === 'expo') {
    return 'O Expo Go no Android não suporta notificações push remotas. Instale e abra uma development build do AVISA para ativá-las.';
  }

  return null;
}

export async function requestLocalNotificationPermissionAsync() {
  if (Platform.OS === 'web') return false;

  const { status: currentStatus } = await Notifications.getPermissionsAsync();
  const { status } = currentStatus === 'granted'
    ? { status: currentStatus }
    : await Notifications.requestPermissionsAsync();

  return status === 'granted';
}

export async function showLocalNotificationAsync(notification) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'AVISA',
      body: notification.mensagem,
      data: { id_notificacao: notification.id_notificacao },
    },
    trigger: null,
  });
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  if (getPushNotificationUnavailableReason()) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notificações',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: currentStatus } = await Notifications.getPermissionsAsync();
  const { status } = currentStatus === 'granted'
    ? { status: currentStatus }
    : await Notifications.requestPermissionsAsync();

  if (status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
    || Constants.easConfig?.projectId
    || Constants.expoConfig?.extra?.EXPO_PUBLIC_EAS_PROJECT_ID;

  if (!projectId) {
    throw new Error('Configure EXPO_PUBLIC_EAS_PROJECT_ID para obter o token push deste aplicativo.');
  }

  const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenResult.data;
}

export async function sendExpoPushNotifications(messages) {
  let sentCount = 0;

  for (let offset = 0; offset < messages.length; offset += 100) {
    const batch = messages.slice(offset, offset + 100);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      throw new Error(`O serviço Expo Push respondeu com erro HTTP ${response.status}.`);
    }

    const result = await response.json();
    if (!result || typeof result !== 'object') {
      throw new Error('O serviço Expo Push retornou uma resposta inválida.');
    }
    const tickets = Array.isArray(result.data) ? result.data : [];
    if (result.errors?.length) {
      throw new Error(result.errors[0].message || 'O serviço Expo Push recusou o lote de notificações.');
    }
    const failedTicket = tickets.find((ticket) => ticket.status === 'error');

    if (failedTicket) {
      throw new Error(failedTicket.message || 'O serviço Expo Push não aceitou uma das notificações.');
    }
    if (tickets.length !== batch.length) {
      throw new Error('O serviço Expo Push retornou uma quantidade inesperada de confirmações.');
    }

    sentCount += tickets.filter((ticket) => ticket.status === 'ok').length;
  }

  return sentCount;
}

export async function sendEventPushNotifications(tokens, event) {
  const body = `Novo evento: ${event.titulo} — ${event.data_evento} às ${event.horario}.`;
  const messages = [...new Set(tokens)]
    .filter((token) => typeof token === 'string' && /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(token))
    .map((to) => ({
      to,
      sound: 'default',
      title: 'Novo evento no AVISA',
      body,
      data: { id_evento: event.id_evento },
      channelId: 'default',
    }));

  return sendExpoPushNotifications(messages);
}
