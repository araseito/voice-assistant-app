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

  useEffect(() => {
    const setupMediaRecorder = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        
        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const audioUrl = URL.createObjectURL(audioBlob);
          setAudioUrl(audioUrl);
          sendAudioToDify(audioBlob);
        };
      } catch (err) {
        setError(`マイクへのアクセスが拒否されました: ${err.message}`);
        console.error('Error accessing microphone:', err);
      }
    };

    setupMediaRecorder();
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        audioChunksRef.current = [];
        mediaRecorderRef.current.start();
        setIsRecording(true);
        setError('');
      } catch (err) {
        setError(`録音の開始に失敗しました: ${err.message}`);
        console.error('Error starting recording:', err);
      }
    }
  };

  const sendAudioToDify = async (audioBlob) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');
    formData.append('user', 'unique-user-id'); // ユーザー識別子を適切に設定

    try {
      // 音声認識API呼び出し
      const transcriptResponse = await axios.post('/api/audio-to-text', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setTranscript(transcriptResponse.data.text);

      // チャットAPI呼び出し
      const chatResponse = await axios.post('/api/chat-messages', {
        query: transcriptResponse.data.text,
        user: 'unique-user-id',
        response_mode: 'blocking'
      });
      setResponse(chatResponse.data.answer);

      // 音声合成API呼び出し
      const audioResponse = await axios.post('/api/text-to-audio', {
        text: chatResponse.data.answer,
        user: 'unique-user-id'
      }, { responseType: 'blob' });
      
      const synthAudioUrl = URL.createObjectURL(audioResponse.data);
      setAudioUrl(synthAudioUrl);
    } catch (err) {
      setError('処理中にエラーが発生しました。');
      console.error('Error processing audio:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="voice-assistant">
      <button onClick={toggleRecording} disabled={isLoading}>
        {isRecording ? '録音停止' : '録音開始'}
      </button>
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