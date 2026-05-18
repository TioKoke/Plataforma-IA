import {Linkedin, Twitter, Youtube, Facebook, Instagram} from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-plataforma-gris-oscuro text-white">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Logo */}
        <div className="mb-8">
          <img
            src="/logo-footer.svg"
            alt="Plataforma IA"
            className="h-12"
          />
        </div>

        {/* Contenido principal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-8">
          {/* Columna izquierda */}
          <div className="text-white/60 space-y-2">
            <p>Alameda Libertador Bernardo O'Higgins 1449</p>
            <p>Torre 2, piso 9, Santiago Downtown, Santiago, Chile</p>
            <p>Casilla Postal 150-D1</p>
            <p className="mt-4">+56 2 2690 3000</p>
          </div>

          {/* Columna derecha */}
          <div className="flex flex-col items-end space-y-4">
            {/* Links */}
            <div className="flex flex-wrap justify-end gap-4 text-white/60">
              <Link to="/recursos" className="hover:text-white transition-colors">
                Contacto
              </Link>
              <span className="text-white/20">|</span>
              <Link to="/terminos" className="hover:text-white transition-colors">
                Términos y condiciones
              </Link>
            </div>

            {/* Redes sociales */}
            <div className="flex space-x-4">
              <a href="https://web.facebook.com/Plataforma IA" className="text-white/60 hover:text-white transition-colors" title="Facebook">
                <Facebook size={20} />
              </a>
              <a href="https://x.com/tu-organizacion" className="text-white/60 hover:text-white transition-colors" title="Twitter">
                <Twitter size={20} />
              </a>
              <a href="https://www.instagram.com/plataforma-ia_chile/" className="text-white/60 hover:text-white transition-colors" title="Instagram">
                <Instagram size={20} />
              </a>
              <a href="https://www.youtube.com/user/tu-organizacion" className="text-white/60 hover:text-white transition-colors" title="YouTube">
                <Youtube size={20} />
              </a>
              <a href="https://www.linkedin.com/company/plataforma-ia/?viewAsMember=true" className="text-white/60 hover:text-white transition-colors" title="LinkedIn">
                <Linkedin size={20} />
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-white/20 pt-8 text-center">
          <p className="text-white/60 text-sm">
            © {new Date().getFullYear()} Plataforma IA - Corporación Nacional del Cobre de Chile. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
