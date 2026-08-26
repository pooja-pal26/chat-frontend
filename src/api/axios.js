import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.DEV ? '/api' : 'https://fastapi-crud-hxwo.onrender.com',
});

export default api;