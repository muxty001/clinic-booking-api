"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { initialBookingActionState } from "../lib/booking-form-state";
import type { BookingFormField, BookingFormValues } from "../lib/booking-form-state";
import { submitBooking } from "./actions";
import styles from "./page.module.css";

interface AppointmentOption {
  id: string;
  provider: string;
  start: string;
  end: string;
}

interface BookingFormProps {
  slots: AppointmentOption[];
  loadError: boolean;
  initialIdempotencyKey: string;
}

function formatTime(value: string): string {
  return `${new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value))} UTC`;
}

export function BookingForm({ slots, loadError, initialIdempotencyKey }: BookingFormProps) {
  const [state, formAction, isPending] = useActionState(
    submitBooking,
    initialBookingActionState,
  );
  const [values, setValues] = useState<BookingFormValues>(
    initialBookingActionState.values,
  );
  const idempotencyKey = state.idempotencyKey ?? initialIdempotencyKey;
  const router = useRouter();

  useEffect(() => {
    if (state.outcome === "conflict") {
      router.refresh();
    }
  }, [router, state.revision, state.outcome]);

  function updateValue(field: BookingFormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function fieldError(field: BookingFormField): string | undefined {
    return values[field] === state.values[field] ? state.fieldErrors[field] : undefined;
  }

  if (state.outcome === "success" && state.booking) {
    return (
      <section className={styles.successCard} role="status" aria-live="polite">
        <p className={styles.eyebrow}>Appointment confirmed</p>
        <h3>You’re all set.</h3>
        <p>{state.message}</p>
        <dl className={styles.confirmationDetails}>
          <div>
            <dt>Booking ID</dt>
            <dd>{state.booking.id}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{state.booking.status}</dd>
          </div>
        </dl>
      </section>
    );
  }

  if (loadError) {
    return (
      <p className={styles.errorMessage} role="alert">
        We couldn’t load appointment times. Please try again.
      </p>
    );
  }

  if (slots.length === 0) {
    return (
      <p className={styles.emptyMessage} role="status">
        There are no appointments available right now. Please check again later.
      </p>
    );
  }

  const selectedSlot = slots.find((slot) => slot.id === values.slot_id);

  return (
    <div className={styles.bookingGrid}>
      <div className={styles.formSide}>
        <form action={formAction} className={styles.form} aria-busy={isPending}>
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      {state.message && (
        <p
          className={
            state.outcome === "error" || state.outcome === "conflict"
              ? styles.errorMessage
              : styles.formMessage
          }
          role={
            state.outcome === "error" || state.outcome === "conflict"
              ? "alert"
              : "status"
          }
          aria-live="polite"
        >
          {state.message}
        </p>
      )}

      <fieldset className={styles.fieldset} aria-describedby={fieldError("slot_id") ? "slot-error" : undefined}>
        <legend className={styles.fieldLabel}>Available times</legend>
        <div className={styles.slotList}>
          {slots.map((slot) => {
            const selected = values.slot_id === slot.id;
            return (
              <label
                className={`${styles.slot} ${selected ? styles.selected : ""}`}
                key={slot.id}
              >
                <input
                  type="radio"
                  name="slot_id"
                  value={slot.id}
                  checked={selected}
                  onChange={() => updateValue("slot_id", slot.id)}
                  aria-describedby={fieldError("slot_id") ? "slot-error" : undefined}
                />
                <span className={styles.slotCopy}>
                  <span className={styles.slotTime}>
                    {formatTime(slot.start)} – {formatTime(slot.end)}
                  </span>
                  <span className={styles.slotProvider}>{slot.provider}</span>
                </span>
              </label>
            );
          })}
        </div>
        {fieldError("slot_id") && (
          <p className={styles.fieldError} id="slot-error">
            {fieldError("slot_id")}
          </p>
        )}
      </fieldset>

      <div className={styles.fields}>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="patient-name">
            Your name
          </label>
          <input
            className={styles.input}
            id="patient-name"
            name="name"
            autoComplete="name"
            value={values.name}
            onChange={(event) => updateValue("name", event.target.value)}
            aria-invalid={Boolean(fieldError("name"))}
            aria-describedby={fieldError("name") ? "name-error" : undefined}
          />
          {fieldError("name") && (
            <p className={styles.fieldError} id="name-error">
              {fieldError("name")}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor="patient-email">
            Email address
          </label>
          <input
            className={styles.input}
            id="patient-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => updateValue("email", event.target.value)}
            aria-invalid={Boolean(fieldError("email"))}
            aria-describedby={fieldError("email") ? "email-error" : undefined}
          />
          {fieldError("email") && (
            <p className={styles.fieldError} id="email-error">
              {fieldError("email")}
            </p>
          )}
        </div>
      </div>

      <button className={styles.submit} type="submit" disabled={isPending}>
        {isPending ? "Confirming appointment…" : "Confirm appointment"}
      </button>
          <p className={styles.formHint}>Your appointment is confirmed after submission.</p>
        </form>
      </div>
      <aside className={styles.sidePanel} aria-label="Appointment summary">
        <h2>Your appointment</h2>
        {selectedSlot ? (
          <div className={styles.summary}>
            <p className={styles.summaryLabel}>Selected time</p>
            <div className={styles.summaryRow}>
              <span>When</span>
              <strong>
                {formatTime(selectedSlot.start)} – {formatTime(selectedSlot.end)}
              </strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Provider</span>
              <strong>{selectedSlot.provider}</strong>
            </div>
          </div>
        ) : (
          <p className={styles.summary}>
            Choose an available time to see your appointment details here.
          </p>
        )}
        <div className={styles.help}>
          Your selected appointment will be confirmed after you submit your details.
        </div>
      </aside>
    </div>
  );
}
