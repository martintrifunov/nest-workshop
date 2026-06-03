import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import nestClient from '../api/nestClient';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await nestClient.post('/auth/login', { username, password });
      localStorage.setItem('access_token', data.access_token);
      navigate('/');
    } catch {
      setError('Invalid username or password');
    }
  };

  return (
    <div className={styles.page}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Zoo Admin</h1>
        {error && <p className={styles.error}>{error}</p>}
        <label className={styles.label}>
          Username
          <input
            className={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className={styles.label}>
          Password
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <button className={styles.btn} type="submit">Sign in</button>
      </form>
    </div>
  );
}
