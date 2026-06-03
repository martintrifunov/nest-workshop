import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import nestClient from '../api/nestClient';
import { FieldSpec } from '../types';
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
  const [fields, setFields] = useState<FieldSpec[]>([]);
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (dto: FormState & { spec: { fields: FieldSpec[] } }) =>
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

  const updateField = (i: number, key: keyof FieldSpec, value: string) =>
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, [key]: value } : f)));

  const addField = () => setFields((prev) => [...prev, { source: '', target: '', type: 'string' }]);

  const removeField = (i: number) => setFields((prev) => prev.filter((_, idx) => idx !== i));

  const handleSpecFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const incoming: FieldSpec[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.fields)
          ? parsed.fields
          : [];
        setFields(incoming);
      } catch {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ ...form, spec: { fields } });
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

        <div className={styles.specSection}>
          <div className={styles.specHeader}>
            <span className={styles.specTitle}>Field mappings</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <label className={styles.addRow} style={{ cursor: 'pointer' }}>
                Import JSON
                <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleSpecFile} />
              </label>
              <button type="button" className={styles.addRow} onClick={addField}>+ Add</button>
            </div>
          </div>
          {fields.length > 0 && (
            <div className={styles.fieldGrid}>
              <span className={styles.colHead}>source</span>
              <span className={styles.colHead}>target</span>
              <span className={styles.colHead}>type</span>
              <span />
              {fields.map((f, i) => (
                <React.Fragment key={i}>
                  <input className={styles.cellInput} value={f.source}
                    onChange={(e) => updateField(i, 'source', e.target.value)} placeholder="e.g. jobTitle" />
                  <input className={styles.cellInput} value={f.target}
                    onChange={(e) => updateField(i, 'target', e.target.value)} placeholder="e.g. role" />
                  <select className={styles.cellInput} value={f.type}
                    onChange={(e) => updateField(i, 'type', e.target.value)}>
                    <option value="string">string</option>
                    <option value="number">number</option>
                  </select>
                  <button type="button" className={styles.removeRow} onClick={() => removeField(i)}>✕</button>
                </React.Fragment>
              ))}
            </div>
          )}
          {fields.length === 0 && (
            <p className={styles.noFields}>No mappings — data passes through unchanged.</p>
          )}
        </div>

        <button className={styles.btn} type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Register'}
        </button>
      </form>
    </div>
  );
}

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
