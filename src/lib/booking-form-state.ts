export type BookingFormField = "slot_id" | "name" | "email";

export interface BookingFormValues {
  slot_id: string;
  name: string;
  email: string;
}

export interface BookingActionState {
  outcome: "idle" | "validation" | "conflict" | "error" | "success";
  message: string;
  values: BookingFormValues;
  fieldErrors: Partial<Record<BookingFormField, string>>;
  booking?: {
    id: string;
    status: "confirmed" | "cancelled";
  };
  revision: number;
}

export const initialBookingActionState: BookingActionState = {
  outcome: "idle",
  message: "",
  values: { slot_id: "", name: "", email: "" },
  fieldErrors: {},
  revision: 0,
};
