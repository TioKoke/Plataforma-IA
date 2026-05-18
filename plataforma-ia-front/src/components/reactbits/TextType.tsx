import { useState, useEffect, useCallback } from 'react';

interface TextTypeProps {
  texts: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  showCursor?: boolean;
  cursorCharacter?: string;
  cursorBlinkDuration?: number;
  variableSpeedEnabled?: boolean;
  variableSpeedMin?: number;
  variableSpeedMax?: number;
  className?: string;
}

const TextType = ({
  texts,
  typingSpeed = 75,
  deletingSpeed = 50,
  pauseDuration = 1500,
  showCursor = true,
  cursorCharacter = '|',
  cursorBlinkDuration = 0.5,
  variableSpeedEnabled = false,
  variableSpeedMin = 60,
  variableSpeedMax = 120,
  className = '',
}: TextTypeProps) => {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const getTypingSpeed = useCallback(() => {
    if (!variableSpeedEnabled) return isDeleting ? deletingSpeed : typingSpeed;
    return Math.floor(Math.random() * (variableSpeedMax - variableSpeedMin + 1)) + variableSpeedMin;
  }, [variableSpeedEnabled, variableSpeedMin, variableSpeedMax, isDeleting, deletingSpeed, typingSpeed]);

  useEffect(() => {
    if (isPaused) return;

    const handleTyping = () => {
      const fullText = texts[currentTextIndex];
      
      if (isDeleting) {
        setCurrentText(prev => prev.slice(0, -1));
        
        if (currentText === '') {
          setIsDeleting(false);
          setCurrentTextIndex(prev => (prev + 1) % texts.length);
        }
      } else {
        setCurrentText(fullText.slice(0, currentText.length + 1));
        
        if (currentText === fullText) {
          setIsPaused(true);
          setTimeout(() => {
            setIsPaused(false);
            setIsDeleting(true);
          }, pauseDuration);
        }
      }
    };

    const timeout = setTimeout(handleTyping, getTypingSpeed());
    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, isPaused, texts, currentTextIndex, getTypingSpeed, pauseDuration]);

  return (
    <span className={className}>
      {currentText}
      {showCursor && (
        <span 
          style={{ 
            animation: `blink ${cursorBlinkDuration}s infinite alternate`,
            marginLeft: '2px'
          }}
        >
          {cursorCharacter}
        </span>
      )}
      <style>{`
        @keyframes blink {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `}</style>
    </span>
  );
};

export default TextType;
