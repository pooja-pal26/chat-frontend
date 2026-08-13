import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TextField, Button, Alert, CircularProgress } from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import api from '../api/axios';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      const response = await api.post('/token', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('username', username);
      navigate('/chat');
    } catch (err) {
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="d-flex align-items-center justify-content-center"
      style={{ minHeight: '100vh', backgroundColor: '#f0f2f5' }}
    >
      <div
        className="card shadow-lg border-0"
        style={{ width: '100%', maxWidth: '420px', borderRadius: '16px' }}
      >
        <div className="card-body p-4 p-md-5">
          {/* Icon + Title */}
          <div className="text-center mb-4">
            <div
              className="d-inline-flex align-items-center justify-content-center mb-3"
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                backgroundColor: '#075E54',
              }}
            >
              <LockOpenIcon sx={{ color: 'white', fontSize: 32 }} />
            </div>
            <h3 className="fw-bold mb-1">Welcome Back</h3>
            <p className="text-muted small">Login to continue chatting</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <TextField
                label="Username"
                variant="outlined"
                fullWidth
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="mb-4">
              <TextField
                label="Password"
                type="password"
                variant="outlined"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{
                backgroundColor: '#075E54',
                borderRadius: '10px',
                py: 1.3,
                textTransform: 'none',
                fontSize: '16px',
                fontWeight: 600,
                '&:hover': { backgroundColor: '#054c44' },
              }}
            >
              {loading ? <CircularProgress size={24} sx={{ color: 'white' }} /> : 'Login'}
            </Button>
          </form>

          {error && (
            <Alert severity="error" className="mt-3" sx={{ borderRadius: '10px' }}>
              {error}
            </Alert>
          )}

          <p className="text-center text-muted mt-4 mb-0">
            New user?{' '}
            <Link to="/register" style={{ color: '#075E54', fontWeight: 600, textDecoration: 'none' }}>
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
