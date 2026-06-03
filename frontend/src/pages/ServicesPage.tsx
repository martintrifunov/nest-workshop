import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import nestClient from '../api/nestClient';
import { ServiceCard } from '../components/ServiceCard';
import { useAuth } from '../hooks/useAuth';
import { GatewayService } from '../types';
import styles from './ServicesPage.module.css';

export function ServicesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: services = [], isLoading, error } = useQuery<GatewayService[]>({
    queryKey: ['services'],
    queryFn: () => nestClient.get('/services').then((r) => r.data),
    staleTime: 30_000,
  });

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    navigate('/login');
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Gateway Services</h1>
        <div className={styles.userBar}>
          <span className={styles.role}>{user?.role}</span>
          <span className={styles.username}>{user?.username}</span>
          <button className={styles.logout} onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {user?.role === 'developer' && (
        <div className={styles.toolbar}>
          <button className={styles.newBtn} onClick={() => navigate('/services/new')}>
            + Register service
          </button>
        </div>
      )}

      {isLoading && <p className={styles.status}>Loading…</p>}
      {error && <p className={styles.error}>Failed to load services.</p>}

      <div className={styles.grid}>
        {services.map((svc) => (
          <ServiceCard
            key={svc.id}
            service={svc}
            onClick={() => navigate(`/services/${svc.name}`)}
          />
        ))}
      </div>
    </div>
  );
}
