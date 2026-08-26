import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton, TextField, Avatar, CircularProgress } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import LogoutIcon from '@mui/icons-material/Logout';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ForwardIcon from '@mui/icons-material/Forward';
import CloseIcon from '@mui/icons-material/Close';
import api from '../api/axios';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const ws = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const sentTexts = useRef(new Set());
  const sentFiles = useRef(new Set());
  const navigate = useNavigate();
  const username = localStorage.getItem('username');

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = '';
  };

  const parseTimestamp = (ts) => {
    if (!ts) return new Date().toISOString();
    if (typeof ts === 'string' && ts.includes('T') && !ts.endsWith('Z') && !ts.match(/[+-]\d{2}:\d{2}$/)) {
      return ts + 'Z';
    }
    return ts;
  };

  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await api.get('/messages/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const history = response.data.map((msg) => ({
          text: msg.message || msg.text || msg.content || null,
          fileUrl: msg.file_url || null,
          fileType: msg.file_type || null,
          sentByMe: msg.sender_username === username,
          timestamp: parseTimestamp(msg.created_at || msg.timestamp),
        }));
        setMessages(history);
      } catch (err) {
        console.error('Failed to load history', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    const wsUrl = `wss://fastapi-crud-hxwo.onrender.com/ws?token=${token}`;

    ws.current = new WebSocket(wsUrl);
    ws.current.onmessage = (event) => {
      let rawText = event.data;
      let sender = null;

      // Extract sender prefix safely
      if (typeof rawText === 'string') {
        const colonIndex = rawText.indexOf(': ');
        if (colonIndex > 0 && colonIndex < 30) {
          const possibleSender = rawText.substring(0, colonIndex);
          if (!possibleSender.includes('{') && !possibleSender.includes('"')) {
            sender = possibleSender;
            rawText = rawText.substring(colonIndex + 2).trim();
          }
        }
      }

      try {
        const data = JSON.parse(rawText);
        if (data.file_url) {
          const msgSender = data.sender || data.sender_username || sender;
          
          if (msgSender === username) {
            if (sentFiles.current.has(data.file_url)) {
              sentFiles.current.delete(data.file_url);
              return;
            }
          }
          
          setMessages((prev) => [...prev, {
            fileUrl: data.file_url,
            fileType: data.file_type,
            sentByMe: msgSender === username,
            timestamp: parseTimestamp(data.timestamp || data.created_at),
          }]);
          return;
        }
        
        // Handle JSON text messages
        if (data.text || data.message || data.content) {
          const msgSender = data.sender || data.sender_username || sender;
          const msgText = data.text || data.message || data.content;
          
          if (msgSender === username) {
            if (sentTexts.current.has(msgText)) {
              sentTexts.current.delete(msgText);
              return;
            }
          }
          
          setMessages((prev) => [...prev, {
            text: msgText,
            sentByMe: msgSender === username,
            timestamp: parseTimestamp(data.timestamp || data.created_at),
          }]);
          return;
        }
      } catch (e) {
        // Not JSON
      }

      if (sender === username) {
        if (sentTexts.current.has(rawText)) {
          // Ignore echo from this exact tab
          sentTexts.current.delete(rawText);
          return;
        }
      }

      setMessages((prev) => [...prev, { text: rawText, sentByMe: sender === username, timestamp: new Date().toISOString() }]);
    };

    ws.current.onclose = () => {
      console.log('Disconnected');
    };

    return () => {
      ws.current.close();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (input.trim() === '' && !selectedFile) return;

    if (selectedFile) {
      const formData = new FormData();
      formData.append('file', selectedFile);
      // Use the sender's own username as the receiver to bypass backend validation issues
      formData.append('receiver', username); 
      const token = localStorage.getItem('token');
      try {
        const response = await api.post('/upload/', formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        // Broadcast the image via WebSocket so the other user receives it
        const imgMsg = JSON.stringify({
          file_url: response.data.file_url,
          file_type: response.data.file_type,
          sender: username
        });
        ws.current.send(imgMsg);
        sentFiles.current.add(response.data.file_url);

        setMessages((prev) => [...prev, {
          fileUrl: response.data.file_url,
          fileType: response.data.file_type,
          sentByMe: true,
          timestamp: new Date().toISOString(),
        }]);
      } catch (err) {
        console.error('Upload failed', err);
        const errMsg = err.response?.data?.detail || err.message || 'Unknown error';
        alert('Image upload failed: ' + (typeof errMsg === 'object' ? JSON.stringify(errMsg) : errMsg));
      }
      setSelectedFile(null);
      setPreviewUrl(null);
    }

    if (input.trim() !== '') {
      ws.current.send(input);
      sentTexts.current.add(input.trim());
      setMessages((prev) => [...prev, { text: input, sentByMe: true, timestamp: new Date().toISOString() }]);
      setInput('');
    }
  };

  const copyMessage = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedMsg(true);
        setTimeout(() => setCopiedMsg(false), 1500);
      })
      .catch((err) => {
        console.error('Copy failed', err);
      });
  };

  const forwardMessage = (text) => {
    setInput(text);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}
    >
      <style>{`
        .msg-bubble .msg-actions {
          opacity: 0;
          transition: opacity 0.2s;
          position: absolute;
          top: 4px;
          right: 4px;
          background: rgba(255, 255, 255, 0.9);
          border-radius: 6px;
          padding: 2px 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          z-index: 10;
        }
        .msg-bubble:hover .msg-actions {
          opacity: 1;
        }
      `}</style>
      <div
        className="card shadow-lg border-0 d-flex flex-column"
        style={{
          width: '100%',
          maxWidth: '480px',
          height: '90vh',
          borderRadius: '16px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {copiedMsg && (
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            backgroundColor: '#333', color: 'white', padding: '6px 12px',
            borderRadius: '20px', fontSize: '12px', zIndex: 100,
          }}>
            Copied to clipboard!
          </div>
        )}

        <div
          className="d-flex align-items-center justify-content-between px-3 py-3"
          style={{ backgroundColor: '#075E54' }}
        >
          <div className="d-flex align-items-center gap-2">
            <Avatar sx={{ bgcolor: '#25D366', width: 42, height: 42 }}>
              {username?.[0]?.toUpperCase()}
            </Avatar>
            <div>
              <p className="text-white fw-semibold mb-0" style={{ fontSize: '16px', textTransform: 'capitalize' }}>
                {username || 'Chat Room'}
              </p>
              <p className="text-white-50 mb-0" style={{ fontSize: '12px' }}>
                Online
              </p>
            </div>
          </div>
          <IconButton onClick={handleLogout} sx={{ color: 'white' }}>
            <LogoutIcon />
          </IconButton>
        </div>

        <div
          className="flex-grow-1 px-3 py-3 d-flex flex-column gap-2"
          style={{ backgroundColor: '#ECE5DD', overflowY: 'auto' }}
        >
          {loading ? (
            <div className="d-flex flex-column align-items-center justify-content-center h-100">
              <CircularProgress sx={{ color: '#075E54' }} />
              <p className="text-muted mt-3 small">Loading messages...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
              <ChatBubbleIcon sx={{ fontSize: 48, color: '#ccc' }} />
              <p className="mt-2 small">No messages yet. Say hi! 👋</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`msg-bubble shadow-sm ${msg.sentByMe ? 'align-self-end' : 'align-self-start'}`}
                style={{
                  maxWidth: '75%',
                  backgroundColor: msg.sentByMe ? '#DCF8C6' : '#ffffff',
                  borderRadius: msg.sentByMe ? '12px 12px 0 12px' : '12px 12px 12px 0',
                  position: 'relative',
                  padding: msg.fileUrl ? '4px' : '6px 10px 8px 10px',
                }}
              >
                <div className="msg-actions d-flex gap-2 align-items-center">
                  <ForwardIcon
                    onClick={() => forwardMessage(msg.text || msg.fileUrl)}
                    sx={{ fontSize: 16, color: '#555', cursor: 'pointer', '&:hover': { color: '#075E54' } }}
                  />
                  <ContentCopyIcon
                    onClick={() => copyMessage(msg.text || msg.fileUrl)}
                    sx={{ fontSize: 16, color: '#555', cursor: 'pointer', '&:hover': { color: '#075E54' } }}
                  />
                </div>

                {msg.fileUrl ? (
                  <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                    <img
                      src={msg.fileUrl}
                      alt="attachment"
                      style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '8px', display: 'block', objectFit: 'cover' }}
                    />
                    <div style={{
                      position: 'absolute', bottom: '4px', right: '4px',
                      fontSize: '10px', color: 'white', backgroundColor: 'rgba(0,0,0,0.4)',
                      padding: '2px 6px', borderRadius: '10px',
                      whiteSpace: 'nowrap'
                    }}>
                      {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <span style={{ fontSize: '14px', whiteSpace: 'pre-wrap', wordWrap: 'break-word', display: 'inline-block', paddingRight: '45px', marginBottom: '2px' }}>
                      {msg.text}
                    </span>
                    <span style={{
                      position: 'absolute', bottom: '-2px', right: '0px',
                      fontSize: '10px', color: '#888', whiteSpace: 'nowrap'
                    }}>
                      {new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {previewUrl && (
          <div className="px-3 py-2 border-top" style={{ backgroundColor: '#f0f0f0', position: 'relative' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img src={previewUrl} alt="preview" style={{ height: '80px', borderRadius: '8px', objectFit: 'cover' }} />
              <IconButton
                size="small"
                onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                sx={{
                  position: 'absolute', top: -8, right: -8,
                  backgroundColor: 'rgba(0,0,0,0.6)', color: 'white',
                  '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' },
                  width: 24, height: 24
                }}
              >
                <CloseIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </div>
          </div>
        )}
        <div className="d-flex align-items-center gap-2 px-3 py-2" style={{ backgroundColor: '#f0f0f0' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            accept="image/*"
          />
          <IconButton onClick={() => fileInputRef.current.click()}>
            <AttachFileIcon />
          </IconButton>

          <TextField
            fullWidth
            size="small"
            placeholder="Type a message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            sx={{
              backgroundColor: 'white',
              borderRadius: '24px',
              '& .MuiOutlinedInput-root': {
                borderRadius: '24px',
              },
            }}
          />
          <IconButton
            onClick={sendMessage}
            sx={{
              backgroundColor: '#075E54',
              color: 'white',
              width: 42,
              height: 42,
              '&:hover': { backgroundColor: '#054c44' },
            }}
          >
            <SendIcon fontSize="small" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

export default Chat;