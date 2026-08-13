import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton, TextField, Avatar, CircularProgress } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import LogoutIcon from '@mui/icons-material/Logout';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import api from '../api/axios';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const ws = useRef(null);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const username = localStorage.getItem('username');

  // Page load hote hi purane messages fetch karo DB se
  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem('token');
      try {
        const response = await api.get('/messages/', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const history = response.data.map((msg) => ({
          text: `${msg.sender_username}: ${msg.message}`,
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

    ws.current = new WebSocket(`ws://127.0.0.1:8000/ws?token=${token}`);

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
        style={{ width: '100%', maxWidth: '480px', height: '90vh', borderRadius: '16px', overflow: 'hidden' }}
      >
        {/* Header */}
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

        {/* Chat Body */}
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
                }}
              >
                {msg.text}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="d-flex align-items-center gap-2 px-3 py-2" style={{ backgroundColor: '#f0f0f0' }}>
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