import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton, TextField, Avatar, CircularProgress, List, ListItem, ListItemAvatar, ListItemText } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import LogoutIcon from '@mui/icons-material/Logout';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ForwardIcon from '@mui/icons-material/Forward';
import api from '../api/axios';

function ChatLayout() {
    const [contacts, setContacts] = useState([]);
    const [selectedContact, setSelectedContact] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [copiedMsg, setCopiedMsg] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const ws = useRef(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const navigate = useNavigate();
    const username = localStorage.getItem('username');

    useEffect(() => {
        const fetchContacts = async () => {
            const token = localStorage.getItem('token');
            try {
                const response = await api.get('/users/', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setContacts(response.data);
            } catch (err) {
                console.error('Failed to load contacts', err);
            }
        };
        fetchContacts();
    }, []);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        ws.current = new WebSocket(`wss://fastapi-crud-hxwo.onrender.com/ws?token=${token}`);

        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'online_users') {
                setOnlineUsers(data.users);
                return;
            }

            if (data.type === 'message') {
                setSelectedContact((current) => {
                    if (current && data.sender === current.username) {
                        setMessages((prev) => [...prev, {
                            text: data.text,
                            fileUrl: data.file_url,
                            fileType: data.file_type,
                            timestamp: data.timestamp,
                            sentByMe: false,
                        }]);
                    }
                    return current;
                });
            }
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

    const selectContact = async (contact) => {
        setSelectedContact(contact);
        setLoading(true);
        const token = localStorage.getItem('token');
        try {
            const response = await api.get(`/conversation/${contact.username}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const history = response.data.map((msg) => ({
                text: msg.message,
                fileUrl: msg.file_url,
                fileType: msg.file_type,
                sentByMe: msg.sender_username === username,
            }));
            setMessages(history);
        } catch (err) {
            console.error('Failed to load conversation', err);
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = () => {
        if (input.trim() === '' || !selectedContact) return;
        const now = new Date().toISOString();
        ws.current.send(JSON.stringify({
            type: 'message',              // ← YEH FIELD ZAROORI HAI
            receiver: selectedContact.username,
            text: input,
        }));
        setMessages((prev) => [...prev, { text: input, timestamp: now, sentByMe: true }]);
        setInput('');
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file || !selectedContact) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('receiver', selectedContact.username);

        const token = localStorage.getItem('token');
        try {
            const response = await api.post('/upload/', formData, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setMessages((prev) => [...prev, {
                fileUrl: response.data.file_url,
                fileType: response.data.file_type,
                sentByMe: true,
            }]);
        } catch (err) {
            console.error('Upload failed', err);
        }
        e.target.value = '';
    };

    const copyMessage = (text) => {
        navigator.clipboard.writeText(text)
            .then(() => {
                setCopiedMsg(true);
                setTimeout(() => setCopiedMsg(false), 1500);
            })
            .catch((err) => console.error('Copy failed', err));
    };

    const forwardMessage = (text) => {
        setInput(text);
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    return (
        <div className="d-flex" style={{ height: '100vh', backgroundColor: '#f0f2f5' }}>
            <div
                className="d-flex flex-column"
                style={{ width: '320px', borderRight: '1px solid #ddd', backgroundColor: 'white' }}
            >
                <div
                    className="d-flex align-items-center justify-content-between px-3 py-3"
                    style={{ backgroundColor: '#075E54' }}
                >
                    <div className="d-flex align-items-center gap-2">
                        <Avatar sx={{ bgcolor: '#25D366', width: 40, height: 40 }}>
                            {username?.[0]?.toUpperCase()}
                        </Avatar>
                        <p className="text-white fw-semibold mb-0">{username}</p>
                    </div>
                    <IconButton onClick={handleLogout} sx={{ color: 'white' }}>
                        <LogoutIcon />
                    </IconButton>
                </div>

                <List sx={{ overflowY: 'auto', flex: 1 }}>
                    {contacts.length === 0 ? (
                        <p className="text-muted text-center mt-4 small">No contacts found</p>
                    ) : (
                        contacts.map((contact) => (
                            <ListItem
                                key={contact.id}
                                onClick={() => selectContact(contact)}
                                sx={{
                                    cursor: 'pointer',
                                    backgroundColor: selectedContact?.username === contact.username ? '#f0f2f5' : 'white',
                                    '&:hover': { backgroundColor: '#f5f5f5' },
                                }}
                            >
                                <ListItemAvatar>
                                    <Avatar sx={{ bgcolor: '#25D366' }}>
                                        {contact.username[0].toUpperCase()}
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText primary={contact.username} secondary={contact.email} />
                            </ListItem>
                        ))
                    )}
                </List>
            </div>

            <div className="d-flex flex-column flex-grow-1" style={{ position: 'relative' }}>
                {copiedMsg && (
                    <div style={{
                        position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
                        backgroundColor: '#333', color: 'white', padding: '6px 12px',
                        borderRadius: '20px', fontSize: '12px', zIndex: 100,
                    }}>
                        Copied to clipboard!
                    </div>
                )}

                {!selectedContact ? (
                    <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
                        <ChatBubbleIcon sx={{ fontSize: 64, color: '#ccc' }} />
                        <p className="mt-3">Select a contact to start chatting</p>
                    </div>
                ) : (
                    <>
                        <div
                            className="d-flex align-items-center px-3 py-3"
                            style={{ backgroundColor: '#075E54' }}
                        >
                            <Avatar sx={{ bgcolor: '#25D366', width: 42, height: 42, mr: 2 }}>
                                {selectedContact.username[0].toUpperCase()}
                            </Avatar>
                            <p className="text-white fw-semibold mb-0">{selectedContact.username}</p>
                        </div>

                        <div
                            className="flex-grow-1 px-3 py-3 d-flex flex-column gap-2"
                            style={{ backgroundColor: '#ECE5DD', overflowY: 'auto' }}
                        >
                            {loading ? (
                                <div className="d-flex justify-content-center mt-4">
                                    <CircularProgress sx={{ color: '#075E54' }} />
                                </div>
                            ) : (
                                messages.map((msg, idx) => (
                                    <div
                                        key={idx}
                                        className={`px-3 py-2 shadow-sm ${msg.sentByMe ? 'align-self-end' : 'align-self-start'}`}
                                        style={{
                                            maxWidth: '60%',
                                            wordWrap: 'break-word',
                                            backgroundColor: msg.sentByMe ? '#DCF8C6' : '#ffffff',
                                            borderRadius: msg.sentByMe ? '12px 12px 0 12px' : '12px 12px 12px 0',
                                            fontSize: '14px',
                                        }}
                                    >
                                        {msg.fileUrl ? (
                                            <img src={msg.fileUrl} alt="attachment" style={{ maxWidth: '200px', borderRadius: '8px', display: 'block' }} />
                                        ) : (
                                            <div className="d-flex align-items-center justify-content-between gap-2">
                                                <span>{msg.text}</span>
                                                <div className="d-flex gap-1" style={{ flexShrink: 0 }}>
                                                    <ForwardIcon onClick={() => forwardMessage(msg.text)} sx={{ fontSize: 14, color: '#888', cursor: 'pointer', '&:hover': { color: '#075E54' } }} />
                                                    <ContentCopyIcon onClick={() => copyMessage(msg.text)} sx={{ fontSize: 14, color: '#888', cursor: 'pointer', '&:hover': { color: '#075E54' } }} />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className="d-flex align-items-center gap-2 px-3 py-2" style={{ backgroundColor: '#f0f0f0' }}>
                            <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept="image/*" />
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
                                sx={{ backgroundColor: 'white', borderRadius: '24px', '& .MuiOutlinedInput-root': { borderRadius: '24px' } }}
                            />
                            <IconButton onClick={sendMessage} sx={{ backgroundColor: '#075E54', color: 'white', width: 42, height: 42, '&:hover': { backgroundColor: '#054c44' } }}>
                                <SendIcon fontSize="small" />
                            </IconButton>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default ChatLayout;