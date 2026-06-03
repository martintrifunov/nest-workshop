import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import nestClient from '../api/nestClient';
import styles from './NewServicePage.module.css';

interface FormState {
  name: string;
  baseUrl: string;
  responseFormat: string;
  routePattern: string;
  authRequired: boolean;
}

export function NewServicePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>({
    name: '',
    baseUrl: '',
    responseFormat: 'json',
    routePattern: '',
    authRequired: true,
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (dto: FormState & { spec: { fields: [] } }) =>
      nestClient.post('/services', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      navigate('/');
    },
    onError: (err: any) => {
      if (err.response?.status === 401) {
        setError('Session expired — please log in again.');
      } else if (err.response?.status === 403) {
        setError('Your account does not have permission to register services.');
      } else {
        const msg = err.response?.data?.message;
        setError(Array.isArray(msg) ? msg.join(', ') : (msg ?? 'Failed to create service'));
      }
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ ...form, spec: { fields: [] } });
  };

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate('/')}>← Back</button>
      <h1 className={styles.title}>Register Service</h1>
      {error && <p className={styles.error}>{error}</p>}
      <form className={styles.form} onSubmit={handleSubmit}>
        {(['name', 'baseUrl', 'routePattern'] as const).map((field) => (
          <label key={field} className={styles.label}>
            {field}
            <input
              className={styles.input}
              name={field}
              value={form[field]}
              onChange={handleChange}
              required
            />
          </label>
        ))}
        <label className={styles.label}>
          responseFormat
          <select className={styles.input} name="responseFormat" value={form.responseFormat} onChange={handleChange}>
            <option value="json">json</option>
            <option value="xml">xml</option>
          </select>
        </label>
        <label className={styles.checkLabel}>
          <input type="checkbox" name="authRequired" checked={form.authRequired} onChange={handleChange} />
          Auth required
        </label>
        <button className={styles.btn} type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Register'}
        </button>
      </form>
    </div>
  );
}
