import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton, TextField, Avatar, CircularProgress } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import LogoutIcon from '@mui/icons-material/Logout';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ForwardIcon from '@mui/icons-material/Forward';
import api from '../api/axios';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const ws = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const username = localStorage.getItem('username');

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');
    try {
      const response = await api.post('/upload/', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setMessages((prev) => [...prev, {
        text: username,
        fileUrl: response.data.file_url,
        fileType: response.data.file_type,
        sentByMe: true,
      }]);
    } catch (err) {
      console.error('Upload failed', err);
    }
    e.target.value = '';
  };

  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await api.get('/messages/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const history = response.data.map((msg) => ({
          text: msg.message ? `${msg.sender_username}: ${msg.message}` : msg.sender_username,
          fileUrl: msg.file_url || null,
          fileType: msg.file_type || null,
          sentByMe: msg.sender_username === username,
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

    ws.current = new WebSocket(`wss://fastapi-crud-hxwo.onrender.com/ws?token=${token}`);

    ws.current.onmessage = (event) => {
      setMessages((prev) => [...prev, { text: event.data, sentByMe: false }]);
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

  const sendMessage = () => {
    if (input.trim() === '') return;
    ws.current.send(input);
    setMessages((prev) => [...prev, { text: `${username}: ${input}`, sentByMe: true }]);
    setInput('');
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
    const messageOnly = text.includes(': ') ? text.split(': ').slice(1).join(': ') : text;
    setInput(messageOnly);
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
              <p className="text-white fw-semibold mb-0" style={{ fontSize: '16px' }}>
                Chat Room
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
                className={`px-3 py-2 shadow-sm ${msg.sentByMe ? 'align-self-end' : 'align-self-start'}`}
                style={{
                  maxWidth: '75%',
                  wordWrap: 'break-word',
                  backgroundColor: msg.sentByMe ? '#DCF8C6' : '#ffffff',
                  borderRadius: msg.sentByMe ? '12px 12px 0 12px' : '12px 12px 12px 0',
                  fontSize: '14px',
                  position: 'relative',
                }}
              >
                {msg.fileUrl ? (
                  <img
                    src={msg.fileUrl}
                    alt="attachment"
                    style={{ maxWidth: '200px', borderRadius: '8px', display: 'block' }}
                  />
                ) : (
                  <div className="d-flex align-items-center justify-content-between gap-2">
                    <span>{msg.text}</span>
                    <div className="d-flex gap-1" style={{ flexShrink: 0 }}>
                      <ForwardIcon
                        onClick={() => forwardMessage(msg.text)}
                        sx={{
                          fontSize: 14,
                          color: '#888',
                          cursor: 'pointer',
                          '&:hover': { color: '#075E54' },
                        }}
                      />
                      <ContentCopyIcon
                        onClick={() => copyMessage(msg.text)}
                        sx={{
                          fontSize: 14,
                          color: '#888',
                          cursor: 'pointer',
                          '&:hover': { color: '#075E54' },
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

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