import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const ws = useRef(null);
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const username = localStorage.getItem('username');

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
    <div style={styles.container}>
      <div style={styles.header}>
        <span>💬 Chat Room</span>
        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
      </div>

      <div style={styles.chatBox}>
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              ...styles.message,
              alignSelf: msg.sentByMe ? 'flex-end' : 'flex-start',
              backgroundColor: msg.sentByMe ? '#dcf8c6' : '#fff',
            }}
          >
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputBar}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message"
          style={styles.input}
        />
        <button onClick={sendMessage} style={styles.sendBtn}>Send</button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    maxWidth: 500,
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    backgroundColor: '#075E54',
    color: 'white',
    padding: '15px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoutBtn: {
    backgroundColor: '#fff',
    color: '#075E54',
    border: 'none',
    padding: '5px 10px',
    borderRadius: '5px',
    cursor: 'pointer',
  },
  chatBox: {
    flex: 1,
    padding: '10px',
    overflowY: 'auto',
    backgroundColor: '#ECE5DD',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  message: {
    padding: '8px 12px',
    borderRadius: '8px',
    maxWidth: '70%',
    wordWrap: 'break-word',
    boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
  },
  inputBar: {
    display: 'flex',
    padding: '10px',
    backgroundColor: '#f0f0f0',
  },
  input: {
    flex: 1,
    padding: '10px',
    borderRadius: '20px',
    border: '1px solid #ccc',
    outline: 'none',
  },
  sendBtn: {
    marginLeft: '10px',
    padding: '10px 20px',
    backgroundColor: '#075E54',
    color: 'white',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
  },
};

export default Chat;
