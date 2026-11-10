import * as localDatabase from './databaseLocal.js';
import * as supabaseDatabase from './supabaseDatabase.js';

const useSupabase = Boolean(
  (process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
);

const databaseModule = useSupabase ? supabaseDatabase : localDatabase;

export const initDatabase = databaseModule.initDatabase;
export const getNotifications = databaseModule.getNotifications;
export const markNotificationAsRead = databaseModule.markNotificationAsRead;
export const markAllNotificationsAsRead = databaseModule.markAllNotificationsAsRead;
export const createEvent = databaseModule.createEvent;
export const getEvents = databaseModule.getEvents;
export const getEventSubscribers = databaseModule.getEventSubscribers;
export const getEventById = databaseModule.getEventById;
export const subscribeToEvent = databaseModule.subscribeToEvent;
export const rejectEvent = databaseModule.rejectEvent;
export const confirmEvent = databaseModule.confirmEvent;
export const updateEventStatus = databaseModule.updateEventStatus;
export const normalizeRegistrationPayload = databaseModule.normalizeRegistrationPayload;
export const validateRegistrationPayload = databaseModule.validateRegistrationPayload;
export const registerUser = databaseModule.registerUser;
export const registerDiscente = databaseModule.registerDiscente;
export const registerDocente = databaseModule.registerDocente;
export const registerServidor = databaseModule.registerServidor;
export const loginDiscente = databaseModule.loginDiscente;
export const loginUser = databaseModule.loginUser;
export const getUserInterests = databaseModule.getUserInterests;
export const updateUserInterests = databaseModule.updateUserInterests;
export const getDiscenteById = databaseModule.getDiscenteById;
export const getUserById = databaseModule.getUserById;
export const updateUserProfile = databaseModule.updateUserProfile;
export const getUsers = databaseModule.getUsers;
export const updatePushToken = databaseModule.updatePushToken;
export const sendEventPushNotifications = databaseModule.sendEventPushNotifications;

export default databaseModule;
