import { useState } from 'react';
import { Play } from 'lucide-react';

interface YouTubeFacadeProps {
  youtubeId: string;
  title: string;
}

const YouTubeFacade = ({ youtubeId, title }: YouTubeFacadeProps) => {
  const [isActive, setIsActive] = useState(false);
  const activate = () => setIsActive(true);

  if (isActive) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Reproducir video: ${title}`}
      onClick={activate}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') activate(); }}
      className="relative w-full h-full cursor-pointer group/facade"
    >
      <img
        src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
        alt={title}
        loading="lazy"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/10 group-hover/facade:bg-black/25 transition-colors duration-200" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-plataforma-turquesa/90 group-hover/facade:bg-plataforma-turquesa flex items-center justify-center shadow-lg transition-transform duration-200 group-hover/facade:scale-110">
          <Play size={24} fill="white" className="text-white ml-0.5" />
        </div>
      </div>
    </div>
  );
};

export default YouTubeFacade;
