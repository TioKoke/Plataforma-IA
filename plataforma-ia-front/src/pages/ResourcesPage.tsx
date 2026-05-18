import { useState } from 'react';
import { ChevronDown, ChevronUp, Mail, Send, AlertCircle } from 'lucide-react';
import { faqs } from '../data/mockData';

const FORMS_ENABLED = false;

const ResourcesPage = () => {
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', email: '', division: '', department: '', subject: '', message: ''
  });
  const [newsletterEmail, setNewsletterEmail] = useState('');

  const divisions = ['Chuquicamata', 'Andina', 'El Teniente', 'Gabriela Mistral', 'Ministro Hales', 'Radomiro Tomic', 'Salvador', 'Ventanas', 'Casa Matriz'];
  const departments = ['Operaciones Mina', 'Planificación Minera', 'Mantención', 'Seguridad y Salud Ocupacional', 'Recursos Humanos', 'Tecnologías de Información', 'Finanzas', 'Sustentabilidad'];
  const subjects = ['Consulta General', 'Propuesta de Nuevo Agente', 'Reporte de Problema', 'Solicitud de Capacitación', 'Feedback o Sugerencia', 'Colaboración'];

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="font-heading font-semibold text-plataforma-gris-oscuro text-3xl mb-2">
            Recursos y Soporte
          </h1>
          <p className="text-gray-600">
            Encuentra respuestas, envía tus consultas y mantente informado
          </p>
        </div>
      </div>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* FAQ */}
          <section className="mb-16">
            <div className="text-center mb-8">
              <h2 className="font-heading font-semibold text-plataforma-gris-oscuro text-2xl mb-2">Preguntas Frecuentes</h2>
              <p className="text-gray-600 text-sm">Respuestas a las consultas más comunes sobre la Plataforma IA</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {faqs.map((faq, index) => (
                <div key={faq.id} className={index !== 0 ? 'border-t border-gray-200' : ''}>
                  <button
                    onClick={() => toggleFaq(faq.id)}
                    className={`w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${
                      expandedFaq === faq.id ? 'bg-gray-50' : ''
                    }`}
                  >
                    <h3 className="font-heading font-medium text-plataforma-gris-oscuro text-left pr-4">{faq.question}</h3>
                    {expandedFaq === faq.id ? (
                      <ChevronUp size={20} className="text-plataforma-naranja flex-shrink-0" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  {expandedFaq === faq.id && (
                    <div className="px-6 py-4 bg-gray-50 border-l-4 border-plataforma-naranja">
                      <p className="text-gray-700 text-sm leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Contact Form */}
          <section className="mb-16">
            <div className="text-center mb-8">
              <h2 className="font-heading font-semibold text-plataforma-gris-oscuro text-2xl mb-2">Formulario de Contacto</h2>
              <p className="text-gray-600 text-sm">¿Tienes una consulta específica o propuesta? Escríbenos</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-3xl mx-auto">
              {!FORMS_ENABLED && (
                <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Este formulario no está disponible aún. Por ahora, contáctanos directamente en{' '}
                    <a href="mailto:contacto@plataforma-ia.example" className="font-medium underline hover:no-underline">contacto@plataforma-ia.example</a>
                  </p>
                </div>
              )}
              <div className={!FORMS_ENABLED ? 'opacity-40 pointer-events-none select-none' : ''}>
                <form className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="name" className="block font-medium text-plataforma-gris-oscuro text-sm mb-1.5">Nombre Completo <span className="text-plataforma-rojo">*</span></label>
                      <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} disabled={!FORMS_ENABLED} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-plataforma-naranja transition-colors" placeholder="Juan Pérez" />
                    </div>
                    <div>
                      <label htmlFor="email" className="block font-medium text-plataforma-gris-oscuro text-sm mb-1.5">Email Corporativo <span className="text-plataforma-rojo">*</span></label>
                      <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} disabled={!FORMS_ENABLED} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-plataforma-naranja transition-colors" placeholder="juan.perez@plataforma-ia.example" />
                    </div>
                    <div>
                      <label htmlFor="division" className="block font-medium text-plataforma-gris-oscuro text-sm mb-1.5">División <span className="text-plataforma-rojo">*</span></label>
                      <select id="division" name="division" value={formData.division} onChange={handleInputChange} disabled={!FORMS_ENABLED} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-plataforma-naranja transition-colors">
                        <option value="">Selecciona tu división</option>
                        {divisions.map((div) => (<option key={div} value={div}>{div}</option>))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="department" className="block font-medium text-plataforma-gris-oscuro text-sm mb-1.5">Departamento <span className="text-plataforma-rojo">*</span></label>
                      <select id="department" name="department" value={formData.department} onChange={handleInputChange} disabled={!FORMS_ENABLED} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-plataforma-naranja transition-colors">
                        <option value="">Selecciona tu departamento</option>
                        {departments.map((dept) => (<option key={dept} value={dept}>{dept}</option>))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="subject" className="block font-medium text-plataforma-gris-oscuro text-sm mb-1.5">Asunto <span className="text-plataforma-rojo">*</span></label>
                    <select id="subject" name="subject" value={formData.subject} onChange={handleInputChange} disabled={!FORMS_ENABLED} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-plataforma-naranja transition-colors">
                      <option value="">Selecciona el asunto</option>
                      {subjects.map((subject) => (<option key={subject} value={subject}>{subject}</option>))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="message" className="block font-medium text-plataforma-gris-oscuro text-sm mb-1.5">Mensaje <span className="text-plataforma-rojo">*</span></label>
                    <textarea id="message" name="message" value={formData.message} onChange={handleInputChange} disabled={!FORMS_ENABLED} rows={5} className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-plataforma-naranja transition-colors resize-none" placeholder="Describe tu consulta o propuesta en detalle..." />
                  </div>
                  <button type="submit" disabled={!FORMS_ENABLED} className="w-full bg-plataforma-naranja text-white py-3 rounded-lg font-medium hover:bg-plataforma-naranja/90 transition-colors flex items-center justify-center space-x-2 disabled:cursor-not-allowed">
                    <Send size={18} />
                    <span>Enviar Mensaje</span>
                  </button>
                </form>
              </div>
            </div>
          </section>

          {/* Newsletter */}
          <section>
            <div className="bg-white border border-plataforma-turquesa rounded-2xl p-8 md:p-12 shadow-sm">
              <div className="max-w-2xl mx-auto text-center">
                <Mail size={40} className="text-plataforma-turquesa mx-auto mb-4" />
                <h2 className="font-heading font-semibold text-plataforma-gris-oscuro text-2xl mb-2">Suscríbete al Newsletter</h2>
                <p className="text-gray-600 text-sm mb-6">Recibe actualizaciones mensuales sobre nuevos agentes, mejores prácticas y casos de éxito</p>
                {!FORMS_ENABLED && (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 text-left mb-4">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>Esta función no está disponible aún. Estará habilitada próximamente.</p>
                  </div>
                )}
                <div className={!FORMS_ENABLED ? 'opacity-40 pointer-events-none select-none' : ''}>
                  <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                    <input type="email" value={newsletterEmail} onChange={(e) => setNewsletterEmail(e.target.value)} disabled={!FORMS_ENABLED} placeholder="tu.email@plataforma-ia.example" className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-plataforma-naranja" />
                    <button type="submit" disabled={!FORMS_ENABLED} className="bg-plataforma-naranja text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-plataforma-naranja/90 transition-colors whitespace-nowrap disabled:cursor-not-allowed">Suscribirse</button>
                  </form>
                </div>
              </div>
            </div>
          </section>

          {/* Quick Contact */}
          <section className="mt-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
                <div className="w-10 h-10 bg-plataforma-naranja rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Mail size={20} className="text-white" />
                </div>
                <h3 className="font-heading font-semibold text-plataforma-gris-oscuro mb-1">Email</h3>
                <p className="text-gray-600 text-sm">contacto@plataforma-ia.example</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
                <div className="w-10 h-10 bg-plataforma-turquesa rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
                </div>
                <h3 className="font-heading font-semibold text-plataforma-gris-oscuro mb-1">Teléfono</h3>
                <p className="text-gray-600 text-sm">+56 2 2690 3000</p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
                <div className="w-10 h-10 bg-plataforma-azul rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
                </div>
                <h3 className="font-heading font-semibold text-plataforma-gris-oscuro mb-1">Ubicación</h3>
                <p className="text-gray-600 text-sm">Huérfanos 1270, Santiago</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default ResourcesPage;
