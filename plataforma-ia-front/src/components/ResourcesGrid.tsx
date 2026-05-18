import React from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import SpotlightCard from './reactbits/SpotlightCard';

interface ResourceFeature {
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
  link: string;
  spotlight: string;
}

interface ResourcesGridProps {
  features: ResourceFeature[];
  getColorClasses: (color: string) => { bg: string; text: string; border: string; from: string; to: string; hex?: string };
}

const ResourcesGrid: React.FC<ResourcesGridProps> = ({ features, getColorClasses }) => {
  // Función para obtener el color base en formato RGBA para los efectos
  const getBaseColor = (colorName: string) => {
    const baseColors: Record<string, string> = {
      naranja: '229, 83, 2', // #E55302
      turquesa: '0, 152, 170', // #0098AA
      azul: '0, 114, 177', // #0072B1
      rojo: '193, 56, 50', // #C13832
      'verde-oscuro': '16, 100, 112', // #106470
      'rojo-oscuro': '122, 37, 49', // #7A2531
      amarillo: '244, 170, 0', // #F4AA00
      beige: '196, 193, 160' // #C4C1A0
    };
    return baseColors[colorName] || baseColors.naranja;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {features.map((feature, index) => {
        const Icon = feature.icon;
        const colors = getColorClasses(feature.color);
        const badgeText = feature.title.split(' ')[0];
        const rgbColor = getBaseColor(feature.color);

        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            viewport={{ once: true }}
            className="h-full"
          >
            <SpotlightCard
              spotlightColor={feature.spotlight}
              className="h-full group bg-white border border-gray-100 rounded-[2.5rem] relative overflow-hidden shadow-xl shadow-gray-200/40 hover:shadow-2xl hover:shadow-orange-500/10 hover:border-plataforma-naranja/20 transition-all duration-500 hover:-translate-y-2"
            >
              {/* Fondo con degradado de blanco al color de fondo suave */}
              <div
                className="absolute inset-0 z-0 opacity-40 transition-opacity duration-500 group-hover:opacity-60"
                style={{
                  background: `linear-gradient(135deg, #ffffff 0%, rgba(${rgbColor}, 0.2) 100%)`
                }}
              />

              {/* Efectos de "Burbujas" / Resplandores flotantes inspirados en gradient-orange */}
              <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden mix-blend-multiply">
                <div
                  className="absolute -top-10 -right-10 w-48 h-48 rounded-full blur-[60px] opacity-20 transition-all duration-700 group-hover:opacity-30 group-hover:scale-125"
                  style={{ backgroundColor: `rgb(${rgbColor})` }}
                />
                <div
                  className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full blur-[50px] opacity-15 transition-all duration-700 group-hover:opacity-25 group-hover:scale-110"
                  style={{ backgroundColor: `rgb(${rgbColor})` }}
                />
              </div>

              <div className="p-8 h-full flex flex-col items-start relative z-10">
                {/* Línea de acento superior */}
                <div className={`absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r ${colors.from} ${colors.to} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>

                {/* Badge */}
                <div className="absolute top-6 right-6 bg-white/70 border border-gray-100 rounded-full px-4 py-1.5 flex items-center text-xs font-semibold text-gray-600 backdrop-blur-sm z-20 shadow-sm">
                  <span className={`w-2 h-2 rounded-full ${colors.bg} mr-2 animate-pulse`}></span>
                  {badgeText}
                </div>

                <div className={`w-20 h-20 mb-8 rounded-2xl bg-gradient-to-br ${colors.from} ${colors.to} flex items-center justify-center p-2 shadow-lg shadow-orange-500/20 relative overflow-hidden group-hover:scale-110 transition-transform duration-500`}>
                  <Icon
                    className="w-10 h-10 text-white drop-shadow-md relative z-10 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500"
                    strokeWidth={1.5}
                  />
                  <div className="absolute inset-0 bg-white/10 group-hover:bg-transparent transition-colors duration-500"></div>
                </div>

                <h3 className="font-montserrat font-extrabold text-2xl mb-4 text-plataforma-gris-oscuro group-hover:text-plataforma-naranja transition-colors duration-300">
                  {feature.title}
                </h3>
                <p className="text-left text-gray-600 font-roboto text-base leading-relaxed line-clamp-3 mb-8">
                  {feature.description}
                </p>

                <div className="mt-auto w-full flex justify-end">
                  <Link
                    to={feature.link}
                    className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-white group-hover:bg-plataforma-naranja group-hover:border-plataforma-naranja shadow-sm group-hover:shadow-orange-500/30 transition-all duration-300 group-hover:translate-x-1"
                  >
                    <Icon className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </SpotlightCard>
          </motion.div>
        );
      })}
    </div>
  );
};

export default ResourcesGrid;