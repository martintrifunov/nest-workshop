import React from 'react';
import styles from './DataTable.module.css';

interface Props {
  data: Record<string, unknown>[];
}

export function DataTable({ data }: Props) {
  if (!data || data.length === 0) return <p className={styles.empty}>No data.</p>;
  const keys = Object.keys(data[0]);
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {keys.map((k) => <th key={k}>{k}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {keys.map((k) => (
                <td key={k}>{String(row[k] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
