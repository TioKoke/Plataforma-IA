import { LogIn, AlertCircle } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, isLoading, isAuthenticated } = useAuth();
  const isUnauthorized = new URLSearchParams(window.location.search).get('error') === 'cuenta_no_autorizada';

  if (isAuthenticated && !isLoading) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-plataforma-naranja rounded-lg mb-4">
              <LogIn className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-plataforma-gris-oscuro mb-2">Bienvenido</h1>
            <p className="text-gray-600 text-sm">Usa tu cuenta corporativa de Plataforma IA para ingresar</p>
          </div>

          {isUnauthorized && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Esta cuenta no está autorizada para acceder a la plataforma.
                Usa tu cuenta corporativa Plataforma IA (<span className="font-medium">@plataforma-ia.example</span>,{' '}
                <span className="font-medium">@contratistas.plataforma-ia.example</span> o{' '}
                <span className="font-medium">@plataforma-ia.example</span>).
              </p>
            </div>
          )}

          <button
            onClick={login}
            disabled={isLoading}
            className="w-full bg-plataforma-naranja text-white py-3 rounded-lg font-medium hover:bg-plataforma-naranja/90 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Redirigiendo...' : 'Iniciar sesión con Microsoft'}
          </button>
        </div>

        <div className="mt-4 text-center text-sm text-gray-500">
          <p>Acceso exclusivo para personal autorizado de Plataforma IA</p>
        </div>
      </div>
    </div>
  );
}
