import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Clock } from 'lucide-react';
import './Timer.css';

export default function Timer({ selectedItem }) {
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const timerRef = useRef(null);

  const activeProjectId = selectedItem ? (selectedItem.isProject ? selectedItem.id : selectedItem.project_id) : null;

  useEffect(() => {
    if (activeProjectId && window.electronAPI) {
      window.electronAPI.getTime(activeProjectId).then(total => {
        setTotalSeconds(total || 0);
      });
    } else {
      setTotalSeconds(0);
    }
  }, [activeProjectId]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    } else if (!isRunning && timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const stopTimer = async () => {
    setIsRunning(false);
    if (seconds > 0 && activeProjectId && window.electronAPI) {
      await window.electronAPI.logTime({ projectId: activeProjectId, durationSeconds: seconds });
      setTotalSeconds(totalSeconds + seconds);
    }
    setSeconds(0);
  };

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    if (h > 0) return `${h}h ${m}m`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!activeProjectId) return null;

  return (
    <div className="timer-container animate-fade-in">
      <div className="timer-display">
        <Clock size={14} className={isRunning ? "text-accent animate-pulse" : "text-secondary"} />
        <span className="timer-current">{formatTime(seconds)}</span>
        <span className="timer-separator">|</span>
        <span className="timer-total" title="Total project time">{formatTime(totalSeconds + seconds)}</span>
      </div>
      <div className="timer-controls">
        <button className="timer-btn" onClick={toggleTimer} title={isRunning ? "Pause" : "Start"}>
          {isRunning ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button className="timer-btn" onClick={stopTimer} disabled={seconds === 0} title="Stop and Save">
          <Square size={14} />
        </button>
      </div>
    </div>
  );
}
