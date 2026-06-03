import React from 'react';
import { GatewayService } from '../types';
import styles from './ServiceCard.module.css';

interface Props {
  service: GatewayService;
  onClick: () => void;
}

export function ServiceCard({ service, onClick }: Props) {
  return (
    <div className={styles.card} onClick={onClick} role="button" tabIndex={0}>
      <h3 className={styles.name}>{service.name}</h3>
      <p className={styles.url}>{service.baseUrl}</p>
      <span className={`${styles.badge} ${service.authRequired ? styles.auth : styles.open}`}>
        {service.authRequired ? 'auth required' : 'public'}
      </span>
    </div>
  );
}
