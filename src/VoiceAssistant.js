import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

const VoiceAssistant = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const silenceStartRef = useRef(null);
  const silenceThresholdRef = useRef(0.01); // 無音判定の閾値
  const silenceDurationRef = useRef(1500); // 無音判定の持続時間（ミリ秒）

  useEffect(() => {
    setupAudio();
    return () => cleanupAudio();
  }, []);

  const setupAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = handleDataAvailable;
      mediaRecorderRef.current.onstop = handleRecordingStop;
    } catch (err) {
      setError(`マイクへのアクセスが拒否されました: ${err.message}`);
      console.error('Error accessing microphone:', err);
    }
  };

  const cleanupAudio = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
  };

  const handleDataAvailable = (event) => {
    audioChunksRef.current.push(event.data);
  };

  const handleRecordingStop = () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const audioUrl = URL.createObjectURL(audioBlob);
    setAudioUrl(audioUrl);
    sendAudioToDify(audioBlob);
  };

  const startRecording = () => {
    audioChunksRef.current = [];
    mediaRecorderRef.current.start();
    setIsRecording(true);
    detectSilence();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const detectSilence = () => {
    if (!isRecording) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
    const normalizedAverage = average / 255;  // 0-1の範囲に正規化

    if (normalizedAverage < silenceThresholdRef.current) {
      if (silenceStartRef.current === null) {
        silenceStartRef.current = Date.now();
      } else if (Date.now() - silenceStartRef.current > silenceDurationRef.current) {
        stopRecording();
        return;
      }
    } else {
      silenceStartRef.current = null;
    }

    requestAnimationFrame(detectSilence);
  };

  const sendAudioToDify = async (audioBlob) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('user', 'unique-user-id');

    try {
      const transcriptResponse = await axios.post('/api/audio-to-text', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setTranscript(transcriptResponse.data.text);

      const chatResponse = await axios.post('/api/chat-messages', {
        query: transcriptResponse.data.text,
        user: 'unique-user-id',
        response_mode: 'blocking'
      });
      setResponse(chatResponse.data.answer);

      const audioResponse = await axios.post('/api/text-to-audio', {
        text: chatResponse.data.answer,
        user: 'unique-user-id'
      }, { responseType: 'blob' });
      
      const synthAudioUrl = URL.createObjectURL(audioResponse.data);
      setAudioUrl(synthAudioUrl);

      // 応答の再生が終わったら自動的に次の録音を開始
      const audio = new Audio(synthAudioUrl);
      audio.onended = () => {
        startRecording();
      };
      audio.play();
    } catch (err) {
      setError('処理中にエラーが発生しました。');
      console.error('Error processing audio:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="voice-assistant">
      <button onClick={startRecording} disabled={isRecording || isLoading}>
        会話を開始
      </button>
      {isRecording && <div>録音中...</div>}
      {isLoading && <div className="loading">処理中...</div>}
      {error && <div className="error">{error}</div>}
      <div className="transcript">文字起こし: {transcript}</div>
      <div className="response">応答: {response}</div>
      {audioUrl && (
        <div className="audio-player">
          <audio src={audioUrl} controls />
        </div>
      )}
    </div>
  );
};

export default VoiceAssistant;
