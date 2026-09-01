import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  IconButton,
  TextField,
  Avatar,
  CircularProgress,
} from '@mui/material';

import SendIcon from '@mui/icons-material/Send';
import LogoutIcon from '@mui/icons-material/Logout';
import ChatBubbleIcon from '@mui/icons-material/ChatBubble';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import CloseIcon from '@mui/icons-material/Close';

import api from '../api/axios';

function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const ws = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const sentTexts = useRef(new Set());
  const sentFiles = useRef(new Set());

  const navigate = useNavigate();
  const username = localStorage.getItem('username');

  // -----------------------------
  // FILE SELECT
  // -----------------------------
  const handleFileSelect = (e) => {
    const file = e.target.files[0];

    if (!file) return;

    setSelectedFile(file);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    e.target.value = '';
  };

  // -----------------------------
  // TIMESTAMP FIX
  // -----------------------------
  const parseTimestamp = (ts) => {
    if (!ts) {
      return new Date().toISOString();
    }

    if (
      typeof ts === 'string' &&
      ts.includes('T') &&
      !ts.endsWith('Z') &&
      !ts.match(/[+-]\d{2}:\d{2}$/)
    ) {
      return `${ts}Z`;
    }

    return ts;
  };

  // -----------------------------
  // FORMAT TIME
  // -----------------------------
  const formatTime = (timestamp) => {
    return new Date(timestamp || Date.now()).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // -----------------------------
  // LOAD MESSAGE HISTORY
  // -----------------------------
  useEffect(() => {
    const fetchHistory = async () => {
      const token = localStorage.getItem('token');

      try {
        const response = await api.get('/messages/', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const history = response.data.map((msg) => ({
          text: msg.message || msg.text || msg.content || null,

          fileUrl: msg.file_url || null,

          fileType: msg.file_type || null,

          sentByMe:
            msg.sender_username === username,

          timestamp: parseTimestamp(
            msg.created_at || msg.timestamp
          ),
        }));

        setMessages(history);
      } catch (err) {
        console.error(
          'Failed to load history',
          err
        );
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [username]);

  // -----------------------------
  // WEBSOCKET CONNECTION
  // -----------------------------
  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      navigate('/login');
      return;
    }

    const wsUrl =
      `wss://fastapi-crud-hxwo.onrender.com/ws?token=${token}`;

    ws.current = new WebSocket(wsUrl);

    // -----------------------------
    // RECEIVE MESSAGE
    // -----------------------------
    ws.current.onmessage = (event) => {
      let rawText = event.data;

      let sender = null;

      // Extract sender prefix
      if (typeof rawText === 'string') {
        const colonIndex =
          rawText.indexOf(': ');

        if (
          colonIndex > 0 &&
          colonIndex < 30
        ) {
          const possibleSender =
            rawText.substring(
              0,
              colonIndex
            );

          if (
            !possibleSender.includes('{') &&
            !possibleSender.includes('"')
          ) {
            sender = possibleSender;

            rawText =
              rawText
                .substring(
                  colonIndex + 2
                )
                .trim();
          }
        }
      }

      // -----------------------------
      // TRY JSON MESSAGE
      // -----------------------------
      try {
        const data =
          JSON.parse(rawText);

        // -----------------------------
        // FILE / IMAGE MESSAGE
        // -----------------------------
        if (data.file_url) {
          const msgSender =
            data.sender ||
            data.sender_username ||
            sender;

          // Ignore duplicate echo
          if (
            msgSender === username &&
            sentFiles.current.has(
              data.file_url
            )
          ) {
            sentFiles.current.delete(
              data.file_url
            );

            return;
          }

          setMessages((prev) => [
            ...prev,
            {
              fileUrl:
                data.file_url,

              fileType:
                data.file_type,

              sentByMe:
                msgSender === username,

              timestamp:
                parseTimestamp(
                  data.timestamp ||
                  data.created_at
                ),
            },
          ]);

          return;
        }

        // -----------------------------
        // JSON TEXT MESSAGE
        // -----------------------------
        if (
          data.text ||
          data.message ||
          data.content
        ) {
          const msgSender =
            data.sender ||
            data.sender_username ||
            sender;

          const msgText =
            data.text ||
            data.message ||
            data.content;

          // Ignore duplicate echo
          if (
            msgSender === username &&
            sentTexts.current.has(
              msgText
            )
          ) {
            sentTexts.current.delete(
              msgText
            );

            return;
          }

          setMessages((prev) => [
            ...prev,
            {
              text: msgText,

              sentByMe:
                msgSender === username,

              timestamp:
                parseTimestamp(
                  data.timestamp ||
                  data.created_at
                ),
            },
          ]);

          return;
        }
      } catch (error) {
        // Normal text message
      }

      // -----------------------------
      // NORMAL TEXT MESSAGE
      // -----------------------------
      if (
        sender === username &&
        sentTexts.current.has(
          rawText
        )
      ) {
        sentTexts.current.delete(
          rawText
        );

        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          text: rawText,

          sentByMe:
            sender === username,

          timestamp:
            new Date().toISOString(),
        },
      ]);
    };

    ws.current.onclose = () => {
      console.log(
        'WebSocket disconnected'
      );
    };

    ws.current.onerror = (error) => {
      console.error(
        'WebSocket error',
        error
      );
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [navigate, username]);

  // -----------------------------
  // AUTO SCROLL
  // -----------------------------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages]);

  // -----------------------------
  // SEND MESSAGE
  // -----------------------------
  const sendMessage = async () => {
    if (
      input.trim() === '' &&
      !selectedFile
    ) {
      return;
    }

    // -----------------------------
    // SEND FILE
    // -----------------------------
    if (selectedFile) {
      const formData =
        new FormData();

      formData.append(
        'file',
        selectedFile
      );

      formData.append(
        'receiver',
        username
      );

      const token =
        localStorage.getItem('token');

      try {
        const response =
          await api.post(
            '/upload/',
            formData,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const imgMsg =
          JSON.stringify({
            file_url:
              response.data.file_url,

            file_type:
              response.data.file_type,

            sender:
              username,
          });

        if (
          ws.current &&
          ws.current.readyState ===
            WebSocket.OPEN
        ) {
          ws.current.send(
            imgMsg
          );
        }

        sentFiles.current.add(
          response.data.file_url
        );

        setMessages((prev) => [
          ...prev,
          {
            fileUrl:
              response.data.file_url,

            fileType:
              response.data.file_type,

            sentByMe: true,

            timestamp:
              new Date().toISOString(),
          },
        ]);
      } catch (err) {
        console.error(
          'Upload failed',
          err
        );

        const errMsg =
          err.response?.data?.detail ||
          err.message ||
          'Unknown error';

        alert(
          'Image upload failed: ' +
            (
              typeof errMsg === 'object'
                ? JSON.stringify(
                    errMsg
                  )
                : errMsg
            )
        );
      }

      setSelectedFile(null);

      if (previewUrl) {
        URL.revokeObjectURL(
          previewUrl
        );
      }

      setPreviewUrl(null);
    }

    // -----------------------------
    // SEND TEXT
    // -----------------------------
    if (input.trim() !== '') {
      const messageText =
        input.trim();

      if (
        ws.current &&
        ws.current.readyState ===
          WebSocket.OPEN
      ) {
        ws.current.send(
          messageText
        );

        sentTexts.current.add(
          messageText
        );

        setMessages((prev) => [
          ...prev,
          {
            text:
              messageText,

            sentByMe:
              true,

            timestamp:
              new Date().toISOString(),
          },
        ]);

        setInput('');
      } else {
        alert(
          'WebSocket is not connected. Please refresh the page.'
        );
      }
    }
  };

  // -----------------------------
  // LOGOUT
  // -----------------------------
  const handleLogout = () => {
    localStorage.clear();

    navigate('/login');
  };

  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{
        minHeight: '100vh',
        backgroundColor:
          '#f0f2f5',
      }}
    >
      <div
        className="card shadow-lg border-0 d-flex flex-column"
        style={{
          width: '100%',
          maxWidth: '480px',
          height: '90vh',
          borderRadius:
            '16px',
          overflow: 'hidden',
        }}
      >
        {/* HEADER */}

        <div
          className="d-flex align-items-center justify-content-between px-3 py-3"
          style={{
            backgroundColor:
              '#075E54',
          }}
        >
          <div
            className="d-flex align-items-center gap-2"
          >
            <Avatar
              sx={{
                bgcolor:
                  '#25D366',

                width: 42,

                height: 42,
              }}
            >
              {username?.[0]?.toUpperCase()}
            </Avatar>

            <div>
              <p
                className="text-white fw-semibold mb-0"
                style={{
                  fontSize:
                    '16px',

                  textTransform:
                    'capitalize',
                }}
              >
                {username ||
                  'Chat Room'}
              </p>

              <p
                className="text-white-50 mb-0"
                style={{
                  fontSize:
                    '12px',
                }}
              >
                Online
              </p>
            </div>
          </div>

          <IconButton
            onClick={
              handleLogout
            }
            sx={{
              color:
                'white',
            }}
          >
            <LogoutIcon />
          </IconButton>
        </div>

        {/* MESSAGES */}

        <div
          className="flex-grow-1 px-3 py-3 d-flex flex-column gap-2"
          style={{
            backgroundColor:
              '#ECE5DD',

            overflowY:
              'auto',
          }}
        >
          {loading ? (
            <div
              className="d-flex flex-column align-items-center justify-content-center h-100"
            >
              <CircularProgress
                sx={{
                  color:
                    '#075E54',
                }}
              />

              <p
                className="text-muted mt-3 small"
              >
                Loading messages...
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div
              className="d-flex flex-column align-items-center justify-content-center h-100 text-muted"
            >
              <ChatBubbleIcon
                sx={{
                  fontSize:
                    48,

                  color:
                    '#ccc',
                }}
              />

              <p
                className="mt-2 small"
              >
                No messages yet.
                Say hi! 👋
              </p>
            </div>
          ) : (
            messages.map(
              (msg, idx) => (
                <div
                  key={idx}
                  className={
                    `shadow-sm ${
                      msg.sentByMe
                        ? 'align-self-end'
                        : 'align-self-start'
                    }`
                  }
                  style={{
                    maxWidth:
                      '75%',

                    backgroundColor:
                      msg.sentByMe
                        ? '#DCF8C6'
                        : '#ffffff',

                    borderRadius:
                      msg.sentByMe
                        ? '12px 12px 0 12px'
                        : '12px 12px 12px 0',

                    position:
                      'relative',

                    padding:
                      msg.fileUrl
                        ? '4px'
                        : '7px 10px 7px 10px',
                  }}
                >
                  {/* IMAGE MESSAGE */}

                  {msg.fileUrl ? (
                    <div
                      style={{
                        position:
                          'relative',

                        display:
                          'inline-block',

                        width:
                          '100%',
                      }}
                    >
                      <img
                        src={
                          msg.fileUrl
                        }
                        alt="attachment"
                        style={{
                          maxWidth:
                            '100%',

                          maxHeight:
                            '250px',

                          borderRadius:
                            '8px',

                          display:
                            'block',

                          objectFit:
                            'cover',
                        }}
                      />

                      {/* TIME + DOUBLE TICK */}

                      <div
                        style={{
                          position:
                            'absolute',

                          bottom:
                            '4px',

                          right:
                            '4px',

                          fontSize:
                            '10px',

                          color:
                            'white',

                          backgroundColor:
                            'rgba(0,0,0,0.45)',

                          padding:
                            '2px 6px',

                          borderRadius:
                            '10px',

                          whiteSpace:
                            'nowrap',

                          display:
                            'flex',

                          alignItems:
                            'center',

                          gap:
                            '3px',
                        }}
                      >
                        <span>
                          {formatTime(
                            msg.timestamp
                          )}
                        </span>

                        {msg.sentByMe && (
                          <DoneAllIcon
                            sx={{
                              fontSize:
                                15,

                              color:
                                '#34B7F1',
                            }}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    /* TEXT MESSAGE */

                    <div
                      style={{
                        position:
                          'relative',

                        paddingRight:
                          '50px',

                        minWidth:
                          '100px',
                      }}
                    >
                      <span
                        style={{
                          fontSize:
                            '14px',

                          whiteSpace:
                            'pre-wrap',

                          wordWrap:
                            'break-word',

                          display:
                            'block',

                          paddingBottom:
                            '8px',
                        }}
                      >
                        {msg.text}
                      </span>

                      {/* TIME + DOUBLE TICK */}

                      <div
                        style={{
                          position:
                            'absolute',

                          bottom:
                            '0px',

                          right:
                            '0px',

                          fontSize:
                            '10px',

                          color:
                            '#888',

                          whiteSpace:
                            'nowrap',

                          display:
                            'flex',

                          alignItems:
                            'center',

                          gap:
                            '2px',
                        }}
                      >
                        <span>
                          {formatTime(
                            msg.timestamp
                          )}
                        </span>

                        {msg.sentByMe && (
                          <DoneAllIcon
                            sx={{
                              fontSize:
                                15,

                              color:
                                '#34B7F1',
                            }}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            )
          )}

          <div
            ref={
              messagesEndRef
            }
          />
        </div>

        {/* FILE PREVIEW */}

        {previewUrl && (
          <div
            className="px-3 py-2 border-top"
            style={{
              backgroundColor:
                '#f0f0f0',
            }}
          >
            <div
              style={{
                position:
                  'relative',

                display:
                  'inline-block',
              }}
            >
              <img
                src={
                  previewUrl
                }
                alt="preview"
                style={{
                  height:
                    '80px',

                  borderRadius:
                    '8px',

                  objectFit:
                    'cover',
                }}
              />

              <IconButton
                size="small"
                onClick={() => {
                  setSelectedFile(
                    null
                  );

                  URL.revokeObjectURL(
                    previewUrl
                  );

                  setPreviewUrl(
                    null
                  );
                }}
                sx={{
                  position:
                    'absolute',

                  top:
                    -8,

                  right:
                    -8,

                  backgroundColor:
                    'rgba(0,0,0,0.6)',

                  color:
                    'white',

                  width:
                    24,

                  height:
                    24,

                  '&:hover': {
                    backgroundColor:
                      'rgba(0,0,0,0.8)',
                  },
                }}
              >
                <CloseIcon
                  sx={{
                    fontSize:
                      16,
                  }}
                />
              </IconButton>
            </div>
          </div>
        )}

        {/* MESSAGE INPUT */}

        <div
          className="d-flex align-items-center gap-2 px-3 py-2"
          style={{
            backgroundColor:
              '#f0f0f0',
          }}
        >
          <input
            type="file"
            ref={
              fileInputRef
            }
            onChange={
              handleFileSelect
            }
            style={{
              display:
                'none',
            }}
            accept="image/*"
          />

          <IconButton
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            <AttachFileIcon />
          </IconButton>

          <TextField
            fullWidth
            size="small"
            placeholder="Type a message"
            value={input}
            onChange={(e) =>
              setInput(
                e.target.value
              )
            }
            onKeyDown={(e) => {
              if (
                e.key ===
                  'Enter' &&
                !e.shiftKey
              ) {
                e.preventDefault();

                sendMessage();
              }
            }}
            sx={{
              backgroundColor:
                'white',

              borderRadius:
                '24px',

              '& .MuiOutlinedInput-root':
                {
                  borderRadius:
                    '24px',
                },
            }}
          />

          <IconButton
            onClick={
              sendMessage
            }
            sx={{
              backgroundColor:
                '#075E54',

              color:
                'white',

              width:
                42,

              height:
                42,

              '&:hover': {
                backgroundColor:
                  '#054c44',
              },
            }}
          >
            <SendIcon
              fontSize="small"
            />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

export default Chat;