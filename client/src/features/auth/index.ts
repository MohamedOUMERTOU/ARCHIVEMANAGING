// API publique de la fonctionnalité « auth » : les autres modules n'importent que d'ici
// (seul le routeur charge directement la page de connexion, pour le découpage du code)
export { authApi } from './api/auth.api';
export { useLogin, useLogout, useSessionBootstrap } from './hooks/useAuth';
