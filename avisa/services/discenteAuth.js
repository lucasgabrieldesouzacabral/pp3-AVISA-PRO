import {
  initDatabase,
  registerUser,
  registerDiscente,
  registerDocente,
  registerServidor,
  loginDiscente,
  loginUser,
  getUserInterests,
  updateUserInterests,
  getDiscenteById,
  getUserById,
} from '../database';

export const authRoutes = {
  init: () => initDatabase(),
  registerUser: (payload) => registerUser(payload),
  register: (payload) => registerDiscente(payload),
  registerDiscente: (payload) => registerDiscente(payload),
  registerDocente: (payload) => registerDocente(payload),
  registerServidor: (payload) => registerServidor(payload),
  login: (email_institucional, senha) => loginDiscente(email_institucional, senha),
  loginUser: (email_institucional, senha) => loginUser(email_institucional, senha),
  getById: (id_usuario) => getDiscenteById(id_usuario),
  getUserById: (id_usuario) => getUserById(id_usuario),
  getUserInterests: (id_usuario) => getUserInterests(id_usuario),
  updateUserInterests: (id_usuario, interests) => updateUserInterests(id_usuario, interests),
};

export const discenteAuthRoutes = authRoutes;
export default authRoutes;
