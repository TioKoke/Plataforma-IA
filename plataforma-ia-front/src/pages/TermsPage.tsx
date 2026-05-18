const TermsPage = () => {
  const sections = [
    { id: 1, title: "Aceptación de Términos", content: "La Corporación Nacional del Cobre (Plataforma IA) de Chile mantiene esta plataforma de IA (Plataforma IA) con la intención de proporcionar herramientas de inteligencia artificial para mejorar la eficiencia operacional, la toma de decisiones y el desarrollo profesional de sus colaboradores. Al acceder y utilizar la Plataforma IA, usted acepta estar vinculado por estos términos y condiciones de uso." },
    { id: 2, title: "Propiedad Intelectual", content: "Todos los contenidos de esta plataforma, incluyendo textos, imágenes, agentes de IA, algoritmos, y cualquier otro material, son propiedad de Plataforma IA o de sus licenciantes autorizados. El código fuente de los agentes, las configuraciones de modelos de IA y cualquier material derivado son difundidos únicamente para uso interno de Plataforma IA. Está prohibida la reproducción, distribución, modificación o uso comercial sin autorización explícita de Plataforma IA." },
    { id: 3, title: "Uso Autorizado", content: "La Plataforma IA es una herramienta corporativa destinada exclusivamente para colaboradores autorizados de Plataforma IA. El acceso está restringido a usuarios autenticados mediante credenciales corporativas. Usted se compromete a utilizar esta plataforma únicamente para propósitos laborales legítimos relacionados con sus funciones en Plataforma IA. Está prohibido compartir credenciales de acceso con terceros o utilizar la plataforma para actividades no autorizadas." },
    { id: 4, title: "Limitación de Responsabilidad", content: "Plataforma IA no se hace responsable por decisiones empresariales, operacionales o de cualquier naturaleza que se deriven del uso de información generada por los agentes de IA. Aunque los agentes están diseñados para proporcionar análisis precisos y recomendaciones basadas en datos, es responsabilidad del usuario validar la información, consultar con especialistas internos cuando sea necesario, y aplicar su criterio profesional. La información generada por IA debe considerarse como una herramienta de apoyo, no como recomendación definitiva." },
    { id: 5, title: "Información \"TAL CUAL\"", content: "La información y análisis generados por los agentes de IA se proporcionan \"tal cual es\", sujetos a disponibilidad y limitaciones tecnológicas. Aunque Plataforma IA se esfuerza por mantener agentes precisos y actualizados, es posible la presencia de inexactitudes, errores computacionales, sesgos en los datos de entrenamiento, o limitaciones en el conocimiento del modelo. Los usuarios deben ser conscientes de estas limitaciones inherentes a la tecnología de IA actual." },
    { id: 6, title: "Actualización de Contenidos", content: "Los agentes, funcionalidades, datos de referencia y cualquier otro contenido de la plataforma pueden ser actualizados, modificados, mejorados o retirados sin previo aviso. Plataforma IA se actualiza constantemente para incorporar nuevos agentes especializados y mejorar las capacidades existentes. Los cambios se implementan tan pronto como estén disponibles, lo cual puede o no coincidir con las expectativas de los usuarios." },
    { id: 7, title: "Seguridad de Datos y Privacidad", content: "Plataforma IA recopila información sobre el uso de la Plataforma IA, incluyendo consultas realizadas, agentes utilizados, y patrones de uso. Esta información será tratada con estricta confidencialidad y cumplirá con la legislación de protección de datos vigente en Chile. Los datos no serán compartidos con terceros externos sin consentimiento explícito, excepto cuando sea requerido por ley. La plataforma implementa medidas de seguridad para proteger la información corporativa y personal de los usuarios." },
    { id: 8, title: "Uso Prohibido", content: "Está estrictamente prohibido: utilizar los agentes para fines ilegales o sospechosos de infringir la legalidad; intentar acceder a sistemas no autorizados; reproducir o vender contenidos de la plataforma; modificar o hackear los agentes de IA; usar la plataforma para crear herramientas competidoras; o cualquier otra actividad que viole políticas corporativas o leyes aplicables." },
    { id: 9, title: "Herramientas de IA y Agentes Especializados", content: "La plataforma pone a disposición de los usuarios diversos agentes de IA especializados en áreas como análisis de datos, procesamiento de documentos, optimización operacional, cumplimiento normativo, gestión de recursos humanos y más. Cada agente es diseñado para aplicaciones específicas. Los usuarios deben seleccionar y utilizar el agente apropiado para su caso de uso. Plataforma IA no se responsabiliza por resultados deficientes si se utiliza un agente fuera de su alcance previsto." },
    { id: 10, title: "Integraciones con Herramientas Externas", content: "Algunos agentes pueden integrar servicios de terceros (procesamiento de archivos, cálculos, búsqueda de información). Plataforma IA no controla completamente estas herramientas externas y no se responsabiliza por su disponibilidad, precisión o seguridad. El uso de integraciones está sujeto a los términos de servicio de los terceros proveedores." },
    { id: 11, title: "Sesiones y Conversaciones", content: "Todas las conversaciones y sesiones en la Plataforma IA son registradas para propósitos de auditoría, mejora de la plataforma y conformidad. Los usuarios no deben compartir información confidencial, datos personales sensibles o información clasificada en las conversaciones con agentes, ya que esta información puede ser accesible para personal de TI de Plataforma IA. Se recomienda utilizar los agentes únicamente con información que es apropiada compartir internamente." },
    { id: 12, title: "Contacto e Información", content: "Para consultas sobre estos términos, problemas técnicos, o solicitudes de información sobre cómo se utilizan datos de la plataforma, contacte a:\n\nCorporación Nacional del Cobre\nPlataforma IA\nEmail: contacto@plataforma-ia.example\nTeléfono: +56 2 2690 3000\nHuérfanos 1270, Santiago, Chile\n\nTambién puede dirigirse a su División o Departamento de Tecnologías de Información para soporte técnico inmediato." }
  ];

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="font-heading font-semibold text-plataforma-gris-oscuro text-3xl mb-2">
            Términos y Condiciones
          </h1>
          <p className="text-gray-600">Plataforma Plataforma IA</p>
        </div>
      </div>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Introduction */}
          <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 mb-8">
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              La Corporación Nacional del Cobre (Plataforma IA) de Chile mantiene la plataforma <strong>Plataforma IA</strong> con la intención de proporcionar herramientas de inteligencia artificial para mejorar la eficiencia, productividad y toma de decisiones de nuestros colaboradores.
            </p>
            <p className="text-gray-700 text-sm leading-relaxed mb-3">
              Esta plataforma es de acceso restringido para colaboradores autorizados de Plataforma IA. Es importante que al utilizar los agentes y funcionalidades de IA, tenga en cuenta las condiciones de uso que se detallan a continuación.
            </p>
            <p className="text-gray-700 text-sm leading-relaxed">
              Al aceptar acceso a esta plataforma, usted acepta todos los términos y condiciones aquí establecidos.
            </p>
          </section>

          {/* Terms */}
          <section className="space-y-4">
            <h2 className="font-heading font-semibold text-plataforma-gris-oscuro text-2xl mb-6">Condiciones de Uso</h2>
            {sections.map((section) => (
              <div key={section.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-l-4 border-plataforma-naranja">
                  <h3 className="font-heading font-semibold text-plataforma-gris-oscuro mb-2">
                    {section.id}. {section.title}
                  </h3>
                  <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">{section.content}</p>
                </div>
              </div>
            ))}
          </section>

          {/* Important Notes */}
          <section className="mt-12 bg-gray-50 rounded-lg p-8 border border-gray-200">
            <h2 className="font-heading font-semibold text-plataforma-gris-oscuro text-xl mb-4">Nota Importante</h2>
            <ul className="space-y-3 text-gray-700 text-sm">
              <li className="flex items-start">
                <span className="text-plataforma-naranja font-bold mr-3">•</span>
                <span><strong>Para consultas específicas:</strong> Si requiere orientación sobre cómo usar los agentes de IA para casos particulares, contacte a su División o consulte con especialistas de Plataforma IA.</span>
              </li>
              <li className="flex items-start">
                <span className="text-plataforma-naranja font-bold mr-3">•</span>
                <span><strong>Confidencialidad:</strong> No comparta información clasificada, datos personales sensibles o información confidencial de Plataforma IA en las conversaciones con agentes.</span>
              </li>
              <li className="flex items-start">
                <span className="text-plataforma-naranja font-bold mr-3">•</span>
                <span><strong>Mejora continua:</strong> Plataforma IA constantemente actualiza y mejora los agentes. Sus sugerencias y feedback son bienvenidos.</span>
              </li>
            </ul>
          </section>

          {/* Last Updated */}
          <section className="mt-8 text-center text-gray-500 text-sm">
            <p>Última actualización: Febrero 2026</p>
            <p>Estos términos y condiciones están sujetos a cambios sin previo aviso.</p>
          </section>
        </div>
      </div>
    </>
  );
};

export default TermsPage;
