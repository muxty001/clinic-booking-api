import { randomUUID } from "node:crypto";
import { BookingForm } from "./booking-form";
import styles from "./page.module.css";
import { internalApiRequest } from "../lib/internal-api";

export const dynamic = "force-dynamic";

export default async function Home() {
  let slots: { id: string; provider: string; start: string; end: string; available: boolean }[] = [];
  let loadError = false;

  try {
    const response = await internalApiRequest("/slots");
    if (!response.ok) throw new Error("Unable to load slots.");
    const data = await response.json() as { slots: typeof slots };
    slots = data.slots.filter((slot) => slot.available);
  } catch {
    loadError = true;
  }

  return (
    <>
      <header className={styles.topbar}>
        <div className={`${styles.shell} ${styles.topbarInner}`}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              K
            </span>
            <span>Clinic Booking API</span>
          </div>
          <p className={styles.topNote}>A little care goes a long way</p>
        </div>
      </header>

      <main className={`${styles.shell} ${styles.main} min-h-screen`}>
        <section className={styles.intro}>
          <p className={styles.eyebrow}>Appointments</p>
          <h1>Find a time that works for you.</h1>
          <p className={styles.lead}>
            Choose an available appointment and we’ll take care of the rest.
          </p>
        </section>

        <section className={styles.bookingCard} aria-labelledby="booking-title">
          <h2 className={styles.visuallyHidden} id="booking-title">
            Book an appointment
          </h2>
          <BookingForm slots={slots} loadError={loadError} initialIdempotencyKey={randomUUID()} />
        </section>
      </main>

      <footer className={`${styles.shell} ${styles.footer}`}>
        Clinic Booking API appointment booking
      </footer>
    </>
  );
}
