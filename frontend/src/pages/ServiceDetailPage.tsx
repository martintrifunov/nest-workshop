import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import nestClient from '../api/nestClient';
import gatewayClient from '../api/gatewayClient';
import { DataTable } from '../components/DataTable';
import { EditServiceModal } from '../components/EditServiceModal';
import { useAuth } from '../hooks/useAuth';
import { GatewayService, RequestLog } from '../types';
import styles from './ServiceDetailPage.module.css';

export function ServiceDetailPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showEdit, setShowEdit] = useState(false);

  const { data: service, isLoading } = useQuery<GatewayService>({
    queryKey: ['service', name],
    queryFn: () => nestClient.get(`/services/${name}`).then((r) => r.data),
    staleTime: 30_000,
  });

  const { data: proxyData } = useQuery<unknown[]>({
    queryKey: ['proxy', service?.routePattern],
    queryFn: () =>
      gatewayClient.get(`/api/service/${service!.routePattern}`).then((r) =>
        Array.isArray(r.data) ? r.data : [r.data],
      ),
    enabled: !!service,
    staleTime: 30_000,
  });

  const { data: logs = [] } = useQuery<RequestLog[]>({
    queryKey: ['service-logs', name],
    queryFn: () => nestClient.get(`/services/${name}/logs`).then((r) => r.data),
    enabled: !!service,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });

  const deleteMutation = useMutation({
    mutationFn: () => nestClient.delete(`/services/${name}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      navigate('/');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (dto: Partial<GatewayService>) => nestClient.put(`/services/${name}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service', name] });
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setShowEdit(false);
    },
  });

  if (isLoading || !service) return <p className={styles.status}>Loading…</p>;

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate('/')}>← Back</button>
      <div className={styles.header}>
        <div>
          <h1 className={styles.name}>{service.name}</h1>
          <p className={styles.url}>{service.baseUrl}</p>
        </div>
        {user?.role === 'developer' && (
          <div className={styles.actions}>
            <button className={styles.editBtn} onClick={() => setShowEdit(true)}>Edit</button>
            <button className={styles.deleteBtn} onClick={() => deleteMutation.mutate()}>Delete</button>
          </div>
        )}
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Live data via gateway</h2>
        <DataTable data={(proxyData ?? []) as Record<string, unknown>[]} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Request log</h2>
        {logs.length === 0 ? (
          <p className={styles.noLogs}>No requests logged yet — hit the gateway to see entries.</p>
        ) : (
          <table className={styles.logTable}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const statusClass =
                  log.statusCode < 300 ? styles.logStatus2xx
                  : log.statusCode < 500 ? styles.logStatus4xx
                  : styles.logStatus5xx;
                return (
                  <tr key={log.id}>
                    <td title={new Date(log.createdAt).toLocaleString()}>
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </td>
                    <td>{log.method}</td>
                    <td style={{ fontFamily: 'monospace' }}>{log.path}</td>
                    <td className={statusClass}>{log.statusCode}</td>
                    <td>{log.durationMs} ms</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {showEdit && (
        <EditServiceModal
          service={service}
          onSave={(dto) => updateMutation.mutate(dto)}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  );
}
