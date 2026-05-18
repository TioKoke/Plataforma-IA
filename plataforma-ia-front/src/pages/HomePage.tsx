import { Link } from 'react-router-dom';
import { Users, Bot, TrendingUp, Video, BookOpen, MessageSquare, Sparkles, Shield } from 'lucide-react';
import TextType from '../components/reactbits/TextType';
import SpotlightCard from '../components/reactbits/SpotlightCard';
import CountUp from '../components/reactbits/CountUp';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ResourcesGrid from '../components/ResourcesGrid';
import { useStats } from '../hooks/useStats';
import { useLiveMetrics } from '../hooks/useLiveMetrics';
import { useAuth } from '../context/AuthContext';

const HomePage = () => {
  const { userEmail } = useAuth();
  const { stats: apiStats } = useStats(30);
  const { metrics: liveMetrics, isLive } = useLiveMetrics(30_000, userEmail);

  const stats = [
    {
      icon: Users,
      value: liveMetrics?.logged_in_users ?? 0,
      label: 'Usuarios Activos',
      sublabel: isLive ? 'Conectados ahora' : 'Últimos 30 días',
      color: 'naranja',
      gradient: 'from-plataforma-naranja to-orange-500',
      spotlight: 'rgba(229, 83, 2, 0.15)',
      showLive: isLive,
    },
    {
      icon: Bot,
      value: liveMetrics?.total_agents ?? apiStats?.kpis.total_agents ?? 0,
      label: 'Agentes Disponibles',
      sublabel: 'En todas las áreas',
      color: 'turquesa',
      gradient: 'from-plataforma-turquesa to-teal-500',
      spotlight: 'rgba(0, 152, 170, 0.15)',
      showLive: isLive,
    },
    {
      icon: MessageSquare,
      value: apiStats?.kpis.total_conversations_all ?? 0,
      label: 'Interacciones Totales',
      sublabel: 'Desde el lanzamiento',
      color: 'azul',
      gradient: 'from-plataforma-azul to-blue-600',
      spotlight: 'rgba(0, 114, 177, 0.15)',
      showLive: false,
    }
  ];

  const features = [
    {
      icon: Video,
      title: 'Videos Educativos',
      description: 'Aprende sobre IA en minería con contenido audiovisual de alta calidad diseñado para todos los niveles',
      color: 'naranja',
      link: '/aprende',
      spotlight: 'rgba(229, 83, 2, 0.15)'
    },
    {
      icon: Bot,
      title: 'Catálogo de Agentes',
      description: `Explora y prueba nuestros ${apiStats?.kpis.total_agents ?? ''} agentes especializados en procesos de Plataforma IA`,
      color: 'turquesa',
      link: '/agentes',
      spotlight: 'rgba(0, 152, 170, 0.15)'
    },
    {
      icon: MessageSquare,
      title: 'Chat con IA',
      description: 'Consulta en tiempo real sobre aplicaciones de IA en Plataforma IA con respuestas contextuales',
      color: 'azul',
      link: '/chat',
      spotlight: 'rgba(0, 114, 177, 0.15)'
    },
    {
      icon: TrendingUp,
      title: 'Dashboard de Métricas',
      description: 'Visualiza el impacto y adopción de IA en todas las divisiones con datos en tiempo real',
      color: 'rojo',
      link: '/dashboard',
      spotlight: 'rgba(193, 56, 50, 0.15)'
    },
    {
      icon: BookOpen,
      title: 'Mejores Prácticas',
      description: 'Guías, templates y casos de éxito para implementar IA de forma efectiva en tu área',
      color: 'verde-oscuro',
      link: '/aprende',
      spotlight: 'rgba(16, 100, 112, 0.15)'
    },
    {
      icon: Shield,
      title: 'IA Responsable',
      description: 'Seguridad, privacidad y ética en el uso de inteligencia artificial en procesos críticos',
      color: 'rojo-oscuro',
      link: '/aprende',
      spotlight: 'rgba(122, 37, 49, 0.15)'
    }
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string; from: string; to: string }> = {
      naranja: { bg: 'bg-plataforma-naranja', text: 'text-plataforma-naranja', border: 'border-plataforma-naranja', from: 'from-plataforma-naranja', to: 'to-orange-500' },
      turquesa: { bg: 'bg-plataforma-turquesa', text: 'text-plataforma-turquesa', border: 'border-plataforma-turquesa', from: 'from-plataforma-turquesa', to: 'to-teal-500' },
      azul: { bg: 'bg-plataforma-azul', text: 'text-plataforma-azul', border: 'border-plataforma-azul', from: 'from-plataforma-azul', to: 'to-blue-600' },
      rojo: { bg: 'bg-plataforma-rojo', text: 'text-plataforma-rojo', border: 'border-plataforma-rojo', from: 'from-plataforma-rojo', to: 'to-red-600' },
      'verde-oscuro': { bg: 'bg-plataforma-verde-oscuro', text: 'text-plataforma-verde-oscuro', border: 'border-plataforma-verde-oscuro', from: 'from-plataforma-verde-oscuro', to: 'to-teal-700' },
      'rojo-oscuro': { bg: 'bg-plataforma-rojo-oscuro', text: 'text-plataforma-rojo-oscuro', border: 'border-plataforma-rojo-oscuro', from: 'from-plataforma-rojo-oscuro', to: 'to-red-800' },
      amarillo: { bg: 'bg-plataforma-amarillo', text: 'text-plataforma-amarillo', border: 'border-plataforma-amarillo', from: 'from-plataforma-amarillo', to: 'to-yellow-500' },
      beige: { bg: 'bg-plataforma-beige', text: 'text-plataforma-beige', border: 'border-plataforma-beige', from: 'from-plataforma-beige', to: 'to-stone-300' }
    };
    return colors[color] || colors.naranja;
  };

  return (
    <div>
      {/* Hero Section - Plataforma IA Style */}
      <section className="relative h-[600px] md:h-[700px] flex items-center overflow-hidden">
        {/* Video Background */}
        <div className="absolute inset-0 w-full h-full">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          >
            <source src="/Video.mp4" type="video/mp4" />
          </video>
          {/* Dark Overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60"></div>
        </div>

        <div className="relative max-w-7xl mx-auto pl-8 md:pl-16 py-10 text-left z-10">
          {/* Main Heading - Estilo Plataforma IA Original */}
          <h1 className="font-montserrat font-bold text-5xl md:text-6xl lg:text-7xl mb-6 leading-tight text-white">
            Queremos ser pilar del
            <br />
            desarrollo sustentable de
            <br />
            <span className="text-white">Chile con </span>
            <span className="text-plataforma-naranja inline-block">
              <TextType
                texts={["IA", "Innovación", "Tecnología", "Eficiencia", "Seguridad"]}
                typingSpeed={100}
                deletingSpeed={60}
                pauseDuration={2000}
                showCursor={true}
                cursorCharacter="_"
              />
            </span>
          </h1>

        </div>
      </section>

      {/* Unified Background Wrapper */}
      <div className="relative flex flex-col w-full">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/50 to-transparent z-0 pointer-events-none"></div>
        <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none">
          <div className="absolute inset-0 gradient-mesh opacity-40"></div>
          <div className="absolute inset-0 gradient-orange opacity-5"></div>
          <div className="absolute top-[10%] right-0 w-[500px] h-[500px] bg-plataforma-amarillo/20 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-plataforma-naranja/20 rounded-full blur-[100px]"></div>
        </div>

        {/* Stats Section - Floating Cards */}
        <section className="relative -mt-20 px-6 lg:px-8 pb-32 z-20">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                return (
                  <SpotlightCard
                    key={index}
                    spotlightColor={stat.spotlight}
                    className="group glass-effect rounded-3xl hover-lift hover-glow overflow-hidden"
                    style={{ animationDelay: `${index * 0.1}s`, border: 'none' }}
                  >
                    <div className="relative p-8 h-full w-full">
                      {/* Background Gradient */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>

                      <div className="relative z-10">
                        {stat.showLive && (
                          <span className="absolute top-0 right-0 flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                            </span>
                            <span className="text-xs text-gray-400 font-roboto">En vivo</span>
                          </span>
                        )}
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                          <Icon className="text-white" size={28} />
                        </div>
                        <h3 className="font-montserrat font-black text-5xl mb-3 text-gradient-orange flex items-center">
                          <CountUp
                            from={0}
                            to={stat.value}
                            separator=","
                            direction="up"
                            duration={3.5}
                            className="count-up-text"
                          />
                        </h3>
                        <p className="font-roboto font-semibold text-plataforma-gris-oscuro text-lg mb-2">
                          {stat.label}
                        </p>
                        <Badge variant="secondary" className="font-roboto font-normal text-gray-600 bg-white/50 border border-gray-200 shadow-sm mt-1">
                          {stat.sublabel}
                        </Badge>
                      </div>
                    </div>
                  </SpotlightCard>
                );
              })}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-32 px-6 lg:px-8 relative z-20">
          <div className="relative max-w-7xl mx-auto">
            {/* Heading - Now centered and on top */}
            <div className="text-center mb-20">
              <h2 className="font-montserrat font-black text-5xl md:text-6xl mb-6 text-plataforma-gris-oscuro tracking-tight">
                <span>Nuestros recursos </span>
                <span className="text-gray-400 font-medium">nunca se han </span>
                <span className="text-gradient-orange">visto tan bien</span>
              </h2>
              <p className="font-roboto text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-8">
                Simplemente observa la inteligencia artificial en acción. Conoce a nuestro equipo de agentes y recursos.
              </p>

              <Link to="/recursos" className="inline-flex items-center text-plataforma-naranja font-bold hover:text-orange-600 transition-colors group text-lg">
                Explorar catálogo completo
                <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </Link>
            </div>

            {/* Resources Grid - Full width */}
            <ResourcesGrid
              features={features}
              getColorClasses={getColorClasses}
            />
          </div>
        </section>

        {/* CTA Section - Modern */}
        <section className="py-32 px-6 lg:px-8 relative overflow-hidden z-20">
          <div className="relative max-w-4xl mx-auto text-center z-10">
            <div className="glass-effect rounded-3xl p-12 md:p-16 backdrop-blur-xl bg-white/40 border border-white/50 shadow-xl">
              <Sparkles size={48} className="text-plataforma-naranja mx-auto mb-8 animate-pulse" />
              <h2 className="font-montserrat font-black text-4xl md:text-5xl text-plataforma-gris-oscuro mb-6 tracking-tight">
                ¿Tienes una idea innovadora?
              </h2>
              <p className="font-roboto text-xl text-gray-700 mb-10 leading-relaxed max-w-2xl mx-auto font-medium">
                Valoramos las propuestas de todos los colaboradores de Plataforma IA.
                Comparte tu visión y ayúdanos a construir el futuro de la minería.
              </p>
              <Button asChild className="h-auto group relative px-10 py-5 rounded-2xl font-roboto font-bold text-lg text-white overflow-hidden hover-lift shadow-lg shadow-orange-500/30 border-0 p-0">
                <Link to="/chat" className="block w-full h-full p-5">
                  <span className="absolute inset-0 gradient-orange z-0"></span>
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 z-0"></span>
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <MessageSquare size={20} />
                    Ir al Chat IA
                  </span>
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomePage;
