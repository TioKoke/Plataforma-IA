import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import type { AppRole } from '../context/AuthContext';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Si se especifica, el usuario debe tener al menos uno de estos roles */
  allowedRoles?: AppRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, roles, login } = useAuth();

  // isLoading ya encapsula inProgress !== InteractionStatus.None (derivado en AuthContext),
  // por lo que no es necesario importar useMsal aquí — evita una suscripción redundante.
  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      login();
    }
  }, [isAuthenticated, isLoading, login]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 text-sm">Redirigiendo al login corporativo...</div>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.some(r => roles.some(userRole => userRole.toLowerCase() === r.toLowerCase()))) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-plataforma-gris-oscuro mb-2">Acceso restringido</p>
          <p className="text-sm text-gray-500">No tienes permisos para ver esta página.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
