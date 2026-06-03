import React, { useState } from 'react';
import { FieldSpec, GatewayService } from '../types';
import styles from './EditServiceModal.module.css';

interface Props {
  service: GatewayService;
  onSave: (updated: Partial<GatewayService>) => void;
  onClose: () => void;
}

export function EditServiceModal({ service, onSave, onClose }: Props) {
  const [baseUrl, setBaseUrl] = useState(service.baseUrl);
  const [routePattern, setRoutePattern] = useState(service.routePattern);
  const [responseFormat, setResponseFormat] = useState(service.responseFormat);
  const [authRequired, setAuthRequired] = useState(service.authRequired);
  const [fields, setFields] = useState<FieldSpec[]>(service.spec?.fields ?? []);

  const updateField = (i: number, key: keyof FieldSpec, value: string) => {
    setFields((prev) => prev.map((f, idx) => idx === i ? { ...f, [key]: value } : f));
  };

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
    onSave({ baseUrl, routePattern, responseFormat, authRequired, spec: { fields } });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Edit {service.name}</h2>
        <form onSubmit={handleSubmit}>

          <label className={styles.label}>
            Base URL
            <input className={styles.input} value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)} required />
          </label>

          <label className={styles.label}>
            Route pattern
            <input className={styles.input} value={routePattern}
              onChange={(e) => setRoutePattern(e.target.value)} required />
          </label>

          <label className={styles.label}>
            Response format
            <select className={styles.input} value={responseFormat}
              onChange={(e) => setResponseFormat(e.target.value)}>
              <option value="json">json</option>
              <option value="xml">xml</option>
            </select>
          </label>

          <label className={styles.checkLabel}>
            <input type="checkbox" checked={authRequired}
              onChange={(e) => setAuthRequired(e.target.checked)} />
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
                      onChange={(e) => updateField(i, 'source', e.target.value)}
                      placeholder="e.g. jobTitle" />
                    <input className={styles.cellInput} value={f.target}
                      onChange={(e) => updateField(i, 'target', e.target.value)}
                      placeholder="e.g. role" />
                    <select className={styles.cellInput} value={f.type}
                      onChange={(e) => updateField(i, 'type', e.target.value)}>
                      <option value="string">string</option>
                      <option value="number">number</option>
                    </select>
                    <button type="button" className={styles.removeRow}
                      onClick={() => removeField(i)}>✕</button>
                  </React.Fragment>
                ))}
              </div>
            )}
            {fields.length === 0 && (
              <p className={styles.noFields}>No mappings — data passes through unchanged.</p>
            )}
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancel} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.save}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
