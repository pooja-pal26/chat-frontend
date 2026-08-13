import axios from 'axios';

const api = axios.create({
  baseURL: 'https://fastapi-crud-hxwo.onrender.com',
});

export default api;