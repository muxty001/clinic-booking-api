import styles from "./page.module.css";

export default function Loading() {
  return (
    <main className={`${styles.shell} ${styles.loadingPage}`}>
      <section
        className={styles.loadingCard}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <p>Loading available appointments…</p>
        <div className={styles.skeleton} aria-hidden="true" />
        <div className={`${styles.skeleton} ${styles.short}`} aria-hidden="true" />
      </section>
    </main>
  );
}
