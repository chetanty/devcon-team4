import React, { useState, useRef } from 'react';
import { Play, BookOpen } from 'lucide-react';

const ManualReader = ({ content, apiUrl, currentLanguage }) => {
  const [selectedChapter, setSelectedChapter] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);
  const scrollRef = useRef(null);

  // Get the specific chapters for the current language
  const chapters = content[currentLanguage]?.chapters || [];
  const currentChapter = chapters[selectedChapter];

  // Update the progress bar based on scroll position
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const scrolled = (scrollTop / (scrollHeight - clientHeight)) * 100;
    setProgress(scrolled);
  };

  // YOUR PLAY LOGIC
  const playChapter = async () => {
    if (!currentChapter) return;
    setIsPlaying(true);
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'tts',
          text: currentChapter.text,
          language: currentLanguage
        }),
      });

      const data = await response.json();
      if (data.isBase64Encoded) {
        const audioSrc = `data:audio/mpeg;base64,${data.body}`;
        audioRef.current.src = audioSrc;
        audioRef.current.play();
      }
    } catch (err) {
      console.error("Audio failed", err);
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      {/* Sidebar */}
      <aside style={{ width: '280px', borderRight: '1px solid #ddd', overflowY: 'auto', background: '#f9f9f9', padding: '20px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><BookOpen /> Chapters</h3>
        {chapters.map((ch, idx) => (
          <button 
            key={idx} 
            onClick={() => { setSelectedChapter(idx); setProgress(0); }}
            style={{ 
              display: 'block', width: '100%', textAlign: 'left', padding: '12px', marginBottom: '8px',
              backgroundColor: selectedChapter === idx ? '#2563eb' : 'white',
              color: selectedChapter === idx ? 'white' : '#333',
              borderRadius: '8px', border: '1px solid #ddd', cursor: 'pointer'
            }}
          >
            {idx + 1}. {ch.title}
          </button>
        ))}
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '6px', width: '100%', background: '#eee' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#2563eb', transition: 'width 0.1s' }} />
        </div>

        <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
            <h1 style={{ margin: 0 }}>{currentChapter?.title}</h1>
            <button 
              onClick={playChapter} 
              disabled={isPlaying}
              style={{ 
                padding: '12px 24px', borderRadius: '30px', backgroundColor: '#16a34a', color: 'white', 
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold'
              }}
            >
              <Play size={18} fill="white" /> {isPlaying ? 'Reading...' : 'Listen to Chapter'}
            </button>
          </header>
          
          <div style={{ fontSize: '18px', lineHeight: '1.8', color: '#444', maxWidth: '800px' }}>
            {currentChapter?.text}
          </div>
        </div>
      </main>
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} hidden />
    </div>
  );
};

export default ManualReader;