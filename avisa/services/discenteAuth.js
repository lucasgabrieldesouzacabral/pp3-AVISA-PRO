import {
  initDatabase,
  registerUser,
  registerDiscente,
  loginDiscente,
  getDiscenteById,
} from '../database';

export const discenteAuthRoutes = {
  init: () => initDatabase(),
  registerUser: (payload) => registerUser(payload),
  register: (payload) => registerDiscente(payload),
  login: (email_institucional, senha) => loginDiscente(email_institucional, senha),
  getById: (id_usuario) => getDiscenteById(id_usuario),
};

export default discenteAuthRoutes;
