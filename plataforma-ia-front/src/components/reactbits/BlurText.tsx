import { useEffect, useState } from 'react';

interface BlurTextProps {
  text: string;
  delay?: number;
  className?: string;
}

export default function BlurText({ text, delay = 50, className = '' }: BlurTextProps) {
  const words = text.split(' ');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 100);
  }, []);

  return (
    <p className={`flex flex-wrap ${className}`}>
      {words.map((word, i) => (
        <span
          key={i}
          className="inline-block transition-all duration-700 ease-out"
          style={{
            filter: visible ? 'blur(0px)' : 'blur(10px)',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translate3d(0,0,0)' : 'translate3d(0, 10px, 0)',
            transitionDelay: `${i * delay}ms`,
            marginRight: '0.25em'
          }}
        >
          {word}
        </span>
      ))}
    </p>
  );
}
