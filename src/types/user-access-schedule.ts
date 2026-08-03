/** Uma linha da agenda, como trafega na API — horários sempre em "HH:MM". */
export interface AccessScheduleRow {
  day_of_week: number; // 0=Domingo ... 6=Sábado (Date.getDay())
  start_time: string;
  end_time: string;
}
